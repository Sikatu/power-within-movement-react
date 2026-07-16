import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ClientPortalChrome from '../components/ClientPortalChrome.jsx'
import {
  createClientPortalBooking,
  createClientPortalBookingChangeRequest,
  getClientPortalDashboard,
  getPublicAppointmentTypes,
  getPublicAvailabilitySlots,
  logoutClientPortal,
} from '../lib/nativeApi.js'
import './ClientPortalWorkspace.css'

const businessTimeZone = 'America/New_York'

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

function formatDate(value, style = 'full') {
  if (!value) return 'Not scheduled'
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: style,
      timeZone: businessTimeZone,
    }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
  } catch {
    return 'Date unavailable'
  }
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled'
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: businessTimeZone,
    }).format(new Date(value))
  } catch {
    return 'Date unavailable'
  }
}

function formatTime(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: businessTimeZone,
    }).format(new Date(value))
  } catch {
    return ''
  }
}

function readable(value) {
  const text = String(value || '').replaceAll('_', ' ').trim().toLowerCase()
  return text ? text.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Pending'
}

function isAuthError(error) {
  return /login required|unauthorized|401/i.test(String(error?.message || error || ''))
}

function friendlyError(error) {
  const message = String(error?.message || error || '')
  if (isAuthError(error)) return 'Your private session ended. Please sign in again.'
  if (/failed to fetch|network|load failed/i.test(message)) return 'We could not reach your private portal. Please check the backend connection and try again.'
  return message || 'Something went wrong. Please try again.'
}

function ClientPortalSessions() {
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
  const [loggingOut, setLoggingOut] = useState(false)
  const [portalNow] = useState(() => Date.now())

  useEffect(() => {
    document.body.classList.add('client-workspace-mode')
    return () => document.body.classList.remove('client-workspace-mode')
  }, [])

  async function loadDashboard() {
    const response = await getClientPortalDashboard()
    setDashboard(response)
    return response
  }

  useEffect(() => {
    let active = true

    Promise.all([getClientPortalDashboard(), getPublicAppointmentTypes()])
      .then(([dashboardResponse, typesResponse]) => {
        if (!active) return
        const types = typesResponse.appointmentTypes || []
        setDashboard(dashboardResponse)
        setAppointmentTypes(types)
        setSelectedTypeId(types[0]?.id || '')
        setStatus({ loading: false, saving: false, error: '', message: '' })
      })
      .catch((error) => {
        if (!active) return
        if (isAuthError(error)) {
          navigate('/client-portal/login', { replace: true })
          return
        }
        setStatus({ loading: false, saving: false, error: friendlyError(error), message: '' })
      })

    return () => { active = false }
  }, [navigate])

  useEffect(() => {
    if (!selectedTypeId) {
      setAvailability([])
      return
    }

    let active = true
    const start = dateKey()

    getPublicAvailabilitySlots(selectedTypeId, start, addDays(start, 60))
      .then((response) => {
        if (!active) return
        const days = (response.days || []).filter((day) => day.isAvailable)
        setAvailability(days)
        setSelectedDate((current) => (current && days.some((day) => day.date === current) ? current : days[0]?.date || ''))
        setSelectedSlot(null)
      })
      .catch((error) => {
        if (active) setStatus((current) => ({ ...current, error: friendlyError(error), message: '' }))
      })

    return () => { active = false }
  }, [selectedTypeId])

  const bookings = useMemo(() => dashboard?.bookings || [], [dashboard])
  const changeRequests = useMemo(() => dashboard?.bookingChangeRequests || [], [dashboard])
  const upcomingBookings = useMemo(() => bookings
    .filter((booking) => {
      const startsAt = new Date(booking.starts_at).getTime()
      return Number.isFinite(startsAt) && startsAt >= portalNow && !['cancelled', 'completed', 'no_show'].includes(String(booking.status || '').toLowerCase())
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()), [bookings, portalNow])
  const historyBookings = useMemo(() => bookings
    .filter((booking) => {
      const startsAt = new Date(booking.starts_at).getTime()
      return Number.isFinite(startsAt) && (startsAt < portalNow || ['cancelled', 'completed', 'no_show'].includes(String(booking.status || '').toLowerCase()))
    })
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()), [bookings, portalNow])

  const selectedDay = availability.find((day) => day.date === selectedDate)
  const changeDay = changeAvailability.find((day) => day.date === changeDate)
  const client = dashboard?.client

  function pendingRequestForBooking(bookingId) {
    return changeRequests.find((request) => request.booking_id === bookingId && request.status === 'pending')
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
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
        intakeAnswers: bookingNote.trim() ? { clientNote: bookingNote.trim() } : {},
      })
      await loadDashboard()
      setSelectedSlot(null)
      setBookingNote('')
      setStatus({ loading: false, saving: false, error: '', message: response.message || 'Your session request was sent.' })
    } catch (error) {
      if (isAuthError(error)) {
        navigate('/client-portal/login', { replace: true })
        return
      }
      setStatus({ loading: false, saving: false, error: friendlyError(error), message: '' })
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

    if (type !== 'reschedule') return

    try {
      const start = dateKey()
      const response = await getPublicAvailabilitySlots(booking.appointment_type_id, start, addDays(start, 60))
      const days = (response.days || []).filter((day) => day.isAvailable)
      setChangeAvailability(days)
      setChangeDate(days[0]?.date || '')
    } catch (error) {
      setStatus((current) => ({ ...current, error: friendlyError(error), message: '' }))
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
        reason: changeReason.trim(),
      })
      await loadDashboard()
      setChangeTarget(null)
      setStatus({ loading: false, saving: false, error: '', message: response.message || 'Your change request was sent.' })
    } catch (error) {
      setStatus({ loading: false, saving: false, error: friendlyError(error), message: '' })
    }
  }

  return (
    <main id="main-content" className="portal-workspace portal-sessions-page">
      <ClientPortalChrome client={client} loggingOut={loggingOut} onLogout={handleLogout} />

      <div className="portal-workspace-inner">
        <header className="portal-page-intro">
          <p className="eyebrow">Sessions</p>
          <h1>Book and manage your time with Kim.</h1>
          <p>Choose an available session, review what is coming up, or request a thoughtful change.</p>
        </header>

        {(status.error || status.message) && (
          <div className={`portal-notice${status.error ? ' is-error' : ''}`} role="status">
            {status.error || status.message}
          </div>
        )}

        {status.loading ? (
          <div className="portal-loading" role="status">Preparing your sessions…</div>
        ) : (
          <div className="session-grid">
            <section className="portal-card session-booking-card">
              <div className="portal-card-heading">
                <div><p className="eyebrow">Book Time</p><h2>Request a new session</h2></div>
                <span>Eastern Time</span>
              </div>

              {appointmentTypes.length === 0 ? (
                <div className="portal-empty"><strong>Booking will open soon.</strong><p>Kim has not published any appointment types yet.</p></div>
              ) : (
                <form className="portal-form" onSubmit={handleBook}>
                  <label>
                    <span>What would you like to book?</span>
                    <select value={selectedTypeId} onChange={(event) => setSelectedTypeId(event.target.value)}>
                      {appointmentTypes.map((type) => <option key={type.id} value={type.id}>{type.name} · {type.duration_minutes} min</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Choose a day</span>
                    <select value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setSelectedSlot(null) }}>
                      {availability.length === 0 && <option value="">No open dates currently</option>}
                      {availability.map((day) => <option key={day.date} value={day.date}>{formatDate(day.date)}</option>)}
                    </select>
                  </label>
                  <fieldset className="session-slots">
                    <legend>Available times</legend>
                    {selectedDay?.slots?.length ? selectedDay.slots.map((slot) => (
                      <button key={slot.startsAt} type="button" className={selectedSlot?.startsAt === slot.startsAt ? 'is-selected' : ''} onClick={() => setSelectedSlot(slot)}>
                        {formatTime(slot.startsAt)}
                      </button>
                    )) : <p>No times are open for this day.</p>}
                  </fieldset>
                  <label>
                    <span>Anything Kim should know? <em>Optional</em></span>
                    <textarea rows="4" value={bookingNote} onChange={(event) => setBookingNote(event.target.value)} placeholder="Share a short note about what you would like support with." />
                  </label>
                  <button className="portal-primary-button" type="submit" disabled={status.saving || !selectedSlot}>
                    {status.saving ? 'Sending…' : 'Request This Session'}
                  </button>
                </form>
              )}
            </section>

            <section className="session-upcoming-card">
              <div className="portal-card-heading">
                <div><p className="eyebrow">Coming Up</p><h2>Your sessions</h2></div>
                <span>{upcomingBookings.length} scheduled</span>
              </div>
              {upcomingBookings.length === 0 ? (
                <div className="portal-empty is-dark"><strong>No upcoming sessions yet.</strong><p>Choose an available time whenever you are ready.</p></div>
              ) : upcomingBookings.map((booking) => {
                const pending = pendingRequestForBooking(booking.id)
                return (
                  <article className="session-upcoming-item" key={booking.id}>
                    <span className="portal-status-pill">{readable(booking.status)}</span>
                    <h3>{booking.appointment_type_name || 'Private Session'}</h3>
                    <p>{formatDateTime(booking.starts_at)} Eastern Time</p>
                    {pending ? (
                      <div className="session-pending-request">
                        <strong>{pending.request_type === 'cancel' ? 'Cancellation requested' : 'New time requested'}</strong>
                        <p>{pending.request_type === 'reschedule' ? formatDateTime(pending.requested_starts_at) : 'Power Within will review this request.'}</p>
                      </div>
                    ) : (
                      <div className="session-actions">
                        <button type="button" onClick={() => openChange(booking, 'reschedule')}>Request New Time</button>
                        <button type="button" onClick={() => openChange(booking, 'cancel')}>Cancel Session</button>
                      </div>
                    )}
                  </article>
                )
              })}
            </section>

            <section className="portal-card session-history-card">
              <div className="portal-card-heading"><div><p className="eyebrow">History</p><h2>Previous sessions</h2></div></div>
              {historyBookings.length === 0 ? (
                <div className="portal-empty"><p>Your completed and past sessions will appear here.</p></div>
              ) : (
                <div className="session-history-list">
                  {historyBookings.map((booking) => (
                    <article key={booking.id}>
                      <div><h3>{booking.appointment_type_name || 'Private Session'}</h3><p>{formatDateTime(booking.starts_at)}</p></div>
                      <span>{readable(booking.status)}</span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {changeTarget && (
        <div className="portal-modal-backdrop">
          <section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="session-change-title">
            <button className="portal-modal-close" type="button" onClick={() => setChangeTarget(null)} aria-label="Close">×</button>
            <p className="eyebrow">Session Change</p>
            <h2 id="session-change-title">{changeType === 'cancel' ? 'Cancel this session?' : 'Choose a different time'}</h2>
            <p className="portal-modal-context">Current: {formatDateTime(changeTarget.starts_at)}</p>
            <form className="portal-form" onSubmit={submitChange}>
              {changeType === 'reschedule' && (
                <>
                  <label><span>Choose a new day</span><select value={changeDate} onChange={(event) => { setChangeDate(event.target.value); setChangeSlot(null) }}><option value="" disabled>No date selected</option>{changeAvailability.map((day) => <option key={day.date} value={day.date}>{formatDate(day.date)}</option>)}</select></label>
                  <fieldset className="session-slots"><legend>Available times</legend>{changeDay?.slots?.length ? changeDay.slots.map((slot) => <button key={slot.startsAt} type="button" className={changeSlot?.startsAt === slot.startsAt ? 'is-selected' : ''} onClick={() => setChangeSlot(slot)}>{formatTime(slot.startsAt)}</button>) : <p>No replacement times are open for this day.</p>}</fieldset>
                </>
              )}
              <label><span>{changeType === 'cancel' ? 'Why do you need to cancel?' : 'Why would you like a different time?'}</span><textarea rows="4" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} required /></label>
              <div className="portal-modal-actions">
                <button type="button" onClick={() => setChangeTarget(null)}>Keep Current Session</button>
                <button className="portal-primary-button" type="submit" disabled={status.saving}>{status.saving ? 'Sending…' : 'Send Request'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

export default ClientPortalSessions
