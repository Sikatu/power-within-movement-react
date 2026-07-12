const express = require('express')
const { z } = require('zod')

const { pool } = require('../db/pool')
const { env } = require('../config/env')
const {
  buildAvailabilityDays,
  isRequestedSlotAvailable,
  addDateKey: addFounderDateKey,
} = require('../services/founderAvailability.service')
const { getPlatformSettings } = require('../services/platformSettings.service')
const { publishDueEncouragements } = require('../services/encouragements.service')
const {
  clientCanAccessCourse,
  getCourseTree,
  listClientCourses,
} = require('../services/learningLibrary.service')
const { listClientMemberships } = require('../services/membershipCircle.service')
const {
  clientCanAccessCirclePost,
  listClientCircleFeed,
} = require('../services/circleCommunity.service')
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
const { enrollMatchingAutomations } = require('../services/automationStudio.service')
const {
  ensureBookingClientProfile,
  getClientPortalOnboarding,
  listPublicAppointmentTypes,
  processDueBookingCommunications,
  saveClientPortalOnboarding,
  scheduleBookingCommunications,
  startClientOnboarding: startBookingClientOnboarding,
  validateBookingIntake,
} = require('../services/bookingOnboarding.service')

const router = express.Router()
const contactDbModule = require('../db/pool')


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

// Final booking validation now uses the complete founder availability engine.
// phase-3-12b-hotfix-2-safe-public-availability-end


router.get('/availability-slots', async (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  try {
    const appointmentTypeId = String(req.query.appointmentTypeId || '').trim()
    const startDate = String(req.query.start || '').trim()
    const endDate = String(req.query.end || '').trim()

    if (!z.string().uuid().safeParse(appointmentTypeId).success) {
      return res.status(400).json({
        ok: false,
        error: 'Choose a valid appointment type.',
      })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return res.status(400).json({
        ok: false,
        error: 'Availability start date must use YYYY-MM-DD format.',
      })
    }

    const safeEndDate = /^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ? endDate
      : addFounderDateKey(startDate, 45)

    const appointmentTypeResult = await pool.query(
      `
      SELECT
        id,
        name,
        duration_minutes,
        buffer_before_minutes,
        buffer_after_minutes,
        is_active
      FROM appointment_types
      WHERE id = $1
      LIMIT 1
      `,
      [appointmentTypeId],
    )

    const appointmentType = appointmentTypeResult.rows[0]

    if (!appointmentType || !appointmentType.is_active) {
      return res.status(404).json({
        ok: false,
        error: 'Appointment type is not available.',
      })
    }

    const availability = await buildAvailabilityDays({
      pool,
      appointmentType,
      startDate,
      endDate: safeEndDate,
    })

    return res.json({
      ok: true,
      timezone: availability.settings.timezone,
      slotIntervalMinutes: availability.settings.slotIntervalMinutes,
      minimumNoticeMinutes: availability.settings.minimumNoticeMinutes,
      bookingWindowDays: availability.settings.bookingWindowDays,
      scheduleEnabled: availability.settings.scheduleEnabled,
      days: availability.days,
    })
  } catch (error) {
    return next(error)
  }
})


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

    const appointmentTypes = await listPublicAppointmentTypes(pool)

    res.json({
      ok: true,
      appointmentTypes,
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
  if (!pool) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured.',
    })
  }

  const dbClient = await pool.connect()
  let transactionStarted = false

  try {
    const platformSettings = await getPlatformSettings(pool)

    if (platformSettings.maintenanceMode || platformSettings.bookingsPaused) {
      return res.status(503).json({
        ok: false,
        code: 'BOOKINGS_PAUSED',
        error: platformSettings.maintenanceMode
          ? platformSettings.maintenanceMessage
          : 'New booking requests are temporarily paused. Please try again later.',
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
        buffer_before_minutes,
        buffer_after_minutes,
        requires_approval,
        is_active,
        booking_intake_template_id,
        onboarding_template_id,
        auto_create_client_profile,
        auto_start_onboarding,
        send_confirmation_email,
        reminder_24h_enabled,
        reminder_2h_enabled
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

    await validateBookingIntake(
      appointmentType.booking_intake_template_id,
      input.intakeAnswers,
      pool,
    )

    const startsAt = new Date(input.startsAt)

    if (Number.isNaN(startsAt.getTime())) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid start time.',
      })
    }

    const endsAt = new Date(startsAt.getTime() + Number(appointmentType.duration_minutes) * 60 * 1000)

    const slotAvailability = await isRequestedSlotAvailable({
      pool,
      appointmentType,
      startsAt,
    })

    if (!slotAvailability.available) {
      return res.status(409).json({
        ok: false,
        availabilityBlocked: true,
        error:
          'This time is outside Kim’s current availability or is no longer open. Please choose another time.',
      })
    }

    const status = appointmentType.requires_approval ? 'requested' : 'confirmed'

    await dbClient.query('BEGIN')
    transactionStarted = true

    const inserted = await dbClient.query(
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
      RETURNING *
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

    let booking = inserted.rows[0]
    booking.appointment_type_name = appointmentType.name

    let clientProfile = null

    if (appointmentType.auto_create_client_profile) {
      clientProfile = await ensureBookingClientProfile({
        booking,
        appointmentType,
      }, dbClient)

      if (clientProfile) {
        booking = {
          ...booking,
          client_profile_id: clientProfile.id,
        }
      }
    }

    if (
      clientProfile &&
      appointmentType.auto_start_onboarding &&
      appointmentType.onboarding_template_id
    ) {
      await startBookingClientOnboarding({
        clientProfileId: clientProfile.id,
        payload: {
          templateId: appointmentType.onboarding_template_id,
          clientWelcomeMessage:
            'Welcome to your private onboarding space. Complete the intake when you are ready.',
        },
      }, dbClient)
    }

    await scheduleBookingCommunications(booking.id, { status }, dbClient)

    await dbClient.query(
      `
      INSERT INTO audit_logs (
        action,
        entity_type,
        entity_id,
        after_data,
        ip_address,
        user_agent
      )
      VALUES ('public_booking_created', 'bookings', $1, $2::jsonb, $3, $4)
      `,
      [
        booking.id,
        JSON.stringify({
          appointmentTypeId: appointmentType.id,
          appointmentTypeName: appointmentType.name,
          clientProfileId: clientProfile?.id || null,
          status,
          autoStartedOnboarding: Boolean(
            clientProfile &&
            appointmentType.auto_start_onboarding &&
            appointmentType.onboarding_template_id,
          ),
        }),
        req.ip || null,
        req.get('user-agent') || null,
      ],
    )

    await dbClient.query('COMMIT')
    transactionStarted = false

    if (clientProfile?.id) {
      try {
        await enrollMatchingAutomations({
          clientProfileId: clientProfile.id,
          triggerType: 'pipeline_stage',
          triggerStage: 'consultation_booked',
        })
      } catch (automationError) {
        console.error('Booking pipeline automation enrollment failed:', automationError.message)
      }
    }

    try {
      await processDueBookingCommunications({ bookingId: booking.id }, pool)
    } catch (emailError) {
      console.error('Immediate booking communication failed:', emailError.message)
    }

    return res.status(201).json({
      ok: true,
      message: status === 'requested'
        ? 'Booking request received. An admin will review it.'
        : 'Booking confirmed.',
      booking: {
        id: booking.id,
        client_profile_id: clientProfile?.id || null,
        guest_name: booking.guest_name,
        guest_email: booking.guest_email,
        starts_at: booking.starts_at,
        ends_at: booking.ends_at,
        timezone: booking.timezone,
        status: booking.status,
        created_at: booking.created_at,
      },
      onboardingStarted: Boolean(
        clientProfile &&
        appointmentType.auto_start_onboarding &&
        appointmentType.onboarding_template_id,
      ),
    })
  } catch (error) {
    if (transactionStarted) {
      try { await dbClient.query('ROLLBACK') } catch {}
    }
    return next(error)
  } finally {
    dbClient.release()
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

  let platformSettings

  try {
    platformSettings = await getPlatformSettings(pool)
  } catch (error) {
    return next(error)
  }

  if (platformSettings.maintenanceMode || platformSettings.clientLoginsPaused) {
    return res.status(503).json({
      ok: false,
      code: 'CLIENT_LOGINS_PAUSED',
      error: platformSettings.maintenanceMode
        ? platformSettings.maintenanceMessage
        : 'Client Portal sign-in is temporarily paused. Please try again later.',
    })
  }

  const bcrypt = require('bcryptjs')
  const dbClient = await pool.connect()

  try {
    const password = String(req.body?.password || '')
    const confirmPassword = String(req.body?.confirmPassword || '')

    const passwordRule =
      password.length >= 12 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password)

    if (!passwordRule) {
      return res.status(400).json({
        ok: false,
        error:
          'Choose a password with at least 12 characters, including uppercase, lowercase, a number, and a symbol.',
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
        password_changed_at = now(),
        session_version = COALESCE(session_version, 1) + 1,
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
      sessionVersion: Number(user.session_version || 1),
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
    const platformSettings = await getPlatformSettings(pool)

    if (platformSettings.maintenanceMode) {
      return res.status(503).json({
        ok: false,
        code: 'MAINTENANCE_MODE',
        error: platformSettings.maintenanceMessage,
      })
    }

    const userResult = await pool.query(
      `
      SELECT
        id,
        email,
        role,
        status,
        password_changed_at,
        session_version,
        last_login_at,
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

    const tokenSessionVersion = Number(payload.sessionVersion || 1)
    const currentSessionVersion = Number(user.session_version || 1)

    if (tokenSessionVersion !== currentSessionVersion) {
      return res.status(401).json({
        ok: false,
        code: 'SESSION_REVOKED',
        error: 'This client session has been revoked. Please sign in again.',
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
    emergencyContactName: profile.emergency_contact_name,
    emergencyContactPhone: profile.emergency_contact_phone,
    clientStatus: profile.client_status,
    portalStatus: user.status,
    clientVisibleNotes: profile.client_visible_notes || '',
    intakeCompletedAt: profile.intake_completed_at,
    passwordChangedAt: user.password_changed_at,
    lastLoginAt: user.last_login_at,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  }
}

const clientPortalProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().max(80).default(''),
  phone: z.string().trim().max(40).default(''),
  emergencyContactName: z.string().trim().max(120).default(''),
  emergencyContactPhone: z.string().trim().max(40).default(''),
})

const clientPortalPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z
      .string()
      .min(12, 'New password must be at least 12 characters.')
      .max(128, 'New password must be 128 characters or fewer.')
      .regex(/[a-z]/, 'New password must include a lowercase letter.')
      .regex(/[A-Z]/, 'New password must include an uppercase letter.')
      .regex(/[0-9]/, 'New password must include a number.')
      .regex(/[^A-Za-z0-9]/, 'New password must include a symbol.'),
    confirmPassword: z.string().min(1, 'Please confirm the new password.'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'New passwords do not match.',
    path: ['confirmPassword'],
  })

async function writeClientPortalAuditLog(req, action, entityType, entityId, beforeData, afterData) {
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
        req.clientPortalUser?.id || null,
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
    // A client action should not fail only because the audit log is unavailable.
  }
}

router.post('/client-portal/login', async (req, res, next) => {
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

  if (platformSettings.maintenanceMode || platformSettings.clientLoginsPaused) {
    return res.status(503).json({
      ok: false,
      code: 'CLIENT_LOGINS_PAUSED',
      error: platformSettings.maintenanceMode
        ? platformSettings.maintenanceMessage
        : 'Client Portal sign-in is temporarily paused. Please try again later.',
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
        status,
        password_changed_at,
        session_version,
        last_login_at,
        created_at,
        updated_at
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

    const loginResult = await pool.query(
      `
      UPDATE system_users
      SET last_login_at = now(),
          updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        email,
        role,
        status,
        password_changed_at,
        session_version,
        last_login_at,
        created_at,
        updated_at
      `,
      [user.id],
    )

    const authenticatedUser = loginResult.rows[0] || user
    const token = signClientPortalToken(authenticatedUser)

    res.cookie('pwc_client_token', token, getClientPortalCookieOptions())

    return res.json({
      ok: true,
      client: sanitizeClientProfile(authenticatedUser, profile),
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

// booking-intake-onboarding-pass-30-client-start
const clientPortalOnboardingSchema = z.object({
  answers: z.record(z.any()).optional().default({}),
})

router.get('/client-portal/onboarding', requireClientPortalUser, async (req, res, next) => {
  try {
    const snapshot = await getClientPortalOnboarding(req.clientProfile.id, pool)
    return res.json({ ok: true, ...snapshot })
  } catch (error) {
    return next(error)
  }
})

router.patch('/client-portal/onboarding', requireClientPortalUser, async (req, res, next) => {
  try {
    const parsed = clientPortalOnboardingSchema.safeParse(req.body || {})
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Please review your onboarding responses.',
      })
    }

    const snapshot = await saveClientPortalOnboarding({
      clientProfileId: req.clientProfile.id,
      answers: parsed.data.answers,
      submit: false,
    }, pool)

    await writeClientPortalAuditLog(
      req,
      'client_onboarding_draft_saved',
      'client_profiles',
      req.clientProfile.id,
      null,
      { status: snapshot.onboarding?.status || null },
    )

    return res.json({ ok: true, message: 'Your onboarding progress was saved.', ...snapshot })
  } catch (error) {
    return next(error)
  }
})

router.post('/client-portal/onboarding/submit', requireClientPortalUser, async (req, res, next) => {
  try {
    const parsed = clientPortalOnboardingSchema.safeParse(req.body || {})
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Please review your onboarding responses.',
      })
    }

    const snapshot = await saveClientPortalOnboarding({
      clientProfileId: req.clientProfile.id,
      answers: parsed.data.answers,
      submit: true,
    }, pool)

    await writeClientPortalAuditLog(
      req,
      'client_onboarding_submitted',
      'client_profiles',
      req.clientProfile.id,
      null,
      { status: snapshot.onboarding?.status || null },
    )

    return res.json({ ok: true, message: 'Your onboarding intake was submitted.', ...snapshot })
  } catch (error) {
    return next(error)
  }
})
// booking-intake-onboarding-pass-30-client-end

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
        b.appointment_type_id,
        b.status,
        b.starts_at,
        b.ends_at,
        b.timezone,
        b.guest_name,
        b.guest_email,
        b.cancellation_reason,
        at.name AS appointment_type_name,
        at.duration_minutes,
        at.requires_approval
      FROM bookings b
      LEFT JOIN appointment_types at
        ON at.id = b.appointment_type_id
      WHERE b.client_profile_id = $1
      ORDER BY b.starts_at DESC
      LIMIT 20
      `,
      [profile.id],
    )

    const changeRequestsResult = await pool.query(
      `
      SELECT
        id,
        booking_id,
        request_type,
        requested_starts_at,
        requested_ends_at,
        reason,
        status,
        reviewer_notes,
        reviewed_at,
        created_at,
        updated_at
      FROM booking_change_requests
      WHERE client_profile_id = $1
      ORDER BY created_at DESC
      LIMIT 50
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
      bookingChangeRequests: changeRequestsResult.rows,
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


// client-session-self-service-pass-21-start
const clientPortalBookingSchema = z.object({
  appointmentTypeId: z.string().uuid(),
  startsAt: z.string().datetime(),
  timezone: z.string().trim().min(1).default('America/New_York'),
  intakeAnswers: z.record(z.any()).optional().default({}),
})

const clientPortalBookingChangeSchema = z
  .object({
    requestType: z.enum(['reschedule', 'cancel']),
    startsAt: z.string().datetime().optional().nullable(),
    reason: z.string().trim().min(3, 'Please share a short reason.').max(1000),
  })
  .superRefine((value, context) => {
    if (value.requestType === 'reschedule' && !value.startsAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['startsAt'],
        message: 'Choose a new session time.',
      })
    }
  })

async function getClientOwnedBooking(profileId, bookingId) {
  const result = await pool.query(
    `
    SELECT
      b.*,
      at.name AS appointment_type_name,
      at.duration_minutes,
      at.buffer_before_minutes,
      at.buffer_after_minutes,
      at.requires_approval,
      at.is_active AS appointment_type_active
    FROM bookings b
    LEFT JOIN appointment_types at ON at.id = b.appointment_type_id
    WHERE b.id = $1
      AND b.client_profile_id = $2
    LIMIT 1
    `,
    [bookingId, profileId],
  )

  return result.rows[0] || null
}

router.post('/client-portal/bookings', requireClientPortalUser, async (req, res, next) => {
  try {
    const platformSettings = await getPlatformSettings(pool)

    if (platformSettings.maintenanceMode || platformSettings.bookingsPaused) {
      return res.status(503).json({
        ok: false,
        code: 'BOOKINGS_PAUSED',
        error: platformSettings.maintenanceMode
          ? platformSettings.maintenanceMessage
          : 'New booking requests are temporarily paused. Please try again later.',
      })
    }

    const parsed = clientPortalBookingSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Invalid session request.',
      })
    }

    const input = parsed.data
    const appointmentResult = await pool.query(
      `
      SELECT *
      FROM appointment_types
      WHERE id = $1
        AND is_active = true
      LIMIT 1
      `,
      [input.appointmentTypeId],
    )
    const appointmentType = appointmentResult.rows[0]

    if (!appointmentType) {
      return res.status(404).json({ ok: false, error: 'Session type is not available.' })
    }

    const startsAt = new Date(input.startsAt)

    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      return res.status(400).json({ ok: false, error: 'Choose a future session time.' })
    }

    const slotAvailability = await isRequestedSlotAvailable({ pool, appointmentType, startsAt })

    if (!slotAvailability.available) {
      return res.status(409).json({
        ok: false,
        availabilityBlocked: true,
        error: 'That time is no longer available. Please choose another option.',
      })
    }

    const endsAt = new Date(
      startsAt.getTime() + Number(appointmentType.duration_minutes || 60) * 60 * 1000,
    )
    const status = appointmentType.requires_approval ? 'requested' : 'confirmed'
    const profile = req.clientProfile
    const user = req.clientPortalUser
    const guestName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || user.email

    const inserted = await pool.query(
      `
      INSERT INTO bookings (
        appointment_type_id,
        client_profile_id,
        guest_name,
        guest_email,
        guest_phone,
        starts_at,
        ends_at,
        timezone,
        status,
        intake_answers
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      RETURNING *
      `,
      [
        appointmentType.id,
        profile.id,
        guestName,
        user.email,
        profile.phone || '',
        startsAt.toISOString(),
        endsAt.toISOString(),
        input.timezone,
        status,
        JSON.stringify(input.intakeAnswers || {}),
      ],
    )

    await writeClientPortalAuditLog(
      req,
      'client_booking_created',
      'bookings',
      inserted.rows[0].id,
      {},
      inserted.rows[0],
    )

    return res.status(201).json({
      ok: true,
      message: status === 'requested'
        ? 'Your session request was sent for review.'
        : 'Your session is confirmed.',
      booking: {
        ...inserted.rows[0],
        appointment_type_name: appointmentType.name,
      },
    })
  } catch (error) {
    return next(error)
  }
})

router.post(
  '/client-portal/bookings/:bookingId/change-requests',
  requireClientPortalUser,
  async (req, res, next) => {
    const dbClient = await pool.connect()

    try {
      const parsed = clientPortalBookingChangeSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: parsed.error.issues[0]?.message || 'Invalid session change request.',
        })
      }

      const booking = await getClientOwnedBooking(
        req.clientProfile.id,
        req.params.bookingId,
      )

      if (!booking) {
        return res.status(404).json({ ok: false, error: 'Session not found.' })
      }

      const status = String(booking.status || '').toLowerCase()
      const startsAtTime = new Date(booking.starts_at).getTime()

      if (
        !['requested', 'approved', 'confirmed'].includes(status) ||
        !Number.isFinite(startsAtTime) ||
        startsAtTime <= Date.now()
      ) {
        return res.status(409).json({
          ok: false,
          error: 'This session can no longer be changed from the portal.',
        })
      }

      const input = parsed.data
      let requestedStartsAt = null
      let requestedEndsAt = null

      if (input.requestType === 'reschedule') {
        if (!booking.appointment_type_id || !booking.appointment_type_active) {
          return res.status(409).json({
            ok: false,
            error: 'This session type is not currently available for rescheduling.',
          })
        }

        requestedStartsAt = new Date(input.startsAt)

        if (
          Number.isNaN(requestedStartsAt.getTime()) ||
          requestedStartsAt.getTime() <= Date.now()
        ) {
          return res.status(400).json({ ok: false, error: 'Choose a future session time.' })
        }

        const slotAvailability = await isRequestedSlotAvailable({
          pool,
          appointmentType: booking,
          startsAt: requestedStartsAt,
        })

        if (!slotAvailability.available) {
          return res.status(409).json({
            ok: false,
            availabilityBlocked: true,
            error: 'That replacement time is no longer available.',
          })
        }

        requestedEndsAt = new Date(
          requestedStartsAt.getTime() + Number(booking.duration_minutes || 60) * 60 * 1000,
        )
      }

      await dbClient.query('BEGIN')

      const existingPending = await dbClient.query(
        `
        SELECT id
        FROM booking_change_requests
        WHERE booking_id = $1
          AND status = 'pending'
        LIMIT 1
        `,
        [booking.id],
      )

      if (existingPending.rows.length > 0) {
        await dbClient.query('ROLLBACK')
        return res.status(409).json({
          ok: false,
          error: 'A change request for this session is already awaiting review.',
        })
      }

      const autoApproveCancellation =
        input.requestType === 'cancel' && status === 'requested'
      const requestStatus = autoApproveCancellation ? 'approved' : 'pending'

      const inserted = await dbClient.query(
        `
        INSERT INTO booking_change_requests (
          booking_id,
          client_profile_id,
          request_type,
          requested_starts_at,
          requested_ends_at,
          reason,
          status,
          reviewed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          booking.id,
          req.clientProfile.id,
          input.requestType,
          requestedStartsAt?.toISOString() || null,
          requestedEndsAt?.toISOString() || null,
          input.reason,
          requestStatus,
          autoApproveCancellation ? new Date().toISOString() : null,
        ],
      )

      if (autoApproveCancellation) {
        await dbClient.query(
          `
          UPDATE bookings
          SET status = 'cancelled',
              cancellation_reason = $1,
              updated_at = now()
          WHERE id = $2
          `,
          [input.reason, booking.id],
        )
      }

      await dbClient.query('COMMIT')

      await writeClientPortalAuditLog(
        req,
        autoApproveCancellation
          ? 'client_booking_cancelled'
          : 'client_booking_change_requested',
        'booking_change_requests',
        inserted.rows[0].id,
        { bookingId: booking.id, status: booking.status },
        inserted.rows[0],
      )

      return res.status(201).json({
        ok: true,
        message: autoApproveCancellation
          ? 'Your unconfirmed request was cancelled.'
          : 'Your request was sent to Power Within for review.',
        changeRequest: inserted.rows[0],
        bookingStatus: autoApproveCancellation ? 'cancelled' : booking.status,
      })
    } catch (error) {
      try { await dbClient.query('ROLLBACK') } catch {}

      if (error?.code === '23505') {
        return res.status(409).json({
          ok: false,
          error: 'A change request for this session is already awaiting review.',
        })
      }

      return next(error)
    } finally {
      dbClient.release()
    }
  },
)
// client-session-self-service-pass-21-end

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


// client-portal-foundation-pass-13-start

router.get('/client-portal/messages', requireClientPortalUser, async (req, res, next) => {
  try {
    const platformSettings = await getPlatformSettings(pool)

    if (!platformSettings.featureFlags?.clientMessages) {
      return res.json({
        ok: true,
        messages: [],
        unreadCount: 0,
        featureEnabled: false,
      })
    }

    await publishDueEncouragements(pool)

    const result = await pool.query(
      `
      SELECT
        ep.id,
        ep.title,
        ep.body,
        ep.visibility,
        COALESCE(ep.published_at, ep.created_at) AS published_at,
        ep.created_at,
        er.read_at
      FROM encouragement_posts ep
      LEFT JOIN encouragement_recipients er
        ON er.encouragement_post_id = ep.id
       AND er.client_profile_id = $1
      WHERE ep.status = 'published'
        AND COALESCE(ep.published_at, ep.created_at) <= now()
        AND (
          ep.visibility = 'all_members'
          OR er.client_profile_id = $1
        )
      ORDER BY COALESCE(ep.published_at, ep.created_at) DESC
      LIMIT 100
      `,
      [req.clientProfile.id],
    )

    return res.json({
      ok: true,
      messages: result.rows,
      unreadCount: result.rows.filter((message) => !message.read_at).length,
      featureEnabled: true,
    })
  } catch (error) {
    return next(error)
  }
})

router.patch(
  '/client-portal/messages/:messageId/read',
  requireClientPortalUser,
  async (req, res, next) => {
    try {
      const platformSettings = await getPlatformSettings(pool)

      if (!platformSettings.featureFlags?.clientMessages) {
        return res.status(404).json({
          ok: false,
          error: 'Messages are not currently available.',
        })
      }

      await publishDueEncouragements(pool)

      const messageId = String(req.params.messageId || '')

      if (!z.string().uuid().safeParse(messageId).success) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid message.',
        })
      }

      const visibleMessageResult = await pool.query(
        `
        SELECT ep.id
        FROM encouragement_posts ep
        LEFT JOIN encouragement_recipients er
          ON er.encouragement_post_id = ep.id
         AND er.client_profile_id = $2
        WHERE ep.id = $1
          AND ep.status = 'published'
          AND COALESCE(ep.published_at, ep.created_at) <= now()
          AND (
            ep.visibility = 'all_members'
            OR er.client_profile_id = $2
          )
        LIMIT 1
        `,
        [messageId, req.clientProfile.id],
      )

      if (!visibleMessageResult.rows[0]) {
        return res.status(404).json({
          ok: false,
          error: 'Message not found.',
        })
      }

      const result = await pool.query(
        `
        INSERT INTO encouragement_recipients (
          encouragement_post_id,
          client_profile_id,
          read_at
        )
        VALUES ($1, $2, now())
        ON CONFLICT (encouragement_post_id, client_profile_id)
        DO UPDATE SET read_at = COALESCE(encouragement_recipients.read_at, EXCLUDED.read_at)
        RETURNING read_at
        `,
        [messageId, req.clientProfile.id],
      )

      return res.json({
        ok: true,
        messageId,
        readAt: result.rows[0]?.read_at || new Date().toISOString(),
      })
    } catch (error) {
      return next(error)
    }
  },
)

router.patch('/client-portal/profile', requireClientPortalUser, async (req, res, next) => {
  try {
    const parsed = clientPortalProfileSchema.safeParse(req.body || {})

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Please review your profile details.',
      })
    }

    const beforeData = sanitizeClientProfile(req.clientPortalUser, req.clientProfile)
    const values = parsed.data

    const result = await pool.query(
      `
      UPDATE client_profiles
      SET
        first_name = $1,
        last_name = NULLIF($2, ''),
        phone = NULLIF($3, ''),
        emergency_contact_name = NULLIF($4, ''),
        emergency_contact_phone = NULLIF($5, ''),
        updated_at = now()
      WHERE id = $6
      RETURNING *
      `,
      [
        values.firstName,
        values.lastName,
        values.phone,
        values.emergencyContactName,
        values.emergencyContactPhone,
        req.clientProfile.id,
      ],
    )

    const updatedProfile = result.rows[0]

    await writeClientPortalAuditLog(
      req,
      'client_portal_profile_updated',
      'client_profiles',
      req.clientProfile.id,
      beforeData,
      sanitizeClientProfile(req.clientPortalUser, updatedProfile),
    )

    return res.json({
      ok: true,
      message: 'Your profile details were saved.',
      client: sanitizeClientProfile(req.clientPortalUser, updatedProfile),
    })
  } catch (error) {
    return next(error)
  }
})

router.post(
  '/client-portal/change-password',
  requireClientPortalUser,
  async (req, res, next) => {
    const bcrypt = require('bcryptjs')

    try {
      const parsed = clientPortalPasswordSchema.safeParse(req.body || {})

      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: parsed.error.issues[0]?.message || 'Please review your password.',
        })
      }

      const userResult = await pool.query(
        `
        SELECT password_hash, session_version, email, role, status
        FROM system_users
        WHERE id = $1
          AND role = 'client'
          AND status = 'active'
        LIMIT 1
        `,
        [req.clientPortalUser.id],
      )

      const user = userResult.rows[0]

      if (!user) {
        return res.status(401).json({
          ok: false,
          error: 'Client portal login required.',
        })
      }

      const currentPasswordMatches = await bcrypt.compare(
        parsed.data.currentPassword,
        user.password_hash,
      )

      if (!currentPasswordMatches) {
        return res.status(400).json({
          ok: false,
          error: 'Your current password is not correct.',
        })
      }

      const passwordIsUnchanged = await bcrypt.compare(
        parsed.data.newPassword,
        user.password_hash,
      )

      if (passwordIsUnchanged) {
        return res.status(400).json({
          ok: false,
          error: 'Choose a new password that is different from your current password.',
        })
      }

      const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)

      const result = await pool.query(
        `
        UPDATE system_users
        SET
          password_hash = $1,
          password_changed_at = now(),
          session_version = COALESCE(session_version, 1) + 1,
          updated_at = now()
        WHERE id = $2
        RETURNING password_changed_at, session_version, email, role, status
        `,
        [passwordHash, req.clientPortalUser.id],
      )

      const refreshedUser = {
        ...req.clientPortalUser,
        ...result.rows[0],
      }

      res.cookie(
        'pwc_client_token',
        signClientPortalToken(refreshedUser),
        getClientPortalCookieOptions(),
      )

      await writeClientPortalAuditLog(
        req,
        'client_portal_password_changed',
        'system_users',
        req.clientPortalUser.id,
        {},
        {
          passwordChangedAt: result.rows[0]?.password_changed_at || null,
        },
      )

      return res.json({
        ok: true,
        message: 'Your password was changed successfully.',
        passwordChangedAt: result.rows[0]?.password_changed_at || null,
      })
    } catch (error) {
      return next(error)
    }
  },
)

// client-portal-foundation-pass-13-end




// TRIAL CONTACT INQUIRIES ENDPOINT - SAVE TO ADMIN CLIENT CIRCLE
async function contactDbQuery(sql, params = []) {
  if (contactDbModule && typeof contactDbModule.query === 'function') {
    return contactDbModule.query(sql, params)
  }

  if (contactDbModule?.pool && typeof contactDbModule.pool.query === 'function') {
    return contactDbModule.pool.query(sql, params)
  }

  if (contactDbModule?.default && typeof contactDbModule.default.query === 'function') {
    return contactDbModule.default.query(sql, params)
  }

  throw new Error('Database pool query function was not found.')
}

function quoteContactIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

async function getContactTableColumns(tableName) {
  const result = await contactDbQuery(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `,
    [tableName],
  )

  return result.rows.map((row) => row.column_name)
}

async function findClientLeadTable() {
  const possibleTables = ['client_profiles', 'clients']

  for (const tableName of possibleTables) {
    const columns = await getContactTableColumns(tableName)

    if (columns.length > 0) {
      return {
        tableName,
        columns,
      }
    }
  }

  return null
}

function splitContactName(name) {
  const cleanedName = String(name || '').trim()
  const parts = cleanedName.split(/\s+/).filter(Boolean)

  if (parts.length <= 1) {
    return {
      firstName: cleanedName || 'Website Inquiry',
      lastName: '',
    }
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1),
  }
}

function buildContactLeadNotes({ name, email, interest, message, contextLabel, sourcePath, receivedAt }) {
  return [
    `Public website inquiry received: ${receivedAt}`,
    `Name: ${name}`,
    `Email: ${email}`,
    `Interest: ${interest}`,
    `Context: ${contextLabel || 'General contact form'}`,
    `Source: ${sourcePath || '/contact'}`,
    '',
    'Message:',
    message,
  ].join('\n')
}

async function saveContactInquiryAsClientLead(inquiry) {
  const tableMeta = await findClientLeadTable()

  if (!tableMeta) {
    throw new Error('No admin client table found. Expected client_profiles or clients.')
  }

  const { tableName, columns } = tableMeta
  const columnSet = new Set(columns)
  const now = inquiry.receivedAt
  const { firstName, lastName } = splitContactName(inquiry.name)
  const notes = buildContactLeadNotes(inquiry)

  const emailColumn = columnSet.has('public_contact_email') ? 'public_contact_email' : columnSet.has('email') ? 'email' : null

  if (emailColumn) {
    const existing = await contactDbQuery(
      `SELECT * FROM ${quoteContactIdentifier(tableName)} WHERE ${quoteContactIdentifier(emailColumn)} = $1 LIMIT 1`,
      [inquiry.email],
    )

    if (existing.rows.length > 0) {
      const existingClient = existing.rows[0]
      const updateSets = []
      const updateValues = []
      let paramIndex = 1

      if (columnSet.has('private_admin_notes')) {
        updateSets.push(`${quoteContactIdentifier('private_admin_notes')} = ${paramIndex}`)
        updateValues.push(
          [
            notes,
            existingClient.private_admin_notes
              ? `Existing admin notes:\n${existingClient.private_admin_notes}`
              : '',
          ].filter(Boolean).join('\n\n---\n\n'),
        )
        paramIndex += 1
      } else if (columnSet.has('admin_notes')) {
        updateSets.push(`${quoteContactIdentifier('admin_notes')} = ${paramIndex}`)
        updateValues.push(
          [
            notes,
            existingClient.admin_notes
              ? `Existing admin notes:\n${existingClient.admin_notes}`
              : '',
          ].filter(Boolean).join('\n\n---\n\n'),
        )
        paramIndex += 1
      } else if (columnSet.has('notes')) {
        updateSets.push(`${quoteContactIdentifier('notes')} = ${paramIndex}`)
        updateValues.push(
          [
            notes,
            existingClient.notes
              ? `Existing notes:\n${existingClient.notes}`
              : '',
          ].filter(Boolean).join('\n\n---\n\n'),
        )
        paramIndex += 1
      }

      if (columnSet.has('updated_at')) {
        updateSets.push(`${quoteContactIdentifier('updated_at')} = ${paramIndex}`)
        updateValues.push(now)
        paramIndex += 1
      }

      if (updateSets.length > 0) {
        updateValues.push(existingClient.id)

        const updated = await contactDbQuery(
          `
            UPDATE ${quoteContactIdentifier(tableName)}
            SET ${updateSets.join(', ')}
            WHERE id = ${paramIndex}
            RETURNING *
          `,
          updateValues,
        )

        return {
          mode: 'updated_existing_client',
          tableName,
          client: updated.rows[0],
        }
      }

      return {
        mode: 'existing_client_found_no_update_columns',
        tableName,
        client: existingClient,
      }
    }
  }

  const candidateValues = {
    first_name: firstName,
    last_name: lastName,
    name: inquiry.name,
    full_name: inquiry.name,
    display_name: inquiry.name,
    full_name: inquiry.name,
    email: inquiry.email,
    public_contact_email: inquiry.email,
    lead_interest: inquiry.interest,
    lead_source: 'Public Contact Form',
    inquiry_received_at: inquiry.receivedAt,
    primary_email: inquiry.email,
    user_email: inquiry.email,
    contact_email: inquiry.email,
    phone: '',
    client_status: 'lead',
    clientStatus: 'lead',
    status: 'lead',
    portal_status: 'invited',
    portalStatus: 'invited',
    private_admin_notes: notes,
    admin_notes: notes,
    notes,
    client_visible_notes: '',
    lead_source: 'Public Contact Form',
    source: 'Public Contact Form',
    inquiry_source: inquiry.sourcePath || '/contact',
  }

  const insertColumns = Object.keys(candidateValues).filter(
    (column) =>
      columnSet.has(column) &&
      column !== 'created_at' &&
      column !== 'updated_at',
  )

  if (!insertColumns.length) {
    throw new Error(`No matching insert columns found for ${tableName}.`)
  }

  const values = insertColumns.map((column) => candidateValues[column])
  const placeholders = insertColumns.map((_, index) => `$${index + 1}`)

  const inserted = await contactDbQuery(
    `
      INSERT INTO ${quoteContactIdentifier(tableName)}
        (${insertColumns.map(quoteContactIdentifier).join(', ')})
      VALUES
        (${placeholders.join(', ')})
      RETURNING *
    `,
    values,
  )

  return {
    mode: 'created_new_client_lead',
    tableName,
    client: inserted.rows[0],
  }
}

router.post('/contact-inquiries', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim()
    const email = String(req.body?.email || '').trim().toLowerCase()
    const interest = String(req.body?.interest || 'General Message').trim()
    const message = String(req.body?.message || '').trim()
    const contextLabel = String(req.body?.contextLabel || '').trim()
    const sourcePath = String(req.body?.sourcePath || '').trim()
    const receivedAt = new Date().toISOString()

    if (!name || !email || !message) {
      return res.status(400).json({
        ok: false,
        error: 'Name, email, and message are required.',
      })
    }

    const inquiry = {
      id: `contact-${Date.now()}`,
      name,
      email,
      interest,
      message,
      contextLabel,
      sourcePath,
      receivedAt,
    }

    const adminSaveResult = await saveContactInquiryAsClientLead(inquiry)

    if (
      adminSaveResult.mode === 'created_new_client_lead' &&
      adminSaveResult.client?.id
    ) {
      try {
        await enrollMatchingAutomations({
          clientProfileId: adminSaveResult.client.id,
          triggerType: 'new_lead',
          triggerStage: 'new_inquiry',
        })
      } catch (automationError) {
        console.error('Public inquiry automation enrollment failed:', automationError.message)
      }
    }

    console.log('\n[PUBLIC CONTACT INQUIRY SAVED TO ADMIN]')
    console.log(JSON.stringify({
      inquiry,
      adminSaveResult: {
        mode: adminSaveResult.mode,
        tableName: adminSaveResult.tableName,
        clientId: adminSaveResult.client?.id,
      },
    }, null, 2))

    return res.status(201).json({
      ok: true,
      message: 'Inquiry received and saved into the Power Within admin system.',
      inquiry,
      adminSaveResult: {
        mode: adminSaveResult.mode,
        tableName: adminSaveResult.tableName,
        client: adminSaveResult.client,
      },
    })
  } catch (error) {
    next(error)
  }
})

// learning-library-pass-18-public-start
const clientLearningProgressSchema = z.object({
  completed: z.boolean().optional().default(false),
  notes: z.string().trim().max(5000).optional().default(''),
})

router.get('/client-portal/learning', requireClientPortalUser, async (req, res, next) => {
  try {
    const settings = await getPlatformSettings(pool)

    if (!settings.featureFlags?.courses) {
      return res.json({
        ok: true,
        featureEnabled: false,
        courses: [],
      })
    }

    const courses = await listClientCourses(req.clientProfile.id, pool)

    return res.json({
      ok: true,
      featureEnabled: true,
      courses,
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/client-portal/learning/:courseId', requireClientPortalUser, async (req, res, next) => {
  try {
    const settings = await getPlatformSettings(pool)

    if (!settings.featureFlags?.courses) {
      return res.status(404).json({
        ok: false,
        error: 'The Learning Library is not available right now.',
      })
    }

    const canAccess = await clientCanAccessCourse(
      req.params.courseId,
      req.clientProfile.id,
      pool,
    )

    if (!canAccess) {
      return res.status(404).json({
        ok: false,
        error: 'This learning program is not available in your portal.',
      })
    }

    const course = await getCourseTree(
      req.params.courseId,
      {
        publishedOnly: true,
        clientProfileId: req.clientProfile.id,
      },
      pool,
    )

    return res.json({ ok: true, course })
  } catch (error) {
    return next(error)
  }
})

router.patch(
  '/client-portal/learning/lessons/:lessonId/progress',
  requireClientPortalUser,
  async (req, res, next) => {
    const parsed = clientLearningProgressSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Please check your lesson progress.',
      })
    }

    try {
      const lessonResult = await pool.query(
        `
        SELECT
          cl.id,
          cl.title,
          cm.course_id
        FROM course_lessons cl
        JOIN course_modules cm ON cm.id = cl.module_id
        WHERE cl.id = $1
          AND cl.status = 'published'
          AND cm.status = 'published'
        LIMIT 1
        `,
        [req.params.lessonId],
      )

      const lesson = lessonResult.rows[0]

      if (!lesson) {
        return res.status(404).json({ ok: false, error: 'Lesson not found.' })
      }

      const canAccess = await clientCanAccessCourse(
        lesson.course_id,
        req.clientProfile.id,
        pool,
      )

      if (!canAccess) {
        return res.status(403).json({
          ok: false,
          error: 'This lesson is not available in your portal.',
        })
      }

      const result = await pool.query(
        `
        INSERT INTO lesson_progress (
          lesson_id,
          client_profile_id,
          completed_at,
          last_viewed_at,
          notes,
          updated_at
        )
        VALUES (
          $1,
          $2,
          CASE WHEN $3 THEN now() ELSE NULL END,
          now(),
          $4,
          now()
        )
        ON CONFLICT (lesson_id, client_profile_id)
        DO UPDATE SET
          completed_at = CASE WHEN $3 THEN COALESCE(lesson_progress.completed_at, now()) ELSE NULL END,
          last_viewed_at = now(),
          notes = EXCLUDED.notes,
          updated_at = now()
        RETURNING *
        `,
        [
          lesson.id,
          req.clientProfile.id,
          parsed.data.completed,
          parsed.data.notes || null,
        ],
      )

      return res.json({
        ok: true,
        message: parsed.data.completed
          ? 'Lesson marked complete.'
          : 'Lesson progress updated.',
        progress: result.rows[0],
      })
    } catch (error) {
      return next(error)
    }
  },
)
// learning-library-pass-18-public-end


// membership-circle-pass-19-public-start
router.get('/client-portal/memberships', requireClientPortalUser, async (req, res, next) => {
  try {
    const settings = await getPlatformSettings(pool)

    if (!settings.featureFlags?.memberships) {
      return res.json({
        ok: true,
        memberships: [],
        featureEnabled: false,
      })
    }

    const memberships = await listClientMemberships(req.clientProfile.id, pool)

    return res.json({
      ok: true,
      memberships,
      featureEnabled: true,
    })
  } catch (error) {
    return next(error)
  }
})
// membership-circle-pass-19-public-end


// the-circle-community-pass-20-public-start
const circleClientCommentSchema = z.object({
  body: z.string().trim().min(1, 'Write a comment before posting.').max(1500),
})
const circleClientReactionSchema = z.object({
  reactionType: z.enum(['heart', 'celebrate', 'support']).nullable(),
})
const circleClientReportSchema = z.object({
  postId: z.string().uuid().optional(),
  commentId: z.string().uuid().optional(),
  reason: z.enum(['privacy', 'harassment', 'spam', 'misinformation', 'other']),
  details: z.string().trim().max(1000).optional().default(''),
}).refine((value) => value.postId || value.commentId, {
  message: 'Choose a post or comment to report.',
})

async function requireCircleFeatureAndMembership(req, res, next) {
  try {
    const settings = await getPlatformSettings(pool)
    if (!settings.featureFlags?.circleCommunity) {
      return res.status(403).json({
        ok: false,
        code: 'CIRCLE_DISABLED',
        error: 'The Circle is taking a quiet pause right now.',
      })
    }

    const activeMembershipResult = await pool.query(
      `
      SELECT 1
      FROM membership_enrollments me
      JOIN memberships m ON m.id = me.membership_id
      WHERE me.client_profile_id = $1
        AND me.status = 'active'
        AND m.status = 'active'
        AND (me.started_at IS NULL OR me.started_at <= now())
        AND (me.ends_at IS NULL OR me.ends_at > now())
      LIMIT 1
      `,
      [req.clientProfile.id],
    )

    if (!activeMembershipResult.rows[0]) {
      return res.status(403).json({
        ok: false,
        code: 'MEMBERSHIP_REQUIRED',
        error: 'The Circle is available to active members.',
      })
    }

    return next()
  } catch (error) {
    return next(error)
  }
}

router.get(
  '/client-portal/circle',
  requireClientPortalUser,
  async (req, res, next) => {
    try {
      const settings = await getPlatformSettings(pool)
      if (!settings.featureFlags?.circleCommunity) {
        return res.json({
          ok: true,
          featureEnabled: false,
          hasMembershipAccess: false,
          memberships: [],
          posts: [],
        })
      }

      const feed = await listClientCircleFeed(
        req.clientProfile.id,
        req.clientPortalUser.id,
        pool,
      )

      return res.json({
        ok: true,
        featureEnabled: true,
        hasMembershipAccess: feed.memberships.length > 0,
        memberships: feed.memberships,
        posts: feed.posts,
      })
    } catch (error) {
      return next(error)
    }
  },
)

router.post(
  '/client-portal/circle/posts/:postId/comments',
  requireClientPortalUser,
  requireCircleFeatureAndMembership,
  async (req, res, next) => {
    const parsed = circleClientCommentSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'Please check your comment.' })
    }

    try {
      const canAccess = await clientCanAccessCirclePost(
        req.params.postId,
        req.clientProfile.id,
        pool,
      )
      if (!canAccess) return res.status(404).json({ ok: false, error: 'This Circle post is not available.' })

      const postResult = await pool.query(
        'SELECT comments_enabled FROM circle_posts WHERE id = $1 LIMIT 1',
        [req.params.postId],
      )
      if (!postResult.rows[0]?.comments_enabled) {
        return res.status(409).json({ ok: false, error: 'Comments are closed for this post.' })
      }

      const result = await pool.query(
        `
        INSERT INTO circle_comments (post_id, author_user_id, body)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [req.params.postId, req.clientPortalUser.id, parsed.data.body],
      )
      const comment = result.rows[0]
      await writeClientPortalAuditLog(req, 'circle_comment_created', 'circle_comments', comment.id, {}, {
        postId: req.params.postId,
        commentId: comment.id,
      })
      return res.status(201).json({ ok: true, message: 'Your comment was added.', comment })
    } catch (error) {
      return next(error)
    }
  },
)

router.delete(
  '/client-portal/circle/comments/:commentId',
  requireClientPortalUser,
  requireCircleFeatureAndMembership,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `
        UPDATE circle_comments
        SET status = 'deleted', body = '[Comment removed by member]', updated_at = now()
        WHERE id = $1 AND author_user_id = $2 AND status = 'active'
        RETURNING *
        `,
        [req.params.commentId, req.clientPortalUser.id],
      )
      const comment = result.rows[0]
      if (!comment) return res.status(404).json({ ok: false, error: 'Your comment could not be found.' })
      await writeClientPortalAuditLog(req, 'circle_comment_deleted_by_author', 'circle_comments', comment.id, {}, { commentId: comment.id })
      return res.json({ ok: true, message: 'Your comment was removed.' })
    } catch (error) {
      return next(error)
    }
  },
)

router.post(
  '/client-portal/circle/posts/:postId/reaction',
  requireClientPortalUser,
  requireCircleFeatureAndMembership,
  async (req, res, next) => {
    const parsed = circleClientReactionSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Choose a valid reaction.' })

    try {
      const canAccess = await clientCanAccessCirclePost(req.params.postId, req.clientProfile.id, pool)
      if (!canAccess) return res.status(404).json({ ok: false, error: 'This Circle post is not available.' })

      const postResult = await pool.query('SELECT reactions_enabled FROM circle_posts WHERE id = $1 LIMIT 1', [req.params.postId])
      if (!postResult.rows[0]?.reactions_enabled) {
        return res.status(409).json({ ok: false, error: 'Reactions are closed for this post.' })
      }

      if (!parsed.data.reactionType) {
        await pool.query('DELETE FROM circle_reactions WHERE post_id = $1 AND user_id = $2', [req.params.postId, req.clientPortalUser.id])
      } else {
        await pool.query(
          `
          INSERT INTO circle_reactions (post_id, user_id, reaction_type)
          VALUES ($1, $2, $3)
          ON CONFLICT (post_id, user_id)
          DO UPDATE SET reaction_type = EXCLUDED.reaction_type, created_at = now()
          `,
          [req.params.postId, req.clientPortalUser.id, parsed.data.reactionType],
        )
      }

      await writeClientPortalAuditLog(req, 'circle_reaction_changed', 'circle_posts', req.params.postId, {}, {
        reactionType: parsed.data.reactionType,
      })
      return res.json({ ok: true, message: parsed.data.reactionType ? 'Reaction saved.' : 'Reaction removed.' })
    } catch (error) {
      return next(error)
    }
  },
)

router.post(
  '/client-portal/circle/reports',
  requireClientPortalUser,
  requireCircleFeatureAndMembership,
  async (req, res, next) => {
    const parsed = circleClientReportSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'Please check the report.' })

    try {
      let postId = parsed.data.postId || null
      if (parsed.data.commentId) {
        const commentResult = await pool.query('SELECT post_id FROM circle_comments WHERE id = $1 LIMIT 1', [parsed.data.commentId])
        if (!commentResult.rows[0]) return res.status(404).json({ ok: false, error: 'Comment not found.' })
        postId = commentResult.rows[0].post_id
      }

      const canAccess = await clientCanAccessCirclePost(postId, req.clientProfile.id, pool)
      if (!canAccess) return res.status(404).json({ ok: false, error: 'This Circle content is not available.' })

      const result = await pool.query(
        `
        INSERT INTO circle_reports (
          post_id,
          comment_id,
          reporter_user_id,
          reason,
          details
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [postId, parsed.data.commentId || null, req.clientPortalUser.id, parsed.data.reason, parsed.data.details || null],
      )
      const report = result.rows[0]
      await writeClientPortalAuditLog(req, 'circle_content_reported', 'circle_reports', report.id, {}, {
        postId,
        commentId: parsed.data.commentId || null,
        reason: parsed.data.reason,
      })
      return res.status(201).json({ ok: true, message: 'Thank you. Power Within will review this privately.' })
    } catch (error) {
      return next(error)
    }
  },
)
// the-circle-community-pass-20-public-end


// secure-client-inbox-pass-22-public-start
const clientInboxAttachmentSchema = {
  attachmentUrl: z.string().trim().url('Attachment link must be a valid URL.').max(2000).optional().or(z.literal('')),
  attachmentLabel: z.string().trim().max(160).optional().default(''),
}

const clientInboxCreateSchema = z.object({
  subject: z.string().trim().min(1, 'Add a subject.').max(180),
  body: z.string().trim().min(1, 'Write your message.').max(10000),
  ...clientInboxAttachmentSchema,
})

const clientInboxReplySchema = z.object({
  body: z.string().trim().min(1, 'Write your reply.').max(10000),
  ...clientInboxAttachmentSchema,
})

const clientInboxStatusSchema = z.object({
  status: z.enum(['open', 'closed']),
})

async function requireSecureClientInbox(req, res, next) {
  try {
    const settings = await getPlatformSettings(pool)
    if (settings.featureFlags?.secureClientInbox === false) {
      return res.status(503).json({
        ok: false,
        code: 'SECURE_INBOX_DISABLED',
        error: 'Private messaging is temporarily unavailable.',
      })
    }
    return next()
  } catch (error) {
    return next(error)
  }
}

async function getClientInboxConversation(conversationId, clientProfileId, db = pool) {
  const conversationResult = await db.query(
    `
    SELECT
      cc.id,
      cc.subject,
      cc.status,
      cc.priority,
      cc.last_message_at,
      cc.closed_at,
      cc.created_at,
      cc.updated_at,
      assignee.role AS assigned_role
    FROM client_conversations cc
    LEFT JOIN system_users assignee ON assignee.id = cc.assigned_user_id
    WHERE cc.id = $1
      AND cc.client_profile_id = $2
    LIMIT 1
    `,
    [conversationId, clientProfileId],
  )

  const conversation = conversationResult.rows[0]
  if (!conversation) return null

  const messagesResult = await db.query(
    `
    SELECT
      ccm.id,
      ccm.body,
      ccm.attachment_url,
      ccm.attachment_label,
      ccm.sender_role,
      ccm.read_by_client_at,
      ccm.created_at,
      CASE
        WHEN ccm.sender_role = 'client' THEN 'You'
        WHEN ccm.sender_role = 'owner' THEN 'Kim · Power Within'
        ELSE 'Power Within Team'
      END AS sender_name
    FROM client_conversation_messages ccm
    WHERE ccm.conversation_id = $1
      AND ccm.is_internal_note = FALSE
    ORDER BY ccm.created_at ASC
    `,
    [conversationId],
  )

  return { ...conversation, messages: messagesResult.rows }
}

router.get(
  '/client-portal/inbox',
  requireClientPortalUser,
  requireSecureClientInbox,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `
        SELECT
          cc.id,
          cc.subject,
          cc.status,
          cc.priority,
          cc.last_message_at,
          cc.closed_at,
          cc.created_at,
          cc.updated_at,
          COALESCE(counts.message_count, 0)::int AS message_count,
          COALESCE(counts.unread_client_count, 0)::int AS unread_client_count,
          latest.body AS latest_message,
          latest.sender_role AS latest_sender_role
        FROM client_conversations cc
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (WHERE is_internal_note = FALSE)::int AS message_count,
            COUNT(*) FILTER (
              WHERE sender_role <> 'client'
                AND is_internal_note = FALSE
                AND read_by_client_at IS NULL
            )::int AS unread_client_count
          FROM client_conversation_messages
          WHERE conversation_id = cc.id
        ) counts ON true
        LEFT JOIN LATERAL (
          SELECT body, sender_role
          FROM client_conversation_messages
          WHERE conversation_id = cc.id
            AND is_internal_note = FALSE
          ORDER BY created_at DESC
          LIMIT 1
        ) latest ON true
        WHERE cc.client_profile_id = $1
        ORDER BY cc.last_message_at DESC
        LIMIT 100
        `,
        [req.clientProfile.id],
      )

      const unreadCount = result.rows.reduce(
        (total, conversation) => total + Number(conversation.unread_client_count || 0),
        0,
      )

      return res.json({
        ok: true,
        conversations: result.rows,
        unreadCount,
      })
    } catch (error) {
      return next(error)
    }
  },
)

router.get(
  '/client-portal/inbox/:conversationId',
  requireClientPortalUser,
  requireSecureClientInbox,
  async (req, res, next) => {
    try {
      const conversation = await getClientInboxConversation(
        req.params.conversationId,
        req.clientProfile.id,
      )
      if (!conversation) {
        return res.status(404).json({ ok: false, error: 'Conversation not found.' })
      }

      await pool.query(
        `
        UPDATE client_conversation_messages
        SET read_by_client_at = COALESCE(read_by_client_at, now())
        WHERE conversation_id = $1
          AND sender_role <> 'client'
          AND is_internal_note = FALSE
          AND read_by_client_at IS NULL
        `,
        [conversation.id],
      )

      return res.json({
        ok: true,
        conversation: await getClientInboxConversation(
          conversation.id,
          req.clientProfile.id,
        ),
      })
    } catch (error) {
      return next(error)
    }
  },
)

router.post(
  '/client-portal/inbox',
  requireClientPortalUser,
  requireSecureClientInbox,
  async (req, res, next) => {
    const parsed = clientInboxCreateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Please check your message.',
      })
    }

    const db = await pool.connect()
    try {
      await db.query('BEGIN')
      const conversationResult = await db.query(
        `
        INSERT INTO client_conversations (
          client_profile_id,
          subject,
          status,
          priority,
          created_by_user_id
        )
        VALUES ($1, $2, 'waiting_on_team', 'normal', $3)
        RETURNING *
        `,
        [req.clientProfile.id, parsed.data.subject, req.clientPortalUser.id],
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
          read_by_client_at
        )
        VALUES ($1, $2, 'client', $3, $4, $5, now())
        `,
        [
          conversation.id,
          req.clientPortalUser.id,
          parsed.data.body,
          parsed.data.attachmentUrl || null,
          parsed.data.attachmentLabel || null,
        ],
      )

      await db.query('COMMIT')
      await writeClientPortalAuditLog(
        req,
        'client_conversation_created',
        'client_conversations',
        conversation.id,
        {},
        { subject: conversation.subject },
      )

      return res.status(201).json({
        ok: true,
        message: 'Your private message was sent to Power Within.',
        conversation: await getClientInboxConversation(
          conversation.id,
          req.clientProfile.id,
        ),
      })
    } catch (error) {
      await db.query('ROLLBACK')
      return next(error)
    } finally {
      db.release()
    }
  },
)

router.post(
  '/client-portal/inbox/:conversationId/messages',
  requireClientPortalUser,
  requireSecureClientInbox,
  async (req, res, next) => {
    const parsed = clientInboxReplySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'Please check your reply.',
      })
    }

    const db = await pool.connect()
    try {
      await db.query('BEGIN')
      const conversationResult = await db.query(
        `
        SELECT *
        FROM client_conversations
        WHERE id = $1
          AND client_profile_id = $2
        FOR UPDATE
        `,
        [req.params.conversationId, req.clientProfile.id],
      )
      const conversation = conversationResult.rows[0]
      if (!conversation) {
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
          read_by_client_at
        )
        VALUES ($1, $2, 'client', $3, $4, $5, now())
        RETURNING id
        `,
        [
          conversation.id,
          req.clientPortalUser.id,
          parsed.data.body,
          parsed.data.attachmentUrl || null,
          parsed.data.attachmentLabel || null,
        ],
      )

      await db.query(
        `
        UPDATE client_conversations
        SET
          status = 'waiting_on_team',
          closed_at = NULL,
          last_message_at = now(),
          updated_at = now()
        WHERE id = $1
        `,
        [conversation.id],
      )

      await db.query('COMMIT')
      await writeClientPortalAuditLog(
        req,
        'client_conversation_reply_sent',
        'client_conversations',
        conversation.id,
        {},
        { messageId: messageResult.rows[0].id },
      )

      return res.status(201).json({
        ok: true,
        message: 'Your reply was sent.',
        conversation: await getClientInboxConversation(
          conversation.id,
          req.clientProfile.id,
        ),
      })
    } catch (error) {
      await db.query('ROLLBACK')
      return next(error)
    } finally {
      db.release()
    }
  },
)

router.patch(
  '/client-portal/inbox/:conversationId',
  requireClientPortalUser,
  requireSecureClientInbox,
  async (req, res, next) => {
    const parsed = clientInboxStatusSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Choose open or closed.' })
    }

    try {
      const beforeResult = await pool.query(
        `
        SELECT *
        FROM client_conversations
        WHERE id = $1
          AND client_profile_id = $2
        LIMIT 1
        `,
        [req.params.conversationId, req.clientProfile.id],
      )
      const before = beforeResult.rows[0]
      if (!before) return res.status(404).json({ ok: false, error: 'Conversation not found.' })

      const nextStatus = parsed.data.status === 'closed' ? 'closed' : 'waiting_on_team'
      const result = await pool.query(
        `
        UPDATE client_conversations
        SET
          status = $3,
          closed_at = CASE WHEN $3 = 'closed' THEN now() ELSE NULL END,
          updated_at = now()
        WHERE id = $1
          AND client_profile_id = $2
        RETURNING *
        `,
        [before.id, req.clientProfile.id, nextStatus],
      )

      await writeClientPortalAuditLog(
        req,
        nextStatus === 'closed' ? 'client_conversation_closed_by_client' : 'client_conversation_reopened_by_client',
        'client_conversations',
        before.id,
        before,
        result.rows[0],
      )

      return res.json({
        ok: true,
        message: nextStatus === 'closed' ? 'Conversation closed.' : 'Conversation reopened.',
        conversation: await getClientInboxConversation(before.id, req.clientProfile.id),
      })
    } catch (error) {
      return next(error)
    }
  },
)
// secure-client-inbox-pass-22-public-end



// unified-notification-center-pass-25-client-start
const clientNotificationPreferencesSchema = z.object({
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

router.get('/client-portal/notifications/summary', requireClientPortalUser, async (req, res, next) => {
  try {
    return res.json({ ok: true, summary: await getNotificationSummary(req.clientPortalUser.id) })
  } catch (error) {
    return next(error)
  }
})

router.get('/client-portal/notifications', requireClientPortalUser, async (req, res, next) => {
  try {
    const result = await listNotifications(req.clientPortalUser.id, {
      limit: req.query.limit,
      unreadOnly: req.query.unreadOnly === 'true',
      category: req.query.category,
    })
    return res.json({ ok: true, ...result })
  } catch (error) {
    return next(error)
  }
})

router.patch('/client-portal/notifications/:notificationId/read', requireClientPortalUser, async (req, res, next) => {
  try {
    const notification = await markNotificationRead(req.clientPortalUser.id, req.params.notificationId)
    if (!notification) return res.status(404).json({ ok: false, error: 'Notification not found.' })
    return res.json({ ok: true, notification })
  } catch (error) {
    return next(error)
  }
})

router.post('/client-portal/notifications/mark-all-read', requireClientPortalUser, async (req, res, next) => {
  try {
    const updated = await markAllNotificationsRead(req.clientPortalUser.id)
    return res.json({ ok: true, updated, message: updated ? 'All notifications marked as read.' : 'No unread notifications remained.' })
  } catch (error) {
    return next(error)
  }
})

router.delete('/client-portal/notifications/:notificationId', requireClientPortalUser, async (req, res, next) => {
  try {
    const dismissed = await dismissNotification(req.clientPortalUser.id, req.params.notificationId)
    if (!dismissed) return res.status(404).json({ ok: false, error: 'Notification not found.' })
    return res.json({ ok: true, message: 'Notification removed.' })
  } catch (error) {
    return next(error)
  }
})

router.post('/client-portal/notifications/clear-read', requireClientPortalUser, async (req, res, next) => {
  try {
    const dismissed = await dismissReadNotifications(req.clientPortalUser.id)
    return res.json({ ok: true, dismissed, message: dismissed ? 'Read notifications cleared.' : 'No read notifications needed clearing.' })
  } catch (error) {
    return next(error)
  }
})

router.get('/client-portal/notifications/preferences', requireClientPortalUser, async (req, res, next) => {
  try {
    return res.json({ ok: true, preferences: await getNotificationPreferences(req.clientPortalUser.id) })
  } catch (error) {
    return next(error)
  }
})

router.patch('/client-portal/notifications/preferences', requireClientPortalUser, async (req, res, next) => {
  const parsed = clientNotificationPreferencesSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'Please check the notification preferences.' })

  try {
    const preferences = await saveNotificationPreferences(req.clientPortalUser.id, parsed.data)
    await writeClientPortalAuditLog(req, 'notification_preferences_updated', 'system_users', req.clientPortalUser.id, {}, preferences)
    return res.json({ ok: true, message: 'Notification preferences saved.', preferences })
  } catch (error) {
    return next(error)
  }
})
// unified-notification-center-pass-25-client-end

module.exports = router
