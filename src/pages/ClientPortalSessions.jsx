import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  createClientPortalBooking,
  createClientPortalBookingChangeRequest,
  getClientPortalDashboard,
  getPublicAppointmentTypes,
  getPublicAvailabilitySlots,
  logoutClientPortal,
} from '../lib/nativeApi'

import './ClientPortal.css'
import './ClientPortalSessions.css'

const businessTimeZone = 'America/New_York'

const portalSections = [
  ['/client-portal/home', 'Home'],
  ['/client-portal/journey', 'Journey'],
  ['/client-portal/resources', 'Resources'],
  ['/client-portal/learning', 'Learning'],
  ['/client-portal/membership', 'Membership'],
  ['/client-portal/circle', 'The Circle'],
  ['/client-portal/sessions', 'Sessions'],
  ['/client-portal/messages', 'Messages'],
  ['/client-portal/profile', 'Profile'],
]

function dateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: businessTimeZone,
  }).format(value)
}

function addDays(key, count) {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}

function formatDate(value) {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeZone: businessTimeZone,
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: businessTimeZone,
  }).format(new Date(value))
}

function formatTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: businessTimeZone,
  }).format(new Date(value))
}

function readable(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getFriendlyError(error) {
  const message = String(error?.message || error || '')
  if (message.toLowerCase().includes('login required')) return 'Your private session ended. Please sign in again.'
  return message || 'Something went wrong. Please try again.'
}

export default function ClientPortalSessions() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [appointmentTypes, setAppointmentTypes] = useState([])
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [availability, setAvailability] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [bookingNote, setBookingNote] = useState('')
  const [changeTarget, setChangeTarget] = useState(null)
  const [changeType, setChangeType] = useState('reschedule')
  const [changeReason, setChangeReason] = useState('')
  const [changeDate, setChangeDate] = useState('')
  const [changeSlot, setChangeSlot] = useState(null)
  const [changeAvailability, setChangeAvailability] = useState([])
  const [status, setStatus] = useState({ loading: true, saving: false, error: '', message: '' })
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function loadDashboard() {
    const response = await getClientPortalDashboard()
    setDashboard(response)
    return response
  }

  useEffect(() => {
    document.body.classList.add('client-portal-mode')
    return () => document.body.classList.remove('client-portal-mode')
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const [dashboardResponse, typesResponse] = await Promise.all([
          getClientPortalDashboard(),
          getPublicAppointmentTypes(),
        ])
        if (!mounted) return
        const types = typesResponse.appointmentTypes || []
        setDashboard(dashboardResponse)
        setAppointmentTypes(types)
        setSelectedTypeId(types[0]?.id || '')
        setStatus({ loading: false, saving: false, error: '', message: '' })
      } catch (error) {
        if (!mounted) return
        setStatus({ loading: false, saving: false, error: getFriendlyError(error), message: '' })
        if (String(error?.message || '').toLowerCase().includes('login required')) {
          navigate('/client-portal/login', { replace: true })
        }
      }
    }

    load()
    return () => { mounted = false }
  }, [navigate])

  useEffect(() => {
    if (!selectedTypeId) return
    let mounted = true

    async function loadAvailability() {
      try {
        const start = dateKey()
        const response = await getPublicAvailabilitySlots(selectedTypeId, start, addDays(start, 60))
        if (!mounted) return
        const days = (response.days || []).filter((day) => day.isAvailable)
        setAvailability(days)
        setSelectedDate((current) => current && days.some((day) => day.date === current) ? current : days[0]?.date || '')
        setSelectedSlot(null)
      } catch (error) {
        if (mounted) setStatus((current) => ({ ...current, error: getFriendlyError(error) }))
      }
    }

    loadAvailability()
    return () => { mounted = false }
  }, [selectedTypeId])

  const bookings = useMemo(() => dashboard?.bookings || [], [dashboard])
  const changeRequests = useMemo(
    () => dashboard?.bookingChangeRequests || [],
    [dashboard],
  )
  const client = dashboard?.client
  const now = Date.now()

  const upcomingBookings = useMemo(
    () => bookings
      .filter((booking) => {
        const startsAt = new Date(booking.starts_at).getTime()
        return startsAt >= now && !['cancelled', 'completed', 'no_show'].includes(booking.status)
      })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)),
    [bookings, now],
  )

  const historyBookings = useMemo(
    () => bookings
      .filter((booking) => {
        const startsAt = new Date(booking.starts_at).getTime()
        return startsAt < now || ['cancelled', 'completed', 'no_show'].includes(booking.status)
      })
      .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at)),
    [bookings, now],
  )

  const selectedDay = availability.find((day) => day.date === selectedDate)
  const changeDay = changeAvailability.find((day) => day.date === changeDate)

  function pendingRequestForBooking(bookingId) {
    return changeRequests.find((request) => request.booking_id === bookingId && request.status === 'pending')
  }

  async function handleLogout() {
    try {
      setIsLoggingOut(true)
      await logoutClientPortal()
    } finally {
      navigate('/client-portal/login', { replace: true })
    }
  }

  async function handleBook(event) {
    event.preventDefault()
    if (!selectedSlot) {
      setStatus((current) => ({ ...current, error: 'Choose an available time first.', message: '' }))
      return
    }

    try {
      setStatus({ loading: false, saving: true, error: '', message: '' })
      const response = await createClientPortalBooking({
        appointmentTypeId: selectedTypeId,
        startsAt: selectedSlot.startsAt,
        timezone: businessTimeZone,
        intakeAnswers: bookingNote ? { clientNote: bookingNote } : {},
      })
      await loadDashboard()
      setSelectedSlot(null)
      setBookingNote('')
      setStatus({ loading: false, saving: false, error: '', message: response.message })
    } catch (error) {
      setStatus({ loading: false, saving: false, error: getFriendlyError(error), message: '' })
    }
  }

  async function openChange(booking, type) {
    setChangeTarget(booking)
    setChangeType(type)
    setChangeReason('')
    setChangeDate('')
    setChangeSlot(null)
    setChangeAvailability([])
    setStatus((current) => ({ ...current, error: '', message: '' }))

    if (type === 'reschedule') {
      try {
        const start = dateKey()
        const response = await getPublicAvailabilitySlots(
          booking.appointment_type_id,
          start,
          addDays(start, 60),
        )
        const days = (response.days || []).filter((day) => day.isAvailable)
        setChangeAvailability(days)
        setChangeDate(days[0]?.date || '')
      } catch (error) {
        setStatus((current) => ({ ...current, error: getFriendlyError(error) }))
      }
    }
  }

  async function submitChange(event) {
    event.preventDefault()

    if (!changeTarget || !changeReason.trim()) {
      setStatus((current) => ({ ...current, error: 'Please share a short reason.', message: '' }))
      return
    }

    if (changeType === 'reschedule' && !changeSlot) {
      setStatus((current) => ({ ...current, error: 'Choose a replacement time.', message: '' }))
      return
    }

    try {
      setStatus({ loading: false, saving: true, error: '', message: '' })
      const response = await createClientPortalBookingChangeRequest(changeTarget.id, {
        requestType: changeType,
        startsAt: changeType === 'reschedule' ? changeSlot.startsAt : null,
        reason: changeReason,
      })
      await loadDashboard()
      setChangeTarget(null)
      setStatus({ loading: false, saving: false, error: '', message: response.message })
    } catch (error) {
      setStatus({ loading: false, saving: false, error: getFriendlyError(error), message: '' })
    }
  }

  return (
    <main className="client-portal-app-page-v3 client-session-page">
      <section className="client-portal-app-shell-v3">
        <header className="client-portal-app-header-v3">
          <div className="client-portal-app-brand-v3"><span>Power Within</span><strong>Client Portal</strong></div>
          <div className="client-portal-app-user-v3">
            <div><span>Signed in as</span><strong>{client?.name || client?.email || 'Client'}</strong></div>
            <Link to="/">Website</Link>
            <button type="button" onClick={handleLogout} disabled={isLoggingOut}>{isLoggingOut ? 'Signing out…' : 'Sign Out'}</button>
          </div>
        </header>

        <nav className="client-portal-navigation-v3" aria-label="Client portal">
          {portalSections.map(([path, label]) => (
            <NavLink key={path} to={path} className={({ isActive }) => isActive ? 'is-active' : ''}>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <section className="client-portal-section-heading-v3">
          <p className="eyebrow">Sessions</p>
          <h1>Book and manage your time with Kim.</h1>
          <p>Choose an available session, review what is coming up, or request a thoughtful change.</p>
        </section>

        {(status.error || status.message) && (
          <div className={`client-session-notice${status.error ? ' is-error' : ''}`} role="status">
            {status.error || status.message}
          </div>
        )}

        {status.loading ? (
          <div className="client-portal-dashboard-message-v1">Preparing your sessions…</div>
        ) : (
          <div className="client-session-layout">
            <section className="client-session-booking-card">
              <div className="client-session-card-heading">
                <div><p className="eyebrow">Book Time</p><h2>Request a new session</h2></div>
                <span>Eastern Time</span>
              </div>

              <form onSubmit={handleBook}>
                <label>
                  <span>What would you like to book?</span>
                  <select value={selectedTypeId} onChange={(event) => setSelectedTypeId(event.target.value)}>
                    {appointmentTypes.map((type) => (
                      <option key={type.id} value={type.id}>{type.name} · {type.duration_minutes} min</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Choose a day</span>
                  <select value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setSelectedSlot(null) }}>
                    {availability.length === 0 && <option value="">No open dates currently</option>}
                    {availability.map((day) => <option key={day.date} value={day.date}>{formatDate(day.date)}</option>)}
                  </select>
                </label>

                <fieldset className="client-session-slots">
                  <legend>Available times</legend>
                  {selectedDay?.slots?.length ? selectedDay.slots.map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      className={selectedSlot?.startsAt === slot.startsAt ? 'is-selected' : ''}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {formatTime(slot.startsAt)}
                    </button>
                  )) : <p>No times are open for this day.</p>}
                </fieldset>

                <label>
                  <span>Anything Kim should know? <em>Optional</em></span>
                  <textarea rows="3" value={bookingNote} onChange={(event) => setBookingNote(event.target.value)} placeholder="Share a short note about what you would like support with." />
                </label>

                <button className="client-session-primary" type="submit" disabled={status.saving || !selectedSlot}>
                  {status.saving ? 'Sending…' : 'Request This Session'}
                </button>
              </form>
            </section>

            <section className="client-session-upcoming">
              <div className="client-session-card-heading"><div><p className="eyebrow">Coming Up</p><h2>Your sessions</h2></div></div>
              {upcomingBookings.length === 0 ? (
                <div className="client-session-empty"><strong>No upcoming sessions yet.</strong><p>Choose an available time when you are ready.</p></div>
              ) : upcomingBookings.map((booking) => {
                const pending = pendingRequestForBooking(booking.id)
                return (
                  <article className="client-session-item" key={booking.id}>
                    <div className="client-session-item__top">
                      <div><span>{readable(booking.status)}</span><h3>{booking.appointment_type_name || 'Private Session'}</h3><p>{formatDateTime(booking.starts_at)} Eastern Time</p></div>
                    </div>
                    {pending ? (
                      <div className="client-session-pending">
                        <strong>{pending.request_type === 'cancel' ? 'Cancellation requested' : 'New time requested'}</strong>
                        <p>{pending.request_type === 'reschedule' ? formatDateTime(pending.requested_starts_at) : 'Power Within will review this request.'}</p>
                      </div>
                    ) : (
                      <div className="client-session-item__actions">
                        <button type="button" onClick={() => openChange(booking, 'reschedule')}>Request New Time</button>
                        <button type="button" className="is-quiet" onClick={() => openChange(booking, 'cancel')}>Cancel Session</button>
                      </div>
                    )}
                  </article>
                )
              })}
            </section>

            <section className="client-session-history">
              <div className="client-session-card-heading"><div><p className="eyebrow">History</p><h2>Previous sessions</h2></div></div>
              {historyBookings.length === 0 ? <div className="client-session-empty"><p>Your session history will appear here.</p></div> : historyBookings.map((booking) => (
                <article key={booking.id}><div><h3>{booking.appointment_type_name || 'Private Session'}</h3><p>{formatDateTime(booking.starts_at)}</p></div><span>{readable(booking.status)}</span></article>
              ))}
            </section>
          </div>
        )}

        {changeTarget && (
          <div className="client-session-modal-backdrop" role="presentation">
            <section className="client-session-modal" role="dialog" aria-modal="true" aria-labelledby="session-change-title">
              <button className="client-session-modal__close" type="button" onClick={() => setChangeTarget(null)} aria-label="Close">×</button>
              <p className="eyebrow">Session Change</p>
              <h2 id="session-change-title">{changeType === 'cancel' ? 'Cancel this session?' : 'Choose a different time'}</h2>
              <p className="client-session-modal__current">Current: {formatDateTime(changeTarget.starts_at)}</p>

              <form onSubmit={submitChange}>
                {changeType === 'reschedule' && (
                  <>
                    <label><span>Choose a new day</span><select value={changeDate} onChange={(event) => { setChangeDate(event.target.value); setChangeSlot(null) }}>{changeAvailability.map((day) => <option key={day.date} value={day.date}>{formatDate(day.date)}</option>)}</select></label>
                    <fieldset className="client-session-slots"><legend>Available times</legend>{changeDay?.slots?.map((slot) => <button key={slot.startsAt} type="button" className={changeSlot?.startsAt === slot.startsAt ? 'is-selected' : ''} onClick={() => setChangeSlot(slot)}>{formatTime(slot.startsAt)}</button>)}</fieldset>
                  </>
                )}
                <label><span>{changeType === 'cancel' ? 'Why do you need to cancel?' : 'Why would you like a different time?'}</span><textarea rows="4" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} required /></label>
                <div className="client-session-modal__actions">
                  <button className="client-session-primary" type="submit" disabled={status.saving}>{status.saving ? 'Sending…' : changeType === 'cancel' ? 'Send Cancellation Request' : 'Request This New Time'}</button>
                  <button type="button" onClick={() => setChangeTarget(null)}>Keep Current Session</button>
                </div>
              </form>
            </section>
          </div>
        )}
      </section>
    </main>
  )
}
