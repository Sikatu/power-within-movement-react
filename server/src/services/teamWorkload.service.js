const { pool } = require('../db/pool')
const { listAttentionQueue } = require('./attentionQueue.service')
const {
  buildMemberSnapshot,
  dateTime,
  isWithinDays,
  safeNumber,
  startOfLocalDay,
} = require('./teamWorkloadSignal')

const LOAD_BANDS = ['light', 'balanced', 'high', 'overloaded']

function normalizeSession(row, memberIds = []) {
  return {
    id: row.id,
    clientProfileId: row.client_profile_id || null,
    clientName: [row.client_first_name, row.client_last_name].filter(Boolean).join(' ').trim()
      || row.guest_name
      || 'Guest',
    title: row.appointment_type_name || 'Private session',
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    memberIds,
  }
}

async function listTeamWorkload(user, db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const staffUserId = user?.role === 'staff' ? user.id : null
  const [membersResult, sessionsResult, queue] = await Promise.all([
    db.query(
      `
      SELECT
        su.id,
        su.email,
        su.role,
        su.status,
        COALESCE(tmp.display_name, su.email::text) AS display_name,
        COALESCE(tmp.job_title, '') AS job_title,
        COALESCE(tmp.department, CASE WHEN su.role = 'admin' THEN 'administration' ELSE 'client_care' END) AS department,
        COALESCE(tmp.availability_status, 'available') AS availability_status,
        COALESCE(tmp.capacity_percent, 100) AS capacity_percent,
        COALESCE(tmp.is_assignable, true) AS is_assignable,
        COUNT(DISTINCT tca.client_profile_id)::int AS assigned_client_count,
        COUNT(DISTINCT cc.id) FILTER (WHERE cc.status <> 'closed')::int AS open_conversation_count
      FROM system_users su
      LEFT JOIN team_member_profiles tmp ON tmp.user_id = su.id
      LEFT JOIN team_client_assignments tca ON tca.team_user_id = su.id
      LEFT JOIN client_conversations cc ON cc.assigned_user_id = su.id
      WHERE su.role IN ('admin', 'staff')
        AND su.status = 'active'
        AND ($1::uuid IS NULL OR su.id = $1)
      GROUP BY
        su.id,
        tmp.display_name,
        tmp.job_title,
        tmp.department,
        tmp.availability_status,
        tmp.capacity_percent,
        tmp.is_assignable
      ORDER BY
        CASE su.role WHEN 'admin' THEN 0 ELSE 1 END,
        COALESCE(tmp.display_name, su.email::text)
      `,
      [staffUserId],
    ),
    db.query(
      `
      SELECT
        b.id,
        b.client_profile_id,
        b.guest_name,
        b.starts_at,
        b.ends_at,
        b.status,
        at.name AS appointment_type_name,
        cp.first_name AS client_first_name,
        cp.last_name AS client_last_name
      FROM bookings b
      LEFT JOIN appointment_types at ON at.id = b.appointment_type_id
      LEFT JOIN client_profiles cp ON cp.id = b.client_profile_id
      WHERE b.starts_at >= date_trunc('day', now())
        AND b.starts_at < date_trunc('day', now()) + interval '31 days'
        AND b.status IN ('requested', 'approved', 'confirmed')
        AND (
          $1::uuid IS NULL
          OR EXISTS (
            SELECT 1
            FROM team_client_assignments tca
            WHERE tca.team_user_id = $1
              AND tca.client_profile_id = b.client_profile_id
          )
        )
      ORDER BY b.starts_at ASC
      LIMIT 500
      `,
      [staffUserId],
    ),
    listAttentionQueue(user, db),
  ])

  const scopedMemberIds = new Set(membersResult.rows.map((row) => row.id))
  const queueUsers = queue.teamUsers.filter((teamUser) => scopedMemberIds.has(teamUser.id))
  const assignmentsByClient = new Map()

  for (const teamUser of queueUsers) {
    for (const clientProfileId of teamUser.clientProfileIds || []) {
      if (!assignmentsByClient.has(clientProfileId)) assignmentsByClient.set(clientProfileId, [])
      assignmentsByClient.get(clientProfileId).push(teamUser.id)
    }
  }

  const sessions = sessionsResult.rows.map((row) => normalizeSession(
    row,
    assignmentsByClient.get(row.client_profile_id) || [],
  ))

  const tasks = queue.tasks.map((task) => ({
    ...task,
    eligibleOwnerIds: task.sourceType === 'care_action'
      ? queueUsers
        .filter((teamUser) => teamUser.clientProfileIds.includes(task.clientProfileId))
        .map((teamUser) => teamUser.id)
      : queueUsers.map((teamUser) => teamUser.id),
  }))

  const members = membersResult.rows.map((row) => {
    const queueUser = queueUsers.find((entry) => entry.id === row.id)
    return buildMemberSnapshot({
      id: row.id,
      email: row.email,
      role: row.role,
      displayName: row.display_name,
      jobTitle: row.job_title,
      department: row.department,
      availabilityStatus: row.availability_status,
      capacityPercent: safeNumber(row.capacity_percent, 100),
      isAssignable: row.is_assignable !== false,
      assignedClientCount: safeNumber(row.assigned_client_count),
      openConversationCount: safeNumber(row.open_conversation_count),
      clientProfileIds: queueUser?.clientProfileIds || [],
    }, tasks, sessions)
  })

  const unassignedTasks = tasks.filter((task) => !task.ownerUserId)
  const unassignedSessions = sessions.filter((session) => !session.memberIds.length)

  return {
    generatedAt: new Date().toISOString(),
    viewer: {
      role: user?.role || 'staff',
      teamWide: user?.role !== 'staff',
    },
    summary: {
      activeMembers: members.length,
      availableMembers: members.filter((member) => (
        member.isAssignable && member.availabilityStatus === 'available'
      )).length,
      overloadedMembers: members.filter((member) => member.band === 'overloaded').length,
      activeTasks: tasks.length,
      overdueTasks: tasks.filter((task) => {
        const dueAt = dateTime(task.dueAt)
        return dueAt !== null && dueAt < startOfLocalDay()
      }).length,
      unassignedTasks: unassignedTasks.length,
      sessions7: sessions.filter((session) => isWithinDays(session.startsAt, Date.now(), 7)).length,
      unassignedSessions: unassignedSessions.length,
    },
    members,
    tasks,
    sessions,
    unassignedTasks,
    unassignedSessions,
    loadBands: LOAD_BANDS,
  }
}

module.exports = {
  LOAD_BANDS,
  listTeamWorkload,
}
