import { useState, useRef, useEffect } from 'react'
import {
  updateAdminFounderWeeklyAvailability,
} from '../../lib/nativeApi'
import WindowEditor from './WindowEditor'
import { WEEKDAYS, validateTimeWindows, windowsMatch, getWindowsSummary } from './windowHelpers'

export default function AdminFounderWeeklySchedule({
  isOpen,
  onClose,
  initialWeeklySchedule,
  settings,
  onSaved,
}) {
  const [weeklySchedule, setWeeklySchedule] = useState(initialWeeklySchedule)
  const [activeWeekday, setActiveWeekday] = useState(null)
  const [isSavingWeekly, setIsSavingWeekly] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [copiedWeekdays, setCopiedWeekdays] = useState([])

  const dialogRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWeeklySchedule(initialWeeklySchedule)
      setActiveWeekday(null)
      setError('')
      setNotice('')
      setCopyStatus('')
      setCopiedWeekdays([])
    }
  }, [isOpen, initialWeeklySchedule])

  useEffect(() => {
    if (isOpen) {
      if (dialogRef.current && !dialogRef.current.open) {
        dialogRef.current.showModal()
      }
    } else {
      if (dialogRef.current && dialogRef.current.open) {
        dialogRef.current.close()
      }
    }
  }, [isOpen])

  if (!isOpen) return null

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

    const nextAvailableCount = weeklySchedule.filter(d => d.isAvailable).length
    if (nextAvailableCount === 0) {
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
      onSaved(response)
      onClose()
    } catch (saveError) {
      setError(saveError.message || 'Unable to save weekly availability.')
    } finally {
      setIsSavingWeekly(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="founder-calendar__modal-dialog" onClose={onClose}>
      <div className="founder-calendar__modal-content founder-hours__layout">
        <form
          className="founder-hours__card founder-hours__weekly"
          onSubmit={handleSaveWeekly}
        >
          <div className="founder-hours__card-heading">
            <div>
              <p>Weekly Schedule</p>
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
            <button type="button" className="founder-calendar__modal-close" onClick={onClose} aria-label="Close modal">
              ×
            </button>
          </div>

          {(notice || error) && (
            <div
              className={error ? 'founder-hours__feedback is-error' : 'founder-hours__feedback'}
              role={error ? 'alert' : 'status'}
            >
              <strong>{error ? 'Please check one thing' : 'Notice'}</strong>
              <span>{error || notice}</span>
            </div>
          )}

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

          <div className="founder-hours__card-actions">
            <button
              type="submit"
              className="founder-hours__save-weekly"
              disabled={isSavingWeekly}
            >
              {isSavingWeekly ? 'Saving...' : 'Save my usual week'}
            </button>
            <button
              type="button"
              className="founder-hours__cancel-weekly"
              onClick={onClose}
              disabled={isSavingWeekly}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
