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


const defaultTypeForm = {
  name: '',
  description: '',
  durationMinutes: 60,
  priceAmount: 0,
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

const bookingFilters = [
  { value: 'all', label: 'All' },
  { value: 'needs-care', label: 'Needs review' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
]

const schedulerViews = [
  {
    value: 'requests',
    label: 'Requests',
    description: 'Review and move client requests forward.',
  },
  {
    value: 'types',
    label: 'Session Types',
    description: 'Manage the services clients can request.',
  },
  {
    value: 'availability',
    label: 'Availability',
    description: 'Choose when clients may request time.',
  },
]

const sessionCareActions = [
  {
    label: 'Approve request',
    status: 'approved',
    note: 'Reviewed and approved inside The Studio.',
    tone: 'approve',
  },
  {
    label: 'Mark confirmed',
    status: 'confirmed',
    note: 'Session confirmed and ready for follow-up.',
    tone: 'confirm',
  },
  {
    label: 'Complete session',
    status: 'completed',
    note: 'Session completed.',
    tone: 'complete',
  },
  {
    label: 'Cancel request',
    status: 'cancelled',
    note: 'Request cancelled.',
    tone: 'cancel',
  },
]

function centsToDisplay(value, currency = 'USD') {
  const amount = Number(value || 0) / 100

  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount)
}

function readableStatus(value) {
  if (!value) return 'Unknown'

  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusTone(value) {
  if (['requested', 'approved'].includes(value)) return 'needs-care'
  if (value === 'confirmed') return 'confirmed'
  if (value === 'completed') return 'completed'
  if (['cancelled', 'no_show'].includes(value)) return 'quiet'
  return 'neutral'
}

function formatTime(value) {
  if (!value) return '—'
  return String(value).slice(0, 5)
}

function formatDateInput(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDateOnly(value) {
  if (!value) return 'Date not set'

  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  const date = year && month && day ? new Date(year, month - 1, day) : new Date(value)

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatAvailabilityLabel(block) {
  if (block.specific_date) {
    return formatDateOnly(block.specific_date)
  }

  return weekdays[Number(block.weekday)] || 'Weekly availability'
}

function formatAvailabilityType(block) {
  return block.specific_date ? 'One-time window' : 'Weekly rhythm'
}

function getInitials(value) {
  const parts = String(value || 'Guest')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'G'
}

function mapAppointmentTypeToForm(appointmentType) {
  return {
    name: appointmentType?.name || '',
    description: appointmentType?.description || '',
    durationMinutes: appointmentType?.duration_minutes || 60,
    priceAmount: Number(appointmentType?.price_cents || 0) / 100,
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
    specificDate: formatDateInput(block?.specific_date),
    startTime: formatTime(block?.start_time) === '—' ? '09:00' : formatTime(block?.start_time),
    endTime: formatTime(block?.end_time) === '—' ? '17:00' : formatTime(block?.end_time),
    timezone: block?.timezone || 'America/New_York',
    isActive: Boolean(block?.is_active),
    notes: block?.notes || '',
  }
}

function renderIntakeValue(value) {
  if (!value) return 'No response provided.'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function bookingMatchesFilter(booking, filter) {
  if (filter === 'needs-care') return ['requested', 'approved'].includes(booking.status)
  if (filter === 'confirmed') return booking.status === 'confirmed'
  if (filter === 'completed') return booking.status === 'completed'
  if (filter === 'closed') return ['cancelled', 'no_show'].includes(booking.status)
  return true
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="pwc-scheduler-section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

function AdminScheduler() {
  const [workspaceView, setWorkspaceView] = useState('requests')
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
  const [bookingFilter, setBookingFilter] = useState('needs-care')
  const [bookingSearch, setBookingSearch] = useState('')
  const [typeSearch, setTypeSearch] = useState('')
  const [availabilitySearch, setAvailabilitySearch] = useState('')
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
    const activeWindows = availabilityBlocks.filter((block) => block.is_active).length

    return {
      needsCare,
      confirmed,
      completed,
      activeWindows,
    }
  }, [availabilityBlocks, bookings])

  const filteredBookings = useMemo(() => {
    const query = bookingSearch.trim().toLowerCase()

    return bookings
      .filter((booking) => bookingMatchesFilter(booking, bookingFilter))
      .filter((booking) => {
        if (!query) return true

        return [
          booking.guest_name,
          booking.guest_email,
          booking.appointment_type_name,
          booking.status,
        ].some((value) => String(value || '').toLowerCase().includes(query))
      })
      .sort((left, right) => {
        const leftDate = left.starts_at ? new Date(left.starts_at).getTime() : Number.MAX_SAFE_INTEGER
        const rightDate = right.starts_at ? new Date(right.starts_at).getTime() : Number.MAX_SAFE_INTEGER
        return leftDate - rightDate
      })
  }, [bookingFilter, bookingSearch, bookings])

  const filteredAppointmentTypes = useMemo(() => {
    const query = typeSearch.trim().toLowerCase()
    if (!query) return appointmentTypes

    return appointmentTypes.filter((appointmentType) => (
      [appointmentType.name, appointmentType.description, appointmentType.slug]
        .some((value) => String(value || '').toLowerCase().includes(query))
    ))
  }, [appointmentTypes, typeSearch])

  const filteredAvailability = useMemo(() => {
    const query = availabilitySearch.trim().toLowerCase()
    if (!query) return availabilityBlocks

    return availabilityBlocks.filter((block) => (
      [
        formatAvailabilityLabel(block),
        formatAvailabilityType(block),
        block.timezone,
        block.notes,
      ].some((value) => String(value || '').toLowerCase().includes(query))
    ))
  }, [availabilityBlocks, availabilitySearch])

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

        const loadedTypes = typesResult.appointmentTypes || []
        const loadedAvailability = availabilityResult.availabilityBlocks || []
        const loadedBookings = bookingsResult.bookings || []
        const firstBooking = loadedBookings.find((booking) => ['requested', 'approved'].includes(booking.status))
          || loadedBookings[0]
          || null

        setAppointmentTypes(loadedTypes)
        setAvailabilityBlocks(loadedAvailability)
        setBookings(loadedBookings)
        setSelectedBooking(firstBooking)

        if (firstBooking) {
          setBookingForm({
            status: firstBooking.status || 'requested',
            adminNotes: firstBooking.admin_notes || '',
          })
        }

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

    setStatus((current) => ({ ...current, error: '', message: '' }))
  }

  const handleAvailabilityChange = (event) => {
    const { name, value, type, checked } = event.target

    setAvailabilityForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))

    setStatus((current) => ({ ...current, error: '', message: '' }))
  }

  const handleBookingChange = (event) => {
    const { name, value } = event.target

    setBookingForm((current) => ({
      ...current,
      [name]: value,
    }))

    setStatus((current) => ({ ...current, error: '', message: '' }))
  }

  const handleSelectType = (appointmentType) => {
    setSelectedType(appointmentType)
    setTypeForm(mapAppointmentTypeToForm(appointmentType))
    setStatus((current) => ({ ...current, error: '', message: '' }))
  }

  const handleSelectAvailability = (block) => {
    setSelectedAvailability(block)
    setAvailabilityForm(mapAvailabilityToForm(block))
    setStatus((current) => ({ ...current, error: '', message: '' }))
  }

  const handleSelectBooking = (booking) => {
    setSelectedBooking(booking)
    setBookingForm({
      status: booking.status || 'requested',
      adminNotes: booking.admin_notes || '',
    })
    setStatus((current) => ({ ...current, error: '', message: '' }))
  }

  const handleNewType = () => {
    setSelectedType(null)
    setTypeForm(defaultTypeForm)
    setStatus((current) => ({ ...current, error: '', message: '' }))
  }

  const handleNewAvailability = () => {
    setSelectedAvailability(null)
    setAvailabilityForm(defaultAvailabilityForm)
    setStatus((current) => ({ ...current, error: '', message: '' }))
  }

  const handleTypeSubmit = async (event) => {
    event.preventDefault()

    setStatus((current) => ({ ...current, saving: true, error: '', message: '' }))

    try {
      const payload = {
        ...typeForm,
        durationMinutes: Number(typeForm.durationMinutes),
        priceCents: Math.max(0, Math.round(Number(typeForm.priceAmount || 0) * 100)),
        bufferBeforeMinutes: Number(typeForm.bufferBeforeMinutes),
        bufferAfterMinutes: Number(typeForm.bufferAfterMinutes),
      }

      delete payload.priceAmount

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

    if (availabilityForm.startTime >= availabilityForm.endTime) {
      setStatus((current) => ({
        ...current,
        saving: false,
        error: 'The end time must be later than the start time.',
        message: '',
      }))
      return
    }

    setStatus((current) => ({ ...current, saving: true, error: '', message: '' }))

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

    setStatus((current) => ({ ...current, saving: true, error: '', message: '' }))

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
    const existingNotes = String(bookingForm.adminNotes || '')
      .split(/\n+/)
      .map((note) => note.trim())
      .filter(Boolean)

    const currentNotes = existingNotes.includes(action.note)
      ? bookingForm.adminNotes
      : [...existingNotes, action.note].join('\n\n')

    await saveBookingStatus(action.status, currentNotes)
  }

  const handleWelcomeIntoClientCircle = async () => {
    if (!selectedBooking?.id) return

    setStatus((current) => ({ ...current, saving: true, error: '', message: '' }))

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

  const selectedBookingIsClient = Boolean(
    selectedBooking?.client_profile_id || welcomedBookingIds.includes(selectedBooking?.id),
  )

  return (
    <AdminFrame>
      <main className="pwc-scheduler-page">
        <header className="pwc-scheduler-hero">
          <div className="pwc-scheduler-hero-copy">
            <p className="eyebrow">Sessions & Calendar</p>
            <h1>Sessions</h1>
            <p>
              Review requests, manage session types, and protect your availability.
            </p>
          </div>

          <div className="pwc-scheduler-hero-actions">
            <Link className="btn secondary" to="/session-request">
              Preview booking page
            </Link>
          </div>
        </header>

        <nav className="pwc-scheduler-view-tabs" aria-label="Sessions workspace">
          {schedulerViews.map((view) => (
            <button
              key={view.value}
              type="button"
              className={workspaceView === view.value ? 'is-active' : ''}
              aria-pressed={workspaceView === view.value}
              onClick={() => setWorkspaceView(view.value)}
            >
              <span>{view.label}</span>
              <small>{view.description}</small>
            </button>
          ))}
        </nav>

        <section className="pwc-scheduler-metrics" aria-label="Scheduler summary">
          <article className={bookingStats.needsCare > 0 ? 'is-attention' : ''}>
            <span>Needs review</span>
            <strong>{bookingStats.needsCare}</strong>
            <small>New or approved requests</small>
          </article>
          <article>
            <span>Confirmed</span>
            <strong>{bookingStats.confirmed}</strong>
            <small>Sessions ready to happen</small>
          </article>
          <article>
            <span>Completed</span>
            <strong>{bookingStats.completed}</strong>
            <small>Finished client sessions</small>
          </article>
          <article>
            <span>Open windows</span>
            <strong>{bookingStats.activeWindows}</strong>
            <small>Active booking availability</small>
          </article>
        </section>

        {(status.message || status.error) && (
          <div className={`pwc-scheduler-feedback ${status.error ? 'is-error' : 'is-success'}`} role={status.error ? 'alert' : 'status'}>
            <span aria-hidden="true" />
            <p>{status.error || status.message}</p>
          </div>
        )}

        {workspaceView === 'requests' && (
        <section className="pwc-scheduler-section pwc-scheduler-inbox-section">
          <SectionHeading
            eyebrow="Booking Inbox"
            title="Care for each request in one place."
            description="Review the client’s preferred time and intake details, then move the request forward with a clear next step."
          />

          <div className="pwc-scheduler-inbox-layout">
            <section className="pwc-scheduler-panel pwc-scheduler-request-panel">
              <div className="pwc-scheduler-panel-header">
                <div>
                  <p className="eyebrow">Session requests</p>
                  <h3>{filteredBookings.length} in this view</h3>
                </div>
                <span>{bookings.length} total</span>
              </div>

              <div className="pwc-scheduler-toolbar">
                <label className="pwc-scheduler-search">
                  <span className="sr-only">Search session requests</span>
                  <input
                    type="search"
                    value={bookingSearch}
                    onChange={(event) => setBookingSearch(event.target.value)}
                    placeholder="Search by client or session"
                  />
                </label>

                <div className="pwc-scheduler-filter-row" aria-label="Filter session requests">
                  {bookingFilters.map((filter) => (
                    <button
                      className={bookingFilter === filter.value ? 'is-active' : ''}
                      type="button"
                      key={filter.value}
                      aria-pressed={bookingFilter === filter.value}
                      onClick={() => setBookingFilter(filter.value)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pwc-scheduler-request-list">
                {filteredBookings.map((booking) => (
                  <button
                    className={`pwc-scheduler-request-card ${selectedBooking?.id === booking.id ? 'is-selected' : ''}`}
                    type="button"
                    key={booking.id}
                    onClick={() => handleSelectBooking(booking)}
                  >
                    <span className="pwc-scheduler-avatar" aria-hidden="true">
                      {getInitials(booking.guest_name)}
                    </span>

                    <span className="pwc-scheduler-request-main">
                      <strong>{booking.guest_name || 'Guest'}</strong>
                      <small>{booking.appointment_type_name || 'Session request'}</small>
                      <small>{booking.guest_email || 'No email provided'}</small>
                    </span>

                    <span className="pwc-scheduler-request-meta">
                      <span>{formatDateTime(booking.starts_at)}</span>
                      <span className={`pwc-session-status-badge ${statusTone(booking.status)}`}>
                        {readableStatus(booking.status)}
                      </span>
                    </span>
                  </button>
                ))}

                {!status.loading && filteredBookings.length === 0 && (
                  <div className="pwc-scheduler-empty-state">
                    <strong>No requests match this view.</strong>
                    <p>Try another filter or clear the search field.</p>
                  </div>
                )}

                {status.loading && (
                  <div className="pwc-scheduler-empty-state">
                    <strong>Opening your booking inbox…</strong>
                    <p>Session requests will appear here.</p>
                  </div>
                )}
              </div>
            </section>

            <form className="pwc-scheduler-panel pwc-scheduler-review-panel" onSubmit={handleBookingStatusSubmit}>
              <div className="pwc-scheduler-panel-header pwc-scheduler-review-header">
                <div>
                  <p className="eyebrow">Request review</p>
                  <h3>{selectedBooking ? selectedBooking.guest_name : 'Select a request'}</h3>
                </div>
                {selectedBooking && (
                  <span className={`pwc-session-status-badge ${statusTone(selectedBooking.status)}`}>
                    {readableStatus(selectedBooking.status)}
                  </span>
                )}
              </div>

              {selectedBooking ? (
                <div className="pwc-scheduler-review-body">
                  <div className="pwc-scheduler-review-intro">
                    <p>{selectedBooking.appointment_type_name || 'Session request'}</p>
                    <strong>{formatDateTime(selectedBooking.starts_at)}</strong>
                  </div>

                  <div className="pwc-scheduler-detail-grid">
                    <article>
                      <span>Email</span>
                      <strong>{selectedBooking.guest_email || 'Not provided'}</strong>
                    </article>
                    <article>
                      <span>Phone</span>
                      <strong>{selectedBooking.guest_phone || 'Not provided'}</strong>
                    </article>
                    <article>
                      <span>Timezone</span>
                      <strong>{selectedBooking.timezone || 'Not provided'}</strong>
                    </article>
                    <article>
                      <span>Submitted</span>
                      <strong>{formatDateTime(selectedBooking.created_at)}</strong>
                    </article>
                  </div>

                  <section className="pwc-scheduler-intake">
                    <div>
                      <p className="eyebrow">Client context</p>
                      <h4>What they shared</h4>
                    </div>
                    <article>
                      <span>Support requested</span>
                      <p>{renderIntakeValue(selectedBooking.intake_answers?.reason)}</p>
                    </article>
                    <article>
                      <span>Preferred focus</span>
                      <p>{renderIntakeValue(selectedBooking.intake_answers?.preferredFocus)}</p>
                    </article>
                  </section>

                  <section className="pwc-scheduler-care-flow">
                    <div>
                      <p className="eyebrow">Quick actions</p>
                      <h4>Move the request forward</h4>
                    </div>
                    <div className="pwc-scheduler-care-actions">
                      {sessionCareActions.map((action) => (
                        <button
                          className={`pwc-scheduler-care-button ${action.tone}`}
                          type="button"
                          key={action.status}
                          onClick={() => handleCareAction(action)}
                          disabled={status.saving}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="pwc-scheduler-client-circle">
                    <div>
                      <p className="eyebrow">Client Circle</p>
                      <h4>{selectedBookingIsClient ? 'Client profile connected' : 'Welcome this person as a client'}</h4>
                      <p>
                        {selectedBookingIsClient
                          ? 'This request is connected to a private Client Circle profile.'
                          : 'Create a private client profile and connect this request to their care journey.'}
                      </p>
                    </div>
                    <div className="pwc-scheduler-client-circle-actions">
                      {selectedBookingIsClient && selectedBooking.client_profile_id ? (
                        <Link className="btn secondary" to={`/admin/client-360/${selectedBooking.client_profile_id}`}>
                          Open Client 360
                        </Link>
                      ) : (
                        <button
                          className="btn primary"
                          type="button"
                          onClick={handleWelcomeIntoClientCircle}
                          disabled={status.saving}
                        >
                          Welcome into Client Circle
                        </button>
                      )}
                    </div>
                  </section>

                  <section className="pwc-scheduler-notes-form">
                    <div className="pwc-scheduler-form-row">
                      <label>
                        <span>Current status</span>
                        <select name="status" value={bookingForm.status} onChange={handleBookingChange}>
                          <option value="requested">Requested</option>
                          <option value="approved">Approved</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="no_show">No show</option>
                        </select>
                      </label>
                    </div>

                    <label>
                      <span>Private Studio notes</span>
                      <textarea
                        name="adminNotes"
                        value={bookingForm.adminNotes}
                        onChange={handleBookingChange}
                        placeholder="Add context, preparation notes, or a private follow-up reminder."
                        rows="5"
                      />
                    </label>

                    <button className="btn primary" type="submit" disabled={status.saving}>
                      {status.saving ? 'Saving…' : 'Save request details'}
                    </button>
                  </section>
                </div>
              ) : (
                <div className="pwc-scheduler-empty-state is-detail">
                  <strong>Select a session request.</strong>
                  <p>Client details, intake answers, and care actions will appear here.</p>
                </div>
              )}
            </form>
          </div>
        </section>
        )}

        {workspaceView === 'types' && (
        <section className="pwc-scheduler-section">
          <SectionHeading
            eyebrow="Session Library"
            title="Define the ways clients can work with you."
            description="Keep every session type clear, current, and easy for clients to understand before they request time."
          />

          <div className="pwc-scheduler-management-layout">
            <form className="pwc-scheduler-panel pwc-scheduler-editor" onSubmit={handleTypeSubmit}>
              <div className="pwc-scheduler-panel-header">
                <div>
                  <p className="eyebrow">{selectedType ? 'Edit session' : 'New session'}</p>
                  <h3>{selectedType ? selectedType.name : 'Create a session type'}</h3>
                </div>
                <button className="pwc-scheduler-text-button" type="button" onClick={handleNewType}>
                  Start new
                </button>
              </div>

              <div className="pwc-scheduler-form-grid">
                <label className="span-2">
                  <span>Session name</span>
                  <input
                    name="name"
                    value={typeForm.name}
                    onChange={handleTypeChange}
                    placeholder="Personal Presence Consultation"
                    required
                  />
                </label>

                <label>
                  <span>Duration</span>
                  <div className="pwc-scheduler-input-suffix">
                    <input
                      name="durationMinutes"
                      type="number"
                      min="15"
                      max="480"
                      value={typeForm.durationMinutes}
                      onChange={handleTypeChange}
                      required
                    />
                    <small>minutes</small>
                  </div>
                </label>

                <label>
                  <span>Price</span>
                  <div className="pwc-scheduler-input-prefix">
                    <small>$</small>
                    <input
                      name="priceAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={typeForm.priceAmount}
                      onChange={handleTypeChange}
                    />
                  </div>
                </label>

                <label>
                  <span>Currency</span>
                  <input
                    name="currency"
                    value={typeForm.currency}
                    onChange={handleTypeChange}
                    maxLength="3"
                    required
                  />
                </label>

                <label>
                  <span>Preparation buffer</span>
                  <div className="pwc-scheduler-input-suffix">
                    <input
                      name="bufferBeforeMinutes"
                      type="number"
                      min="0"
                      max="180"
                      value={typeForm.bufferBeforeMinutes}
                      onChange={handleTypeChange}
                    />
                    <small>before</small>
                  </div>
                </label>

                <label>
                  <span>Reset buffer</span>
                  <div className="pwc-scheduler-input-suffix">
                    <input
                      name="bufferAfterMinutes"
                      type="number"
                      min="0"
                      max="180"
                      value={typeForm.bufferAfterMinutes}
                      onChange={handleTypeChange}
                    />
                    <small>after</small>
                  </div>
                </label>

                <label className="span-2">
                  <span>Client-facing description</span>
                  <textarea
                    name="description"
                    value={typeForm.description}
                    onChange={handleTypeChange}
                    placeholder="Describe who this session is for and what the client can expect."
                    rows="5"
                  />
                </label>

                <div className="pwc-scheduler-toggle-grid span-2">
                  <label className="pwc-scheduler-toggle">
                    <input
                      name="requiresApproval"
                      type="checkbox"
                      checked={typeForm.requiresApproval}
                      onChange={handleTypeChange}
                    />
                    <span>
                      <strong>Studio review</strong>
                      <small>Approve each request before confirming it.</small>
                    </span>
                  </label>

                  <label className="pwc-scheduler-toggle">
                    <input
                      name="isActive"
                      type="checkbox"
                      checked={typeForm.isActive}
                      onChange={handleTypeChange}
                    />
                    <span>
                      <strong>Open for requests</strong>
                      <small>Show this session on the booking page.</small>
                    </span>
                  </label>
                </div>
              </div>

              <div className="pwc-scheduler-form-actions">
                <button className="btn primary" type="submit" disabled={status.saving}>
                  {status.saving ? 'Saving…' : selectedType ? 'Save session type' : 'Create session type'}
                </button>
              </div>
            </form>

            <section className="pwc-scheduler-panel pwc-scheduler-directory">
              <div className="pwc-scheduler-panel-header">
                <div>
                  <p className="eyebrow">Session types</p>
                  <h3>{appointmentTypes.length} available to manage</h3>
                </div>
                <span>{appointmentTypes.filter((item) => item.is_active).length} open</span>
              </div>

              <label className="pwc-scheduler-search is-contained">
                <span className="sr-only">Search session types</span>
                <input
                  type="search"
                  value={typeSearch}
                  onChange={(event) => setTypeSearch(event.target.value)}
                  placeholder="Search session types"
                />
              </label>

              <div className="pwc-scheduler-directory-list">
                {filteredAppointmentTypes.map((appointmentType) => (
                  <button
                    className={`pwc-scheduler-directory-card ${selectedType?.id === appointmentType.id ? 'is-selected' : ''}`}
                    type="button"
                    key={appointmentType.id}
                    onClick={() => handleSelectType(appointmentType)}
                  >
                    <span className="pwc-scheduler-directory-card-main">
                      <strong>{appointmentType.name}</strong>
                      <small>{appointmentType.description || 'No description added yet.'}</small>
                    </span>
                    <span className="pwc-scheduler-directory-card-meta">
                      <span>{appointmentType.duration_minutes} min</span>
                      <span>{centsToDisplay(appointmentType.price_cents, appointmentType.currency)}</span>
                      <span className={appointmentType.is_active ? 'is-open' : 'is-closed'}>
                        {appointmentType.is_active ? 'Open' : 'Hidden'}
                      </span>
                    </span>
                  </button>
                ))}

                {!status.loading && filteredAppointmentTypes.length === 0 && (
                  <div className="pwc-scheduler-empty-state">
                    <strong>No session types found.</strong>
                    <p>Create a new type or adjust your search.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
        )}

        {workspaceView === 'availability' && (
        <section className="pwc-scheduler-section">
          <SectionHeading
            eyebrow="Open Windows"
            title="Choose when clients may request time."
            description="Set a recurring weekly rhythm or add a one-time date when your availability changes."
          />

          <div className="pwc-scheduler-management-layout">
            <form className="pwc-scheduler-panel pwc-scheduler-editor" onSubmit={handleAvailabilitySubmit}>
              <div className="pwc-scheduler-panel-header">
                <div>
                  <p className="eyebrow">{selectedAvailability ? 'Edit window' : 'New window'}</p>
                  <h3>{selectedAvailability ? formatAvailabilityLabel(selectedAvailability) : 'Create an open window'}</h3>
                </div>
                <button className="pwc-scheduler-text-button" type="button" onClick={handleNewAvailability}>
                  Start new
                </button>
              </div>

              <div className="pwc-scheduler-form-grid">
                <label>
                  <span>Weekly day</span>
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
                  <small className="pwc-scheduler-field-help">Used when no one-time date is selected.</small>
                </label>

                <label>
                  <span>One-time date</span>
                  <input
                    name="specificDate"
                    type="date"
                    value={availabilityForm.specificDate}
                    onChange={handleAvailabilityChange}
                  />
                  <small className="pwc-scheduler-field-help">Overrides the weekly day for this window.</small>
                </label>

                <label>
                  <span>Start time</span>
                  <input
                    name="startTime"
                    type="time"
                    value={availabilityForm.startTime}
                    onChange={handleAvailabilityChange}
                    required
                  />
                </label>

                <label>
                  <span>End time</span>
                  <input
                    name="endTime"
                    type="time"
                    value={availabilityForm.endTime}
                    onChange={handleAvailabilityChange}
                    required
                  />
                </label>

                <label className="span-2">
                  <span>Timezone</span>
                  <input
                    name="timezone"
                    value={availabilityForm.timezone}
                    onChange={handleAvailabilityChange}
                    placeholder="America/New_York"
                    list="pwc-scheduler-timezones"
                    required
                  />
                  <datalist id="pwc-scheduler-timezones">
                    <option value="America/New_York" />
                    <option value="America/Chicago" />
                    <option value="America/Denver" />
                    <option value="America/Los_Angeles" />
                    <option value="Asia/Manila" />
                  </datalist>
                </label>

                <label className="span-2">
                  <span>Private note</span>
                  <textarea
                    name="notes"
                    value={availabilityForm.notes}
                    onChange={handleAvailabilityChange}
                    placeholder="Example: Reserved for private consultations."
                    rows="4"
                  />
                </label>

                <div className="pwc-scheduler-toggle-grid span-2 is-single">
                  <label className="pwc-scheduler-toggle">
                    <input
                      name="isActive"
                      type="checkbox"
                      checked={availabilityForm.isActive}
                      onChange={handleAvailabilityChange}
                    />
                    <span>
                      <strong>Window is active</strong>
                      <small>Clients may request time inside this window.</small>
                    </span>
                  </label>
                </div>
              </div>

              <div className="pwc-scheduler-form-actions">
                <button className="btn primary" type="submit" disabled={status.saving}>
                  {status.saving ? 'Saving…' : selectedAvailability ? 'Save open window' : 'Create open window'}
                </button>
              </div>
            </form>

            <section className="pwc-scheduler-panel pwc-scheduler-directory">
              <div className="pwc-scheduler-panel-header">
                <div>
                  <p className="eyebrow">Availability</p>
                  <h3>{availabilityBlocks.length} windows to manage</h3>
                </div>
                <span>{bookingStats.activeWindows} active</span>
              </div>

              <label className="pwc-scheduler-search is-contained">
                <span className="sr-only">Search availability windows</span>
                <input
                  type="search"
                  value={availabilitySearch}
                  onChange={(event) => setAvailabilitySearch(event.target.value)}
                  placeholder="Search day, timezone, or note"
                />
              </label>

              <div className="pwc-scheduler-directory-list">
                {filteredAvailability.map((block) => (
                  <button
                    className={`pwc-scheduler-directory-card pwc-scheduler-window-card ${selectedAvailability?.id === block.id ? 'is-selected' : ''}`}
                    type="button"
                    key={block.id}
                    onClick={() => handleSelectAvailability(block)}
                  >
                    <span className="pwc-scheduler-window-date" aria-hidden="true">
                      <strong>{block.specific_date ? formatDateOnly(block.specific_date).split(' ')[1]?.replace(',', '') : formatAvailabilityLabel(block).slice(0, 3)}</strong>
                      <small>{block.specific_date ? formatDateOnly(block.specific_date).split(' ')[0] : 'Every'}</small>
                    </span>
                    <span className="pwc-scheduler-directory-card-main">
                      <strong>{formatAvailabilityLabel(block)}</strong>
                      <small>{formatAvailabilityType(block)}</small>
                      {block.notes && <small>{block.notes}</small>}
                    </span>
                    <span className="pwc-scheduler-directory-card-meta">
                      <span>{formatTime(block.start_time)}–{formatTime(block.end_time)}</span>
                      <span>{block.timezone}</span>
                      <span className={block.is_active ? 'is-open' : 'is-closed'}>
                        {block.is_active ? 'Active' : 'Paused'}
                      </span>
                    </span>
                  </button>
                ))}

                {!status.loading && filteredAvailability.length === 0 && (
                  <div className="pwc-scheduler-empty-state">
                    <strong>No availability windows found.</strong>
                    <p>Create a new window or adjust your search.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
        )}
      </main>
    </AdminFrame>
  )
}

export default AdminScheduler
