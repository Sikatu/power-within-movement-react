import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createPublicBookingRequest,
  getPublicAppointmentTypes,
  getPublicAvailabilityExceptions,
  getPublicBookedTimes,
} from '../lib/nativeApi'

function dateValueFromDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getDateStringOffset(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)

  return dateValueFromDate(date)
}

function buildLocalDateTime(dateValue, timeValue = '10:00') {
  return new Date(`${dateValue}T${timeValue}:00`)
}

function addDays(dateValue, days) {
  const date = new Date(dateValue)
  date.setDate(date.getDate() + days)
  return date
}

function addMonthsToDateValue(dateValue, offsetMonths) {
  const date = new Date(`${dateValue}T12:00:00`)
  date.setMonth(date.getMonth() + offsetMonths)
  date.setDate(1)

  return dateValueFromDate(date)
}

function isPastDateValue(dateValue) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const date = new Date(`${dateValue}T00:00:00`)

  return date < today
}

function formatDateTile(dateValue) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date(`${dateValue}T12:00:00`))
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
    }).format(new Date(`${dateValue}T12:00:00`))
  } catch {
    return dateValue
  }
}

function formatMonthLabel(dateValue) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${dateValue}T12:00:00`))
  } catch {
    return 'Choose a date'
  }
}

function formatTimeLabel(timeValue) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(`2026-01-01T${timeValue}:00`))
  } catch {
    return timeValue
  }
}

function getCalendarDayNumber(dateValue) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
    }).format(new Date(`${dateValue}T12:00:00`))
  } catch {
    return dateValue.slice(-2)
  }
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

function normalizeAvailabilityRows(response) {
  if (Array.isArray(response)) return response

  return (
    response?.availabilityExceptions ||
    response?.availability_exceptions ||
    response?.items ||
    []
  )
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

function normalizeBookingRows(response) {
  if (Array.isArray(response)) return response

  return response?.bookedTimes || response?.booked_times || response?.items || []
}

function findDateConflict(dateValue, availabilityExceptions) {
  if (!dateValue) return null

  const dayStart = new Date(`${dateValue}T00:00:00`)
  const dayEnd = new Date(`${dateValue}T23:59:59`)

  return (
    availabilityExceptions.find((exception) => {
      const startsAt = new Date(exception.starts_at || exception.startsAt)
      const endsAt = new Date(exception.ends_at || exception.endsAt)

      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        return false
      }

      return startsAt <= dayEnd && endsAt >= dayStart
    }) || null
  )
}

function findTimeConflict({
  dateValue,
  timeValue,
  durationMinutes,
  availabilityExceptions,
}) {
  if (!dateValue || !timeValue) return null

  const startsAt = buildLocalDateTime(dateValue, timeValue)

  if (Number.isNaN(startsAt.getTime())) return null

  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000)

  return (
    availabilityExceptions.find((exception) => {
      const blockStart = new Date(exception.starts_at || exception.startsAt)
      const blockEnd = new Date(exception.ends_at || exception.endsAt)

      if (
        Number.isNaN(blockStart.getTime()) ||
        Number.isNaN(blockEnd.getTime())
      ) {
        return false
      }

      return startsAt < blockEnd && endsAt > blockStart
    }) || null
  )
}

function findBookingConflict({
  dateValue,
  timeValue,
  durationMinutes,
  bookedTimes,
}) {
  if (!dateValue || !timeValue) return null

  const startsAt = buildLocalDateTime(dateValue, timeValue)

  if (Number.isNaN(startsAt.getTime())) return null

  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000)

  return (
    bookedTimes.find((booking) => {
      const bookingStart = new Date(booking.starts_at || booking.startsAt)
      const bookingEnd = new Date(booking.ends_at || booking.endsAt)

      if (
        Number.isNaN(bookingStart.getTime()) ||
        Number.isNaN(bookingEnd.getTime())
      ) {
        return false
      }

      return startsAt < bookingEnd && endsAt > bookingStart
    }) || null
  )
}

function buildCalendarDays({
  monthDateValue,
  selectedDateValue,
  availabilityExceptions,
}) {
  const monthDate = new Date(`${monthDateValue}T12:00:00`)
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const calendarStart = new Date(firstDayOfMonth)
  calendarStart.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart)
    date.setDate(calendarStart.getDate() + index)

    const dateValue = dateValueFromDate(date)
    const conflict = findDateConflict(dateValue, availabilityExceptions)
    const isPast = isPastDateValue(dateValue)

    return {
      dateValue,
      dayNumber: getCalendarDayNumber(dateValue),
      isCurrentMonth: date.getMonth() === month,
      isSelected: dateValue === selectedDateValue,
      isToday: dateValue === getDateStringOffset(0),
      isUnavailable: Boolean(conflict),
      isPast,
      isDisabled: Boolean(conflict) || isPast,
    }
  })
}

export default function SessionRequest() {
  const [appointmentTypes, setAppointmentTypes] = useState([])
  const [availabilityExceptions, setAvailabilityExceptions] = useState([])
  const [bookedTimes, setBookedTimes] = useState([])
  const [calendarMonthValue, setCalendarMonthValue] = useState(
    getDateStringOffset(1),
  )
  const [isLoading, setIsLoading] = useState(true)
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
    preferredTime: '10:00',
    message: '',
  })

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

  const selectedDateConflict = useMemo(
    () => findDateConflict(form.preferredDate, availabilityExceptions),
    [availabilityExceptions, form.preferredDate],
  )

  const selectedTimeConflict = useMemo(
    () =>
      findTimeConflict({
        dateValue: form.preferredDate,
        timeValue: form.preferredTime,
        durationMinutes: selectedDurationMinutes,
        availabilityExceptions,
      }),
    [
      availabilityExceptions,
      form.preferredDate,
      form.preferredTime,
      selectedDurationMinutes,
    ],
  )

  const selectedBookingConflict = useMemo(
    () =>
      findBookingConflict({
        dateValue: form.preferredDate,
        timeValue: form.preferredTime,
        durationMinutes: selectedDurationMinutes,
        bookedTimes,
      }),
    [
      bookedTimes,
      form.preferredDate,
      form.preferredTime,
      selectedDurationMinutes,
    ],
  )

  const dateTiles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => {
        const dateValue = getDateStringOffset(index + 1)
        const conflict = findDateConflict(dateValue, availabilityExceptions)

        return {
          dateValue,
          conflict,
          isSelected: dateValue === form.preferredDate,
        }
      }),
    [availabilityExceptions, form.preferredDate],
  )

  const calendarDays = useMemo(
    () =>
      buildCalendarDays({
        monthDateValue: calendarMonthValue,
        selectedDateValue: form.preferredDate,
        availabilityExceptions,
      }),
    [availabilityExceptions, calendarMonthValue, form.preferredDate],
  )

  const timeOptions = useMemo(() => {
    const slots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00']

    return slots.map((slot) => {
      const conflict = findTimeConflict({
        dateValue: form.preferredDate,
        timeValue: slot,
        durationMinutes: selectedDurationMinutes,
        availabilityExceptions,
      })

      return {
        value: slot,
        label: formatTimeLabel(slot),
        isSelected: slot === form.preferredTime,
        isUnavailable: Boolean(
          conflict ||
            selectedDateConflict ||
            findBookingConflict({
              dateValue: form.preferredDate,
              timeValue: slot,
              durationMinutes: selectedDurationMinutes,
              bookedTimes,
            }),
        ),
      }
    })
  }, [
    availabilityExceptions,
    bookedTimes,
    form.preferredDate,
    form.preferredTime,
    selectedDateConflict,
    selectedDurationMinutes,
  ])

  useEffect(() => {
    let isMounted = true

    async function loadBookingData() {
      setIsLoading(true)
      setError('')

      try {
        const [appointmentResponse, availabilityResponse, bookedTimesResponse] =
          await Promise.all([
            getPublicAppointmentTypes(),
            getPublicAvailabilityExceptions(
              getDateStringOffset(0),
              addDays(new Date(), 120).toISOString(),
            ),
            getPublicBookedTimes(
              getDateStringOffset(0),
              addDays(new Date(), 120).toISOString(),
            ),
          ])

        if (!isMounted) return

        const appointmentRows = normalizeAppointmentRows(appointmentResponse)
        const availabilityRows = normalizeAvailabilityRows(availabilityResponse)
        const bookedTimeRows = normalizeBookingRows(bookedTimesResponse)

        setAppointmentTypes(appointmentRows)
        setAvailabilityExceptions(availabilityRows)
        setBookedTimes(bookedTimeRows)

        if (appointmentRows.length > 0) {
          setForm((current) => ({
            ...current,
            appointmentTypeId:
              current.appointmentTypeId || getAppointmentId(appointmentRows[0]),
          }))
        }
      } catch (loadError) {
        if (!isMounted) return

        setError(
          loadError.message ||
            'We could not load appointment availability right now.',
        )
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadBookingData()

    return () => {
      isMounted = false
    }
  }, [])

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
    setCalendarMonthValue(dateValue)
    updateField('preferredDate', dateValue)
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

    if (!form.preferredDate || !form.preferredTime) {
      setError('Please choose your preferred date and time.')
      return
    }

    if (appointmentTypes.length > 0 && !form.appointmentTypeId) {
      setError('Please choose an appointment type.')
      return
    }

    if (selectedDateConflict || selectedTimeConflict) {
      setError(
        'Kim is unavailable during this date or time. Please choose another available option.',
      )
      return
    }

    if (selectedBookingConflict) {
      setError(
        'This time is already requested or booked. Please choose another available time.',
      )
      return
    }

    const startsAt = buildLocalDateTime(form.preferredDate, form.preferredTime)
    const endsAt = new Date(
      startsAt.getTime() + selectedDurationMinutes * 60 * 1000,
    )

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
        startsAt: startsAt.toISOString(),
        starts_at: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          'America/New_York',
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

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
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
                    {day.isUnavailable && <small>Blocked</small>}
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
                All times are requested times. The team will confirm your final
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
            Dates marked unavailable are protected by Kim private Founders
            View, so the calendar stays clear and intentional.
          </small>
        </aside>
      </section>
    </main>
  )
}