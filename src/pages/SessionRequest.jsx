import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createPublicBookingRequest,
  getPublicAppointmentTypes,
  getPublicAvailabilitySlots,
} from '../lib/nativeApi'

const FOUNDER_TIME_ZONE = 'America/New_York'

function getBusinessDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FOUNDER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)

  const values = Object.fromEntries(
    parts
      .filter((part) => ['year', 'month', 'day'].includes(part.type))
      .map((part) => [part.type, part.value]),
  )

  return `${values.year}-${values.month}-${values.day}`
}

function dateValueFromDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function getDateStringOffset(offsetDays = 0) {
  const [year, month, day] = getBusinessDateKey().split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return dateValueFromDate(date)
}

function addDays(dateValue, days) {
  const [year, month, day] = String(dateValue).slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return dateValueFromDate(date)
}

function addMonthsToDateValue(dateValue, offsetMonths) {
  const [year, month] = dateValue.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + offsetMonths, 1))
  return dateValueFromDate(date)
}

function isPastDateValue(dateValue) {
  return dateValue < getDateStringOffset(0)
}

function formatDateTile(dateValue) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${dateValue}T12:00:00Z`))
  } catch {
    return dateValue
  }
}

function formatFullDate(dateValue) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${dateValue}T12:00:00Z`))
  } catch {
    return dateValue
  }
}

function formatMonthLabel(dateValue) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${dateValue.slice(0, 7)}-01T12:00:00Z`))
  } catch {
    return 'Choose a date'
  }
}

function formatTimeLabel(timeValue) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(`2026-01-01T${timeValue}:00Z`))
  } catch {
    return timeValue
  }
}

function getCalendarDayNumber(dateValue) {
  return Number(dateValue.slice(-2))
}

function getAppointmentId(appointmentType) {
  return appointmentType?.id || appointmentType?.appointment_type_id || ''
}

function getAppointmentName(appointmentType) {
  return (
    appointmentType?.name ||
    appointmentType?.title ||
    appointmentType?.service_name ||
    'Private Appointment'
  )
}

function getAppointmentDuration(appointmentType) {
  return (
    Number(
      appointmentType?.duration_minutes ||
        appointmentType?.durationMinutes ||
        appointmentType?.duration ||
        60,
    ) || 60
  )
}

function getAppointmentPrice(appointmentType) {
  const price =
    appointmentType?.price_label ||
    appointmentType?.priceLabel ||
    appointmentType?.price ||
    appointmentType?.investment

  return price ? String(price) : ''
}

function normalizeAppointmentRows(response) {
  if (Array.isArray(response)) return response

  return (
    response?.appointmentTypes ||
    response?.appointment_types ||
    response?.items ||
    []
  )
}

function buildCalendarDays({
  monthDateValue,
  selectedDateValue,
  availabilityByDate,
}) {
  const [year, month] = monthDateValue.slice(0, 7).split('-').map(Number)
  const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1))
  const calendarStart = new Date(firstDayOfMonth)
  calendarStart.setUTCDate(firstDayOfMonth.getUTCDate() - firstDayOfMonth.getUTCDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart)
    date.setUTCDate(calendarStart.getUTCDate() + index)

    const dateValue = dateValueFromDate(date)
    const dayAvailability = availabilityByDate.get(dateValue)
    const isPast = isPastDateValue(dateValue)
    const isUnavailable = !dayAvailability?.isAvailable

    return {
      dateValue,
      dayNumber: getCalendarDayNumber(dateValue),
      isCurrentMonth: date.getUTCMonth() === month - 1,
      isSelected: dateValue === selectedDateValue,
      isToday: dateValue === getDateStringOffset(0),
      isUnavailable,
      isPast,
      isDisabled: isUnavailable || isPast,
      availabilitySource: dayAvailability?.source || null,
    }
  })
}

export default function SessionRequest() {
  const [appointmentTypes, setAppointmentTypes] = useState([])
  const [availabilityDays, setAvailabilityDays] = useState([])
  const [availabilityTimezone, setAvailabilityTimezone] = useState(FOUNDER_TIME_ZONE)
  const [calendarMonthValue, setCalendarMonthValue] = useState(
    getDateStringOffset(1),
  )
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true)
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmission, setLastSubmission] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    appointmentTypeId: '',
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    preferredDate: getDateStringOffset(1),
    preferredTime: '',
    message: '',
  })

  const isLoading = isLoadingAppointments || isLoadingAvailability

  const selectedAppointment = useMemo(
    () =>
      appointmentTypes.find(
        (appointmentType) =>
          String(getAppointmentId(appointmentType)) ===
          String(form.appointmentTypeId),
      ) || null,
    [appointmentTypes, form.appointmentTypeId],
  )

  const selectedDurationMinutes = useMemo(
    () => getAppointmentDuration(selectedAppointment),
    [selectedAppointment],
  )

  const availabilityByDate = useMemo(
    () => new Map(availabilityDays.map((day) => [day.date, day])),
    [availabilityDays],
  )

  const selectedDayAvailability = availabilityByDate.get(form.preferredDate) || null
  const selectedSlot =
    selectedDayAvailability?.slots?.find((slot) => slot.time === form.preferredTime) ||
    null
  const selectedDateConflict =
    !isLoadingAvailability &&
    availabilityDays.length > 0 &&
    !selectedDayAvailability?.isAvailable
  const selectedTimeConflict =
    Boolean(selectedDayAvailability?.isAvailable) &&
    Boolean(form.preferredTime) &&
    !selectedSlot
  const selectedBookingConflict = null

  const dateTiles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => {
        const dateValue = getDateStringOffset(index + 1)
        const dayAvailability = availabilityByDate.get(dateValue)

        return {
          dateValue,
          conflict: !dayAvailability?.isAvailable,
          isSelected: dateValue === form.preferredDate,
        }
      }),
    [availabilityByDate, form.preferredDate],
  )

  const calendarDays = useMemo(
    () =>
      buildCalendarDays({
        monthDateValue: calendarMonthValue,
        selectedDateValue: form.preferredDate,
        availabilityByDate,
      }),
    [availabilityByDate, calendarMonthValue, form.preferredDate],
  )

  const timeOptions = useMemo(
    () =>
      (selectedDayAvailability?.slots || []).map((slot) => ({
        value: slot.time,
        label: formatTimeLabel(slot.time),
        isSelected: slot.time === form.preferredTime,
        isUnavailable: false,
      })),
    [form.preferredTime, selectedDayAvailability?.slots],
  )

  useEffect(() => {
    let isMounted = true

    async function loadAppointmentTypes() {
      setIsLoadingAppointments(true)
      setError('')

      try {
        const response = await getPublicAppointmentTypes()
        if (!isMounted) return
        const rows = normalizeAppointmentRows(response)
        setAppointmentTypes(rows)

        if (rows.length > 0) {
          setForm((current) => ({
            ...current,
            appointmentTypeId:
              current.appointmentTypeId || getAppointmentId(rows[0]),
          }))
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError.message ||
              'We could not load appointment availability right now.',
          )
        }
      } finally {
        if (isMounted) setIsLoadingAppointments(false)
      }
    }

    loadAppointmentTypes()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!form.appointmentTypeId) return undefined
    let isMounted = true

    async function loadAvailability() {
      setIsLoadingAvailability(true)
      setError('')

      try {
        const startDate = getDateStringOffset(0)
        const endDate = addDays(startDate, 180)
        const response = await getPublicAvailabilitySlots(
          form.appointmentTypeId,
          startDate,
          endDate,
        )

        if (!isMounted) return
        const days = response.days || []
        setAvailabilityDays(days)
        setAvailabilityTimezone(response.timezone || FOUNDER_TIME_ZONE)

        setForm((current) => {
          const currentDay = days.find((day) => day.date === current.preferredDate)
          const currentSlot = currentDay?.slots?.find(
            (slot) => slot.time === current.preferredTime,
          )

          if (currentSlot) return current

          const firstAvailableDay =
            (currentDay?.slots?.length ? currentDay : null) ||
            days.find((day) => day.slots?.length > 0)
          const firstSlot = firstAvailableDay?.slots?.[0]

          if (!firstAvailableDay || !firstSlot) {
            return { ...current, preferredTime: '' }
          }

          setCalendarMonthValue(firstAvailableDay.date)
          return {
            ...current,
            preferredDate: firstAvailableDay.date,
            preferredTime: firstSlot.time,
          }
        })
      } catch (loadError) {
        if (isMounted) {
          setAvailabilityDays([])
          setError(
            loadError.message ||
              'We could not load appointment availability right now.',
          )
        }
      } finally {
        if (isMounted) setIsLoadingAvailability(false)
      }
    }

    loadAvailability()

    return () => {
      isMounted = false
    }
  }, [form.appointmentTypeId])

  function updateField(field, value) {
    setNotice('')
    setError('')
    setLastSubmission(null)
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function resetBookingExperience() {
    setNotice('')
    setError('')
    setLastSubmission(null)
    setForm((current) => ({
      ...current,
      guestName: '',
      guestEmail: '',
      guestPhone: '',
      message: '',
    }))
  }

  function selectPreferredDate(dateValue) {
    const day = availabilityByDate.get(dateValue)
    const firstSlot = day?.slots?.[0]
    if (!firstSlot) return

    setCalendarMonthValue(dateValue)
    setNotice('')
    setError('')
    setLastSubmission(null)
    setForm((current) => ({
      ...current,
      preferredDate: dateValue,
      preferredTime: firstSlot.time,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setNotice('')
    setError('')

    if (!form.guestName.trim()) {
      setError('Please add your name.')
      return
    }

    if (!form.guestEmail.trim()) {
      setError('Please add your email address.')
      return
    }

    if (!form.preferredDate || !form.preferredTime || !selectedSlot) {
      setError('Please choose an available date and time.')
      return
    }

    if (appointmentTypes.length > 0 && !form.appointmentTypeId) {
      setError('Please choose an appointment type.')
      return
    }

    setIsSubmitting(true)

    try {
      const submissionResponse = await createPublicBookingRequest({
        appointmentTypeId: form.appointmentTypeId,
        appointment_type_id: form.appointmentTypeId,
        guestName: form.guestName.trim(),
        guest_name: form.guestName.trim(),
        guestEmail: form.guestEmail.trim(),
        guest_email: form.guestEmail.trim(),
        guestPhone: form.guestPhone.trim(),
        guest_phone: form.guestPhone.trim(),
        startsAt: selectedSlot.startsAt,
        starts_at: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt,
        ends_at: selectedSlot.endsAt,
        timezone: availabilityTimezone,
        intakeAnswers: {
          message: form.message.trim(),
          preferredDate: form.preferredDate,
          preferredTime: form.preferredTime,
        },
        intake_answers: {
          message: form.message.trim(),
          preferredDate: form.preferredDate,
          preferredTime: form.preferredTime,
        },
      })

      setLastSubmission({
        response: submissionResponse,
        appointmentName: getAppointmentName(selectedAppointment),
        durationMinutes: selectedDurationMinutes,
        preferredDate: form.preferredDate,
        preferredTime: form.preferredTime,
        guestName: form.guestName.trim(),
        guestEmail: form.guestEmail.trim(),
      })

      setNotice(
        'Your request has been received. The Power Within team will follow up with your next step.',
      )

      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (submitError) {
      setError(
        submitError.message ||
          'We could not submit your request. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (lastSubmission) {
    return (
      <main className="session-request-native-page-v2">
        <section className="session-request-native-success-v2">
          <p>Request Received</p>
          <h1>Your appointment request has been sent.</h1>
          <span>
            Thank you, {lastSubmission.guestName}. The Power Within team will
            review your preferred time and follow up with your next step.
          </span>

          <div className="session-request-native-success-card-v2">
            <div>
              <small>Appointment</small>
              <strong>{lastSubmission.appointmentName}</strong>
            </div>

            <div>
              <small>Preferred Date</small>
              <strong>{formatFullDate(lastSubmission.preferredDate)}</strong>
            </div>

            <div>
              <small>Preferred Time</small>
              <strong>{formatTimeLabel(lastSubmission.preferredTime)}</strong>
            </div>

            <div>
              <small>Confirmation</small>
              <strong>Sent to {lastSubmission.guestEmail}</strong>
            </div>
          </div>

          <div className="session-request-native-success-next-v2">
            <div>
              <strong>01</strong>
              <span>The team reviews your request.</span>
            </div>

            <div>
              <strong>02</strong>
              <span>Kim availability is checked with care.</span>
            </div>

            <div>
              <strong>03</strong>
              <span>You receive a thoughtful follow-up with your next step.</span>
            </div>
          </div>

          <div className="session-request-native-success-actions-v2">
            <button type="button" onClick={resetBookingExperience}>
              Request Another Appointment
            </button>

            <Link to="/">Return Home</Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="session-request-native-page-v2">
      <section className="session-request-native-hero-v2">
        <p>Private Appointment Request</p>
        <h1>Begin with the right kind of support.</h1>
        <span>
          Choose a preferred time for a private session, consultation, or
          appointment. Unavailable dates are protected from Kim Founders View.
        </span>
      </section>

      <section className="session-request-native-shell-v2">
        <form className="session-request-native-form-v2" onSubmit={handleSubmit}>
          <div className="session-request-native-form-heading-v2">
            <p>Request a Session</p>
            <h2>Your preferred appointment</h2>
          </div>

          {notice && (
            <div className="session-request-native-alert-v2 is-success">
              {notice}
            </div>
          )}

          {error && (
            <div className="session-request-native-alert-v2 is-error">
              {error}
            </div>
          )}

          <label>
            <span>Appointment Type</span>
            <select
              value={form.appointmentTypeId}
              onChange={(event) =>
                updateField('appointmentTypeId', event.target.value)
              }
              disabled={isLoading || appointmentTypes.length === 0}
            >
              {appointmentTypes.length === 0 ? (
                <option value="">Loading appointment options...</option>
              ) : (
                appointmentTypes.map((appointmentType) => (
                  <option
                    key={getAppointmentId(appointmentType)}
                    value={getAppointmentId(appointmentType)}
                  >
                    {getAppointmentName(appointmentType)}
                  </option>
                ))
              )}
            </select>
          </label>

          {selectedAppointment && (
            <div className="session-request-native-selected-v2">
              <strong>{getAppointmentName(selectedAppointment)}</strong>
              <span>
                {selectedDurationMinutes} minutes
                {getAppointmentPrice(selectedAppointment)
                  ? ` - ${getAppointmentPrice(selectedAppointment)}`
                  : ''}
              </span>
            </div>
          )}

          <section className="session-request-native-quick-dates-v4">
            <div>
              <p>Quick Dates</p>
              <span>Choose one of the next available days.</span>
            </div>

            <div className="session-request-native-date-strip-v2">
              {dateTiles.map((tile) => (
                <button
                  key={tile.dateValue}
                  type="button"
                  className={[
                    tile.isSelected ? 'is-selected' : '',
                    tile.conflict ? 'is-unavailable' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    if (!tile.conflict) {
                      selectPreferredDate(tile.dateValue)
                    }
                  }}
                  disabled={Boolean(tile.conflict)}
                >
                  <span>{formatDateTile(tile.dateValue)}</span>
                  <small>{tile.conflict ? 'Unavailable' : 'Available'}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="session-request-native-picker-grid-v4">
            <div className="session-request-native-calendar-v4">
              <div className="session-request-native-calendar-head-v4">
                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonthValue((current) =>
                      addMonthsToDateValue(current, -1),
                    )
                  }
                >
                  Previous
                </button>

                <strong>{formatMonthLabel(calendarMonthValue)}</strong>

                <button
                  type="button"
                  onClick={() =>
                    setCalendarMonthValue((current) =>
                      addMonthsToDateValue(current, 1),
                    )
                  }
                >
                  Next
                </button>
              </div>

              <div className="session-request-native-weekdays-v4">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              <div className="session-request-native-calendar-grid-v4">
                {calendarDays.map((day) => (
                  <button
                    key={day.dateValue}
                    type="button"
                    disabled={day.isDisabled}
                    className={[
                      day.isSelected ? 'is-selected' : '',
                      day.isToday ? 'is-today' : '',
                      day.isCurrentMonth ? 'is-current-month' : 'is-muted',
                      day.isUnavailable ? 'is-unavailable' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => selectPreferredDate(day.dateValue)}
                  >
                    <span>{day.dayNumber}</span>
                    {day.isUnavailable && <small>Unavailable</small>}
                    {!day.isUnavailable && day.availabilitySource === 'custom' && <small>Special hours</small>}
                    {!day.isUnavailable && day.isToday && <small>Today</small>}
                  </button>
                ))}
              </div>
            </div>

            <div className="session-request-native-time-v4">
              <div>
                <p>Preferred Time</p>
                <strong>{formatFullDate(form.preferredDate)}</strong>
              </div>

              <div className="session-request-native-time-grid-v4">
                {timeOptions.length === 0 && (
                  <div className="session-request-native-alert-v2 is-warning">
                    No appointment times are open on this date.
                  </div>
                )}
                {timeOptions.map((timeOption) => (
                  <button
                    key={timeOption.value}
                    type="button"
                    disabled={timeOption.isUnavailable}
                    className={timeOption.isSelected ? 'is-selected' : ''}
                    onClick={() =>
                      updateField('preferredTime', timeOption.value)
                    }
                  >
                    <span>{timeOption.label}</span>
                    {timeOption.isUnavailable && <small>Unavailable</small>}
                  </button>
                ))}
              </div>

              <p className="session-request-native-time-note-v4">
                Times are shown in Eastern Time. The team will confirm your final
                appointment details.
              </p>
            </div>
          </section>

          {(selectedDateConflict || selectedTimeConflict) && (
            <div className="session-request-native-alert-v2 is-warning">
              Kim is unavailable on {formatFullDate(form.preferredDate)}. Please
              choose another date or time.
            </div>
          )}

          {selectedBookingConflict && (
            <div className="session-request-native-alert-v2 is-warning">
              This time is already requested or booked. Please choose another
              available time.
            </div>
          )}

          <div className="session-request-native-grid-v2">
            <label>
              <span>Your Name</span>
              <input
                value={form.guestName}
                onChange={(event) => updateField('guestName', event.target.value)}
                placeholder="Full name"
              />
            </label>

            <label>
              <span>Email Address</span>
              <input
                type="email"
                value={form.guestEmail}
                onChange={(event) =>
                  updateField('guestEmail', event.target.value)
                }
                placeholder="you@email.com"
              />
            </label>
          </div>

          <label>
            <span>Phone Number</span>
            <input
              value={form.guestPhone}
              onChange={(event) => updateField('guestPhone', event.target.value)}
              placeholder="Optional"
            />
          </label>

          <label>
            <span>What would you like support with?</span>
            <textarea
              value={form.message}
              onChange={(event) => updateField('message', event.target.value)}
              placeholder="Share anything helpful for the team before your appointment."
              rows={5}
            />
          </label>

          <button
            type="submit"
            disabled={
              isSubmitting ||
              isLoading ||
              !selectedSlot ||
              Boolean(
                selectedDateConflict ||
                  selectedTimeConflict ||
                  selectedBookingConflict,
              )
            }
          >
            {isSubmitting ? 'Sending Request...' : 'Request Appointment'}
          </button>
        </form>

        <aside className="session-request-native-side-v2">
          <p>What happens next</p>
          <h2>Simple, private, and guided.</h2>

          <div>
            <strong>01</strong>
            <span>You send your preferred appointment request.</span>
          </div>

          <div>
            <strong>02</strong>
            <span>The team reviews availability and confirms the best next step.</span>
          </div>

          <div>
            <strong>03</strong>
            <span>You receive a thoughtful follow-up with details for your session.</span>
          </div>

          <small>
            The calendar reflects Kim’s weekly hours, custom date availability,
            protected time, and already requested sessions.
          </small>
        </aside>
      </section>
    </main>
  )
}