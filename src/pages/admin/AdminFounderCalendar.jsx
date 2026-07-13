import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FounderDeveloperBanner from '../../components/admin/FounderDeveloperBanner'
import {
  getAdminFounderCalendar,
  logoutAdmin,
  updateAdminFounderDateAvailability,
} from '../../lib/nativeApi'

import './Admin.css'
import './FounderCalendar.css'

const FOUNDER_TIME_ZONE = 'America/New_York'
const FOUNDER_TIME_ZONE_LABEL = 'Eastern Time'
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getTimeZoneParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FOUNDER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))

  return Object.fromEntries(
    parts
      .filter((part) =>
        ['year', 'month', 'day', 'hour', 'minute', 'second'].includes(part.type),
      )
      .map((part) => [part.type, part.value]),
  )
}

function getDateKey(value = new Date()) {
  const parts = getTimeZoneParts(value)
  return `${parts.year}-${parts.month}-${parts.day}`
}

function getCurrentMonth() {
  return getDateKey().slice(0, 7)
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

function offsetMonth(monthValue, amount) {
  const [year, month] = monthValue.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + amount, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function formatMonthTitle(monthValue) {
  const [year, month] = monthValue.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function formatSelectedDate(dateKey) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseDateKey(dateKey))
}

function formatTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: FOUNDER_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatClockTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(`2026-01-01T${String(value).slice(0, 5)}:00Z`))
}

function getClientName(item) {
  return (
    [item?.first_name, item?.last_name].filter(Boolean).join(' ') ||
    item?.guest_name ||
    item?.client_email ||
    item?.guest_email ||
    'Client'
  )
}

function getInitials(name) {
  return (
    String(name || 'Client')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'PW'
  )
}

function getCalendarDays(monthValue) {
  const [year, month] = monthValue.split('-').map(Number)
  const firstDay = new Date(Date.UTC(year, month - 1, 1))
  const lastDay = new Date(Date.UTC(year, month, 0))
  const leadingCount = firstDay.getUTCDay()
  const days = []

  for (let index = 0; index < leadingCount; index += 1) {
    days.push(null)
  }

  for (let day = 1; day <= lastDay.getUTCDate(); day += 1) {
    days.push(`${monthValue}-${String(day).padStart(2, '0')}`)
  }

  while (days.length % 7 !== 0) {
    days.push(null)
  }

  return days
}

function getBlockDateKeys(block) {
  if (!block?.starts_at || !block?.ends_at) return []

  const startKey = getDateKey(block.starts_at)
  const endKey = getDateKey(block.ends_at)
  const current = parseDateKey(startKey)
  const end = parseDateKey(endKey)
  const keys = []

  while (current <= end) {
    keys.push(formatDateKey(current))
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return keys
}

export default function AdminFounderCalendar() {
  const navigate = useNavigate()
  const [month, setMonth] = useState(getCurrentMonth())
  const [selectedDate, setSelectedDate] = useState(getDateKey())
  const [calendar, setCalendar] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const bookings = useMemo(() => calendar?.bookings || [], [calendar?.bookings])
  const availabilityExceptions = useMemo(
    () => calendar?.availabilityExceptions || [],
    [calendar?.availabilityExceptions],
  )
  const availabilityBlocks = useMemo(
    () => calendar?.availabilityBlocks || [],
    [calendar?.availabilityBlocks],
  )
  const calendarDays = useMemo(() => getCalendarDays(month), [month])

  const bookingsByDate = useMemo(() => {
    const grouped = new Map()

    bookings.forEach((booking) => {
      const dateKey = getDateKey(booking.starts_at)
      const entries = grouped.get(dateKey) || []
      entries.push(booking)
      grouped.set(dateKey, entries)
    })

    return grouped
  }, [bookings])

  const blocksByDate = useMemo(() => {
    const grouped = new Map()

    availabilityExceptions.forEach((block) => {
      getBlockDateKeys(block).forEach((dateKey) => {
        const entries = grouped.get(dateKey) || []
        entries.push(block)
        grouped.set(dateKey, entries)
      })
    })

    return grouped
  }, [availabilityExceptions])

  const customHoursByDate = useMemo(() => {
    const grouped = new Map()

    availabilityBlocks
      .filter((block) => block.specific_date)
      .forEach((block) => {
        const dateKey = String(block.specific_date).slice(0, 10)
        const entries = grouped.get(dateKey) || []
        entries.push(block)
        grouped.set(dateKey, entries)
      })

    return grouped
  }, [availabilityBlocks])

  const selectedBookings = bookingsByDate.get(selectedDate) || []
  const selectedBlocks = blocksByDate.get(selectedDate) || []
  const selectedCustomHours = customHoursByDate.get(selectedDate) || []
  const todayKey = getDateKey()

  const loadCalendar = useCallback(async (monthValue) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await getAdminFounderCalendar(monthValue)
      setCalendar(response)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load the Founder Calendar.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    document.body.classList.add('admin-app-mode')
    document.body.classList.add('founder-calendar-mode')

    return () => {
      document.body.classList.remove('founder-calendar-mode')
      document.body.classList.remove('admin-app-mode')
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCalendar(month)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadCalendar, month])

  function changeMonth(amount) {
    const nextMonth = offsetMonth(month, amount)
    setMonth(nextMonth)
    setSelectedDate(`${nextMonth}-01`)
    setNotice('')
  }

  function goToToday() {
    const today = getDateKey()
    setMonth(today.slice(0, 7))
    setSelectedDate(today)
    setNotice('')
  }

  async function handleProtectDate() {
    setIsUpdating(true)
    setNotice('')
    setError('')

    try {
      await updateAdminFounderDateAvailability(selectedDate, {
        mode: 'unavailable',
        windows: [],
        notes: 'Protected from Founder Calendar.',
      })
      await loadCalendar(month)
      setNotice(`${formatSelectedDate(selectedDate)} is now protected.`)
    } catch (updateError) {
      setError(updateError.message || 'Unable to protect this date.')
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleReopenDate() {
    if (!selectedBlocks[0]?.id) return

    setIsUpdating(true)
    setNotice('')
    setError('')

    try {
      await updateAdminFounderDateAvailability(selectedDate, {
        mode: 'regular',
        windows: [],
        notes: '',
      })
      await loadCalendar(month)
      setNotice(`${formatSelectedDate(selectedDate)} is available again.`)
    } catch (updateError) {
      setError(updateError.message || 'Unable to reopen this date.')
    } finally {
      setIsUpdating(false)
    }
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
    <main className="founder-calendar">
      <FounderDeveloperBanner />
      <header className="founder-calendar__header">
        <Link to="/admin/founders-view" className="founder-calendar__brand">
          <span aria-hidden="true" />
          <div>
            <strong>Power Within Collective</strong>
            <small>Founder Calendar</small>
          </div>
        </Link>

        <nav className="founder-calendar__header-actions" aria-label="Founder navigation">
          <Link to="/admin/founders-view">Founder’s View</Link>
          <Link to="/admin/founders-availability">Availability</Link>
          <Link to="/admin/dashboard">Open The Studio</Link>
          <button type="button" onClick={handleLogout} disabled={isSigningOut}>
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </nav>
      </header>

      <div className="founder-calendar__shell">
        <Link
          to="/admin/founders-view"
          className="founder-calendar__back-link"
          aria-label="Back to Founder’s View"
        >
          <span aria-hidden="true">←</span>
          Back to Founder’s View
        </Link>

        <section className="founder-calendar__intro">
          <div>
            <p>Personal calendar</p>
            <h1>Your time, clearly held.</h1>
            <span>Sessions and protected dates shown in {FOUNDER_TIME_ZONE_LABEL}.</span>
          </div>
          <button type="button" className="founder-calendar__today" onClick={goToToday}>
            Today
          </button>
        </section>

        <div className="founder-calendar__feedback" aria-live="polite">
          {notice && <div className="admin-notice is-success">{notice}</div>}
          {error && <div className="admin-notice is-error">{error}</div>}
        </div>

        <section className="founder-calendar__workspace">
          <div className="founder-calendar__month-card">
            <div className="founder-calendar__month-toolbar">
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">
                ‹
              </button>
              <h2>{formatMonthTitle(month)}</h2>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">
                ›
              </button>
            </div>

            <div className="founder-calendar__weekdays" aria-hidden="true">
              {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
            </div>

            <div className="founder-calendar__grid" aria-label={formatMonthTitle(month)}>
              {calendarDays.map((dateKey, index) => {
                if (!dateKey) {
                  return <span className="founder-calendar__day is-empty" key={`empty-${index}`} />
                }

                const dayBookings = bookingsByDate.get(dateKey) || []
                const dayBlocks = blocksByDate.get(dateKey) || []
                const dayCustomHours = customHoursByDate.get(dateKey) || []
                const dayNumber = Number(dateKey.slice(-2))

                return (
                  <button
                    type="button"
                    className={[
                      'founder-calendar__day',
                      dateKey === selectedDate ? 'is-selected' : '',
                      dateKey === todayKey ? 'is-today' : '',
                      dayBlocks.length > 0 ? 'is-protected' : '',
                      dayCustomHours.length > 0 ? 'is-custom' : '',
                    ].filter(Boolean).join(' ')}
                    key={dateKey}
                    onClick={() => setSelectedDate(dateKey)}
                    aria-pressed={dateKey === selectedDate}
                    aria-label={`${formatSelectedDate(dateKey)}, ${dayBookings.length} sessions${dayBlocks.length ? ', protected' : ''}${dayCustomHours.length ? ', custom hours' : ''}`}
                  >
                    <span className="founder-calendar__day-number">{dayNumber}</span>
                    <span className="founder-calendar__day-events">
                      {dayCustomHours.length > 0 && <em>Custom hours</em>}
                      {dayBlocks.length > 0 && dayCustomHours.length === 0 && <em>Protected</em>}
                      {dayBookings.slice(0, 2).map((booking) => (
                        <small key={booking.id}>
                          {formatTime(booking.starts_at)} · {getClientName(booking)}
                        </small>
                      ))}
                      {dayBookings.length > 2 && <small>+{dayBookings.length - 2} more</small>}
                    </span>
                  </button>
                )
              })}
            </div>

            {isLoading && <div className="founder-calendar__loading">Gathering this month…</div>}
          </div>

          <aside className="founder-calendar__day-panel">
            <p>Selected day</p>
            <h2>{formatSelectedDate(selectedDate)}</h2>

            <div className="founder-calendar__day-status">
              <span
                className={
                  selectedCustomHours.length
                    ? 'is-custom'
                    : selectedBlocks.length
                      ? 'is-protected'
                      : 'is-open'
                }
              />
              <strong>
                {selectedCustomHours.length
                  ? 'Custom available hours'
                  : selectedBlocks.length
                    ? 'Protected time'
                    : 'Regular availability'}
              </strong>
            </div>

            {selectedCustomHours.length > 0 && (
              <div className="founder-calendar__custom-hours-list">
                {selectedCustomHours.map((window) => (
                  <span key={window.id}>
                    {formatClockTime(window.start_time)}–{formatClockTime(window.end_time)}
                  </span>
                ))}
              </div>
            )}

            <div className="founder-calendar__session-list">
              {selectedBookings.length === 0 ? (
                <div className="founder-calendar__empty-state">
                  <strong>No sessions scheduled.</strong>
                  <span>This day has room to breathe.</span>
                </div>
              ) : (
                selectedBookings.map((booking) => {
                  const clientName = getClientName(booking)
                  return (
                    <article key={booking.id}>
                      <div className="founder-calendar__avatar" aria-hidden="true">
                        {getInitials(clientName)}
                      </div>
                      <div>
                        <strong>{clientName}</strong>
                        <span>{formatTime(booking.starts_at)} · {booking.status || 'Scheduled'}</span>
                      </div>
                    </article>
                  )
                })
              )}
            </div>

            <Link
              to={`/admin/founders-availability?date=${selectedDate}`}
              className="founder-calendar__customize"
            >
              Customize hours for this date
            </Link>

            {selectedBlocks.length > 0 ? (
              <button
                type="button"
                className="founder-calendar__reopen"
                onClick={handleReopenDate}
                disabled={isUpdating}
              >
                {isUpdating ? 'Reopening…' : 'Reopen this date'}
              </button>
            ) : (
              <button
                type="button"
                className="founder-calendar__protect"
                onClick={handleProtectDate}
                disabled={isUpdating}
              >
                {isUpdating ? 'Protecting…' : 'Protect this date'}
              </button>
            )}
          </aside>
        </section>
      </div>
    </main>
  )
}
