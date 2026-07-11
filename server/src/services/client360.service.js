const { pool } = require('../db/pool')

function toIsoOrNull(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function serializePlan(row) {
  if (!row) {
    return {
      journeyStage: 'onboarding',
      careStatus: 'not_started',
      primaryGoal: '',
      transformationFocus: '',
      successDefinition: '',
      clientVisibleFocus: '',
      privateStrategyNotes: '',
      nextReviewAt: null,
      updatedAt: null,
      updatedByEmail: null,
    }
  }

  return {
    clientProfileId: row.client_profile_id,
    journeyStage: row.journey_stage,
    careStatus: row.care_status,
    primaryGoal: row.primary_goal || '',
    transformationFocus: row.transformation_focus || '',
    successDefinition: row.success_definition || '',
    clientVisibleFocus: row.client_visible_focus || '',
    privateStrategyNotes: row.private_strategy_notes || '',
    nextReviewAt: row.next_review_at,
    updatedAt: row.updated_at,
    updatedByEmail: row.updated_by_email || null,
  }
}

function serializeAction(row) {
  return {
    id: row.id,
    clientProfileId: row.client_profile_id,
    title: row.title,
    description: row.description || '',
    ownerUserId: row.owner_user_id,
    ownerEmail: row.owner_email || null,
    ownerName: row.owner_name || row.owner_email || null,
    dueAt: row.due_at,
    priority: row.priority,
    status: row.status,
    visibility: row.visibility,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function clientExists(clientProfileId, db = pool) {
  const result = await db.query(
    'SELECT id FROM client_profiles WHERE id = $1 LIMIT 1',
    [clientProfileId],
  )
  return Boolean(result.rows[0])
}

async function getClient360Snapshot(clientProfileId) {
  const [
    profileResult,
    planResult,
    actionsResult,
    teamResult,
    bookingsResult,
    serviceResult,
    conversationsResult,
    learningResult,
    membershipsResult,
  ] = await Promise.all([
    pool.query(
      `
      SELECT
        cp.*,
        su.email,
        su.status AS portal_status,
        su.last_login_at,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', ct.id, 'name', ct.name))
            FILTER (WHERE ct.id IS NOT NULL),
          '[]'
        ) AS tags
      FROM client_profiles cp
      LEFT JOIN system_users su ON su.id = cp.user_id
      LEFT JOIN client_tag_links ctl ON ctl.client_profile_id = cp.id
      LEFT JOIN client_tags ct ON ct.id = ctl.client_tag_id
      WHERE cp.id = $1
      GROUP BY cp.id, su.email, su.status, su.last_login_at
      LIMIT 1
      `,
      [clientProfileId],
    ),
    pool.query(
      `
      SELECT ccp.*, su.email AS updated_by_email
      FROM client_care_plans ccp
      LEFT JOIN system_users su ON su.id = ccp.updated_by_user_id
      WHERE ccp.client_profile_id = $1
      LIMIT 1
      `,
      [clientProfileId],
    ),
    pool.query(
      `
      SELECT
        cca.*,
        su.email AS owner_email,
        COALESCE(tmp.display_name, su.email::text) AS owner_name
      FROM client_care_actions cca
      LEFT JOIN system_users su ON su.id = cca.owner_user_id
      LEFT JOIN team_member_profiles tmp ON tmp.user_id = cca.owner_user_id
      WHERE cca.client_profile_id = $1
      ORDER BY
        CASE cca.status WHEN 'in_progress' THEN 0 WHEN 'open' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
        cca.due_at NULLS LAST,
        cca.created_at DESC
      LIMIT 100
      `,
      [clientProfileId],
    ),
    pool.query(
      `
      SELECT
        tca.team_user_id,
        tca.assignment_role,
        su.email,
        su.role,
        su.status,
        COALESCE(tmp.display_name, su.email::text) AS display_name,
        tmp.job_title,
        tmp.department,
        tmp.availability_status
      FROM team_client_assignments tca
      JOIN system_users su ON su.id = tca.team_user_id
      LEFT JOIN team_member_profiles tmp ON tmp.user_id = tca.team_user_id
      WHERE tca.client_profile_id = $1
      ORDER BY
        CASE tca.assignment_role WHEN 'primary' THEN 0 WHEN 'support' THEN 1 WHEN 'specialist' THEN 2 ELSE 3 END,
        COALESCE(tmp.display_name, su.email::text)
      `,
      [clientProfileId],
    ),
    pool.query(
      `
      SELECT
        b.id,
        b.starts_at,
        b.ends_at,
        b.timezone,
        b.status,
        b.admin_notes,
        at.name AS appointment_type_name
      FROM bookings b
      LEFT JOIN appointment_types at ON at.id = b.appointment_type_id
      WHERE b.client_profile_id = $1
      ORDER BY b.starts_at DESC
      LIMIT 20
      `,
      [clientProfileId],
    ),
    pool.query(
      `
      SELECT
        sr.id,
        sr.title,
        sr.service_type,
        sr.status,
        sr.summary,
        sr.follow_up_at,
        COALESCE(sr.service_date, sr.occurred_at, sr.created_at) AS occurred_at,
        su.email AS created_by_email
      FROM service_records sr
      LEFT JOIN system_users su ON su.id = sr.created_by_user_id
      WHERE sr.client_profile_id = $1
      ORDER BY COALESCE(sr.service_date, sr.occurred_at, sr.created_at) DESC
      LIMIT 20
      `,
      [clientProfileId],
    ),
    pool.query(
      `
      SELECT
        cc.id,
        cc.subject,
        cc.status,
        cc.priority,
        cc.last_message_at,
        su.email AS assigned_email,
        COUNT(ccm.id) FILTER (
          WHERE ccm.sender_role = 'client' AND ccm.read_by_team_at IS NULL
        )::int AS unread_by_team
      FROM client_conversations cc
      LEFT JOIN system_users su ON su.id = cc.assigned_user_id
      LEFT JOIN client_conversation_messages ccm ON ccm.conversation_id = cc.id
      WHERE cc.client_profile_id = $1
      GROUP BY cc.id, su.email
      ORDER BY cc.last_message_at DESC
      LIMIT 20
      `,
      [clientProfileId],
    ),
    pool.query(
      `
      SELECT
        ca.id AS access_id,
        ca.access_status,
        ca.granted_at,
        ca.expires_at,
        c.id AS course_id,
        c.title,
        c.status AS course_status,
        COUNT(cl.id)::int AS lesson_count,
        COUNT(lp.id) FILTER (WHERE lp.completed_at IS NOT NULL)::int AS completed_lessons
      FROM course_access ca
      JOIN courses c ON c.id = ca.course_id
      LEFT JOIN course_modules cm ON cm.course_id = c.id AND cm.status <> 'archived'
      LEFT JOIN course_lessons cl ON cl.module_id = cm.id AND cl.status <> 'archived'
      LEFT JOIN lesson_progress lp
        ON lp.lesson_id = cl.id
       AND lp.client_profile_id = ca.client_profile_id
      WHERE ca.client_profile_id = $1
      GROUP BY ca.id, c.id
      ORDER BY ca.granted_at DESC
      `,
      [clientProfileId],
    ),
    pool.query(
      `
      SELECT
        me.id AS enrollment_id,
        me.status,
        me.started_at,
        me.renewal_at,
        me.ends_at,
        m.id AS membership_id,
        m.name,
        m.tagline
      FROM membership_enrollments me
      JOIN memberships m ON m.id = me.membership_id
      WHERE me.client_profile_id = $1
      ORDER BY me.created_at DESC
      `,
      [clientProfileId],
    ),
  ])

  const profile = profileResult.rows[0]
  if (!profile) return null

  const actions = actionsResult.rows.map(serializeAction)
  const now = Date.now()
  const openActions = actions.filter((action) => ['open', 'in_progress'].includes(action.status))
  const overdueActions = openActions.filter((action) => action.dueAt && new Date(action.dueAt).getTime() < now)
  const upcomingBookings = bookingsResult.rows.filter(
    (booking) => ['requested', 'approved', 'confirmed'].includes(booking.status) && new Date(booking.starts_at).getTime() >= now,
  )
  const openConversations = conversationsResult.rows.filter((conversation) => conversation.status !== 'closed')
  const unreadMessages = conversationsResult.rows.reduce(
    (sum, conversation) => sum + Number(conversation.unread_by_team || 0),
    0,
  )

  const activity = [
    ...serviceResult.rows.map((record) => ({
      id: `service-${record.id}`,
      type: 'service',
      title: record.title || 'Service record',
      detail: record.summary || record.service_type,
      occurredAt: record.occurred_at,
      status: record.status,
    })),
    ...bookingsResult.rows.map((booking) => ({
      id: `booking-${booking.id}`,
      type: 'session',
      title: booking.appointment_type_name || 'Private session',
      detail: booking.status,
      occurredAt: booking.starts_at,
      status: booking.status,
    })),
    ...conversationsResult.rows.map((conversation) => ({
      id: `conversation-${conversation.id}`,
      type: 'inbox',
      title: conversation.subject,
      detail: conversation.status,
      occurredAt: conversation.last_message_at,
      status: conversation.priority,
    })),
  ]
    .filter((item) => item.occurredAt)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 15)

  return {
    client: {
      id: profile.id,
      userId: profile.user_id,
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Client',
      email: profile.email || profile.public_contact_email || '',
      phone: profile.phone || '',
      birthday: profile.birthday,
      clientStatus: profile.client_status,
      portalStatus: profile.portal_status,
      lastLoginAt: profile.last_login_at,
      intakeCompletedAt: profile.intake_completed_at,
      privateAdminNotes: profile.private_admin_notes || '',
      clientVisibleNotes: profile.client_visible_notes || '',
      tags: profile.tags || [],
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    },
    plan: serializePlan(planResult.rows[0]),
    actions,
    team: teamResult.rows.map((member) => ({
      userId: member.team_user_id,
      assignmentRole: member.assignment_role,
      email: member.email,
      role: member.role,
      status: member.status,
      displayName: member.display_name,
      jobTitle: member.job_title,
      department: member.department,
      availabilityStatus: member.availability_status,
    })),
    bookings: bookingsResult.rows,
    serviceRecords: serviceResult.rows,
    conversations: conversationsResult.rows,
    learning: learningResult.rows.map((course) => ({
      ...course,
      progressPercent: Number(course.lesson_count || 0)
        ? Math.round((Number(course.completed_lessons || 0) / Number(course.lesson_count)) * 100)
        : 0,
    })),
    memberships: membershipsResult.rows,
    activity,
    summary: {
      openActions: openActions.length,
      overdueActions: overdueActions.length,
      upcomingSessions: upcomingBookings.length,
      openConversations: openConversations.length,
      unreadMessages,
      activeCourses: learningResult.rows.filter((course) => course.access_status === 'active').length,
      activeMemberships: membershipsResult.rows.filter((membership) => membership.status === 'active').length,
    },
  }
}

async function saveClientCarePlan(clientProfileId, input, actorUserId) {
  const result = await pool.query(
    `
    INSERT INTO client_care_plans (
      client_profile_id,
      journey_stage,
      care_status,
      primary_goal,
      transformation_focus,
      success_definition,
      client_visible_focus,
      private_strategy_notes,
      next_review_at,
      updated_by_user_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (client_profile_id)
    DO UPDATE SET
      journey_stage = EXCLUDED.journey_stage,
      care_status = EXCLUDED.care_status,
      primary_goal = EXCLUDED.primary_goal,
      transformation_focus = EXCLUDED.transformation_focus,
      success_definition = EXCLUDED.success_definition,
      client_visible_focus = EXCLUDED.client_visible_focus,
      private_strategy_notes = EXCLUDED.private_strategy_notes,
      next_review_at = EXCLUDED.next_review_at,
      updated_by_user_id = EXCLUDED.updated_by_user_id,
      updated_at = now()
    RETURNING *
    `,
    [
      clientProfileId,
      input.journeyStage,
      input.careStatus,
      input.primaryGoal || null,
      input.transformationFocus || null,
      input.successDefinition || null,
      input.clientVisibleFocus || null,
      input.privateStrategyNotes || null,
      toIsoOrNull(input.nextReviewAt),
      actorUserId,
    ],
  )

  return result.rows[0]
}

async function createClientCareAction(clientProfileId, input, actorUserId) {
  const result = await pool.query(
    `
    INSERT INTO client_care_actions (
      client_profile_id,
      title,
      description,
      owner_user_id,
      due_at,
      priority,
      status,
      visibility,
      completed_at,
      created_by_user_id,
      updated_by_user_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
      CASE WHEN $7 = 'completed' THEN now() ELSE NULL END,
      $9, $9)
    RETURNING *
    `,
    [
      clientProfileId,
      input.title,
      input.description || null,
      input.ownerUserId || null,
      toIsoOrNull(input.dueAt),
      input.priority,
      input.status,
      input.visibility,
      actorUserId,
    ],
  )

  return result.rows[0]
}

async function updateClientCareAction(clientProfileId, actionId, input, actorUserId) {
  const existingResult = await pool.query(
    `SELECT * FROM client_care_actions WHERE id = $1 AND client_profile_id = $2 LIMIT 1`,
    [actionId, clientProfileId],
  )
  const existing = existingResult.rows[0]
  if (!existing) return null

  const nextStatus = input.status ?? existing.status
  const result = await pool.query(
    `
    UPDATE client_care_actions
    SET
      title = $1,
      description = $2,
      owner_user_id = $3,
      due_at = $4,
      priority = $5,
      status = $6,
      visibility = $7,
      completed_at = CASE
        WHEN $6 = 'completed' AND completed_at IS NULL THEN now()
        WHEN $6 <> 'completed' THEN NULL
        ELSE completed_at
      END,
      updated_by_user_id = $8,
      updated_at = now()
    WHERE id = $9 AND client_profile_id = $10
    RETURNING *
    `,
    [
      input.title ?? existing.title,
      input.description ?? existing.description,
      Object.prototype.hasOwnProperty.call(input, 'ownerUserId') ? input.ownerUserId || null : existing.owner_user_id,
      Object.prototype.hasOwnProperty.call(input, 'dueAt') ? toIsoOrNull(input.dueAt) : existing.due_at,
      input.priority ?? existing.priority,
      nextStatus,
      input.visibility ?? existing.visibility,
      actorUserId,
      actionId,
      clientProfileId,
    ],
  )

  return { before: existing, after: result.rows[0] }
}

module.exports = {
  clientExists,
  createClientCareAction,
  getClient360Snapshot,
  saveClientCarePlan,
  updateClientCareAction,
}
