import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame'
import {
  checkAdminAccess,
  createAdminAppointmentType,
  createAdminAvailabilityBlock,
  getAdminAppointmentTypes,
  getAdminAvailabilityBlocks,
  getAdminBookings,
  updateAdminAppointmentType,
  updateAdminAvailabilityBlock,
  updateAdminBookingStatus,
  welcomeBookingIntoClientCircle,
} from '../../lib/nativeApi'

import './Admin.css'
const defaultTypeForm = {
  name: '',
  description: '',
  durationMinutes: 60,
  priceCents: 0,
  currency: 'USD',
  requiresApproval: true,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  isActive: true,
}

const defaultAvailabilityForm = {
  weekday: 1,
  specificDate: '',
  startTime: '09:00',
  endTime: '17:00',
  timezone: 'America/New_York',
  isActive: true,
  notes: '',
}

const defaultBookingForm = {
  status: 'requested',
  adminNotes: '',
}

const weekdays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

const sessionCareActions = [
  {
    label: 'Approve Request',
    status: 'approved',
    note: 'Reviewed and approved inside The Studio.',
  },
  {
    label: 'Mark Confirmed',
    status: 'confirmed',
    note: 'Session confirmed and ready for follow-up.',
  },
  {
    label: 'Complete Session',
    status: 'completed',
    note: 'Session completed.',
  },
  {
    label: 'Cancel Request',
    status: 'cancelled',
    note: 'Request cancelled.',
  },
]

function centsToDisplay(value, currency = 'USD') {
  const amount = Number(value || 0) / 100

  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount)
}

function readableBoolean(value) {
  return value ? 'Yes' : 'No'
}

function readableStatus(value) {
  if (!value) return '-'
  return value.replaceAll('_', ' ')
}

function statusTone(value) {
  if (['requested', 'approved'].includes(value)) return 'needs-care'
  if (value === 'confirmed') return 'confirmed'
  if (value === 'completed') return 'completed'
  if (['cancelled', 'no_show'].includes(value)) return 'quiet'
  return 'neutral'
}

function formatTime(value) {
  if (!value) return '-'
  return String(value).slice(0, 5)
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

function formatDateTime(value) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatAvailabilityLabel(block) {
  if (block.specific_date) {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(block.specific_date))
  }

  return weekdays[Number(block.weekday)] || 'Weekly'
}

function mapAppointmentTypeToForm(appointmentType) {
  return {
    name: appointmentType?.name || '',
    description: appointmentType?.description || '',
    durationMinutes: appointmentType?.duration_minutes || 60,
    priceCents: appointmentType?.price_cents || 0,
    currency: appointmentType?.currency || 'USD',
    requiresApproval: Boolean(appointmentType?.requires_approval),
    bufferBeforeMinutes: appointmentType?.buffer_before_minutes || 0,
    bufferAfterMinutes: appointmentType?.buffer_after_minutes || 0,
    isActive: Boolean(appointmentType?.is_active),
  }
}

function mapAvailabilityToForm(block) {
  return {
    weekday: block?.weekday ?? 1,
    specificDate: formatDate(block?.specific_date),
    startTime: formatTime(block?.start_time) || '09:00',
    endTime: formatTime(block?.end_time) || '17:00',
    timezone: block?.timezone || 'America/New_York',
    isActive: Boolean(block?.is_active),
    notes: block?.notes || '',
  }
}

function renderIntakeValue(value) {
  if (!value) return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function AdminScheduler() {
  const [appointmentTypes, setAppointmentTypes] = useState([])
  const [availabilityBlocks, setAvailabilityBlocks] = useState([])
  const [bookings, setBookings] = useState([])
  const [selectedType, setSelectedType] = useState(null)
  const [selectedAvailability, setSelectedAvailability] = useState(null)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [welcomedBookingIds, setWelcomedBookingIds] = useState([])
  const [typeForm, setTypeForm] = useState(defaultTypeForm)
  const [availabilityForm, setAvailabilityForm] = useState(defaultAvailabilityForm)
  const [bookingForm, setBookingForm] = useState(defaultBookingForm)
  const [status, setStatus] = useState({
    loading: true,
    saving: false,
    error: '',
    message: 'Opening Sessions & Calendar...',
  })

  const bookingStats = useMemo(() => {
    const needsCare = bookings.filter((booking) => ['requested', 'approved'].includes(booking.status)).length
    const confirmed = bookings.filter((booking) => booking.status === 'confirmed').length
    const completed = bookings.filter((booking) => booking.status === 'completed').length

    return {
      needsCare,
      confirmed,
      completed,
    }
  }, [bookings])

  useEffect(() => {
    document.body.classList.add('admin-app-mode')

    return () => {
      document.body.classList.remove('admin-app-mode')
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadScheduler() {
      try {
        await checkAdminAccess()

        const [typesResult, availabilityResult, bookingsResult] = await Promise.all([
          getAdminAppointmentTypes(),
          getAdminAvailabilityBlocks(),
          getAdminBookings(),
        ])

        if (!isMounted) return

        setAppointmentTypes(typesResult.appointmentTypes || [])
        setAvailabilityBlocks(availabilityResult.availabilityBlocks || [])
        setBookings(bookingsResult.bookings || [])

        setStatus({
          loading: false,
          saving: false,
          error: '',
          message: '',
        })
      } catch (error) {
        if (!isMounted) return

        setAppointmentTypes([])
        setAvailabilityBlocks([])
        setBookings([])

        setStatus({
          loading: false,
          saving: false,
          error: error.message || 'Unable to open Sessions & Calendar.',
          message: '',
        })
      }
    }

    loadScheduler()

    return () => {
      isMounted = false
    }
  }, [])

  const handleTypeChange = (event) => {
    const { name, value, type, checked } = event.target

    setTypeForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))

    setStatus((current) => ({
      ...current,
      error: '',
      message: '',
    }))
  }

  const handleAvailabilityChange = (event) => {
    const { name, value, type, checked } = event.target

    setAvailabilityForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))

    setStatus((current) => ({
      ...current,
      error: '',
      message: '',
    }))
  }

  const handleBookingChange = (event) => {
    const { name, value } = event.target

    setBookingForm((current) => ({
      ...current,
      [name]: value,
    }))

    setStatus((current) => ({
      ...current,
      error: '',
      message: '',
    }))
  }

  const handleSelectType = (appointmentType) => {
    setSelectedType(appointmentType)
    setTypeForm(mapAppointmentTypeToForm(appointmentType))

    setStatus((current) => ({
      ...current,
      error: '',
      message: 'Session type loaded for editing.',
    }))
  }

  const handleSelectAvailability = (block) => {
    setSelectedAvailability(block)
    setAvailabilityForm(mapAvailabilityToForm(block))

    setStatus((current) => ({
      ...current,
      error: '',
      message: 'Availability block loaded for editing.',
    }))
  }

  const handleSelectBooking = (booking) => {
    setSelectedBooking(booking)
    setBookingForm({
      status: booking.status || 'requested',
      adminNotes: booking.admin_notes || '',
    })

    setStatus((current) => ({
      ...current,
      error: '',
      message: 'Session request opened for review.',
    }))
  }

  const handleNewType = () => {
    setSelectedType(null)
    setTypeForm(defaultTypeForm)

    setStatus((current) => ({
      ...current,
      error: '',
      message: 'Ready to create a new session type.',
    }))
  }

  const handleNewAvailability = () => {
    setSelectedAvailability(null)
    setAvailabilityForm(defaultAvailabilityForm)

    setStatus((current) => ({
      ...current,
      error: '',
      message: 'Ready to create a new availability block.',
    }))
  }

  const handleTypeSubmit = async (event) => {
    event.preventDefault()

    setStatus((current) => ({
      ...current,
      saving: true,
      error: '',
      message: '',
    }))

    try {
      const payload = {
        ...typeForm,
        durationMinutes: Number(typeForm.durationMinutes),
        priceCents: Number(typeForm.priceCents),
        bufferBeforeMinutes: Number(typeForm.bufferBeforeMinutes),
        bufferAfterMinutes: Number(typeForm.bufferAfterMinutes),
      }

      const result = selectedType
        ? await updateAdminAppointmentType(selectedType.id, payload)
        : await createAdminAppointmentType(payload)

      setAppointmentTypes(result.appointmentTypes || [])
      setSelectedType(result.appointmentType || null)
      setTypeForm(mapAppointmentTypeToForm(result.appointmentType))

      setStatus({
        loading: false,
        saving: false,
        error: '',
        message: result.message || 'Session type saved.',
      })
    } catch (error) {
      setStatus((current) => ({
        ...current,
        saving: false,
        error: error.message || 'Unable to save session type.',
        message: '',
      }))
    }
  }

  const handleAvailabilitySubmit = async (event) => {
    event.preventDefault()

    setStatus((current) => ({
      ...current,
      saving: true,
      error: '',
      message: '',
    }))

    try {
      const payload = {
        ...availabilityForm,
        weekday: availabilityForm.specificDate ? null : Number(availabilityForm.weekday),
      }

      const result = selectedAvailability
        ? await updateAdminAvailabilityBlock(selectedAvailability.id, payload)
        : await createAdminAvailabilityBlock(payload)

      setAvailabilityBlocks(result.availabilityBlocks || [])
      setSelectedAvailability(result.availabilityBlock || null)
      setAvailabilityForm(mapAvailabilityToForm(result.availabilityBlock))

      setStatus({
        loading: false,
        saving: false,
        error: '',
        message: result.message || 'Availability saved.',
      })
    } catch (error) {
      setStatus((current) => ({
        ...current,
        saving: false,
        error: error.message || 'Unable to save availability.',
        message: '',
      }))
    }
  }

  const saveBookingStatus = async (nextStatus, note = bookingForm.adminNotes) => {
    if (!selectedBooking?.id) return

    setStatus((current) => ({
      ...current,
      saving: true,
      error: '',
      message: '',
    }))

    try {
      const result = await updateAdminBookingStatus(selectedBooking.id, {
        status: nextStatus,
        adminNotes: note,
      })

      setBookings(result.bookings || [])
      setSelectedBooking(result.booking || null)
      setBookingForm({
        status: result.booking?.status || nextStatus,
        adminNotes: result.booking?.admin_notes || note || '',
      })

      setStatus({
        loading: false,
        saving: false,
        error: '',
        message: result.message || 'Session request updated.',
      })
    } catch (error) {
      setStatus((current) => ({
        ...current,
        saving: false,
        error: error.message || 'Unable to update session request.',
        message: '',
      }))
    }
  }

  const handleBookingStatusSubmit = async (event) => {
    event.preventDefault()
    await saveBookingStatus(bookingForm.status, bookingForm.adminNotes)
  }

  const handleCareAction = async (action) => {
    const currentNotes = bookingForm.adminNotes ? `${bookingForm.adminNotes}\n\n${action.note}` : action.note
    await saveBookingStatus(action.status, currentNotes)
  }

  const handleWelcomeIntoClientCircle = async () => {
    if (!selectedBooking?.id) return

    setStatus((current) => ({
      ...current,
      saving: true,
      error: '',
      message: '',
    }))

    try {
      const result = await welcomeBookingIntoClientCircle(selectedBooking.id)

      const welcomedBooking = result.booking
        ? {
            ...result.booking,
            client_profile_id: result.booking.client_profile_id || result.clientProfile?.id,
          }
        : {
            ...selectedBooking,
            client_profile_id: result.clientProfile?.id || selectedBooking.client_profile_id,
          }

      setBookings(result.bookings || [])
      setSelectedBooking(welcomedBooking)
      setWelcomedBookingIds((current) => (
        current.includes(selectedBooking.id) ? current : [...current, selectedBooking.id]
      ))
      setBookingForm((current) => ({
        ...current,
        status: welcomedBooking.status || current.status,
        adminNotes: welcomedBooking.admin_notes || current.adminNotes,
      }))

      setStatus({
        loading: false,
        saving: false,
        error: '',
        message: result.message || 'Welcomed into the Client Circle.',
      })
    } catch (error) {
      setStatus((current) => ({
        ...current,
        saving: false,
        error: error.message || 'Unable to welcome this request into the Client Circle.',
        message: '',
      }))
    }
  }

  return (
    <AdminFrame>
      <div className="pwc-admin-page-header pwc-admin-page-header-balanced">
        <div>
          <p className="eyebrow">Sessions & Calendar</p>
          <h1>Hold the rhythm of the work.</h1>
          <p>
            Create session types, open gentle booking windows, and care for each request
            from first interest to completed session.
          </p>
        </div>

        <Link className="btn primary" to="/admin/dashboard">
          The Studio
        </Link>
      </div>

      <div className="pwc-admin-metrics-grid pwc-admin-metrics-compact pwc-session-care-metrics">
        <article>
          <span>Session Types</span>
          <strong>{appointmentTypes.length}</strong>
          <small>Ways clients can begin</small>
        </article>
        <article>
          <span>Availability Windows</span>
          <strong>{availabilityBlocks.length}</strong>
          <small>Available care rhythms</small>
        </article>
        <article>
          <span>Needs Care</span>
          <strong>{bookingStats.needsCare}</strong>
          <small>Requests awaiting review</small>
        </article>
        <article>
          <span>Confirmed</span>
          <strong>{bookingStats.confirmed}</strong>
          <small>Sessions ready</small>
        </article>
      </div>

      {(status.message || status.error) && (
        <div className="pwc-admin-global-feedback">
          {status.message && (
            <p className="pwc-admin-form-success">
              {status.message}
            </p>
          )}

          {status.error && (
            <p className="pwc-admin-form-error" role="alert">
              {status.error}
            </p>
          )}
        </div>
      )}

      <section className="pwc-admin-scheduler-section pwc-session-care-section">
        <div className="pwc-admin-scheduler-section-header">
          <div>
            <p className="eyebrow">Session Care Flow</p>
            <h2>Review requests with clarity.</h2>
          </div>
        </div>

        <div className="pwc-admin-booking-grid pwc-session-care-grid">
          <section className="pwc-admin-table-card">
            <div className="pwc-admin-table-header">
              <div>
                <p className="eyebrow">Needs Your Care</p>
                <h2>Session Requests</h2>
              </div>
              <span>{status.loading ? 'Loading...' : `${bookings.length} request(s)`}</span>
            </div>

            <div className="pwc-admin-table-scroll">
              <table className="pwc-admin-table pwc-admin-bookings-table">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Session</th>
                    <th>Preferred Time</th>
                    <th>Status</th>
                    <th>Care</th>
                  </tr>
                </thead>

                <tbody>
                  {bookings.map((booking) => (
                    <tr className={selectedBooking?.id === booking.id ? 'is-selected' : ''} key={booking.id}>
                      <td>
                        <strong>{booking.guest_name || 'Guest'}</strong>
                        <small>{booking.guest_email}</small>
                      </td>
                      <td>{booking.appointment_type_name || '-'}</td>
                      <td>{formatDateTime(booking.starts_at)}</td>
                      <td>
                        <span className={`pwc-session-status-badge ${statusTone(booking.status)}`}>
                          {readableStatus(booking.status)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="pwc-admin-table-action"
                          type="button"
                          onClick={() => handleSelectBooking(booking)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}

                  {!status.loading && bookings.length === 0 && (
                    <tr>
                      <td colSpan="5">No session requests yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <form className="pwc-admin-create-card pwc-admin-booking-review-card pwc-session-review-card" onSubmit={handleBookingStatusSubmit}>
            <div className="pwc-admin-table-header compact">
              <div>
                <p className="eyebrow">Session Review</p>
                <h2>{selectedBooking ? selectedBooking.guest_name : 'Select a request'}</h2>
              </div>
            </div>

            {selectedBooking ? (
              <>
                <div className="pwc-session-review-status-row">
                  <span className={`pwc-session-status-badge ${statusTone(selectedBooking.status)}`}>
                    {readableStatus(selectedBooking.status)}
                  </span>
                  <small>{selectedBooking.appointment_type_name || 'Session request'}</small>
                </div>

                <div className="pwc-admin-booking-summary pwc-session-review-summary">
                  <article>
                    <span>Email</span>
                    <strong>{selectedBooking.guest_email}</strong>
                  </article>
                  <article>
                    <span>Phone</span>
                    <strong>{selectedBooking.guest_phone || '-'}</strong>
                  </article>
                  <article>
                    <span>Preferred Time</span>
                    <strong>{formatDateTime(selectedBooking.starts_at)}</strong>
                  </article>
                  <article>
                    <span>Timezone</span>
                    <strong>{selectedBooking.timezone || '-'}</strong>
                  </article>
                </div>

                <div className="pwc-session-intake-card">
                  <p className="eyebrow">Shared by Client</p>
                  <article>
                    <span>What would they like support with?</span>
                    <p>{renderIntakeValue(selectedBooking.intake_answers?.reason)}</p>
                  </article>
                  <article>
                    <span>Preferred focus</span>
                    <p>{renderIntakeValue(selectedBooking.intake_answers?.preferredFocus)}</p>
                  </article>
                </div>

                <div className="pwc-session-care-actions">
                  {sessionCareActions.map((action) => (
                    <button
                      className="pwc-session-care-button"
                      type="button"
                      key={action.status}
                      onClick={() => handleCareAction(action)}
                      disabled={status.saving}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>

                <div className="pwc-session-client-circle-action">
                  <button
                    className="btn primary"
                    type="button"
                    onClick={handleWelcomeIntoClientCircle}
                    disabled={status.saving || Boolean(selectedBooking.client_profile_id || welcomedBookingIds.includes(selectedBooking.id))}
                  >
                    {selectedBooking.client_profile_id || welcomedBookingIds.includes(selectedBooking.id) ? 'Already in Client Circle' : 'Welcome Into Client Circle'}
                  </button>
                  <p>
                    Create or update this person's private client profile, connect the session request,
                    and record the change in the Activity Journal.
                  </p>
                </div>

                <div className="pwc-admin-form-grid">
                  <label>
                    Current Status
                    <select name="status" value={bookingForm.status} onChange={handleBookingChange}>
                      <option value="requested">Requested</option>
                      <option value="approved">Approved</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="no_show">No Show</option>
                    </select>
                  </label>

                  <label className="span-2">
                    Private Studio Notes
                    <textarea
                      name="adminNotes"
                      value={bookingForm.adminNotes}
                      onChange={handleBookingChange}
                      placeholder="Private notes for this session request."
                      rows="5"
                    />
                  </label>
                </div>

                <button className="btn primary" type="submit" disabled={status.saving}>
                  {status.saving ? 'Saving...' : 'Save Session Notes'}
                </button>
              </>
            ) : (
              <div className="pwc-admin-empty-detail compact">
                <p>Select a session request to review details, read intake answers, and move it through the care flow.</p>
              </div>
            )}
          </form>
        </div>
      </section>

      <section className="pwc-admin-scheduler-section">
        <div className="pwc-admin-scheduler-section-header">
          <div>
            <p className="eyebrow">Session Types</p>
            <h2>Ways clients can begin.</h2>
          </div>
        </div>

        <div className="pwc-admin-scheduler-grid">
          <form className="pwc-admin-create-card pwc-admin-scheduler-form" onSubmit={handleTypeSubmit}>
            <div className="pwc-admin-table-header compact">
              <div>
                <p className="eyebrow">{selectedType ? 'Edit Type' : 'Create Type'}</p>
                <h2>{selectedType ? 'Session Details' : 'New Session Type'}</h2>
              </div>

              <button className="pwc-admin-table-action" type="button" onClick={handleNewType}>
                New
              </button>
            </div>

            <div className="pwc-admin-form-grid">
              <label className="span-2">
                Session Name
                <input
                  name="name"
                  value={typeForm.name}
                  onChange={handleTypeChange}
                  placeholder="Personal Presence Consultation"
                  required
                />
              </label>

              <label>
                Duration Minutes
                <input
                  name="durationMinutes"
                  type="number"
                  min="15"
                  max="480"
                  value={typeForm.durationMinutes}
                  onChange={handleTypeChange}
                  required
                />
              </label>

              <label>
                Price In Cents
                <input
                  name="priceCents"
                  type="number"
                  min="0"
                  value={typeForm.priceCents}
                  onChange={handleTypeChange}
                />
              </label>

              <label>
                Currency
                <input
                  name="currency"
                  value={typeForm.currency}
                  onChange={handleTypeChange}
                  maxLength="3"
                  required
                />
              </label>

              <label>
                Buffer Before
                <input
                  name="bufferBeforeMinutes"
                  type="number"
                  min="0"
                  max="180"
                  value={typeForm.bufferBeforeMinutes}
                  onChange={handleTypeChange}
                />
              </label>

              <label>
                Buffer After
                <input
                  name="bufferAfterMinutes"
                  type="number"
                  min="0"
                  max="180"
                  value={typeForm.bufferAfterMinutes}
                  onChange={handleTypeChange}
                />
              </label>

              <label className="span-2">
                Description
                <textarea
                  name="description"
                  value={typeForm.description}
                  onChange={handleTypeChange}
                  placeholder="Describe what this session is for and what the client can expect."
                  rows="5"
                />
              </label>

              <label className="pwc-admin-checkbox-label">
                <input
                  name="requiresApproval"
                  type="checkbox"
                  checked={typeForm.requiresApproval}
                  onChange={handleTypeChange}
                />
                Requires Studio Review
              </label>

              <label className="pwc-admin-checkbox-label">
                <input
                  name="isActive"
                  type="checkbox"
                  checked={typeForm.isActive}
                  onChange={handleTypeChange}
                />
                Open For Requests
              </label>
            </div>

            <button className="btn primary" type="submit" disabled={status.saving}>
              {status.saving ? 'Saving...' : selectedType ? 'Save Session Type' : 'Create Session Type'}
            </button>
          </form>

          <section className="pwc-admin-table-card">
            <div className="pwc-admin-table-header">
              <div>
                <p className="eyebrow">Session Library</p>
                <h2>Session Types</h2>
              </div>
              <span>{status.loading ? 'Loading...' : `${appointmentTypes.length} type(s)`}</span>
            </div>

            <div className="pwc-admin-table-scroll">
              <table className="pwc-admin-table pwc-admin-scheduler-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Duration</th>
                    <th>Price</th>
                    <th>Review</th>
                    <th>Open</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {appointmentTypes.map((appointmentType) => (
                    <tr className={selectedType?.id === appointmentType.id ? 'is-selected' : ''} key={appointmentType.id}>
                      <td>
                        <strong>{appointmentType.name}</strong>
                        <small>{appointmentType.slug}</small>
                      </td>
                      <td>{appointmentType.duration_minutes} min</td>
                      <td>{centsToDisplay(appointmentType.price_cents, appointmentType.currency)}</td>
                      <td>{readableBoolean(appointmentType.requires_approval)}</td>
                      <td>{readableBoolean(appointmentType.is_active)}</td>
                      <td>
                        <button className="pwc-admin-table-action" type="button" onClick={() => handleSelectType(appointmentType)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}

                  {!status.loading && appointmentTypes.length === 0 && (
                    <tr>
                      <td colSpan="6">No session types yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      <section className="pwc-admin-scheduler-section">
        <div className="pwc-admin-scheduler-section-header">
          <div>
            <p className="eyebrow">Availability Windows</p>
            <h2>Set the times clients can request sessions.</h2>
          </div>
        </div>

        <div className="pwc-admin-scheduler-grid">
          <form className="pwc-admin-create-card pwc-admin-scheduler-form" onSubmit={handleAvailabilitySubmit}>
            <div className="pwc-admin-table-header compact">
              <div>
                <p className="eyebrow">{selectedAvailability ? 'Edit Availability' : 'Create Availability'}</p>
                <h2>{selectedAvailability ? 'Availability Details' : 'New Availability Window'}</h2>
              </div>

              <button className="pwc-admin-table-action" type="button" onClick={handleNewAvailability}>
                New
              </button>
            </div>

            <div className="pwc-admin-form-grid">
              <label>
                Weekly Day
                <select
                  name="weekday"
                  value={availabilityForm.weekday}
                  onChange={handleAvailabilityChange}
                  disabled={Boolean(availabilityForm.specificDate)}
                >
                  {weekdays.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Specific Date Override
                <input
                  name="specificDate"
                  type="date"
                  value={availabilityForm.specificDate}
                  onChange={handleAvailabilityChange}
                />
              </label>

              <label>
                Start Time
                <input
                  name="startTime"
                  type="time"
                  value={availabilityForm.startTime}
                  onChange={handleAvailabilityChange}
                  required
                />
              </label>

              <label>
                End Time
                <input
                  name="endTime"
                  type="time"
                  value={availabilityForm.endTime}
                  onChange={handleAvailabilityChange}
                  required
                />
              </label>

              <label className="span-2">
                Timezone
                <input
                  name="timezone"
                  value={availabilityForm.timezone}
                  onChange={handleAvailabilityChange}
                  placeholder="America/New_York"
                  required
                />
              </label>

              <label className="span-2">
                Notes
                <textarea
                  name="notes"
                  value={availabilityForm.notes}
                  onChange={handleAvailabilityChange}
                  placeholder="Example: Tuesdays for consultations only."
                  rows="4"
                />
              </label>

              <label className="pwc-admin-checkbox-label span-2">
                <input
                  name="isActive"
                  type="checkbox"
                  checked={availabilityForm.isActive}
                  onChange={handleAvailabilityChange}
                />
                Active Availability
              </label>
            </div>

            <button className="btn primary" type="submit" disabled={status.saving}>
              {status.saving ? 'Saving...' : selectedAvailability ? 'Save Availability' : 'Create Availability'}
            </button>
          </form>

          <section className="pwc-admin-table-card">
            <div className="pwc-admin-table-header">
              <div>
                <p className="eyebrow">Availability</p>
                <h2>Availability Windows</h2>
              </div>
              <span>{status.loading ? 'Loading...' : `${availabilityBlocks.length} block(s)`}</span>
            </div>

            <div className="pwc-admin-table-scroll">
              <table className="pwc-admin-table pwc-admin-scheduler-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Time</th>
                    <th>Timezone</th>
                    <th>Active</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {availabilityBlocks.map((block) => (
                    <tr className={selectedAvailability?.id === block.id ? 'is-selected' : ''} key={block.id}>
                      <td>
                        <strong>{formatAvailabilityLabel(block)}</strong>
                        <small>{block.specific_date ? 'Specific date' : 'Weekly'}</small>
                      </td>
                      <td>{formatTime(block.start_time)} - {formatTime(block.end_time)}</td>
                      <td>{block.timezone}</td>
                      <td>{readableBoolean(block.is_active)}</td>
                      <td>
                        <button className="pwc-admin-table-action" type="button" onClick={() => handleSelectAvailability(block)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}

                  {!status.loading && availabilityBlocks.length === 0 && (
                    <tr>
                      <td colSpan="5">No availability blocks yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </AdminFrame>
  )
}

export default AdminScheduler
