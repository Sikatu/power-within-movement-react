const crypto = require('crypto')
const express = require('express')
const bcrypt = require('bcryptjs')
const { z } = require('zod')

const { pool } = require('../db/pool')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const {
  DEFAULT_SETTINGS: FOUNDER_AVAILABILITY_DEFAULTS,
  getFounderAvailabilitySettings,
  zonedDateTimeToUtc: founderZonedDateTimeToUtc,
  addDateKey: addFounderDateKey,
  isRequestedSlotAvailable,
} = require('../services/founderAvailability.service')
const { env } = require('../config/env')
const {
  getPlatformSettings,
  normalizePlatformSettings,
  savePlatformSettings,
} = require('../services/platformSettings.service')
const { publishDueEncouragements } = require('../services/encouragements.service')
const {
  createUniqueCourseSlug,
  getCourseTree,
  listAdminCourses,
  listClientCourses,
} = require('../services/learningLibrary.service')
const {
  createUniqueMembershipSlug,
  getMembershipDetail,
  listAdminMemberships,
  listClientMemberships,
} = require('../services/membershipCircle.service')
const {
  getActiveCircleMemberships,
  getAdminCirclePost,
  listAdminCirclePosts,
} = require('../services/circleCommunity.service')
const {
  getCanonicalRoleForEmail,
  getAccountGovernanceSnapshot,
  reconcileCanonicalAccounts,
  setPermanentAdmin,
  previewSystemAccountCleanup,
  applySystemAccountCleanup,
} = require('../services/accountGovernance.service')
const {
  DEFAULT_EMAIL_CATEGORIES,
  dismissNotification,
  dismissReadNotifications,
  getNotificationPreferences,
  getNotificationSummary,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  saveNotificationPreferences,
} = require('../services/notificationCenter.service')
const {
  ACCESS_LEVELS: TEAM_ACCESS_LEVELS,
  FULL_ACCESS: TEAM_FULL_ACCESS,
  PERMISSION_MODULES: TEAM_PERMISSION_MODULES,
  TEMPLATE_PERMISSIONS: TEAM_TEMPLATE_PERMISSIONS,
  enforceTeamClientAssignment,
  enforceTeamPermission,
  getTeamAccessForUser,
  normalizePermissions: normalizeTeamPermissions,
  permissionsFromRow: teamPermissionsFromRow,
} = require('../services/teamManagement.service')
const {
  clientExists: client360ClientExists,
  createClientCareAction,
  getClient360Snapshot,
  saveClientCarePlan,
  updateClientCareAction,
} = require('../services/client360.service')
const {
  addLeadNote,
  createLeadFollowUp,
  getLeadDetail,
  listLeadPipeline,
  updateLeadFollowUp,
  updateLeadProfile,
} = require('../services/leadPipeline.service')
const { listAttentionQueue } = require('../services/attentionQueue.service')
const { listTeamWorkload } = require('../services/teamWorkload.service')
const { listClientMomentum } = require('../services/clientMomentum.service')
const {
  createEnrollment: createAutomationEnrollment,
  enrollMatchingAutomations,
  listAutomationStudio,
  processDueAutomationEnrollments,
  saveWorkflow: saveAutomationWorkflow,
  updateEnrollmentStatus: updateAutomationEnrollmentStatus,
} = require('../services/automationStudio.service')
const onboardingRouter = require('./onboarding.routes')
const {
  processDueBookingCommunications,
  scheduleBookingCommunications,
  startClientOnboarding: startBookingClientOnboarding,
} = require('../services/bookingOnboarding.service')

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

const requireDeveloper = [
  requireAuth,
  requireRole(['developer']),
]

async function getActiveFounderOwner() {
  if (!pool) return null

  const result = await pool.query(
    `
    SELECT id, email, role, status
    FROM system_users
    WHERE role = 'owner'
      AND status = 'active'
    ORDER BY
      CASE WHEN lower(email) = lower($1) THEN 0 ELSE 1 END,
      created_at ASC
    LIMIT 1
    `,
    [env.canonicalOwnerEmail],
  )

  return result.rows[0] || null
}

const requireFounderAccess = [
  requireAuth,
  async (req, res, next) => {
    if (req.user?.role === 'owner') {
      req.founderOwnerUserId = req.user.id
      req.founderAccessMode = 'owner'
      return next()
    }

    if (req.user?.role === 'developer') {
      try {
        const founderOwner = await getActiveFounderOwner()

        if (!founderOwner) {
          return res.status(409).json({
            ok: false,
            error: 'No active owner account is available for the Founder workspace.',
          })
        }

        req.founderOwnerUserId = founderOwner.id
        req.founderAccessMode = 'developer'
        req.founderOwner = founderOwner
        return next()
      } catch (error) {
        return next(error)
      }
    }

    try {
      if (pool && req.user?.id) {
        await pool.query(
          `
          INSERT INTO audit_logs (
            actor_user_id,
            action,
            entity_type,
            entity_id,
            after_data
          )
          VALUES ($1, 'founders_view_access_denied', 'system_users', $2, $3::jsonb)
          `,
          [
            req.user.id,
            req.user.id,
            JSON.stringify({
              email: req.user.email,
              role: req.user.role,
              method: req.method,
              path: req.originalUrl,
              reason: 'owner_or_developer_role_required',
            }),
          ],
        )
      }
    } catch {
      // Never let audit logging failure expose or unlock Founder access.
    }

    return res.status(403).json({
      ok: false,
      error: 'Founder access requires the owner or developer account.',
    })
  },
]

const clientStatusEnum = ['lead', 'active_client', 'member', 'inactive', 'archived']

const createClientSchema = z.object({
  email: z.string().email(),
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
  clientStatus: z.enum(clientStatusEnum).optional().default('lead'),
  privateAdminNotes: z.string().trim().optional().default(''),
  clientVisibleNotes: z.string().trim().optional().default(''),
})

const updateClientSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
  clientStatus: z.enum(clientStatusEnum),
  privateAdminNotes: z.string().trim().optional().default(''),
  clientVisibleNotes: z.string().trim().optional().default(''),
})

async function getCount(tableName) {
  const allowedTables = new Set([
    'client_profiles',
    'bookings',
    'subscribers',
    'courses',
    'memberships',
    'encouragement_posts',
    'system_users',
  ])

  if (!allowedTables.has(tableName)) {
    throw new Error('Invalid count table.')
  }

  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${tableName}`)
  return result.rows[0]?.count || 0
}


function extractEmailFromPrivateAdminNotes(notes) {
  const match = String(notes || '').match(/(?:^|\n)Email:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)
  return match?.[1] || ''
}

function attachPublicInquiryEmail(client) {
  if (!client) return client

  return {
    ...client,
    email: client.email || extractEmailFromPrivateAdminNotes(client.private_admin_notes),
  }
}

async function getClients(teamUserId = null) {
  const result = await pool.query(
    `
    SELECT
      cp.id,
      cp.first_name,
      cp.last_name,
      cp.phone,
      cp.birthday,
      cp.client_status,

      cp.private_admin_notes,
      cp.public_contact_email,
      cp.lead_interest,
      cp.lead_source,
      cp.inquiry_received_at,cp.intake_completed_at,
      cp.created_at,
      cp.updated_at,
      su.email,
      su.role,
      su.status AS user_status,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', ct.id,
            'name', ct.name
          )
        ) FILTER (WHERE ct.id IS NOT NULL),
        '[]'
      ) AS tags
    FROM client_profiles cp
    LEFT JOIN system_users su
      ON su.id = cp.user_id
    LEFT JOIN client_tag_links ctl
      ON ctl.client_profile_id = cp.id
    LEFT JOIN client_tags ct
      ON ct.id = ctl.client_tag_id
    WHERE (
      $1::uuid IS NULL
      OR EXISTS (
        SELECT 1
        FROM team_client_assignments tca
        WHERE tca.team_user_id = $1
          AND tca.client_profile_id = cp.id
      )
    )
    GROUP BY
      cp.id,
      su.email,
      su.role,
      su.status
    ORDER BY cp.created_at DESC
    LIMIT 100
    `,
    [teamUserId],
  )
  return result.rows.map(attachPublicInquiryEmail)
}

async function getClientById(clientId) {
  const result = await pool.query(
    `
    SELECT
      cp.id,
      cp.user_id,
      cp.first_name,
      cp.last_name,
      cp.phone,
      cp.birthday,
      cp.client_status,
      cp.private_admin_notes,
      cp.public_contact_email,
      cp.lead_interest,
      cp.lead_source,
      cp.inquiry_received_at,
      cp.client_visible_notes,
      cp.intake_completed_at,
      cp.created_at,
      cp.updated_at,
      su.email,
      su.role,
      su.status AS user_status,
      su.last_login_at,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', ct.id,
            'name', ct.name
          )
        ) FILTER (WHERE ct.id IS NOT NULL),
        '[]'
      ) AS tags,
      COALESCE(
        (
          SELECT json_agg(
            jsonb_build_object(
              'id', sr.id,
              'serviceName', sr.service_name,
              'serviceType', sr.service_type,
              'status', sr.status,
              'startedAt', sr.started_at,
              'completedAt', sr.completed_at,
              'notes', sr.notes
            )
            ORDER BY sr.created_at DESC
          )
          FROM service_records sr
          WHERE sr.client_profile_id = cp.id
        ),
        '[]'
      ) AS service_records
    FROM client_profiles cp
    LEFT JOIN system_users su
      ON su.id = cp.user_id
    LEFT JOIN client_tag_links ctl
      ON ctl.client_profile_id = cp.id
    LEFT JOIN client_tags ct
      ON ct.id = ctl.client_tag_id
    WHERE cp.id = $1
    GROUP BY
      cp.id,
      su.email,
      su.role,
      su.status,
      su.last_login_at
    LIMIT 1
    `,
    [clientId],
  )

  return result.rows[0] || null
}

router.get('/overview', requireAdmin, async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const [
      clients,
      bookings,
      subscribers,
      courses,
      memberships,
      encouragements,
      users,
    ] = await Promise.all([
      getCount('client_profiles'),
      getCount('bookings'),
      getCount('subscribers'),
      getCount('courses'),
      getCount('memberships'),
      getCount('encouragement_posts'),
      getCount('system_users'),
    ])

    res.json({
      ok: true,
      overview: {
        clients,
        bookings,
        subscribers,
        courses,
        memberships,
        encouragements,
        users,
      },
    })
  } catch (error) {
    next(error)
  }
})


function extractPublicContactEmailFromNotesV2(notes) {
  const match = String(notes || '').match(/(?:^|\n)Email:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)
  return match?.[1]?.trim() || ''
}

function attachAdminClientDisplayEmailV2(client) {
  if (!client) return client

  const noteEmail = extractPublicContactEmailFromNotesV2(
    client.private_admin_notes || client.privateAdminNotes || client.privateAdminNotes || client.private_admin_notes || '',
  )

  return {
    ...client,
    email: client.email || client.client_email || client.public_contact_email || noteEmail || '',
    public_contact_email: noteEmail,
  }
}

router.get('/clients', requireAdmin, async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

        const clients = (await getClients(req.user.role === 'staff' ? req.user.id : null))
      .map(attachAdminClientDisplayEmailV2)

    res.json({
      ok: true,
      clients,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/clients/:clientId', requireAdmin, async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const client = await getClientById(req.params.clientId)

    if (!client) {
      return res.status(404).json({
        ok: false,
        error: 'Client profile not found.',
      })
    }

    res.json({
      ok: true,
      client,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/clients', requireAdmin, async (req, res, next) => {
  const dbClient = await pool.connect()

  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const parsed = createClientSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Invalid client details.',
      })
    }

    const input = parsed.data
    const email = input.email.toLowerCase()
    const temporaryPassword = crypto.randomBytes(24).toString('hex')
    const passwordHash = await bcrypt.hash(temporaryPassword, 12)

    await dbClient.query('BEGIN')

    const insertedUser = await dbClient.query(
      `
      INSERT INTO system_users (
        email,
        password_hash,
        role,
        status
      )
      VALUES ($1, $2, 'client', 'invited')
      ON CONFLICT (email)
      DO UPDATE SET
        role = CASE
          WHEN system_users.role IN ('developer', 'owner', 'admin', 'staff') THEN system_users.role
          ELSE 'client'
        END,
        updated_at = now()
      RETURNING id, email, role, status
      `,
      [email, passwordHash],
    )

    const user = insertedUser.rows[0]

    const insertedProfile = await dbClient.query(
      `
      INSERT INTO client_profiles (
        user_id,
        first_name,
        last_name,
        phone,
        client_status,
        private_admin_notes,
        client_visible_notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id)
      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone,
        client_status = EXCLUDED.client_status,
        private_admin_notes = EXCLUDED.private_admin_notes,
        client_visible_notes = EXCLUDED.client_visible_notes,
        updated_at = now()
      RETURNING *
      `,
      [
        user.id,
        input.firstName,
        input.lastName,
        input.phone,
        input.clientStatus,
        input.privateAdminNotes,
        input.clientVisibleNotes,
      ],
    )

    const profile = insertedProfile.rows[0]

    if (req.user.role === 'staff') {
      await dbClient.query(
        `
        INSERT INTO team_client_assignments (
          team_user_id,
          client_profile_id,
          assignment_role,
          assigned_by_user_id
        )
        VALUES ($1, $2, 'primary', $1)
        ON CONFLICT (team_user_id, client_profile_id) DO NOTHING
        `,
        [req.user.id, profile.id],
      )
    }

    await dbClient.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_data
      )
      VALUES ($1, 'client_profile_created_or_updated', 'client_profiles', $2, $3::jsonb)
      `,
      [
        req.user.id,
        profile.id,
        JSON.stringify({
          email: user.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          clientStatus: profile.client_status,
        }),
      ],
    )

    await dbClient.query('COMMIT')

    if (profile.client_status === 'lead') {
      try {
        await enrollMatchingAutomations({
          clientProfileId: profile.id,
          triggerType: 'new_lead',
          triggerStage: profile.pipeline_stage || 'new_inquiry',
          actorUserId: req.user.id,
        })
      } catch (automationError) {
        console.error('Admin-created lead automation enrollment failed:', automationError.message)
      }
    }

    const clients = await getClients(req.user.role === 'staff' ? req.user.id : null)
    const client = await getClientById(profile.id)

    res.status(201).json({
      ok: true,
      message: 'Client profile saved.',
      client,
      clients,
    })
  } catch (error) {
    await dbClient.query('ROLLBACK')
    next(error)
  } finally {
    dbClient.release()
  }
})

router.patch('/clients/:clientId', requireAdmin, async (req, res, next) => {
  const dbClient = await pool.connect()

  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const existingClient = await getClientById(req.params.clientId)

    if (!existingClient) {
      return res.status(404).json({
        ok: false,
        error: 'Client profile not found.',
      })
    }

    const parsed = updateClientSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Invalid client details.',
      })
    }

    const input = parsed.data

    await dbClient.query('BEGIN')

    const updated = await dbClient.query(
      `
      UPDATE client_profiles
      SET
        first_name = $1,
        last_name = $2,
        phone = $3,
        client_status = $4,
        private_admin_notes = $5,
        client_visible_notes = $6,
        updated_at = now()
      WHERE id = $7
      RETURNING *
      `,
      [
        input.firstName,
        input.lastName,
        input.phone,
        input.clientStatus,
        input.privateAdminNotes,
        input.clientVisibleNotes,
        req.params.clientId,
      ],
    )

    const profile = updated.rows[0]

    await dbClient.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'client_profile_updated', 'client_profiles', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        profile.id,
        JSON.stringify({
          firstName: existingClient.first_name,
          lastName: existingClient.last_name,
          phone: existingClient.phone,
          clientStatus: existingClient.client_status,
        }),
        JSON.stringify({
          firstName: profile.first_name,
          lastName: profile.last_name,
          phone: profile.phone,
          clientStatus: profile.client_status,
        }),
      ],
    )

    await dbClient.query('COMMIT')

    const client = await getClientById(profile.id)
    const clients = await getClients(req.user.role === 'staff' ? req.user.id : null)

    res.json({
      ok: true,
      message: 'Client profile updated.',
      client,
      clients,
    })
  } catch (error) {
    await dbClient.query('ROLLBACK')
    next(error)
  } finally {
    dbClient.release()
  }
})


router.get('/audit-logs', requireAdmin, async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const result = await pool.query(
      `
      SELECT
        al.id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.before_data,
        al.after_data,
        al.ip_address,
        al.user_agent,
        al.created_at,
        su.email AS actor_email,
        su.role AS actor_role
      FROM audit_logs al
      LEFT JOIN system_users su
        ON su.id = al.actor_user_id
      ORDER BY al.created_at DESC
      LIMIT 150
      `,
    )

    res.json({
      ok: true,
      auditLogs: result.rows,
    })
  } catch (error) {
    next(error)
  }
})


const appointmentTypeSchema = z.object({
  name: z.string().trim().min(1, 'Appointment name is required.'),
  description: z.string().trim().optional().default(''),
  durationMinutes: z.coerce.number().int().min(15).max(480),
  priceCents: z.coerce.number().int().min(0).optional().default(0),
  currency: z.string().trim().min(3).max(3).optional().default('USD'),
  requiresApproval: z.boolean().optional().default(true),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(180).optional().default(0),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(180).optional().default(0),
  isActive: z.boolean().optional().default(true),
})

function slugifyAppointmentType(value) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || `appointment-${Date.now()}`
}

async function getAppointmentTypes() {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      slug,
      description,
      duration_minutes,
      price_cents,
      currency,
      is_active,
      requires_approval,
      buffer_before_minutes,
      buffer_after_minutes,
      created_at,
      updated_at
    FROM appointment_types
    ORDER BY created_at DESC
    LIMIT 100
    `,
  )

  return result.rows
}

router.get('/appointment-types', requireAdmin, async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const appointmentTypes = await getAppointmentTypes()

    res.json({
      ok: true,
      appointmentTypes,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/appointment-types', requireAdmin, async (req, res, next) => {
  const dbClient = await pool.connect()

  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const parsed = appointmentTypeSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Invalid appointment type details.',
      })
    }

    const input = parsed.data
    const slugBase = slugifyAppointmentType(input.name)
    let slug = slugBase
    let suffix = 1

    while (true) {
      const existing = await dbClient.query(
        'SELECT id FROM appointment_types WHERE slug = $1 LIMIT 1',
        [slug],
      )

      if (existing.rows.length === 0) break

      suffix += 1
      slug = `${slugBase}-${suffix}`
    }

    await dbClient.query('BEGIN')

    const inserted = await dbClient.query(
      `
      INSERT INTO appointment_types (
        name,
        slug,
        description,
        duration_minutes,
        price_cents,
        currency,
        requires_approval,
        buffer_before_minutes,
        buffer_after_minutes,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        input.name,
        slug,
        input.description,
        input.durationMinutes,
        input.priceCents,
        input.currency.toUpperCase(),
        input.requiresApproval,
        input.bufferBeforeMinutes,
        input.bufferAfterMinutes,
        input.isActive,
      ],
    )

    const appointmentType = inserted.rows[0]

    await dbClient.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_data
      )
      VALUES ($1, 'appointment_type_created', 'appointment_types', $2, $3::jsonb)
      `,
      [
        req.user.id,
        appointmentType.id,
        JSON.stringify({
          name: appointmentType.name,
          durationMinutes: appointmentType.duration_minutes,
          priceCents: appointmentType.price_cents,
          requiresApproval: appointmentType.requires_approval,
          isActive: appointmentType.is_active,
        }),
      ],
    )

    await dbClient.query('COMMIT')

    const appointmentTypes = await getAppointmentTypes()

    res.status(201).json({
      ok: true,
      message: 'Appointment type created.',
      appointmentType,
      appointmentTypes,
    })
  } catch (error) {
    await dbClient.query('ROLLBACK')
    next(error)
  } finally {
    dbClient.release()
  }
})

router.patch('/appointment-types/:appointmentTypeId', requireAdmin, async (req, res, next) => {
  const dbClient = await pool.connect()

  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const parsed = appointmentTypeSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Invalid appointment type details.',
      })
    }

    const existing = await dbClient.query(
      'SELECT * FROM appointment_types WHERE id = $1 LIMIT 1',
      [req.params.appointmentTypeId],
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Appointment type not found.',
      })
    }

    const input = parsed.data

    await dbClient.query('BEGIN')

    const updated = await dbClient.query(
      `
      UPDATE appointment_types
      SET
        name = $1,
        description = $2,
        duration_minutes = $3,
        price_cents = $4,
        currency = $5,
        requires_approval = $6,
        buffer_before_minutes = $7,
        buffer_after_minutes = $8,
        is_active = $9,
        updated_at = now()
      WHERE id = $10
      RETURNING *
      `,
      [
        input.name,
        input.description,
        input.durationMinutes,
        input.priceCents,
        input.currency.toUpperCase(),
        input.requiresApproval,
        input.bufferBeforeMinutes,
        input.bufferAfterMinutes,
        input.isActive,
        req.params.appointmentTypeId,
      ],
    )

    const appointmentType = updated.rows[0]

    await dbClient.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'appointment_type_updated', 'appointment_types', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        appointmentType.id,
        JSON.stringify({
          name: existing.rows[0].name,
          durationMinutes: existing.rows[0].duration_minutes,
          priceCents: existing.rows[0].price_cents,
          requiresApproval: existing.rows[0].requires_approval,
          isActive: existing.rows[0].is_active,
        }),
        JSON.stringify({
          name: appointmentType.name,
          durationMinutes: appointmentType.duration_minutes,
          priceCents: appointmentType.price_cents,
          requiresApproval: appointmentType.requires_approval,
          isActive: appointmentType.is_active,
        }),
      ],
    )

    await dbClient.query('COMMIT')

    const appointmentTypes = await getAppointmentTypes()

    res.json({
      ok: true,
      message: 'Appointment type updated.',
      appointmentType,
      appointmentTypes,
    })
  } catch (error) {
    await dbClient.query('ROLLBACK')
    next(error)
  } finally {
    dbClient.release()
  }
})


const availabilityBlockSchema = z
  .object({
    weekday: z.union([z.coerce.number().int().min(0).max(6), z.null()]).optional().default(1),
    specificDate: z.string().trim().optional().nullable().transform((value) => value || null),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must use HH:MM format.'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must use HH:MM format.'),
    timezone: z.string().trim().min(1).optional().default('America/New_York'),
    isActive: z.boolean().optional().default(true),
    notes: z.string().trim().optional().default(''),
  })
  .refine((data) => data.specificDate || data.weekday !== null, {
    message: 'Choose a weekday or a specific date.',
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'End time must be later than start time.',
  })

async function getAvailabilityBlocks() {
  const result = await pool.query(
    `
    SELECT
      id,
      owner_user_id,
      weekday,
      specific_date,
      start_time,
      end_time,
      timezone,
      is_active,
      notes,
      created_at,
      updated_at
    FROM availability_blocks
    ORDER BY
      specific_date NULLS LAST,
      weekday NULLS LAST,
      start_time ASC
    LIMIT 150
    `,
  )

  return result.rows
}

router.get('/availability-blocks', requireAdmin, async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const availabilityBlocks = await getAvailabilityBlocks()

    res.json({
      ok: true,
      availabilityBlocks,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/availability-blocks', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  const dbClient = await pool.connect()

  try {
    const parsed = availabilityBlockSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Invalid availability details.',
      })
    }

    const input = parsed.data

    await dbClient.query('BEGIN')

    const inserted = await dbClient.query(
      `
      INSERT INTO availability_blocks (
        owner_user_id,
        weekday,
        specific_date,
        start_time,
        end_time,
        timezone,
        is_active,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        req.user.id,
        input.specificDate ? null : input.weekday,
        input.specificDate,
        input.startTime,
        input.endTime,
        input.timezone,
        input.isActive,
        input.notes,
      ],
    )

    const availabilityBlock = inserted.rows[0]

    await dbClient.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_data
      )
      VALUES ($1, 'availability_block_created', 'availability_blocks', $2, $3::jsonb)
      `,
      [
        req.user.id,
        availabilityBlock.id,
        JSON.stringify({
          weekday: availabilityBlock.weekday,
          specificDate: availabilityBlock.specific_date,
          startTime: availabilityBlock.start_time,
          endTime: availabilityBlock.end_time,
          timezone: availabilityBlock.timezone,
          isActive: availabilityBlock.is_active,
        }),
      ],
    )

    await dbClient.query('COMMIT')

    const availabilityBlocks = await getAvailabilityBlocks()

    res.status(201).json({
      ok: true,
      message: 'Availability block created.',
      availabilityBlock,
      availabilityBlocks,
    })
  } catch (error) {
    await dbClient.query('ROLLBACK')
    next(error)
  } finally {
    dbClient.release()
  }
})

router.patch('/availability-blocks/:availabilityBlockId', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  const dbClient = await pool.connect()

  try {
    const parsed = availabilityBlockSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Invalid availability details.',
      })
    }

    const existing = await dbClient.query(
      'SELECT * FROM availability_blocks WHERE id = $1 LIMIT 1',
      [req.params.availabilityBlockId],
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Availability block not found.',
      })
    }

    const input = parsed.data

    await dbClient.query('BEGIN')

    const updated = await dbClient.query(
      `
      UPDATE availability_blocks
      SET
        weekday = $1,
        specific_date = $2,
        start_time = $3,
        end_time = $4,
        timezone = $5,
        is_active = $6,
        notes = $7,
        updated_at = now()
      WHERE id = $8
      RETURNING *
      `,
      [
        input.specificDate ? null : input.weekday,
        input.specificDate,
        input.startTime,
        input.endTime,
        input.timezone,
        input.isActive,
        input.notes,
        req.params.availabilityBlockId,
      ],
    )

    const availabilityBlock = updated.rows[0]

    await dbClient.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'availability_block_updated', 'availability_blocks', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        availabilityBlock.id,
        JSON.stringify({
          weekday: existing.rows[0].weekday,
          specificDate: existing.rows[0].specific_date,
          startTime: existing.rows[0].start_time,
          endTime: existing.rows[0].end_time,
          timezone: existing.rows[0].timezone,
          isActive: existing.rows[0].is_active,
        }),
        JSON.stringify({
          weekday: availabilityBlock.weekday,
          specificDate: availabilityBlock.specific_date,
          startTime: availabilityBlock.start_time,
          endTime: availabilityBlock.end_time,
          timezone: availabilityBlock.timezone,
          isActive: availabilityBlock.is_active,
        }),
      ],
    )

    await dbClient.query('COMMIT')

    const availabilityBlocks = await getAvailabilityBlocks()

    res.json({
      ok: true,
      message: 'Availability block updated.',
      availabilityBlock,
      availabilityBlocks,
    })
  } catch (error) {
    await dbClient.query('ROLLBACK')
    next(error)
  } finally {
    dbClient.release()
  }
})


const bookingStatusSchema = z.object({
  status: z.enum(['requested', 'approved', 'confirmed', 'completed', 'cancelled', 'no_show']),
  adminNotes: z.string().trim().optional().default(''),
})

async function getBookings() {
  const result = await pool.query(
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
      b.created_at,
      b.updated_at,
      at.name AS appointment_type_name,
      at.duration_minutes,
      cp.first_name AS client_first_name,
      cp.last_name AS client_last_name
    FROM bookings b
    LEFT JOIN appointment_types at
      ON at.id = b.appointment_type_id
    LEFT JOIN client_profiles cp
      ON cp.id = b.client_profile_id
    ORDER BY b.starts_at DESC
    LIMIT 150
    `,
  )

  return result.rows
}


const bookingChangeDecisionSchema = z.object({
  decision: z.enum(['approved', 'declined']),
  reviewerNotes: z.string().trim().max(2000).optional().default(''),
})

async function getSessionChangeRequests() {
  const result = await pool.query(
    `
    SELECT
      request.id,
      request.booking_id,
      request.client_profile_id,
      request.request_type,
      request.requested_starts_at,
      request.requested_ends_at,
      request.reason,
      request.status,
      request.reviewer_notes,
      request.reviewed_at,
      request.created_at,
      request.updated_at,
      booking.status AS booking_status,
      booking.starts_at AS current_starts_at,
      booking.ends_at AS current_ends_at,
      booking.timezone,
      appointment.name AS appointment_type_name,
      profile.first_name AS client_first_name,
      profile.last_name AS client_last_name,
      account.email AS client_email,
      reviewer.email AS reviewer_email
    FROM booking_change_requests request
    INNER JOIN bookings booking ON booking.id = request.booking_id
    LEFT JOIN appointment_types appointment ON appointment.id = booking.appointment_type_id
    INNER JOIN client_profiles profile ON profile.id = request.client_profile_id
    LEFT JOIN system_users account ON account.id = profile.user_id
    LEFT JOIN system_users reviewer ON reviewer.id = request.reviewer_user_id
    ORDER BY
      CASE WHEN request.status = 'pending' THEN 0 ELSE 1 END,
      request.created_at DESC
    LIMIT 250
    `,
  )

  return result.rows
}

router.get('/session-change-requests', requireAdmin, async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({ ok: false, error: 'Database is not configured.' })
    }

    const requests = await getSessionChangeRequests()

    return res.json({
      ok: true,
      requests,
      pendingCount: requests.filter((request) => request.status === 'pending').length,
    })
  } catch (error) {
    return next(error)
  }
})

router.patch(
  '/session-change-requests/:requestId',
  requireAdmin,
  async (req, res, next) => {
    if (!pool) {
      return res.status(503).json({ ok: false, error: 'Database is not configured.' })
    }

    const parsed = bookingChangeDecisionSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Invalid review decision.',
      })
    }

    const dbClient = await pool.connect()

    try {
      const requestResult = await dbClient.query(
        `
        SELECT
          request.*,
          booking.appointment_type_id,
          booking.status AS booking_status,
          booking.starts_at AS current_starts_at,
          booking.ends_at AS current_ends_at,
          appointment.name AS appointment_type_name,
          appointment.duration_minutes,
          appointment.buffer_before_minutes,
          appointment.buffer_after_minutes,
          appointment.is_active
        FROM booking_change_requests request
        INNER JOIN bookings booking ON booking.id = request.booking_id
        LEFT JOIN appointment_types appointment ON appointment.id = booking.appointment_type_id
        WHERE request.id = $1
        LIMIT 1
        `,
        [req.params.requestId],
      )
      const changeRequest = requestResult.rows[0]

      if (!changeRequest) {
        return res.status(404).json({ ok: false, error: 'Session change request not found.' })
      }

      if (changeRequest.status !== 'pending') {
        return res.status(409).json({
          ok: false,
          error: 'This session change request has already been reviewed.',
        })
      }

      const input = parsed.data

      if (input.decision === 'approved' && changeRequest.request_type === 'reschedule') {
        if (!changeRequest.appointment_type_id || !changeRequest.is_active) {
          return res.status(409).json({
            ok: false,
            error: 'The linked session type is not currently available.',
          })
        }

        const requestedStart = new Date(changeRequest.requested_starts_at)
        const availability = await isRequestedSlotAvailable({
          pool,
          appointmentType: changeRequest,
          startsAt: requestedStart,
        })

        if (!availability.available) {
          return res.status(409).json({
            ok: false,
            availabilityBlocked: true,
            error: 'The requested replacement time is no longer available.',
          })
        }
      }

      await dbClient.query('BEGIN')

      const beforeBooking = {
        status: changeRequest.booking_status,
        startsAt: changeRequest.current_starts_at,
        endsAt: changeRequest.current_ends_at,
      }

      if (input.decision === 'approved' && changeRequest.request_type === 'cancel') {
        await dbClient.query(
          `
          UPDATE bookings
          SET status = 'cancelled',
              cancellation_reason = $1,
              updated_at = now()
          WHERE id = $2
          `,
          [changeRequest.reason, changeRequest.booking_id],
        )
      }

      if (input.decision === 'approved' && changeRequest.request_type === 'reschedule') {
        await dbClient.query(
          `
          UPDATE bookings
          SET starts_at = $1,
              ends_at = $2,
              updated_at = now()
          WHERE id = $3
          `,
          [
            changeRequest.requested_starts_at,
            changeRequest.requested_ends_at,
            changeRequest.booking_id,
          ],
        )
      }

      const reviewed = await dbClient.query(
        `
        UPDATE booking_change_requests
        SET status = $1,
            reviewer_user_id = $2,
            reviewer_notes = $3,
            reviewed_at = now(),
            updated_at = now()
        WHERE id = $4
        RETURNING *
        `,
        [input.decision, req.user.id, input.reviewerNotes, changeRequest.id],
      )

      const updatedBookingResult = await dbClient.query(
        'SELECT * FROM bookings WHERE id = $1 LIMIT 1',
        [changeRequest.booking_id],
      )
      const updatedBooking = updatedBookingResult.rows[0]

      await dbClient.query(
        `
        INSERT INTO audit_logs (
          actor_user_id,
          action,
          entity_type,
          entity_id,
          before_data,
          after_data
        )
        VALUES ($1, 'session_change_request_reviewed', 'booking_change_requests', $2, $3::jsonb, $4::jsonb)
        `,
        [
          req.user.id,
          changeRequest.id,
          JSON.stringify({ request: changeRequest, booking: beforeBooking }),
          JSON.stringify({ request: reviewed.rows[0], booking: updatedBooking }),
        ],
      )

      await dbClient.query('COMMIT')

      return res.json({
        ok: true,
        message: input.decision === 'approved'
          ? 'The client’s session request was approved.'
          : 'The client’s session request was declined.',
        request: reviewed.rows[0],
        booking: updatedBooking,
        requests: await getSessionChangeRequests(),
      })
    } catch (error) {
      try {
        await dbClient.query('ROLLBACK')
      } catch {
        // Preserve the original transaction error.
      }
      return next(error)
    } finally {
      dbClient.release()
    }
  },
)

// client-session-self-service-pass-21-admin-end

router.get('/bookings', requireAdmin, async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const bookings = await getBookings()

    res.json({
      ok: true,
      bookings,
    })
  } catch (error) {
    next(error)
  }
})

router.patch('/bookings/:bookingId/status', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  const dbClient = await pool.connect()

  try {
    const parsed = bookingStatusSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Invalid booking status.',
      })
    }

    const existing = await dbClient.query(
      'SELECT * FROM bookings WHERE id = $1 LIMIT 1',
      [req.params.bookingId],
    )

    if (existing.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'Booking not found.',
      })
    }

    const input = parsed.data

    await dbClient.query('BEGIN')

    const updated = await dbClient.query(
      `
      UPDATE bookings
      SET
        status = $1,
        admin_notes = $2,
        updated_at = now()
      WHERE id = $3
      RETURNING *
      `,
      [
        input.status,
        input.adminNotes,
        req.params.bookingId,
      ],
    )

    const booking = updated.rows[0]

    await dbClient.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'booking_status_updated', 'bookings', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        booking.id,
        JSON.stringify({
          status: existing.rows[0].status,
          adminNotes: existing.rows[0].admin_notes,
        }),
        JSON.stringify({
          status: booking.status,
          adminNotes: booking.admin_notes,
        }),
      ],
    )

    await dbClient.query('COMMIT')

    try {
      await scheduleBookingCommunications(booking.id, { status: booking.status }, pool)

      if (['approved', 'confirmed'].includes(booking.status) && booking.client_profile_id) {
        const onboardingResult = await pool.query(
          `
          SELECT
            at.onboarding_template_id,
            at.auto_start_onboarding
          FROM bookings b
          LEFT JOIN appointment_types at ON at.id = b.appointment_type_id
          WHERE b.id = $1
          LIMIT 1
          `,
          [booking.id],
        )
        const onboarding = onboardingResult.rows[0]

        if (onboarding?.auto_start_onboarding && onboarding?.onboarding_template_id) {
          await startBookingClientOnboarding({
            clientProfileId: booking.client_profile_id,
            payload: {
              templateId: onboarding.onboarding_template_id,
              assignedToUserId: req.user.id,
              clientWelcomeMessage: 'Welcome to your private onboarding space. Complete the intake when you are ready.',
            },
            actorUserId: req.user.id,
          }, pool)
        }
      }

      await processDueBookingCommunications({ bookingId: booking.id }, pool)
    } catch (automationError) {
      console.error('Booking onboarding automation failed:', automationError.message)
    }

    const bookings = await getBookings()

    res.json({
      ok: true,
      message: 'Booking status updated.',
      booking,
      bookings,
    })
  } catch (error) {
    await dbClient.query('ROLLBACK')
    next(error)
  } finally {
    dbClient.release()
  }
})


// welcome-client-profile-v1-start
function splitGuestNameForClientProfile(fullName) {
  const cleanName = String(fullName || '').trim()

  if (!cleanName) {
    return {
      firstName: '',
      lastName: '',
    }
  }

  const parts = cleanName.split(/\s+/)

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: '',
    }
  }

  const lastName = parts.pop()

  return {
    firstName: parts.join(' '),
    lastName,
  }
}

function buildClientProfileWelcomeNote(booking) {
  const intake = booking.intake_answers || {}

  return [
    'Welcomed into the Client Circle from a session request.',
    booking.appointment_type_name ? `Session: ${booking.appointment_type_name}` : '',
    booking.starts_at ? `Preferred time: ${booking.starts_at}` : '',
    intake.reason ? `Support requested: ${intake.reason}` : '',
    intake.preferredFocus ? `Preferred focus: ${intake.preferredFocus}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

router.post('/bookings/:bookingId/welcome-client-profile', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  const dbClient = await pool.connect()

  try {
    await dbClient.query('BEGIN')

    const bookingResult = await dbClient.query(
      `
      SELECT
        b.*,
        at.name AS appointment_type_name
      FROM bookings b
      LEFT JOIN appointment_types at
        ON at.id = b.appointment_type_id
      WHERE b.id = $1
      LIMIT 1
      `,
      [req.params.bookingId],
    )

    const booking = bookingResult.rows[0]

    if (!booking) {
      await dbClient.query('ROLLBACK')

      return res.status(404).json({
        ok: false,
        error: 'Session request not found.',
      })
    }

    if (!booking.guest_email) {
      await dbClient.query('ROLLBACK')

      return res.status(400).json({
        ok: false,
        error: 'This session request does not have an email address.',
      })
    }

    const guestEmail = String(booking.guest_email).trim().toLowerCase()
    const { firstName, lastName } = splitGuestNameForClientProfile(booking.guest_name)
    const welcomeNote = buildClientProfileWelcomeNote(booking)

    const existingUserResult = await dbClient.query(
      `
      SELECT *
      FROM system_users
      WHERE lower(email::text) = lower($1)
      LIMIT 1
      `,
      [guestEmail],
    )

    let systemUser = existingUserResult.rows[0]

    if (!systemUser) {
      const bcrypt = require('bcryptjs')
      const crypto = require('crypto')
      const invitationPasswordHash = await bcrypt.hash(crypto.randomUUID(), 12)

      const insertedUserResult = await dbClient.query(
        `
        INSERT INTO system_users (
          email,
          password_hash,
          role,
          status
        )
        VALUES ($1, $2, 'client', 'invited')
        RETURNING *
        `,
        [guestEmail, invitationPasswordHash],
      )

      systemUser = insertedUserResult.rows[0]
    } else {
      const updatedUserResult = await dbClient.query(
        `
        UPDATE system_users
        SET
          status = CASE
            WHEN status IS NULL OR status = '' THEN 'invited'
            ELSE status
          END,
          updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [systemUser.id],
      )

      systemUser = updatedUserResult.rows[0]
    }

    const existingClientResult = await dbClient.query(
      `
      SELECT *
      FROM client_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [systemUser.id],
    )

    let clientProfile

    if (existingClientResult.rows[0]) {
      const updatedClientResult = await dbClient.query(
        `
        UPDATE client_profiles
        SET
          first_name = COALESCE(NULLIF($1, ''), first_name),
          last_name = COALESCE(NULLIF($2, ''), last_name),
          phone = COALESCE(NULLIF($3, ''), phone),
          client_status = COALESCE(NULLIF(client_status, ''), 'lead'),
          private_admin_notes = CASE
            WHEN private_admin_notes IS NULL OR trim(private_admin_notes) = '' THEN $4
            ELSE private_admin_notes || E'\n\n' || $4
          END,
          updated_at = now()
        WHERE id = $5
        RETURNING *
        `,
        [
          firstName,
          lastName,
          booking.guest_phone || '',
          welcomeNote,
          existingClientResult.rows[0].id,
        ],
      )

      clientProfile = updatedClientResult.rows[0]
    } else {
      const insertedClientResult = await dbClient.query(
        `
        INSERT INTO client_profiles (
          user_id,
          first_name,
          last_name,
          phone,
          client_status,
          private_admin_notes,
          client_visible_notes
        )
        VALUES ($1, $2, $3, $4, 'lead', $5, '')
        RETURNING *
        `,
        [
          systemUser.id,
          firstName,
          lastName,
          booking.guest_phone || '',
          welcomeNote,
        ],
      )

      clientProfile = insertedClientResult.rows[0]
    }

    const updatedBookingResult = await dbClient.query(
      `
      UPDATE bookings
      SET
        client_profile_id = $1,
        status = CASE
          WHEN status = 'requested' THEN 'approved'
          ELSE status
        END,
        admin_notes = CASE
          WHEN admin_notes IS NULL OR trim(admin_notes) = '' THEN 'Welcomed into the Client Circle.'
          WHEN admin_notes NOT ILIKE '%Welcomed into the Client Circle.%' THEN admin_notes || E'\n\nWelcomed into the Client Circle.'
          ELSE admin_notes
        END,
        updated_at = now()
      WHERE id = $2
      RETURNING *
      `,
      [clientProfile.id, booking.id],
    )

    const updatedBooking = updatedBookingResult.rows[0]

    await dbClient.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'booking_welcomed_to_client_circle', 'bookings', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        booking.id,
        JSON.stringify({
          bookingId: booking.id,
          clientProfileId: booking.client_profile_id,
          status: booking.status,
        }),
        JSON.stringify({
          bookingId: updatedBooking.id,
          clientProfileId: clientProfile.id,
          clientEmail: systemUser.email,
          status: updatedBooking.status,
        }),
      ],
    )

    await dbClient.query('COMMIT')

    const bookings = await getBookings()

    return res.json({
      ok: true,
      message: 'Welcomed into the Client Circle.',
      systemUser,
      clientProfile: {
        ...clientProfile,
        email: systemUser.email,
      },
      booking: {
        ...updatedBooking,
        client_profile_id: clientProfile.id,
        appointment_type_name: booking.appointment_type_name,
      },
      bookings,
    })
  } catch (error) {
    await dbClient.query('ROLLBACK')
    return next(error)
  } finally {
    dbClient.release()
  }
})
// welcome-client-profile-v1-end

// phase-3-6-client-care-timeline-start
async function adminTableExists(tableName) {
  const result = await pool.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    ) AS exists
    `,
    [tableName],
  )

  return Boolean(result.rows[0]?.exists)
}

function formatTimelineDateValue(value) {
  if (!value) return null

  try {
    return new Date(value).toISOString()
  } catch {
    return null
  }
}

function createTimelineItem({
  id,
  type,
  title,
  description,
  timestamp,
  status,
  meta,
}) {
  return {
    id,
    type,
    title,
    description,
    timestamp: formatTimelineDateValue(timestamp),
    status: status || null,
    meta: meta || {},
  }
}

router.get('/clients/:clientId/care-timeline', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const { clientId } = req.params

    const clientResult = await pool.query(
      `
      SELECT
        cp.*,
        su.email,
        su.role AS user_role,
        su.status AS portal_status,
        su.created_at AS user_created_at,
        su.updated_at AS user_updated_at
      FROM client_profiles cp
      LEFT JOIN system_users su
        ON su.id = cp.user_id
      WHERE cp.id = $1
      LIMIT 1
      `,
      [clientId],
    )

    const client = clientResult.rows[0]

    if (!client) {
      return res.status(404).json({
        ok: false,
        error: 'Client profile not found.',
      })
    }

    const bookingsResult = await pool.query(
      `
      SELECT
        b.*,
        at.name AS appointment_type_name,
        at.duration_minutes AS appointment_duration_minutes
      FROM bookings b
      LEFT JOIN appointment_types at
        ON at.id = b.appointment_type_id
      WHERE b.client_profile_id = $1
      ORDER BY b.starts_at DESC, b.created_at DESC
      LIMIT 25
      `,
      [clientId],
    )

    const auditResult = await pool.query(
      `
      SELECT
        al.*,
        su.email AS actor_email,
        su.role AS actor_role
      FROM audit_logs al
      LEFT JOIN system_users su
        ON su.id = al.actor_user_id
      WHERE
        al.entity_id::text = $1
        OR al.before_data ->> 'clientProfileId' = $1
        OR al.after_data ->> 'clientProfileId' = $1
      ORDER BY al.created_at DESC
      LIMIT 40
      `,
      [clientId],
    )

    let serviceRecords = []

    if (await adminTableExists('service_records')) {
      const serviceResult = await pool.query(
        `
        SELECT *
        FROM service_records
        WHERE client_profile_id = $1
        ORDER BY created_at DESC
        LIMIT 25
        `,
        [clientId],
      )

      serviceRecords = serviceResult.rows
    }

    const timeline = []

    timeline.push(
      createTimelineItem({
        id: `client-created-${client.id}`,
        type: 'client_profile',
        title: 'Client profile created',
        description: 'This person entered the Client Circle.',
        timestamp: client.created_at,
        status: client.client_status,
        meta: {
          clientProfileId: client.id,
          email: client.email,
        },
      }),
    )

    if (client.updated_at && String(client.updated_at) !== String(client.created_at)) {
      timeline.push(
        createTimelineItem({
          id: `client-updated-${client.id}`,
          type: 'client_profile',
          title: 'Client profile updated',
          description: 'Profile details, notes, or access information were updated.',
          timestamp: client.updated_at,
          status: client.client_status,
          meta: {
            clientProfileId: client.id,
          },
        }),
      )
    }

    for (const booking of bookingsResult.rows) {
      timeline.push(
        createTimelineItem({
          id: `booking-${booking.id}`,
          type: 'booking',
          title: booking.appointment_type_name || 'Session request',
          description: booking.intake_answers?.reason || 'Session request connected to this client.',
          timestamp: booking.starts_at || booking.created_at,
          status: booking.status,
          meta: {
            bookingId: booking.id,
            startsAt: booking.starts_at,
            endsAt: booking.ends_at,
            timezone: booking.timezone,
            preferredFocus: booking.intake_answers?.preferredFocus || null,
          },
        }),
      )
    }

    for (const serviceRecord of serviceRecords) {
      timeline.push(
        createTimelineItem({
          id: `service-${serviceRecord.id}`,
          type: 'service_record',
          title: serviceRecord.title || serviceRecord.service_name || 'Service record',
          description: serviceRecord.notes || serviceRecord.description || 'Service record saved for this client.',
          timestamp: serviceRecord.service_date || serviceRecord.created_at,
          status: serviceRecord.status || null,
          meta: serviceRecord,
        }),
      )
    }

    for (const auditLog of auditResult.rows) {
      timeline.push(
        createTimelineItem({
          id: `audit-${auditLog.id}`,
          type: 'audit_log',
          title: String(auditLog.action || 'Activity').replaceAll('_', ' '),
          description: auditLog.actor_email
            ? `Updated by ${auditLog.actor_email}`
            : 'Studio activity recorded.',
          timestamp: auditLog.created_at,
          status: auditLog.actor_role || null,
          meta: {
            auditLogId: auditLog.id,
            action: auditLog.action,
            entityType: auditLog.entity_type,
            actorEmail: auditLog.actor_email,
            beforeData: auditLog.before_data,
            afterData: auditLog.after_data,
          },
        }),
      )
    }

    timeline.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0

      return bTime - aTime
    })

    return res.json({
      ok: true,
      client: {
        ...client,
        firstName: client.first_name,
        lastName: client.last_name,
        clientStatus: client.client_status,
        portalStatus: client.portal_status,
        privateAdminNotes: client.private_admin_notes,
        clientVisibleNotes: client.client_visible_notes,
      },
      bookings: bookingsResult.rows,
      serviceRecords,
      auditLogs: auditResult.rows,
      timeline,
    })
  } catch (error) {
    return next(error)
  }
})
// phase-3-6-client-care-timeline-end

// phase-3-7-service-records-start
function cleanServiceText(value) {
  return String(value || '').trim()
}

function nullableServiceText(value) {
  const cleaned = cleanServiceText(value)
  return cleaned || null
}

function serviceDateOrNow(value) {
  if (!value) return new Date().toISOString()

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString()
  }

  return date.toISOString()
}

function nullableServiceDate(value) {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

async function getClientServiceRecords(clientId) {
  const result = await pool.query(
    `
    SELECT
      sr.*,
      su.email AS created_by_email,
      su.role AS created_by_role
    FROM service_records sr
    LEFT JOIN system_users su
      ON su.id = sr.created_by_user_id
    WHERE sr.client_profile_id = $1
    ORDER BY
      COALESCE(sr.service_date, sr.occurred_at, sr.created_at) DESC,
      sr.created_at DESC
    LIMIT 75
    `,
    [clientId],
  )

  return result.rows
}

router.get('/clients/:clientId/service-records', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const clientResult = await pool.query(
      `
      SELECT id
      FROM client_profiles
      WHERE id = $1
      LIMIT 1
      `,
      [req.params.clientId],
    )

    if (!clientResult.rows[0]) {
      return res.status(404).json({
        ok: false,
        error: 'Client profile not found.',
      })
    }

    const serviceRecords = await getClientServiceRecords(req.params.clientId)

    return res.json({
      ok: true,
      serviceRecords,
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/clients/:clientId/service-records', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const clientResult = await pool.query(
      `
      SELECT id
      FROM client_profiles
      WHERE id = $1
      LIMIT 1
      `,
      [req.params.clientId],
    )

    if (!clientResult.rows[0]) {
      return res.status(404).json({
        ok: false,
        error: 'Client profile not found.',
      })
    }

    const title = cleanServiceText(req.body.title)

    if (!title) {
      return res.status(400).json({
        ok: false,
        error: 'Service record title is required.',
      })
    }

    const serviceType = cleanServiceText(req.body.serviceType || req.body.service_type) || 'session_note'
    const serviceDate = serviceDateOrNow(req.body.serviceDate || req.body.service_date)
    const followUpAt = nullableServiceDate(req.body.followUpAt || req.body.follow_up_at)
    const status = cleanServiceText(req.body.status) || 'completed'
    const summary = nullableServiceText(req.body.summary)
    const privateNotes = nullableServiceText(req.body.privateNotes || req.body.private_notes)
    const clientVisibleNotes = nullableServiceText(
      req.body.clientVisibleNotes || req.body.client_visible_notes,
    )

    const insertedResult = await pool.query(
      `
      INSERT INTO service_records (
        client_profile_id,
        title,
        service_name,
        service_type,
        service_date,
        occurred_at,
        status,
        summary,
        notes,
        description,
        private_notes,
        client_visible_notes,
        follow_up_at,
        created_by_user_id
      )
      VALUES ($1, $2, $2, $3, $4, $4, $5, $6, $6, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        req.params.clientId,
        title,
        serviceType,
        serviceDate,
        status,
        summary,
        privateNotes,
        clientVisibleNotes,
        followUpAt,
        req.user.id,
      ],
    )

    const serviceRecord = insertedResult.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'service_record_created', 'service_records', $2, '{}'::jsonb, $3::jsonb)
      `,
      [
        req.user.id,
        serviceRecord.id,
        JSON.stringify({
          serviceRecordId: serviceRecord.id,
          clientProfileId: req.params.clientId,
          title: serviceRecord.title,
          serviceType: serviceRecord.service_type,
          status: serviceRecord.status,
        }),
      ],
    )

    const serviceRecords = await getClientServiceRecords(req.params.clientId)

    return res.status(201).json({
      ok: true,
      message: 'Service record created.',
      serviceRecord,
      serviceRecords,
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/service-records/:serviceRecordId', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const existingResult = await pool.query(
      `
      SELECT *
      FROM service_records
      WHERE id = $1
      LIMIT 1
      `,
      [req.params.serviceRecordId],
    )

    const existingRecord = existingResult.rows[0]

    if (!existingRecord) {
      return res.status(404).json({
        ok: false,
        error: 'Service record not found.',
      })
    }

    const title = cleanServiceText(req.body.title || existingRecord.title)
    const serviceType = cleanServiceText(req.body.serviceType || req.body.service_type || existingRecord.service_type)
    const status = cleanServiceText(req.body.status || existingRecord.status)
    const serviceDate = req.body.serviceDate || req.body.service_date
      ? serviceDateOrNow(req.body.serviceDate || req.body.service_date)
      : existingRecord.service_date
    const followUpAt = Object.prototype.hasOwnProperty.call(req.body, 'followUpAt') ||
      Object.prototype.hasOwnProperty.call(req.body, 'follow_up_at')
      ? nullableServiceDate(req.body.followUpAt || req.body.follow_up_at)
      : existingRecord.follow_up_at

    const summary = Object.prototype.hasOwnProperty.call(req.body, 'summary')
      ? nullableServiceText(req.body.summary)
      : existingRecord.summary

    const privateNotes = Object.prototype.hasOwnProperty.call(req.body, 'privateNotes') ||
      Object.prototype.hasOwnProperty.call(req.body, 'private_notes')
      ? nullableServiceText(req.body.privateNotes || req.body.private_notes)
      : existingRecord.private_notes

    const clientVisibleNotes = Object.prototype.hasOwnProperty.call(req.body, 'clientVisibleNotes') ||
      Object.prototype.hasOwnProperty.call(req.body, 'client_visible_notes')
      ? nullableServiceText(req.body.clientVisibleNotes || req.body.client_visible_notes)
      : existingRecord.client_visible_notes

    const updatedResult = await pool.query(
      `
      UPDATE service_records
      SET
        title = $1,
        service_name = $1,
        service_type = $2,
        service_date = $3,
        occurred_at = $3,
        status = $4,
        summary = $5,
        notes = $5,
        description = $5,
        private_notes = $6,
        client_visible_notes = $7,
        follow_up_at = $8,
        updated_at = now()
      WHERE id = $9
      RETURNING *
      `,
      [
        title,
        serviceType,
        serviceDate,
        status,
        summary,
        privateNotes,
        clientVisibleNotes,
        followUpAt,
        req.params.serviceRecordId,
      ],
    )

    const serviceRecord = updatedResult.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'service_record_updated', 'service_records', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        serviceRecord.id,
        JSON.stringify(existingRecord),
        JSON.stringify(serviceRecord),
      ],
    )

    const serviceRecords = await getClientServiceRecords(serviceRecord.client_profile_id)

    return res.json({
      ok: true,
      message: 'Service record updated.',
      serviceRecord,
      serviceRecords,
    })
  } catch (error) {
    return next(error)
  }
})
// phase-3-7-service-records-end

// client-360-pass-27-start
const clientCarePlanSchema = z.object({
  journeyStage: z.enum(['onboarding', 'clarity', 'active_work', 'integration', 'maintenance', 'complete']),
  careStatus: z.enum(['not_started', 'on_track', 'attention', 'paused', 'completed']),
  primaryGoal: z.string().trim().max(2000).optional().default(''),
  transformationFocus: z.string().trim().max(4000).optional().default(''),
  successDefinition: z.string().trim().max(4000).optional().default(''),
  clientVisibleFocus: z.string().trim().max(4000).optional().default(''),
  privateStrategyNotes: z.string().trim().max(10000).optional().default(''),
  nextReviewAt: z.string().trim().nullable().optional(),
})

const clientCareActionCreateSchema = z.object({
  title: z.string().trim().min(1, 'Action title is required.').max(240),
  description: z.string().trim().max(4000).optional().default(''),
  ownerUserId: z.string().uuid().nullable().optional(),
  dueAt: z.string().trim().nullable().optional(),
  priority: z.enum(['normal', 'high', 'urgent']).optional().default('normal'),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional().default('open'),
  visibility: z.enum(['team', 'client']).optional().default('team'),
})

const clientCareActionUpdateSchema = clientCareActionCreateSchema.partial()

async function isAssignedClientCareOwner(clientProfileId, ownerUserId) {
  if (!ownerUserId) return true

  const result = await pool.query(
    `
    SELECT 1
    FROM team_client_assignments tca
    JOIN system_users su ON su.id = tca.team_user_id
    WHERE tca.client_profile_id = $1
      AND tca.team_user_id = $2
      AND su.role IN ('admin', 'staff')
      AND su.status = 'active'
    LIMIT 1
    `,
    [clientProfileId, ownerUserId],
  )

  return Boolean(result.rows[0])
}

router.get('/clients/:clientId/360', requireAdmin, async (req, res, next) => {
  try {
    const snapshot = await getClient360Snapshot(req.params.clientId)

    if (!snapshot) {
      return res.status(404).json({ ok: false, error: 'Client profile not found.' })
    }

    return res.json({ ok: true, snapshot })
  } catch (error) {
    return next(error)
  }
})

router.patch('/clients/:clientId/care-plan', requireAdmin, async (req, res, next) => {
  const parsed = clientCarePlanSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the care plan details.',
    })
  }

  try {
    if (!(await client360ClientExists(req.params.clientId))) {
      return res.status(404).json({ ok: false, error: 'Client profile not found.' })
    }

    const beforeResult = await pool.query(
      'SELECT * FROM client_care_plans WHERE client_profile_id = $1 LIMIT 1',
      [req.params.clientId],
    )
    const plan = await saveClientCarePlan(req.params.clientId, parsed.data, req.user.id)

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id, action, entity_type, entity_id, before_data, after_data, ip_address, user_agent
      )
      VALUES ($1, 'client_care_plan_updated', 'client_care_plans', $2, $3::jsonb, $4::jsonb, $5, $6)
      `,
      [
        req.user.id,
        req.params.clientId,
        JSON.stringify(beforeResult.rows[0] || null),
        JSON.stringify(plan),
        req.ip || null,
        req.get('user-agent') || null,
      ],
    )

    return res.json({
      ok: true,
      message: 'Client care plan saved.',
      snapshot: await getClient360Snapshot(req.params.clientId),
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/clients/:clientId/care-actions', requireAdmin, async (req, res, next) => {
  const parsed = clientCareActionCreateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the action item.',
    })
  }

  try {
    if (!(await client360ClientExists(req.params.clientId))) {
      return res.status(404).json({ ok: false, error: 'Client profile not found.' })
    }

    if (!(await isAssignedClientCareOwner(req.params.clientId, parsed.data.ownerUserId))) {
      return res.status(400).json({
        ok: false,
        error: 'The selected action owner is not assigned to this client.',
      })
    }

    const action = await createClientCareAction(
      req.params.clientId,
      parsed.data,
      req.user.id,
    )

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id, action, entity_type, entity_id, before_data, after_data, ip_address, user_agent
      )
      VALUES ($1, 'client_care_action_created', 'client_care_actions', $2, '{}'::jsonb, $3::jsonb, $4, $5)
      `,
      [
        req.user.id,
        action.id,
        JSON.stringify(action),
        req.ip || null,
        req.get('user-agent') || null,
      ],
    )

    return res.status(201).json({
      ok: true,
      message: 'Care action created.',
      snapshot: await getClient360Snapshot(req.params.clientId),
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/clients/:clientId/care-actions/:actionId', requireAdmin, async (req, res, next) => {
  const parsed = clientCareActionUpdateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the action item.',
    })
  }

  try {
    if (
      Object.prototype.hasOwnProperty.call(parsed.data, 'ownerUserId') &&
      !(await isAssignedClientCareOwner(req.params.clientId, parsed.data.ownerUserId))
    ) {
      return res.status(400).json({
        ok: false,
        error: 'The selected action owner is not assigned to this client.',
      })
    }

    const updated = await updateClientCareAction(
      req.params.clientId,
      req.params.actionId,
      parsed.data,
      req.user.id,
    )

    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Care action not found.' })
    }

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id, action, entity_type, entity_id, before_data, after_data, ip_address, user_agent
      )
      VALUES ($1, 'client_care_action_updated', 'client_care_actions', $2, $3::jsonb, $4::jsonb, $5, $6)
      `,
      [
        req.user.id,
        req.params.actionId,
        JSON.stringify(updated.before),
        JSON.stringify(updated.after),
        req.ip || null,
        req.get('user-agent') || null,
      ],
    )

    return res.json({
      ok: true,
      message: 'Care action updated.',
      snapshot: await getClient360Snapshot(req.params.clientId),
    })
  } catch (error) {
    return next(error)
  }
})
// client-360-pass-27-end


// leads-intake-pipeline-pass-28-start
const leadPipelineUpdateSchema = z.object({
  pipelineStage: z.enum([
    'new_inquiry',
    'contacted',
    'consultation_booked',
    'qualified',
    'nurturing',
    'converted',
    'not_a_fit',
  ]).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  summary: z.string().trim().max(6000).optional(),
  lostReason: z.string().trim().max(4000).optional(),
  nextFollowUpAt: z.string().trim().nullable().optional(),
})

const leadFollowUpCreateSchema = z.object({
  title: z.string().trim().min(1, 'Follow-up title is required.').max(240),
  notes: z.string().trim().max(4000).optional().default(''),
  assignedToUserId: z.string().uuid().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  dueAt: z.string().trim().nullable().optional(),
})

const leadFollowUpUpdateSchema = leadFollowUpCreateSchema.partial().extend({
  status: z.enum(['open', 'completed', 'cancelled']).optional(),
})

const leadNoteSchema = z.object({
  note: z.string().trim().min(1, 'Write a note before saving.').max(6000),
})

const attentionQueueUpdateSchema = z.object({
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  dueAt: z.string().trim().nullable().optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'Choose at least one attention item change.',
})

router.get('/lead-pipeline', requireAdmin, async (req, res, next) => {
  try {
    const teamUserId = req.user?.role === 'staff' ? req.user.id : null
    return res.json({
      ok: true,
      ...(await listLeadPipeline(teamUserId)),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/lead-pipeline/:clientId', requireAdmin, async (req, res, next) => {
  try {
    const detail = await getLeadDetail(req.params.clientId)

    if (!detail) {
      return res.status(404).json({ ok: false, error: 'Lead profile not found.' })
    }

    return res.json({ ok: true, detail })
  } catch (error) {
    return next(error)
  }
})

router.patch('/lead-pipeline/:clientId', requireAdmin, async (req, res, next) => {
  const parsed = leadPipelineUpdateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the lead details.',
    })
  }

  try {
    const updated = await updateLeadProfile(req.params.clientId, parsed.data, req.user.id)

    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Lead profile not found.' })
    }

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data,
        ip_address,
        user_agent
      )
      VALUES ($1, 'lead_pipeline_profile_updated', 'client_profiles', $2, $3::jsonb, $4::jsonb, $5, $6)
      `,
      [
        req.user.id,
        req.params.clientId,
        JSON.stringify(updated.before),
        JSON.stringify(updated.after),
        req.ip || null,
        req.get('user-agent') || null,
      ],
    )

    return res.json({
      ok: true,
      message: parsed.data.pipelineStage === 'converted'
        ? 'Lead converted to an active client.'
        : 'Lead details saved.',
      detail: await getLeadDetail(req.params.clientId),
      pipeline: await listLeadPipeline(req.user?.role === 'staff' ? req.user.id : null),
    })
  } catch (error) {
    if (error.code === 'INVALID_LEAD_OWNER') {
      return res.status(400).json({ ok: false, error: error.message })
    }
    return next(error)
  }
})

router.post('/lead-pipeline/:clientId/follow-ups', requireAdmin, async (req, res, next) => {
  const parsed = leadFollowUpCreateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the follow-up details.',
    })
  }

  try {
    const followUp = await createLeadFollowUp(
      req.params.clientId,
      parsed.data,
      req.user.id,
    )

    if (!followUp) {
      return res.status(404).json({ ok: false, error: 'Lead profile not found.' })
    }

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_data,
        ip_address,
        user_agent
      )
      VALUES ($1, 'lead_follow_up_created', 'lead_follow_ups', $2, $3::jsonb, $4, $5)
      `,
      [
        req.user.id,
        followUp.id,
        JSON.stringify(followUp),
        req.ip || null,
        req.get('user-agent') || null,
      ],
    )

    return res.status(201).json({
      ok: true,
      message: 'Lead follow-up scheduled.',
      detail: await getLeadDetail(req.params.clientId),
      pipeline: await listLeadPipeline(req.user?.role === 'staff' ? req.user.id : null),
    })
  } catch (error) {
    if (error.code === 'INVALID_FOLLOW_UP_ASSIGNEE') {
      return res.status(400).json({ ok: false, error: error.message })
    }
    return next(error)
  }
})

router.patch('/lead-pipeline/:clientId/follow-ups/:followUpId', requireAdmin, async (req, res, next) => {
  const parsed = leadFollowUpUpdateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the follow-up details.',
    })
  }

  try {
    const updated = await updateLeadFollowUp(
      req.params.clientId,
      req.params.followUpId,
      parsed.data,
      req.user.id,
    )

    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Lead follow-up not found.' })
    }

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data,
        ip_address,
        user_agent
      )
      VALUES ($1, 'lead_follow_up_updated', 'lead_follow_ups', $2, $3::jsonb, $4::jsonb, $5, $6)
      `,
      [
        req.user.id,
        req.params.followUpId,
        JSON.stringify(updated.before),
        JSON.stringify(updated.after),
        req.ip || null,
        req.get('user-agent') || null,
      ],
    )

    return res.json({
      ok: true,
      message: updated.after.status === 'completed'
        ? 'Lead follow-up completed.'
        : 'Lead follow-up updated.',
      detail: await getLeadDetail(req.params.clientId),
      pipeline: await listLeadPipeline(req.user?.role === 'staff' ? req.user.id : null),
    })
  } catch (error) {
    if (error.code === 'INVALID_FOLLOW_UP_ASSIGNEE') {
      return res.status(400).json({ ok: false, error: error.message })
    }
    return next(error)
  }
})

router.post('/lead-pipeline/:clientId/notes', requireAdmin, async (req, res, next) => {
  const parsed = leadNoteSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the note.',
    })
  }

  try {
    const activity = await addLeadNote(req.params.clientId, parsed.data.note, req.user.id)

    if (!activity) {
      return res.status(404).json({ ok: false, error: 'Lead profile not found.' })
    }

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_data,
        ip_address,
        user_agent
      )
      VALUES ($1, 'lead_pipeline_note_added', 'client_profiles', $2, $3::jsonb, $4, $5)
      `,
      [
        req.user.id,
        req.params.clientId,
        JSON.stringify({ activityId: activity.id }),
        req.ip || null,
        req.get('user-agent') || null,
      ],
    )

    return res.status(201).json({
      ok: true,
      message: 'Lead note added.',
      detail: await getLeadDetail(req.params.clientId),
    })
  } catch (error) {
    return next(error)
  }
})
// leads-intake-pipeline-pass-28-end

// studio-attention-queue-phase-14-start
router.get('/attention-queue', requireAdmin, async (req, res, next) => {
  try {
    return res.json({
      ok: true,
      ...(await listAttentionQueue(req.user)),
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/attention-queue/:sourceType/:clientId/:itemId', requireAdmin, async (req, res, next) => {
  const parsed = attentionQueueUpdateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the attention item.',
    })
  }

  const sourceType = req.params.sourceType

  if (!['lead_follow_up', 'care_action'].includes(sourceType)) {
    return res.status(400).json({ ok: false, error: 'Unsupported attention item type.' })
  }

  if (sourceType === 'lead_follow_up' && parsed.data.status === 'in_progress') {
    return res.status(400).json({
      ok: false,
      error: 'Lead follow-ups can be open, completed, or cancelled.',
    })
  }

  if (sourceType === 'care_action' && parsed.data.priority === 'low') {
    return res.status(400).json({
      ok: false,
      error: 'Client care actions use normal, high, or urgent priority.',
    })
  }

  try {
    let updated

    if (sourceType === 'lead_follow_up') {
      const payload = {}
      if (Object.prototype.hasOwnProperty.call(parsed.data, 'status')) payload.status = parsed.data.status
      if (Object.prototype.hasOwnProperty.call(parsed.data, 'priority')) payload.priority = parsed.data.priority
      if (Object.prototype.hasOwnProperty.call(parsed.data, 'dueAt')) payload.dueAt = parsed.data.dueAt
      if (Object.prototype.hasOwnProperty.call(parsed.data, 'assigneeUserId')) {
        payload.assignedToUserId = parsed.data.assigneeUserId
      }

      updated = await updateLeadFollowUp(
        req.params.clientId,
        req.params.itemId,
        payload,
        req.user.id,
      )
    } else {
      if (
        Object.prototype.hasOwnProperty.call(parsed.data, 'assigneeUserId')
        && !(await isAssignedClientCareOwner(req.params.clientId, parsed.data.assigneeUserId))
      ) {
        return res.status(400).json({
          ok: false,
          error: 'The selected action owner is not assigned to this client.',
        })
      }

      const payload = {}
      if (Object.prototype.hasOwnProperty.call(parsed.data, 'status')) payload.status = parsed.data.status
      if (Object.prototype.hasOwnProperty.call(parsed.data, 'priority')) payload.priority = parsed.data.priority
      if (Object.prototype.hasOwnProperty.call(parsed.data, 'dueAt')) payload.dueAt = parsed.data.dueAt
      if (Object.prototype.hasOwnProperty.call(parsed.data, 'assigneeUserId')) {
        payload.ownerUserId = parsed.data.assigneeUserId
      }

      updated = await updateClientCareAction(
        req.params.clientId,
        req.params.itemId,
        payload,
        req.user.id,
      )
    }

    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Attention item not found.' })
    }

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data,
        ip_address,
        user_agent
      )
      VALUES ($1, 'attention_queue_item_updated', $2, $3, $4::jsonb, $5::jsonb, $6, $7)
      `,
      [
        req.user.id,
        sourceType === 'lead_follow_up' ? 'lead_follow_ups' : 'client_care_actions',
        req.params.itemId,
        JSON.stringify(updated.before || null),
        JSON.stringify(updated.after || updated),
        req.ip || null,
        req.get('user-agent') || null,
      ],
    )

    const completed = parsed.data.status === 'completed'

    return res.json({
      ok: true,
      message: completed ? 'Attention item completed.' : 'Attention item updated.',
      ...(await listAttentionQueue(req.user)),
    })
  } catch (error) {
    if (error.code === 'INVALID_FOLLOW_UP_ASSIGNEE') {
      return res.status(400).json({ ok: false, error: error.message })
    }
    return next(error)
  }
})
// studio-attention-queue-phase-14-end


// phase-3-8-follow-up-care-queue-start
router.get('/follow-ups', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const followUpsResult = await pool.query(
      `
      SELECT
        sr.id,
        sr.client_profile_id,
        sr.title,
        sr.service_name,
        sr.service_type,
        sr.status,
        sr.summary,
        sr.notes,
        sr.private_notes,
        sr.client_visible_notes,
        sr.service_date,
        sr.follow_up_at,
        sr.created_at,
        sr.updated_at,
        cp.first_name,
        cp.last_name,
        cp.phone,
        cp.client_status,
        su.email AS client_email,
        CASE
          WHEN sr.follow_up_at IS NULL THEN 'needs follow-up'
          WHEN sr.follow_up_at < now() THEN 'overdue'
          WHEN sr.follow_up_at <= now() + interval '2 days' THEN 'due soon'
          ELSE 'scheduled'
        END AS due_status
      FROM service_records sr
      LEFT JOIN client_profiles cp
        ON cp.id = sr.client_profile_id
      LEFT JOIN system_users su
        ON su.id = cp.user_id
      WHERE
        COALESCE(sr.status, 'completed') <> 'archived'
        AND (
          sr.status = 'follow_up'
          OR sr.follow_up_at IS NOT NULL
        )
      ORDER BY
        CASE
          WHEN sr.follow_up_at IS NULL THEN 0
          WHEN sr.follow_up_at < now() THEN 1
          WHEN sr.follow_up_at <= now() + interval '2 days' THEN 2
          ELSE 3
        END,
        COALESCE(sr.follow_up_at, sr.updated_at, sr.created_at) ASC
      LIMIT 40
      `,
    )

    const statsResult = await pool.query(
      `
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(status, 'completed') <> 'archived'
            AND (status = 'follow_up' OR follow_up_at IS NOT NULL)
        )::int AS total,
        COUNT(*) FILTER (
          WHERE COALESCE(status, 'completed') <> 'archived'
            AND (status = 'follow_up' OR follow_up_at IS NOT NULL)
            AND follow_up_at IS NOT NULL
            AND follow_up_at < now()
        )::int AS overdue,
        COUNT(*) FILTER (
          WHERE COALESCE(status, 'completed') <> 'archived'
            AND (status = 'follow_up' OR follow_up_at IS NOT NULL)
            AND follow_up_at IS NOT NULL
            AND follow_up_at >= now()
            AND follow_up_at <= now() + interval '2 days'
        )::int AS due_soon,
        COUNT(*) FILTER (
          WHERE COALESCE(status, 'completed') <> 'archived'
            AND status = 'follow_up'
            AND follow_up_at IS NULL
        )::int AS unscheduled
      FROM service_records
      `,
    )

    return res.json({
      ok: true,
      followUps: followUpsResult.rows.map((row) => ({
        ...row,
        client_name:
          [row.first_name, row.last_name].filter(Boolean).join(' ') ||
          row.client_email ||
          'Unnamed Client',
      })),
      stats: statsResult.rows[0] || {
        total: 0,
        overdue: 0,
        due_soon: 0,
        unscheduled: 0,
      },
    })
  } catch (error) {
    return next(error)
  }
})
// phase-3-8-follow-up-care-queue-end

// phase-3-9a-client-portal-invite-start
function buildClientPortalBaseUrl(req) {
  const requestedBaseUrl = String(req.body?.baseUrl || '').trim()
  const configuredBaseUrl = String(
    process.env.CLIENT_PORTAL_BASE_URL ||
      process.env.PUBLIC_SITE_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:5173',
  ).trim()

  return (requestedBaseUrl || configuredBaseUrl).replace(/\/$/, '')
}

// phase-3-13o-backend-portal-access-stabilization-start
function getPortalLoginLink() {
  const baseUrl =
    process.env.PUBLIC_SITE_URL ||
    process.env.CLIENT_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:5173'

  return baseUrl.replace(/\/$/, '') + '/client-portal/login'
}

async function preventDuplicatePortalSetupInvite(req, res, next) {
  if (req.method !== 'POST') return next()

  try {
    const clientId = req.params.clientId

    const clientResult = await pool.query(
      [
        'SELECT',
        'cp.id AS client_profile_id,',
        'cp.first_name,',
        'cp.last_name,',
        'su.email AS client_email',
        'FROM client_profiles cp',
        'LEFT JOIN system_users su ON su.id = cp.user_id',
        'WHERE cp.id = $1',
      ].join(' '),
      [clientId],
    )

    const client = clientResult.rows[0]

    if (!client) return next()

    const acceptedInviteResult = await pool.query(
      [
        'SELECT id, accepted_at, created_at',
        'FROM client_portal_invites',
        'WHERE client_profile_id = $1',
        "AND status = 'accepted'",
        'ORDER BY accepted_at DESC NULLS LAST, created_at DESC',
        'LIMIT 1',
      ].join(' '),
      [clientId],
    )

    const acceptedInvite = acceptedInviteResult.rows[0]

    if (!acceptedInvite) return next()

    await pool.query(
      [
        'UPDATE client_portal_invites',
        "SET status = 'revoked',",
        'revoked_at = COALESCE(revoked_at, now()),',
        'updated_at = now()',
        'WHERE client_profile_id = $1',
        "AND status = 'pending'",
      ].join(' '),
      [clientId],
    )

    const loginLink = getPortalLoginLink()
    const clientName =
      [client.first_name, client.last_name].filter(Boolean).join(' ') ||
      client.client_email ||
      'This client'

    return res.status(200).json({
      ok: true,
      alreadyActive: true,
      portalAlreadyActive: true,
      status: 'active',
      message:
        clientName +
        ' already has active portal access. Send the login link instead.',
      loginLink,
      login_link: loginLink,
      inviteLink: loginLink,
      invite_link: loginLink,
      invite: {
        id: acceptedInvite.id,
        status: 'accepted',
        acceptedAt: acceptedInvite.accepted_at,
        accepted_at: acceptedInvite.accepted_at,
        inviteLink: loginLink,
        invite_link: loginLink,
      },
    })
  } catch (error) {
    return next(error)
  }
}
// phase-3-13o-backend-portal-access-stabilization-end


router.use('/clients/:clientId/portal-invite', preventDuplicatePortalSetupInvite)

router.post('/clients/:clientId/portal-invite', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  const crypto = require('crypto')
  const dbClient = await pool.connect()

  try {
    await dbClient.query('BEGIN')

    const clientResult = await dbClient.query(
      `
      SELECT
        cp.*,
        su.email,
        su.id AS existing_user_id,
        su.status AS portal_status
      FROM client_profiles cp
      LEFT JOIN system_users su
        ON su.id = cp.user_id
      WHERE cp.id = $1
      LIMIT 1
      `,
      [req.params.clientId],
    )

    const clientProfile = clientResult.rows[0]

    if (!clientProfile) {
      await dbClient.query('ROLLBACK')

      return res.status(404).json({
        ok: false,
        error: 'Client profile not found.',
      })
    }

    if (!clientProfile.existing_user_id || !clientProfile.email) {
      await dbClient.query('ROLLBACK')

      return res.status(400).json({
        ok: false,
        error: 'This client needs a connected portal user/email before an invite can be created.',
      })
    }

    await dbClient.query(
      `
      UPDATE client_portal_invites
      SET
        status = 'revoked',
        revoked_at = now(),
        updated_at = now()
      WHERE client_profile_id = $1
        AND status = 'pending'
      `,
      [clientProfile.id],
    )

    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const tokenPreview = `${token.slice(0, 8)}...${token.slice(-6)}`
    const baseUrl = buildClientPortalBaseUrl(req)
    const inviteLink = `${baseUrl}/client-portal/invite/${token}`

    const daysUntilExpiry = Number(req.body?.expiresInDays || 14)
    const safeDaysUntilExpiry =
      Number.isFinite(daysUntilExpiry) && daysUntilExpiry > 0 && daysUntilExpiry <= 60
        ? daysUntilExpiry
        : 14

    const inviteResult = await dbClient.query(
      `
      INSERT INTO client_portal_invites (
        client_profile_id,
        user_id,
        invite_token_hash,
        invite_token_preview,
        invite_link,
        status,
        expires_at,
        created_by_user_id
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        'pending',
        now() + ($6::text || ' days')::interval,
        $7
      )
      RETURNING *
      `,
      [
        clientProfile.id,
        clientProfile.existing_user_id,
        tokenHash,
        tokenPreview,
        inviteLink,
        safeDaysUntilExpiry,
        req.user.id,
      ],
    )

    const invite = inviteResult.rows[0]

    await dbClient.query(
      `
      UPDATE system_users
      SET
        status = CASE
          WHEN status = 'active' THEN status
          ELSE 'invited'
        END,
        updated_at = now()
      WHERE id = $1
      `,
      [clientProfile.existing_user_id],
    )

    await dbClient.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'client_portal_invite_created', 'client_portal_invites', $2, '{}'::jsonb, $3::jsonb)
      `,
      [
        req.user.id,
        invite.id,
        JSON.stringify({
          inviteId: invite.id,
          clientProfileId: clientProfile.id,
          userId: clientProfile.existing_user_id,
          email: clientProfile.email,
          status: invite.status,
          expiresAt: invite.expires_at,
          tokenPreview,
        }),
      ],
    )

    await dbClient.query('COMMIT')

    return res.status(201).json({
      ok: true,
      message: 'Client portal invite created.',
      invite: {
        ...invite,
        tokenPreview,
      },
      inviteLink,
      client: {
        id: clientProfile.id,
        email: clientProfile.email,
        firstName: clientProfile.first_name,
        lastName: clientProfile.last_name,
      },
    })
  } catch (error) {
    await dbClient.query('ROLLBACK')
    return next(error)
  } finally {
    dbClient.release()
  }
})
// phase-3-9a-client-portal-invite-end

// phase-3-9d-client-portal-resources-admin-start
function normalizePortalResourcePayload(body = {}) {
  const title = String(body.title || '').trim()
  const resourceType = String(body.resourceType || body.resource_type || 'note').trim()
  const description = String(body.description || '').trim()
  const resourceUrl = String(body.resourceUrl || body.resource_url || '').trim()
  const status = String(body.status || 'active').trim()

  return {
    title,
    resourceType,
    description,
    resourceUrl,
    status,
  }
}

router.get('/clients/:clientId/portal-resources', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM client_portal_resources
      WHERE client_profile_id = $1
      ORDER BY created_at DESC
      `,
      [req.params.clientId],
    )

    return res.json({
      ok: true,
      resources: result.rows,
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/clients/:clientId/portal-resources', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  const payload = normalizePortalResourcePayload(req.body)

  if (!payload.title) {
    return res.status(400).json({
      ok: false,
      error: 'Resource title is required.',
    })
  }

  try {
    const clientResult = await pool.query(
      `
      SELECT id
      FROM client_profiles
      WHERE id = $1
      LIMIT 1
      `,
      [req.params.clientId],
    )

    if (!clientResult.rows[0]) {
      return res.status(404).json({
        ok: false,
        error: 'Client profile not found.',
      })
    }

    const result = await pool.query(
      `
      INSERT INTO client_portal_resources (
        client_profile_id,
        title,
        resource_type,
        description,
        resource_url,
        status,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        req.params.clientId,
        payload.title,
        payload.resourceType,
        payload.description || null,
        payload.resourceUrl || null,
        payload.status,
        req.user.id,
      ],
    )

    const resource = result.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'client_portal_resource_created', 'client_portal_resources', $2, '{}'::jsonb, $3::jsonb)
      `,
      [
        req.user.id,
        resource.id,
        JSON.stringify(resource),
      ],
    )

    return res.status(201).json({
      ok: true,
      resource,
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/portal-resources/:resourceId', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  const payload = normalizePortalResourcePayload(req.body)

  try {
    const beforeResult = await pool.query(
      `
      SELECT *
      FROM client_portal_resources
      WHERE id = $1
      LIMIT 1
      `,
      [req.params.resourceId],
    )

    const before = beforeResult.rows[0]

    if (!before) {
      return res.status(404).json({
        ok: false,
        error: 'Portal resource not found.',
      })
    }

    const result = await pool.query(
      `
      UPDATE client_portal_resources
      SET
        title = COALESCE(NULLIF($2, ''), title),
        resource_type = COALESCE(NULLIF($3, ''), resource_type),
        description = $4,
        resource_url = $5,
        status = COALESCE(NULLIF($6, ''), status),
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        req.params.resourceId,
        payload.title,
        payload.resourceType,
        payload.description || null,
        payload.resourceUrl || null,
        payload.status,
      ],
    )

    const resource = result.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'client_portal_resource_updated', 'client_portal_resources', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        resource.id,
        JSON.stringify(before),
        JSON.stringify(resource),
      ],
    )

    return res.json({
      ok: true,
      resource,
    })
  } catch (error) {
    return next(error)
  }
})
// phase-3-9d-client-portal-resources-admin-end

// phase-3-9h-portal-invite-management-start

// phase-3-13r-backend-invite-history-link-normalizer-start
function getPortalLoginLinkForInviteHistory() {
  const baseUrl =
    process.env.PUBLIC_SITE_URL ||
    process.env.CLIENT_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:5173'

  return baseUrl.replace(/\/$/, '') + '/client-portal/login'
}

function normalizePortalInviteHistoryLinks(req, res, next) {
  if (req.method !== 'GET') return next()

  const originalJson = res.json.bind(res)

  res.json = function patchedPortalInviteHistoryJson(body) {
    const loginLink = getPortalLoginLinkForInviteHistory()

    if (body && Array.isArray(body.invites)) {
      body.invites = body.invites.map((invite) => {
        const status = String(invite?.status || '').toLowerCase()

        if (status !== 'accepted') {
          return invite
        }

        const originalSetupLink =
          invite.setup_invite_link ||
          invite.setupInviteLink ||
          invite.invite_link ||
          invite.inviteLink ||
          ''

        return {
          ...invite,
          setupInviteLink: originalSetupLink,
          setup_invite_link: originalSetupLink,
          loginLink,
          login_link: loginLink,
          inviteLink: loginLink,
          invite_link: loginLink,
          accessLinkType: 'login',
          access_link_type: 'login',
        }
      })
    }

    return originalJson(body)
  }

  return next()
}
// phase-3-13r-backend-invite-history-link-normalizer-end


router.use('/clients/:clientId/portal-invites', normalizePortalInviteHistoryLinks)

router.get('/clients/:clientId/portal-invites', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const clientResult = await pool.query(
      `
      SELECT
        cp.id,
        cp.user_id,
        cp.first_name,
        cp.last_name,
        su.email
      FROM client_profiles cp
      LEFT JOIN system_users su
        ON su.id = cp.user_id
      WHERE cp.id = $1
      LIMIT 1
      `,
      [req.params.clientId],
    )

    const clientProfile = clientResult.rows[0]

    if (!clientProfile) {
      return res.status(404).json({
        ok: false,
        error: 'Client profile not found.',
      })
    }

    await pool.query(
      `
      UPDATE client_portal_invites
      SET
        status = 'expired',
        updated_at = now()
      WHERE status = 'pending'
        AND expires_at < now()
        AND (
          client_profile_id = $1
          OR ($2::uuid IS NOT NULL AND user_id = $2::uuid)
        )
      `,
      [clientProfile.id, clientProfile.user_id],
    )

    const result = await pool.query(
      `
      SELECT
        cpi.id,
        cpi.client_profile_id,
        cpi.user_id,
        cpi.invite_token_preview,
        cpi.invite_link,
        cpi.status,
        cpi.expires_at,
        cpi.accepted_at,
        cpi.revoked_at,
        cpi.created_at,
        cpi.updated_at,
        cpi.created_by_user_id,
        creator.email AS created_by_email
      FROM client_portal_invites cpi
      LEFT JOIN system_users creator
        ON creator.id = cpi.created_by_user_id
      WHERE
        cpi.client_profile_id = $1
        OR ($2::uuid IS NOT NULL AND cpi.user_id = $2::uuid)
      ORDER BY cpi.created_at DESC
      LIMIT 25
      `,
      [clientProfile.id, clientProfile.user_id],
    )

    return res.json({
      ok: true,
      client: {
        id: clientProfile.id,
        userId: clientProfile.user_id,
        email: clientProfile.email,
        name:
          [clientProfile.first_name, clientProfile.last_name]
            .filter(Boolean)
            .join(' ') || clientProfile.email || 'Client',
      },
      invites: result.rows,
      latestInvite: result.rows[0] || null,
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/portal-invites/:inviteId/revoke', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const beforeResult = await pool.query(
      `
      SELECT *
      FROM client_portal_invites
      WHERE id = $1
      LIMIT 1
      `,
      [req.params.inviteId],
    )

    const before = beforeResult.rows[0]

    if (!before) {
      return res.status(404).json({
        ok: false,
        error: 'Portal invite not found.',
      })
    }

    if (before.status !== 'pending') {
      return res.status(400).json({
        ok: false,
        error: 'Only pending portal invites can be revoked.',
      })
    }

    const result = await pool.query(
      `
      UPDATE client_portal_invites
      SET
        status = 'revoked',
        revoked_at = now(),
        updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        client_profile_id,
        user_id,
        invite_token_preview,
        invite_link,
        status,
        expires_at,
        accepted_at,
        revoked_at,
        created_at,
        updated_at,
        created_by_user_id
      `,
      [req.params.inviteId],
    )

    const invite = result.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'client_portal_invite_revoked', 'client_portal_invites', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        invite.id,
        JSON.stringify({
          id: before.id,
          status: before.status,
          clientProfileId: before.client_profile_id,
          userId: before.user_id,
          expiresAt: before.expires_at,
        }),
        JSON.stringify({
          id: invite.id,
          status: invite.status,
          clientProfileId: invite.client_profile_id,
          userId: invite.user_id,
          revokedAt: invite.revoked_at,
        }),
      ],
    )

    return res.json({
      ok: true,
      invite,
      message: 'Portal invite revoked.',
    })
  } catch (error) {
    return next(error)
  }
})
// phase-3-9h-portal-invite-management-end

// phase-3-9i-portal-invite-email-composer-start
function buildPortalInviteEmailBody({ clientName, inviteLink, expiresAt }) {
  const expiryText = expiresAt
    ? new Date(expiresAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'soon'

  return `Hi ${clientName},

Your private Power Within Client Portal is ready.

Please use the secure link below to create your portal access:

${inviteLink}

This link is private and expires on ${expiryText}.

Inside your portal, you will be able to access shared notes, resources, reminders, and session-related care prepared for you.

With care,
Power Within Collective`
}

router.get('/clients/:clientId/portal-email-logs', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM client_portal_email_logs
      WHERE client_profile_id = $1
      ORDER BY created_at DESC
      LIMIT 25
      `,
      [req.params.clientId],
    )

    return res.json({
      ok: true,
      emailLogs: result.rows,
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/portal-invites/:inviteId/email-draft', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const inviteResult = await pool.query(
      `
      SELECT
        cpi.*,
        cp.first_name,
        cp.last_name,
        su.email AS client_email
      FROM client_portal_invites cpi
      INNER JOIN client_profiles cp
        ON cp.id = cpi.client_profile_id
      INNER JOIN system_users su
        ON su.id = cpi.user_id
      WHERE cpi.id = $1
      LIMIT 1
      `,
      [req.params.inviteId],
    )

    const invite = inviteResult.rows[0]

    if (!invite) {
      return res.status(404).json({
        ok: false,
        error: 'Portal invite not found.',
      })
    }

    if (!invite.invite_link) {
      return res.status(400).json({
        ok: false,
        error: 'This invite does not have a setup link.',
      })
    }

    const clientName =
      [invite.first_name, invite.last_name].filter(Boolean).join(' ') ||
      invite.client_email ||
      'there'

    const subject = 'Your Power Within Client Portal is ready'
    const bodyText = buildPortalInviteEmailBody({
      clientName,
      inviteLink: invite.invite_link,
      expiresAt: invite.expires_at,
    })

    const logResult = await pool.query(
      `
      INSERT INTO client_portal_email_logs (
        client_profile_id,
        invite_id,
        email_type,
        email_to,
        subject,
        body_text,
        status,
        created_by_user_id
      )
      VALUES ($1, $2, 'portal_invite', $3, $4, $5, 'drafted', $6)
      RETURNING *
      `,
      [
        invite.client_profile_id,
        invite.id,
        invite.client_email,
        subject,
        bodyText,
        req.user.id,
      ],
    )

    const emailLog = logResult.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'client_portal_invite_email_drafted', 'client_portal_email_logs', $2, '{}'::jsonb, $3::jsonb)
      `,
      [
        req.user.id,
        emailLog.id,
        JSON.stringify({
          emailLogId: emailLog.id,
          inviteId: invite.id,
          clientProfileId: invite.client_profile_id,
          emailTo: invite.client_email,
          status: emailLog.status,
        }),
      ],
    )

    return res.status(201).json({
      ok: true,
      emailLog,
      draft: {
        to: invite.client_email,
        subject,
        bodyText,
      },
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/portal-email-logs/:emailLogId/mark-sent', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const beforeResult = await pool.query(
      `
      SELECT *
      FROM client_portal_email_logs
      WHERE id = $1
      LIMIT 1
      `,
      [req.params.emailLogId],
    )

    const before = beforeResult.rows[0]

    if (!before) {
      return res.status(404).json({
        ok: false,
        error: 'Portal email log not found.',
      })
    }

    const result = await pool.query(
      `
      UPDATE client_portal_email_logs
      SET
        status = 'sent_manual',
        sent_at = now(),
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [req.params.emailLogId],
    )

    const emailLog = result.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'client_portal_invite_email_marked_sent', 'client_portal_email_logs', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        emailLog.id,
        JSON.stringify({
          status: before.status,
          sentAt: before.sent_at,
        }),
        JSON.stringify({
          status: emailLog.status,
          sentAt: emailLog.sent_at,
          emailTo: emailLog.email_to,
        }),
      ],
    )

    return res.json({
      ok: true,
      emailLog,
      message: 'Portal invite email marked as sent.',
    })
  } catch (error) {
    return next(error)
  }
})
// phase-3-9i-portal-invite-email-composer-end

// phase-3-9j-real-portal-invite-email-sending-start
function buildPortalInviteEmailTextForSending({ clientName, inviteLink, expiresAt }) {
  const expiryText = expiresAt
    ? new Date(expiresAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'soon'

  return `Hi ${clientName},

Your private Power Within Client Portal is ready.

Please use the secure link below to create your portal access:

${inviteLink}

This link is private and expires on ${expiryText}.

Inside your portal, you will be able to access shared notes, resources, reminders, and session-related care prepared for you.

With care,
Power Within Collective`
}

function buildPortalInviteEmailHtmlForSending({ clientName, inviteLink, expiresAt }) {
  const expiryText = expiresAt
    ? new Date(expiresAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'soon'

  return `
  <div style="margin:0;padding:0;background:#f8eee8;font-family:Arial,sans-serif;color:#4d2831;">
    <div style="max-width:640px;margin:0 auto;padding:40px 20px;">
      <div style="background:#fffdf8;border:1px solid #ead7bd;border-radius:28px;padding:32px;">
        <p style="margin:0 0 12px;color:#c49a5a;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
          Power Within Client Portal
        </p>

        <h1 style="margin:0 0 18px;color:#36232a;font-family:Georgia,serif;font-size:42px;line-height:1;">
          Your private portal is ready.
        </h1>

        <p style="margin:0 0 16px;line-height:1.7;">
          Hi ${clientName},
        </p>

        <p style="margin:0 0 22px;line-height:1.7;">
          Your private Power Within Client Portal is ready. Use the secure button below to create your portal access.
        </p>

        <p style="margin:0 0 26px;">
          <a href="${inviteLink}" style="display:inline-block;background:#4d2831;color:#fff8f1;text-decoration:none;border-radius:999px;padding:14px 22px;font-weight:700;">
            Create My Portal Access
          </a>
        </p>

        <p style="margin:0 0 16px;line-height:1.7;">
          This private link expires on <strong>${expiryText}</strong>.
        </p>

        <p style="margin:0;line-height:1.7;color:#7f5961;">
          Inside your portal, you will be able to access shared notes, resources, reminders, and session-related care prepared for you.
        </p>
      </div>

      <p style="margin:18px 0 0;text-align:center;color:#8f6a70;font-size:12px;">
        Power Within Collective
      </p>
    </div>
  </div>
  `
}

router.post('/portal-invites/:inviteId/send-email', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  let platformSettings

  try {
    platformSettings = await getPlatformSettings(pool)
  } catch (error) {
    return next(error)
  }

  if (platformSettings.maintenanceMode || platformSettings.outgoingEmailPaused) {
    return res.status(503).json({
      ok: false,
      code: 'OUTGOING_EMAIL_PAUSED',
      error: platformSettings.maintenanceMode
        ? platformSettings.maintenanceMessage
        : 'Outgoing email is temporarily paused by the developer.',
    })
  }

  const resendApiKey = String(process.env.RESEND_API_KEY || '').trim()
  const fromEmail = String(
    process.env.PORTAL_EMAIL_FROM ||
      process.env.RESEND_FROM_EMAIL ||
      '',
  ).trim()

  if (!resendApiKey || !fromEmail) {
    return res.status(400).json({
      ok: false,
      error:
        'Email provider is not configured. Add RESEND_API_KEY and PORTAL_EMAIL_FROM to server/.env.',
    })
  }

  try {
    const inviteResult = await pool.query(
      `
      SELECT
        cpi.*,
        cp.first_name,
        cp.last_name,
        su.email AS client_email
      FROM client_portal_invites cpi
      INNER JOIN client_profiles cp
        ON cp.id = cpi.client_profile_id
      INNER JOIN system_users su
        ON su.id = cpi.user_id
      WHERE cpi.id = $1
      LIMIT 1
      `,
      [req.params.inviteId],
    )

    const invite = inviteResult.rows[0]

    if (!invite) {
      return res.status(404).json({
        ok: false,
        error: 'Portal invite not found.',
      })
    }

    if (invite.status !== 'pending') {
      return res.status(400).json({
        ok: false,
        error: 'Only pending portal invites can be emailed.',
      })
    }

    if (!invite.invite_link) {
      return res.status(400).json({
        ok: false,
        error: 'This invite does not have a setup link.',
      })
    }

    const clientName =
      [invite.first_name, invite.last_name].filter(Boolean).join(' ') ||
      invite.client_email ||
      'there'

    const subject = 'Your Power Within Client Portal is ready'
    const bodyText = buildPortalInviteEmailTextForSending({
      clientName,
      inviteLink: invite.invite_link,
      expiresAt: invite.expires_at,
    })
    const html = buildPortalInviteEmailHtmlForSending({
      clientName,
      inviteLink: invite.invite_link,
      expiresAt: invite.expires_at,
    })

    const logResult = await pool.query(
      `
      INSERT INTO client_portal_email_logs (
        client_profile_id,
        invite_id,
        email_type,
        email_to,
        subject,
        body_text,
        status,
        provider,
        created_by_user_id
      )
      VALUES ($1, $2, 'portal_invite', $3, $4, $5, 'drafted', 'resend', $6)
      RETURNING *
      `,
      [
        invite.client_profile_id,
        invite.id,
        invite.client_email,
        subject,
        bodyText,
        req.user.id,
      ],
    )

    const emailLog = logResult.rows[0]

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [invite.client_email],
        subject,
        html,
        text: bodyText,
      }),
    })

    const providerData = await resendResponse.json().catch(() => ({}))

    if (!resendResponse.ok) {
      const errorMessage =
        providerData?.message ||
        providerData?.error ||
        'Email provider rejected the message.'

      const failedResult = await pool.query(
        `
        UPDATE client_portal_email_logs
        SET
          status = 'failed',
          provider_response = $2::jsonb,
          error_message = $3,
          updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          emailLog.id,
          JSON.stringify(providerData || {}),
          errorMessage,
        ],
      )

      const failedEmailLog = failedResult.rows[0]

      await pool.query(
        `
        INSERT INTO audit_logs (
          actor_user_id,
          action,
          entity_type,
          entity_id,
          before_data,
          after_data
        )
        VALUES ($1, 'client_portal_invite_email_failed', 'client_portal_email_logs', $2, $3::jsonb, $4::jsonb)
        `,
        [
          req.user.id,
          failedEmailLog.id,
          JSON.stringify({
            status: emailLog.status,
          }),
          JSON.stringify({
            status: failedEmailLog.status,
            emailTo: failedEmailLog.email_to,
            errorMessage,
          }),
        ],
      )

      return res.status(502).json({
        ok: false,
        error: errorMessage,
        emailLog: failedEmailLog,
        providerResponse: providerData,
      })
    }

    const sentResult = await pool.query(
      `
      UPDATE client_portal_email_logs
      SET
        status = 'sent',
        sent_at = now(),
        provider_message_id = $2,
        provider_response = $3::jsonb,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        emailLog.id,
        providerData?.id || null,
        JSON.stringify(providerData || {}),
      ],
    )

    const sentEmailLog = sentResult.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'client_portal_invite_email_sent', 'client_portal_email_logs', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        sentEmailLog.id,
        JSON.stringify({
          status: emailLog.status,
        }),
        JSON.stringify({
          status: sentEmailLog.status,
          emailTo: sentEmailLog.email_to,
          provider: sentEmailLog.provider,
          providerMessageId: sentEmailLog.provider_message_id,
          sentAt: sentEmailLog.sent_at,
        }),
      ],
    )

    return res.json({
      ok: true,
      message: 'Portal invite email sent.',
      emailLog: sentEmailLog,
      providerResponse: providerData,
    })
  } catch (error) {
    return next(error)
  }
})
// phase-3-9j-real-portal-invite-email-sending-end

// phase-3-10a-mail-studio-foundation-start
const MAIL_TEMPLATE_CATEGORIES = new Set([
  'portal_invite',
  'welcome',
  'follow_up',
  'resource_notice',
  'session_reminder',
  'broadcast',
  'general',
])

function normalizeMailTemplateCategory(category) {
  const value = String(category || 'general').trim().toLowerCase()

  return MAIL_TEMPLATE_CATEGORIES.has(value) ? value : 'general'
}

function normalizeMailTemplateStatus(status) {
  const value = String(status || 'active').trim().toLowerCase()

  return value === 'archived' ? 'archived' : 'active'
}

router.get('/mail-studio/overview', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const templateCountsResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_templates,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_templates,
        COUNT(*) FILTER (WHERE status = 'archived')::int AS archived_templates
      FROM mail_templates
      `,
    )

    const emailCountsResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_email_logs,
        COUNT(*) FILTER (WHERE status = 'drafted')::int AS drafted,
        COUNT(*) FILTER (WHERE status = 'sent_manual')::int AS sent_manual,
        COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
      FROM client_portal_email_logs
      `,
    )

    const recentLogsResult = await pool.query(
      `
      SELECT
        cpel.*,
        cp.first_name,
        cp.last_name
      FROM client_portal_email_logs cpel
      LEFT JOIN client_profiles cp
        ON cp.id = cpel.client_profile_id
      ORDER BY cpel.created_at DESC
      LIMIT 8
      `,
    )

    const recentTemplatesResult = await pool.query(
      `
      SELECT *
      FROM mail_templates
      ORDER BY updated_at DESC
      LIMIT 8
      `,
    )

    return res.json({
      ok: true,
      metrics: {
        ...(templateCountsResult.rows[0] || {}),
        ...(emailCountsResult.rows[0] || {}),
      },
      recentEmailLogs: recentLogsResult.rows,
      recentTemplates: recentTemplatesResult.rows,
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/mail-studio/templates', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const status = String(req.query.status || 'active').toLowerCase()
    const includeArchived = status === 'all'

    const result = await pool.query(
      `
      SELECT *
      FROM mail_templates
      WHERE ($1::boolean = true OR status = 'active')
      ORDER BY
        CASE category
          WHEN 'portal_invite' THEN 1
          WHEN 'welcome' THEN 2
          WHEN 'follow_up' THEN 3
          WHEN 'resource_notice' THEN 4
          WHEN 'session_reminder' THEN 5
          WHEN 'broadcast' THEN 6
          ELSE 7
        END,
        updated_at DESC
      `,
      [includeArchived],
    )

    return res.json({
      ok: true,
      templates: result.rows,
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/mail-studio/templates', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const name = String(req.body.name || '').trim()
    const subject = String(req.body.subject || '').trim()
    const bodyText = String(req.body.bodyText || req.body.body_text || '').trim()
    const category = normalizeMailTemplateCategory(req.body.category)
    const status = normalizeMailTemplateStatus(req.body.status)
    const bodyHtml = req.body.bodyHtml || req.body.body_html || null

    if (!name || !subject || !bodyText) {
      return res.status(400).json({
        ok: false,
        error: 'Template name, subject, and body are required.',
      })
    }

    const templateKey =
      String(req.body.templateKey || req.body.template_key || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') ||
      `${category}_${Date.now()}`

    const result = await pool.query(
      `
      INSERT INTO mail_templates (
        template_key,
        name,
        category,
        subject,
        body_text,
        body_html,
        status,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        templateKey,
        name,
        category,
        subject,
        bodyText,
        bodyHtml,
        status,
        req.user.id,
      ],
    )

    const template = result.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'mail_template_created', 'mail_templates', $2, '{}'::jsonb, $3::jsonb)
      `,
      [
        req.user.id,
        template.id,
        JSON.stringify({
          id: template.id,
          name: template.name,
          category: template.category,
          status: template.status,
        }),
      ],
    )

    return res.status(201).json({
      ok: true,
      template,
    })
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        ok: false,
        error: 'A template with that key already exists.',
      })
    }

    return next(error)
  }
})

router.patch('/mail-studio/templates/:templateId', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const beforeResult = await pool.query(
      `
      SELECT *
      FROM mail_templates
      WHERE id = $1
      LIMIT 1
      `,
      [req.params.templateId],
    )

    const before = beforeResult.rows[0]

    if (!before) {
      return res.status(404).json({
        ok: false,
        error: 'Mail template not found.',
      })
    }

    const name =
      req.body.name === undefined ? before.name : String(req.body.name || '').trim()
    const subject =
      req.body.subject === undefined
        ? before.subject
        : String(req.body.subject || '').trim()
    const bodyText =
      req.body.bodyText === undefined && req.body.body_text === undefined
        ? before.body_text
        : String(req.body.bodyText || req.body.body_text || '').trim()
    const bodyHtml =
      req.body.bodyHtml === undefined && req.body.body_html === undefined
        ? before.body_html
        : req.body.bodyHtml || req.body.body_html || null
    const category =
      req.body.category === undefined
        ? before.category
        : normalizeMailTemplateCategory(req.body.category)
    const status =
      req.body.status === undefined
        ? before.status
        : normalizeMailTemplateStatus(req.body.status)

    if (!name || !subject || !bodyText) {
      return res.status(400).json({
        ok: false,
        error: 'Template name, subject, and body are required.',
      })
    }

    const result = await pool.query(
      `
      UPDATE mail_templates
      SET
        name = $2,
        category = $3,
        subject = $4,
        body_text = $5,
        body_html = $6,
        status = $7,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        req.params.templateId,
        name,
        category,
        subject,
        bodyText,
        bodyHtml,
        status,
      ],
    )

    const template = result.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'mail_template_updated', 'mail_templates', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        template.id,
        JSON.stringify({
          name: before.name,
          category: before.category,
          subject: before.subject,
          status: before.status,
        }),
        JSON.stringify({
          name: template.name,
          category: template.category,
          subject: template.subject,
          status: template.status,
        }),
      ],
    )

    return res.json({
      ok: true,
      template,
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/mail-studio/email-logs', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const result = await pool.query(
      `
      SELECT
        cpel.*,
        cp.first_name,
        cp.last_name
      FROM client_portal_email_logs cpel
      LEFT JOIN client_profiles cp
        ON cp.id = cpel.client_profile_id
      ORDER BY cpel.created_at DESC
      LIMIT 50
      `,
    )

    return res.json({
      ok: true,
      emailLogs: result.rows,
    })
  } catch (error) {
    return next(error)
  }
})
// phase-3-10a-mail-studio-foundation-end

// phase-3-10b-mail-studio-composer-start
const MAIL_STUDIO_EMAIL_TYPES = new Set([
  'portal_invite',
  'portal_login',
  'resource_notice',
  'welcome',
  'follow_up',
  'session_reminder',
  'broadcast',
  'general',
])

function normalizeMailStudioEmailType(value) {
  const normalized = String(value || 'general').trim().toLowerCase()
  return MAIL_STUDIO_EMAIL_TYPES.has(normalized) ? normalized : 'general'
}

function escapeMailStudioHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderMailStudioTemplateText(templateText, variables) {
  return String(templateText || '').replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_match, tokenName) => {
      const value = variables[tokenName]
      return value === undefined || value === null ? '' : String(value)
    },
  )
}

function buildMailStudioHtmlFromText({ heading, bodyText }) {
  const safeHeading = escapeMailStudioHtml(heading || 'A note from Power Within')
  const safeBody = escapeMailStudioHtml(bodyText).replaceAll('\n', '<br />')

  return [
    '<div style="margin:0;padding:0;background:#f8eee8;font-family:Arial,sans-serif;color:#4d2831;">',
    '<div style="max-width:640px;margin:0 auto;padding:40px 20px;">',
    '<div style="background:#fffdf8;border:1px solid #ead7bd;border-radius:28px;padding:32px;">',
    '<p style="margin:0 0 12px;color:#c49a5a;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Power Within Collective</p>',
    '<h1 style="margin:0 0 22px;color:#36232a;font-family:Georgia,serif;font-size:38px;line-height:1;">',
    safeHeading,
    '</h1>',
    '<div style="margin:0;line-height:1.75;color:#4d2831;font-size:15px;">',
    safeBody,
    '</div>',
    '</div>',
    '<p style="margin:18px 0 0;text-align:center;color:#8f6a70;font-size:12px;">Power Within Collective</p>',
    '</div>',
    '</div>',
  ].join('')
}

async function buildMailStudioComposerDraft({ clientProfileId, templateId, variables }) {
  const clientResult = await pool.query(
    `
    SELECT
      cp.id,
      cp.first_name,
      cp.last_name,
      cp.user_id,
      su.email
    FROM client_profiles cp
    LEFT JOIN system_users su
      ON su.id = cp.user_id
    WHERE cp.id = $1
    LIMIT 1
    `,
    [clientProfileId],
  )

  const client = clientResult.rows[0]

  if (!client) {
    const error = new Error('Client profile not found.')
    error.statusCode = 404
    throw error
  }

  if (!client.email) {
    const error = new Error('This client does not have an email connected yet.')
    error.statusCode = 400
    throw error
  }

  const templateResult = await pool.query(
    `
    SELECT *
    FROM mail_templates
    WHERE id = $1
    LIMIT 1
    `,
    [templateId],
  )

  const template = templateResult.rows[0]

  if (!template) {
    const error = new Error('Mail template not found.')
    error.statusCode = 404
    throw error
  }

  const clientName =
    [client.first_name, client.last_name].filter(Boolean).join(' ') ||
    client.email ||
    'there'

  const mergedVariables = {
    clientName,
    firstName: client.first_name || '',
    lastName: client.last_name || '',
    clientEmail: client.email || '',
    resourceTitle: '',
    followUpNotes: '',
    sessionDate: '',
    customMessage: '',
    portalLink: '',
    expiresAt: '',
    ...(variables || {}),
  }

  const subject = renderMailStudioTemplateText(template.subject, mergedVariables)
  const bodyText = renderMailStudioTemplateText(template.body_text, mergedVariables)
  const renderedHtml = template.body_html
    ? renderMailStudioTemplateText(template.body_html, mergedVariables)
    : buildMailStudioHtmlFromText({
        heading: subject,
        bodyText,
      })

  return {
    client,
    template,
    draft: {
      to: client.email,
      subject,
      bodyText,
      html: renderedHtml,
      variables: mergedVariables,
      emailType: normalizeMailStudioEmailType(template.category),
    },
  }
}

router.post('/mail-studio/preview', requireAdmin, async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const result = await buildMailStudioComposerDraft({
      clientProfileId: req.body.clientProfileId,
      templateId: req.body.templateId,
      variables: req.body.variables || {},
    })

    return res.json({
      ok: true,
      draft: result.draft,
      client: result.client,
      template: result.template,
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || 'Unable to preview email.',
    })
  }
})

router.post('/mail-studio/draft', requireAdmin, async (req, res) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const result = await buildMailStudioComposerDraft({
      clientProfileId: req.body.clientProfileId,
      templateId: req.body.templateId,
      variables: req.body.variables || {},
    })

    const logResult = await pool.query(
      `
      INSERT INTO client_portal_email_logs (
        client_profile_id,
        invite_id,
        email_type,
        email_to,
        subject,
        body_text,
        status,
        created_by_user_id
      )
      VALUES ($1, NULL, $2, $3, $4, $5, 'drafted', $6)
      RETURNING *
      `,
      [
        result.client.id,
        result.draft.emailType,
        result.draft.to,
        result.draft.subject,
        result.draft.bodyText,
        req.user.id,
      ],
    )

    const emailLog = logResult.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'mail_studio_email_drafted', 'client_portal_email_logs', $2, '{}'::jsonb, $3::jsonb)
      `,
      [
        req.user.id,
        emailLog.id,
        JSON.stringify({
          id: emailLog.id,
          clientProfileId: result.client.id,
          emailTo: result.draft.to,
          emailType: result.draft.emailType,
          subject: result.draft.subject,
        }),
      ],
    )

    return res.status(201).json({
      ok: true,
      draft: result.draft,
      emailLog,
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || 'Unable to save draft email.',
    })
  }
})

router.post('/mail-studio/send', requireAdmin, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  let platformSettings

  try {
    platformSettings = await getPlatformSettings(pool)
  } catch (error) {
    return next(error)
  }

  if (platformSettings.maintenanceMode || platformSettings.outgoingEmailPaused) {
    return res.status(503).json({
      ok: false,
      code: 'OUTGOING_EMAIL_PAUSED',
      error: platformSettings.maintenanceMode
        ? platformSettings.maintenanceMessage
        : 'Outgoing email is temporarily paused by the developer.',
    })
  }

  const resendApiKey = String(process.env.RESEND_API_KEY || '').trim()
  const fromEmail = String(
    process.env.PORTAL_EMAIL_FROM ||
      process.env.RESEND_FROM_EMAIL ||
      '',
  ).trim()

  if (!resendApiKey || !fromEmail) {
    return res.status(400).json({
      ok: false,
      error:
        'Email provider is not configured. Add RESEND_API_KEY and PORTAL_EMAIL_FROM to server/.env.',
    })
  }

  try {
    const result = await buildMailStudioComposerDraft({
      clientProfileId: req.body.clientProfileId,
      templateId: req.body.templateId,
      variables: req.body.variables || {},
    })

    const logResult = await pool.query(
      `
      INSERT INTO client_portal_email_logs (
        client_profile_id,
        invite_id,
        email_type,
        email_to,
        subject,
        body_text,
        status,
        provider,
        created_by_user_id
      )
      VALUES ($1, NULL, $2, $3, $4, $5, 'drafted', 'resend', $6)
      RETURNING *
      `,
      [
        result.client.id,
        result.draft.emailType,
        result.draft.to,
        result.draft.subject,
        result.draft.bodyText,
        req.user.id,
      ],
    )

    const emailLog = logResult.rows[0]

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + resendApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [result.draft.to],
        subject: result.draft.subject,
        html: result.draft.html,
        text: result.draft.bodyText,
      }),
    })

    const providerData = await resendResponse.json().catch(() => ({}))

    if (!resendResponse.ok) {
      const errorMessage =
        providerData?.message ||
        providerData?.error ||
        'Email provider rejected the message.'

      const failedResult = await pool.query(
        `
        UPDATE client_portal_email_logs
        SET
          status = 'failed',
          provider_response = $2::jsonb,
          error_message = $3,
          updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          emailLog.id,
          JSON.stringify(providerData || {}),
          errorMessage,
        ],
      )

      const failedEmailLog = failedResult.rows[0]

      await pool.query(
        `
        INSERT INTO audit_logs (
          actor_user_id,
          action,
          entity_type,
          entity_id,
          before_data,
          after_data
        )
        VALUES ($1, 'mail_studio_email_failed', 'client_portal_email_logs', $2, $3::jsonb, $4::jsonb)
        `,
        [
          req.user.id,
          failedEmailLog.id,
          JSON.stringify({ status: emailLog.status }),
          JSON.stringify({
            status: failedEmailLog.status,
            emailTo: failedEmailLog.email_to,
            errorMessage,
          }),
        ],
      )

      return res.status(502).json({
        ok: false,
        error: errorMessage,
        emailLog: failedEmailLog,
        providerResponse: providerData,
      })
    }

    const sentResult = await pool.query(
      `
      UPDATE client_portal_email_logs
      SET
        status = 'sent',
        sent_at = now(),
        provider_message_id = $2,
        provider_response = $3::jsonb,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        emailLog.id,
        providerData?.id || null,
        JSON.stringify(providerData || {}),
      ],
    )

    const sentEmailLog = sentResult.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'mail_studio_email_sent', 'client_portal_email_logs', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        sentEmailLog.id,
        JSON.stringify({ status: emailLog.status }),
        JSON.stringify({
          status: sentEmailLog.status,
          emailTo: sentEmailLog.email_to,
          provider: sentEmailLog.provider,
          providerMessageId: sentEmailLog.provider_message_id,
          sentAt: sentEmailLog.sent_at,
        }),
      ],
    )

    return res.json({
      ok: true,
      message: 'Mail Studio email sent.',
      emailLog: sentEmailLog,
      providerResponse: providerData,
    })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || 'Unable to send email.',
    })
  }
})
// phase-3-10b-mail-studio-composer-end

// phase-3-12a-founders-view-start
const FOUNDER_TIME_ZONE = 'America/New_York'

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts
      .filter((part) =>
        ['year', 'month', 'day', 'hour', 'minute', 'second'].includes(part.type),
      )
      .map((part) => [part.type, Number(part.value)]),
  )

  return (
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    ) - date.getTime()
  )
}

function startOfTimeZoneDay(date = new Date(), offsetDays = 0) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FOUNDER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts
      .filter((part) => ['year', 'month', 'day'].includes(part.type))
      .map((part) => [part.type, Number(part.value)]),
  )

  const localDate = new Date(Date.UTC(values.year, values.month - 1, values.day))
  localDate.setUTCDate(localDate.getUTCDate() + offsetDays)

  const firstGuess = new Date(
    Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth(),
      localDate.getUTCDate(),
      0,
      0,
      0,
    ),
  )
  const firstOffset = getTimeZoneOffsetMs(firstGuess, FOUNDER_TIME_ZONE)
  const adjusted = new Date(firstGuess.getTime() - firstOffset)
  const finalOffset = getTimeZoneOffsetMs(adjusted, FOUNDER_TIME_ZONE)

  return new Date(firstGuess.getTime() - finalOffset)
}

function normalizeAvailabilityExceptionStatus(status) {
  return String(status || 'active').toLowerCase() === 'archived'
    ? 'archived'
    : 'active'
}

function getFounderMonthValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FOUNDER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts
      .filter((part) => ['year', 'month'].includes(part.type))
      .map((part) => [part.type, part.value]),
  )

  return `${values.year}-${values.month}`
}

function startOfFounderMonth(monthValue, offsetMonths = 0) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthValue || ''))

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])

  if (month < 1 || month > 12) {
    return null
  }

  const localMonth = new Date(Date.UTC(year, month - 1 + offsetMonths, 1))
  const firstGuess = new Date(
    Date.UTC(
      localMonth.getUTCFullYear(),
      localMonth.getUTCMonth(),
      1,
      0,
      0,
      0,
    ),
  )
  const firstOffset = getTimeZoneOffsetMs(firstGuess, FOUNDER_TIME_ZONE)
  const adjusted = new Date(firstGuess.getTime() - firstOffset)
  const finalOffset = getTimeZoneOffsetMs(adjusted, FOUNDER_TIME_ZONE)

  return new Date(firstGuess.getTime() - finalOffset)
}

const founderAvailabilityWindowSchema = z
  .object({
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must use HH:MM format.'),
    endTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must use HH:MM format.'),
  })
  .refine((window) => window.endTime > window.startTime, {
    message: 'End time must be later than start time.',
  })

function founderWindowsDoNotOverlap(windows = []) {
  const sorted = [...windows].sort((left, right) =>
    left.startTime.localeCompare(right.startTime),
  )

  return sorted.every(
    (window, index) => index === 0 || window.startTime >= sorted[index - 1].endTime,
  )
}

const founderWeeklyAvailabilitySchema = z.object({
  timezone: z.string().trim().min(1).default(FOUNDER_TIME_ZONE),
  slotIntervalMinutes: z.coerce.number().int().refine((value) => [15, 30, 60].includes(value), {
    message: 'Start-time interval must be 15, 30, or 60 minutes.',
  }),
  minimumNoticeMinutes: z.coerce.number().int().min(0).max(10080),
  bookingWindowDays: z.coerce.number().int().min(7).max(365),
  weeklySchedule: z
    .array(
      z.object({
        weekday: z.coerce.number().int().min(0).max(6),
        windows: z.array(founderAvailabilityWindowSchema).max(8),
      }),
    )
    .max(7),
}).superRefine((value, context) => {
  const weekdays = new Set()

  value.weeklySchedule.forEach((day, index) => {
    if (weekdays.has(day.weekday)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weeklySchedule', index, 'weekday'],
        message: 'Each weekday can appear only once.',
      })
    }
    weekdays.add(day.weekday)

    if (!founderWindowsDoNotOverlap(day.windows)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weeklySchedule', index, 'windows'],
        message: 'Availability windows cannot overlap.',
      })
    }
  })
})

const founderDateAvailabilitySchema = z
  .object({
    mode: z.enum(['regular', 'unavailable', 'custom']),
    windows: z.array(founderAvailabilityWindowSchema).max(8).optional().default([]),
    notes: z.string().trim().max(500).optional().default(''),
  })
  .superRefine((value, context) => {
    if (value.mode === 'custom' && value.windows.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['windows'],
        message: 'Add at least one available time window.',
      })
    }

    if (!founderWindowsDoNotOverlap(value.windows)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['windows'],
        message: 'Availability windows cannot overlap.',
      })
    }
  })

async function getFounderAvailabilityWorkspace(ownerUserId) {
  const settings = await getFounderAvailabilitySettings(pool, ownerUserId)
  const [blocksResult, exceptionsResult] = await Promise.all([
    pool.query(
      `
      SELECT
        id,
        owner_user_id,
        weekday,
        specific_date,
        start_time,
        end_time,
        timezone,
        is_active,
        notes,
        created_at,
        updated_at
      FROM availability_blocks
      WHERE is_active = true
        AND owner_user_id = $1
      ORDER BY specific_date NULLS LAST, weekday NULLS LAST, start_time ASC
      LIMIT 500
      `,
      [ownerUserId],
    ),
    pool.query(
      `
      SELECT
        id,
        title,
        exception_type,
        starts_at,
        ends_at,
        timezone,
        status,
        notes,
        created_at,
        updated_at
      FROM availability_exceptions
      WHERE status = 'active'
        AND ends_at >= now()
      ORDER BY starts_at ASC
      LIMIT 250
      `,
    ),
  ])

  return {
    settings,
    availabilityBlocks: blocksResult.rows,
    availabilityExceptions: exceptionsResult.rows,
  }
}

router.get('/founders-view/availability', requireFounderAccess, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const workspace = await getFounderAvailabilityWorkspace(req.founderOwnerUserId)
    return res.json({ ok: true, ...workspace })
  } catch (error) {
    return next(error)
  }
})

router.put('/founders-view/availability/weekly', requireFounderAccess, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  const parsed = founderWeeklyAvailabilitySchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Invalid weekly availability.',
    })
  }

  const client = await pool.connect()

  try {
    const input = parsed.data
    await client.query('BEGIN')

    const beforeBlocks = await client.query(
      `
      SELECT weekday, start_time, end_time, timezone, is_active, notes
      FROM availability_blocks
      WHERE specific_date IS NULL
        AND owner_user_id = $1
      ORDER BY weekday ASC, start_time ASC
      `,
      [req.founderOwnerUserId],
    )

    await client.query(
      `
      DELETE FROM availability_blocks
      WHERE specific_date IS NULL
        AND owner_user_id = $1
      `,
      [req.founderOwnerUserId],
    )

    for (const day of input.weeklySchedule) {
      for (const window of day.windows) {
        await client.query(
          `
          INSERT INTO availability_blocks (
            owner_user_id,
            weekday,
            specific_date,
            start_time,
            end_time,
            timezone,
            is_active,
            notes
          )
          VALUES ($1, $2, NULL, $3, $4, $5, true, 'Founder weekly availability')
          `,
          [
            req.founderOwnerUserId,
            day.weekday,
            window.startTime,
            window.endTime,
            input.timezone,
          ],
        )
      }
    }

    const settingsResult = await client.query(
      `
      INSERT INTO founder_availability_settings (
        owner_user_id,
        timezone,
        schedule_enabled,
        slot_interval_minutes,
        minimum_notice_minutes,
        booking_window_days
      )
      VALUES ($1, $2, true, $3, $4, $5)
      ON CONFLICT (owner_user_id)
      DO UPDATE SET
        timezone = EXCLUDED.timezone,
        schedule_enabled = true,
        slot_interval_minutes = EXCLUDED.slot_interval_minutes,
        minimum_notice_minutes = EXCLUDED.minimum_notice_minutes,
        booking_window_days = EXCLUDED.booking_window_days,
        updated_at = now()
      RETURNING *
      `,
      [
        req.founderOwnerUserId,
        input.timezone,
        input.slotIntervalMinutes,
        input.minimumNoticeMinutes,
        input.bookingWindowDays,
      ],
    )

    await client.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'founder_weekly_availability_updated', 'founder_availability_settings', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        settingsResult.rows[0].id,
        JSON.stringify({ availabilityBlocks: beforeBlocks.rows }),
        JSON.stringify({
          timezone: input.timezone,
          slotIntervalMinutes: input.slotIntervalMinutes,
          minimumNoticeMinutes: input.minimumNoticeMinutes,
          bookingWindowDays: input.bookingWindowDays,
          weeklySchedule: input.weeklySchedule,
        }),
      ],
    )

    await client.query('COMMIT')
    const workspace = await getFounderAvailabilityWorkspace(req.founderOwnerUserId)

    return res.json({
      ok: true,
      message: 'Weekly availability saved.',
      ...workspace,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    return next(error)
  } finally {
    client.release()
  }
})

router.put('/founders-view/availability/dates/:date', requireFounderAccess, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  const dateValue = String(req.params.date || '').trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return res.status(400).json({
      ok: false,
      error: 'Date must use YYYY-MM-DD format.',
    })
  }

  const parsed = founderDateAvailabilitySchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Invalid date availability.',
    })
  }

  const client = await pool.connect()

  try {
    const input = parsed.data
    const settings = await getFounderAvailabilitySettings(client, req.founderOwnerUserId)
    const timezone = settings.timezone || FOUNDER_AVAILABILITY_DEFAULTS.timezone
    const startsAt = founderZonedDateTimeToUtc(dateValue, '00:00', timezone)
    const endsAt = founderZonedDateTimeToUtc(addFounderDateKey(dateValue, 1), '00:00', timezone)

    await client.query('BEGIN')

    const beforeBlocks = await client.query(
      `
      SELECT *
      FROM availability_blocks
      WHERE specific_date = $1::date
        AND owner_user_id = $2
      `,
      [dateValue, req.founderOwnerUserId],
    )

    const beforeExceptions = await client.query(
      `
      SELECT *
      FROM availability_exceptions
      WHERE status = 'active'
        AND exception_type = 'day'
        AND starts_at < $2
        AND ends_at >= $1
      `,
      [startsAt.toISOString(), endsAt.toISOString()],
    )

    await client.query(
      `
      DELETE FROM availability_blocks
      WHERE specific_date = $1::date
        AND owner_user_id = $2
      `,
      [dateValue, req.founderOwnerUserId],
    )

    await client.query(
      `
      UPDATE availability_exceptions
      SET status = 'archived', updated_at = now()
      WHERE status = 'active'
        AND exception_type = 'day'
        AND starts_at < $2
        AND ends_at >= $1
      `,
      [startsAt.toISOString(), endsAt.toISOString()],
    )

    if (input.mode === 'unavailable') {
      await client.query(
        `
        INSERT INTO availability_exceptions (
          title,
          exception_type,
          starts_at,
          ends_at,
          timezone,
          status,
          notes,
          created_by_user_id
        )
        VALUES ('Unavailable', 'day', $1, $2, $3, 'active', $4, $5)
        `,
        [
          startsAt.toISOString(),
          new Date(endsAt.getTime() - 1000).toISOString(),
          timezone,
          input.notes || 'Protected from Founder Availability.',
          req.user.id,
        ],
      )
    }

    if (input.mode === 'custom') {
      for (const window of input.windows) {
        await client.query(
          `
          INSERT INTO availability_blocks (
            owner_user_id,
            weekday,
            specific_date,
            start_time,
            end_time,
            timezone,
            is_active,
            notes
          )
          VALUES ($1, NULL, $2::date, $3, $4, $5, true, $6)
          `,
          [
            req.founderOwnerUserId,
            dateValue,
            window.startTime,
            window.endTime,
            timezone,
            input.notes || 'Founder date-specific availability',
          ],
        )
      }
    }

    await client.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'founder_date_availability_updated', 'availability_blocks', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        req.founderOwnerUserId,
        JSON.stringify({
          date: dateValue,
          availabilityBlocks: beforeBlocks.rows,
          availabilityExceptions: beforeExceptions.rows,
        }),
        JSON.stringify({
          date: dateValue,
          mode: input.mode,
          windows: input.windows,
          notes: input.notes,
        }),
      ],
    )

    await client.query('COMMIT')
    const workspace = await getFounderAvailabilityWorkspace(req.founderOwnerUserId)

    return res.json({
      ok: true,
      message:
        input.mode === 'custom'
          ? 'Custom hours saved for this date.'
          : input.mode === 'unavailable'
            ? 'This date is now unavailable.'
            : 'This date now follows the weekly schedule.',
      ...workspace,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    return next(error)
  } finally {
    client.release()
  }
})


router.get('/founders-view/overview', requireFounderAccess, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const todayStart = startOfTimeZoneDay()
    const tomorrowStart = startOfTimeZoneDay(new Date(), 1)
    const nextTwoWeeks = startOfTimeZoneDay(new Date(), 14)

    const todaySessionsResult = await pool.query(
      `
      SELECT
        b.id,
        b.client_profile_id,
        b.guest_name,
        b.guest_email,
        b.guest_phone,
        b.starts_at,
        b.ends_at,
        b.status,
        b.admin_notes,
        cp.first_name,
        cp.last_name,
        su.email AS client_email
      FROM bookings b
      LEFT JOIN client_profiles cp
        ON cp.id = b.client_profile_id
      LEFT JOIN system_users su
        ON su.id = cp.user_id
      WHERE b.starts_at >= $1
        AND b.starts_at < $2
        AND b.status NOT IN ('cancelled', 'rejected')
      ORDER BY b.starts_at ASC
      LIMIT 12
      `,
      [todayStart.toISOString(), tomorrowStart.toISOString()],
    )

    const upcomingBookingsResult = await pool.query(
      `
      SELECT
        b.id,
        b.client_profile_id,
        b.guest_name,
        b.guest_email,
        b.guest_phone,
        b.starts_at,
        b.ends_at,
        b.status,
        b.admin_notes,
        cp.first_name,
        cp.last_name,
        su.email AS client_email
      FROM bookings b
      LEFT JOIN client_profiles cp
        ON cp.id = b.client_profile_id
      LEFT JOIN system_users su
        ON su.id = cp.user_id
      WHERE b.starts_at >= $1
        AND b.starts_at < $2
        AND b.status NOT IN ('cancelled', 'rejected')
      ORDER BY b.starts_at ASC
      LIMIT 16
      `,
      [todayStart.toISOString(), nextTwoWeeks.toISOString()],
    )

    const pendingRequestsResult = await pool.query(
      `
      SELECT
        b.id,
        b.client_profile_id,
        b.guest_name,
        b.guest_email,
        b.guest_phone,
        b.starts_at,
        b.ends_at,
        b.status,
        b.created_at,
        cp.first_name,
        cp.last_name,
        su.email AS client_email
      FROM bookings b
      LEFT JOIN client_profiles cp
        ON cp.id = b.client_profile_id
      LEFT JOIN system_users su
        ON su.id = cp.user_id
      WHERE b.status IN ('requested', 'pending')
      ORDER BY b.created_at DESC
      LIMIT 8
      `,
    )

    const followUpsResult = await pool.query(
      `
      SELECT
        sr.id,
        sr.title,
        sr.service_name,
        sr.status,
        sr.follow_up_at,
        sr.client_profile_id,
        cp.first_name,
        cp.last_name,
        su.email AS client_email
      FROM service_records sr
      INNER JOIN client_profiles cp
        ON cp.id = sr.client_profile_id
      LEFT JOIN system_users su
        ON su.id = cp.user_id
      WHERE sr.follow_up_at IS NOT NULL
        AND sr.status NOT IN ('archived', 'cancelled')
      ORDER BY sr.follow_up_at ASC
      LIMIT 10
      `,
    )

    const availabilityResult = await pool.query(
      `
      SELECT *
      FROM availability_exceptions
      WHERE status = 'active'
        AND ends_at >= now()
      ORDER BY starts_at ASC
      LIMIT 12
      `,
    )

    const failedEmailsResult = await pool.query(
      `
      SELECT COUNT(*)::int AS failed_email_count
      FROM client_portal_email_logs
      WHERE status = 'failed'
      `,
    )

    return res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      metrics: {
        todaySessions: todaySessionsResult.rows.length,
        upcomingBookings: upcomingBookingsResult.rows.length,
        pendingRequests: pendingRequestsResult.rows.length,
        followUps: followUpsResult.rows.length,
        unavailableBlocks: availabilityResult.rows.length,
        failedEmails: failedEmailsResult.rows[0]?.failed_email_count || 0,
        unreadMessages: 0
      },
      todaySessions: todaySessionsResult.rows,
      upcomingBookings: upcomingBookingsResult.rows,
      pendingRequests: pendingRequestsResult.rows,
      followUps: followUpsResult.rows,
      availabilityExceptions: availabilityResult.rows
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/founders-view/calendar', requireFounderAccess, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const month = String(req.query.month || getFounderMonthValue()).trim()
    const monthStart = startOfFounderMonth(month)
    const nextMonthStart = startOfFounderMonth(month, 1)

    if (!monthStart || !nextMonthStart) {
      return res.status(400).json({
        ok: false,
        error: 'Month must use YYYY-MM format.',
      })
    }

    const bookingsResult = await pool.query(
      `
      SELECT
        b.id,
        b.client_profile_id,
        b.guest_name,
        b.guest_email,
        b.guest_phone,
        b.starts_at,
        b.ends_at,
        b.status,
        b.admin_notes,
        cp.first_name,
        cp.last_name,
        su.email AS client_email
      FROM bookings b
      LEFT JOIN client_profiles cp
        ON cp.id = b.client_profile_id
      LEFT JOIN system_users su
        ON su.id = cp.user_id
      WHERE b.starts_at >= $1
        AND b.starts_at < $2
        AND b.status NOT IN ('cancelled', 'rejected')
      ORDER BY b.starts_at ASC
      LIMIT 150
      `,
      [monthStart.toISOString(), nextMonthStart.toISOString()],
    )

    const availabilityResult = await pool.query(
      `
      SELECT *
      FROM availability_exceptions
      WHERE status = 'active'
        AND starts_at < $2
        AND ends_at >= $1
      ORDER BY starts_at ASC
      LIMIT 100
      `,
      [monthStart.toISOString(), nextMonthStart.toISOString()],
    )

    const [monthYear, monthNumber] = month.split('-').map(Number)
    const nextMonthDate = new Date(Date.UTC(monthYear, monthNumber, 1))
    const nextMonthDateValue = [
      nextMonthDate.getUTCFullYear(),
      String(nextMonthDate.getUTCMonth() + 1).padStart(2, '0'),
      '01',
    ].join('-')

    const availabilityBlocksResult = await pool.query(
      `
      SELECT
        id,
        weekday,
        specific_date,
        start_time,
        end_time,
        timezone,
        notes
      FROM availability_blocks
      WHERE is_active = true
        AND owner_user_id = $3
        AND (
          specific_date IS NULL
          OR (specific_date >= $1::date AND specific_date < $2::date)
        )
      ORDER BY specific_date NULLS LAST, weekday NULLS LAST, start_time ASC
      `,
      [`${month}-01`, nextMonthDateValue, req.founderOwnerUserId],
    )

    return res.json({
      ok: true,
      month,
      timeZone: FOUNDER_TIME_ZONE,
      rangeStart: monthStart.toISOString(),
      rangeEnd: nextMonthStart.toISOString(),
      bookings: bookingsResult.rows,
      availabilityExceptions: availabilityResult.rows,
      availabilityBlocks: availabilityBlocksResult.rows,
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/founders-view/availability-exceptions', requireFounderAccess, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const title = String(req.body.title || 'Unavailable').trim()
    const exceptionType = String(req.body.exceptionType || req.body.exception_type || 'day')
      .trim()
      .toLowerCase()
    const startsAt = req.body.startsAt || req.body.starts_at
    const endsAt = req.body.endsAt || req.body.ends_at
    const timezone = String(req.body.timezone || 'America/New_York').trim()
    const notes = req.body.notes ? String(req.body.notes).trim() : null

    if (!startsAt || !endsAt) {
      return res.status(400).json({
        ok: false,
        error: 'Start and end date/time are required.',
      })
    }

    const result = await pool.query(
      `
      INSERT INTO availability_exceptions (
        title,
        exception_type,
        starts_at,
        ends_at,
        timezone,
        status,
        notes,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
      RETURNING *
      `,
      [
        title || 'Unavailable',
        ['day', 'time_range', 'date_range'].includes(exceptionType)
          ? exceptionType
          : 'day',
        startsAt,
        endsAt,
        timezone,
        notes,
        req.user.id,
      ],
    )

    const exception = result.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'availability_exception_created', 'availability_exceptions', $2, '{}'::jsonb, $3::jsonb)
      `,
      [
        req.user.id,
        exception.id,
        JSON.stringify({
          id: exception.id,
          title: exception.title,
          startsAt: exception.starts_at,
          endsAt: exception.ends_at,
          status: exception.status,
        }),
      ],
    )

    return res.status(201).json({
      ok: true,
      availabilityException: exception,
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/founders-view/availability-exceptions/:exceptionId', requireFounderAccess, async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const beforeResult = await pool.query(
      `
      SELECT *
      FROM availability_exceptions
      WHERE id = $1
      LIMIT 1
      `,
      [req.params.exceptionId],
    )

    const before = beforeResult.rows[0]

    if (!before) {
      return res.status(404).json({
        ok: false,
        error: 'Availability exception not found.',
      })
    }

    const status =
      req.body.status === undefined
        ? before.status
        : normalizeAvailabilityExceptionStatus(req.body.status)

    const result = await pool.query(
      `
      UPDATE availability_exceptions
      SET
        status = $2,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [req.params.exceptionId, status],
    )

    const exception = result.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'availability_exception_updated', 'availability_exceptions', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        exception.id,
        JSON.stringify({
          status: before.status,
        }),
        JSON.stringify({
          status: exception.status,
        }),
      ],
    )

    return res.json({
      ok: true,
      availabilityException: exception,
    })
  } catch (error) {
    return next(error)
  }
})
// phase-3-12a-founders-view-end


// encouragement-studio-pass-17-start
const encouragementDeliveryModes = ['draft', 'publish_now', 'schedule']
const encouragementVisibilityModes = ['all_members', 'single_client']

const encouragementPayloadSchema = z
  .object({
    title: z.string().trim().max(160, 'Keep the title under 160 characters.').optional().default(''),
    body: z.string().trim().min(1, 'Write the encouragement before saving.').max(10000),
    visibility: z.enum(encouragementVisibilityModes).optional().default('all_members'),
    clientProfileId: z.string().uuid().nullable().optional(),
    deliveryMode: z.enum(encouragementDeliveryModes).optional().default('draft'),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  })
  .superRefine((value, context) => {
    if (value.visibility === 'single_client' && !value.clientProfileId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['clientProfileId'],
        message: 'Choose the client who should receive this message.',
      })
    }

    if (value.deliveryMode === 'schedule' && (!value.scheduledDate || !value.scheduledTime)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledDate'],
        message: 'Choose both a date and time for the scheduled message.',
      })
    }
  })

async function getEncouragementScheduleDate(payload) {
  if (payload.deliveryMode !== 'schedule') return null

  const founderSettings = await getFounderAvailabilitySettings(pool)
  const timeZone = founderSettings.timezone || 'America/New_York'
  const scheduledAt = founderZonedDateTimeToUtc(
    payload.scheduledDate,
    payload.scheduledTime,
    timeZone,
  )

  if (Number.isNaN(scheduledAt.getTime())) {
    const error = new Error('The scheduled date or time is invalid.')
    error.statusCode = 400
    throw error
  }

  if (scheduledAt.getTime() <= Date.now()) {
    const error = new Error('Choose a future time for a scheduled message.')
    error.statusCode = 400
    throw error
  }

  return { scheduledAt, timeZone }
}

function getEncouragementState(payload, scheduledDetails = null) {
  if (payload.deliveryMode === 'publish_now') {
    return {
      status: 'published',
      scheduledAt: null,
      publishedAt: new Date(),
    }
  }

  if (payload.deliveryMode === 'schedule') {
    return {
      status: 'scheduled',
      scheduledAt: scheduledDetails?.scheduledAt || null,
      publishedAt: null,
    }
  }

  return {
    status: 'draft',
    scheduledAt: null,
    publishedAt: null,
  }
}

async function ensureEncouragementClient(clientProfileId, db = pool) {
  if (!clientProfileId) return null

  const result = await db.query(
    `
    SELECT
      cp.id,
      cp.first_name,
      cp.last_name,
      COALESCE(su.email, cp.public_contact_email) AS email,
      su.status AS portal_status
    FROM client_profiles cp
    LEFT JOIN system_users su ON su.id = cp.user_id
    WHERE cp.id = $1
    LIMIT 1
    `,
    [clientProfileId],
  )

  if (!result.rows[0]) {
    const error = new Error('The selected client could not be found.')
    error.statusCode = 404
    throw error
  }

  return result.rows[0]
}

async function writeEncouragementAudit({
  actorUserId,
  action,
  encouragementId,
  beforeData = null,
  afterData = null,
  db = pool,
}) {
  await db.query(
    `
    INSERT INTO audit_logs (
      actor_user_id,
      action,
      entity_type,
      entity_id,
      before_data,
      after_data
    )
    VALUES ($1, $2, 'encouragement_posts', $3, $4::jsonb, $5::jsonb)
    `,
    [
      actorUserId || null,
      action,
      encouragementId || null,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
    ],
  )
}

router.get('/encouragements', requireAdmin, async (req, res, next) => {
  try {
    await publishDueEncouragements(pool)

    const status = String(req.query.status || 'all').trim().toLowerCase()
    const visibility = String(req.query.visibility || 'all').trim().toLowerCase()
    const search = String(req.query.search || '').trim()

    const allowedStatuses = new Set(['all', 'draft', 'scheduled', 'published', 'archived'])
    const allowedVisibilities = new Set(['all', ...encouragementVisibilityModes])

    if (!allowedStatuses.has(status) || !allowedVisibilities.has(visibility)) {
      return res.status(400).json({ ok: false, error: 'Invalid encouragement filter.' })
    }

    const [postsResult, metricsResult, settings] = await Promise.all([
      pool.query(
        `
        SELECT
          ep.id,
          ep.title,
          ep.body,
          ep.visibility,
          ep.status,
          ep.scheduled_at,
          ep.published_at,
          ep.created_at,
          ep.updated_at,
          creator.email AS created_by_email,
          target_cp.id AS client_profile_id,
          target_cp.first_name AS client_first_name,
          target_cp.last_name AS client_last_name,
          COALESCE(target_su.email, target_cp.public_contact_email) AS client_email,
          CASE
            WHEN ep.visibility = 'all_members' THEN (
              SELECT COUNT(*)::int
              FROM client_profiles audience_cp
              JOIN system_users audience_su ON audience_su.id = audience_cp.user_id
              WHERE audience_su.role = 'client'
                AND audience_su.status = 'active'
            )
            ELSE CASE WHEN target_cp.id IS NULL THEN 0 ELSE 1 END
          END AS audience_count,
          (
            SELECT COUNT(*)::int
            FROM encouragement_recipients read_er
            WHERE read_er.encouragement_post_id = ep.id
              AND read_er.read_at IS NOT NULL
          ) AS read_count
        FROM encouragement_posts ep
        LEFT JOIN system_users creator ON creator.id = ep.created_by
        LEFT JOIN encouragement_recipients target_er
          ON target_er.encouragement_post_id = ep.id
         AND ep.visibility = 'single_client'
        LEFT JOIN client_profiles target_cp ON target_cp.id = target_er.client_profile_id
        LEFT JOIN system_users target_su ON target_su.id = target_cp.user_id
        WHERE ($1 = 'all' OR ep.status = $1)
          AND ($2 = 'all' OR ep.visibility = $2)
          AND (
            $3 = ''
            OR COALESCE(ep.title, '') ILIKE '%' || $3 || '%'
            OR ep.body ILIKE '%' || $3 || '%'
            OR COALESCE(target_cp.first_name, '') ILIKE '%' || $3 || '%'
            OR COALESCE(target_cp.last_name, '') ILIKE '%' || $3 || '%'
            OR COALESCE(target_su.email, target_cp.public_contact_email, '') ILIKE '%' || $3 || '%'
          )
        ORDER BY
          CASE ep.status
            WHEN 'scheduled' THEN 0
            WHEN 'published' THEN 1
            WHEN 'draft' THEN 2
            ELSE 3
          END,
          COALESCE(ep.scheduled_at, ep.published_at, ep.updated_at) DESC
        LIMIT 250
        `,
        [status, visibility, search],
      ),
      pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'draft')::int AS drafts,
          COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
          COUNT(*) FILTER (WHERE status = 'published')::int AS published,
          COUNT(*) FILTER (WHERE status = 'archived')::int AS archived,
          COALESCE((
            SELECT COUNT(*)::int
            FROM encouragement_recipients
            WHERE read_at IS NOT NULL
          ), 0) AS total_reads
        FROM encouragement_posts
        `,
      ),
      getPlatformSettings(pool),
    ])

    return res.json({
      ok: true,
      encouragements: postsResult.rows,
      metrics: metricsResult.rows[0] || {},
      featureEnabled: Boolean(settings.featureFlags?.clientMessages),
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/encouragements', requireAdmin, async (req, res, next) => {
  const parsed = encouragementPayloadSchema.safeParse(req.body || {})

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Review the encouragement details.',
      issues: parsed.error.issues,
    })
  }

  const client = await pool.connect()

  try {
    const payload = parsed.data
    const scheduledDetails = await getEncouragementScheduleDate(payload)
    const state = getEncouragementState(payload, scheduledDetails)

    await client.query('BEGIN')

    const targetClient =
      payload.visibility === 'single_client'
        ? await ensureEncouragementClient(payload.clientProfileId, client)
        : null

    const result = await client.query(
      `
      INSERT INTO encouragement_posts (
        title,
        body,
        visibility,
        status,
        scheduled_at,
        published_at,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        payload.title || null,
        payload.body,
        payload.visibility,
        state.status,
        state.scheduledAt,
        state.publishedAt,
        req.user.id,
      ],
    )

    const encouragement = result.rows[0]

    if (payload.visibility === 'single_client') {
      await client.query(
        `
        INSERT INTO encouragement_recipients (
          encouragement_post_id,
          client_profile_id
        )
        VALUES ($1, $2)
        ON CONFLICT (encouragement_post_id, client_profile_id) DO NOTHING
        `,
        [encouragement.id, payload.clientProfileId],
      )
    }

    await writeEncouragementAudit({
      actorUserId: req.user.id,
      action: 'encouragement_created',
      encouragementId: encouragement.id,
      afterData: {
        ...encouragement,
        targetClient,
        scheduleTimeZone: scheduledDetails?.timeZone || null,
      },
      db: client,
    })

    await client.query('COMMIT')

    return res.status(201).json({
      ok: true,
      encouragement,
      targetClient,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.statusCode) {
      return res.status(error.statusCode).json({ ok: false, error: error.message })
    }
    return next(error)
  } finally {
    client.release()
  }
})

router.patch('/encouragements/:encouragementId', requireAdmin, async (req, res, next) => {
  const parsed = encouragementPayloadSchema.safeParse(req.body || {})

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Review the encouragement details.',
      issues: parsed.error.issues,
    })
  }

  const client = await pool.connect()

  try {
    const payload = parsed.data
    const scheduledDetails = await getEncouragementScheduleDate(payload)
    const state = getEncouragementState(payload, scheduledDetails)

    await client.query('BEGIN')

    const beforeResult = await client.query(
      `
      SELECT
        ep.*,
        (
          SELECT er.client_profile_id
          FROM encouragement_recipients er
          WHERE er.encouragement_post_id = ep.id
          LIMIT 1
        ) AS existing_client_profile_id
      FROM encouragement_posts ep
      WHERE ep.id = $1
      FOR UPDATE
      `,
      [req.params.encouragementId],
    )

    const before = beforeResult.rows[0]

    if (!before) {
      await client.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Encouragement not found.' })
    }

    const targetClient =
      payload.visibility === 'single_client'
        ? await ensureEncouragementClient(payload.clientProfileId, client)
        : null

    const result = await client.query(
      `
      UPDATE encouragement_posts
      SET
        title = $2,
        body = $3,
        visibility = $4,
        status = $5,
        scheduled_at = $6,
        published_at = $7,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        req.params.encouragementId,
        payload.title || null,
        payload.body,
        payload.visibility,
        state.status,
        state.scheduledAt,
        state.publishedAt,
      ],
    )

    const contentChanged =
      before.title !== (payload.title || null) ||
      before.body !== payload.body ||
      before.visibility !== payload.visibility ||
      String(before.existing_client_profile_id || '') !== String(payload.clientProfileId || '')

    if (contentChanged) {
      await client.query(
        'DELETE FROM encouragement_recipients WHERE encouragement_post_id = $1',
        [req.params.encouragementId],
      )
    }

    if (payload.visibility === 'single_client') {
      await client.query(
        `
        INSERT INTO encouragement_recipients (
          encouragement_post_id,
          client_profile_id
        )
        VALUES ($1, $2)
        ON CONFLICT (encouragement_post_id, client_profile_id) DO NOTHING
        `,
        [req.params.encouragementId, payload.clientProfileId],
      )
    }

    await writeEncouragementAudit({
      actorUserId: req.user.id,
      action: 'encouragement_updated',
      encouragementId: req.params.encouragementId,
      beforeData: before,
      afterData: {
        ...result.rows[0],
        targetClient,
        readsReset: contentChanged,
        scheduleTimeZone: scheduledDetails?.timeZone || null,
      },
      db: client,
    })

    await client.query('COMMIT')

    return res.json({
      ok: true,
      encouragement: result.rows[0],
      targetClient,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    if (error.statusCode) {
      return res.status(error.statusCode).json({ ok: false, error: error.message })
    }
    return next(error)
  } finally {
    client.release()
  }
})

router.post('/encouragements/:encouragementId/publish', requireAdmin, async (req, res, next) => {
  try {
    const beforeResult = await pool.query(
      'SELECT * FROM encouragement_posts WHERE id = $1 LIMIT 1',
      [req.params.encouragementId],
    )

    if (!beforeResult.rows[0]) {
      return res.status(404).json({ ok: false, error: 'Encouragement not found.' })
    }

    const result = await pool.query(
      `
      UPDATE encouragement_posts
      SET
        status = 'published',
        scheduled_at = NULL,
        published_at = now(),
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [req.params.encouragementId],
    )

    await writeEncouragementAudit({
      actorUserId: req.user.id,
      action: 'encouragement_published',
      encouragementId: req.params.encouragementId,
      beforeData: beforeResult.rows[0],
      afterData: result.rows[0],
    })

    return res.json({ ok: true, encouragement: result.rows[0] })
  } catch (error) {
    return next(error)
  }
})

router.post('/encouragements/:encouragementId/archive', requireAdmin, async (req, res, next) => {
  try {
    const beforeResult = await pool.query(
      'SELECT * FROM encouragement_posts WHERE id = $1 LIMIT 1',
      [req.params.encouragementId],
    )

    if (!beforeResult.rows[0]) {
      return res.status(404).json({ ok: false, error: 'Encouragement not found.' })
    }

    const result = await pool.query(
      `
      UPDATE encouragement_posts
      SET status = 'archived', updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [req.params.encouragementId],
    )

    await writeEncouragementAudit({
      actorUserId: req.user.id,
      action: 'encouragement_archived',
      encouragementId: req.params.encouragementId,
      beforeData: beforeResult.rows[0],
      afterData: result.rows[0],
    })

    return res.json({ ok: true, encouragement: result.rows[0] })
  } catch (error) {
    return next(error)
  }
})

router.delete('/encouragements/:encouragementId', requireAdmin, async (req, res, next) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const result = await client.query(
      `
      DELETE FROM encouragement_posts
      WHERE id = $1
        AND status IN ('draft', 'archived')
      RETURNING *
      `,
      [req.params.encouragementId],
    )

    if (!result.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        ok: false,
        error: 'Only draft or archived encouragements can be deleted.',
      })
    }

    await writeEncouragementAudit({
      actorUserId: req.user.id,
      action: 'encouragement_deleted',
      encouragementId: req.params.encouragementId,
      beforeData: result.rows[0],
      db: client,
    })

    await client.query('COMMIT')

    return res.json({ ok: true, deletedId: req.params.encouragementId })
  } catch (error) {
    await client.query('ROLLBACK')
    return next(error)
  } finally {
    client.release()
  }
})
// encouragement-studio-pass-17-end


// developer-control-center-start
router.get('/developer/overview', requireDeveloper, async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const [roleCountsResult, statusCountsResult, totalsResult, recentUsersResult, recentAuditResult] =
      await Promise.all([
        pool.query(`
          SELECT role, COUNT(*)::int AS count
          FROM system_users
          GROUP BY role
          ORDER BY role
        `),
        pool.query(`
          SELECT status, COUNT(*)::int AS count
          FROM system_users
          GROUP BY status
          ORDER BY status
        `),
        pool.query(`
          SELECT
            (SELECT COUNT(*)::int FROM system_users) AS users,
            (SELECT COUNT(*)::int FROM client_profiles) AS client_profiles,
            (SELECT COUNT(*)::int FROM system_users WHERE role = 'client' AND status = 'active') AS active_client_logins,
            (SELECT COUNT(*)::int FROM bookings) AS bookings,
            (SELECT COUNT(*)::int FROM audit_logs) AS audit_events
        `),
        pool.query(`
          SELECT
            su.id,
            su.email,
            su.role,
            su.status,
            su.must_change_password,
            su.temporary_password_expires_at,
            su.password_changed_at,
            su.session_version,
            su.last_login_at,
            su.created_at,
            cp.id AS client_profile_id,
            cp.first_name,
            cp.last_name
          FROM system_users su
          LEFT JOIN client_profiles cp
            ON cp.user_id = su.id
          ORDER BY su.created_at DESC
          LIMIT 8
        `),
        pool.query(`
          SELECT
            al.id,
            al.action,
            al.entity_type,
            al.entity_id,
            al.created_at,
            su.email AS actor_email,
            su.role AS actor_role
          FROM audit_logs al
          LEFT JOIN system_users su
            ON su.id = al.actor_user_id
          ORDER BY al.created_at DESC
          LIMIT 10
        `),
      ])

    return res.json({
      ok: true,
      developer: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
      totals: totalsResult.rows[0] || {},
      roleCounts: roleCountsResult.rows,
      statusCounts: statusCountsResult.rows,
      recentUsers: recentUsersResult.rows,
      recentAudit: recentAuditResult.rows,
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/developer/users', requireDeveloper, async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const result = await pool.query(`
      SELECT
        su.id,
        su.email,
        su.role,
        su.status,
        su.must_change_password,
        su.temporary_password_expires_at,
        su.password_changed_at,
        su.session_version,
        su.last_login_at,
        su.created_at,
        su.updated_at,
        cp.id AS client_profile_id,
        cp.first_name,
        cp.last_name,
        cp.client_status
      FROM system_users su
      LEFT JOIN client_profiles cp
        ON cp.user_id = su.id
      ORDER BY
        CASE su.role
          WHEN 'developer' THEN 1
          WHEN 'owner' THEN 2
          WHEN 'admin' THEN 3
          WHEN 'staff' THEN 4
          WHEN 'client' THEN 5
          ELSE 6
        END,
        lower(su.email)
    `)

    return res.json({
      ok: true,
      users: result.rows.map((user) => ({
        ...user,
        protected_identity: getCanonicalRoleForEmail(user.email),
      })),
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/developer/users/:userId/temporary-password', requireDeveloper, async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const parsed = z
      .object({
        expirationHours: z.coerce.number().int().min(1).max(168).optional().default(48),
      })
      .safeParse(req.body || {})

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Temporary-password validity must be between 1 and 168 hours.',
      })
    }

    const targetResult = await pool.query(
      `
      SELECT id, email, role, status
      FROM system_users
      WHERE id = $1
      LIMIT 1
      `,
      [req.params.userId],
    )

    const target = targetResult.rows[0]

    if (!target) {
      return res.status(404).json({
        ok: false,
        error: 'User account not found.',
      })
    }

    if (target.id === req.user.id) {
      return res.status(400).json({
        ok: false,
        error: 'Use the developer seed command to reset your own access safely.',
      })
    }

    if (['client', 'member'].includes(target.role)) {
      return res.status(400).json({
        ok: false,
        error: 'Client access must be managed from the Client Circle portal invitation flow.',
      })
    }

    const temporaryPassword = `Pw!${crypto.randomBytes(12).toString('base64url')}`
    const passwordHash = await bcrypt.hash(temporaryPassword, 12)

    const result = await pool.query(
      `
      UPDATE system_users
      SET
        password_hash = $2,
        status = 'active',
        must_change_password = true,
        temporary_password_expires_at = now() + ($3::text || ' hours')::interval,
        password_changed_at = NULL,
        session_version = COALESCE(session_version, 1) + 1,
        updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        email,
        role,
        status,
        must_change_password,
        temporary_password_expires_at
      `,
      [target.id, passwordHash, parsed.data.expirationHours],
    )

    const updatedUser = result.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'developer_issued_temporary_password', 'system_users', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        target.id,
        JSON.stringify({
          email: target.email,
          role: target.role,
          status: target.status,
        }),
        JSON.stringify({
          email: updatedUser.email,
          role: updatedUser.role,
          status: updatedUser.status,
          passwordChangeRequired: true,
          expiresAt: updatedUser.temporary_password_expires_at,
        }),
      ],
    )

    return res.json({
      ok: true,
      message: 'Temporary password created. It will be shown only in this response.',
      user: updatedUser,
      temporaryPassword,
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/developer/users/:userId/status', requireDeveloper, async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const parsed = z
      .object({
        status: z.enum(['active', 'suspended', 'archived']),
      })
      .safeParse(req.body || {})

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Choose active, suspended, or archived.',
      })
    }

    const targetResult = await pool.query(
      `
      SELECT id, email, role, status
      FROM system_users
      WHERE id = $1
      LIMIT 1
      `,
      [req.params.userId],
    )

    const target = targetResult.rows[0]

    if (!target) {
      return res.status(404).json({
        ok: false,
        error: 'User account not found.',
      })
    }

    if (target.id === req.user.id) {
      return res.status(400).json({
        ok: false,
        error: 'You cannot change the status of your current developer session.',
      })
    }

    const protectedIdentity = getCanonicalRoleForEmail(target.email)

    if (protectedIdentity && parsed.data.status !== 'active') {
      return res.status(400).json({
        ok: false,
        error: `The canonical ${protectedIdentity} account must remain active.`,
      })
    }

    if (target.role === 'developer' && parsed.data.status !== 'active') {
      const activeDeveloperCountResult = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM system_users
        WHERE role = 'developer'
          AND status = 'active'
      `)

      if (Number(activeDeveloperCountResult.rows[0]?.count || 0) <= 1) {
        return res.status(400).json({
          ok: false,
          error: 'The final active developer account cannot be suspended or archived.',
        })
      }
    }

    const result = await pool.query(
      `
      UPDATE system_users
      SET status = $2,
          session_version = COALESCE(session_version, 1) + 1,
          updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        email,
        role,
        status,
        must_change_password,
        temporary_password_expires_at,
        password_changed_at,
        session_version,
        last_login_at,
        created_at,
        updated_at
      `,
      [target.id, parsed.data.status],
    )

    const updatedUser = result.rows[0]

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, 'developer_changed_user_status', 'system_users', $2, $3::jsonb, $4::jsonb)
      `,
      [
        req.user.id,
        target.id,
        JSON.stringify({
          email: target.email,
          role: target.role,
          status: target.status,
        }),
        JSON.stringify({
          email: updatedUser.email,
          role: updatedUser.role,
          status: updatedUser.status,
        }),
      ],
    )

    return res.json({
      ok: true,
      message: `Account is now ${updatedUser.status}.`,
      user: updatedUser,
    })
  } catch (error) {
    return next(error)
  }
})

// developer-operations-phase-2-start
const developerAccountCreateSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(['developer', 'owner', 'admin', 'staff']),
  expirationHours: z.coerce.number().int().min(1).max(168).optional().default(48),
})

const developerRoleSchema = z.object({
  role: z.enum(['developer', 'owner', 'admin', 'staff']),
})

const developerSettingsSchema = z.object({
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().trim().min(1).max(300),
  bookingsPaused: z.boolean(),
  clientLoginsPaused: z.boolean(),
  outgoingEmailPaused: z.boolean(),
  featureFlags: z.object({
    clientMessages: z.boolean(),
    secureClientInbox: z.boolean(),
    courses: z.boolean(),
    memberships: z.boolean(),
    circleCommunity: z.boolean(),
    founderReports: z.boolean(),
    adminBroadcasts: z.boolean(),
    newClientDashboard: z.boolean(),
    experimentalScheduler: z.boolean(),
  }),
})

async function writeDeveloperAudit({
  actorUserId,
  action,
  entityType,
  entityId = null,
  beforeData = {},
  afterData = {},
}) {
  try {
    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      `,
      [
        actorUserId,
        action,
        entityType,
        entityId,
        JSON.stringify(beforeData || {}),
        JSON.stringify(afterData || {}),
      ],
    )
  } catch {
    // Developer operations should not fail only because audit logging is unavailable.
  }
}

async function getActiveDeveloperCount() {
  const result = await pool.query(`
    SELECT COUNT(*)::int AS count
    FROM system_users
    WHERE role = 'developer'
      AND status = 'active'
  `)

  return Number(result.rows[0]?.count || 0)
}

const accountGovernanceAdminSchema = z.object({
  adminUserId: z.string().uuid(),
})

const accountGovernanceCleanupSchema = accountGovernanceAdminSchema.extend({
  confirmation: z.literal('ARCHIVE'),
})

router.get('/developer/account-governance', requireDeveloper, async (req, res, next) => {
  try {
    const governance = await getAccountGovernanceSnapshot(pool)

    return res.json({
      ok: true,
      governance,
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/developer/account-governance/reconcile', requireDeveloper, async (req, res, next) => {
  try {
    const governance = await reconcileCanonicalAccounts(pool, req.user.id)

    return res.json({
      ok: true,
      message: 'Canonical Developer, Owner, and Founder availability ownership are reconciled.',
      governance,
    })
  } catch (error) {
    if (['CANONICAL_DEVELOPER_MISSING', 'CANONICAL_OWNER_MISSING'].includes(error.code)) {
      return res.status(409).json({ ok: false, error: error.message })
    }

    return next(error)
  }
})

router.patch('/developer/account-governance/admin', requireDeveloper, async (req, res, next) => {
  try {
    const parsed = accountGovernanceAdminSchema.safeParse(req.body || {})

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Choose an active Admin account.',
      })
    }

    const result = await setPermanentAdmin(pool, req.user.id, parsed.data.adminUserId)

    return res.json({
      ok: true,
      message: `${result.permanentAdmin.email} is now the permanent Admin account.`,
      ...result,
    })
  } catch (error) {
    if (['ADMIN_REQUIRED', 'INVALID_ADMIN', 'INACTIVE_ADMIN', 'CANONICAL_EMAIL_CONFLICT'].includes(error.code)) {
      return res.status(400).json({ ok: false, error: error.message })
    }

    return next(error)
  }
})

router.post('/developer/account-governance/cleanup-preview', requireDeveloper, async (req, res, next) => {
  try {
    const parsed = accountGovernanceAdminSchema.safeParse(req.body || {})

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Choose the permanent Admin account before previewing cleanup.',
      })
    }

    const preview = await previewSystemAccountCleanup(pool, parsed.data.adminUserId)

    return res.json({
      ok: true,
      preview,
    })
  } catch (error) {
    if (['ADMIN_REQUIRED', 'INVALID_ADMIN', 'INACTIVE_ADMIN', 'CANONICAL_EMAIL_CONFLICT'].includes(error.code)) {
      return res.status(400).json({ ok: false, error: error.message })
    }

    return next(error)
  }
})

router.post('/developer/account-governance/cleanup', requireDeveloper, async (req, res, next) => {
  try {
    const parsed = accountGovernanceCleanupSchema.safeParse(req.body || {})

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Choose the permanent Admin and type ARCHIVE to confirm.',
      })
    }

    const result = await applySystemAccountCleanup(
      pool,
      req.user.id,
      parsed.data.adminUserId,
    )

    return res.json({
      ok: true,
      message: `${result.count} duplicate or test system account${result.count === 1 ? '' : 's'} archived. Client accounts were not changed.`,
      ...result,
    })
  } catch (error) {
    if (['ADMIN_REQUIRED', 'INVALID_ADMIN', 'INACTIVE_ADMIN', 'CANONICAL_EMAIL_CONFLICT'].includes(error.code)) {
      return res.status(400).json({ ok: false, error: error.message })
    }

    return next(error)
  }
})

router.post('/developer/users', requireDeveloper, async (req, res, next) => {
  try {
    const parsed = developerAccountCreateSchema.safeParse(req.body || {})

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Enter a valid account email and role.',
      })
    }

    const email = parsed.data.email.toLowerCase()
    const canonicalRole = getCanonicalRoleForEmail(email)

    if (canonicalRole && parsed.data.role !== canonicalRole) {
      return res.status(400).json({
        ok: false,
        error: `${email} is reserved for the canonical ${canonicalRole} account.`,
      })
    }

    if (
      parsed.data.role === 'developer' &&
      email !== String(env.canonicalDeveloperEmail).toLowerCase()
    ) {
      return res.status(400).json({
        ok: false,
        error: `Developer access is reserved for ${env.canonicalDeveloperEmail}.`,
      })
    }

    if (
      parsed.data.role === 'owner' &&
      email !== String(env.canonicalOwnerEmail).toLowerCase()
    ) {
      return res.status(400).json({
        ok: false,
        error: `Owner access is reserved for ${env.canonicalOwnerEmail}.`,
      })
    }

    const existing = await pool.query(
      `SELECT id, email, role, status FROM system_users WHERE lower(email) = lower($1) LIMIT 1`,
      [email],
    )

    if (existing.rows[0]) {
      return res.status(409).json({
        ok: false,
        error: 'An account already exists for this email address.',
      })
    }

    const temporaryPassword = `Pw!${crypto.randomBytes(12).toString('base64url')}`
    const passwordHash = await bcrypt.hash(temporaryPassword, 12)

    const result = await pool.query(
      `
      INSERT INTO system_users (
        email,
        password_hash,
        role,
        status,
        must_change_password,
        temporary_password_expires_at,
        password_changed_at,
        session_version
      )
      VALUES (
        $1,
        $2,
        $3,
        'active',
        true,
        now() + ($4::text || ' hours')::interval,
        NULL,
        1
      )
      RETURNING
        id,
        email,
        role,
        status,
        must_change_password,
        temporary_password_expires_at,
        session_version,
        created_at
      `,
      [email, passwordHash, parsed.data.role, parsed.data.expirationHours],
    )

    const user = result.rows[0]

    if (['admin', 'staff'].includes(user.role)) {
      const defaultAccess = user.role === 'admin' ? 'manage' : 'none'

      await pool.query(
        `
        INSERT INTO team_member_profiles (
          user_id,
          display_name,
          job_title,
          department,
          availability_status,
          capacity_percent,
          is_assignable,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES (
          $1,
          split_part($2::text, '@', 1),
          $3,
          $4,
          'available',
          100,
          true,
          $5,
          $5
        )
        ON CONFLICT (user_id) DO NOTHING
        `,
        [
          user.id,
          user.email,
          user.role === 'admin' ? 'Administrator' : 'Team Member',
          user.role === 'admin' ? 'administration' : 'client_care',
          req.user.id,
        ],
      )

      await pool.query(
        `
        INSERT INTO team_member_permissions (
          user_id,
          dashboard_access,
          clients_access,
          sessions_access,
          inbox_access,
          communications_access,
          learning_access,
          memberships_access,
          circle_access,
          encouragements_access,
          audit_access,
          updated_by_user_id
        )
        VALUES (
          $1,
          $2,
          $3,
          $3,
          $3,
          $3,
          $3,
          $3,
          $3,
          $3,
          $3,
          $4
        )
        ON CONFLICT (user_id) DO NOTHING
        `,
        [
          user.id,
          user.role === 'admin' ? 'manage' : 'view',
          defaultAccess,
          req.user.id,
        ],
      )
    }

    await writeDeveloperAudit({
      actorUserId: req.user.id,
      action: 'developer_created_system_account',
      entityType: 'system_users',
      entityId: user.id,
      afterData: {
        email: user.email,
        role: user.role,
        status: user.status,
        passwordChangeRequired: true,
        expiresAt: user.temporary_password_expires_at,
      },
    })

    return res.status(201).json({
      ok: true,
      message: 'Account created. The temporary password is shown only once.',
      user,
      temporaryPassword,
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/developer/users/:userId/role', requireDeveloper, async (req, res, next) => {
  try {
    const parsed = developerRoleSchema.safeParse(req.body || {})

    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Choose a valid system role.' })
    }

    const targetResult = await pool.query(
      `SELECT id, email, role, status FROM system_users WHERE id = $1 LIMIT 1`,
      [req.params.userId],
    )
    const target = targetResult.rows[0]

    if (!target) {
      return res.status(404).json({ ok: false, error: 'User account not found.' })
    }

    if (target.id === req.user.id) {
      return res.status(400).json({
        ok: false,
        error: 'You cannot change the role of your current developer session.',
      })
    }

    if (['client', 'member'].includes(target.role)) {
      return res.status(400).json({
        ok: false,
        error: 'Client roles are managed through the Client Circle, not the system-role editor.',
      })
    }

    const protectedIdentity = getCanonicalRoleForEmail(target.email)

    if (protectedIdentity && parsed.data.role !== protectedIdentity) {
      return res.status(400).json({
        ok: false,
        error: `${target.email} is the canonical ${protectedIdentity} account and cannot be reassigned.`,
      })
    }

    if (
      parsed.data.role === 'developer' &&
      String(target.email).toLowerCase() !== String(env.canonicalDeveloperEmail).toLowerCase()
    ) {
      return res.status(400).json({
        ok: false,
        error: `Developer access is reserved for ${env.canonicalDeveloperEmail}.`,
      })
    }

    if (
      parsed.data.role === 'owner' &&
      String(target.email).toLowerCase() !== String(env.canonicalOwnerEmail).toLowerCase()
    ) {
      return res.status(400).json({
        ok: false,
        error: `Owner access is reserved for ${env.canonicalOwnerEmail}.`,
      })
    }

    if (target.role === 'developer' && parsed.data.role !== 'developer') {
      const activeDeveloperCount = await getActiveDeveloperCount()

      if (target.status === 'active' && activeDeveloperCount <= 1) {
        return res.status(400).json({
          ok: false,
          error: 'The final active developer account cannot be demoted.',
        })
      }
    }

    const result = await pool.query(
      `
      UPDATE system_users
      SET role = $2,
          session_version = COALESCE(session_version, 1) + 1,
          updated_at = now()
      WHERE id = $1
      RETURNING id, email, role, status, session_version, updated_at
      `,
      [target.id, parsed.data.role],
    )

    const updatedUser = result.rows[0]

    if (['admin', 'staff'].includes(updatedUser.role)) {
      await pool.query(
        `
        INSERT INTO team_member_profiles (
          user_id,
          display_name,
          job_title,
          department,
          availability_status,
          capacity_percent,
          is_assignable,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES (
          $1,
          split_part($2::text, '@', 1),
          $3,
          $4,
          'available',
          100,
          true,
          $5,
          $5
        )
        ON CONFLICT (user_id) DO UPDATE SET
          job_title = CASE
            WHEN EXCLUDED.job_title = 'Administrator' THEN 'Administrator'
            ELSE team_member_profiles.job_title
          END,
          department = CASE
            WHEN EXCLUDED.department = 'administration' THEN 'administration'
            ELSE team_member_profiles.department
          END,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = now()
        `,
        [
          updatedUser.id,
          updatedUser.email,
          updatedUser.role === 'admin' ? 'Administrator' : 'Team Member',
          updatedUser.role === 'admin' ? 'administration' : 'client_care',
          req.user.id,
        ],
      )

      const accessLevel = updatedUser.role === 'admin' ? 'manage' : 'none'

      await pool.query(
        `
        INSERT INTO team_member_permissions (
          user_id,
          dashboard_access,
          clients_access,
          sessions_access,
          inbox_access,
          communications_access,
          learning_access,
          memberships_access,
          circle_access,
          encouragements_access,
          audit_access,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $3, $3, $3, $3, $3, $3, $3, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
          dashboard_access = CASE WHEN $5 = 'admin' THEN 'manage' ELSE team_member_permissions.dashboard_access END,
          clients_access = CASE WHEN $5 = 'admin' THEN 'manage' ELSE team_member_permissions.clients_access END,
          sessions_access = CASE WHEN $5 = 'admin' THEN 'manage' ELSE team_member_permissions.sessions_access END,
          inbox_access = CASE WHEN $5 = 'admin' THEN 'manage' ELSE team_member_permissions.inbox_access END,
          communications_access = CASE WHEN $5 = 'admin' THEN 'manage' ELSE team_member_permissions.communications_access END,
          learning_access = CASE WHEN $5 = 'admin' THEN 'manage' ELSE team_member_permissions.learning_access END,
          memberships_access = CASE WHEN $5 = 'admin' THEN 'manage' ELSE team_member_permissions.memberships_access END,
          circle_access = CASE WHEN $5 = 'admin' THEN 'manage' ELSE team_member_permissions.circle_access END,
          encouragements_access = CASE WHEN $5 = 'admin' THEN 'manage' ELSE team_member_permissions.encouragements_access END,
          audit_access = CASE WHEN $5 = 'admin' THEN 'manage' ELSE team_member_permissions.audit_access END,
          updated_by_user_id = $4,
          updated_at = now()
        `,
        [
          updatedUser.id,
          updatedUser.role === 'admin' ? 'manage' : 'view',
          accessLevel,
          req.user.id,
          updatedUser.role,
        ],
      )
    }

    await writeDeveloperAudit({
      actorUserId: req.user.id,
      action: 'developer_changed_user_role',
      entityType: 'system_users',
      entityId: target.id,
      beforeData: target,
      afterData: updatedUser,
    })

    return res.json({
      ok: true,
      message: `Role changed to ${updatedUser.role}. Existing sessions were revoked.`,
      user: updatedUser,
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/developer/users/:userId/revoke-sessions', requireDeveloper, async (req, res, next) => {
  try {
    const targetResult = await pool.query(
      `SELECT id, email, role, status, session_version FROM system_users WHERE id = $1 LIMIT 1`,
      [req.params.userId],
    )
    const target = targetResult.rows[0]

    if (!target) {
      return res.status(404).json({ ok: false, error: 'User account not found.' })
    }

    if (target.id === req.user.id) {
      return res.status(400).json({
        ok: false,
        error: 'Use Sign Out for your current developer session.',
      })
    }

    const result = await pool.query(
      `
      UPDATE system_users
      SET session_version = COALESCE(session_version, 1) + 1,
          updated_at = now()
      WHERE id = $1
      RETURNING id, email, role, status, session_version, updated_at
      `,
      [target.id],
    )

    await writeDeveloperAudit({
      actorUserId: req.user.id,
      action: 'developer_revoked_user_sessions',
      entityType: 'system_users',
      entityId: target.id,
      beforeData: { sessionVersion: target.session_version },
      afterData: { sessionVersion: result.rows[0].session_version },
    })

    return res.json({
      ok: true,
      message: `All active sessions for ${target.email} were revoked.`,
      user: result.rows[0],
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/developer/client-access', requireDeveloper, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        cp.id AS client_profile_id,
        cp.first_name,
        cp.last_name,
        cp.client_status,
        cp.public_contact_email,
        cp.updated_at AS profile_updated_at,
        su.id AS user_id,
        su.email,
        su.status AS account_status,
        su.last_login_at,
        su.password_changed_at,
        su.session_version,
        invite.id AS latest_invite_id,
        invite.status AS latest_invite_status,
        invite.expires_at AS latest_invite_expires_at,
        invite.created_at AS latest_invite_created_at,
        COALESCE(resource_counts.active_resources, 0)::int AS active_resources,
        COALESCE(booking_counts.upcoming_sessions, 0)::int AS upcoming_sessions,
        COALESCE(message_counts.published_messages, 0)::int AS published_messages
      FROM client_profiles cp
      LEFT JOIN system_users su
        ON su.id = cp.user_id
      LEFT JOIN LATERAL (
        SELECT id, status, expires_at, created_at
        FROM client_portal_invites
        WHERE client_profile_id = cp.id
        ORDER BY created_at DESC
        LIMIT 1
      ) invite ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS active_resources
        FROM client_portal_resources
        WHERE client_profile_id = cp.id
          AND status = 'active'
      ) resource_counts ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS upcoming_sessions
        FROM bookings
        WHERE client_profile_id = cp.id
          AND starts_at >= now()
          AND status IN ('requested', 'approved', 'confirmed')
      ) booking_counts ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS published_messages
        FROM encouragement_posts ep
        WHERE ep.status = 'published'
          AND (
            ep.visibility = 'all_members'
            OR EXISTS (
              SELECT 1
              FROM encouragement_recipients er
              WHERE er.encouragement_post_id = ep.id
                AND er.client_profile_id = cp.id
            )
          )
      ) message_counts ON true
      ORDER BY lower(COALESCE(cp.last_name, '')), lower(COALESCE(cp.first_name, '')), cp.created_at DESC
    `)

    const clients = result.rows.map((client) => {
      const issues = []
      const inviteExpired =
        client.latest_invite_status === 'pending' &&
        client.latest_invite_expires_at &&
        new Date(client.latest_invite_expires_at).getTime() <= Date.now()

      if (!client.user_id) issues.push('No portal account')
      if (client.user_id && client.account_status !== 'active') issues.push('Login is not active')
      if (client.user_id && !client.password_changed_at) issues.push('Password setup is incomplete')
      if (inviteExpired) issues.push('Latest invitation expired')
      if (client.user_id && !client.last_login_at) issues.push('Client has never signed in')

      return {
        ...client,
        readiness: issues.length === 0 ? 'ready' : 'needs_attention',
        issues,
      }
    })

    return res.json({ ok: true, clients })
  } catch (error) {
    return next(error)
  }
})

router.get('/developer/system-health', requireDeveloper, async (req, res, next) => {
  const startedAt = Date.now()

  try {
    const databaseResult = await pool.query(`SELECT now() AS database_time`)
    const databaseLatencyMs = Date.now() - startedAt
    const settings = await getPlatformSettings(pool)

    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name
    `, [[
      'system_users',
      'client_profiles',
      'bookings',
      'booking_change_requests',
      'audit_logs',
      'client_portal_invites',
      'client_portal_resources',
      'encouragement_posts',
      'platform_settings',
      'courses',
      'course_modules',
      'course_lessons',
      'course_access',
      'lesson_progress',
      'memberships',
      'membership_enrollments',
      'circle_posts',
      'circle_comments',
      'client_conversations',
      'client_conversation_messages',
      'notifications',
      'notification_preferences',
      'team_member_profiles',
      'team_member_permissions',
      'team_client_assignments',
    ]])

    const requiredTables = [
      'system_users',
      'client_profiles',
      'bookings',
      'booking_change_requests',
      'audit_logs',
      'client_portal_invites',
      'client_portal_resources',
      'encouragement_posts',
      'platform_settings',
      'courses',
      'course_modules',
      'course_lessons',
      'course_access',
      'lesson_progress',
      'memberships',
      'membership_enrollments',
      'circle_posts',
      'circle_comments',
      'client_conversations',
      'client_conversation_messages',
      'notifications',
      'notification_preferences',
      'team_member_profiles',
      'team_member_permissions',
      'team_client_assignments',
    ]
    const foundTables = new Set(tablesResult.rows.map((row) => row.table_name))
    const missingTables = requiredTables.filter((tableName) => !foundTables.has(tableName))
    const memory = process.memoryUsage()

    const securityEventsResult = await pool.query(`
      SELECT
        al.id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.created_at,
        su.email AS actor_email,
        su.role AS actor_role
      FROM audit_logs al
      LEFT JOIN system_users su ON su.id = al.actor_user_id
      WHERE
        al.action ILIKE '%denied%'
        OR al.action ILIKE '%password%'
        OR al.action ILIKE '%session%'
        OR al.action ILIKE '%status%'
        OR al.action ILIKE '%role%'
      ORDER BY al.created_at DESC
      LIMIT 20
    `)

    return res.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      status: missingTables.length === 0 ? 'healthy' : 'needs_attention',
      database: {
        connected: true,
        latencyMs: databaseLatencyMs,
        time: databaseResult.rows[0]?.database_time,
        missingTables,
      },
      application: {
        environment: env.nodeEnv,
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        memoryRssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
      },
      configuration: {
        databaseConfigured: Boolean(env.databaseUrl),
        secureJwtConfigured: env.jwtSecret !== 'change-this-dev-secret-before-production',
        emailProviderConfigured: Boolean(env.resendApiKey && env.portalEmailFrom),
        allowedClientOrigins: env.clientOrigins,
        secureCookies: env.cookieSecure,
        sameSite: env.cookieSameSite,
      },
      settings,
      securityEvents: securityEventsResult.rows,
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/developer/settings', requireDeveloper, async (req, res, next) => {
  try {
    const settings = await getPlatformSettings(pool)
    return res.json({ ok: true, settings })
  } catch (error) {
    return next(error)
  }
})

router.patch('/developer/settings', requireDeveloper, async (req, res, next) => {
  try {
    const parsed = developerSettingsSchema.safeParse(req.body || {})

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Review the platform controls.',
      })
    }

    const before = await getPlatformSettings(pool)
    const saved = await savePlatformSettings(
      normalizePlatformSettings(parsed.data),
      req.user.id,
      pool,
    )

    await writeDeveloperAudit({
      actorUserId: req.user.id,
      action: 'developer_updated_platform_controls',
      entityType: 'platform_settings',
      beforeData: before,
      afterData: saved.value,
    })

    return res.json({
      ok: true,
      message: 'Platform controls were saved.',
      settings: saved.value,
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/developer/preview/founder', requireDeveloper, async (req, res, next) => {
  try {
    const [sessionsResult, followUpsResult, totalsResult] = await Promise.all([
      pool.query(`
        SELECT
          b.id,
          b.starts_at,
          b.ends_at,
          b.status,
          COALESCE(cp.first_name || ' ' || cp.last_name, b.guest_name, b.guest_email) AS client_name,
          at.name AS appointment_type_name
        FROM bookings b
        LEFT JOIN client_profiles cp ON cp.id = b.client_profile_id
        LEFT JOIN appointment_types at ON at.id = b.appointment_type_id
        WHERE b.starts_at >= now()
          AND b.status IN ('requested', 'approved', 'confirmed')
        ORDER BY b.starts_at ASC
        LIMIT 8
      `),
      pool.query(`
        SELECT
          sr.id,
          sr.client_profile_id,
          sr.title,
          sr.service_name,
          sr.follow_up_at,
          COALESCE(cp.first_name || ' ' || cp.last_name, 'Client') AS client_name
        FROM service_records sr
        INNER JOIN client_profiles cp ON cp.id = sr.client_profile_id
        WHERE sr.follow_up_at IS NOT NULL
          AND sr.follow_up_at <= now() + interval '14 days'
          AND sr.status <> 'archived'
        ORDER BY sr.follow_up_at ASC
        LIMIT 8
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM client_profiles WHERE client_status IN ('active_client', 'member')) AS active_clients,
          (SELECT COUNT(*)::int FROM bookings WHERE status = 'requested') AS booking_decisions,
          (SELECT COUNT(*)::int FROM service_records WHERE follow_up_at IS NOT NULL AND follow_up_at <= now() + interval '14 days' AND status <> 'archived') AS follow_ups
      `),
    ])

    return res.json({
      ok: true,
      preview: {
        type: 'founder',
        readOnly: true,
        banner: 'Developer read-only preview — actions are disabled.',
        totals: totalsResult.rows[0] || {},
        sessions: sessionsResult.rows,
        followUps: followUpsResult.rows,
      },
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/developer/preview/client/:clientProfileId', requireDeveloper, async (req, res, next) => {
  try {
    await publishDueEncouragements(pool)

    const profileResult = await pool.query(
      `
      SELECT
        cp.id,
        cp.first_name,
        cp.last_name,
        cp.client_status,
        cp.client_visible_notes,
        cp.public_contact_email,
        cp.phone,
        su.email,
        su.status AS portal_status,
        su.last_login_at
      FROM client_profiles cp
      LEFT JOIN system_users su ON su.id = cp.user_id
      WHERE cp.id = $1
      LIMIT 1
      `,
      [req.params.clientProfileId],
    )

    const profile = profileResult.rows[0]

    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Client profile not found.' })
    }

    const [
      resourcesResult,
      sessionsResult,
      messagesResult,
      journeyResult,
      memberships,
      courses,
      circleMemberships,
      conversationsResult,
    ] = await Promise.all([
      pool.query(`
        SELECT id, title, resource_type, description, resource_url, created_at
        FROM client_portal_resources
        WHERE client_profile_id = $1
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 10
      `, [profile.id]),
      pool.query(`
        SELECT b.id, b.starts_at, b.ends_at, b.status, at.name AS appointment_type_name
        FROM bookings b
        LEFT JOIN appointment_types at ON at.id = b.appointment_type_id
        WHERE b.client_profile_id = $1
        ORDER BY b.starts_at DESC
        LIMIT 10
      `, [profile.id]),
      pool.query(`
        SELECT ep.id, ep.title, ep.body, ep.published_at, ep.created_at
        FROM encouragement_posts ep
        WHERE ep.status = 'published'
          AND (
            ep.visibility = 'all_members'
            OR EXISTS (
              SELECT 1 FROM encouragement_recipients er
              WHERE er.encouragement_post_id = ep.id
                AND er.client_profile_id = $1
            )
          )
        ORDER BY COALESCE(ep.published_at, ep.created_at) DESC
        LIMIT 10
      `, [profile.id]),
      pool.query(`
        SELECT id, title, service_name, status, client_visible_notes, service_date, follow_up_at
        FROM service_records
        WHERE client_profile_id = $1
          AND status <> 'archived'
        ORDER BY COALESCE(service_date, created_at) DESC
        LIMIT 10
      `, [profile.id]),
      listClientMemberships(profile.id, pool),
      listClientCourses(profile.id, pool),
      getActiveCircleMemberships(profile.id, pool),
      pool.query(`
        SELECT
          cc.id,
          cc.subject,
          cc.status,
          cc.priority,
          cc.last_message_at,
          cc.updated_at,
          COALESCE(message_counts.message_count, 0)::int AS message_count
        FROM client_conversations cc
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS message_count
          FROM client_conversation_messages ccm
          WHERE ccm.conversation_id = cc.id
            AND ccm.is_internal_note = false
        ) message_counts ON true
        WHERE cc.client_profile_id = $1
        ORDER BY cc.last_message_at DESC, cc.updated_at DESC
        LIMIT 10
      `, [profile.id]),
    ])

    return res.json({
      ok: true,
      preview: {
        type: 'client',
        readOnly: true,
        banner: 'Developer read-only preview — no client action will be recorded.',
        profile,
        summary: {
          membershipCount: memberships.length,
          courseCount: courses.length,
          conversationCount: conversationsResult.rows.length,
        },
        resources: resourcesResult.rows,
        sessions: sessionsResult.rows,
        messages: messagesResult.rows,
        journey: journeyResult.rows,
        memberships,
        courses,
        circleMemberships,
        conversations: conversationsResult.rows,
      },
    })
  } catch (error) {
    return next(error)
  }
})
// developer-operations-phase-2-end

// developer-control-center-end

// learning-library-pass-18-start
const learningCourseSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(6000).optional().default(''),
  category: z.string().trim().max(80).optional().default('Personal Growth'),
  coverImageUrl: z.string().trim().max(1200).optional().default(''),
  estimatedMinutes: z.coerce.number().int().min(5).max(10000).optional().default(30),
  accessMode: z.enum(['all_clients', 'assigned_clients']).optional().default('assigned_clients'),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
})

const learningCourseUpdateSchema = learningCourseSchema.partial()

const learningModuleSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(3000).optional().default(''),
  position: z.coerce.number().int().min(0).max(10000).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
})

const learningModuleUpdateSchema = learningModuleSchema.partial()

const learningLessonSchema = z.object({
  title: z.string().trim().min(1).max(160),
  lessonType: z.enum(['text', 'video', 'download', 'reflection']).optional().default('text'),
  content: z.string().trim().max(30000).optional().default(''),
  externalUrl: z.string().trim().max(2000).optional().default(''),
  estimatedMinutes: z.coerce.number().int().min(1).max(1000).optional().default(5),
  isPreview: z.coerce.boolean().optional().default(false),
  position: z.coerce.number().int().min(0).max(10000).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
})

const learningLessonUpdateSchema = learningLessonSchema.partial()

const learningAccessSchema = z.object({
  accessMode: z.enum(['all_clients', 'assigned_clients']),
  clientProfileIds: z.array(z.string().uuid()).max(500).optional().default([]),
})

async function writeLearningAudit({
  actorUserId,
  action,
  entityType,
  entityId = null,
  beforeData = {},
  afterData = {},
}) {
  try {
    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      `,
      [
        actorUserId,
        action,
        entityType,
        entityId,
        JSON.stringify(beforeData || {}),
        JSON.stringify(afterData || {}),
      ],
    )
  } catch {
    // Learning management must remain usable if audit storage is temporarily unavailable.
  }
}

router.get('/learning-library', requireAdmin, async (req, res, next) => {
  try {
    const [courses, clientsResult, settings] = await Promise.all([
      listAdminCourses(pool),
      pool.query(`
        SELECT
          cp.id,
          cp.first_name,
          cp.last_name,
          cp.client_status,
          su.email,
          su.status AS account_status
        FROM client_profiles cp
        LEFT JOIN system_users su ON su.id = cp.user_id
        WHERE cp.client_status <> 'archived'
        ORDER BY cp.first_name, cp.last_name, su.email
        LIMIT 500
      `),
      getPlatformSettings(pool),
    ])

    return res.json({
      ok: true,
      courses,
      clients: clientsResult.rows,
      featureEnabled: Boolean(settings.featureFlags?.courses),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/learning-library/:courseId', requireAdmin, async (req, res, next) => {
  try {
    const course = await getCourseTree(req.params.courseId, {}, pool)

    if (!course) {
      return res.status(404).json({
        ok: false,
        error: 'Learning program not found.',
      })
    }

    return res.json({ ok: true, course })
  } catch (error) {
    return next(error)
  }
})

router.post('/learning-library', requireAdmin, async (req, res, next) => {
  const parsed = learningCourseSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the learning program details.',
    })
  }

  try {
    const payload = parsed.data
    const slug = await createUniqueCourseSlug(payload.title, null, pool)

    const result = await pool.query(
      `
      INSERT INTO courses (
        title,
        slug,
        description,
        status,
        category,
        cover_image_url,
        estimated_minutes,
        access_mode,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        payload.title,
        slug,
        payload.description || null,
        payload.status,
        payload.category || 'Personal Growth',
        payload.coverImageUrl || null,
        payload.estimatedMinutes,
        payload.accessMode,
        req.user.id,
      ],
    )

    const course = result.rows[0]

    await writeLearningAudit({
      actorUserId: req.user.id,
      action: 'learning_course_created',
      entityType: 'courses',
      entityId: course.id,
      afterData: course,
    })

    return res.status(201).json({
      ok: true,
      message: 'Learning program created as a draft.',
      course,
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/learning-library/:courseId', requireAdmin, async (req, res, next) => {
  const parsed = learningCourseUpdateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the learning program details.',
    })
  }

  try {
    const beforeResult = await pool.query('SELECT * FROM courses WHERE id = $1 LIMIT 1', [
      req.params.courseId,
    ])
    const before = beforeResult.rows[0]

    if (!before) {
      return res.status(404).json({ ok: false, error: 'Learning program not found.' })
    }

    const payload = parsed.data
    const nextTitle = payload.title ?? before.title
    const nextSlug =
      payload.title && payload.title !== before.title
        ? await createUniqueCourseSlug(payload.title, before.id, pool)
        : before.slug

    const result = await pool.query(
      `
      UPDATE courses
      SET
        title = $2,
        slug = $3,
        description = $4,
        category = $5,
        cover_image_url = $6,
        estimated_minutes = $7,
        access_mode = $8,
        status = $9,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        before.id,
        nextTitle,
        nextSlug,
        payload.description ?? before.description,
        payload.category ?? before.category,
        payload.coverImageUrl !== undefined
          ? payload.coverImageUrl || null
          : before.cover_image_url,
        payload.estimatedMinutes ?? before.estimated_minutes,
        payload.accessMode ?? before.access_mode,
        payload.status ?? before.status,
      ],
    )

    const course = result.rows[0]

    await writeLearningAudit({
      actorUserId: req.user.id,
      action: 'learning_course_updated',
      entityType: 'courses',
      entityId: course.id,
      beforeData: before,
      afterData: course,
    })

    return res.json({
      ok: true,
      message: 'Learning program saved.',
      course,
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/learning-library/:courseId/publish', requireAdmin, async (req, res, next) => {
  const dbClient = await pool.connect()

  try {
    await dbClient.query('BEGIN')

    const lessonCountResult = await dbClient.query(
      `
      SELECT COUNT(*)::int AS count
      FROM course_lessons cl
      JOIN course_modules cm ON cm.id = cl.module_id
      WHERE cm.course_id = $1
        AND cm.status <> 'archived'
        AND cl.status <> 'archived'
      `,
      [req.params.courseId],
    )

    if ((lessonCountResult.rows[0]?.count || 0) === 0) {
      await dbClient.query('ROLLBACK')
      return res.status(400).json({
        ok: false,
        error: 'Add at least one lesson before publishing this learning program.',
      })
    }

    const beforeResult = await dbClient.query('SELECT * FROM courses WHERE id = $1 LIMIT 1', [
      req.params.courseId,
    ])
    const before = beforeResult.rows[0]

    if (!before) {
      await dbClient.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Learning program not found.' })
    }

    await dbClient.query(
      `
      UPDATE course_modules
      SET status = 'published', updated_at = now()
      WHERE course_id = $1
        AND status = 'draft'
      `,
      [before.id],
    )

    await dbClient.query(
      `
      UPDATE course_lessons
      SET status = 'published', updated_at = now()
      WHERE module_id IN (
        SELECT id FROM course_modules WHERE course_id = $1
      )
        AND status = 'draft'
      `,
      [before.id],
    )

    const result = await dbClient.query(
      `
      UPDATE courses
      SET status = 'published', updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [before.id],
    )

    await dbClient.query('COMMIT')

    const course = result.rows[0]

    await writeLearningAudit({
      actorUserId: req.user.id,
      action: 'learning_course_published',
      entityType: 'courses',
      entityId: course.id,
      beforeData: before,
      afterData: course,
    })

    return res.json({
      ok: true,
      message: 'Learning program is now available to its audience.',
      course,
    })
  } catch (error) {
    await dbClient.query('ROLLBACK')
    return next(error)
  } finally {
    dbClient.release()
  }
})

router.post('/learning-library/:courseId/archive', requireAdmin, async (req, res, next) => {
  try {
    const beforeResult = await pool.query('SELECT * FROM courses WHERE id = $1 LIMIT 1', [
      req.params.courseId,
    ])
    const before = beforeResult.rows[0]

    if (!before) {
      return res.status(404).json({ ok: false, error: 'Learning program not found.' })
    }

    const result = await pool.query(
      `
      UPDATE courses
      SET status = 'archived', updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [before.id],
    )

    await writeLearningAudit({
      actorUserId: req.user.id,
      action: 'learning_course_archived',
      entityType: 'courses',
      entityId: before.id,
      beforeData: before,
      afterData: result.rows[0],
    })

    return res.json({
      ok: true,
      message: 'Learning program archived and removed from client view.',
      course: result.rows[0],
    })
  } catch (error) {
    return next(error)
  }
})

router.delete('/learning-library/:courseId', requireAdmin, async (req, res, next) => {
  try {
    const beforeResult = await pool.query('SELECT * FROM courses WHERE id = $1 LIMIT 1', [
      req.params.courseId,
    ])
    const before = beforeResult.rows[0]

    if (!before) {
      return res.status(404).json({ ok: false, error: 'Learning program not found.' })
    }

    if (before.status === 'published') {
      return res.status(409).json({
        ok: false,
        error: 'Archive this learning program before deleting it permanently.',
      })
    }

    await pool.query('DELETE FROM courses WHERE id = $1', [before.id])

    await writeLearningAudit({
      actorUserId: req.user.id,
      action: 'learning_course_deleted',
      entityType: 'courses',
      entityId: before.id,
      beforeData: before,
    })

    return res.json({ ok: true, message: 'Learning program permanently deleted.' })
  } catch (error) {
    return next(error)
  }
})

router.post('/learning-library/:courseId/modules', requireAdmin, async (req, res, next) => {
  const parsed = learningModuleSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the module details.',
    })
  }

  try {
    const payload = parsed.data
    const positionResult = await pool.query(
      `
      SELECT COALESCE(MAX(position), -1) + 1 AS next_position
      FROM course_modules
      WHERE course_id = $1
      `,
      [req.params.courseId],
    )

    const result = await pool.query(
      `
      INSERT INTO course_modules (
        course_id,
        title,
        description,
        position,
        status
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        req.params.courseId,
        payload.title,
        payload.description || null,
        payload.position ?? positionResult.rows[0]?.next_position ?? 0,
        payload.status,
      ],
    )

    const module = result.rows[0]

    await writeLearningAudit({
      actorUserId: req.user.id,
      action: 'learning_module_created',
      entityType: 'course_modules',
      entityId: module.id,
      afterData: module,
    })

    return res.status(201).json({ ok: true, message: 'Module added.', module })
  } catch (error) {
    return next(error)
  }
})

router.patch('/learning-library/modules/:moduleId', requireAdmin, async (req, res, next) => {
  const parsed = learningModuleUpdateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the module details.',
    })
  }

  try {
    const beforeResult = await pool.query('SELECT * FROM course_modules WHERE id = $1 LIMIT 1', [
      req.params.moduleId,
    ])
    const before = beforeResult.rows[0]

    if (!before) return res.status(404).json({ ok: false, error: 'Module not found.' })

    const payload = parsed.data
    const result = await pool.query(
      `
      UPDATE course_modules
      SET
        title = $2,
        description = $3,
        position = $4,
        status = $5,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        before.id,
        payload.title ?? before.title,
        payload.description ?? before.description,
        payload.position ?? before.position,
        payload.status ?? before.status,
      ],
    )

    await writeLearningAudit({
      actorUserId: req.user.id,
      action: 'learning_module_updated',
      entityType: 'course_modules',
      entityId: before.id,
      beforeData: before,
      afterData: result.rows[0],
    })

    return res.json({ ok: true, message: 'Module saved.', module: result.rows[0] })
  } catch (error) {
    return next(error)
  }
})

router.delete('/learning-library/modules/:moduleId', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM course_modules WHERE id = $1 RETURNING *',
      [req.params.moduleId],
    )
    const module = result.rows[0]

    if (!module) return res.status(404).json({ ok: false, error: 'Module not found.' })

    await writeLearningAudit({
      actorUserId: req.user.id,
      action: 'learning_module_deleted',
      entityType: 'course_modules',
      entityId: module.id,
      beforeData: module,
    })

    return res.json({ ok: true, message: 'Module and its lessons deleted.' })
  } catch (error) {
    return next(error)
  }
})

router.post('/learning-library/modules/:moduleId/lessons', requireAdmin, async (req, res, next) => {
  const parsed = learningLessonSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the lesson details.',
    })
  }

  try {
    const payload = parsed.data
    const positionResult = await pool.query(
      `
      SELECT COALESCE(MAX(position), -1) + 1 AS next_position
      FROM course_lessons
      WHERE module_id = $1
      `,
      [req.params.moduleId],
    )

    const result = await pool.query(
      `
      INSERT INTO course_lessons (
        module_id,
        title,
        lesson_type,
        content_html,
        video_url,
        external_url,
        estimated_minutes,
        is_preview,
        position,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        req.params.moduleId,
        payload.title,
        payload.lessonType,
        payload.content || null,
        payload.lessonType === 'video' ? payload.externalUrl || null : null,
        payload.externalUrl || null,
        payload.estimatedMinutes,
        payload.isPreview,
        payload.position ?? positionResult.rows[0]?.next_position ?? 0,
        payload.status,
      ],
    )

    const lesson = result.rows[0]

    await writeLearningAudit({
      actorUserId: req.user.id,
      action: 'learning_lesson_created',
      entityType: 'course_lessons',
      entityId: lesson.id,
      afterData: lesson,
    })

    return res.status(201).json({ ok: true, message: 'Lesson added.', lesson })
  } catch (error) {
    return next(error)
  }
})

router.patch('/learning-library/lessons/:lessonId', requireAdmin, async (req, res, next) => {
  const parsed = learningLessonUpdateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the lesson details.',
    })
  }

  try {
    const beforeResult = await pool.query('SELECT * FROM course_lessons WHERE id = $1 LIMIT 1', [
      req.params.lessonId,
    ])
    const before = beforeResult.rows[0]

    if (!before) return res.status(404).json({ ok: false, error: 'Lesson not found.' })

    const payload = parsed.data
    const nextType = payload.lessonType ?? before.lesson_type
    const nextUrl =
      payload.externalUrl !== undefined ? payload.externalUrl || null : before.external_url

    const result = await pool.query(
      `
      UPDATE course_lessons
      SET
        title = $2,
        lesson_type = $3,
        content_html = $4,
        video_url = $5,
        external_url = $6,
        estimated_minutes = $7,
        is_preview = $8,
        position = $9,
        status = $10,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        before.id,
        payload.title ?? before.title,
        nextType,
        payload.content ?? before.content_html,
        nextType === 'video' ? nextUrl : null,
        nextUrl,
        payload.estimatedMinutes ?? before.estimated_minutes,
        payload.isPreview ?? before.is_preview,
        payload.position ?? before.position,
        payload.status ?? before.status,
      ],
    )

    await writeLearningAudit({
      actorUserId: req.user.id,
      action: 'learning_lesson_updated',
      entityType: 'course_lessons',
      entityId: before.id,
      beforeData: before,
      afterData: result.rows[0],
    })

    return res.json({ ok: true, message: 'Lesson saved.', lesson: result.rows[0] })
  } catch (error) {
    return next(error)
  }
})

router.delete('/learning-library/lessons/:lessonId', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM course_lessons WHERE id = $1 RETURNING *',
      [req.params.lessonId],
    )
    const lesson = result.rows[0]

    if (!lesson) return res.status(404).json({ ok: false, error: 'Lesson not found.' })

    await writeLearningAudit({
      actorUserId: req.user.id,
      action: 'learning_lesson_deleted',
      entityType: 'course_lessons',
      entityId: lesson.id,
      beforeData: lesson,
    })

    return res.json({ ok: true, message: 'Lesson deleted.' })
  } catch (error) {
    return next(error)
  }
})

router.put('/learning-library/:courseId/access', requireAdmin, async (req, res, next) => {
  const parsed = learningAccessSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the audience selection.',
    })
  }

  const dbClient = await pool.connect()

  try {
    await dbClient.query('BEGIN')

    const beforeResult = await dbClient.query(
      `
      SELECT c.*, COALESCE(json_agg(ca.client_profile_id) FILTER (WHERE ca.id IS NOT NULL), '[]') AS client_ids
      FROM courses c
      LEFT JOIN course_access ca
        ON ca.course_id = c.id
        AND ca.access_status = 'active'
      WHERE c.id = $1
      GROUP BY c.id
      LIMIT 1
      `,
      [req.params.courseId],
    )
    const before = beforeResult.rows[0]

    if (!before) {
      await dbClient.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Learning program not found.' })
    }

    await dbClient.query(
      'UPDATE courses SET access_mode = $2, updated_at = now() WHERE id = $1',
      [before.id, parsed.data.accessMode],
    )

    await dbClient.query('DELETE FROM course_access WHERE course_id = $1', [before.id])

    if (
      parsed.data.accessMode === 'assigned_clients' &&
      parsed.data.clientProfileIds.length > 0
    ) {
      await dbClient.query(
        `
        INSERT INTO course_access (
          course_id,
          client_profile_id,
          access_status,
          granted_by,
          granted_at
        )
        SELECT $1, client_id, 'active', $2, now()
        FROM unnest($3::uuid[]) AS client_id
        ON CONFLICT (course_id, client_profile_id)
        DO UPDATE SET
          access_status = 'active',
          granted_by = EXCLUDED.granted_by,
          granted_at = now(),
          expires_at = NULL
        `,
        [before.id, req.user.id, parsed.data.clientProfileIds],
      )
    }

    await dbClient.query('COMMIT')

    await writeLearningAudit({
      actorUserId: req.user.id,
      action: 'learning_course_access_updated',
      entityType: 'courses',
      entityId: before.id,
      beforeData: {
        accessMode: before.access_mode,
        clientProfileIds: before.client_ids,
      },
      afterData: parsed.data,
    })

    const course = await getCourseTree(before.id, {}, pool)

    return res.json({
      ok: true,
      message:
        parsed.data.accessMode === 'all_clients'
          ? 'This program is available to all active client portal users.'
          : 'Client access was updated.',
      course,
    })
  } catch (error) {
    await dbClient.query('ROLLBACK')
    return next(error)
  } finally {
    dbClient.release()
  }
})
// learning-library-pass-18-end


// membership-circle-pass-19-start
const membershipPlanSchema = z.object({
  name: z.string().trim().min(1).max(140),
  tagline: z.string().trim().max(240).optional().default(''),
  description: z.string().trim().max(8000).optional().default(''),
  benefits: z.array(z.string().trim().min(1).max(240)).max(30).optional().default([]),
  welcomeMessage: z.string().trim().max(8000).optional().default(''),
  priceCents: z.coerce.number().int().min(0).max(100000000).nullable().optional(),
  currency: z.string().trim().min(3).max(3).optional().default('USD'),
  billingInterval: z.enum(['one_time', 'monthly', 'quarterly', 'yearly']).nullable().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional().default('draft'),
})

const membershipPlanUpdateSchema = membershipPlanSchema.partial()

const membershipEnrollmentSchema = z.object({
  clientProfileId: z.string().uuid(),
  status: z.enum(['active', 'paused', 'cancelled', 'expired']).optional().default('active'),
  startedAt: z.string().datetime({ offset: true }).nullable().optional(),
  renewalAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().trim().max(3000).optional().default(''),
})

const membershipEnrollmentUpdateSchema = membershipEnrollmentSchema
  .omit({ clientProfileId: true })
  .partial()

const membershipCourseAccessSchema = z.object({
  courseIds: z.array(z.string().uuid()).max(200).optional().default([]),
})

const membershipResourceSchema = z.object({
  title: z.string().trim().min(1).max(180),
  resourceType: z
    .enum(['guide', 'worksheet', 'link', 'video', 'download', 'note'])
    .optional()
    .default('link'),
  description: z.string().trim().max(4000).optional().default(''),
  resourceUrl: z.string().trim().max(2000).optional().default(''),
  status: z.enum(['active', 'archived']).optional().default('active'),
  position: z.coerce.number().int().min(0).max(10000).optional().default(0),
})

const membershipResourceUpdateSchema = membershipResourceSchema.partial()

const membershipAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().min(1).max(12000),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
})

const membershipAnnouncementUpdateSchema = membershipAnnouncementSchema.partial()

async function writeMembershipAudit({
  actorUserId,
  action,
  entityType,
  entityId = null,
  beforeData = {},
  afterData = {},
}) {
  try {
    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      `,
      [
        actorUserId,
        action,
        entityType,
        entityId,
        JSON.stringify(beforeData || {}),
        JSON.stringify(afterData || {}),
      ],
    )
  } catch {
    // Membership care must remain usable if the audit store is briefly unavailable.
  }
}

router.get('/memberships', requireAdmin, async (req, res, next) => {
  try {
    const [memberships, clientsResult, coursesResult, settings] = await Promise.all([
      listAdminMemberships(pool),
      pool.query(`
        SELECT
          cp.id,
          cp.first_name,
          cp.last_name,
          cp.client_status,
          su.email,
          su.status AS account_status
        FROM client_profiles cp
        LEFT JOIN system_users su ON su.id = cp.user_id
        WHERE cp.client_status <> 'archived'
        ORDER BY cp.first_name, cp.last_name, su.email
        LIMIT 500
      `),
      pool.query(`
        SELECT id, title, category, status, estimated_minutes
        FROM courses
        WHERE status <> 'archived'
        ORDER BY title
      `),
      getPlatformSettings(pool),
    ])

    return res.json({
      ok: true,
      memberships,
      clients: clientsResult.rows,
      courses: coursesResult.rows,
      featureEnabled: Boolean(settings.featureFlags?.memberships),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/memberships/:membershipId', requireAdmin, async (req, res, next) => {
  try {
    const membership = await getMembershipDetail(req.params.membershipId, pool)

    if (!membership) {
      return res.status(404).json({ ok: false, error: 'Membership plan not found.' })
    }

    return res.json({ ok: true, membership })
  } catch (error) {
    return next(error)
  }
})

router.post('/memberships', requireAdmin, async (req, res, next) => {
  const parsed = membershipPlanSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the membership details.',
    })
  }

  try {
    const payload = parsed.data
    const slug = await createUniqueMembershipSlug(payload.name, null, pool)
    const result = await pool.query(
      `
      INSERT INTO memberships (
        name,
        slug,
        tagline,
        description,
        benefits,
        welcome_message,
        status,
        price_cents,
        currency,
        billing_interval,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $11)
      RETURNING *
      `,
      [
        payload.name,
        slug,
        payload.tagline || null,
        payload.description || null,
        JSON.stringify(payload.benefits || []),
        payload.welcomeMessage || null,
        payload.status,
        payload.priceCents ?? null,
        String(payload.currency || 'USD').toUpperCase(),
        payload.billingInterval || null,
        req.user.id,
      ],
    )

    const membership = result.rows[0]

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_created',
      entityType: 'memberships',
      entityId: membership.id,
      afterData: membership,
    })

    return res.status(201).json({
      ok: true,
      message: 'Membership plan created as a draft.',
      membership,
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/memberships/:membershipId', requireAdmin, async (req, res, next) => {
  const parsed = membershipPlanUpdateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the membership details.',
    })
  }

  try {
    const beforeResult = await pool.query(
      'SELECT * FROM memberships WHERE id = $1 LIMIT 1',
      [req.params.membershipId],
    )
    const before = beforeResult.rows[0]

    if (!before) {
      return res.status(404).json({ ok: false, error: 'Membership plan not found.' })
    }

    const payload = parsed.data
    const nextName = payload.name ?? before.name
    const nextSlug =
      payload.name && payload.name !== before.name
        ? await createUniqueMembershipSlug(payload.name, before.id, pool)
        : before.slug

    const result = await pool.query(
      `
      UPDATE memberships
      SET
        name = $2,
        slug = $3,
        tagline = $4,
        description = $5,
        benefits = $6::jsonb,
        welcome_message = $7,
        status = $8,
        price_cents = $9,
        currency = $10,
        billing_interval = $11,
        updated_by = $12,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        before.id,
        nextName,
        nextSlug,
        payload.tagline !== undefined ? payload.tagline || null : before.tagline,
        payload.description !== undefined ? payload.description || null : before.description,
        JSON.stringify(payload.benefits ?? before.benefits ?? []),
        payload.welcomeMessage !== undefined
          ? payload.welcomeMessage || null
          : before.welcome_message,
        payload.status ?? before.status,
        payload.priceCents !== undefined ? payload.priceCents : before.price_cents,
        payload.currency
          ? String(payload.currency).toUpperCase()
          : before.currency,
        payload.billingInterval !== undefined
          ? payload.billingInterval
          : before.billing_interval,
        req.user.id,
      ],
    )

    const membership = result.rows[0]

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_updated',
      entityType: 'memberships',
      entityId: membership.id,
      beforeData: before,
      afterData: membership,
    })

    return res.json({ ok: true, message: 'Membership plan saved.', membership })
  } catch (error) {
    return next(error)
  }
})

router.post('/memberships/:membershipId/activate', requireAdmin, async (req, res, next) => {
  try {
    const beforeResult = await pool.query(
      'SELECT * FROM memberships WHERE id = $1 LIMIT 1',
      [req.params.membershipId],
    )
    const before = beforeResult.rows[0]

    if (!before) {
      return res.status(404).json({ ok: false, error: 'Membership plan not found.' })
    }

    const result = await pool.query(
      `
      UPDATE memberships
      SET status = 'active', updated_by = $2, updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [before.id, req.user.id],
    )

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_activated',
      entityType: 'memberships',
      entityId: before.id,
      beforeData: before,
      afterData: result.rows[0],
    })

    return res.json({
      ok: true,
      message: 'Membership is active and visible to active members.',
      membership: result.rows[0],
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/memberships/:membershipId/archive', requireAdmin, async (req, res, next) => {
  try {
    const beforeResult = await pool.query(
      'SELECT * FROM memberships WHERE id = $1 LIMIT 1',
      [req.params.membershipId],
    )
    const before = beforeResult.rows[0]

    if (!before) {
      return res.status(404).json({ ok: false, error: 'Membership plan not found.' })
    }

    const result = await pool.query(
      `
      UPDATE memberships
      SET status = 'archived', updated_by = $2, updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [before.id, req.user.id],
    )

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_archived',
      entityType: 'memberships',
      entityId: before.id,
      beforeData: before,
      afterData: result.rows[0],
    })

    return res.json({
      ok: true,
      message: 'Membership archived. Current records are preserved.',
      membership: result.rows[0],
    })
  } catch (error) {
    return next(error)
  }
})

router.delete('/memberships/:membershipId', requireAdmin, async (req, res, next) => {
  try {
    const enrollmentCountResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM membership_enrollments WHERE membership_id = $1',
      [req.params.membershipId],
    )

    if ((enrollmentCountResult.rows[0]?.count || 0) > 0) {
      return res.status(409).json({
        ok: false,
        error: 'Archive this membership instead. It has member history that must be preserved.',
      })
    }

    const result = await pool.query(
      `
      DELETE FROM memberships
      WHERE id = $1
        AND status <> 'active'
      RETURNING *
      `,
      [req.params.membershipId],
    )
    const membership = result.rows[0]

    if (!membership) {
      return res.status(409).json({
        ok: false,
        error: 'Only a draft or archived membership without member history can be deleted.',
      })
    }

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_deleted',
      entityType: 'memberships',
      entityId: membership.id,
      beforeData: membership,
    })

    return res.json({ ok: true, message: 'Membership plan deleted.' })
  } catch (error) {
    return next(error)
  }
})

router.post('/memberships/:membershipId/enrollments', requireAdmin, async (req, res, next) => {
  const parsed = membershipEnrollmentSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the member details.',
    })
  }

  try {
    const payload = parsed.data
    const beforeResult = await pool.query(
      `
      SELECT *
      FROM membership_enrollments
      WHERE membership_id = $1
        AND client_profile_id = $2
      LIMIT 1
      `,
      [req.params.membershipId, payload.clientProfileId],
    )
    const before = beforeResult.rows[0] || null

    const result = await pool.query(
      `
      INSERT INTO membership_enrollments (
        membership_id,
        client_profile_id,
        status,
        started_at,
        renewal_at,
        ends_at,
        notes,
        assigned_by
      )
      VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()), $5, $6, $7, $8)
      ON CONFLICT (membership_id, client_profile_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        started_at = EXCLUDED.started_at,
        renewal_at = EXCLUDED.renewal_at,
        ends_at = EXCLUDED.ends_at,
        notes = EXCLUDED.notes,
        assigned_by = EXCLUDED.assigned_by,
        updated_at = now()
      RETURNING *
      `,
      [
        req.params.membershipId,
        payload.clientProfileId,
        payload.status,
        payload.startedAt || null,
        payload.renewalAt || null,
        payload.endsAt || null,
        payload.notes || null,
        req.user.id,
      ],
    )

    const enrollment = result.rows[0]

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: before ? 'membership_enrollment_updated' : 'membership_enrollment_created',
      entityType: 'membership_enrollments',
      entityId: enrollment.id,
      beforeData: before || {},
      afterData: enrollment,
    })

    return res.status(before ? 200 : 201).json({
      ok: true,
      message: before ? 'Member access updated.' : 'Client added to this membership.',
      enrollment,
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/memberships/enrollments/:enrollmentId', requireAdmin, async (req, res, next) => {
  const parsed = membershipEnrollmentUpdateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the member details.',
    })
  }

  try {
    const beforeResult = await pool.query(
      'SELECT * FROM membership_enrollments WHERE id = $1 LIMIT 1',
      [req.params.enrollmentId],
    )
    const before = beforeResult.rows[0]

    if (!before) {
      return res.status(404).json({ ok: false, error: 'Membership enrollment not found.' })
    }

    const payload = parsed.data
    const result = await pool.query(
      `
      UPDATE membership_enrollments
      SET
        status = $2,
        started_at = $3,
        renewal_at = $4,
        ends_at = $5,
        notes = $6,
        assigned_by = $7,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        before.id,
        payload.status ?? before.status,
        payload.startedAt !== undefined ? payload.startedAt : before.started_at,
        payload.renewalAt !== undefined ? payload.renewalAt : before.renewal_at,
        payload.endsAt !== undefined ? payload.endsAt : before.ends_at,
        payload.notes !== undefined ? payload.notes || null : before.notes,
        req.user.id,
      ],
    )

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_enrollment_updated',
      entityType: 'membership_enrollments',
      entityId: before.id,
      beforeData: before,
      afterData: result.rows[0],
    })

    return res.json({ ok: true, message: 'Member access updated.', enrollment: result.rows[0] })
  } catch (error) {
    return next(error)
  }
})

router.delete('/memberships/enrollments/:enrollmentId', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM membership_enrollments WHERE id = $1 RETURNING *',
      [req.params.enrollmentId],
    )
    const enrollment = result.rows[0]

    if (!enrollment) {
      return res.status(404).json({ ok: false, error: 'Membership enrollment not found.' })
    }

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_enrollment_removed',
      entityType: 'membership_enrollments',
      entityId: enrollment.id,
      beforeData: enrollment,
    })

    return res.json({ ok: true, message: 'Client removed from this membership.' })
  } catch (error) {
    return next(error)
  }
})

router.put('/memberships/:membershipId/courses', requireAdmin, async (req, res, next) => {
  const parsed = membershipCourseAccessSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the learning selections.',
    })
  }

  const dbClient = await pool.connect()

  try {
    await dbClient.query('BEGIN')

    const beforeResult = await dbClient.query(
      `
      SELECT COALESCE(json_agg(course_id), '[]') AS course_ids
      FROM membership_course_links
      WHERE membership_id = $1
      `,
      [req.params.membershipId],
    )

    await dbClient.query(
      'DELETE FROM membership_course_links WHERE membership_id = $1',
      [req.params.membershipId],
    )

    if (parsed.data.courseIds.length > 0) {
      await dbClient.query(
        `
        INSERT INTO membership_course_links (membership_id, course_id, created_by)
        SELECT $1, course_id, $2
        FROM unnest($3::uuid[]) AS course_id
        ON CONFLICT (membership_id, course_id) DO NOTHING
        `,
        [req.params.membershipId, req.user.id, parsed.data.courseIds],
      )
    }

    await dbClient.query('COMMIT')

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_learning_access_updated',
      entityType: 'memberships',
      entityId: req.params.membershipId,
      beforeData: { courseIds: beforeResult.rows[0]?.course_ids || [] },
      afterData: parsed.data,
    })

    return res.json({
      ok: true,
      message: 'Member Learning Library access updated.',
      membership: await getMembershipDetail(req.params.membershipId, pool),
    })
  } catch (error) {
    await dbClient.query('ROLLBACK')
    return next(error)
  } finally {
    dbClient.release()
  }
})

router.post('/memberships/:membershipId/resources', requireAdmin, async (req, res, next) => {
  const parsed = membershipResourceSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the resource details.',
    })
  }

  try {
    const payload = parsed.data
    const result = await pool.query(
      `
      INSERT INTO membership_resources (
        membership_id,
        title,
        resource_type,
        description,
        resource_url,
        status,
        position,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        req.params.membershipId,
        payload.title,
        payload.resourceType,
        payload.description || null,
        payload.resourceUrl || null,
        payload.status,
        payload.position,
        req.user.id,
      ],
    )

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_resource_created',
      entityType: 'membership_resources',
      entityId: result.rows[0].id,
      afterData: result.rows[0],
    })

    return res.status(201).json({ ok: true, message: 'Member resource added.', resource: result.rows[0] })
  } catch (error) {
    return next(error)
  }
})

router.patch('/memberships/resources/:resourceId', requireAdmin, async (req, res, next) => {
  const parsed = membershipResourceUpdateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Please check the resource details.' })
  }

  try {
    const beforeResult = await pool.query(
      'SELECT * FROM membership_resources WHERE id = $1 LIMIT 1',
      [req.params.resourceId],
    )
    const before = beforeResult.rows[0]

    if (!before) return res.status(404).json({ ok: false, error: 'Resource not found.' })

    const payload = parsed.data
    const result = await pool.query(
      `
      UPDATE membership_resources
      SET
        title = $2,
        resource_type = $3,
        description = $4,
        resource_url = $5,
        status = $6,
        position = $7,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        before.id,
        payload.title ?? before.title,
        payload.resourceType ?? before.resource_type,
        payload.description !== undefined ? payload.description || null : before.description,
        payload.resourceUrl !== undefined ? payload.resourceUrl || null : before.resource_url,
        payload.status ?? before.status,
        payload.position ?? before.position,
      ],
    )

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_resource_updated',
      entityType: 'membership_resources',
      entityId: before.id,
      beforeData: before,
      afterData: result.rows[0],
    })

    return res.json({ ok: true, message: 'Member resource saved.', resource: result.rows[0] })
  } catch (error) {
    return next(error)
  }
})

router.delete('/memberships/resources/:resourceId', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM membership_resources WHERE id = $1 RETURNING *',
      [req.params.resourceId],
    )
    const resource = result.rows[0]

    if (!resource) return res.status(404).json({ ok: false, error: 'Resource not found.' })

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_resource_deleted',
      entityType: 'membership_resources',
      entityId: resource.id,
      beforeData: resource,
    })

    return res.json({ ok: true, message: 'Member resource deleted.' })
  } catch (error) {
    return next(error)
  }
})

router.post('/memberships/:membershipId/announcements', requireAdmin, async (req, res, next) => {
  const parsed = membershipAnnouncementSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the update details.',
    })
  }

  try {
    const payload = parsed.data
    const result = await pool.query(
      `
      INSERT INTO membership_announcements (
        membership_id,
        title,
        body,
        status,
        published_at,
        created_by
      )
      VALUES ($1, $2, $3, $4, CASE WHEN $4 = 'published' THEN now() ELSE NULL END, $5)
      RETURNING *
      `,
      [req.params.membershipId, payload.title, payload.body, payload.status, req.user.id],
    )

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_announcement_created',
      entityType: 'membership_announcements',
      entityId: result.rows[0].id,
      afterData: result.rows[0],
    })

    return res.status(201).json({
      ok: true,
      message:
        payload.status === 'published'
          ? 'Member update published.'
          : 'Member update saved as a draft.',
      announcement: result.rows[0],
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/memberships/announcements/:announcementId', requireAdmin, async (req, res, next) => {
  const parsed = membershipAnnouncementUpdateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Please check the update details.' })
  }

  try {
    const beforeResult = await pool.query(
      'SELECT * FROM membership_announcements WHERE id = $1 LIMIT 1',
      [req.params.announcementId],
    )
    const before = beforeResult.rows[0]

    if (!before) return res.status(404).json({ ok: false, error: 'Member update not found.' })

    const payload = parsed.data
    const nextStatus = payload.status ?? before.status
    const result = await pool.query(
      `
      UPDATE membership_announcements
      SET
        title = $2,
        body = $3,
        status = $4,
        published_at = CASE
          WHEN $4 = 'published' AND published_at IS NULL THEN now()
          WHEN $4 <> 'published' THEN NULL
          ELSE published_at
        END,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        before.id,
        payload.title ?? before.title,
        payload.body ?? before.body,
        nextStatus,
      ],
    )

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_announcement_updated',
      entityType: 'membership_announcements',
      entityId: before.id,
      beforeData: before,
      afterData: result.rows[0],
    })

    return res.json({ ok: true, message: 'Member update saved.', announcement: result.rows[0] })
  } catch (error) {
    return next(error)
  }
})

router.post('/memberships/announcements/:announcementId/publish', requireAdmin, async (req, res, next) => {
  try {
    const beforeResult = await pool.query(
      'SELECT * FROM membership_announcements WHERE id = $1 LIMIT 1',
      [req.params.announcementId],
    )
    const before = beforeResult.rows[0]

    if (!before) return res.status(404).json({ ok: false, error: 'Member update not found.' })

    const result = await pool.query(
      `
      UPDATE membership_announcements
      SET status = 'published', published_at = COALESCE(published_at, now()), updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [before.id],
    )

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_announcement_published',
      entityType: 'membership_announcements',
      entityId: before.id,
      beforeData: before,
      afterData: result.rows[0],
    })

    return res.json({ ok: true, message: 'Member update published.', announcement: result.rows[0] })
  } catch (error) {
    return next(error)
  }
})

router.post('/memberships/announcements/:announcementId/archive', requireAdmin, async (req, res, next) => {
  try {
    const beforeResult = await pool.query(
      'SELECT * FROM membership_announcements WHERE id = $1 LIMIT 1',
      [req.params.announcementId],
    )
    const before = beforeResult.rows[0]

    if (!before) return res.status(404).json({ ok: false, error: 'Member update not found.' })

    const result = await pool.query(
      `
      UPDATE membership_announcements
      SET status = 'archived', updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [before.id],
    )

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_announcement_archived',
      entityType: 'membership_announcements',
      entityId: before.id,
      beforeData: before,
      afterData: result.rows[0],
    })

    return res.json({ ok: true, message: 'Member update archived.', announcement: result.rows[0] })
  } catch (error) {
    return next(error)
  }
})

router.delete('/memberships/announcements/:announcementId', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM membership_announcements
      WHERE id = $1
        AND status <> 'published'
      RETURNING *
      `,
      [req.params.announcementId],
    )
    const announcement = result.rows[0]

    if (!announcement) {
      return res.status(409).json({
        ok: false,
        error: 'Archive a published member update before deleting it.',
      })
    }

    await writeMembershipAudit({
      actorUserId: req.user.id,
      action: 'membership_announcement_deleted',
      entityType: 'membership_announcements',
      entityId: announcement.id,
      beforeData: announcement,
    })

    return res.json({ ok: true, message: 'Member update deleted.' })
  } catch (error) {
    return next(error)
  }
})
// membership-circle-pass-19-end


// the-circle-community-pass-20-admin-start
const circlePostFields = z.object({
  membershipId: z.string().uuid().nullable().optional(),
  postType: z.enum(['post', 'announcement', 'event', 'challenge']).default('post'),
  title: z.string().trim().min(2, 'A title is required.').max(180),
  body: z.string().trim().min(2, 'A message is required.').max(12000),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
  isPinned: z.boolean().optional().default(false),
  commentsEnabled: z.boolean().optional().default(true),
  reactionsEnabled: z.boolean().optional().default(true),
  eventStartsAt: z.string().datetime().nullable().optional(),
  eventEndsAt: z.string().datetime().nullable().optional(),
})

const validCircleEventRange = (value) =>
  !value.eventStartsAt ||
  !value.eventEndsAt ||
  new Date(value.eventEndsAt) > new Date(value.eventStartsAt)

const circlePostSchema = circlePostFields.refine(validCircleEventRange, {
  message: 'The ending time must be later than the starting time.',
  path: ['eventEndsAt'],
})

const circlePostUpdateSchema = circlePostFields.partial().refine(validCircleEventRange, {
  message: 'The ending time must be later than the starting time.',
  path: ['eventEndsAt'],
})
const circleCommentModerationSchema = z.object({
  status: z.enum(['active', 'hidden']),
})
const circleReportReviewSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
})

async function writeCircleAudit(req, action, entityType, entityId, beforeData = {}, afterData = {}) {
  try {
    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data,
        ip_address,
        user_agent
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
      `,
      [
        req.user?.id || null,
        action,
        entityType,
        entityId || null,
        JSON.stringify(beforeData || {}),
        JSON.stringify(afterData || {}),
        req.ip || null,
        req.get('user-agent') || null,
      ],
    )
  } catch {
    // Community work should remain available if audit storage is briefly unavailable.
  }
}

router.get('/circle', requireAdmin, async (req, res, next) => {
  try {
    const [posts, membershipsResult, settings] = await Promise.all([
      listAdminCirclePosts(pool),
      pool.query(`
        SELECT id, name, status
        FROM memberships
        WHERE status <> 'archived'
        ORDER BY name
      `),
      getPlatformSettings(pool),
    ])

    const openReportCount = posts.reduce(
      (total, post) => total + Number(post.open_report_count || 0),
      0,
    )

    return res.json({
      ok: true,
      posts,
      memberships: membershipsResult.rows,
      featureEnabled: Boolean(settings.featureFlags?.circleCommunity),
      metrics: {
        published: posts.filter((post) => post.status === 'published').length,
        drafts: posts.filter((post) => post.status === 'draft').length,
        comments: posts.reduce((total, post) => total + Number(post.comment_count || 0), 0),
        openReports: openReportCount,
      },
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/circle/posts/:postId', requireAdmin, async (req, res, next) => {
  try {
    const post = await getAdminCirclePost(req.params.postId, pool)
    if (!post) return res.status(404).json({ ok: false, error: 'Circle post not found.' })
    return res.json({ ok: true, post })
  } catch (error) {
    return next(error)
  }
})

router.post('/circle/posts', requireAdmin, async (req, res, next) => {
  const parsed = circlePostSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the post details.',
    })
  }

  try {
    const payload = parsed.data
    const status = payload.status === 'published' ? 'published' : 'draft'
    const result = await pool.query(
      `
      INSERT INTO circle_posts (
        membership_id,
        author_user_id,
        post_type,
        title,
        body,
        status,
        is_pinned,
        comments_enabled,
        reactions_enabled,
        event_starts_at,
        event_ends_at,
        published_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $6 = 'published' THEN now() ELSE NULL END)
      RETURNING *
      `,
      [
        payload.membershipId || null,
        req.user.id,
        payload.postType,
        payload.title,
        payload.body,
        status,
        payload.isPinned,
        payload.commentsEnabled,
        payload.reactionsEnabled,
        payload.eventStartsAt || null,
        payload.eventEndsAt || null,
      ],
    )

    const post = result.rows[0]
    await writeCircleAudit(req, 'circle_post_created', 'circle_posts', post.id, {}, post)

    return res.status(201).json({
      ok: true,
      message: status === 'published' ? 'Post published to The Circle.' : 'Circle post saved as a draft.',
      post,
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/circle/posts/:postId', requireAdmin, async (req, res, next) => {
  const parsed = circlePostUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the post details.',
    })
  }

  try {
    const beforeResult = await pool.query('SELECT * FROM circle_posts WHERE id = $1 LIMIT 1', [req.params.postId])
    const before = beforeResult.rows[0]
    if (!before) return res.status(404).json({ ok: false, error: 'Circle post not found.' })

    const payload = parsed.data
    const nextStatus = payload.status || before.status
    const result = await pool.query(
      `
      UPDATE circle_posts
      SET
        membership_id = $2,
        post_type = $3,
        title = $4,
        body = $5,
        status = $6,
        is_pinned = $7,
        comments_enabled = $8,
        reactions_enabled = $9,
        event_starts_at = $10,
        event_ends_at = $11,
        published_at = CASE
          WHEN $6 = 'published' THEN COALESCE(published_at, now())
          WHEN $6 = 'draft' THEN NULL
          ELSE published_at
        END,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        before.id,
        payload.membershipId !== undefined ? payload.membershipId || null : before.membership_id,
        payload.postType || before.post_type,
        payload.title || before.title,
        payload.body || before.body,
        nextStatus,
        payload.isPinned ?? before.is_pinned,
        payload.commentsEnabled ?? before.comments_enabled,
        payload.reactionsEnabled ?? before.reactions_enabled,
        payload.eventStartsAt !== undefined ? payload.eventStartsAt : before.event_starts_at,
        payload.eventEndsAt !== undefined ? payload.eventEndsAt : before.event_ends_at,
      ],
    )

    const post = result.rows[0]
    await writeCircleAudit(req, 'circle_post_updated', 'circle_posts', post.id, before, post)
    return res.json({ ok: true, message: 'Circle post saved.', post })
  } catch (error) {
    return next(error)
  }
})

router.post('/circle/posts/:postId/publish', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      UPDATE circle_posts
      SET status = 'published', published_at = COALESCE(published_at, now()), updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [req.params.postId],
    )
    const post = result.rows[0]
    if (!post) return res.status(404).json({ ok: false, error: 'Circle post not found.' })
    await writeCircleAudit(req, 'circle_post_published', 'circle_posts', post.id, {}, post)
    return res.json({ ok: true, message: 'Post published to The Circle.', post })
  } catch (error) {
    return next(error)
  }
})

router.post('/circle/posts/:postId/archive', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      UPDATE circle_posts
      SET status = 'archived', is_pinned = false, updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [req.params.postId],
    )
    const post = result.rows[0]
    if (!post) return res.status(404).json({ ok: false, error: 'Circle post not found.' })
    await writeCircleAudit(req, 'circle_post_archived', 'circle_posts', post.id, {}, post)
    return res.json({ ok: true, message: 'Post archived and removed from member view.', post })
  } catch (error) {
    return next(error)
  }
})

router.post('/circle/posts/:postId/pin', requireAdmin, async (req, res, next) => {
  const parsed = z.object({ isPinned: z.boolean() }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'Choose whether the post should be pinned.' })

  try {
    const result = await pool.query(
      `
      UPDATE circle_posts
      SET is_pinned = $2, updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [req.params.postId, parsed.data.isPinned],
    )
    const post = result.rows[0]
    if (!post) return res.status(404).json({ ok: false, error: 'Circle post not found.' })
    await writeCircleAudit(req, parsed.data.isPinned ? 'circle_post_pinned' : 'circle_post_unpinned', 'circle_posts', post.id, {}, post)
    return res.json({ ok: true, message: parsed.data.isPinned ? 'Post pinned.' : 'Post unpinned.', post })
  } catch (error) {
    return next(error)
  }
})

router.delete('/circle/posts/:postId', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      DELETE FROM circle_posts
      WHERE id = $1 AND status <> 'published'
      RETURNING *
      `,
      [req.params.postId],
    )
    const post = result.rows[0]
    if (!post) {
      return res.status(409).json({
        ok: false,
        error: 'Archive a published post before deleting it.',
      })
    }
    await writeCircleAudit(req, 'circle_post_deleted', 'circle_posts', post.id, post, {})
    return res.json({ ok: true, message: 'Circle post deleted.' })
  } catch (error) {
    return next(error)
  }
})

router.patch('/circle/comments/:commentId/moderation', requireAdmin, async (req, res, next) => {
  const parsed = circleCommentModerationSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'Choose a valid moderation action.' })

  try {
    const beforeResult = await pool.query('SELECT * FROM circle_comments WHERE id = $1 LIMIT 1', [req.params.commentId])
    const before = beforeResult.rows[0]
    if (!before) return res.status(404).json({ ok: false, error: 'Comment not found.' })

    const result = await pool.query(
      `
      UPDATE circle_comments
      SET
        status = $2,
        hidden_by_user_id = CASE WHEN $2 = 'hidden' THEN $3 ELSE NULL END,
        hidden_at = CASE WHEN $2 = 'hidden' THEN now() ELSE NULL END,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [before.id, parsed.data.status, req.user.id],
    )
    const comment = result.rows[0]
    await writeCircleAudit(req, parsed.data.status === 'hidden' ? 'circle_comment_hidden' : 'circle_comment_restored', 'circle_comments', comment.id, before, comment)
    return res.json({ ok: true, message: parsed.data.status === 'hidden' ? 'Comment hidden from members.' : 'Comment restored.', comment })
  } catch (error) {
    return next(error)
  }
})

router.patch('/circle/reports/:reportId', requireAdmin, async (req, res, next) => {
  const parsed = circleReportReviewSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'Choose resolved or dismissed.' })

  try {
    const beforeResult = await pool.query('SELECT * FROM circle_reports WHERE id = $1 LIMIT 1', [req.params.reportId])
    const before = beforeResult.rows[0]
    if (!before) return res.status(404).json({ ok: false, error: 'Report not found.' })

    const result = await pool.query(
      `
      UPDATE circle_reports
      SET status = $2, reviewed_by_user_id = $3, reviewed_at = now(), updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [before.id, parsed.data.status, req.user.id],
    )
    const report = result.rows[0]
    await writeCircleAudit(req, `circle_report_${parsed.data.status}`, 'circle_reports', report.id, before, report)
    return res.json({ ok: true, message: parsed.data.status === 'resolved' ? 'Report resolved.' : 'Report dismissed.', report })
  } catch (error) {
    return next(error)
  }
})
// the-circle-community-pass-20-admin-end


// secure-client-inbox-pass-22-admin-start
const inboxStatusValues = ['open', 'waiting_on_client', 'waiting_on_team', 'closed']
const inboxPriorityValues = ['normal', 'high', 'urgent']

const inboxAttachmentSchema = {
  attachmentUrl: z.string().trim().url('Attachment link must be a valid URL.').max(2000).optional().or(z.literal('')),
  attachmentLabel: z.string().trim().max(160).optional().default(''),
}

const adminInboxCreateSchema = z.object({
  clientProfileId: z.string().uuid(),
  subject: z.string().trim().min(1, 'Add a subject.').max(180),
  body: z.string().trim().min(1, 'Write a message.').max(10000),
  priority: z.enum(inboxPriorityValues).optional().default('normal'),
  assignedUserId: z.string().uuid().nullable().optional(),
  ...inboxAttachmentSchema,
})

const adminInboxMessageSchema = z.object({
  body: z.string().trim().min(1, 'Write a reply or internal note.').max(10000),
  isInternalNote: z.boolean().optional().default(false),
  ...inboxAttachmentSchema,
})

const adminInboxUpdateSchema = z.object({
  status: z.enum(inboxStatusValues).optional(),
  priority: z.enum(inboxPriorityValues).optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Choose at least one conversation setting to update.',
})

async function writeInboxAudit(req, action, entityId, beforeData = null, afterData = null) {
  try {
    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data,
        ip_address,
        user_agent
      )
      VALUES ($1, $2, 'client_conversations', $3, $4::jsonb, $5::jsonb, $6, $7)
      `,
      [
        req.user?.id || null,
        action,
        entityId || null,
        beforeData ? JSON.stringify(beforeData) : null,
        afterData ? JSON.stringify(afterData) : null,
        req.ip || null,
        req.get('user-agent') || null,
      ],
    )
  } catch {
    // Inbox work must remain available if audit storage is briefly unavailable.
  }
}

async function getAdminInboxConversation(conversationId, db = pool) {
  const conversationResult = await db.query(
    `
    SELECT
      cc.*,
      cp.first_name,
      cp.last_name,
      COALESCE(su.email, cp.public_contact_email) AS client_email,
      assignee.email AS assigned_email,
      assignee.role AS assigned_role,
      creator.email AS created_by_email,
      creator.role AS created_by_role
    FROM client_conversations cc
    JOIN client_profiles cp ON cp.id = cc.client_profile_id
    LEFT JOIN system_users su ON su.id = cp.user_id
    LEFT JOIN system_users assignee ON assignee.id = cc.assigned_user_id
    LEFT JOIN system_users creator ON creator.id = cc.created_by_user_id
    WHERE cc.id = $1
    LIMIT 1
    `,
    [conversationId],
  )

  const conversation = conversationResult.rows[0]
  if (!conversation) return null

  const messagesResult = await db.query(
    `
    SELECT
      ccm.*,
      sender.email AS sender_email,
      COALESCE(
        NULLIF(TRIM(CONCAT(cp.first_name, ' ', cp.last_name)), ''),
        sender.email,
        'Power Within Team'
      ) AS sender_name
    FROM client_conversation_messages ccm
    LEFT JOIN system_users sender ON sender.id = ccm.sender_user_id
    LEFT JOIN client_profiles cp ON cp.user_id = ccm.sender_user_id
    WHERE ccm.conversation_id = $1
    ORDER BY ccm.created_at ASC
    `,
    [conversationId],
  )

  return { ...conversation, messages: messagesResult.rows }
}

router.get('/inbox', requireAdmin, async (req, res, next) => {
  try {
    const status = String(req.query.status || 'all').trim().toLowerCase()
    const priority = String(req.query.priority || 'all').trim().toLowerCase()
    const search = String(req.query.search || '').trim()

    if (status !== 'all' && !inboxStatusValues.includes(status)) {
      return res.status(400).json({ ok: false, error: 'Invalid inbox status filter.' })
    }
    if (priority !== 'all' && !inboxPriorityValues.includes(priority)) {
      return res.status(400).json({ ok: false, error: 'Invalid inbox priority filter.' })
    }

    const result = await pool.query(
      `
      SELECT
        cc.*,
        cp.first_name,
        cp.last_name,
        COALESCE(su.email, cp.public_contact_email) AS client_email,
        assignee.email AS assigned_email,
        assignee.role AS assigned_role,
        COALESCE(message_counts.message_count, 0)::int AS message_count,
        COALESCE(message_counts.unread_team_count, 0)::int AS unread_team_count,
        latest.body AS latest_message,
        latest.sender_role AS latest_sender_role,
        latest.is_internal_note AS latest_is_internal_note
      FROM client_conversations cc
      JOIN client_profiles cp ON cp.id = cc.client_profile_id
      LEFT JOIN system_users su ON su.id = cp.user_id
      LEFT JOIN system_users assignee ON assignee.id = cc.assigned_user_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS message_count,
          COUNT(*) FILTER (
            WHERE sender_role = 'client' AND read_by_team_at IS NULL
          )::int AS unread_team_count
        FROM client_conversation_messages
        WHERE conversation_id = cc.id
      ) message_counts ON true
      LEFT JOIN LATERAL (
        SELECT body, sender_role, is_internal_note
        FROM client_conversation_messages
        WHERE conversation_id = cc.id
        ORDER BY created_at DESC
        LIMIT 1
      ) latest ON true
      WHERE ($1 = 'all' OR cc.status = $1)
        AND ($2 = 'all' OR cc.priority = $2)
        AND (
          $3 = ''
          OR cc.subject ILIKE '%' || $3 || '%'
          OR cp.first_name ILIKE '%' || $3 || '%'
          OR cp.last_name ILIKE '%' || $3 || '%'
          OR COALESCE(su.email, cp.public_contact_email, '') ILIKE '%' || $3 || '%'
        )
      ORDER BY
        CASE cc.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
        cc.last_message_at DESC
      LIMIT 300
      `,
      [status, priority, search],
    )

    const [metricsResult, clientsResult, teamResult] = await Promise.all([
      pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status <> 'closed')::int AS active,
          COUNT(*) FILTER (WHERE status = 'waiting_on_team')::int AS waiting_on_team,
          COUNT(*) FILTER (WHERE priority = 'urgent' AND status <> 'closed')::int AS urgent,
          COALESCE(SUM(unread_count), 0)::int AS unread
        FROM (
          SELECT
            cc.id,
            cc.status,
            cc.priority,
            COUNT(ccm.id) FILTER (
              WHERE ccm.sender_role = 'client' AND ccm.read_by_team_at IS NULL
            )::int AS unread_count
          FROM client_conversations cc
          LEFT JOIN client_conversation_messages ccm ON ccm.conversation_id = cc.id
          GROUP BY cc.id
        ) summary
        `,
      ),
      pool.query(
        `
        SELECT
          cp.id,
          cp.first_name,
          cp.last_name,
          COALESCE(su.email, cp.public_contact_email) AS email,
          su.status AS portal_status
        FROM client_profiles cp
        LEFT JOIN system_users su ON su.id = cp.user_id
        WHERE cp.client_status <> 'archived'
        ORDER BY cp.first_name, cp.last_name, email
        `,
      ),
      pool.query(
        `
        SELECT id, email, role, status
        FROM system_users
        WHERE role IN ('developer', 'owner', 'admin', 'staff')
          AND status = 'active'
        ORDER BY role, email
        `,
      ),
    ])

    return res.json({
      ok: true,
      conversations: result.rows,
      metrics: metricsResult.rows[0] || {},
      clients: clientsResult.rows,
      teamUsers: teamResult.rows,
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/inbox/:conversationId', requireAdmin, async (req, res, next) => {
  try {
    const conversation = await getAdminInboxConversation(req.params.conversationId)
    if (!conversation) {
      return res.status(404).json({ ok: false, error: 'Conversation not found.' })
    }

    await pool.query(
      `
      UPDATE client_conversation_messages
      SET read_by_team_at = COALESCE(read_by_team_at, now())
      WHERE conversation_id = $1
        AND sender_role = 'client'
        AND read_by_team_at IS NULL
      `,
      [conversation.id],
    )

    const refreshed = await getAdminInboxConversation(conversation.id)
    return res.json({ ok: true, conversation: refreshed })
  } catch (error) {
    return next(error)
  }
})

router.post('/inbox', requireAdmin, async (req, res, next) => {
  const parsed = adminInboxCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the conversation details.',
    })
  }

  const db = await pool.connect()
  try {
    await db.query('BEGIN')

    const clientResult = await db.query(
      `SELECT id FROM client_profiles WHERE id = $1 LIMIT 1`,
      [parsed.data.clientProfileId],
    )
    if (!clientResult.rows[0]) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Client profile not found.' })
    }

    const conversationResult = await db.query(
      `
      INSERT INTO client_conversations (
        client_profile_id,
        subject,
        status,
        priority,
        assigned_user_id,
        created_by_user_id
      )
      VALUES ($1, $2, 'waiting_on_client', $3, $4, $5)
      RETURNING *
      `,
      [
        parsed.data.clientProfileId,
        parsed.data.subject,
        parsed.data.priority,
        parsed.data.assignedUserId || req.user.id,
        req.user.id,
      ],
    )

    const conversation = conversationResult.rows[0]
    await db.query(
      `
      INSERT INTO client_conversation_messages (
        conversation_id,
        sender_user_id,
        sender_role,
        body,
        attachment_url,
        attachment_label,
        read_by_team_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, now())
      `,
      [
        conversation.id,
        req.user.id,
        req.user.role,
        parsed.data.body,
        parsed.data.attachmentUrl || null,
        parsed.data.attachmentLabel || null,
      ],
    )

    await db.query('COMMIT')
    await writeInboxAudit(req, 'client_conversation_created_by_team', conversation.id, null, conversation)

    return res.status(201).json({
      ok: true,
      message: 'Private client conversation created.',
      conversation: await getAdminInboxConversation(conversation.id),
    })
  } catch (error) {
    await db.query('ROLLBACK')
    return next(error)
  } finally {
    db.release()
  }
})

router.post('/inbox/:conversationId/messages', requireAdmin, async (req, res, next) => {
  const parsed = adminInboxMessageSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the message.',
    })
  }

  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const beforeResult = await db.query(
      `SELECT * FROM client_conversations WHERE id = $1 FOR UPDATE`,
      [req.params.conversationId],
    )
    const before = beforeResult.rows[0]
    if (!before) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Conversation not found.' })
    }

    const messageResult = await db.query(
      `
      INSERT INTO client_conversation_messages (
        conversation_id,
        sender_user_id,
        sender_role,
        body,
        attachment_url,
        attachment_label,
        is_internal_note,
        read_by_team_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      RETURNING *
      `,
      [
        before.id,
        req.user.id,
        req.user.role,
        parsed.data.body,
        parsed.data.attachmentUrl || null,
        parsed.data.attachmentLabel || null,
        parsed.data.isInternalNote,
      ],
    )

    const nextStatus = parsed.data.isInternalNote
      ? before.status
      : 'waiting_on_client'

    const updatedResult = await db.query(
      `
      UPDATE client_conversations
      SET
        status = $2,
        assigned_user_id = COALESCE(assigned_user_id, $3),
        last_message_at = now(),
        closed_at = CASE WHEN $2 = 'closed' THEN COALESCE(closed_at, now()) ELSE NULL END,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [before.id, nextStatus, req.user.id],
    )

    await db.query('COMMIT')
    await writeInboxAudit(
      req,
      parsed.data.isInternalNote ? 'client_conversation_internal_note_added' : 'client_conversation_team_reply_sent',
      before.id,
      before,
      { conversation: updatedResult.rows[0], messageId: messageResult.rows[0].id },
    )

    return res.status(201).json({
      ok: true,
      message: parsed.data.isInternalNote ? 'Internal note added.' : 'Reply sent to the client.',
      conversation: await getAdminInboxConversation(before.id),
    })
  } catch (error) {
    await db.query('ROLLBACK')
    return next(error)
  } finally {
    db.release()
  }
})

router.patch('/inbox/:conversationId', requireAdmin, async (req, res, next) => {
  const parsed = adminInboxUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the conversation settings.',
    })
  }

  try {
    const beforeResult = await pool.query(
      `SELECT * FROM client_conversations WHERE id = $1 LIMIT 1`,
      [req.params.conversationId],
    )
    const before = beforeResult.rows[0]
    if (!before) return res.status(404).json({ ok: false, error: 'Conversation not found.' })

    if (parsed.data.assignedUserId) {
      const assigneeResult = await pool.query(
        `
        SELECT id
        FROM system_users
        WHERE id = $1
          AND role IN ('developer', 'owner', 'admin', 'staff')
          AND status = 'active'
        LIMIT 1
        `,
        [parsed.data.assignedUserId],
      )
      if (!assigneeResult.rows[0]) {
        return res.status(400).json({ ok: false, error: 'Choose an active Studio team member.' })
      }
    }

    const result = await pool.query(
      `
      UPDATE client_conversations
      SET
        status = COALESCE($2, status),
        priority = COALESCE($3, priority),
        assigned_user_id = CASE WHEN $4::boolean THEN $5 ELSE assigned_user_id END,
        closed_at = CASE
          WHEN COALESCE($2, status) = 'closed' THEN COALESCE(closed_at, now())
          ELSE NULL
        END,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        before.id,
        parsed.data.status || null,
        parsed.data.priority || null,
        Object.prototype.hasOwnProperty.call(parsed.data, 'assignedUserId'),
        parsed.data.assignedUserId || null,
      ],
    )

    const conversation = result.rows[0]
    await writeInboxAudit(req, 'client_conversation_settings_updated', conversation.id, before, conversation)

    return res.json({
      ok: true,
      message: conversation.status === 'closed' ? 'Conversation closed.' : 'Conversation updated.',
      conversation: await getAdminInboxConversation(conversation.id),
    })
  } catch (error) {
    return next(error)
  }
})
// secure-client-inbox-pass-22-admin-end




// staff-team-management-pass-26-start
const teamDepartmentValues = [
  'leadership',
  'client_care',
  'operations',
  'content_community',
  'learning',
  'administration',
  'other',
]

const teamAvailabilityValues = ['available', 'focused', 'limited', 'away']
const teamAssignmentRoles = ['primary', 'support', 'specialist', 'observer']

const teamMemberUpdateSchema = z.object({
  displayName: z.string().trim().max(120).optional().default(''),
  jobTitle: z.string().trim().max(120).optional().default(''),
  department: z.enum(teamDepartmentValues),
  availabilityStatus: z.enum(teamAvailabilityValues),
  capacityPercent: z.coerce.number().int().min(0).max(100),
  isAssignable: z.boolean(),
  internalNotes: z.string().trim().max(4000).optional().default(''),
  permissionTemplate: z.enum([
    'custom',
    'client_care',
    'operations',
    'content_community',
    'read_only',
    'restricted',
  ]).optional().default('custom'),
  permissions: z.record(z.enum(TEAM_ACCESS_LEVELS)).optional().default({}),
})

const teamAssignmentsSchema = z.object({
  assignments: z.array(z.object({
    clientProfileId: z.string().uuid(),
    assignmentRole: z.enum(teamAssignmentRoles).optional().default('support'),
  })).max(500),
})

function serializeTeamMember(row) {
  const role = row.role || 'staff'

  return {
    id: row.id,
    email: row.email,
    role,
    status: row.status,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    profile: {
      displayName: row.display_name || '',
      jobTitle: row.job_title || '',
      department: row.department || (role === 'admin' ? 'administration' : 'client_care'),
      availabilityStatus: row.availability_status || 'available',
      capacityPercent: Number(row.capacity_percent ?? 100),
      isAssignable: row.is_assignable !== false,
      internalNotes: row.internal_notes || '',
    },
    permissions: teamPermissionsFromRow(row, role),
    permissionsLocked: role === 'admin',
    assignedClientCount: Number(row.assigned_client_count || 0),
    openConversationCount: Number(row.open_conversation_count || 0),
  }
}

async function getTeamManagementSnapshot() {
  const [membersResult, clientsResult, assignmentsResult] = await Promise.all([
    pool.query(`
      SELECT
        su.id,
        su.email,
        su.role,
        su.status,
        su.last_login_at,
        su.created_at,
        tmp.display_name,
        tmp.job_title,
        tmp.department,
        tmp.availability_status,
        tmp.capacity_percent,
        tmp.is_assignable,
        tmp.internal_notes,
        tmper.dashboard_access,
        tmper.clients_access,
        tmper.sessions_access,
        tmper.inbox_access,
        tmper.communications_access,
        tmper.learning_access,
        tmper.memberships_access,
        tmper.circle_access,
        tmper.encouragements_access,
        tmper.audit_access,
        (
          SELECT COUNT(*)::int
          FROM team_client_assignments tca
          WHERE tca.team_user_id = su.id
        ) AS assigned_client_count,
        (
          SELECT COUNT(*)::int
          FROM client_conversations cc
          WHERE cc.assigned_user_id = su.id
            AND cc.status <> 'closed'
        ) AS open_conversation_count
      FROM system_users su
      LEFT JOIN team_member_profiles tmp ON tmp.user_id = su.id
      LEFT JOIN team_member_permissions tmper ON tmper.user_id = su.id
      WHERE su.role IN ('admin', 'staff')
      ORDER BY
        CASE su.role WHEN 'admin' THEN 0 ELSE 1 END,
        CASE su.status WHEN 'active' THEN 0 ELSE 1 END,
        COALESCE(tmp.display_name, su.email::text)
    `),
    pool.query(`
      SELECT
        cp.id,
        cp.first_name,
        cp.last_name,
        cp.client_status,
        su.email,
        cp.updated_at
      FROM client_profiles cp
      LEFT JOIN system_users su ON su.id = cp.user_id
      WHERE cp.client_status <> 'archived'
      ORDER BY cp.first_name NULLS LAST, cp.last_name NULLS LAST, cp.created_at DESC
    `),
    pool.query(`
      SELECT
        tca.team_user_id,
        tca.client_profile_id,
        tca.assignment_role
      FROM team_client_assignments tca
      ORDER BY tca.created_at ASC
    `),
  ])

  const assignmentsByUser = new Map()

  for (const assignment of assignmentsResult.rows) {
    if (!assignmentsByUser.has(assignment.team_user_id)) {
      assignmentsByUser.set(assignment.team_user_id, [])
    }

    assignmentsByUser.get(assignment.team_user_id).push({
      clientProfileId: assignment.client_profile_id,
      assignmentRole: assignment.assignment_role,
    })
  }

  const members = membersResult.rows.map((row) => ({
    ...serializeTeamMember(row),
    clientAssignments: assignmentsByUser.get(row.id) || [],
  }))

  return {
    summary: {
      total: members.length,
      active: members.filter((member) => member.status === 'active').length,
      admins: members.filter((member) => member.role === 'admin').length,
      staff: members.filter((member) => member.role === 'staff').length,
      available: members.filter(
        (member) => member.profile.isAssignable && member.profile.availabilityStatus === 'available',
      ).length,
      assignedClients: assignmentsResult.rows.length,
    },
    members,
    clients: clientsResult.rows.map((client) => ({
      id: client.id,
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email,
      clientStatus: client.client_status,
      updatedAt: client.updated_at,
    })),
    templates: TEAM_TEMPLATE_PERMISSIONS,
    modules: TEAM_PERMISSION_MODULES,
  }
}

router.get('/team/workload', requireAdmin, async (req, res, next) => {
  try {
    return res.json({
      ok: true,
      ...(await listTeamWorkload(req.user)),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/client-momentum', requireAdmin, async (req, res, next) => {
  try {
    return res.json({
      ok: true,
      ...(await listClientMomentum(req.user)),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/team/my-access', requireAdmin, async (req, res, next) => {
  try {
    return res.json({
      ok: true,
      access: await getTeamAccessForUser(req.user),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/developer/team', requireDeveloper, async (req, res, next) => {
  try {
    return res.json({
      ok: true,
      ...(await getTeamManagementSnapshot()),
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/developer/team/:userId', requireDeveloper, async (req, res, next) => {
  const parsed = teamMemberUpdateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the team member settings.',
    })
  }

  const db = await pool.connect()

  try {
    await db.query('BEGIN')

    const userResult = await db.query(
      `
      SELECT id, email, role, status
      FROM system_users
      WHERE id = $1
        AND role IN ('admin', 'staff')
      LIMIT 1
      FOR UPDATE
      `,
      [req.params.userId],
    )

    const user = userResult.rows[0]

    if (!user) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Team member account not found.' })
    }

    const beforeResult = await db.query(
      `
      SELECT
        tmp.*,
        to_jsonb(tmper) AS permission_record
      FROM team_member_profiles tmp
      LEFT JOIN team_member_permissions tmper ON tmper.user_id = tmp.user_id
      WHERE tmp.user_id = $1
      LIMIT 1
      `,
      [user.id],
    )

    await db.query(
      `
      INSERT INTO team_member_profiles (
        user_id,
        display_name,
        job_title,
        department,
        availability_status,
        capacity_percent,
        is_assignable,
        internal_notes,
        created_by_user_id,
        updated_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
      ON CONFLICT (user_id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        job_title = EXCLUDED.job_title,
        department = EXCLUDED.department,
        availability_status = EXCLUDED.availability_status,
        capacity_percent = EXCLUDED.capacity_percent,
        is_assignable = EXCLUDED.is_assignable,
        internal_notes = EXCLUDED.internal_notes,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = now()
      `,
      [
        user.id,
        parsed.data.displayName || null,
        parsed.data.jobTitle || null,
        parsed.data.department,
        parsed.data.availabilityStatus,
        parsed.data.capacityPercent,
        parsed.data.isAssignable,
        parsed.data.internalNotes || null,
        req.user.id,
      ],
    )

    const requestedPermissions = parsed.data.permissionTemplate !== 'custom'
      ? TEAM_TEMPLATE_PERMISSIONS[parsed.data.permissionTemplate]
      : normalizeTeamPermissions(parsed.data.permissions)

    const permissions = user.role === 'admin'
      ? TEAM_FULL_ACCESS
      : normalizeTeamPermissions(requestedPermissions)

    await db.query(
      `
      INSERT INTO team_member_permissions (
        user_id,
        dashboard_access,
        clients_access,
        sessions_access,
        inbox_access,
        communications_access,
        learning_access,
        memberships_access,
        circle_access,
        encouragements_access,
        audit_access,
        updated_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_id)
      DO UPDATE SET
        dashboard_access = EXCLUDED.dashboard_access,
        clients_access = EXCLUDED.clients_access,
        sessions_access = EXCLUDED.sessions_access,
        inbox_access = EXCLUDED.inbox_access,
        communications_access = EXCLUDED.communications_access,
        learning_access = EXCLUDED.learning_access,
        memberships_access = EXCLUDED.memberships_access,
        circle_access = EXCLUDED.circle_access,
        encouragements_access = EXCLUDED.encouragements_access,
        audit_access = EXCLUDED.audit_access,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = now()
      `,
      [
        user.id,
        permissions.dashboard,
        permissions.clients,
        permissions.sessions,
        permissions.inbox,
        permissions.communications,
        permissions.learning,
        permissions.memberships,
        permissions.circle,
        permissions.encouragements,
        permissions.audit,
        req.user.id,
      ],
    )

    const afterResult = await db.query(
      `
      SELECT
        tmp.*,
        to_jsonb(tmper) AS permission_record
      FROM team_member_profiles tmp
      LEFT JOIN team_member_permissions tmper ON tmper.user_id = tmp.user_id
      WHERE tmp.user_id = $1
      LIMIT 1
      `,
      [user.id],
    )

    await db.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data,
        ip_address,
        user_agent
      )
      VALUES ($1, 'team_member_access_updated', 'system_users', $2, $3::jsonb, $4::jsonb, $5, $6)
      `,
      [
        req.user.id,
        user.id,
        JSON.stringify(beforeResult.rows[0] || null),
        JSON.stringify(afterResult.rows[0] || null),
        req.ip || null,
        req.get('user-agent') || null,
      ],
    )

    await db.query('COMMIT')

    return res.json({
      ok: true,
      message: user.role === 'admin'
        ? 'Admin profile saved. Admin operational access remains fully enabled.'
        : 'Team profile and permissions saved.',
      ...(await getTeamManagementSnapshot()),
    })
  } catch (error) {
    await db.query('ROLLBACK')
    return next(error)
  } finally {
    db.release()
  }
})

router.put('/developer/team/:userId/client-assignments', requireDeveloper, async (req, res, next) => {
  const parsed = teamAssignmentsSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the client assignments.',
    })
  }

  const uniqueAssignments = []
  const seenClientIds = new Set()

  for (const assignment of parsed.data.assignments) {
    if (seenClientIds.has(assignment.clientProfileId)) continue
    seenClientIds.add(assignment.clientProfileId)
    uniqueAssignments.push(assignment)
  }

  const db = await pool.connect()

  try {
    await db.query('BEGIN')

    const userResult = await db.query(
      `
      SELECT id, email, role, status
      FROM system_users
      WHERE id = $1
        AND role IN ('admin', 'staff')
      LIMIT 1
      FOR UPDATE
      `,
      [req.params.userId],
    )

    const user = userResult.rows[0]

    if (!user) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Team member account not found.' })
    }

    if (uniqueAssignments.length) {
      const clientResult = await db.query(
        `SELECT id FROM client_profiles WHERE id = ANY($1::uuid[])`,
        [uniqueAssignments.map((assignment) => assignment.clientProfileId)],
      )

      if (clientResult.rows.length !== uniqueAssignments.length) {
        await db.query('ROLLBACK')
        return res.status(400).json({
          ok: false,
          error: 'One or more selected client profiles no longer exist.',
        })
      }
    }

    const beforeResult = await db.query(
      `
      SELECT client_profile_id, assignment_role
      FROM team_client_assignments
      WHERE team_user_id = $1
      ORDER BY created_at ASC
      `,
      [user.id],
    )

    await db.query('DELETE FROM team_client_assignments WHERE team_user_id = $1', [user.id])

    for (const assignment of uniqueAssignments) {
      await db.query(
        `
        INSERT INTO team_client_assignments (
          team_user_id,
          client_profile_id,
          assignment_role,
          assigned_by_user_id
        )
        VALUES ($1, $2, $3, $4)
        `,
        [user.id, assignment.clientProfileId, assignment.assignmentRole, req.user.id],
      )
    }

    await db.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data,
        ip_address,
        user_agent
      )
      VALUES ($1, 'team_client_assignments_replaced', 'system_users', $2, $3::jsonb, $4::jsonb, $5, $6)
      `,
      [
        req.user.id,
        user.id,
        JSON.stringify(beforeResult.rows),
        JSON.stringify(uniqueAssignments),
        req.ip || null,
        req.get('user-agent') || null,
      ],
    )

    await db.query('COMMIT')

    return res.json({
      ok: true,
      message: uniqueAssignments.length
        ? `${uniqueAssignments.length} client assignment(s) saved.`
        : 'All client assignments were removed.',
      ...(await getTeamManagementSnapshot()),
    })
  } catch (error) {
    await db.query('ROLLBACK')
    return next(error)
  } finally {
    db.release()
  }
})
// staff-team-management-pass-26-end


// automation-studio-pass-29-admin-start
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
      `SELECT client_profile_id FROM automation_enrollments WHERE id = $1 LIMIT 1`,
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
// automation-studio-pass-29-admin-end


// booking-intake-onboarding-pass-30-admin-start
router.use(
  '/onboarding-studio',
  requireAuth,
  requireRole(['developer', 'owner', 'admin', 'staff']),
  enforceTeamPermission,
  onboardingRouter,
)
// booking-intake-onboarding-pass-30-admin-end

// unified-notification-center-pass-25-admin-start
const notificationPreferencesSchema = z.object({
  emailEnabled: z.boolean(),
  emailCategories: z
    .object({
      inbox: z.boolean(),
      sessions: z.boolean(),
      resources: z.boolean(),
      learning: z.boolean(),
      memberships: z.boolean(),
      encouragements: z.boolean(),
      community: z.boolean(),
      system: z.boolean(),
    })
    .default(DEFAULT_EMAIL_CATEGORIES),
})

router.get('/notifications/summary', requireAdmin, async (req, res, next) => {
  try {
    return res.json({ ok: true, summary: await getNotificationSummary(req.user.id) })
  } catch (error) {
    return next(error)
  }
})

router.get('/notifications', requireAdmin, async (req, res, next) => {
  try {
    const result = await listNotifications(req.user.id, {
      limit: req.query.limit,
      unreadOnly: req.query.unreadOnly === 'true',
      category: req.query.category,
    })
    return res.json({ ok: true, ...result })
  } catch (error) {
    return next(error)
  }
})

router.patch('/notifications/:notificationId/read', requireAdmin, async (req, res, next) => {
  try {
    const notification = await markNotificationRead(req.user.id, req.params.notificationId)
    if (!notification) return res.status(404).json({ ok: false, error: 'Notification not found.' })
    return res.json({ ok: true, notification })
  } catch (error) {
    return next(error)
  }
})

router.post('/notifications/mark-all-read', requireAdmin, async (req, res, next) => {
  try {
    const updated = await markAllNotificationsRead(req.user.id)
    return res.json({ ok: true, updated, message: updated ? 'All notifications marked as read.' : 'No unread notifications remained.' })
  } catch (error) {
    return next(error)
  }
})

router.delete('/notifications/:notificationId', requireAdmin, async (req, res, next) => {
  try {
    const dismissed = await dismissNotification(req.user.id, req.params.notificationId)
    if (!dismissed) return res.status(404).json({ ok: false, error: 'Notification not found.' })
    return res.json({ ok: true, message: 'Notification removed.' })
  } catch (error) {
    return next(error)
  }
})

router.post('/notifications/clear-read', requireAdmin, async (req, res, next) => {
  try {
    const dismissed = await dismissReadNotifications(req.user.id)
    return res.json({ ok: true, dismissed, message: dismissed ? 'Read notifications cleared.' : 'No read notifications needed clearing.' })
  } catch (error) {
    return next(error)
  }
})

router.get('/notifications/preferences', requireAdmin, async (req, res, next) => {
  try {
    return res.json({ ok: true, preferences: await getNotificationPreferences(req.user.id) })
  } catch (error) {
    return next(error)
  }
})

router.patch('/notifications/preferences', requireAdmin, async (req, res, next) => {
  const parsed = notificationPreferencesSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'Please check the notification preferences.' })

  try {
    const preferences = await saveNotificationPreferences(req.user.id, parsed.data)
    await pool.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, after_data, ip_address, user_agent)
       VALUES ($1, 'notification_preferences_updated', 'system_users', $1, $2::jsonb, $3, $4)`,
      [req.user.id, JSON.stringify(preferences), req.ip || null, req.get('user-agent') || null],
    )
    return res.json({ ok: true, message: 'Notification preferences saved.', preferences })
  } catch (error) {
    return next(error)
  }
})
// unified-notification-center-pass-25-admin-end

module.exports = router
