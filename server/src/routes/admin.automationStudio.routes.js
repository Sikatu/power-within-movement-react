const express = require('express')
const { z } = require('zod')

const { pool } = require('../db/pool')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const {
  createEnrollment: createAutomationEnrollment,
  listAutomationStudio,
  processDueAutomationEnrollments,
  saveWorkflow: saveAutomationWorkflow,
  updateEnrollmentStatus: updateAutomationEnrollmentStatus,
} = require('../services/automationStudio.service')
const {
  enforceTeamClientAssignment,
  enforceTeamPermission,
} = require('../services/teamManagement.service')

const router = express.Router()

const automationStepSchema = z.object({
  stepType: z.enum(['email', 'follow_up_task', 'internal_notification']),
  delayMinutes: z.coerce.number().int().min(0).max(525600).optional().default(0),
  templateId: z.string().uuid().nullable().optional(),
  subject: z.string().trim().max(250).optional().default(''),
  bodyText: z.string().trim().max(20000).optional().default(''),
  taskTitle: z.string().trim().max(250).optional().default(''),
  taskNotes: z.string().trim().max(5000).optional().default(''),
  taskPriority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  notificationTitle: z.string().trim().max(250).optional().default(''),
  notificationBody: z.string().trim().max(5000).optional().default(''),
  notificationImportance: z.enum(['normal', 'high', 'urgent']).optional().default('normal'),
})

const automationWorkflowSchema = z.object({
  name: z.string().trim().min(1, 'Workflow name is required.').max(160),
  description: z.string().trim().max(2000).optional().default(''),
  triggerType: z.enum(['manual', 'new_lead', 'pipeline_stage', 'client_converted']),
  triggerStage: z.enum([
    'new_inquiry',
    'contacted',
    'consultation_booked',
    'qualified',
    'nurturing',
    'converted',
    'not_a_fit',
  ]).nullable().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']),
  defaultAssigneeUserId: z.string().uuid().nullable().optional(),
  steps: z.array(automationStepSchema).max(30),
})

const automationEnrollmentSchema = z.object({
  clientProfileId: z.string().uuid(),
  runNow: z.boolean().optional().default(false),
})

const automationEnrollmentActionSchema = z.object({
  action: z.enum(['pause', 'resume', 'cancel', 'retry', 'run_now']),
})

const requireAdmin = [
  requireAuth,
  requireRole(['developer', 'owner', 'admin', 'staff']),
  enforceTeamPermission,
  enforceTeamClientAssignment,
]

async function verifyAutomationClientAccess(req, clientProfileId) {
  if (req.user?.role !== 'staff') return true

  const result = await pool.query(
    `
    SELECT 1
    FROM team_client_assignments
    WHERE team_user_id = $1
      AND client_profile_id = $2
    LIMIT 1
    `,
    [req.user.id, clientProfileId],
  )

  return Boolean(result.rows[0])
}

router.get('/automation-studio', requireAdmin, async (req, res, next) => {
  try {
    const studio = await listAutomationStudio(
      req.user?.role === 'staff' ? req.user.id : null,
    )

    return res.json({ ok: true, studio })
  } catch (error) {
    return next(error)
  }
})

router.post('/automation-studio/workflows', requireAdmin, async (req, res, next) => {
  const parsed = automationWorkflowSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please review the automation workflow.',
    })
  }

  try {
    const workflow = await saveAutomationWorkflow(null, parsed.data, req.user.id)
    const studio = await listAutomationStudio(
      req.user?.role === 'staff' ? req.user.id : null,
    )

    return res.status(201).json({
      ok: true,
      message: 'Automation workflow created.',
      workflow,
      studio,
    })
  } catch (error) {
    return next(error)
  }
})

router.put('/automation-studio/workflows/:workflowId', requireAdmin, async (req, res, next) => {
  const parsed = automationWorkflowSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please review the automation workflow.',
    })
  }

  try {
    const workflow = await saveAutomationWorkflow(
      req.params.workflowId,
      parsed.data,
      req.user.id,
    )

    if (!workflow) {
      return res.status(404).json({ ok: false, error: 'Automation workflow was not found.' })
    }

    const studio = await listAutomationStudio(
      req.user?.role === 'staff' ? req.user.id : null,
    )

    return res.json({
      ok: true,
      message: 'Automation workflow updated.',
      workflow,
      studio,
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/automation-studio/workflows/:workflowId/enroll', requireAdmin, async (req, res, next) => {
  const parsed = automationEnrollmentSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Choose a client for this workflow.',
    })
  }

  try {
    const allowed = await verifyAutomationClientAccess(req, parsed.data.clientProfileId)

    if (!allowed) {
      return res.status(403).json({
        ok: false,
        code: 'TEAM_CLIENT_ASSIGNMENT_REQUIRED',
        error: 'This client is not assigned to your team profile.',
      })
    }

    const enrollment = await createAutomationEnrollment({
      workflowId: req.params.workflowId,
      clientProfileId: parsed.data.clientProfileId,
      triggerSource: 'manual',
      actorUserId: req.user.id,
      runNow: parsed.data.runNow,
    })

    if (!enrollment) {
      return res.status(409).json({
        ok: false,
        error: 'This exact automation enrollment already exists.',
      })
    }

    if (parsed.data.runNow) {
      await processDueAutomationEnrollments({ enrollmentId: enrollment.id })
    }

    const studio = await listAutomationStudio(
      req.user?.role === 'staff' ? req.user.id : null,
    )

    return res.status(201).json({
      ok: true,
      message: parsed.data.runNow
        ? 'Client enrolled and the first step was processed.'
        : 'Client enrolled in the automation workflow.',
      enrollment,
      studio,
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/automation-studio/enrollments/:enrollmentId/action', requireAdmin, async (req, res, next) => {
  const parsed = automationEnrollmentActionSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Choose a valid enrollment action.' })
  }

  try {
    const enrollmentClientResult = await pool.query(
      'SELECT client_profile_id FROM automation_enrollments WHERE id = $1 LIMIT 1',
      [req.params.enrollmentId],
    )
    const clientProfileId = enrollmentClientResult.rows[0]?.client_profile_id

    if (!clientProfileId) {
      return res.status(404).json({ ok: false, error: 'Automation enrollment was not found.' })
    }

    const allowed = await verifyAutomationClientAccess(req, clientProfileId)

    if (!allowed) {
      return res.status(403).json({
        ok: false,
        code: 'TEAM_CLIENT_ASSIGNMENT_REQUIRED',
        error: 'This client is not assigned to your team profile.',
      })
    }

    let enrollment
    let runResult = null

    if (parsed.data.action === 'run_now') {
      enrollment = await updateAutomationEnrollmentStatus(
        req.params.enrollmentId,
        'retry',
        req.user.id,
      )
      runResult = await processDueAutomationEnrollments({ enrollmentId: req.params.enrollmentId })
    } else {
      enrollment = await updateAutomationEnrollmentStatus(
        req.params.enrollmentId,
        parsed.data.action,
        req.user.id,
      )
    }

    if (!enrollment) {
      return res.status(404).json({ ok: false, error: 'Automation enrollment was not found.' })
    }

    const studio = await listAutomationStudio(
      req.user?.role === 'staff' ? req.user.id : null,
    )

    return res.json({
      ok: true,
      message: parsed.data.action === 'run_now'
        ? 'Automation step processed.'
        : ({
          pause: 'Automation enrollment paused.',
          resume: 'Automation enrollment resumed.',
          cancel: 'Automation enrollment cancelled.',
          retry: 'Automation enrollment queued for retry.',
        }[parsed.data.action] || 'Automation enrollment updated.'),
      enrollment,
      runResult,
      studio,
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/automation-studio/run-due', requireAdmin, async (req, res, next) => {
  try {
    const result = await processDueAutomationEnrollments({ limit: 50 })
    const studio = await listAutomationStudio(
      req.user?.role === 'staff' ? req.user.id : null,
    )

    return res.json({
      ok: true,
      message: `Processed ${result.processed || 0} due automation step(s).`,
      result,
      studio,
    })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
