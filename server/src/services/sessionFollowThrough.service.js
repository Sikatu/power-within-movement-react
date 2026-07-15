const { pool } = require('../db/pool')
const { buildSessionFollowThrough, safeNumber } = require('./sessionFollowThroughSignal')

const ALLOWED_HORIZONS = new Set([14, 30, 60])

function normalizeHorizon(value) {
  const parsed = Number(value)
  return ALLOWED_HORIZONS.has(parsed) ? parsed : 30
}

function fullName(row) {
  return [row.client_first_name, row.client_last_name].filter(Boolean).join(' ').trim()
    || row.guest_name
    || row.client_email
    || row.guest_email
    || 'Private client'
}

function normalizeAssignments(value) {
  if (!Array.isArray(value)) return []
  return value.map((member) => ({
    id: member.id,
    displayName: member.displayName || member.email || 'Studio team member',
    email: member.email || '',
    assignmentRole: member.assignmentRole || 'support',
  }))
}

async function listSessionFollowThrough(user, options = {}, db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const days = normalizeHorizon(options.days)
  const staffUserId = user?.role === 'staff' ? user.id : null

  const result = await db.query(
    `
    SELECT
      b.id,
      b.client_profile_id,
      b.guest_name,
      b.guest_email,
      b.starts_at,
      b.ends_at,
      b.timezone,
      b.status,
      b.admin_notes,
      b.updated_at,
      at.name AS appointment_type_name,
      cp.first_name AS client_first_name,
      cp.last_name AS client_last_name,
      client_user.email AS client_email,
      ccp.primary_goal,
      ccp.journey_stage,
      ccp.care_status,
      session_record.id AS session_record_id,
      session_record.title AS session_record_title,
      session_record.summary AS session_record_summary,
      session_record.private_notes AS session_private_notes,
      session_record.client_visible_notes AS session_client_visible_notes,
      session_record.follow_up_at,
      session_record.occurred_at AS session_recorded_at,
      COALESCE(tasks.active_tasks, 0)::int AS active_tasks,
      COALESCE(tasks.overdue_tasks, 0)::int AS overdue_tasks,
      COALESCE(tasks.urgent_tasks, 0)::int AS urgent_tasks,
      COALESCE(conversations.waiting_on_team, 0)::int AS waiting_on_team,
      COALESCE(resources.resources_shared, 0)::int AS resources_shared,
      next_booking.next_session_at,
      next_booking.next_session_name,
      COALESCE(assignments.members, '[]'::jsonb) AS assigned_members
    FROM bookings b
    LEFT JOIN appointment_types at ON at.id = b.appointment_type_id
    LEFT JOIN client_profiles cp ON cp.id = b.client_profile_id
    LEFT JOIN system_users client_user ON client_user.id = cp.user_id
    LEFT JOIN client_care_plans ccp ON ccp.client_profile_id = cp.id
    LEFT JOIN LATERAL (
      SELECT
        sr.id,
        sr.title,
        sr.summary,
        sr.private_notes,
        sr.client_visible_notes,
        sr.follow_up_at,
        COALESCE(sr.service_date, sr.occurred_at, sr.created_at) AS occurred_at
      FROM service_records sr
      WHERE sr.client_profile_id = cp.id
        AND COALESCE(sr.status, 'completed') <> 'archived'
        AND COALESCE(sr.service_date, sr.occurred_at, sr.created_at) >= b.starts_at - interval '12 hours'
        AND COALESCE(sr.service_date, sr.occurred_at, sr.created_at) <= b.starts_at + interval '7 days'
      ORDER BY ABS(EXTRACT(EPOCH FROM (COALESCE(sr.service_date, sr.occurred_at, sr.created_at) - b.starts_at)))
      LIMIT 1
    ) session_record ON true
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE action.status IN ('open', 'in_progress'))::int AS active_tasks,
        COUNT(*) FILTER (
          WHERE action.status IN ('open', 'in_progress')
            AND action.due_at IS NOT NULL
            AND action.due_at < now()
        )::int AS overdue_tasks,
        COUNT(*) FILTER (
          WHERE action.status IN ('open', 'in_progress')
            AND action.priority = 'urgent'
        )::int AS urgent_tasks
      FROM client_care_actions action
      WHERE action.client_profile_id = cp.id
        AND action.created_at >= b.starts_at - interval '12 hours'
    ) tasks ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE conversation.status = 'waiting_on_team')::int AS waiting_on_team
      FROM client_conversations conversation
      WHERE conversation.client_profile_id = cp.id
        AND conversation.last_message_at >= b.starts_at - interval '12 hours'
    ) conversations ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS resources_shared
      FROM client_portal_resources resource
      WHERE resource.client_profile_id = cp.id
        AND resource.created_at >= b.starts_at - interval '12 hours'
    ) resources ON true
    LEFT JOIN LATERAL (
      SELECT
        future.starts_at AS next_session_at,
        future_type.name AS next_session_name
      FROM bookings future
      LEFT JOIN appointment_types future_type ON future_type.id = future.appointment_type_id
      WHERE future.client_profile_id = cp.id
        AND future.starts_at >= now()
        AND future.starts_at > b.starts_at
        AND future.status IN ('requested', 'approved', 'confirmed')
      ORDER BY future.starts_at ASC
      LIMIT 1
    ) next_booking ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', member.id,
          'email', member.email,
          'displayName', COALESCE(profile.display_name, member.email::text),
          'assignmentRole', assignment.assignment_role
        )
        ORDER BY COALESCE(profile.display_name, member.email::text)
      ) AS members
      FROM team_client_assignments assignment
      JOIN system_users member ON member.id = assignment.team_user_id
      LEFT JOIN team_member_profiles profile ON profile.user_id = member.id
      WHERE assignment.client_profile_id = cp.id
        AND member.status = 'active'
    ) assignments ON true
    WHERE b.starts_at < now()
      AND b.starts_at >= now() - ($1::int * interval '1 day')
      AND b.status IN ('requested', 'approved', 'confirmed', 'completed', 'no_show')
      AND (
        $2::uuid IS NULL
        OR EXISTS (
          SELECT 1
          FROM team_client_assignments viewer_assignment
          WHERE viewer_assignment.team_user_id = $2
            AND viewer_assignment.client_profile_id = b.client_profile_id
        )
      )
    ORDER BY b.starts_at DESC, b.updated_at DESC
    `,
    [days, staffUserId],
  )

  const sessions = result.rows.map((row) => {
    const assignedMembers = normalizeAssignments(row.assigned_members)
    const clientLinked = Boolean(row.client_profile_id)
    const followThrough = buildSessionFollowThrough({
      bookingStatus: row.status,
      clientLinked,
      sessionRecordId: row.session_record_id,
      followUpAt: row.follow_up_at,
      activeTasks: row.active_tasks,
      overdueTasks: row.overdue_tasks,
      urgentTasks: row.urgent_tasks,
      waitingOnTeam: row.waiting_on_team,
      resourcesShared: row.resources_shared,
      nextSessionAt: row.next_session_at,
      assignedMemberCount: assignedMembers.length,
    })

    return {
      id: row.id,
      clientProfileId: row.client_profile_id || null,
      clientLinked,
      clientName: fullName(row),
      clientEmail: row.client_email || row.guest_email || '',
      appointmentTypeName: row.appointment_type_name || 'Private session',
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      timezone: row.timezone,
      status: row.status,
      adminNotes: row.admin_notes || '',
      primaryGoal: row.primary_goal || '',
      journeyStage: row.journey_stage || null,
      careStatus: row.care_status || null,
      sessionRecord: row.session_record_id
        ? {
            id: row.session_record_id,
            title: row.session_record_title || 'Session record',
            summary: row.session_record_summary || '',
            privateNotes: row.session_private_notes || '',
            clientVisibleNotes: row.session_client_visible_notes || '',
            followUpAt: row.follow_up_at || null,
            recordedAt: row.session_recorded_at || null,
          }
        : null,
      activeTasks: safeNumber(row.active_tasks),
      overdueTasks: safeNumber(row.overdue_tasks),
      urgentTasks: safeNumber(row.urgent_tasks),
      waitingOnTeam: safeNumber(row.waiting_on_team),
      resourcesShared: safeNumber(row.resources_shared),
      nextSessionAt: row.next_session_at || null,
      nextSessionName: row.next_session_name || '',
      assignedMembers,
      followThrough,
    }
  })

  const summary = sessions.reduce((accumulator, session) => {
    accumulator.total += 1
    accumulator[session.followThrough.band] += 1
    if (session.overdueTasks > 0 || session.followThrough.followUpOverdue) accumulator.overdueItems += 1
    if (session.waitingOnTeam > 0) accumulator.waitingOnTeam += 1
    return accumulator
  }, {
    total: 0,
    reconcile: 0,
    recovery: 0,
    overdue: 0,
    notes: 0,
    next: 0,
    complete: 0,
    overdueItems: 0,
    waitingOnTeam: 0,
  })

  return {
    horizonDays: days,
    viewer: {
      role: user?.role || 'staff',
      teamWide: user?.role !== 'staff',
    },
    summary,
    sessions,
  }
}

module.exports = {
  listSessionFollowThrough,
  normalizeHorizon,
}
