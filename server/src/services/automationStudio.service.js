const crypto = require('crypto')

const { env } = require('../config/env')
const { pool } = require('../db/pool')
const { getPlatformSettings } = require('./platformSettings.service')

const TRIGGER_TYPES = ['manual', 'new_lead', 'pipeline_stage', 'client_converted']
const WORKFLOW_STATUSES = ['draft', 'active', 'paused', 'archived']
const STEP_TYPES = ['email', 'follow_up_task', 'internal_notification']
const ENROLLMENT_STATUSES = ['active', 'paused', 'completed', 'cancelled', 'failed']
const PIPELINE_STAGES = [
  'new_inquiry',
  'contacted',
  'consultation_booked',
  'qualified',
  'nurturing',
  'converted',
  'not_a_fit',
]

let dispatcherRunning = false

function slugify(value) {
  const base = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)

  return base || `workflow-${crypto.randomBytes(4).toString('hex')}`
}

function clientName(row) {
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    row.email ||
    row.public_contact_email ||
    'Client'
}

function replaceVariables(value, context) {
  return String(value || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    const replacement = context[key]
    return replacement === undefined || replacement === null ? '' : String(replacement)
  })
}

function serializeStep(row) {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    position: Number(row.position || 0),
    stepType: row.step_type,
    delayMinutes: Number(row.delay_minutes || 0),
    templateId: row.template_id,
    templateName: row.template_name || null,
    subject: row.subject || '',
    bodyText: row.body_text || '',
    taskTitle: row.task_title || '',
    taskNotes: row.task_notes || '',
    taskPriority: row.task_priority || 'normal',
    notificationTitle: row.notification_title || '',
    notificationBody: row.notification_body || '',
    notificationImportance: row.notification_importance || 'normal',
  }
}

function serializeWorkflow(row, steps = []) {
  return {
    id: row.id,
    workflowKey: row.workflow_key,
    name: row.name,
    description: row.description || '',
    triggerType: row.trigger_type,
    triggerStage: row.trigger_stage || '',
    status: row.status,
    defaultAssigneeUserId: row.default_assignee_user_id || '',
    defaultAssigneeName: row.default_assignee_name || row.default_assignee_email || null,
    enrollmentCount: Number(row.enrollment_count || 0),
    activeEnrollmentCount: Number(row.active_enrollment_count || 0),
    completedEnrollmentCount: Number(row.completed_enrollment_count || 0),
    failedEnrollmentCount: Number(row.failed_enrollment_count || 0),
    lastEnrollmentAt: row.last_enrollment_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    steps,
  }
}

function serializeEnrollment(row) {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    workflowName: row.workflow_name,
    clientProfileId: row.client_profile_id,
    clientName: clientName(row),
    email: row.email || row.public_contact_email || null,
    triggerSource: row.trigger_source,
    triggerKey: row.trigger_key,
    status: row.status,
    currentStepPosition: Number(row.current_step_position || 1),
    nextRunAt: row.next_run_at,
    failureCount: Number(row.failure_count || 0),
    lastError: row.last_error || '',
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function listAutomationStudio(teamUserId = null, db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const [workflowResult, stepResult, enrollmentResult, templateResult, teamResult, clientResult, metricsResult] = await Promise.all([
    db.query(`
      SELECT
        aw.*,
        assignee.email AS default_assignee_email,
        assignee_profile.display_name AS default_assignee_name,
        COUNT(ae.id)::int AS enrollment_count,
        COUNT(ae.id) FILTER (WHERE ae.status = 'active')::int AS active_enrollment_count,
        COUNT(ae.id) FILTER (WHERE ae.status = 'completed')::int AS completed_enrollment_count,
        COUNT(ae.id) FILTER (WHERE ae.status = 'failed')::int AS failed_enrollment_count,
        MAX(ae.created_at) AS last_enrollment_at
      FROM automation_workflows aw
      LEFT JOIN system_users assignee ON assignee.id = aw.default_assignee_user_id
      LEFT JOIN team_member_profiles assignee_profile ON assignee_profile.user_id = assignee.id
      LEFT JOIN automation_enrollments ae ON ae.workflow_id = aw.id
      WHERE aw.status <> 'archived'
      GROUP BY aw.id, assignee.email, assignee_profile.display_name
      ORDER BY
        CASE aw.status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END,
        aw.updated_at DESC
    `),
    db.query(`
      SELECT ast.*, mt.name AS template_name
      FROM automation_steps ast
      LEFT JOIN mail_templates mt ON mt.id = ast.template_id
      ORDER BY ast.workflow_id, ast.position
    `),
    db.query(`
      SELECT
        ae.*,
        aw.name AS workflow_name,
        cp.first_name,
        cp.last_name,
        cp.public_contact_email,
        su.email
      FROM automation_enrollments ae
      JOIN automation_workflows aw ON aw.id = ae.workflow_id
      JOIN client_profiles cp ON cp.id = ae.client_profile_id
      LEFT JOIN system_users su ON su.id = cp.user_id
      WHERE (
        $1::uuid IS NULL
        OR EXISTS (
          SELECT 1
          FROM team_client_assignments tca
          WHERE tca.team_user_id = $1
            AND tca.client_profile_id = ae.client_profile_id
        )
      )
      ORDER BY
        CASE ae.status WHEN 'failed' THEN 0 WHEN 'active' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END,
        ae.next_run_at ASC NULLS LAST,
        ae.created_at DESC
      LIMIT 200
    `, [teamUserId]),
    db.query(`
      SELECT id, name, category, subject, body_text, status
      FROM mail_templates
      WHERE status = 'active'
      ORDER BY category, name
    `),
    db.query(`
      SELECT
        su.id,
        su.email,
        su.role,
        COALESCE(tmp.display_name, su.email) AS display_name
      FROM system_users su
      LEFT JOIN team_member_profiles tmp ON tmp.user_id = su.id
      WHERE su.role IN ('developer', 'owner', 'admin', 'staff')
        AND su.status = 'active'
      ORDER BY
        CASE su.role WHEN 'admin' THEN 0 WHEN 'staff' THEN 1 WHEN 'owner' THEN 2 ELSE 3 END,
        COALESCE(tmp.display_name, su.email)
    `),
    db.query(`
      SELECT
        cp.id,
        cp.first_name,
        cp.last_name,
        cp.client_status,
        cp.pipeline_stage,
        cp.public_contact_email,
        su.email
      FROM client_profiles cp
      LEFT JOIN system_users su ON su.id = cp.user_id
      WHERE cp.client_status <> 'archived'
        AND (
          $1::uuid IS NULL
          OR EXISTS (
            SELECT 1
            FROM team_client_assignments tca
            WHERE tca.team_user_id = $1
              AND tca.client_profile_id = cp.id
          )
        )
      ORDER BY cp.updated_at DESC, cp.created_at DESC
      LIMIT 300
    `, [teamUserId]),
    db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM automation_workflows WHERE status <> 'archived') AS total_workflows,
        (SELECT COUNT(*)::int FROM automation_workflows WHERE status = 'active') AS active_workflows,
        (SELECT COUNT(*)::int FROM automation_enrollments WHERE status = 'active') AS active_enrollments,
        (SELECT COUNT(*)::int FROM automation_enrollments WHERE status = 'failed') AS failed_enrollments,
        (SELECT COUNT(*)::int FROM automation_step_runs WHERE status = 'completed' AND created_at >= now() - interval '30 days') AS completed_steps_30_days
    `),
  ])

  const stepsByWorkflow = new Map()
  for (const row of stepResult.rows) {
    const list = stepsByWorkflow.get(row.workflow_id) || []
    list.push(serializeStep(row))
    stepsByWorkflow.set(row.workflow_id, list)
  }

  const metrics = metricsResult.rows[0] || {}

  return {
    triggerTypes: TRIGGER_TYPES,
    workflowStatuses: WORKFLOW_STATUSES,
    stepTypes: STEP_TYPES,
    pipelineStages: PIPELINE_STAGES,
    metrics: {
      totalWorkflows: Number(metrics.total_workflows || 0),
      activeWorkflows: Number(metrics.active_workflows || 0),
      activeEnrollments: Number(metrics.active_enrollments || 0),
      failedEnrollments: Number(metrics.failed_enrollments || 0),
      completedSteps30Days: Number(metrics.completed_steps_30_days || 0),
    },
    workflows: workflowResult.rows.map((row) => serializeWorkflow(row, stepsByWorkflow.get(row.id) || [])),
    enrollments: enrollmentResult.rows.map(serializeEnrollment),
    templates: templateResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      subject: row.subject,
      bodyText: row.body_text,
    })),
    teamUsers: teamResult.rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      displayName: row.display_name,
    })),
    clients: clientResult.rows.map((row) => ({
      id: row.id,
      name: clientName(row),
      email: row.email || row.public_contact_email || null,
      clientStatus: row.client_status,
      pipelineStage: row.pipeline_stage,
    })),
  }
}

async function validateAssignee(userId, db) {
  if (!userId) return true
  const result = await db.query(
    `SELECT 1 FROM system_users WHERE id = $1 AND status = 'active' AND role IN ('developer', 'owner', 'admin', 'staff') LIMIT 1`,
    [userId],
  )
  return Boolean(result.rows[0])
}

function normalizeSteps(steps = []) {
  return steps.map((step, index) => ({
    position: index + 1,
    stepType: STEP_TYPES.includes(step.stepType) ? step.stepType : 'email',
    delayMinutes: Math.max(0, Math.min(Number(step.delayMinutes || 0), 525600)),
    templateId: step.templateId || null,
    subject: String(step.subject || '').trim().slice(0, 250),
    bodyText: String(step.bodyText || '').trim().slice(0, 20000),
    taskTitle: String(step.taskTitle || '').trim().slice(0, 250),
    taskNotes: String(step.taskNotes || '').trim().slice(0, 5000),
    taskPriority: ['low', 'normal', 'high', 'urgent'].includes(step.taskPriority) ? step.taskPriority : 'normal',
    notificationTitle: String(step.notificationTitle || '').trim().slice(0, 250),
    notificationBody: String(step.notificationBody || '').trim().slice(0, 5000),
    notificationImportance: ['normal', 'high', 'urgent'].includes(step.notificationImportance)
      ? step.notificationImportance
      : 'normal',
  }))
}

function validateWorkflowPayload(payload) {
  const name = String(payload.name || '').trim()
  if (!name) throw new Error('Workflow name is required.')

  const triggerType = TRIGGER_TYPES.includes(payload.triggerType) ? payload.triggerType : 'manual'
  const triggerStage = triggerType === 'pipeline_stage' && PIPELINE_STAGES.includes(payload.triggerStage)
    ? payload.triggerStage
    : null
  const status = WORKFLOW_STATUSES.includes(payload.status) ? payload.status : 'draft'
  const steps = normalizeSteps(payload.steps || [])

  if (triggerType === 'pipeline_stage' && !triggerStage) {
    throw new Error('Choose the pipeline stage that should trigger this workflow.')
  }

  if (status === 'active' && steps.length === 0) {
    throw new Error('An active workflow needs at least one step.')
  }

  for (const step of steps) {
    if (step.stepType === 'email' && !step.templateId && (!step.subject || !step.bodyText)) {
      throw new Error('Every email step needs a template or both a subject and message.')
    }
    if (step.stepType === 'follow_up_task' && !step.taskTitle) {
      throw new Error('Every follow-up task step needs a title.')
    }
    if (step.stepType === 'internal_notification' && !step.notificationTitle) {
      throw new Error('Every internal notification step needs a title.')
    }
  }

  return {
    name: name.slice(0, 160),
    description: String(payload.description || '').trim().slice(0, 2000),
    triggerType,
    triggerStage,
    status,
    defaultAssigneeUserId: payload.defaultAssigneeUserId || null,
    steps,
  }
}

async function saveWorkflow(workflowId, payload, actorUserId, db = pool) {
  if (!db) throw new Error('Database is not configured.')
  const normalized = validateWorkflowPayload(payload)
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    if (!(await validateAssignee(normalized.defaultAssigneeUserId, client))) {
      throw new Error('Choose an active team member as the default assignee.')
    }

    let before = null
    let workflow

    if (workflowId) {
      const beforeResult = await client.query('SELECT * FROM automation_workflows WHERE id = $1 FOR UPDATE', [workflowId])
      before = beforeResult.rows[0]
      if (!before) {
        await client.query('ROLLBACK')
        return null
      }

      const result = await client.query(
        `
        UPDATE automation_workflows
        SET
          name = $2,
          description = $3,
          trigger_type = $4,
          trigger_stage = $5,
          status = $6,
          default_assignee_user_id = $7,
          updated_by_user_id = $8,
          updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          workflowId,
          normalized.name,
          normalized.description || null,
          normalized.triggerType,
          normalized.triggerStage,
          normalized.status,
          normalized.defaultAssigneeUserId,
          actorUserId || null,
        ],
      )
      workflow = result.rows[0]
      await client.query('DELETE FROM automation_steps WHERE workflow_id = $1', [workflowId])
    } else {
      const baseKey = slugify(normalized.name)
      let workflowKey = baseKey
      let suffix = 1
      while (true) {
        const existing = await client.query('SELECT 1 FROM automation_workflows WHERE workflow_key = $1 LIMIT 1', [workflowKey])
        if (!existing.rows[0]) break
        suffix += 1
        workflowKey = `${baseKey}-${suffix}`
      }

      const result = await client.query(
        `
        INSERT INTO automation_workflows (
          workflow_key,
          name,
          description,
          trigger_type,
          trigger_stage,
          status,
          default_assignee_user_id,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
        RETURNING *
        `,
        [
          workflowKey,
          normalized.name,
          normalized.description || null,
          normalized.triggerType,
          normalized.triggerStage,
          normalized.status,
          normalized.defaultAssigneeUserId,
          actorUserId || null,
        ],
      )
      workflow = result.rows[0]
    }

    for (const step of normalized.steps) {
      await client.query(
        `
        INSERT INTO automation_steps (
          workflow_id,
          position,
          step_type,
          delay_minutes,
          template_id,
          subject,
          body_text,
          task_title,
          task_notes,
          task_priority,
          notification_title,
          notification_body,
          notification_importance
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          workflow.id,
          step.position,
          step.stepType,
          step.delayMinutes,
          step.templateId,
          step.subject || null,
          step.bodyText || null,
          step.taskTitle || null,
          step.taskNotes || null,
          step.taskPriority,
          step.notificationTitle || null,
          step.notificationBody || null,
          step.notificationImportance,
        ],
      )
    }

    await client.query(
      `
      INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, before_data, after_data)
      VALUES ($1, $2, 'automation_workflows', $3, $4::jsonb, $5::jsonb)
      `,
      [
        actorUserId || null,
        workflowId ? 'automation_workflow_updated' : 'automation_workflow_created',
        workflow.id,
        JSON.stringify(before || {}),
        JSON.stringify({ ...workflow, steps: normalized.steps }),
      ],
    )

    await client.query('COMMIT')
    return workflow
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function getFirstStep(workflowId, db) {
  const result = await db.query(
    `SELECT id, position, delay_minutes FROM automation_steps WHERE workflow_id = $1 ORDER BY position LIMIT 1`,
    [workflowId],
  )
  return result.rows[0] || null
}

async function createEnrollment({ workflowId, clientProfileId, triggerSource = 'manual', triggerKey, actorUserId = null, runNow = false }, db = pool) {
  if (!db) throw new Error('Database is not configured.')
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    const workflowResult = await client.query(
      `SELECT * FROM automation_workflows WHERE id = $1 AND status <> 'archived' LIMIT 1 FOR UPDATE`,
      [workflowId],
    )
    const workflow = workflowResult.rows[0]
    if (!workflow) throw new Error('Automation workflow was not found.')

    const clientResult = await client.query('SELECT id FROM client_profiles WHERE id = $1 LIMIT 1', [clientProfileId])
    if (!clientResult.rows[0]) throw new Error('Client profile was not found.')

    const firstStep = await getFirstStep(workflowId, client)
    if (!firstStep) throw new Error('This workflow does not have any steps yet.')

    const effectiveTriggerKey = triggerKey || `manual:${crypto.randomUUID()}`
    const delayMinutes = runNow ? 0 : Number(firstStep.delay_minutes || 0)

    const result = await client.query(
      `
      INSERT INTO automation_enrollments (
        workflow_id,
        client_profile_id,
        trigger_source,
        trigger_key,
        status,
        current_step_position,
        next_run_at,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, 'active', $5, now() + ($6::text || ' minutes')::interval, $7)
      ON CONFLICT (workflow_id, client_profile_id, trigger_key)
      DO NOTHING
      RETURNING *
      `,
      [workflowId, clientProfileId, triggerSource, effectiveTriggerKey, firstStep.position, delayMinutes, actorUserId || null],
    )

    const enrollment = result.rows[0]

    if (enrollment) {
      await client.query(
        `
        INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, after_data)
        VALUES ($1, 'automation_enrollment_created', 'automation_enrollments', $2, $3::jsonb)
        `,
        [actorUserId || null, enrollment.id, JSON.stringify(enrollment)],
      )
    }

    await client.query('COMMIT')
    return enrollment || null
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function enrollMatchingAutomations({ clientProfileId, triggerType, triggerStage = null, actorUserId = null }, db = pool) {
  if (!db || !clientProfileId || !TRIGGER_TYPES.includes(triggerType) || triggerType === 'manual') return []

  const workflowResult = await db.query(
    `
    SELECT id
    FROM automation_workflows
    WHERE status = 'active'
      AND trigger_type = $1
      AND (
        trigger_type <> 'pipeline_stage'
        OR trigger_stage = $2
      )
    ORDER BY created_at
    `,
    [triggerType, triggerStage || null],
  )

  const triggerKey = triggerType === 'pipeline_stage'
    ? `pipeline_stage:${triggerStage}`
    : triggerType
  const enrollments = []

  for (const workflow of workflowResult.rows) {
    const enrollment = await createEnrollment({
      workflowId: workflow.id,
      clientProfileId,
      triggerSource: triggerType,
      triggerKey,
      actorUserId,
    }, db)
    if (enrollment) enrollments.push(enrollment)
  }

  return enrollments
}

async function resolveAssignee(workflow, clientRow, db) {
  const candidates = [
    workflow.default_assignee_user_id,
    clientRow.lead_owner_user_id,
    clientRow.enrollment_created_by_user_id,
  ].filter(Boolean)

  for (const candidate of candidates) {
    const result = await db.query(
      `SELECT id FROM system_users WHERE id = $1 AND status = 'active' AND role IN ('developer', 'owner', 'admin', 'staff') LIMIT 1`,
      [candidate],
    )
    if (result.rows[0]) return candidate
  }

  const fallback = await db.query(`
    SELECT id
    FROM system_users
    WHERE status = 'active'
      AND role IN ('admin', 'owner', 'developer')
    ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'owner' THEN 1 ELSE 2 END, created_at
    LIMIT 1
  `)

  return fallback.rows[0]?.id || null
}

async function getEnrollmentExecutionContext(enrollmentId, db) {
  const result = await db.query(
    `
    SELECT
      ae.*,
      aw.name AS workflow_name,
      aw.default_assignee_user_id,
      cp.first_name,
      cp.last_name,
      cp.public_contact_email,
      cp.pipeline_stage,
      cp.lead_interest,
      cp.lead_owner_user_id,
      su.email,
      ae.created_by_user_id AS enrollment_created_by_user_id
    FROM automation_enrollments ae
    JOIN automation_workflows aw ON aw.id = ae.workflow_id
    JOIN client_profiles cp ON cp.id = ae.client_profile_id
    LEFT JOIN system_users su ON su.id = cp.user_id
    WHERE ae.id = $1
    LIMIT 1
    `,
    [enrollmentId],
  )
  return result.rows[0] || null
}

async function executeEmailStep(step, context, actorUserId, db) {
  const email = context.email || context.public_contact_email
  if (!email) throw new Error('This client profile does not have an email address.')

  const settings = await getPlatformSettings(db)
  if (settings.maintenanceMode || settings.outgoingEmailPaused) {
    const error = new Error('Outgoing email is currently paused in Developer Operations.')
    error.code = 'OUTGOING_EMAIL_PAUSED'
    throw error
  }

  if (!env.resendApiKey || !env.portalEmailFrom) {
    const error = new Error('Resend is not configured for Automation Studio.')
    error.code = 'EMAIL_PROVIDER_NOT_CONFIGURED'
    throw error
  }

  let subject = step.subject || ''
  let bodyText = step.body_text || ''

  if (step.template_id) {
    const templateResult = await db.query(
      `SELECT subject, body_text FROM mail_templates WHERE id = $1 AND status = 'active' LIMIT 1`,
      [step.template_id],
    )
    const template = templateResult.rows[0]
    if (template) {
      subject = template.subject || subject
      bodyText = template.body_text || bodyText
    }
  }

  const variables = {
    clientName: clientName(context),
    firstName: context.first_name || clientName(context),
    email,
    interest: context.lead_interest || 'your inquiry',
    pipelineStage: context.pipeline_stage || '',
    workflowName: context.workflow_name || '',
    publicSiteUrl: env.publicSiteUrl,
  }

  subject = replaceVariables(subject, variables)
  bodyText = replaceVariables(bodyText, variables)

  if (!subject || !bodyText) throw new Error('Automation email content is incomplete.')

  const logResult = await db.query(
    `
    INSERT INTO client_portal_email_logs (
      client_profile_id,
      email_type,
      email_to,
      subject,
      body_text,
      status,
      provider,
      provider_response,
      created_by_user_id
    )
    VALUES ($1, 'general', $2, $3, $4, 'drafted', 'resend', $5::jsonb, $6)
    RETURNING id
    `,
    [
      context.client_profile_id,
      email,
      subject,
      bodyText,
      JSON.stringify({ source: 'automation_studio', workflowId: context.workflow_id, enrollmentId: context.id }),
      actorUserId || null,
    ],
  )

  const emailLogId = logResult.rows[0].id

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.portalEmailFrom,
        to: [email],
        subject,
        text: bodyText,
        html: `<div style="font-family:Georgia,serif;line-height:1.65;color:#3d2730;max-width:640px;margin:0 auto;padding:28px;"><p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8b6672;">Power Within Collective</p>${bodyText.split('\n').map((line) => line ? `<p>${String(line).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>` : '<br />').join('')}</div>`,
      }),
    })

    const providerData = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(providerData.message || `Resend returned ${response.status}.`)

    await db.query(
      `
      UPDATE client_portal_email_logs
      SET status = 'sent',
          sent_at = now(),
          provider_message_id = $2,
          provider_response = $3::jsonb,
          error_message = NULL,
          updated_at = now()
      WHERE id = $1
      `,
      [emailLogId, providerData.id || null, JSON.stringify(providerData)],
    )

    return { emailLogId, providerMessageId: providerData.id || null, email, subject }
  } catch (error) {
    await db.query(
      `
      UPDATE client_portal_email_logs
      SET status = 'failed',
          error_message = $2,
          updated_at = now()
      WHERE id = $1
      `,
      [emailLogId, String(error.message || 'Automation email failed.').slice(0, 500)],
    )
    throw error
  }
}

async function executeFollowUpTaskStep(step, context, actorUserId, db) {
  const assigneeUserId = await resolveAssignee(context, context, db)
  const variables = {
    clientName: clientName(context),
    firstName: context.first_name || clientName(context),
    email: context.email || context.public_contact_email || '',
    interest: context.lead_interest || 'the inquiry',
    pipelineStage: context.pipeline_stage || '',
    workflowName: context.workflow_name || '',
  }
  const title = replaceVariables(step.task_title || 'Automation follow-up', variables)
  const notes = replaceVariables(step.task_notes || '', variables)

  const result = await db.query(
    `
    INSERT INTO lead_follow_ups (
      client_profile_id,
      assigned_to_user_id,
      created_by_user_id,
      title,
      notes,
      status,
      priority,
      due_at
    )
    VALUES ($1, $2, $3, $4, $5, 'open', $6, now())
    RETURNING id
    `,
    [context.client_profile_id, assigneeUserId, actorUserId || assigneeUserId, title, notes || null, step.task_priority || 'normal'],
  )

  await db.query(
    `
    INSERT INTO lead_pipeline_activities (
      client_profile_id,
      actor_user_id,
      activity_type,
      title,
      details,
      metadata
    )
    VALUES ($1, $2, 'follow_up_scheduled', 'Automation follow-up scheduled', $3, $4::jsonb)
    `,
    [
      context.client_profile_id,
      actorUserId || assigneeUserId,
      title,
      JSON.stringify({ source: 'automation_studio', workflowId: context.workflow_id, enrollmentId: context.id, followUpId: result.rows[0].id }),
    ],
  )

  await db.query(
    `
    UPDATE client_profiles
    SET next_follow_up_at = (
      SELECT MIN(due_at)
      FROM lead_follow_ups
      WHERE client_profile_id = $1
        AND status = 'open'
        AND due_at IS NOT NULL
    ), updated_at = now()
    WHERE id = $1
    `,
    [context.client_profile_id],
  )

  return { followUpId: result.rows[0].id, assigneeUserId, title }
}

async function executeNotificationStep(step, context, actorUserId, db) {
  const assigneeUserId = await resolveAssignee(context, context, db)
  if (!assigneeUserId) throw new Error('No active team member is available for this notification.')

  const variables = {
    clientName: clientName(context),
    firstName: context.first_name || clientName(context),
    email: context.email || context.public_contact_email || '',
    interest: context.lead_interest || 'the inquiry',
    pipelineStage: context.pipeline_stage || '',
    workflowName: context.workflow_name || '',
  }
  const title = replaceVariables(step.notification_title || 'Automation update', variables)
  const body = replaceVariables(step.notification_body || '', variables)

  const result = await db.query(
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
    VALUES ($1, 'system', $2, $3, $4, 'Open lead', 'client_profiles', $5, $6, $7, 'not_requested', now() + interval '30 days')
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
    RETURNING id
    `,
    [
      assigneeUserId,
      title,
      body || `Automation ${context.workflow_name} is ready for review.`,
      `/admin/leads?client=${context.client_profile_id}`,
      context.client_profile_id,
      step.notification_importance || 'normal',
      `automation:${context.id}:${step.id}`,
    ],
  )

  return { notificationId: result.rows[0]?.id || null, assigneeUserId, actorUserId: actorUserId || null }
}

async function executeEnrollmentStep(enrollmentId, db = pool) {
  const context = await getEnrollmentExecutionContext(enrollmentId, db)
  if (!context || context.status !== 'active') return { processed: false, reason: 'not_active' }

  const stepResult = await db.query(
    `
    SELECT *
    FROM automation_steps
    WHERE workflow_id = $1
      AND position = $2
    LIMIT 1
    `,
    [context.workflow_id, context.current_step_position],
  )
  const step = stepResult.rows[0]

  if (!step) {
    await db.query(
      `UPDATE automation_enrollments SET status = 'completed', completed_at = now(), next_run_at = NULL, updated_at = now() WHERE id = $1`,
      [enrollmentId],
    )
    return { processed: true, completed: true }
  }

  const runResult = await db.query(
    `
    INSERT INTO automation_step_runs (
      enrollment_id,
      step_id,
      step_position,
      step_type,
      status,
      scheduled_for
    )
    VALUES ($1, $2, $3, $4, 'processing', $5)
    RETURNING id
    `,
    [enrollmentId, step.id, step.position, step.step_type, context.next_run_at],
  )
  const runId = runResult.rows[0].id

  try {
    let result
    if (step.step_type === 'email') result = await executeEmailStep(step, context, context.created_by_user_id, db)
    else if (step.step_type === 'follow_up_task') result = await executeFollowUpTaskStep(step, context, context.created_by_user_id, db)
    else result = await executeNotificationStep(step, context, context.created_by_user_id, db)

    await db.query(
      `UPDATE automation_step_runs SET status = 'completed', completed_at = now(), result = $2::jsonb WHERE id = $1`,
      [runId, JSON.stringify(result || {})],
    )

    const nextStepResult = await db.query(
      `SELECT position, delay_minutes FROM automation_steps WHERE workflow_id = $1 AND position > $2 ORDER BY position LIMIT 1`,
      [context.workflow_id, step.position],
    )
    const nextStep = nextStepResult.rows[0]

    if (nextStep) {
      await db.query(
        `
        UPDATE automation_enrollments
        SET current_step_position = $2,
            next_run_at = now() + ($3::text || ' minutes')::interval,
            failure_count = 0,
            last_error = NULL,
            updated_at = now()
        WHERE id = $1
        `,
        [enrollmentId, nextStep.position, Number(nextStep.delay_minutes || 0)],
      )
    } else {
      await db.query(
        `
        UPDATE automation_enrollments
        SET status = 'completed',
            completed_at = now(),
            next_run_at = NULL,
            failure_count = 0,
            last_error = NULL,
            updated_at = now()
        WHERE id = $1
        `,
        [enrollmentId],
      )
    }

    return { processed: true, completed: !nextStep, result }
  } catch (error) {
    const nextFailureCount = Number(context.failure_count || 0) + 1
    const finalFailure = nextFailureCount >= 3
    const nextRunDelay = error.code === 'OUTGOING_EMAIL_PAUSED' ? 30 : 10

    await db.query(
      `
      UPDATE automation_step_runs
      SET status = 'failed', completed_at = now(), error_message = $2
      WHERE id = $1
      `,
      [runId, String(error.message || 'Automation step failed.').slice(0, 500)],
    )

    await db.query(
      `
      UPDATE automation_enrollments
      SET status = $2,
          failure_count = $3,
          last_error = $4,
          next_run_at = CASE WHEN $2 = 'failed' THEN NULL ELSE now() + ($5::text || ' minutes')::interval END,
          updated_at = now()
      WHERE id = $1
      `,
      [
        enrollmentId,
        finalFailure ? 'failed' : 'active',
        nextFailureCount,
        String(error.message || 'Automation step failed.').slice(0, 500),
        nextRunDelay,
      ],
    )

    return { processed: true, failed: true, finalFailure, error: error.message }
  }
}

async function processDueAutomationEnrollments(options = {}, db = pool) {
  if (!db || dispatcherRunning) return { processed: 0, skipped: true }
  dispatcherRunning = true

  try {
    const limit = Math.min(Math.max(Number(options.limit || 20), 1), 100)
    const params = []
    let where = `ae.status = 'active' AND aw.status = 'active' AND ae.next_run_at IS NOT NULL AND ae.next_run_at <= now()`

    if (options.enrollmentId) {
      params.push(options.enrollmentId)
      where = `ae.id = $1 AND ae.status = 'active'`
    }

    params.push(limit)
    const result = await db.query(
      `
      SELECT ae.id
      FROM automation_enrollments ae
      JOIN automation_workflows aw ON aw.id = ae.workflow_id
      WHERE ${where}
      ORDER BY ae.next_run_at ASC NULLS FIRST, ae.created_at ASC
      LIMIT $${params.length}
      `,
      params,
    )

    const outcomes = []
    for (const row of result.rows) {
      outcomes.push(await executeEnrollmentStep(row.id, db))
    }

    return {
      processed: outcomes.filter((item) => item.processed).length,
      completed: outcomes.filter((item) => item.completed).length,
      failed: outcomes.filter((item) => item.failed).length,
      outcomes,
    }
  } finally {
    dispatcherRunning = false
  }
}

async function updateEnrollmentStatus(enrollmentId, action, actorUserId, db = pool) {
  if (!db) throw new Error('Database is not configured.')
  const actionMap = {
    pause: { status: 'paused', nextRunSql: 'next_run_at' },
    resume: { status: 'active', nextRunSql: 'COALESCE(next_run_at, now())' },
    cancel: { status: 'cancelled', nextRunSql: 'NULL' },
    retry: { status: 'active', nextRunSql: 'now()' },
  }
  const setting = actionMap[action]
  if (!setting) throw new Error('Unsupported enrollment action.')

  const result = await db.query(
    `
    UPDATE automation_enrollments
    SET status = $2,
        next_run_at = ${setting.nextRunSql},
        failure_count = CASE WHEN $2 = 'active' THEN 0 ELSE failure_count END,
        last_error = CASE WHEN $2 = 'active' THEN NULL ELSE last_error END,
        completed_at = CASE WHEN $2 = 'cancelled' THEN now() ELSE completed_at END,
        updated_at = now()
    WHERE id = $1
    RETURNING *
    `,
    [enrollmentId, setting.status],
  )

  const enrollment = result.rows[0]
  if (!enrollment) return null

  await db.query(
    `
    INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, after_data)
    VALUES ($1, $2, 'automation_enrollments', $3, $4::jsonb)
    `,
    [actorUserId || null, `automation_enrollment_${action}`, enrollment.id, JSON.stringify(enrollment)],
  )

  return enrollment
}

function startAutomationDispatcher() {
  if (!pool) return null

  const run = () => {
    processDueAutomationEnrollments().catch((error) => {
      console.error('Automation dispatcher failed:', error.message)
    })
  }

  const initialTimer = setTimeout(run, 15_000)
  const interval = setInterval(run, 60_000)
  initialTimer.unref?.()
  interval.unref?.()
  return interval
}

module.exports = {
  ENROLLMENT_STATUSES,
  PIPELINE_STAGES,
  STEP_TYPES,
  TRIGGER_TYPES,
  WORKFLOW_STATUSES,
  createEnrollment,
  enrollMatchingAutomations,
  listAutomationStudio,
  processDueAutomationEnrollments,
  saveWorkflow,
  startAutomationDispatcher,
  updateEnrollmentStatus,
}
