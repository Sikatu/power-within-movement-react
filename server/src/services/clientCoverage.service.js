const { pool } = require('../db/pool')
const { listAttentionQueue } = require('./attentionQueue.service')
const { buildClientCoverage } = require('./clientCoverageSignal')

function fullName(row) {
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
    || row.email
    || 'Client'
}

function normalizeAssignments(value) {
  if (!Array.isArray(value)) return []

  return value.map((member) => ({
    id: member.id,
    displayName: member.displayName || member.email || 'Studio team member',
    email: member.email || '',
    assignmentRole: member.assignmentRole || 'support',
    availabilityStatus: member.availabilityStatus || 'available',
    capacityPercent: Number(member.capacityPercent || 100),
    isAssignable: member.isAssignable !== false,
  }))
}

async function listClientCoverage(user, db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const staffUserId = user?.role === 'staff' ? user.id : null
  const [clientsResult, queue] = await Promise.all([
    db.query(
      `
      SELECT
        cp.id,
        cp.first_name,
        cp.last_name,
        cp.client_status,
        cp.public_contact_email,
        su.email,
        ccp.primary_goal,
        ccp.transformation_focus,
        ccp.journey_stage,
        ccp.care_status,
        booking_stats.next_session_at,
        booking_stats.next_session_status,
        booking_stats.upcoming_sessions,
        conversation_stats.waiting_on_team,
        conversation_stats.open_conversations,
        conversation_stats.last_message_at,
        service_stats.last_service_at,
        COALESCE(assignments.members, '[]'::jsonb) AS assigned_members
      FROM client_profiles cp
      LEFT JOIN system_users su ON su.id = cp.user_id
      LEFT JOIN client_care_plans ccp ON ccp.client_profile_id = cp.id
      LEFT JOIN LATERAL (
        SELECT
          MIN(b.starts_at) FILTER (
            WHERE b.starts_at >= now()
              AND b.status IN ('requested', 'approved', 'confirmed')
          ) AS next_session_at,
          (
            SELECT b2.status
            FROM bookings b2
            WHERE b2.client_profile_id = cp.id
              AND b2.starts_at >= now()
              AND b2.status IN ('requested', 'approved', 'confirmed')
            ORDER BY b2.starts_at ASC
            LIMIT 1
          ) AS next_session_status,
          COUNT(*) FILTER (
            WHERE b.starts_at >= now()
              AND b.starts_at < now() + interval '30 days'
              AND b.status IN ('requested', 'approved', 'confirmed')
          )::int AS upcoming_sessions
        FROM bookings b
        WHERE b.client_profile_id = cp.id
      ) booking_stats ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE cc.status = 'waiting_on_team')::int AS waiting_on_team,
          COUNT(*) FILTER (WHERE cc.status <> 'closed')::int AS open_conversations,
          MAX(cc.updated_at) AS last_message_at
        FROM client_conversations cc
        WHERE cc.client_profile_id = cp.id
      ) conversation_stats ON true
      LEFT JOIN LATERAL (
        SELECT MAX(sr.service_date) AS last_service_at
        FROM service_records sr
        WHERE sr.client_profile_id = cp.id
      ) service_stats ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', assigned_user.id,
            'email', assigned_user.email,
            'displayName', COALESCE(tmp.display_name, assigned_user.email::text),
            'assignmentRole', tca.assignment_role,
            'availabilityStatus', COALESCE(tmp.availability_status, 'available'),
            'capacityPercent', COALESCE(tmp.capacity_percent, 100),
            'isAssignable', COALESCE(tmp.is_assignable, true)
          )
          ORDER BY
            CASE tca.assignment_role
              WHEN 'primary' THEN 0
              WHEN 'support' THEN 1
              WHEN 'specialist' THEN 2
              ELSE 3
            END,
            COALESCE(tmp.display_name, assigned_user.email::text)
        ) AS members
        FROM team_client_assignments tca
        JOIN system_users assigned_user
          ON assigned_user.id = tca.team_user_id
          AND assigned_user.status = 'active'
        LEFT JOIN team_member_profiles tmp ON tmp.user_id = assigned_user.id
        WHERE tca.client_profile_id = cp.id
      ) assignments ON true
      WHERE cp.client_status IN ('active_client', 'member')
        AND (
          $1::uuid IS NULL
          OR EXISTS (
            SELECT 1
            FROM team_client_assignments viewer_assignment
            WHERE viewer_assignment.team_user_id = $1
              AND viewer_assignment.client_profile_id = cp.id
          )
        )
      ORDER BY cp.updated_at DESC, cp.created_at DESC
      LIMIT 500
      `,
      [staffUserId],
    ),
    listAttentionQueue(user, db),
  ])

  const tasksByClient = new Map()
  for (const task of queue.tasks || []) {
    if (!tasksByClient.has(task.clientProfileId)) tasksByClient.set(task.clientProfileId, [])
    tasksByClient.get(task.clientProfileId).push(task)
  }

  const clients = clientsResult.rows.map((row) => {
    const assignments = normalizeAssignments(row.assigned_members)
    const tasks = tasksByClient.get(row.id) || []
    const activeTasks = tasks.length
    const overdueTasks = tasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < Date.now()).length
    const urgentTasks = tasks.filter((task) => task.priority === 'urgent').length
    const waitingOnTeam = Number(row.waiting_on_team || 0)
    const coverage = buildClientCoverage({
      assignments,
      activeTasks,
      overdueTasks,
      urgentTasks,
      waitingOnTeam,
      nextSessionAt: row.next_session_at,
    })

    return {
      id: row.id,
      name: fullName(row),
      email: row.email || row.public_contact_email || '',
      clientStatus: row.client_status,
      primaryGoal: row.primary_goal || '',
      transformationFocus: row.transformation_focus || '',
      journeyStage: row.journey_stage || 'onboarding',
      careStatus: row.care_status || 'not_started',
      nextSessionAt: row.next_session_at,
      nextSessionStatus: row.next_session_status || null,
      upcomingSessions: Number(row.upcoming_sessions || 0),
      waitingOnTeam,
      openConversations: Number(row.open_conversations || 0),
      lastMessageAt: row.last_message_at,
      lastServiceAt: row.last_service_at,
      assignments,
      tasks,
      activeTasks,
      overdueTasks,
      urgentTasks,
      coverage,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    viewer: {
      role: user?.role || 'staff',
      teamWide: user?.role !== 'staff',
    },
    summary: {
      activeClients: clients.length,
      unownedClients: clients.filter((client) => client.coverage.band === 'unowned').length,
      handoffNeeded: clients.filter((client) => ['handoff', 'coverage'].includes(client.coverage.band)).length,
      backupCoverage: clients.filter((client) => client.coverage.band === 'backup').length,
      coveredClients: clients.filter((client) => client.coverage.band === 'covered').length,
      waitingOnTeam: clients.reduce((total, client) => total + client.waitingOnTeam, 0),
    },
    clients,
  }
}

module.exports = {
  listClientCoverage,
  normalizeAssignments,
}
