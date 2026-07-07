const express = require('express')
const { z } = require('zod')

const { pool } = require('../db/pool')
const { env } = require('../config/env')

const router = express.Router()


// phase-3-12d-smart-time-slot-protection-start
function phase312dNormalizeDate(value) {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return null

  return date
}

function phase312dAddDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function phase312dGetBookingStart(body = {}) {
  return (
    body.startsAt ||
    body.starts_at ||
    body.startTime ||
    body.start_time ||
    body.start ||
    body.preferredStart ||
    body.preferred_start ||
    body.requestedStart ||
    body.requested_start
  )
}

function phase312dGetBookingEnd(body = {}) {
  return (
    body.endsAt ||
    body.ends_at ||
    body.endTime ||
    body.end_time ||
    body.end ||
    body.preferredEnd ||
    body.preferred_end ||
    body.requestedEnd ||
    body.requested_end
  )
}

async function phase312dFindBookingConflict(startsAt, endsAt) {
  const startDate = phase312dNormalizeDate(startsAt)

  if (!startDate) return null

  const endDate =
    phase312dNormalizeDate(endsAt) ||
    new Date(startDate.getTime() + 60 * 60 * 1000)

  const conflictSql = [
    'SELECT id, appointment_type_id, starts_at, ends_at, status',
    'FROM bookings',
    "WHERE COALESCE(status, 'requested') NOT IN ('cancelled', 'canceled', 'rejected', 'declined', 'archived')",
    'AND starts_at < $2::timestamptz',
    'AND ends_at > $1::timestamptz',
    'ORDER BY starts_at ASC',
    'LIMIT 1',
  ].join(' ')

  const result = await pool.query(conflictSql, [
    startDate.toISOString(),
    endDate.toISOString(),
  ])

  return result.rows[0] || null
}

router.get('/booked-times', async (req, res, next) => {
  try {
    const startDate = phase312dNormalizeDate(req.query.start) || new Date()
    const endDate =
      phase312dNormalizeDate(req.query.end) ||
      phase312dAddDays(startDate, 120)

    const bookedTimesSql = [
      'SELECT id, appointment_type_id, starts_at, ends_at, status',
      'FROM bookings',
      "WHERE COALESCE(status, 'requested') NOT IN ('cancelled', 'canceled', 'rejected', 'declined', 'archived')",
      'AND starts_at < $2::timestamptz',
      'AND ends_at > $1::timestamptz',
      'ORDER BY starts_at ASC',
      'LIMIT 200',
    ].join(' ')

    const result = await pool.query(bookedTimesSql, [
      startDate.toISOString(),
      endDate.toISOString(),
    ])

    return res.json({
      ok: true,
      bookedTimes: result.rows,
      message:
        result.rows.length > 0
          ? 'Booked times loaded.'
          : 'No booked times in this window.',
    })
  } catch (error) {
    return next(error)
  }
})

async function phase312dPreventDoubleBookedTimes(req, res, next) {
  try {
    const startsAt = phase312dGetBookingStart(req.body)
    const endsAt = phase312dGetBookingEnd(req.body)

    if (!startsAt) return next()

    const conflict = await phase312dFindBookingConflict(startsAt, endsAt)

    if (!conflict) return next()

    return res.status(409).json({
      ok: false,
      bookingConflict: true,
      error:
        'This time is already requested or booked. Please choose another available time.',
      conflict: {
        id: conflict.id,
        startsAt: conflict.starts_at,
        endsAt: conflict.ends_at,
        status: conflict.status,
      },
    })
  } catch (error) {
    return next(error)
  }
}

router.use('/booking-requests', phase312dPreventDoubleBookedTimes)
// phase-3-12d-smart-time-slot-protection-end


// phase-3-12b-hotfix-2-safe-public-availability-start
function phase312bNormalizeDate(value) {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return null

  return date
}

function phase312bAddDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function phase312bGetBookingStart(body = {}) {
  return (
    body.startsAt ||
    body.starts_at ||
    body.startTime ||
    body.start_time ||
    body.start ||
    body.preferredStart ||
    body.preferred_start ||
    body.requestedStart ||
    body.requested_start
  )
}

function phase312bGetBookingEnd(body = {}) {
  return (
    body.endsAt ||
    body.ends_at ||
    body.endTime ||
    body.end_time ||
    body.end ||
    body.preferredEnd ||
    body.preferred_end ||
    body.requestedEnd ||
    body.requested_end
  )
}

async function phase312bFindAvailabilityConflict(startsAt, endsAt) {
  const startDate = phase312bNormalizeDate(startsAt)

  if (!startDate) return null

  const endDate =
    phase312bNormalizeDate(endsAt) ||
    new Date(startDate.getTime() + 60 * 60 * 1000)

  const conflictSql = [
    'SELECT id, title, exception_type, starts_at, ends_at, timezone, notes',
    'FROM availability_exceptions',
    "WHERE status = 'active'",
    'AND starts_at <= $2::timestamptz',
    'AND ends_at >= $1::timestamptz',
    'ORDER BY starts_at ASC',
    'LIMIT 1',
  ].join(' ')

  const result = await pool.query(conflictSql, [
    startDate.toISOString(),
    endDate.toISOString(),
  ])

  return result.rows[0] || null
}

router.get('/availability-exceptions', async (req, res, next) => {
  try {
    const startDate = phase312bNormalizeDate(req.query.start) || new Date()
    const endDate =
      phase312bNormalizeDate(req.query.end) ||
      phase312bAddDays(startDate, 90)

    const availabilitySql = [
      'SELECT id, title, exception_type, starts_at, ends_at, timezone, notes',
      'FROM availability_exceptions',
      "WHERE status = 'active'",
      'AND starts_at <= $2::timestamptz',
      'AND ends_at >= $1::timestamptz',
      'ORDER BY starts_at ASC',
      'LIMIT 100',
    ].join(' ')

    const result = await pool.query(availabilitySql, [
      startDate.toISOString(),
      endDate.toISOString(),
    ])

    return res.json({
      ok: true,
      availabilityExceptions: result.rows,
      message:
        result.rows.length > 0
          ? 'Unavailable dates loaded.'
          : 'No unavailable dates in this window.',
    })
  } catch (error) {
    return next(error)
  }
})

async function phase312bPreventBlockedBookingTimes(req, res, next) {
  try {
    const startsAt = phase312bGetBookingStart(req.body)
    const endsAt = phase312bGetBookingEnd(req.body)

    if (!startsAt) return next()

    const conflict = await phase312bFindAvailabilityConflict(startsAt, endsAt)

    if (!conflict) return next()

    return res.status(409).json({
      ok: false,
      availabilityBlocked: true,
      error:
        'Kim is unavailable during this date or time. Please choose another available option.',
      conflict: {
        id: conflict.id,
        title: conflict.title,
        startsAt: conflict.starts_at,
        endsAt: conflict.ends_at,
      },
    })
  } catch (error) {
    return next(error)
  }
}

router.use('/booking-requests', phase312bPreventBlockedBookingTimes)
// phase-3-12b-hotfix-2-safe-public-availability-end


const publicBookingSchema = z.object({
  appointmentTypeId: z.string().uuid(),
  guestName: z.string().trim().min(1, 'Name is required.'),
  guestEmail: z.string().email(),
  guestPhone: z.string().trim().optional().default(''),
  startsAt: z.string().datetime(),
  timezone: z.string().trim().min(1).optional().default('America/New_York'),
  intakeAnswers: z.record(z.any()).optional().default({}),
})

router.get('/appointment-types', async (req, res, next) => {
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
        id,
        name,
        slug,
        description,
        duration_minutes,
        price_cents,
        currency,
        requires_approval,
        buffer_before_minutes,
        buffer_after_minutes
      FROM appointment_types
      WHERE is_active = true
      ORDER BY created_at DESC
      LIMIT 100
      `,
    )

    res.json({
      ok: true,
      appointmentTypes: result.rows,
    })
  } catch (error) {
    next(error)
  }
})


// phase-3-12b-booking-availability-engine-start
function addDaysForAvailability(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function normalizeBookingDateValue(value) {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return null

  return date
}

function getBookingStartFromBody(body = {}) {
  return (
    body.startsAt ||
    body.starts_at ||
    body.startTime ||
    body.start_time ||
    body.start ||
    body.preferredStart ||
    body.preferred_start ||
    body.requestedStart ||
    body.requested_start
  )
}

function getBookingEndFromBody(body = {}) {
  return (
    body.endsAt ||
    body.ends_at ||
    body.endTime ||
    body.end_time ||
    body.end ||
    body.preferredEnd ||
    body.preferred_end ||
    body.requestedEnd ||
    body.requested_end
  )
}

async function findAvailabilityConflict({ startsAt, endsAt }) {
  if (!pool || !startsAt) return null

  const startDate = normalizeBookingDateValue(startsAt)

  if (!startDate) return null

  const endDate =
    normalizeBookingDateValue(endsAt) ||
    new Date(startDate.getTime() + 60 * 60 * 1000)

  const result = await pool.query(
    `
    SELECT
      id,
      title,
      exception_type,
      starts_at,
      ends_at,
      timezone,
      notes
    FROM availability_exceptions
    WHERE status = $3
      AND starts_at <= $2
      AND ends_at >= $1
    ORDER BY starts_at ASC
    `,
    [startDate.toISOString(), endDate.toISOString(), 'active'],
  )

  return result.rows[0] || null
}

router.get('/availability-exceptions', async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const startDate =
      normalizeBookingDateValue(req.query.start) || new Date()
    const endDate =
      normalizeBookingDateValue(req.query.end) ||
      addDaysForAvailability(startDate, 90)

    const result = await pool.query(
      `
      SELECT
        id,
        title,
        exception_type,
        starts_at,
        ends_at,
        timezone
      FROM availability_exceptions
      WHERE status = $3
        AND starts_at <= $2
        AND ends_at >= $1
      ORDER BY starts_at ASC
      `,
      [startDate.toISOString(), endDate.toISOString(), 'active'],
    )

    return res.json({
      ok: true,
      availabilityExceptions: result.rows.slice(0, 100),
      message:
        result.rows.length > 0
          ? 'Unavailable dates loaded.'
          : 'No unavailable dates in this window.',
    })
  } catch (error) {
    return next(error)
  }
})

async function preventBlockedBookingTimes(req, res, next) {
  if (req.method !== 'POST') return next()

  try {
    const startsAt = getBookingStartFromBody(req.body)
    const endsAt = getBookingEndFromBody(req.body)

    if (!startsAt) return next()

    const conflict = await findAvailabilityConflict({
      startsAt,
      endsAt,
    })

    if (!conflict) return next()

    return res.status(409).json({
      ok: false,
      availabilityBlocked: true,
      error:
        'Kim is unavailable during this date or time. Please choose another available option.',
      conflict: {
        id: conflict.id,
        title: conflict.title,
        startsAt: conflict.starts_at,
        endsAt: conflict.ends_at,
      },
    })
  } catch (error) {
    return next(error)
  }
}
// phase-3-12b-booking-availability-engine-end


router.post('/booking-requests', async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const parsed = publicBookingSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Invalid booking request.',
      })
    }

    const input = parsed.data

    const appointmentTypeResult = await pool.query(
      `
      SELECT
        id,
        name,
        duration_minutes,
        requires_approval,
        is_active
      FROM appointment_types
      WHERE id = $1
      LIMIT 1
      `,
      [input.appointmentTypeId],
    )

    const appointmentType = appointmentTypeResult.rows[0]

    if (!appointmentType || !appointmentType.is_active) {
      return res.status(404).json({
        ok: false,
        error: 'Appointment type is not available.',
      })
    }

    const startsAt = new Date(input.startsAt)

    if (Number.isNaN(startsAt.getTime())) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid start time.',
      })
    }

    const endsAt = new Date(startsAt.getTime() + Number(appointmentType.duration_minutes) * 60 * 1000)
    const status = appointmentType.requires_approval ? 'requested' : 'confirmed'

    const inserted = await pool.query(
      `
      INSERT INTO bookings (
        appointment_type_id,
        guest_name,
        guest_email,
        guest_phone,
        starts_at,
        ends_at,
        timezone,
        status,
        intake_answers
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      RETURNING
        id,
        guest_name,
        guest_email,
        starts_at,
        ends_at,
        timezone,
        status,
        created_at
      `,
      [
        input.appointmentTypeId,
        input.guestName,
        input.guestEmail.toLowerCase(),
        input.guestPhone,
        startsAt.toISOString(),
        endsAt.toISOString(),
        input.timezone,
        status,
        JSON.stringify(input.intakeAnswers),
      ],
    )

    res.status(201).json({
      ok: true,
      message: status === 'requested'
        ? 'Booking request received. An admin will review it.'
        : 'Booking confirmed.',
      booking: inserted.rows[0],
    })
  } catch (error) {
    next(error)
  }
})


// phase-3-9b-client-portal-invite-acceptance-start
function hashPortalInviteToken(token) {
  const crypto = require('crypto')

  return crypto
    .createHash('sha256')
    .update(String(token || '').trim())
    .digest('hex')
}

async function findPortalInviteByToken(token) {
  const tokenHash = hashPortalInviteToken(token)

  const result = await pool.query(
    `
    SELECT
      cpi.*,
      cp.first_name,
      cp.last_name,
      cp.phone,
      cp.client_status,
      su.email AS client_email,
      su.status AS portal_status
    FROM client_portal_invites cpi
    INNER JOIN client_profiles cp
      ON cp.id = cpi.client_profile_id
    INNER JOIN system_users su
      ON su.id = cpi.user_id
    WHERE cpi.invite_token_hash = $1
    LIMIT 1
    `,
    [tokenHash],
  )

  return result.rows[0] || null
}

function sanitizePortalInvite(invite) {
  if (!invite) return null

  return {
    id: invite.id,
    status: invite.status,
    expiresAt: invite.expires_at,
    acceptedAt: invite.accepted_at,
    revokedAt: invite.revoked_at,
    client: {
      id: invite.client_profile_id,
      firstName: invite.first_name,
      lastName: invite.last_name,
      name:
        [invite.first_name, invite.last_name].filter(Boolean).join(' ') ||
        invite.client_email ||
        'Client',
      email: invite.client_email,
      phone: invite.phone,
      clientStatus: invite.client_status,
      portalStatus: invite.portal_status,
    },
  }
}

// phase-3-13t-public-portal-invite-backend-lock-start
function getPublicClientPortalLoginLink() {
  const baseUrl =
    process.env.PUBLIC_SITE_URL ||
    process.env.CLIENT_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:5173'

  return baseUrl.replace(/\/$/, '') + '/client-portal/login'
}

async function lockResolvedPortalInviteLinks(req, res, next) {
  if (!pool) return next()

  const method = String(req.method || '').toUpperCase()

  if (method !== 'GET' && method !== 'POST') return next()

  try {
    const invite = await findPortalInviteByToken(req.params.token)

    if (!invite) return next()

    const status = String(invite.status || '').toLowerCase()
    const loginLink = getPublicClientPortalLoginLink()

    if (
      status === 'pending' &&
      invite.expires_at &&
      new Date(invite.expires_at) < new Date()
    ) {
      await pool.query(
        [
          'UPDATE client_portal_invites',
          "SET status = 'expired', updated_at = now()",
          'WHERE id = $1',
          "AND status = 'pending'",
        ].join(' '),
        [invite.id],
      )

      invite.status = 'expired'
    }

    const currentStatus = String(invite.status || '').toLowerCase()
    const sanitizedInvite = sanitizePortalInvite(invite)

    if (currentStatus === 'accepted') {
      return res.status(200).json({
        ok: true,
        alreadyAccepted: true,
        portalAlreadyActive: true,
        status: 'accepted',
        message:
          'This portal invitation has already been accepted. Please log in to continue.',
        loginLink,
        login_link: loginLink,
        redirectTo: loginLink,
        redirect_to: loginLink,
        invite: {
          ...sanitizedInvite,
          status: 'accepted',
          loginLink,
          login_link: loginLink,
        },
      })
    }

    if (currentStatus === 'revoked' || currentStatus === 'expired') {
      return res.status(410).json({
        ok: false,
        inviteUnavailable: true,
        status: currentStatus,
        error:
          currentStatus === 'expired'
            ? 'This invitation link has expired. Please request a new portal access link.'
            : 'This invitation link is no longer available. Please request a new portal access link.',
        loginLink,
        login_link: loginLink,
        invite: {
          ...sanitizedInvite,
          status: currentStatus,
        },
      })
    }

    return next()
  } catch (error) {
    return next(error)
  }
}
// phase-3-13t-public-portal-invite-backend-lock-end


router.use('/client-portal/invites/:token', lockResolvedPortalInviteLinks)


router.get('/client-portal/invites/:token', async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const invite = await findPortalInviteByToken(req.params.token)

    if (!invite) {
      return res.status(404).json({
        ok: false,
        error: 'This invitation link is invalid or no longer available.',
      })
    }

    if (invite.status === 'pending' && new Date(invite.expires_at) < new Date()) {
      await pool.query(
        `
        UPDATE client_portal_invites
        SET status = 'expired', updated_at = now()
        WHERE id = $1
          AND status = 'pending'
        `,
        [invite.id],
      )

      invite.status = 'expired'
    }

    return res.json({
      ok: true,
      invite: sanitizePortalInvite(invite),
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/client-portal/invites/:token/accept', async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  const bcrypt = require('bcryptjs')
  const dbClient = await pool.connect()

  try {
    const password = String(req.body?.password || '')
    const confirmPassword = String(req.body?.confirmPassword || '')

    if (password.length < 8) {
      return res.status(400).json({
        ok: false,
        error: 'Please choose a password with at least 8 characters.',
      })
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        ok: false,
        error: 'Password confirmation does not match.',
      })
    }

    await dbClient.query('BEGIN')

    const tokenHash = hashPortalInviteToken(req.params.token)

    const inviteResult = await dbClient.query(
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
      WHERE cpi.invite_token_hash = $1
      LIMIT 1
      FOR UPDATE
      `,
      [tokenHash],
    )

    const invite = inviteResult.rows[0]

    if (!invite) {
      await dbClient.query('ROLLBACK')

      return res.status(404).json({
        ok: false,
        error: 'This invitation link is invalid or no longer available.',
      })
    }

    if (invite.status !== 'pending') {
      await dbClient.query('ROLLBACK')

      return res.status(400).json({
        ok: false,
        error: `This invitation is already ${invite.status}.`,
      })
    }

    if (new Date(invite.expires_at) < new Date()) {
      await dbClient.query(
        `
        UPDATE client_portal_invites
        SET status = 'expired', updated_at = now()
        WHERE id = $1
        `,
        [invite.id],
      )

      await dbClient.query('COMMIT')

      return res.status(400).json({
        ok: false,
        error: 'This invitation link has expired.',
      })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await dbClient.query(
      `
      UPDATE system_users
      SET
        password_hash = $1,
        status = 'active',
        updated_at = now()
      WHERE id = $2
      `,
      [passwordHash, invite.user_id],
    )

    const acceptedInviteResult = await dbClient.query(
      `
      UPDATE client_portal_invites
      SET
        status = 'accepted',
        accepted_at = now(),
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [invite.id],
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
      VALUES ($1, 'client_portal_invite_accepted', 'client_portal_invites', $2, $3::jsonb, $4::jsonb)
      `,
      [
        invite.user_id,
        invite.id,
        JSON.stringify({
          status: invite.status,
        }),
        JSON.stringify({
          status: 'accepted',
          clientProfileId: invite.client_profile_id,
          userId: invite.user_id,
          email: invite.client_email,
        }),
      ],
    )

    await dbClient.query('COMMIT')

    return res.json({
      ok: true,
      message: 'Your client portal access has been created.',
      invite: {
        ...sanitizePortalInvite({
          ...invite,
          ...acceptedInviteResult.rows[0],
          portal_status: 'active',
        }),
        status: 'accepted',
      },
    })
  } catch (error) {
    await dbClient.query('ROLLBACK')
    return next(error)
  } finally {
    dbClient.release()
  }
})
// phase-3-9b-client-portal-invite-acceptance-end


// phase-3-9c-client-portal-auth-dashboard-start
function getClientPortalCookieOptions(maxAge = 1000 * 60 * 60 * 24 * 7) {
  const options = {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    secure: env.cookieSecure,
    path: '/',
  }

  if (typeof maxAge === 'number') {
    options.maxAge = maxAge
  }

  if (env.cookieDomain) {
    options.domain = env.cookieDomain
  }

  return options
}

function getClientPortalClearCookieOptions() {
  const options = getClientPortalCookieOptions(undefined)
  delete options.maxAge
  return options
}

function signClientPortalToken(user) {
  const jwt = require('jsonwebtoken')
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('JWT_SECRET is required for client portal authentication.')
  }

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      portal: 'client',
    },
    secret,
    {
      expiresIn: '7d',
    },
  )
}

function verifyClientPortalToken(req) {
  const jwt = require('jsonwebtoken')
  const secret = process.env.JWT_SECRET

  if (!secret) return null

  const token = req.cookies?.pwc_client_token

  if (!token) return null

  try {
    return jwt.verify(token, secret)
  } catch {
    return null
  }
}

async function requireClientPortalUser(req, res, next) {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  const payload = verifyClientPortalToken(req)

  if (!payload?.sub || payload.portal !== 'client') {
    return res.status(401).json({
      ok: false,
      error: 'Client portal login required.',
    })
  }

  try {
    const userResult = await pool.query(
      `
      SELECT
        id,
        email,
        role,
        status,
        created_at,
        updated_at
      FROM system_users
      WHERE id = $1
        AND role = 'client'
        AND status = 'active'
      LIMIT 1
      `,
      [payload.sub],
    )

    const user = userResult.rows[0]

    if (!user) {
      return res.status(401).json({
        ok: false,
        error: 'Client portal login required.',
      })
    }

    const profileResult = await pool.query(
      `
      SELECT *
      FROM client_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [user.id],
    )

    const clientProfile = profileResult.rows[0]

    if (!clientProfile) {
      return res.status(404).json({
        ok: false,
        error: 'Client profile not found.',
      })
    }

    req.clientPortalUser = user
    req.clientProfile = clientProfile

    return next()
  } catch (error) {
    return next(error)
  }
}

function sanitizeClientProfile(user, profile) {
  return {
    id: profile.id,
    userId: user.id,
    email: user.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    name:
      [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
      user.email ||
      'Client',
    phone: profile.phone,
    clientStatus: profile.client_status,
    portalStatus: user.status,
    clientVisibleNotes: profile.client_visible_notes || '',
    intakeCompletedAt: profile.intake_completed_at,
    createdAt: profile.created_at,
  }
}

router.post('/client-portal/login', async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  const bcrypt = require('bcryptjs')

  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: 'Email and password are required.',
      })
    }

    const userResult = await pool.query(
      `
      SELECT
        id,
        email,
        password_hash,
        role,
        status
      FROM system_users
      WHERE lower(email) = lower($1)
        AND role = 'client'
      LIMIT 1
      `,
      [email],
    )

    const user = userResult.rows[0]

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        ok: false,
        error: 'Invalid client portal login.',
      })
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash)

    if (!isValidPassword) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid client portal login.',
      })
    }

    const profileResult = await pool.query(
      `
      SELECT *
      FROM client_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [user.id],
    )

    const profile = profileResult.rows[0]

    if (!profile) {
      return res.status(404).json({
        ok: false,
        error: 'Client profile not found.',
      })
    }

    const token = signClientPortalToken(user)

    res.cookie('pwc_client_token', token, getClientPortalCookieOptions())

    return res.json({
      ok: true,
      client: sanitizeClientProfile(user, profile),
    })
  } catch (error) {
    return next(error)
  }
})

router.post('/client-portal/logout', (req, res) => {
  res.clearCookie('pwc_client_token', getClientPortalClearCookieOptions())

  return res.json({
    ok: true,
    message: 'Signed out of the client portal.',
  })
})

router.get('/client-portal/me', requireClientPortalUser, async (req, res) => {
  return res.json({
    ok: true,
    client: sanitizeClientProfile(req.clientPortalUser, req.clientProfile),
  })
})

router.get('/client-portal/dashboard', requireClientPortalUser, async (req, res, next) => {
  try {
    const profile = req.clientProfile
    const user = req.clientPortalUser

    const serviceRecordsResult = await pool.query(
      `
      SELECT
        id,
        title,
        service_name,
        service_type,
        status,
        summary,
        client_visible_notes,
        service_date,
        follow_up_at,
        created_at,
        updated_at
      FROM service_records
      WHERE client_profile_id = $1
        AND COALESCE(status, 'completed') <> 'archived'
      ORDER BY COALESCE(service_date, created_at) DESC
      LIMIT 30
      `,
      [profile.id],
    )

    const bookingsResult = await pool.query(
      `
      SELECT
        b.id,
        b.status,
        b.starts_at,
        b.ends_at,
        b.timezone,
        b.guest_name,
        b.guest_email,
        at.name AS appointment_type_name
      FROM bookings b
      LEFT JOIN appointment_types at
        ON at.id = b.appointment_type_id
      WHERE b.client_profile_id = $1
      ORDER BY b.starts_at DESC
      LIMIT 20
      `,
      [profile.id],
    )

    const records = serviceRecordsResult.rows

    const visibleNotes = records.filter((record) =>
      String(record.client_visible_notes || '').trim(),
    )

    const followUps = records.filter((record) =>
      record.follow_up_at || record.status === 'follow_up',
    )

    return res.json({
      ok: true,
      client: sanitizeClientProfile(user, profile),
      serviceRecords: records,
      visibleNotes,
      followUps,
      bookings: bookingsResult.rows,
      stats: {
        serviceRecords: records.length,
        visibleNotes: visibleNotes.length,
        followUps: followUps.length,
        bookings: bookingsResult.rows.length,
      },
    })
  } catch (error) {
    return next(error)
  }
})
// phase-3-9c-client-portal-auth-dashboard-end


// phase-3-9d-client-portal-resources-public-start
router.get('/client-portal/resources', requireClientPortalUser, async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        title,
        resource_type,
        description,
        resource_url,
        status,
        created_at,
        updated_at
      FROM client_portal_resources
      WHERE client_profile_id = $1
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 40
      `,
      [req.clientProfile.id],
    )

    return res.json({
      ok: true,
      resources: result.rows,
    })
  } catch (error) {
    return next(error)
  }
})
// phase-3-9d-client-portal-resources-public-end


module.exports = router