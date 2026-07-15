const { pool } = require('../db/pool')
const { buildSessionReadiness, safeNumber } = require('./sessionReadinessSignal')

const ALLOWED_HORIZONS = new Set([7, 14, 30])

function normalizeHorizon(value) {
  const parsed = Number(value)
  return ALLOWED_HORIZONS.has(parsed) ? parsed : 14
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

async function listSessionReadiness(user, options = {}, db = pool) {
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
      b.guest_phone,
      b.starts_at,
      b.ends_at,
      b.timezone,
      b.status,
      b.intake_answers,
      b.admin_notes,
      b.confirmation_sent_at,
      b.reminder_24h_sent_at,
      b.reminder_2h_sent_at,
      b.created_at,
      at.name AS appointment_type_name,
      at.duration_minutes,
      at.auto_start_onboarding,
      intake_template.name AS intake_template_name,
      cp.first_name AS client_first_name,
      cp.last_name AS client_last_name,
      client_user.email AS client_email,
      ccp.journey_stage,
      ccp.care_status,
      ccp.primary_goal,
      cor.status AS onboarding_status,
      cor.due_at AS onboarding_due_at,
      cor.submitted_at AS onboarding_submitted_at,
      portal.portal_accepted_at,
      COALESCE(intake.required_fields, 0)::int AS required_intake_fields,
      COALESCE(intake.answered_required_fields, 0)::int AS answered_required_fields,
      COALESCE(tasks.active_tasks, 0)::int AS active_tasks,
      COALESCE(tasks.overdue_tasks, 0)::int AS overdue_tasks,
      COALESCE(tasks.urgent_tasks, 0)::int AS urgent_tasks,
      COALESCE(conversations.waiting_on_team, 0)::int AS waiting_on_team,
      COALESCE(assignments.members, '[]'::jsonb) AS assigned_members
    FROM bookings b
    LEFT JOIN appointment_types at ON at.id = b.appointment_type_id
    LEFT JOIN intake_form_templates intake_template ON intake_template.id = at.booking_intake_template_id
    LEFT JOIN client_profiles cp ON cp.id = b.client_profile_id
    LEFT JOIN system_users client_user ON client_user.id = cp.user_id
    LEFT JOIN client_care_plans ccp ON ccp.client_profile_id = cp.id
    LEFT JOIN client_onboarding_records cor ON cor.client_profile_id = cp.id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE field.required)::int AS required_fields,
        COUNT(*) FILTER (
          WHERE field.required
            AND b.intake_answers ? field.field_key
            AND NULLIF(BTRIM(COALESCE(b.intake_answers ->> field.field_key, '')), '') IS NOT NULL
        )::int AS answered_required_fields
      FROM intake_form_fields field
      WHERE field.template_id = at.booking_intake_template_id
    ) intake ON true
    LEFT JOIN LATERAL (
      SELECT MAX(invite.accepted_at) AS portal_accepted_at
      FROM client_portal_invites invite
      WHERE invite.client_profile_id = cp.id
        AND invite.status = 'accepted'
    ) portal ON true
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
    ) tasks ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE conversation.status = 'waiting_on_team')::int AS waiting_on_team
      FROM client_conversations conversation
      WHERE conversation.client_profile_id = cp.id
    ) conversations ON true
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
    WHERE b.starts_at >= now()
      AND b.starts_at < now() + ($1::int * interval '1 day')
      AND b.status IN ('requested', 'approved', 'confirmed')
      AND (
        $2::uuid IS NULL
        OR EXISTS (
          SELECT 1
          FROM team_client_assignments viewer_assignment
          WHERE viewer_assignment.team_user_id = $2
            AND viewer_assignment.client_profile_id = b.client_profile_id
        )
      )
    ORDER BY b.starts_at ASC, b.created_at ASC
    `,
    [days, staffUserId],
  )

  const sessions = result.rows.map((row) => {
    const assignedMembers = normalizeAssignments(row.assigned_members)
    const clientLinked = Boolean(row.client_profile_id)
    const readiness = buildSessionReadiness({
      bookingStatus: row.status,
      clientLinked,
      onboardingRequired: Boolean(row.auto_start_onboarding),
      requiredIntakeFields: row.required_intake_fields,
      answeredRequiredFields: row.answered_required_fields,
      onboardingStatus: row.onboarding_status,
      portalActive: Boolean(row.portal_accepted_at),
      assignedMemberCount: assignedMembers.length,
      careStatus: row.care_status,
      activeTasks: row.active_tasks,
      overdueTasks: row.overdue_tasks,
      urgentTasks: row.urgent_tasks,
      waitingOnTeam: row.waiting_on_team,
      confirmationSent: Boolean(row.confirmation_sent_at),
    })

    return {
      id: row.id,
      clientProfileId: row.client_profile_id || null,
      clientLinked,
      clientName: fullName(row),
      clientEmail: row.client_email || row.guest_email || '',
      clientPhone: row.guest_phone || '',
      appointmentTypeName: row.appointment_type_name || 'Private session',
      durationMinutes: safeNumber(row.duration_minutes),
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      timezone: row.timezone,
      status: row.status,
      adminNotes: row.admin_notes || '',
      intakeTemplateName: row.intake_template_name || '',
      requiredIntakeFields: safeNumber(row.required_intake_fields),
      answeredRequiredFields: safeNumber(row.answered_required_fields),
      onboardingRequired: Boolean(row.auto_start_onboarding),
      onboardingStatus: row.onboarding_status || null,
      onboardingDueAt: row.onboarding_due_at || null,
      onboardingSubmittedAt: row.onboarding_submitted_at || null,
      portalActive: Boolean(row.portal_accepted_at),
      journeyStage: row.journey_stage || null,
      careStatus: row.care_status || null,
      primaryGoal: row.primary_goal || '',
      activeTasks: safeNumber(row.active_tasks),
      overdueTasks: safeNumber(row.overdue_tasks),
      urgentTasks: safeNumber(row.urgent_tasks),
      waitingOnTeam: safeNumber(row.waiting_on_team),
      assignedMembers,
      communications: {
        confirmationSentAt: row.confirmation_sent_at || null,
        reminder24hSentAt: row.reminder_24h_sent_at || null,
        reminder2hSentAt: row.reminder_2h_sent_at || null,
      },
      readiness,
    }
  })

  const summary = sessions.reduce((accumulator, session) => {
    accumulator.total += 1
    accumulator[session.readiness.band] += 1
    if (session.readiness.missingIntakeFields > 0) accumulator.intakeIncomplete += 1
    if (session.waitingOnTeam > 0) accumulator.waitingOnTeam += 1
    return accumulator
  }, {
    total: 0,
    ready: 0,
    almost: 0,
    review: 0,
    decision: 0,
    intakeIncomplete: 0,
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
  listSessionReadiness,
  normalizeHorizon,
}
