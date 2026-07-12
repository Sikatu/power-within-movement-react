const crypto = require('crypto')
const bcrypt = require('bcryptjs')

const { env } = require('../config/env')
const { pool } = require('../db/pool')
const { getPlatformSettings } = require('./platformSettings.service')

const FIELD_TYPES = [
  'short_text',
  'long_text',
  'email',
  'phone',
  'date',
  'select',
  'multiselect',
  'checkbox',
]

const ONBOARDING_STATUSES = [
  'not_started',
  'in_progress',
  'submitted',
  'reviewed',
  'completed',
  'paused',
]

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) }
}

function normalizeFieldKey(value, fallback = 'field') {
  const key = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return key || fallback
}

function normalizeField(field = {}, position = 1) {
  const fieldType = FIELD_TYPES.includes(field.fieldType || field.field_type)
    ? field.fieldType || field.field_type
    : 'short_text'
  const options = Array.isArray(field.options)
    ? field.options.map((option) => String(option || '').trim()).filter(Boolean)
    : []

  return {
    id: field.id || null,
    fieldKey: normalizeFieldKey(field.fieldKey || field.field_key || field.label, `field_${position}`),
    label: String(field.label || '').trim(),
    helpText: String(field.helpText || field.help_text || '').trim(),
    placeholder: String(field.placeholder || '').trim(),
    fieldType,
    required: Boolean(field.required),
    options,
    position: Number(field.position || position),
  }
}

function templateFromRows(template, fields = []) {
  if (!template) return null

  return {
    id: template.id,
    name: template.name,
    description: template.description || '',
    formScope: template.form_scope,
    status: template.status,
    welcomeMessage: template.welcome_message || '',
    completionMessage: template.completion_message || '',
    createdAt: template.created_at,
    updatedAt: template.updated_at,
    fields: fields
      .filter((field) => field.template_id === template.id)
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((field) => ({
        id: field.id,
        fieldKey: field.field_key,
        label: field.label,
        helpText: field.help_text || '',
        placeholder: field.placeholder || '',
        fieldType: field.field_type,
        required: Boolean(field.required),
        options: Array.isArray(field.options) ? field.options : [],
        position: Number(field.position),
      })),
  }
}

async function listTemplates(db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const [templateResult, fieldResult] = await Promise.all([
    db.query(`
      SELECT *
      FROM intake_form_templates
      ORDER BY
        CASE status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
        form_scope,
        name
    `),
    db.query(`
      SELECT *
      FROM intake_form_fields
      ORDER BY template_id, position, created_at
    `),
  ])

  return templateResult.rows.map((template) => templateFromRows(template, fieldResult.rows))
}

async function saveTemplate({ templateId = null, payload, actorUserId = null }, db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const fields = (payload.fields || []).map((field, index) => normalizeField(field, index + 1))
  const duplicateKeys = fields.filter(
    (field, index) => fields.findIndex((candidate) => candidate.fieldKey === field.fieldKey) !== index,
  )

  if (duplicateKeys.length > 0) {
    throw new Error(`Field keys must be unique. Duplicate: ${duplicateKeys[0].fieldKey}`)
  }

  const client = typeof db.connect === 'function' ? await db.connect() : db
  const release = typeof client.release === 'function'

  try {
    await client.query('BEGIN')

    let template

    if (templateId) {
      const existing = await client.query(
        'SELECT * FROM intake_form_templates WHERE id = $1 LIMIT 1 FOR UPDATE',
        [templateId],
      )

      if (!existing.rows[0]) throw new Error('Intake template not found.')

      const updated = await client.query(
        `
        UPDATE intake_form_templates
        SET name = $2,
            description = NULLIF($3, ''),
            form_scope = $4,
            status = $5,
            welcome_message = NULLIF($6, ''),
            completion_message = NULLIF($7, ''),
            updated_by_user_id = $8,
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          templateId,
          payload.name,
          payload.description || '',
          payload.formScope,
          payload.status,
          payload.welcomeMessage || '',
          payload.completionMessage || '',
          actorUserId,
        ],
      )

      template = updated.rows[0]
      await client.query('DELETE FROM intake_form_fields WHERE template_id = $1', [templateId])
    } else {
      const inserted = await client.query(
        `
        INSERT INTO intake_form_templates (
          name,
          description,
          form_scope,
          status,
          welcome_message,
          completion_message,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES ($1, NULLIF($2, ''), $3, $4, NULLIF($5, ''), NULLIF($6, ''), $7, $7)
        RETURNING *
        `,
        [
          payload.name,
          payload.description || '',
          payload.formScope,
          payload.status,
          payload.welcomeMessage || '',
          payload.completionMessage || '',
          actorUserId,
        ],
      )

      template = inserted.rows[0]
    }

    for (const [index, field] of fields.entries()) {
      await client.query(
        `
        INSERT INTO intake_form_fields (
          template_id,
          field_key,
          label,
          help_text,
          placeholder,
          field_type,
          required,
          options,
          position
        )
        VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6, $7, $8::jsonb, $9)
        `,
        [
          template.id,
          field.fieldKey,
          field.label,
          field.helpText,
          field.placeholder,
          field.fieldType,
          field.required,
          JSON.stringify(field.options),
          index + 1,
        ],
      )
    }

    await client.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_data
      )
      VALUES ($1, $2, 'intake_form_templates', $3, $4::jsonb)
      `,
      [
        actorUserId,
        templateId ? 'intake_template_updated' : 'intake_template_created',
        template.id,
        JSON.stringify({
          name: template.name,
          formScope: template.form_scope,
          status: template.status,
          fieldCount: fields.length,
        }),
      ],
    )

    await client.query('COMMIT')

    const templates = await listTemplates(db)
    return templates.find((item) => item.id === template.id) || null
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    if (release) client.release()
  }
}

async function listOnboardingRecords(db = pool) {
  const result = await db.query(`
    SELECT
      cor.*,
      cp.first_name,
      cp.last_name,
      cp.client_status,
      cp.intake_completed_at,
      su.email,
      template.name AS template_name,
      assigned.email AS assigned_email,
      profile.display_name AS assigned_display_name
    FROM client_onboarding_records cor
    JOIN client_profiles cp ON cp.id = cor.client_profile_id
    LEFT JOIN system_users su ON su.id = cp.user_id
    LEFT JOIN intake_form_templates template ON template.id = cor.template_id
    LEFT JOIN system_users assigned ON assigned.id = cor.assigned_to_user_id
    LEFT JOIN team_member_profiles profile ON profile.user_id = cor.assigned_to_user_id
    ORDER BY
      CASE cor.status
        WHEN 'submitted' THEN 0
        WHEN 'in_progress' THEN 1
        WHEN 'not_started' THEN 2
        WHEN 'reviewed' THEN 3
        WHEN 'paused' THEN 4
        ELSE 5
      END,
      cor.due_at NULLS LAST,
      cor.updated_at DESC
    LIMIT 300
  `)

  return result.rows.map((row) => ({
    id: row.id,
    clientProfileId: row.client_profile_id,
    clientName: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || 'Client',
    email: row.email || '',
    clientStatus: row.client_status,
    intakeCompletedAt: row.intake_completed_at,
    templateId: row.template_id,
    templateName: row.template_name || 'No template',
    status: row.status,
    assignedToUserId: row.assigned_to_user_id,
    assignedName: row.assigned_display_name || row.assigned_email || '',
    dueAt: row.due_at,
    answers: row.answers || {},
    consentAcceptedAt: row.consent_accepted_at,
    clientWelcomeMessage: row.client_welcome_message || '',
    privateNotes: row.private_notes || '',
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

async function getAssignableTeam(db = pool) {
  const result = await db.query(`
    SELECT
      su.id,
      su.email,
      su.role,
      COALESCE(tmp.display_name, su.email) AS display_name
    FROM system_users su
    LEFT JOIN team_member_profiles tmp ON tmp.user_id = su.id
    WHERE su.status = 'active'
      AND su.role IN ('developer', 'owner', 'admin', 'staff')
      AND (su.role <> 'staff' OR COALESCE(tmp.is_assignable, true) = true)
    ORDER BY
      CASE su.role WHEN 'admin' THEN 0 WHEN 'owner' THEN 1 WHEN 'developer' THEN 2 ELSE 3 END,
      display_name
  `)

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
  }))
}

async function listOnboardingStudio(db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const [templates, records, appointmentTypes, team, communicationSummary, clientsResult] = await Promise.all([
    listTemplates(db),
    listOnboardingRecords(db),
    db.query(`
      SELECT
        id,
        name,
        slug,
        is_active,
        requires_approval,
        booking_intake_template_id,
        onboarding_template_id,
        auto_create_client_profile,
        auto_start_onboarding,
        send_confirmation_email,
        reminder_24h_enabled,
        reminder_2h_enabled
      FROM appointment_types
      ORDER BY is_active DESC, name
    `),
    getAssignableTeam(db),
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COUNT(*) FILTER (WHERE status = 'sent')::int AS sent
      FROM booking_communications
    `),
    db.query(`
      SELECT
        cp.id,
        cp.first_name,
        cp.last_name,
        cp.client_status,
        cp.intake_completed_at,
        su.email
      FROM client_profiles cp
      LEFT JOIN system_users su ON su.id = cp.user_id
      WHERE cp.client_status <> 'archived'
      ORDER BY cp.updated_at DESC
      LIMIT 500
    `),
  ])

  return {
    templates,
    onboardingRecords: records,
    appointmentTypes: appointmentTypes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      isActive: Boolean(row.is_active),
      requiresApproval: Boolean(row.requires_approval),
      bookingIntakeTemplateId: row.booking_intake_template_id,
      onboardingTemplateId: row.onboarding_template_id,
      autoCreateClientProfile: Boolean(row.auto_create_client_profile),
      autoStartOnboarding: Boolean(row.auto_start_onboarding),
      sendConfirmationEmail: Boolean(row.send_confirmation_email),
      reminder24hEnabled: Boolean(row.reminder_24h_enabled),
      reminder2hEnabled: Boolean(row.reminder_2h_enabled),
    })),
    team,
    clients: clientsResult.rows.map((row) => ({
      id: row.id,
      name: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || 'Client',
      email: row.email || '',
      clientStatus: row.client_status,
      intakeCompletedAt: row.intake_completed_at,
    })),
    stats: {
      active: records.filter((record) => ['not_started', 'in_progress'].includes(record.status)).length,
      submitted: records.filter((record) => record.status === 'submitted').length,
      completed: records.filter((record) => record.status === 'completed').length,
      overdue: records.filter(
        (record) => record.dueAt && new Date(record.dueAt).getTime() < Date.now() && !['completed', 'paused'].includes(record.status),
      ).length,
      communications: communicationSummary.rows[0] || { pending: 0, failed: 0, sent: 0 },
    },
  }
}

async function updateAppointmentOnboardingSettings(appointmentTypeId, payload, actorUserId, db = pool) {
  const templateIds = [
    payload.bookingIntakeTemplateId,
    payload.onboardingTemplateId,
  ].filter(Boolean)

  if (templateIds.length > 0) {
    const templates = await db.query(
      `
      SELECT id, form_scope, status
      FROM intake_form_templates
      WHERE id = ANY($1::uuid[])
      `,
      [templateIds],
    )
    const templateById = new Map(templates.rows.map((template) => [template.id, template]))
    const bookingTemplate = payload.bookingIntakeTemplateId
      ? templateById.get(payload.bookingIntakeTemplateId)
      : null
    const onboardingTemplate = payload.onboardingTemplateId
      ? templateById.get(payload.onboardingTemplateId)
      : null

    if (
      payload.bookingIntakeTemplateId &&
      (!bookingTemplate || bookingTemplate.form_scope !== 'booking' || bookingTemplate.status !== 'active')
    ) {
      const error = new Error('Choose an active booking intake template.')
      error.status = 400
      throw error
    }

    if (
      payload.onboardingTemplateId &&
      (!onboardingTemplate || onboardingTemplate.form_scope !== 'onboarding' || onboardingTemplate.status !== 'active')
    ) {
      const error = new Error('Choose an active client onboarding template.')
      error.status = 400
      throw error
    }
  }

  if (payload.autoStartOnboarding && !payload.autoCreateClientProfile) {
    const error = new Error('Automatic onboarding requires automatic client profile creation.')
    error.status = 400
    throw error
  }

  if (payload.autoStartOnboarding && !payload.onboardingTemplateId) {
    const error = new Error('Choose an active client onboarding template before enabling automatic onboarding.')
    error.status = 400
    throw error
  }

  const result = await db.query(
    `
    UPDATE appointment_types
    SET booking_intake_template_id = $2,
        onboarding_template_id = $3,
        auto_create_client_profile = $4,
        auto_start_onboarding = $5,
        send_confirmation_email = $6,
        reminder_24h_enabled = $7,
        reminder_2h_enabled = $8,
        updated_at = now()
    WHERE id = $1
    RETURNING *
    `,
    [
      appointmentTypeId,
      payload.bookingIntakeTemplateId || null,
      payload.onboardingTemplateId || null,
      Boolean(payload.autoCreateClientProfile),
      Boolean(payload.autoStartOnboarding),
      Boolean(payload.sendConfirmationEmail),
      Boolean(payload.reminder24hEnabled),
      Boolean(payload.reminder2hEnabled),
    ],
  )

  if (!result.rows[0]) throw new Error('Appointment type not found.')

  await db.query(
    `
    INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, after_data)
    VALUES ($1, 'appointment_onboarding_settings_updated', 'appointment_types', $2, $3::jsonb)
    `,
    [actorUserId, appointmentTypeId, JSON.stringify(payload)],
  )

  return result.rows[0]
}

async function startClientOnboarding({ clientProfileId, payload = {}, actorUserId = null }, db = pool) {
  const templateResult = payload.templateId
    ? await db.query(
      `SELECT * FROM intake_form_templates WHERE id = $1 AND form_scope = 'onboarding' AND status = 'active' LIMIT 1`,
      [payload.templateId],
    )
    : { rows: [] }

  if (payload.templateId && !templateResult.rows[0]) {
    const error = new Error('Choose an active client onboarding template.')
    error.status = 400
    throw error
  }

  const result = await db.query(
    `
    INSERT INTO client_onboarding_records (
      client_profile_id,
      template_id,
      status,
      assigned_to_user_id,
      due_at,
      client_welcome_message,
      private_notes,
      started_at,
      created_by_user_id,
      updated_by_user_id
    )
    VALUES ($1, $2, 'not_started', $3, $4, NULLIF($5, ''), NULLIF($6, ''), now(), $7, $7)
    ON CONFLICT (client_profile_id)
    DO UPDATE SET
      template_id = COALESCE(EXCLUDED.template_id, client_onboarding_records.template_id),
      status = CASE WHEN client_onboarding_records.status = 'completed' THEN 'not_started' ELSE client_onboarding_records.status END,
      assigned_to_user_id = EXCLUDED.assigned_to_user_id,
      due_at = EXCLUDED.due_at,
      client_welcome_message = COALESCE(EXCLUDED.client_welcome_message, client_onboarding_records.client_welcome_message),
      private_notes = COALESCE(EXCLUDED.private_notes, client_onboarding_records.private_notes),
      started_at = COALESCE(client_onboarding_records.started_at, now()),
      updated_by_user_id = EXCLUDED.updated_by_user_id,
      updated_at = now()
    RETURNING *
    `,
    [
      clientProfileId,
      payload.templateId || null,
      payload.assignedToUserId || null,
      payload.dueAt || null,
      payload.clientWelcomeMessage || '',
      payload.privateNotes || '',
      actorUserId,
    ],
  )

  await db.query(
    `
    INSERT INTO client_care_plans (client_profile_id, journey_stage, care_status, updated_by_user_id)
    VALUES ($1, 'onboarding', 'not_started', $2)
    ON CONFLICT (client_profile_id)
    DO UPDATE SET
      journey_stage = CASE WHEN client_care_plans.journey_stage = 'complete' THEN client_care_plans.journey_stage ELSE 'onboarding' END,
      updated_by_user_id = $2,
      updated_at = now()
    `,
    [clientProfileId, actorUserId],
  )

  await db.query(
    `
    INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, after_data)
    VALUES ($1, 'client_onboarding_started', 'client_profiles', $2, $3::jsonb)
    `,
    [actorUserId, clientProfileId, JSON.stringify(payload)],
  )

  return result.rows[0]
}

async function updateClientOnboarding({ clientProfileId, payload, actorUserId = null }, db = pool) {
  const status = ONBOARDING_STATUSES.includes(payload.status) ? payload.status : 'not_started'
  const result = await db.query(
    `
    UPDATE client_onboarding_records
    SET template_id = COALESCE($2, template_id),
        status = $3,
        assigned_to_user_id = $4,
        due_at = $5,
        client_welcome_message = NULLIF($6, ''),
        private_notes = NULLIF($7, ''),
        reviewed_at = CASE WHEN $3 IN ('reviewed', 'completed') THEN COALESCE(reviewed_at, now()) ELSE reviewed_at END,
        completed_at = CASE WHEN $3 = 'completed' THEN COALESCE(completed_at, now()) ELSE NULL END,
        updated_by_user_id = $8,
        updated_at = now()
    WHERE client_profile_id = $1
    RETURNING *
    `,
    [
      clientProfileId,
      payload.templateId || null,
      status,
      payload.assignedToUserId || null,
      payload.dueAt || null,
      payload.clientWelcomeMessage || '',
      payload.privateNotes || '',
      actorUserId,
    ],
  )

  if (!result.rows[0]) throw new Error('Onboarding record not found.')

  if (status === 'completed') {
    await db.query(
      `
      UPDATE client_care_plans
      SET care_status = CASE WHEN care_status = 'completed' THEN care_status ELSE 'on_track' END,
          updated_by_user_id = $2,
          updated_at = now()
      WHERE client_profile_id = $1
      `,
      [clientProfileId, actorUserId],
    )
  }

  await db.query(
    `
    INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, after_data)
    VALUES ($1, 'client_onboarding_updated', 'client_profiles', $2, $3::jsonb)
    `,
    [actorUserId, clientProfileId, JSON.stringify(payload)],
  )

  return result.rows[0]
}

async function getClientPortalOnboarding(clientProfileId, db = pool) {
  const result = await db.query(
    `
    SELECT
      cor.*,
      template.name AS template_name,
      template.description AS template_description,
      template.welcome_message AS template_welcome_message,
      template.completion_message AS template_completion_message
    FROM client_onboarding_records cor
    LEFT JOIN intake_form_templates template ON template.id = cor.template_id
    WHERE cor.client_profile_id = $1
    LIMIT 1
    `,
    [clientProfileId],
  )

  const record = result.rows[0]
  if (!record) return { available: false, onboarding: null, template: null }

  const templates = record.template_id ? await listTemplates(db) : []
  const template = templates.find((item) => item.id === record.template_id) || null

  return {
    available: true,
    onboarding: {
      id: record.id,
      clientProfileId: record.client_profile_id,
      templateId: record.template_id,
      status: record.status,
      dueAt: record.due_at,
      answers: record.answers || {},
      consentAcceptedAt: record.consent_accepted_at,
      clientWelcomeMessage: record.client_welcome_message || record.template_welcome_message || '',
      completionMessage: record.template_completion_message || '',
      startedAt: record.started_at,
      submittedAt: record.submitted_at,
      reviewedAt: record.reviewed_at,
      completedAt: record.completed_at,
      updatedAt: record.updated_at,
    },
    template,
  }
}

function isAnswerPresent(value) {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'boolean') return value
  return String(value ?? '').trim().length > 0
}

function validateRequiredAnswers(template, answers = {}) {
  const missing = (template?.fields || []).filter(
    (field) => field.required && !isAnswerPresent(answers[field.fieldKey]),
  )

  if (missing.length > 0) {
    const error = new Error(`Please complete: ${missing.map((field) => field.label).join(', ')}.`)
    error.code = 'REQUIRED_ONBOARDING_FIELDS'
    error.status = 400
    throw error
  }
}

async function saveClientPortalOnboarding({ clientProfileId, answers, submit = false }, db = pool) {
  const snapshot = await getClientPortalOnboarding(clientProfileId, db)
  if (!snapshot.available) throw new Error('Onboarding is not available for this account yet.')

  const mergedAnswers = {
    ...(snapshot.onboarding.answers || {}),
    ...(answers || {}),
  }

  if (submit) validateRequiredAnswers(snapshot.template, mergedAnswers)

  const result = await db.query(
    `
    UPDATE client_onboarding_records
    SET answers = $2::jsonb,
        status = CASE WHEN $3 THEN 'submitted' ELSE CASE WHEN status = 'not_started' THEN 'in_progress' ELSE status END END,
        consent_accepted_at = CASE
          WHEN $3 AND COALESCE(($2::jsonb ->> 'consent')::boolean, false) THEN COALESCE(consent_accepted_at, now())
          ELSE consent_accepted_at
        END,
        submitted_at = CASE WHEN $3 THEN now() ELSE submitted_at END,
        started_at = COALESCE(started_at, now()),
        updated_at = now()
    WHERE client_profile_id = $1
    RETURNING *
    `,
    [clientProfileId, JSON.stringify(mergedAnswers), submit],
  )

  if (submit) {
    await db.query(
      `
      UPDATE client_profiles
      SET emergency_contact_name = COALESCE(NULLIF($2, ''), emergency_contact_name),
          emergency_contact_phone = COALESCE(NULLIF($3, ''), emergency_contact_phone),
          intake_completed_at = now(),
          updated_at = now()
      WHERE id = $1
      `,
      [
        clientProfileId,
        String(mergedAnswers.emergency_contact_name || '').trim(),
        String(mergedAnswers.emergency_contact_phone || '').trim(),
      ],
    )

    const assigneeResult = await db.query(
      `
      SELECT COALESCE(
        cor.assigned_to_user_id,
        cp.lead_owner_user_id,
        (SELECT id FROM system_users WHERE status = 'active' AND role IN ('admin', 'owner', 'developer') ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'owner' THEN 1 ELSE 2 END LIMIT 1)
      ) AS recipient_user_id
      FROM client_onboarding_records cor
      JOIN client_profiles cp ON cp.id = cor.client_profile_id
      WHERE cor.client_profile_id = $1
      LIMIT 1
      `,
      [clientProfileId],
    )

    const recipientUserId = assigneeResult.rows[0]?.recipient_user_id
    if (recipientUserId) {
      await db.query(
        `
        INSERT INTO notifications (
          recipient_user_id,
          category,
          title,
          body,
          action_url,
          action_label,
          entity_type,
          entity_id,
          importance,
          dedupe_key,
          email_status,
          expires_at
        )
        VALUES ($1, 'system', 'Client onboarding submitted', 'A client completed their onboarding intake and it is ready for review.', $2, 'Review onboarding', 'client_profiles', $3, 'high', $4, 'not_requested', now() + interval '30 days')
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
        `,
        [recipientUserId, `/admin/onboarding?client=${clientProfileId}`, clientProfileId, `onboarding-submitted:${clientProfileId}:${result.rows[0].submitted_at}`],
      )
    }
  }

  return getClientPortalOnboarding(clientProfileId, db)
}

async function getTemplateById(templateId, db = pool) {
  if (!templateId) return null
  const templates = await listTemplates(db)
  return templates.find((template) => template.id === templateId) || null
}

async function validateBookingIntake(templateId, answers, db = pool) {
  if (!templateId) return null
  const template = await getTemplateById(templateId, db)
  if (!template || template.formScope !== 'booking' || template.status !== 'active') return null
  validateRequiredAnswers(template, answers)
  return template
}

async function listPublicAppointmentTypes(db = pool) {
  const result = await db.query(`
    SELECT
      at.id,
      at.name,
      at.slug,
      at.description,
      at.duration_minutes,
      at.price_cents,
      at.currency,
      at.requires_approval,
      at.buffer_before_minutes,
      at.buffer_after_minutes,
      at.booking_intake_template_id,
      at.auto_create_client_profile,
      at.auto_start_onboarding,
      at.send_confirmation_email,
      at.reminder_24h_enabled,
      at.reminder_2h_enabled
    FROM appointment_types at
    WHERE at.is_active = true
    ORDER BY at.created_at DESC
    LIMIT 100
  `)

  const templates = await listTemplates(db)

  return result.rows.map((row) => ({
    ...row,
    intake_form: templates.find(
      (template) => template.id === row.booking_intake_template_id && template.status === 'active',
    ) || null,
  }))
}

async function ensureBookingClientProfile({ booking, appointmentType, actorUserId = null }, db) {
  const email = normalizeEmail(booking.guest_email)
  if (!email) return null

  const name = splitName(booking.guest_name)
  const userResult = await db.query(
    `SELECT * FROM system_users WHERE lower(email::text) = lower($1) LIMIT 1`,
    [email],
  )

  let user = userResult.rows[0]
  if (user && !['client', 'member'].includes(user.role)) {
    return null
  }

  if (!user) {
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12)
    const inserted = await db.query(
      `
      INSERT INTO system_users (email, password_hash, role, status)
      VALUES ($1, $2, 'client', 'invited')
      RETURNING *
      `,
      [email, passwordHash],
    )
    user = inserted.rows[0]
  }

  const profileResult = await db.query(
    `SELECT * FROM client_profiles WHERE user_id = $1 LIMIT 1`,
    [user.id],
  )

  let profile = profileResult.rows[0]
  const supportNote = [
    `Created automatically from ${appointmentType.name || 'a booking request'}.`,
    booking.intake_answers?.message ? `Support requested: ${booking.intake_answers.message}` : '',
  ].filter(Boolean).join('\n')

  if (profile) {
    const updated = await db.query(
      `
      UPDATE client_profiles
      SET first_name = COALESCE(NULLIF(first_name, ''), NULLIF($2, '')),
          last_name = COALESCE(NULLIF(last_name, ''), NULLIF($3, '')),
          phone = COALESCE(NULLIF(phone, ''), NULLIF($4, '')),
          private_admin_notes = CASE
            WHEN $5 = '' THEN private_admin_notes
            WHEN private_admin_notes IS NULL OR trim(private_admin_notes) = '' THEN $5
            WHEN private_admin_notes NOT ILIKE '%' || $5 || '%' THEN private_admin_notes || E'\n\n' || $5
            ELSE private_admin_notes
          END,
          updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [profile.id, name.firstName, name.lastName, booking.guest_phone || '', supportNote],
    )
    profile = updated.rows[0]
  } else {
    const inserted = await db.query(
      `
      INSERT INTO client_profiles (
        user_id,
        first_name,
        last_name,
        phone,
        client_status,
        private_admin_notes,
        pipeline_stage
      )
      VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''), 'lead', NULLIF($5, ''), 'consultation_booked')
      RETURNING *
      `,
      [user.id, name.firstName, name.lastName, booking.guest_phone || '', supportNote],
    )
    profile = inserted.rows[0]
  }

  await db.query(
    `UPDATE bookings SET client_profile_id = $2, updated_at = now() WHERE id = $1`,
    [booking.id, profile.id],
  )

  await db.query(
    `
    INSERT INTO client_care_plans (client_profile_id, journey_stage, care_status, updated_by_user_id)
    VALUES ($1, 'onboarding', 'not_started', $2)
    ON CONFLICT (client_profile_id) DO NOTHING
    `,
    [profile.id, actorUserId],
  )

  return profile
}

function formatBookingDate(value, timezone = 'America/New_York') {
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(new Date(value))
  } catch {
    return new Date(value).toISOString()
  }
}

function communicationCopy(type, booking) {
  const clientName = booking.guest_name || 'there'
  const appointmentName = booking.appointment_type_name || 'your Power Within appointment'
  const dateLabel = formatBookingDate(booking.starts_at, booking.timezone)

  const copies = {
    request_received: {
      subject: `We received your ${appointmentName} request`,
      body: `Hi ${clientName},\n\nWe received your request for ${appointmentName} on ${dateLabel}. The Power Within team will review the details and follow up with your next step.\n\nWith care,\nPower Within Collective`,
    },
    booking_confirmed: {
      subject: `Your ${appointmentName} is confirmed`,
      body: `Hi ${clientName},\n\nYour ${appointmentName} is confirmed for ${dateLabel}. We look forward to supporting you.\n\nWith care,\nPower Within Collective`,
    },
    reminder_24h: {
      subject: `A reminder for your Power Within appointment tomorrow`,
      body: `Hi ${clientName},\n\nA gentle reminder that ${appointmentName} is scheduled for ${dateLabel}.\n\nWith care,\nPower Within Collective`,
    },
    reminder_2h: {
      subject: `Your Power Within appointment begins soon`,
      body: `Hi ${clientName},\n\nYour ${appointmentName} begins at ${dateLabel}. We look forward to seeing you soon.\n\nWith care,\nPower Within Collective`,
    },
    booking_cancelled: {
      subject: `Your Power Within appointment was cancelled`,
      body: `Hi ${clientName},\n\nYour ${appointmentName} scheduled for ${dateLabel} has been cancelled. Please contact the Power Within team if you would like help choosing another time.\n\nWith care,\nPower Within Collective`,
    },
  }

  return copies[type]
}

async function getBookingCommunicationContext(bookingId, db) {
  const result = await db.query(
    `
    SELECT
      b.*,
      at.name AS appointment_type_name,
      at.send_confirmation_email,
      at.reminder_24h_enabled,
      at.reminder_2h_enabled
    FROM bookings b
    LEFT JOIN appointment_types at ON at.id = b.appointment_type_id
    WHERE b.id = $1
    LIMIT 1
    `,
    [bookingId],
  )
  return result.rows[0] || null
}

async function queueBookingCommunication(booking, type, scheduledAt, db) {
  if (!booking.guest_email) return null
  const copy = communicationCopy(type, booking)
  if (!copy) return null

  const result = await db.query(
    `
    INSERT INTO booking_communications (
      booking_id,
      communication_type,
      status,
      scheduled_at,
      email_to,
      subject,
      body_text
    )
    VALUES ($1, $2, 'pending', $3, $4, $5, $6)
    ON CONFLICT (booking_id, communication_type)
    DO UPDATE SET
      scheduled_at = EXCLUDED.scheduled_at,
      email_to = EXCLUDED.email_to,
      subject = EXCLUDED.subject,
      body_text = EXCLUDED.body_text,
      status = CASE WHEN booking_communications.status = 'sent' THEN 'sent' ELSE 'pending' END,
      last_error = CASE WHEN booking_communications.status = 'sent' THEN booking_communications.last_error ELSE NULL END,
      updated_at = now()
    RETURNING *
    `,
    [booking.id, type, scheduledAt, normalizeEmail(booking.guest_email), copy.subject, copy.body],
  )
  return result.rows[0]
}

async function scheduleBookingCommunications(bookingId, { status = null } = {}, db = pool) {
  const booking = await getBookingCommunicationContext(bookingId, db)
  if (!booking) throw new Error('Booking not found.')

  const effectiveStatus = status || booking.status
  const queued = []

  if (effectiveStatus === 'requested' && booking.send_confirmation_email !== false) {
    const job = await queueBookingCommunication(booking, 'request_received', new Date().toISOString(), db)
    if (job) queued.push(job)
  }

  if (['approved', 'confirmed'].includes(effectiveStatus) && booking.send_confirmation_email !== false) {
    const confirmation = await queueBookingCommunication(booking, 'booking_confirmed', new Date().toISOString(), db)
    if (confirmation) queued.push(confirmation)

    const startsAt = new Date(booking.starts_at).getTime()
    if (booking.reminder_24h_enabled && startsAt - Date.now() > 24 * 60 * 60 * 1000) {
      const reminder = await queueBookingCommunication(
        booking,
        'reminder_24h',
        new Date(startsAt - 24 * 60 * 60 * 1000).toISOString(),
        db,
      )
      if (reminder) queued.push(reminder)
    }

    if (booking.reminder_2h_enabled && startsAt - Date.now() > 2 * 60 * 60 * 1000) {
      const reminder = await queueBookingCommunication(
        booking,
        'reminder_2h',
        new Date(startsAt - 2 * 60 * 60 * 1000).toISOString(),
        db,
      )
      if (reminder) queued.push(reminder)
    }
  }

  if (effectiveStatus === 'cancelled') {
    await db.query(
      `
      UPDATE booking_communications
      SET status = 'cancelled', updated_at = now()
      WHERE booking_id = $1
        AND status IN ('pending', 'failed')
      `,
      [bookingId],
    )
    const cancellation = await queueBookingCommunication(booking, 'booking_cancelled', new Date().toISOString(), db)
    if (cancellation) queued.push(cancellation)
  }

  return queued
}

function emailHtml(bodyText) {
  return `<div style="font-family:Georgia,serif;line-height:1.7;color:#35232a;max-width:640px;margin:0 auto;padding:28px"><p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7f5965">Power Within Collective</p>${String(bodyText || '').split('\n').map((line) => line ? `<p>${line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>` : '<br />').join('')}</div>`
}

function communicationLogType(communicationType) {
  if (['reminder_24h', 'reminder_2h'].includes(communicationType)) {
    return 'session_reminder'
  }
  return 'general'
}

function bookingSentTimestampColumn(communicationType) {
  if (communicationType === 'booking_confirmed') return 'confirmation_sent_at'
  if (communicationType === 'reminder_24h') return 'reminder_24h_sent_at'
  if (communicationType === 'reminder_2h') return 'reminder_2h_sent_at'
  return null
}

async function processDueBookingCommunications({ limit = 20, bookingId = null } = {}, db = pool) {
  if (!db) return { processed: 0, reason: 'database_unavailable' }

  const settings = await getPlatformSettings(db)
  if (settings.maintenanceMode || settings.outgoingEmailPaused) {
    return { processed: 0, reason: 'outgoing_email_paused' }
  }
  if (!env.resendApiKey || !env.portalEmailFrom) {
    return { processed: 0, reason: 'email_provider_not_configured' }
  }

  const result = await db.query(
    `
    SELECT bc.*, b.client_profile_id
    FROM booking_communications bc
    JOIN bookings b ON b.id = bc.booking_id
    WHERE bc.status IN ('pending', 'failed')
      AND bc.attempts < 3
      AND bc.scheduled_at <= now()
      AND ($2::uuid IS NULL OR bc.booking_id = $2)
    ORDER BY bc.scheduled_at
    LIMIT $1
    `,
    [Math.min(Math.max(Number(limit) || 20, 1), 100), bookingId],
  )

  let processed = 0
  const errors = []

  for (const job of result.rows) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.portalEmailFrom,
          to: [job.email_to],
          subject: job.subject,
          text: job.body_text,
          html: emailHtml(job.body_text),
        }),
      })
      const providerData = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(providerData.message || `Resend returned ${response.status}.`)

      await db.query(
        `
        UPDATE booking_communications
        SET status = 'sent',
            sent_at = now(),
            attempts = attempts + 1,
            provider_message_id = $2,
            last_error = NULL,
            updated_at = now()
        WHERE id = $1
        `,
        [job.id, providerData.id || null],
      )

      const sentTimestampColumn = bookingSentTimestampColumn(job.communication_type)
      if (sentTimestampColumn) {
        await db.query(
          `UPDATE bookings SET ${sentTimestampColumn} = now(), updated_at = now() WHERE id = $1`,
          [job.booking_id],
        )
      }

      if (job.client_profile_id) {
        try {
          await db.query(
            `
            INSERT INTO client_portal_email_logs (
              client_profile_id,
              email_type,
              email_to,
              subject,
              body_text,
              status,
              sent_at,
              provider,
              provider_message_id,
              provider_response
            )
            VALUES ($1, $2, $3, $4, $5, 'sent', now(), 'resend', $6, $7::jsonb)
            `,
            [
              job.client_profile_id,
              communicationLogType(job.communication_type),
              job.email_to,
              job.subject,
              job.body_text,
              providerData.id || null,
              JSON.stringify({ ...providerData, communicationType: job.communication_type }),
            ],
          )
        } catch (logError) {
          console.error('Booking email was sent but its client email log failed:', logError.message)
        }
      }
      processed += 1
    } catch (error) {
      const message = String(error.message || 'Booking communication failed.').slice(0, 500)
      await db.query(
        `
        UPDATE booking_communications
        SET status = 'failed', attempts = attempts + 1, last_error = $2, updated_at = now()
        WHERE id = $1
        `,
        [job.id, message],
      )
      errors.push({ id: job.id, error: message })
    }
  }

  return { processed, errors }
}

let dispatcherStarted = false
let dispatcherBusy = false

function startBookingCommunicationDispatcher() {
  if (dispatcherStarted || !pool) return
  dispatcherStarted = true

  const run = async () => {
    if (dispatcherBusy) return
    dispatcherBusy = true
    try {
      await processDueBookingCommunications()
    } catch (error) {
      console.error('Booking communication dispatcher failed:', error.message)
    } finally {
      dispatcherBusy = false
    }
  }

  setTimeout(run, 15_000)
  const timer = setInterval(run, 60_000)
  if (typeof timer.unref === 'function') timer.unref()
}

module.exports = {
  FIELD_TYPES,
  ONBOARDING_STATUSES,
  ensureBookingClientProfile,
  getClientPortalOnboarding,
  listOnboardingStudio,
  listPublicAppointmentTypes,
  listTemplates,
  processDueBookingCommunications,
  saveClientPortalOnboarding,
  saveTemplate,
  scheduleBookingCommunications,
  startBookingCommunicationDispatcher,
  startClientOnboarding,
  updateAppointmentOnboardingSettings,
  updateClientOnboarding,
  validateBookingIntake,
}
