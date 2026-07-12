const express = require('express')
const { z } = require('zod')

const { pool } = require('../db/pool')
const { enforceTeamClientAssignment } = require('../services/teamManagement.service')
const {
  listOnboardingStudio,
  processDueBookingCommunications,
  saveTemplate,
  startClientOnboarding,
  updateAppointmentOnboardingSettings,
  updateClientOnboarding,
} = require('../services/bookingOnboarding.service')

const router = express.Router()

const intakeFieldSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  fieldKey: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(250),
  helpText: z.string().trim().max(1000).optional().default(''),
  placeholder: z.string().trim().max(500).optional().default(''),
  fieldType: z.enum([
    'short_text',
    'long_text',
    'email',
    'phone',
    'date',
    'select',
    'multiselect',
    'checkbox',
  ]),
  required: z.boolean().optional().default(false),
  options: z.array(z.string().trim().min(1).max(250)).max(50).optional().default([]),
  position: z.coerce.number().int().min(1).max(100).optional(),
})

const intakeTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required.').max(160),
  description: z.string().trim().max(2000).optional().default(''),
  formScope: z.enum(['booking', 'onboarding']),
  status: z.enum(['draft', 'active', 'archived']),
  welcomeMessage: z.string().trim().max(5000).optional().default(''),
  completionMessage: z.string().trim().max(5000).optional().default(''),
  fields: z.array(intakeFieldSchema).max(40),
})

const appointmentSettingsSchema = z.object({
  bookingIntakeTemplateId: z.string().uuid().nullable().optional(),
  onboardingTemplateId: z.string().uuid().nullable().optional(),
  autoCreateClientProfile: z.boolean(),
  autoStartOnboarding: z.boolean(),
  sendConfirmationEmail: z.boolean(),
  reminder24hEnabled: z.boolean(),
  reminder2hEnabled: z.boolean(),
})

const onboardingStartSchema = z.object({
  templateId: z.string().uuid().nullable().optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  clientWelcomeMessage: z.string().trim().max(5000).optional().default(''),
  privateNotes: z.string().trim().max(10000).optional().default(''),
})

const onboardingUpdateSchema = onboardingStartSchema.extend({
  status: z.enum(['not_started', 'in_progress', 'submitted', 'reviewed', 'completed', 'paused']),
})

function databaseUnavailable(res) {
  return res.status(503).json({ ok: false, error: 'Database is not configured.' })
}

function requireOnboardingAdministrator(req, res, next) {
  if (req.user?.role === 'staff') {
    return res.status(403).json({
      ok: false,
      code: 'ONBOARDING_ADMIN_REQUIRED',
      error: 'Only the Developer, Owner, or Admin can change global booking and onboarding settings.',
    })
  }
  return next()
}

async function getScopedStudio(req) {
  const studio = await listOnboardingStudio(pool)

  if (req.user?.role !== 'staff') return studio

  const assignments = await pool.query(
    `
    SELECT client_profile_id
    FROM team_client_assignments
    WHERE team_user_id = $1
    `,
    [req.user.id],
  )
  const allowed = new Set(assignments.rows.map((row) => row.client_profile_id))

  return {
    ...studio,
    clients: (studio.clients || []).filter((client) => allowed.has(client.id)),
    onboardingRecords: (studio.onboardingRecords || []).filter((record) => allowed.has(record.clientProfileId)),
  }
}

router.get('/', async (req, res, next) => {
  try {
    if (!pool) return databaseUnavailable(res)
    const studio = await getScopedStudio(req)
    return res.json({ ok: true, ...studio })
  } catch (error) {
    return next(error)
  }
})

router.post('/templates', requireOnboardingAdministrator, async (req, res, next) => {
  try {
    if (!pool) return databaseUnavailable(res)
    const parsed = intakeTemplateSchema.safeParse(req.body || {})
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Please review the intake template.',
      })
    }

    const template = await saveTemplate({
      payload: parsed.data,
      actorUserId: req.user.id,
    }, pool)
    const studio = await getScopedStudio(req)

    return res.status(201).json({
      ok: true,
      message: 'Intake template created.',
      template,
      ...studio,
    })
  } catch (error) {
    return next(error)
  }
})

router.put('/templates/:templateId', requireOnboardingAdministrator, async (req, res, next) => {
  try {
    if (!pool) return databaseUnavailable(res)
    const parsed = intakeTemplateSchema.safeParse(req.body || {})
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Please review the intake template.',
      })
    }

    const template = await saveTemplate({
      templateId: req.params.templateId,
      payload: parsed.data,
      actorUserId: req.user.id,
    }, pool)
    const studio = await getScopedStudio(req)

    return res.json({
      ok: true,
      message: 'Intake template updated.',
      template,
      ...studio,
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/appointment-types/:appointmentTypeId', requireOnboardingAdministrator, async (req, res, next) => {
  try {
    if (!pool) return databaseUnavailable(res)
    const parsed = appointmentSettingsSchema.safeParse(req.body || {})
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Please review the appointment onboarding settings.',
      })
    }

    await updateAppointmentOnboardingSettings(
      req.params.appointmentTypeId,
      parsed.data,
      req.user.id,
      pool,
    )
    const studio = await getScopedStudio(req)
    return res.json({ ok: true, message: 'Appointment onboarding settings saved.', ...studio })
  } catch (error) {
    return next(error)
  }
})

router.post('/clients/:clientId/start', enforceTeamClientAssignment, async (req, res, next) => {
  try {
    if (!pool) return databaseUnavailable(res)
    const parsed = onboardingStartSchema.safeParse(req.body || {})
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Please review the onboarding details.',
      })
    }

    await startClientOnboarding({
      clientProfileId: req.params.clientId,
      payload: parsed.data,
      actorUserId: req.user.id,
    }, pool)
    const studio = await getScopedStudio(req)
    return res.status(201).json({ ok: true, message: 'Client onboarding started.', ...studio })
  } catch (error) {
    return next(error)
  }
})

router.patch('/clients/:clientId', enforceTeamClientAssignment, async (req, res, next) => {
  try {
    if (!pool) return databaseUnavailable(res)
    const parsed = onboardingUpdateSchema.safeParse(req.body || {})
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Please review the onboarding update.',
      })
    }

    await updateClientOnboarding({
      clientProfileId: req.params.clientId,
      payload: parsed.data,
      actorUserId: req.user.id,
    }, pool)
    const studio = await getScopedStudio(req)
    return res.json({ ok: true, message: 'Client onboarding updated.', ...studio })
  } catch (error) {
    return next(error)
  }
})

router.post('/run-due', requireOnboardingAdministrator, async (req, res, next) => {
  try {
    if (!pool) return databaseUnavailable(res)
    const result = await processDueBookingCommunications({ limit: 50 }, pool)
    const studio = await getScopedStudio(req)
    return res.json({
      ok: true,
      message: `${result.processed || 0} booking communication(s) processed.`,
      processing: result,
      ...studio,
    })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
