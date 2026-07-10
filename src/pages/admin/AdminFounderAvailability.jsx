import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  getAdminFounderAvailability,
  logoutAdmin,
  updateAdminFounderDateAvailability,
  updateAdminFounderWeeklyAvailability,
} from '../../lib/nativeApi'

import './Admin.css'
import './FounderAvailability.css'

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

  return (
    <div className={compact ? 'founder-hours__windows is-compact' : 'founder-hours__windows'}>
      {windows.map((window, index) => (
        <div className="founder-hours__window" key={`window-${index}`}>
          <label>
            <span>From</span>
            <input
              type="time"
              value={window.startTime}
              onChange={(event) => updateWindow(index, 'startTime', event.target.value)}
            />
          </label>
          <span aria-hidden="true">to</span>
          <label>
            <span>Until</span>
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
            aria-label="Remove this time window"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        className="founder-hours__add-window"
        onClick={() =>
          onChange([...windows, { startTime: '13:00', endTime: '17:00' }])
        }
      >
        + Add another time
      </button>
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
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingWeekly, setIsSavingWeekly] = useState(false)
  const [isSavingDate, setIsSavingDate] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

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
    setWeeklySchedule((current) =>
      current.map((day) => (day.weekday === weekday ? updater(day) : day)),
    )
  }

  function copyMondayToWeekdays() {
    const monday = weeklySchedule.find((day) => day.weekday === 1)
    if (!monday) return

    setWeeklySchedule((current) =>
      current.map((day) =>
        day.weekday >= 1 && day.weekday <= 5
          ? {
              ...day,
              isAvailable: monday.isAvailable,
              windows: monday.windows.map((window) => ({ ...window })),
            }
          : day,
      ),
    )
    setNotice('Monday’s hours were copied to Tuesday through Friday. Save when ready.')
  }

  async function handleSaveWeekly(event) {
    event.preventDefault()
    setIsSavingWeekly(true)
    setNotice('')
    setError('')

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
      setNotice('Weekly availability is live on the booking page.')
    } catch (saveError) {
      setError(saveError.message || 'Unable to save weekly availability.')
    } finally {
      setIsSavingWeekly(false)
    }
  }

  async function handleSaveDate(event) {
    event.preventDefault()
    setIsSavingDate(true)
    setNotice('')
    setError('')

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
      <header className="founder-hours__header">
        <Link to="/admin/founders-view" className="founder-hours__brand">
          <span aria-hidden="true" />
          <div>
            <strong>Power Within Collective</strong>
            <small>Founder Availability</small>
          </div>
        </Link>

        <nav className="founder-hours__header-actions" aria-label="Founder navigation">
          <Link to="/admin/founders-view">Founder’s View</Link>
          <Link to="/admin/founders-calendar">Calendar</Link>
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
            <p>Shape your schedule</p>
            <h1>Availability that works around real life.</h1>
            <span>
              Set regular weekly hours, then make any date more open or more
              protected. Everything is shown in Eastern Time.
            </span>
          </div>
          <div className="founder-hours__timezone">
            <small>Business timezone</small>
            <strong>Eastern Time</strong>
          </div>
        </section>

        {(notice || error) && (
          <div className={error ? 'founder-hours__feedback is-error' : 'founder-hours__feedback'}>
            {error || notice}
          </div>
        )}

        {!settings.scheduleEnabled && !isLoading && (
          <div className="founder-hours__legacy-note">
            <strong>Your current booking hours are still active.</strong>
            <span>
              Adjust the weekly schedule below and save it once to activate your
              personalized availability system.
            </span>
          </div>
        )}

        <div className="founder-hours__layout">
          <form className="founder-hours__card founder-hours__weekly" onSubmit={handleSaveWeekly}>
            <div className="founder-hours__card-heading">
              <div>
                <p>Regular rhythm</p>
                <h2>Weekly availability</h2>
                <span>Use more than one window when you want a break between sessions.</span>
              </div>
              <button type="button" onClick={copyMondayToWeekdays}>
                Copy Monday to weekdays
              </button>
            </div>

            <div className="founder-hours__days" aria-busy={isLoading}>
              {weeklySchedule.map((day) => {
                const dayLabel = WEEKDAYS.find((item) => item.value === day.weekday)
                return (
                  <section className={day.isAvailable ? 'founder-hours__day is-open' : 'founder-hours__day'} key={day.weekday}>
                    <div className="founder-hours__day-name">
                      <label className="founder-hours__switch">
                        <input
                          type="checkbox"
                          checked={day.isAvailable}
                          onChange={(event) =>
                            updateDay(day.weekday, (current) => ({
                              ...current,
                              isAvailable: event.target.checked,
                            }))
                          }
                        />
                        <span aria-hidden="true" />
                      </label>
                      <div>
                        <strong>{dayLabel?.label}</strong>
                        <small>{day.isAvailable ? 'Available' : 'Unavailable'}</small>
                      </div>
                    </div>

                    {day.isAvailable ? (
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
                    ) : (
                      <p className="founder-hours__day-off">No appointments can be requested.</p>
                    )}
                  </section>
                )
              })}
            </div>

            <div className="founder-hours__rules">
              <label>
                <span>Offer start times every</span>
                <select
                  value={settings.slotIntervalMinutes}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      slotIntervalMinutes: Number(event.target.value),
                    }))
                  }
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </label>

              <label>
                <span>Minimum notice</span>
                <select
                  value={settings.minimumNoticeMinutes}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      minimumNoticeMinutes: Number(event.target.value),
                    }))
                  }
                >
                  <option value={0}>No minimum</option>
                  <option value={120}>2 hours</option>
                  <option value={720}>12 hours</option>
                  <option value={1440}>24 hours</option>
                  <option value={2880}>48 hours</option>
                </select>
              </label>

              <label>
                <span>How far ahead</span>
                <select
                  value={settings.bookingWindowDays}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      bookingWindowDays: Number(event.target.value),
                    }))
                  }
                >
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={120}>120 days</option>
                  <option value={180}>180 days</option>
                </select>
              </label>
            </div>

            <button className="founder-hours__save" type="submit" disabled={isSavingWeekly || isLoading}>
              {isSavingWeekly ? 'Saving weekly hours...' : 'Save weekly availability'}
            </button>
          </form>

          <aside className="founder-hours__side">
            <form className="founder-hours__card founder-hours__override" onSubmit={handleSaveDate}>
              <div className="founder-hours__card-heading">
                <div>
                  <p>One day can be different</p>
                  <h2>Date override</h2>
                  <span>Custom hours replace the regular schedule for this date.</span>
                </div>
              </div>

              <label className="founder-hours__date-picker">
                <span>Choose a date</span>
                <input
                  type="date"
                  value={selectedDate}
                  min={getDateKey()}
                  onChange={(event) => chooseOverrideDate(event.target.value)}
                />
                <strong>{formatDate(selectedDate)}</strong>
              </label>

              <div className="founder-hours__modes">
                {[
                  {
                    value: 'regular',
                    title: 'Use weekly hours',
                    text: 'Follow the normal schedule for this weekday.',
                  },
                  {
                    value: 'unavailable',
                    title: 'Unavailable all day',
                    text: 'Protect the entire date from booking requests.',
                  },
                  {
                    value: 'custom',
                    title: 'Custom available hours',
                    text: 'Open only the times you choose on this date.',
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
                    <span aria-hidden="true" />
                    <div>
                      <strong>{mode.title}</strong>
                      <small>{mode.text}</small>
                    </div>
                  </label>
                ))}
              </div>

              {dateMode === 'custom' && (
                <WindowEditor windows={dateWindows} onChange={setDateWindows} />
              )}

              <label className="founder-hours__note">
                <span>Private note <small>optional</small></span>
                <textarea
                  rows={3}
                  value={dateNotes}
                  onChange={(event) => setDateNotes(event.target.value)}
                  placeholder="Travel, personal appointment, preparation time..."
                />
              </label>

              <button className="founder-hours__save" type="submit" disabled={isSavingDate || isLoading}>
                {isSavingDate ? 'Saving this date...' : 'Save date override'}
              </button>
            </form>

            <section className="founder-hours__card founder-hours__upcoming">
              <div className="founder-hours__card-heading">
                <div>
                  <p>Coming up</p>
                  <h2>Date overrides</h2>
                  <span>Dates that do not follow the normal weekly rhythm.</span>
                </div>
                <span className="founder-hours__count">{upcomingOverrides.length}</span>
              </div>

              {upcomingOverrides.length === 0 ? (
                <div className="founder-hours__empty">
                  <strong>No date overrides yet.</strong>
                  <span>Your weekly availability will be used.</span>
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
                            ? 'Unavailable all day'
                            : override.windows
                                .map(
                                  (window) =>
                                    `${formatTime(window.startTime)}–${formatTime(window.endTime)}`,
                                )
                                .join(', ')}
                        </small>
                      </div>
                      <span>Edit</span>
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
