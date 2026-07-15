const { pool } = require('../db/pool')
const { buildClientMomentum, safeNumber } = require('./clientMomentumSignal')

function fullName(row) {
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.email || 'Client'
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

function normalizeTask(row) {
  return {
    id: row.id,
    sourceType: row.source_type,
    clientProfileId: row.client_profile_id,
    title: row.title,
    description: row.description || '',
    priority: row.priority || 'normal',
    status: row.status || 'open',
    dueAt: row.due_at,
    ownerUserId: row.owner_user_id || null,
    ownerName: row.owner_name || row.owner_email || 'Unassigned',
    sourceLabel: row.source_type === 'care_action' ? 'Client care' : 'Lead follow-up',
  }
}

async function listClientMomentum(user, db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const staffUserId = user?.role === 'staff' ? user.id : null
  const [clientsResult, tasksResult] = await Promise.all([
    db.query(
      `
      SELECT
        cp.id,
        cp.first_name,
        cp.last_name,
        cp.client_status,
        cp.created_at,
        cp.updated_at,
        su.email,
        ccp.journey_stage,
        ccp.care_status,
        ccp.primary_goal,
        ccp.transformation_focus,
        ccp.success_definition,
        ccp.client_visible_focus,
        ccp.next_review_at,
        booking_stats.last_session_at,
        booking_stats.next_session_at,
        booking_stats.completed_sessions,
        task_stats.active_tasks,
        task_stats.overdue_tasks,
        task_stats.urgent_tasks,
        conversation_stats.open_conversations,
        conversation_stats.waiting_on_team,
        conversation_stats.last_message_at,
        learning_stats.active_courses,
        learning_stats.completed_lessons,
        learning_stats.total_lessons,
        learning_stats.last_learning_at,
        membership_stats.active_memberships,
        service_stats.last_service_at,
        invite_stats.portal_accepted_at,
        COALESCE(assignments.members, '[]'::jsonb) AS assigned_members
      FROM client_profiles cp
      LEFT JOIN system_users su ON su.id = cp.user_id
      LEFT JOIN client_care_plans ccp ON ccp.client_profile_id = cp.id
      LEFT JOIN LATERAL (
        SELECT
          MAX(b.starts_at) FILTER (WHERE b.status = 'completed') AS last_session_at,
          MIN(b.starts_at) FILTER (
            WHERE b.starts_at >= now()
              AND b.status IN ('requested', 'approved', 'confirmed')
          ) AS next_session_at,
          COUNT(*) FILTER (WHERE b.status = 'completed')::int AS completed_sessions
        FROM bookings b
        WHERE b.client_profile_id = cp.id
      ) booking_stats ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE status IN ('open', 'in_progress'))::int AS active_tasks,
          COUNT(*) FILTER (
            WHERE status IN ('open', 'in_progress')
              AND due_at IS NOT NULL
              AND due_at < now()
          )::int AS overdue_tasks,
          COUNT(*) FILTER (
            WHERE status IN ('open', 'in_progress')
              AND priority = 'urgent'
          )::int AS urgent_tasks
        FROM client_care_actions
        WHERE client_profile_id = cp.id
      ) task_stats ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE status <> 'closed')::int AS open_conversations,
          COUNT(*) FILTER (WHERE status = 'waiting_on_team')::int AS waiting_on_team,
          MAX(last_message_at) AS last_message_at
        FROM client_conversations
        WHERE client_profile_id = cp.id
      ) conversation_stats ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT ca.course_id) FILTER (WHERE ca.access_status = 'active')::int AS active_courses,
          COUNT(cl.id) FILTER (WHERE lp.completed_at IS NOT NULL)::int AS completed_lessons,
          COUNT(cl.id)::int AS total_lessons,
          MAX(COALESCE(lp.last_viewed_at, lp.completed_at, lp.updated_at)) AS last_learning_at
        FROM course_access ca
        LEFT JOIN course_modules cm ON cm.course_id = ca.course_id
        LEFT JOIN course_lessons cl ON cl.module_id = cm.id
        LEFT JOIN lesson_progress lp
          ON lp.lesson_id = cl.id
          AND lp.client_profile_id = cp.id
        WHERE ca.client_profile_id = cp.id
      ) learning_stats ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS active_memberships
        FROM membership_enrollments
        WHERE client_profile_id = cp.id
      ) membership_stats ON true
      LEFT JOIN LATERAL (
        SELECT MAX(COALESCE(occurred_at, service_date, created_at)) AS last_service_at
        FROM service_records
        WHERE client_profile_id = cp.id
          AND status <> 'archived'
      ) service_stats ON true
      LEFT JOIN LATERAL (
        SELECT MAX(accepted_at) AS portal_accepted_at
        FROM client_portal_invites
        WHERE client_profile_id = cp.id
          AND status = 'accepted'
      ) invite_stats ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', member.id,
            'email', member.email,
            'displayName', COALESCE(tmp.display_name, member.email::text),
            'assignmentRole', tca.assignment_role
          )
          ORDER BY COALESCE(tmp.display_name, member.email::text)
        ) AS members
        FROM team_client_assignments tca
        JOIN system_users member ON member.id = tca.team_user_id
        LEFT JOIN team_member_profiles tmp ON tmp.user_id = member.id
        WHERE tca.client_profile_id = cp.id
          AND member.status = 'active'
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
      ORDER BY lower(COALESCE(cp.last_name, '')), lower(COALESCE(cp.first_name, ''))
      `,
      [staffUserId],
    ),
    db.query(
      `
      SELECT
        queue.id,
        queue.source_type,
        queue.client_profile_id,
        queue.title,
        queue.description,
        queue.priority,
        queue.status,
        queue.due_at,
        queue.owner_user_id,
        owner.email AS owner_email,
        COALESCE(owner_profile.display_name, owner.email::text) AS owner_name
      FROM (
        SELECT
          cca.id,
          'care_action'::text AS source_type,
          cca.client_profile_id,
          cca.title,
          cca.description,
          cca.priority,
          cca.status,
          cca.due_at,
          cca.owner_user_id
        FROM client_care_actions cca
        WHERE cca.status IN ('open', 'in_progress')

        UNION ALL

        SELECT
          lfu.id,
          'lead_follow_up'::text AS source_type,
          lfu.client_profile_id,
          lfu.title,
          lfu.notes AS description,
          lfu.priority,
          lfu.status,
          lfu.due_at,
          lfu.assigned_to_user_id AS owner_user_id
        FROM lead_follow_ups lfu
        JOIN client_profiles active_client ON active_client.id = lfu.client_profile_id
        WHERE lfu.status = 'open'
          AND active_client.client_status IN ('active_client', 'member')
      ) queue
      JOIN client_profiles cp ON cp.id = queue.client_profile_id
      LEFT JOIN system_users owner ON owner.id = queue.owner_user_id
      LEFT JOIN team_member_profiles owner_profile ON owner_profile.user_id = owner.id
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
      ORDER BY
        CASE queue.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
        queue.due_at NULLS LAST,
        queue.title
      `,
      [staffUserId],
    ),
  ])

  const tasks = tasksResult.rows.map(normalizeTask)
  const tasksByClient = new Map()
  for (const task of tasks) {
    if (!tasksByClient.has(task.clientProfileId)) tasksByClient.set(task.clientProfileId, [])
    tasksByClient.get(task.clientProfileId).push(task)
  }

  const clients = clientsResult.rows.map((row) => {
    const touchpoints = [
      row.last_session_at,
      row.last_message_at,
      row.last_learning_at,
      row.last_service_at,
      row.portal_accepted_at,
    ].filter(Boolean).map((value) => new Date(value)).filter((value) => !Number.isNaN(value.getTime()))
    const lastTouchAt = touchpoints.length
      ? new Date(Math.max(...touchpoints.map((value) => value.getTime()))).toISOString()
      : row.created_at
    const signal = buildClientMomentum({
      careStatus: row.care_status || 'not_started',
      journeyStage: row.journey_stage || 'onboarding',
      nextReviewAt: row.next_review_at,
      lastTouchAt,
      lastSessionAt: row.last_session_at,
      nextSessionAt: row.next_session_at,
      activeTasks: row.active_tasks,
      overdueTasks: row.overdue_tasks,
      urgentTasks: row.urgent_tasks,
      waitingOnTeam: row.waiting_on_team,
    })
    const totalLessons = safeNumber(row.total_lessons)
    const completedLessons = safeNumber(row.completed_lessons)

    return {
      id: row.id,
      name: fullName(row),
      email: row.email || '',
      clientStatus: row.client_status,
      journeyStage: row.journey_stage || 'onboarding',
      careStatus: row.care_status || 'not_started',
      primaryGoal: row.primary_goal || '',
      transformationFocus: row.transformation_focus || '',
      successDefinition: row.success_definition || '',
      clientVisibleFocus: row.client_visible_focus || '',
      nextReviewAt: row.next_review_at,
      lastTouchAt,
      lastSessionAt: row.last_session_at,
      nextSessionAt: row.next_session_at,
      completedSessions: safeNumber(row.completed_sessions),
      activeTasks: safeNumber(row.active_tasks),
      overdueTasks: safeNumber(row.overdue_tasks),
      urgentTasks: safeNumber(row.urgent_tasks),
      openConversations: safeNumber(row.open_conversations),
      waitingOnTeam: safeNumber(row.waiting_on_team),
      activeCourses: safeNumber(row.active_courses),
      lessonProgressPercent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
      activeMemberships: safeNumber(row.active_memberships),
      portalActive: Boolean(row.portal_accepted_at),
      assignedMembers: normalizeAssignments(row.assigned_members),
      signal,
      tasks: tasksByClient.get(row.id) || [],
    }
  }).sort((left, right) => {
    const order = { attention: 0, watch: 1, paused: 2, steady: 3, complete: 4 }
    return (order[left.signal.band] - order[right.signal.band])
      || (right.overdueTasks - left.overdueTasks)
      || left.name.localeCompare(right.name)
  })

  return {
    viewer: {
      role: user?.role || 'staff',
      teamWide: user?.role !== 'staff',
    },
    summary: {
      activeClients: clients.length,
      needsAttention: clients.filter((client) => client.signal.band === 'attention').length,
      watchClosely: clients.filter((client) => client.signal.band === 'watch').length,
      overdueReviews: clients.filter((client) => client.signal.reviewOverdue).length,
      waitingOnTeam: clients.reduce((total, client) => total + client.waitingOnTeam, 0),
      steadyMomentum: clients.filter((client) => client.signal.band === 'steady').length,
    },
    clients,
  }
}

module.exports = {
  listClientMomentum,
  normalizeAssignments,
  normalizeTask,
}
