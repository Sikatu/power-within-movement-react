
export const COMMON_HOURS = [
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

export const DEFAULT_WINDOWS = [
  { startTime: '09:00', endTime: '12:00' },
  { startTime: '13:00', endTime: '16:00' },
]

export const WEEKDAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
]

export function formatTime(timeValue) {
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

export function normalizeWindow(window) {
  return {
    startTime: String(window.startTime || window.start_time || '09:00').slice(0, 5),
    endTime: String(window.endTime || window.end_time || '17:00').slice(0, 5),
  }
}

export function windowsMatch(left = [], right = []) {
  if (left.length !== right.length) return false
  return left.every(
    (window, index) =>
      window.startTime === right[index]?.startTime &&
      window.endTime === right[index]?.endTime,
  )
}

export function getWindowsSummary(windows = []) {
  if (windows.length === 0) return 'No appointment times'
  return windows
    .map((window) => `${formatTime(window.startTime)}–${formatTime(window.endTime)}`)
    .join(' · ')
}

export function validateTimeWindows(windows = [], label = 'These hours') {
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

export function createWeeklySchedule(blocks = [], scheduleEnabled = false) {
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
