const FOUNDER_TIME_ZONE = 'America/New_York'

const DEFAULT_SETTINGS = {
  timezone: FOUNDER_TIME_ZONE,
  scheduleEnabled: false,
  slotIntervalMinutes: 60,
  minimumNoticeMinutes: 0,
  bookingWindowDays: 90,
}

const LEGACY_WINDOWS = [
  { startTime: '09:00', endTime: '12:00' },
  { startTime: '13:00', endTime: '16:00' },
]

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

function zonedDateTimeToUtc(dateValue, timeValue, timeZone = FOUNDER_TIME_ZONE) {
  const [year, month, day] = String(dateValue).split('-').map(Number)
  const [hour, minute] = String(timeValue).slice(0, 5).split(':').map(Number)
  const firstGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  const firstOffset = getTimeZoneOffsetMs(firstGuess, timeZone)
  const adjusted = new Date(firstGuess.getTime() - firstOffset)
  const finalOffset = getTimeZoneOffsetMs(adjusted, timeZone)

  return new Date(firstGuess.getTime() - finalOffset)
}

function getDateKeyInTimeZone(value = new Date(), timeZone = FOUNDER_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))

  const values = Object.fromEntries(
    parts
      .filter((part) => ['year', 'month', 'day'].includes(part.type))
      .map((part) => [part.type, part.value]),
  )

  return `${values.year}-${values.month}-${values.day}`
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function formatDateKey(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function addDateKey(dateKey, days) {
  const date = parseDateKey(dateKey)
  date.setUTCDate(date.getUTCDate() + days)
  return formatDateKey(date)
}

function getWeekday(dateKey) {
  return parseDateKey(dateKey).getUTCDay()
}

function timeToMinutes(value) {
  const [hour, minute] = String(value).slice(0, 5).split(':').map(Number)
  return hour * 60 + minute
}

function minutesToTime(value) {
  const hour = Math.floor(value / 60)
  const minute = value % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB
}

async function getFounderAvailabilitySettings(pool, ownerUserId = null) {
  const result = ownerUserId
    ? await pool.query(
        `
        SELECT
          fas.id,
          fas.owner_user_id,
          fas.timezone,
          fas.schedule_enabled,
          fas.slot_interval_minutes,
          fas.minimum_notice_minutes,
          fas.booking_window_days,
          fas.created_at,
          fas.updated_at
        FROM founder_availability_settings fas
        WHERE fas.owner_user_id = $1
        LIMIT 1
        `,
        [ownerUserId],
      )
    : await pool.query(
        `
        SELECT
          fas.id,
          fas.owner_user_id,
          fas.timezone,
          fas.schedule_enabled,
          fas.slot_interval_minutes,
          fas.minimum_notice_minutes,
          fas.booking_window_days,
          fas.created_at,
          fas.updated_at
        FROM founder_availability_settings fas
        LEFT JOIN system_users su ON su.id = fas.owner_user_id
        ORDER BY
          CASE
            WHEN su.role = 'owner' AND su.status = 'active' AND fas.schedule_enabled = true THEN 0
            WHEN su.role = 'owner' AND su.status = 'active' THEN 1
            ELSE 2
          END,
          fas.updated_at DESC,
          fas.created_at DESC
        LIMIT 1
        `,
      )

  const row = result.rows[0]

  if (!row) {
    return {
      ...DEFAULT_SETTINGS,
      ownerUserId: ownerUserId || null,
    }
  }

  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    timezone: row.timezone || FOUNDER_TIME_ZONE,
    scheduleEnabled: Boolean(row.schedule_enabled),
    slotIntervalMinutes: Number(row.slot_interval_minutes) || 60,
    minimumNoticeMinutes: Number(row.minimum_notice_minutes) || 0,
    bookingWindowDays: Number(row.booking_window_days) || 90,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function buildAvailabilityDays({
  pool,
  appointmentType,
  startDate,
  endDate,
  now = new Date(),
}) {
  const settings = await getFounderAvailabilitySettings(pool)
  const timeZone = settings.timezone || FOUNDER_TIME_ZONE
  const todayKey = getDateKeyInTimeZone(now, timeZone)
  const bookingWindowEnd = addDateKey(todayKey, settings.bookingWindowDays)
  const safeStart = startDate < todayKey ? todayKey : startDate
  const requestedEnd = endDate > bookingWindowEnd ? bookingWindowEnd : endDate

  if (requestedEnd < safeStart) {
    return { settings, days: [] }
  }

  const rangeStartUtc = zonedDateTimeToUtc(safeStart, '00:00', timeZone)
  const rangeEndUtc = zonedDateTimeToUtc(addDateKey(requestedEnd, 1), '00:00', timeZone)

  const [blocksResult, exceptionsResult, bookingsResult] = await Promise.all([
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
        notes
      FROM availability_blocks
      WHERE is_active = true
        AND ($3::uuid IS NULL OR owner_user_id = $3)
        AND (
          specific_date IS NULL
          OR (specific_date >= $1::date AND specific_date <= $2::date)
        )
      ORDER BY specific_date NULLS LAST, weekday NULLS LAST, start_time ASC
      `,
      [safeStart, requestedEnd, settings.ownerUserId || null],
    ),
    pool.query(
      `
      SELECT id, title, exception_type, starts_at, ends_at, timezone, notes
      FROM availability_exceptions
      WHERE status = 'active'
        AND starts_at < $2
        AND ends_at > $1
      ORDER BY starts_at ASC
      `,
      [rangeStartUtc.toISOString(), rangeEndUtc.toISOString()],
    ),
    pool.query(
      `
      SELECT id, starts_at, ends_at, status
      FROM bookings
      WHERE COALESCE(status, 'requested') NOT IN (
        'cancelled', 'canceled', 'rejected', 'declined', 'archived'
      )
        AND starts_at < $2
        AND ends_at > $1
      ORDER BY starts_at ASC
      `,
      [rangeStartUtc.toISOString(), rangeEndUtc.toISOString()],
    ),
  ])

  const recurringByWeekday = new Map()
  const specificByDate = new Map()

  blocksResult.rows.forEach((block) => {
    const normalized = {
      id: block.id,
      startTime: String(block.start_time).slice(0, 5),
      endTime: String(block.end_time).slice(0, 5),
      notes: block.notes || '',
    }

    if (block.specific_date) {
      const key = String(block.specific_date).slice(0, 10)
      const entries = specificByDate.get(key) || []
      entries.push(normalized)
      specificByDate.set(key, entries)
      return
    }

    const weekday = Number(block.weekday)
    const entries = recurringByWeekday.get(weekday) || []
    entries.push(normalized)
    recurringByWeekday.set(weekday, entries)
  })

  const durationMinutes = Number(appointmentType.duration_minutes || 60)
  const bufferBeforeMinutes = Number(appointmentType.buffer_before_minutes || 0)
  const bufferAfterMinutes = Number(appointmentType.buffer_after_minutes || 0)
  const cutoff = new Date(now.getTime() + settings.minimumNoticeMinutes * 60 * 1000)
  const days = []

  for (
    let dateKey = safeStart;
    dateKey <= requestedEnd;
    dateKey = addDateKey(dateKey, 1)
  ) {
    const customWindows = specificByDate.get(dateKey) || []
    let windows = customWindows
    let source = 'custom'

    if (windows.length === 0) {
      if (settings.scheduleEnabled) {
        windows = recurringByWeekday.get(getWeekday(dateKey)) || []
        source = 'weekly'
      } else {
        windows = LEGACY_WINDOWS
        source = 'legacy'
      }
    }

    const slots = []

    windows.forEach((window) => {
      const startMinutes = timeToMinutes(window.startTime)
      const endMinutes = timeToMinutes(window.endTime)

      for (
        let slotMinutes = startMinutes;
        slotMinutes + durationMinutes <= endMinutes;
        slotMinutes += settings.slotIntervalMinutes
      ) {
        const localTime = minutesToTime(slotMinutes)
        const startsAt = zonedDateTimeToUtc(dateKey, localTime, timeZone)
        const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000)

        if (startsAt < cutoff) continue

        const exceptionConflict = exceptionsResult.rows.some((exception) => {
          if (
            source === 'custom' &&
            ['day', 'date_range'].includes(exception.exception_type)
          ) {
            return false
          }

          return overlaps(
            startsAt,
            endsAt,
            new Date(exception.starts_at),
            new Date(exception.ends_at),
          )
        })

        if (exceptionConflict) continue

        const bufferedStart = new Date(
          startsAt.getTime() - bufferBeforeMinutes * 60 * 1000,
        )
        const bufferedEnd = new Date(
          endsAt.getTime() + bufferAfterMinutes * 60 * 1000,
        )

        const bookingConflict = bookingsResult.rows.some((booking) =>
          overlaps(
            bufferedStart,
            bufferedEnd,
            new Date(booking.starts_at),
            new Date(booking.ends_at),
          ),
        )

        if (bookingConflict) continue

        slots.push({
          time: localTime,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        })
      }
    })

    days.push({
      date: dateKey,
      source,
      windows,
      slots,
      isAvailable: slots.length > 0,
    })
  }

  return { settings, days }
}

async function isRequestedSlotAvailable({ pool, appointmentType, startsAt }) {
  const settings = await getFounderAvailabilitySettings(pool)
  const dateKey = getDateKeyInTimeZone(startsAt, settings.timezone)
  const result = await buildAvailabilityDays({
    pool,
    appointmentType,
    startDate: dateKey,
    endDate: dateKey,
  })
  const requestedTime = new Date(startsAt).getTime()
  const matchingSlot = result.days[0]?.slots.find(
    (slot) => Math.abs(new Date(slot.startsAt).getTime() - requestedTime) < 30_000,
  )

  return {
    available: Boolean(matchingSlot),
    settings: result.settings,
    slot: matchingSlot || null,
  }
}

module.exports = {
  FOUNDER_TIME_ZONE,
  DEFAULT_SETTINGS,
  getFounderAvailabilitySettings,
  buildAvailabilityDays,
  isRequestedSlotAvailable,
  zonedDateTimeToUtc,
  getDateKeyInTimeZone,
  addDateKey,
}
