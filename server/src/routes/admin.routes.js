const crypto = require('crypto')
const express = require('express')
const bcrypt = require('bcryptjs')
const { z } = require('zod')

const { pool } = require('../db/pool')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')

const router = express.Router()

const requireAdmin = [
  requireAuth,
  requireRole(['owner', 'admin', 'staff']),
]

const requireFounderAccess = [
  requireAuth,
  async (req, res, next) => {
    if (req.user?.role === 'owner') {
      return next()
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
              reason: 'owner_role_required',
            }),
          ],
        )
      }
    } catch {
      // Never let audit logging failure expose or unlock Founder access.
    }

    return res.status(403).json({
      ok: false,
      error: 'Founder access is restricted to the owner account.',
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

async function getClients() {
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
    GROUP BY
      cp.id,
      su.email,
      su.role,
      su.status
    ORDER BY cp.created_at DESC
    LIMIT 100
    `,
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

        const clients = (await getClients()).map(attachAdminClientDisplayEmailV2)

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
          WHEN system_users.role IN ('owner', 'admin', 'staff') THEN system_users.role
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

    const clients = await getClients()
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
    const clients = await getClients()

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

router.post('/mail-studio/preview', requireAdmin, async (req, res, next) => {
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

router.post('/mail-studio/draft', requireAdmin, async (req, res, next) => {
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

    return res.json({
      ok: true,
      month,
      timeZone: FOUNDER_TIME_ZONE,
      rangeStart: monthStart.toISOString(),
      rangeEnd: nextMonthStart.toISOString(),
      bookings: bookingsResult.rows,
      availabilityExceptions: availabilityResult.rows,
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


module.exports = router








