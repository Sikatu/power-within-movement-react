import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import FounderDeveloperBanner from '../../components/admin/FounderDeveloperBanner'
import {
  getAdminFounderAvailability,
  logoutAdmin,
  updateAdminFounderDateAvailability,
  updateAdminFounderWeeklyAvailability,
} from '../../lib/nativeApi'

import './AdminUIBlankSlate.css'

const FOUNDER_TIME_ZONE = 'America/New_York'
const WEEKDAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
]
const DEFAULT_WINDOWS = [
  { startTime: '09:00', endTime: '12:00' },
  { startTime: '13:00', endTime: '16:00' },
]

const COMMON_HOURS = [
  {
    label: 'Morning',
    detail: '9:00 AM–12:00 PM',
    windows: [{ startTime: '09:00', endTime: '12:00' }],
  },
  {
    label: 'Afternoon',
    detail: '1:00 PM–5:00 PM',
    windows: [{ startTime: '13:00', endTime: '17:00' }],
  },
  {
    label: 'Full day',
    detail: '9:00 AM–5:00 PM',
    windows: [{ startTime: '09:00', endTime: '17:00' }],
  },
]

function getTimeZoneParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FOUNDER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))

  return Object.fromEntries(
    parts
      .filter((part) =>
        ['year', 'month', 'day', 'hour', 'minute'].includes(part.type),
      )
      .map((part) => [part.type, part.value]),
  )
}

function getDateKey(value = new Date()) {
  const parts = getTimeZoneParts(value)
  return `${parts.year}-${parts.month}-${parts.day}`
}

function formatDate(dateValue) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(`${dateValue}T12:00:00Z`))
  } catch {
    return dateValue
  }
}

function formatShortDate(dateValue) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(`${dateValue}T12:00:00Z`))
  } catch {
    return dateValue
  }
}

function formatTime(timeValue) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(`2026-01-01T${String(timeValue).slice(0, 5)}:00Z`))
  } catch {
    return String(timeValue).slice(0, 5)
  }
}

function normalizeWindow(window) {
  return {
    startTime: String(window.startTime || window.start_time || '09:00').slice(0, 5),
    endTime: String(window.endTime || window.end_time || '17:00').slice(0, 5),
  }
}


function windowsMatch(left = [], right = []) {
  if (left.length !== right.length) return false
  return left.every(
    (window, index) =>
      window.startTime === right[index]?.startTime &&
      window.endTime === right[index]?.endTime,
  )
}

function getWindowsSummary(windows = []) {
  if (windows.length === 0) return 'No appointment times'
  return windows
    .map(
      (window) =>
        `${formatTime(window.startTime)}–${formatTime(window.endTime)}`,
    )
    .join(' · ')
}

function validateTimeWindows(windows = [], label = 'These hours') {
  if (windows.length === 0) {
    return `${label} need at least one time period.`
  }

  const normalized = windows.map((window) => ({
    startTime: String(window.startTime || '').slice(0, 5),
    endTime: String(window.endTime || '').slice(0, 5),
  }))

  for (const window of normalized) {
    if (!window.startTime || !window.endTime) {
      return `${label} have a missing start or end time.`
    }
    if (window.startTime >= window.endTime) {
      return `${label}: the end time must be later than the start time.`
    }
  }

  const sorted = [...normalized].sort((left, right) =>
    left.startTime.localeCompare(right.startTime),
  )

  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].startTime < sorted[index - 1].endTime) {
      return `${label} contain overlapping time periods.`
    }
  }

  return ''
}

function createWeeklySchedule(blocks = [], scheduleEnabled = false) {
  const recurring = blocks.filter((block) => !block.specific_date)

  return WEEKDAYS.map((day) => {
    const windows = recurring
      .filter((block) => Number(block.weekday) === day.value)
      .map(normalizeWindow)

    return {
      weekday: day.value,
      isAvailable: scheduleEnabled ? windows.length > 0 : true,
      windows:
        scheduleEnabled && windows.length === 0
          ? [{ startTime: '09:00', endTime: '17:00' }]
          : windows.length > 0
            ? windows
            : DEFAULT_WINDOWS.map((window) => ({ ...window })),
    }
  })
}

function getExceptionDateKeys(exception) {
  if (!exception?.starts_at || !exception?.ends_at) return []
  const start = getDateKey(exception.starts_at)
  const end = getDateKey(exception.ends_at)
  const current = new Date(`${start}T12:00:00Z`)
  const endDate = new Date(`${end}T12:00:00Z`)
  const keys = []

  while (current <= endDate) {
    keys.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return keys
}

function getDateOverrideMode(dateValue, blocks, exceptions) {
  const customWindows = blocks
    .filter((block) => String(block.specific_date || '').slice(0, 10) === dateValue)
    .map(normalizeWindow)

  if (customWindows.length > 0) {
    return { mode: 'custom', windows: customWindows }
  }

  const unavailable = exceptions.some(
    (exception) =>
      ['day', 'date_range'].includes(exception.exception_type) &&
      getExceptionDateKeys(exception).includes(dateValue),
  )

  return {
    mode: unavailable ? 'unavailable' : 'regular',
    windows: [{ startTime: '09:00', endTime: '12:00' }],
  }
}

function groupUpcomingOverrides(blocks, exceptions) {
  const grouped = new Map()
  const today = getDateKey()

  blocks
    .filter((block) => block.specific_date)
    .forEach((block) => {
      const date = String(block.specific_date).slice(0, 10)
      if (date < today) return
      const current = grouped.get(date) || { date, mode: 'custom', windows: [] }
      current.windows.push(normalizeWindow(block))
      grouped.set(date, current)
    })

  exceptions.forEach((exception) => {
    if (!['day', 'date_range'].includes(exception.exception_type)) return
    getExceptionDateKeys(exception).forEach((date) => {
      if (date < today || grouped.has(date)) return
      grouped.set(date, { date, mode: 'unavailable', windows: [] })
    })
  })

  return [...grouped.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 12)
}

function WindowEditor({ windows, onChange, compact = false }) {
  function updateWindow(index, field, value) {
    onChange(
      windows.map((window, windowIndex) =>
        windowIndex === index ? { ...window, [field]: value } : window,
      ),
    )
  }

  function applyPreset(presetWindows) {
    onChange(presetWindows.map((window) => ({ ...window })))
  }

  return (
    <div className={compact ? 'founder-hours__windows is-compact' : 'founder-hours__windows'}>
      <div className="founder-hours__presets" aria-label="Common hour choices">
        {COMMON_HOURS.map((preset) => (
          <button
            type="button"
            className={windowsMatch(windows, preset.windows) ? 'is-selected' : ''}
            key={preset.label}
            onClick={() => applyPreset(preset.windows)}
          >
            <strong>{preset.label}</strong>
            <small>{preset.detail}</small>
          </button>
        ))}
      </div>

      <div className="founder-hours__time-list">
        {windows.map((window, index) => (
          <div className="founder-hours__window" key={`window-${index}`}>
            <span className="founder-hours__window-number" aria-hidden="true">
              {index + 1}
            </span>
            <label>
              <span>Start time</span>
              <input
                type="time"
                value={window.startTime}
                onChange={(event) => updateWindow(index, 'startTime', event.target.value)}
              />
            </label>
            <span className="founder-hours__to" aria-hidden="true">to</span>
            <label>
              <span>End time</span>
              <input
                type="time"
                value={window.endTime}
                onChange={(event) => updateWindow(index, 'endTime', event.target.value)}
              />
            </label>
            <button
              type="button"
              className="founder-hours__remove-window"
              onClick={() => onChange(windows.filter((_, windowIndex) => windowIndex !== index))}
              disabled={windows.length === 1}
              aria-label={`Remove time period ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="founder-hours__add-window"
        onClick={() =>
          onChange([...windows, { startTime: '13:00', endTime: '17:00' }])
        }
      >
        + Add another time period
      </button>
      <p className="founder-hours__window-help">
        Add another period when you want a break between appointments.
      </p>
    </div>
  )
}

export default function AdminFounderAvailability() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [workspace, setWorkspace] = useState(null)
  const [weeklySchedule, setWeeklySchedule] = useState([])
  const [settings, setSettings] = useState({
    timezone: FOUNDER_TIME_ZONE,
    slotIntervalMinutes: 60,
    minimumNoticeMinutes: 0,
    bookingWindowDays: 90,
    scheduleEnabled: false,
  })
  const [selectedDate, setSelectedDate] = useState(
    searchParams.get('date') || getDateKey(),
  )
  const [dateMode, setDateMode] = useState('regular')
  const [dateWindows, setDateWindows] = useState([
    { startTime: '09:00', endTime: '12:00' },
  ])
  const [dateNotes, setDateNotes] = useState('')
  const [activeWeekday, setActiveWeekday] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingWeekly, setIsSavingWeekly] = useState(false)
  const [isSavingDate, setIsSavingDate] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [copiedWeekdays, setCopiedWeekdays] = useState([])

  const availabilityBlocks = useMemo(
    () => workspace?.availabilityBlocks || [],
    [workspace?.availabilityBlocks],
  )
  const availabilityExceptions = useMemo(
    () => workspace?.availabilityExceptions || [],
    [workspace?.availabilityExceptions],
  )
  const upcomingOverrides = useMemo(
    () => groupUpcomingOverrides(availabilityBlocks, availabilityExceptions),
    [availabilityBlocks, availabilityExceptions],
  )
  const availableDayCount = useMemo(
    () => weeklySchedule.filter((day) => day.isAvailable).length,
    [weeklySchedule],
  )
  const weeklyWindowCount = useMemo(
    () => weeklySchedule.reduce(
      (total, day) => total + (day.isAvailable ? day.windows.length : 0),
      0,
    ),
    [weeklySchedule],
  )

  const loadAvailability = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await getAdminFounderAvailability()
      const nextSettings = {
        timezone: response.settings?.timezone || FOUNDER_TIME_ZONE,
        slotIntervalMinutes: response.settings?.slotIntervalMinutes || 60,
        minimumNoticeMinutes: response.settings?.minimumNoticeMinutes || 0,
        bookingWindowDays: response.settings?.bookingWindowDays || 90,
        scheduleEnabled: Boolean(response.settings?.scheduleEnabled),
      }
      setWorkspace(response)
      setSettings(nextSettings)
      setWeeklySchedule(
        createWeeklySchedule(
          response.availabilityBlocks || [],
          nextSettings.scheduleEnabled,
        ),
      )
    } catch (loadError) {
      setError(loadError.message || 'Unable to load availability settings.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    document.body.classList.add('admin-app-mode')
    document.body.classList.add('founder-availability-mode')
    const timer = window.setTimeout(() => loadAvailability(), 0)

    return () => {
      window.clearTimeout(timer)
      document.body.classList.remove('founder-availability-mode')
      document.body.classList.remove('admin-app-mode')
    }
  }, [loadAvailability])

  useEffect(() => {
    if (!workspace) return undefined
    const timer = window.setTimeout(() => {
      const override = getDateOverrideMode(
        selectedDate,
        availabilityBlocks,
        availabilityExceptions,
      )
      setDateMode(override.mode)
      setDateWindows(override.windows)
      setDateNotes('')
    }, 0)

    return () => window.clearTimeout(timer)
  }, [availabilityBlocks, availabilityExceptions, selectedDate, workspace])

  function updateDay(weekday, updater) {
    setCopyStatus('')
    setCopiedWeekdays([])
    setWeeklySchedule((current) =>
      current.map((day) => (day.weekday === weekday ? updater(day) : day)),
    )
  }

  function copyMondayToWeekdays() {
    setNotice('')
    setError('')

    const monday = weeklySchedule.find((day) => day.weekday === 1)
    if (!monday) {
      setError('Monday could not be found. Refresh the page and try again.')
      return
    }

    if (monday.isAvailable) {
      const validationError = validateTimeWindows(monday.windows, 'Monday')
      if (validationError) {
        setActiveWeekday(1)
        setCopyStatus('')
        setCopiedWeekdays([])
        setError(`${validationError} Fix Monday first, then copy it to the other weekdays.`)
        return
      }
    }

    const weekdaysAlreadyMatch = weeklySchedule
      .filter((day) => day.weekday >= 2 && day.weekday <= 5)
      .every(
        (day) =>
          day.isAvailable === monday.isAvailable &&
          windowsMatch(day.windows, monday.windows),
      )

    setCopiedWeekdays([2, 3, 4, 5])
    setActiveWeekday(null)

    if (weekdaysAlreadyMatch) {
      setCopyStatus('Tuesday through Friday already match Monday.')
      setNotice('No changes were needed. Tuesday through Friday already use Monday’s schedule.')
      return
    }

    setWeeklySchedule((current) =>
      current.map((day) =>
        day.weekday >= 2 && day.weekday <= 5
          ? {
              ...day,
              isAvailable: monday.isAvailable,
              windows: monday.windows.map((window) => ({ ...window })),
            }
          : day,
      ),
    )
    setCopyStatus('Copied. Review Tuesday through Friday, then save your usual week.')
    setNotice('Monday’s schedule was copied to Tuesday through Friday. The change is not live until you choose “Save my usual week.”')
  }

  async function handleSaveWeekly(event) {
    event.preventDefault()
    setNotice('')
    setError('')

    for (const day of weeklySchedule) {
      if (!day.isAvailable) continue
      const dayLabel = WEEKDAYS.find((item) => item.value === day.weekday)?.label || 'This day'
      const validationError = validateTimeWindows(day.windows, dayLabel)
      if (validationError) {
        setActiveWeekday(day.weekday)
        setError(`${validationError} Please adjust the times and try again.`)
        return
      }
    }

    if (availableDayCount === 0) {
      setError('Choose at least one day for appointments before saving your usual week.')
      return
    }

    setIsSavingWeekly(true)

    try {
      const response = await updateAdminFounderWeeklyAvailability({
        timezone: settings.timezone,
        slotIntervalMinutes: Number(settings.slotIntervalMinutes),
        minimumNoticeMinutes: Number(settings.minimumNoticeMinutes),
        bookingWindowDays: Number(settings.bookingWindowDays),
        weeklySchedule: weeklySchedule.map((day) => ({
          weekday: day.weekday,
          windows: day.isAvailable ? day.windows : [],
        })),
      })
      setWorkspace(response)
      setSettings((current) => ({ ...current, scheduleEnabled: true }))
      setCopyStatus('')
      setCopiedWeekdays([])
      setNotice('Your usual week is saved. Clients will now see these appointment times on the booking page.')
    } catch (saveError) {
      setError(saveError.message || 'Unable to save weekly availability.')
    } finally {
      setIsSavingWeekly(false)
    }
  }

  async function handleSaveDate(event) {
    event.preventDefault()
    setNotice('')
    setError('')

    if (dateMode === 'custom') {
      const validationError = validateTimeWindows(dateWindows, formatShortDate(selectedDate))
      if (validationError) {
        setError(`${validationError} Please adjust the times and try again.`)
        return
      }
    }

    setIsSavingDate(true)

    try {
      const response = await updateAdminFounderDateAvailability(selectedDate, {
        mode: dateMode,
        windows: dateMode === 'custom' ? dateWindows : [],
        notes: dateNotes,
      })
      setWorkspace(response)
      setNotice(
        dateMode === 'custom'
          ? `${formatShortDate(selectedDate)} will be available only during the hours you chose.`
          : dateMode === 'unavailable'
            ? `${formatShortDate(selectedDate)} is now unavailable all day.`
            : `${formatShortDate(selectedDate)} now follows the regular weekly schedule.`,
      )
    } catch (saveError) {
      setError(saveError.message || 'Unable to save this date override.')
    } finally {
      setIsSavingDate(false)
    }
  }

  function chooseOverrideDate(dateValue) {
    setSelectedDate(dateValue)
    setSearchParams({ date: dateValue })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleLogout() {
    setIsSigningOut(true)
    setError('')

    try {
      await logoutAdmin()
      navigate('/admin/login', { replace: true })
    } catch (logoutError) {
      setError(logoutError.message || 'Unable to sign out right now.')
      setIsSigningOut(false)
    }
  }

  return (
    <main className="founder-hours">
      <FounderDeveloperBanner />
      <header className="founder-hours__header">
        <Link to="/admin/founders-view" className="founder-hours__brand">
          <span aria-hidden="true" />
          <div>
            <strong>Power Within Collective</strong>
            <small>My Availability</small>
          </div>
        </Link>

        <nav className="founder-hours__header-actions" aria-label="Founder navigation">
          <Link to="/admin/founders-view">Founder’s View</Link>
          <Link to="/admin/founders-calendar">Calendar</Link>
          <Link to="/admin/founders-availability" aria-current="page">Availability</Link>
          <Link to="/admin/dashboard">Open The Studio</Link>
          <button type="button" onClick={handleLogout} disabled={isSigningOut}>
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </button>
        </nav>
      </header>

      <div className="founder-hours__shell">
        <Link to="/admin/founders-view" className="founder-hours__back">
          ← Back to Founder’s View
        </Link>

        <section className="founder-hours__intro">
          <div>
            <p>My availability</p>
            <h1>Choose when clients can request time with you.</h1>
            <span>
              Start with your usual week. When one day needs to be different,
              change only that date. You can come back and adjust this anytime.
            </span>
          </div>
          <div className="founder-hours__timezone">
            <small>All times are shown in</small>
            <strong>Eastern Time</strong>
          </div>
        </section>

        <section className="founder-hours__guide" aria-label="How availability works">
          <div>
            <span>1</span>
            <div>
              <strong>Set your usual week</strong>
              <small>Choose the days and hours you normally meet with clients.</small>
            </div>
          </div>
          <div>
            <span>2</span>
            <div>
              <strong>Change one date when life shifts</strong>
              <small>Take a day off or open different hours without changing every week.</small>
            </div>
          </div>
        </section>

        <section className="founder-hours__summary" aria-label="Availability overview">
          <article>
            <span>Appointment days</span>
            <strong>{availableDayCount}</strong>
            <small>Days open in your usual week</small>
          </article>
          <article>
            <span>Weekly time periods</span>
            <strong>{weeklyWindowCount}</strong>
            <small>Separate windows across open days</small>
          </article>
          <article>
            <span>Special dates</span>
            <strong>{upcomingOverrides.length}</strong>
            <small>Upcoming one-day changes</small>
          </article>
          <article className={settings.scheduleEnabled ? 'is-active' : 'is-draft'}>
            <span>Booking schedule</span>
            <strong>{settings.scheduleEnabled ? 'Active' : 'Draft'}</strong>
            <small>{settings.scheduleEnabled ? 'Visible to clients' : 'Save your week to publish'}</small>
          </article>
        </section>

        {(notice || error) && (
          <div
            className={error ? 'founder-hours__feedback is-error' : 'founder-hours__feedback'}
            role={error ? 'alert' : 'status'}
          >
            <strong>{error ? 'Please check one thing' : 'Saved'}</strong>
            <span>{error || notice}</span>
          </div>
        )}

        {!settings.scheduleEnabled && !isLoading && (
          <div className="founder-hours__legacy-note">
            <strong>Your new schedule is not live yet.</strong>
            <span>
              Set your usual week below, then choose “Save my usual week.” Your
              current booking hours will stay unchanged until you save.
            </span>
          </div>
        )}

        {settings.scheduleEnabled && !isLoading && (
          <div className="founder-hours__active-note">
            <span aria-hidden="true" />
            <div>
              <strong>Your appointment hours are active.</strong>
              <small>
                Clients can request time on {availableDayCount} {availableDayCount === 1 ? 'day' : 'days'} of your usual week.
              </small>
            </div>
          </div>
        )}

        <div className="founder-hours__layout">
          <form
            className="founder-hours__card founder-hours__weekly"
            onSubmit={handleSaveWeekly}
          >
            <div className="founder-hours__card-heading">
              <div>
                <p>Step 1</p>
                <h2>Your usual week</h2>
                <span>Turn a day on when you want clients to be able to request an appointment.</span>
              </div>
              <div className="founder-hours__copy-action">
                <button type="button" onClick={copyMondayToWeekdays}>
                  Copy Monday to Tuesday–Friday
                </button>
                <small>Copies Monday’s day-off setting and appointment times.</small>
                {copyStatus && (
                  <span className="founder-hours__copy-status" role="status">
                    ✓ {copyStatus}
                  </span>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="founder-hours__loading">
                <span aria-hidden="true" />
                <strong>Loading your hours…</strong>
              </div>
            ) : (
              <div className="founder-hours__days">
                {weeklySchedule.map((day) => {
                  const dayLabel = WEEKDAYS.find((item) => item.value === day.weekday)
                  const isEditing = day.isAvailable && activeWeekday === day.weekday

                  return (
                    <section
                      className={[
                        'founder-hours__day',
                        day.isAvailable ? 'is-open' : '',
                        copiedWeekdays.includes(day.weekday) ? 'is-copied' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      key={day.weekday}
                    >
                      <div className="founder-hours__day-summary">
                        <div className="founder-hours__day-name">
                          <span
                            className={day.isAvailable ? 'founder-hours__day-dot is-open' : 'founder-hours__day-dot'}
                            aria-hidden="true"
                          />
                          <div>
                            <strong>{dayLabel?.label}</strong>
                            <small>{day.isAvailable ? getWindowsSummary(day.windows) : 'Day off — no appointments'}</small>
                            {copiedWeekdays.includes(day.weekday) && (
                              <em>Copied from Monday</em>
                            )}
                          </div>
                        </div>

                        <div className="founder-hours__day-actions">
                          <button
                            type="button"
                            className={day.isAvailable ? 'founder-hours__day-toggle is-on' : 'founder-hours__day-toggle'}
                            aria-pressed={day.isAvailable}
                            aria-label={`${dayLabel?.label}: ${day.isAvailable ? 'taking appointments' : 'day off'}`}
                            onClick={() => {
                              const nextIsAvailable = !day.isAvailable
                              updateDay(day.weekday, (current) => ({
                                ...current,
                                isAvailable: nextIsAvailable,
                              }))
                              if (nextIsAvailable) setActiveWeekday(day.weekday)
                            }}
                          >
                            {day.isAvailable ? 'Taking appointments' : 'Day off'}
                          </button>

                          {day.isAvailable && (
                            <button
                              type="button"
                              className="founder-hours__edit-day"
                              onClick={() => setActiveWeekday(isEditing ? null : day.weekday)}
                              aria-expanded={isEditing}
                            >
                              {isEditing ? 'Done' : 'Change times'}
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing && (
                        <div className="founder-hours__day-editor">
                          <div className="founder-hours__editor-intro">
                            <strong>What times work for you on {dayLabel?.label}?</strong>
                            <span>Choose a quick option or enter the exact times you prefer.</span>
                          </div>
                          <WindowEditor
                            windows={day.windows}
                            compact
                            onChange={(windows) =>
                              updateDay(day.weekday, (current) => ({
                                ...current,
                                windows,
                              }))
                            }
                          />
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            )}

            <details className="founder-hours__advanced">
              <summary>
                <div>
                  <strong>Booking preferences</strong>
                  <small>Optional settings — the recommended choices are already selected.</small>
                </div>
                <span aria-hidden="true">+</span>
              </summary>

              <div className="founder-hours__rules">
                <label>
                  <span>How often should start times appear?</span>
                  <select
                    value={settings.slotIntervalMinutes}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        slotIntervalMinutes: Number(event.target.value),
                      }))
                    }
                  >
                    <option value={15}>Every 15 minutes</option>
                    <option value={30}>Every 30 minutes</option>
                    <option value={60}>Every hour</option>
                  </select>
                  <small>Example: 9:00, 9:30, 10:00.</small>
                </label>

                <label>
                  <span>How much notice do you need?</span>
                  <select
                    value={settings.minimumNoticeMinutes}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        minimumNoticeMinutes: Number(event.target.value),
                      }))
                    }
                  >
                    <option value={0}>Same-day requests are okay</option>
                    <option value={120}>At least 2 hours</option>
                    <option value={720}>At least 12 hours</option>
                    <option value={1440}>At least 1 day</option>
                    <option value={2880}>At least 2 days</option>
                  </select>
                  <small>Requests inside this notice period will not be shown.</small>
                </label>

                <label>
                  <span>How far ahead may clients request time?</span>
                  <select
                    value={settings.bookingWindowDays}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        bookingWindowDays: Number(event.target.value),
                      }))
                    }
                  >
                    <option value={30}>Up to 1 month ahead</option>
                    <option value={60}>Up to 2 months ahead</option>
                    <option value={90}>Up to 3 months ahead</option>
                    <option value={120}>Up to 4 months ahead</option>
                    <option value={180}>Up to 6 months ahead</option>
                  </select>
                  <small>Three months is a comfortable default.</small>
                </label>
              </div>
            </details>

            <div className="founder-hours__save-area">
              <div>
                <strong>Ready to update your regular hours?</strong>
                <small>Nothing changes for clients until you press save.</small>
              </div>
              <button
                className="founder-hours__save"
                type="submit"
                disabled={isSavingWeekly || isLoading}
              >
                {isSavingWeekly ? 'Saving your week…' : 'Save my usual week'}
              </button>
            </div>
          </form>

          <aside className="founder-hours__side">
            <form
              className="founder-hours__card founder-hours__override"
              onSubmit={handleSaveDate}
            >
              <div className="founder-hours__card-heading">
                <div>
                  <p>Step 2</p>
                  <h2>Change one date</h2>
                  <span>Use this when one day should be different from your usual week.</span>
                </div>
              </div>

              <label className="founder-hours__date-picker">
                <span>Which date do you want to change?</span>
                <input
                  type="date"
                  value={selectedDate}
                  min={getDateKey()}
                  onChange={(event) => chooseOverrideDate(event.target.value)}
                />
                <strong>{formatDate(selectedDate)}</strong>
              </label>

              <fieldset className="founder-hours__modes">
                <legend>What should happen on this day?</legend>
                {[
                  {
                    value: 'regular',
                    number: '1',
                    title: 'Keep my usual hours',
                    text: 'Use the normal hours for this weekday.',
                  },
                  {
                    value: 'unavailable',
                    number: '2',
                    title: 'Take the whole day off',
                    text: 'Do not allow any appointment requests on this date.',
                  },
                  {
                    value: 'custom',
                    number: '3',
                    title: 'Choose different hours',
                    text: 'Open only the times you select for this date.',
                  },
                ].map((mode) => (
                  <label className={dateMode === mode.value ? 'is-selected' : ''} key={mode.value}>
                    <input
                      type="radio"
                      name="date-mode"
                      value={mode.value}
                      checked={dateMode === mode.value}
                      onChange={() => setDateMode(mode.value)}
                    />
                    <span className="founder-hours__mode-number" aria-hidden="true">{mode.number}</span>
                    <div>
                      <strong>{mode.title}</strong>
                      <small>{mode.text}</small>
                    </div>
                    <span className="founder-hours__mode-check" aria-hidden="true">✓</span>
                  </label>
                ))}
              </fieldset>

              {dateMode === 'custom' && (
                <div className="founder-hours__custom-date">
                  <div className="founder-hours__editor-intro">
                    <strong>When are you available on this date?</strong>
                    <span>These times will replace your usual hours for this day only.</span>
                  </div>
                  <WindowEditor windows={dateWindows} onChange={setDateWindows} />
                </div>
              )}

              <div className="founder-hours__day-result">
                <small>After you save</small>
                <strong>
                  {dateMode === 'regular' && `${formatShortDate(selectedDate)} will follow your usual hours.`}
                  {dateMode === 'unavailable' && `${formatShortDate(selectedDate)} will be protected all day.`}
                  {dateMode === 'custom' && `${formatShortDate(selectedDate)} will be open only from ${getWindowsSummary(dateWindows)}.`}
                </strong>
              </div>

              <details className="founder-hours__note-details">
                <summary>Add a private note <span>optional</span></summary>
                <label className="founder-hours__note">
                  <span>This note is only for you and your team.</span>
                  <textarea
                    rows={3}
                    value={dateNotes}
                    onChange={(event) => setDateNotes(event.target.value)}
                    placeholder="Travel, personal appointment, preparation time…"
                  />
                </label>
              </details>

              <button
                className="founder-hours__save founder-hours__save-date"
                type="submit"
                disabled={isSavingDate || isLoading}
              >
                {isSavingDate ? 'Saving this day…' : 'Save this day'}
              </button>
            </form>

            <section className="founder-hours__card founder-hours__upcoming">
              <div className="founder-hours__card-heading">
                <div>
                  <p>Coming up</p>
                  <h2>Your special days</h2>
                  <span>Days that are different from your usual week.</span>
                </div>
                <span className="founder-hours__count">{upcomingOverrides.length}</span>
              </div>

              {upcomingOverrides.length === 0 ? (
                <div className="founder-hours__empty">
                  <strong>No special days are set.</strong>
                  <span>Your usual weekly hours will be used.</span>
                </div>
              ) : (
                <div className="founder-hours__override-list">
                  {upcomingOverrides.map((override) => (
                    <button
                      type="button"
                      key={override.date}
                      onClick={() => chooseOverrideDate(override.date)}
                    >
                      <div>
                        <strong>{formatShortDate(override.date)}</strong>
                        <small>
                          {override.mode === 'unavailable'
                            ? 'Day off — unavailable all day'
                            : override.windows
                                .map(
                                  (window) =>
                                    `${formatTime(window.startTime)}–${formatTime(window.endTime)}`,
                                )
                                .join(', ')}
                        </small>
                      </div>
                      <span>Review</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
