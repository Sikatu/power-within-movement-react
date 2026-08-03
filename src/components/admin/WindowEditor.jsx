import { windowsMatch, COMMON_HOURS } from './windowHelpers'

const generateTimeOptions = () => {
  const options = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

      const period = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      const displayMinute = String(minute).padStart(2, '0')
      const label = `${displayHour}:${displayMinute} ${period}`

      options.push({ value, label })
    }
  }
  return options
}

const timeOptions = generateTimeOptions()

export default function WindowEditor({ windows = [], onChange, compact }) {
  const updateWindow = (index, field, value) => {
    const next = [...windows]
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }

  return (
    <div className={compact ? "founder-hours__editor is-compact" : "founder-hours__editor"}>
      <div className="founder-hours__presets">
        {COMMON_HOURS.map((preset) => {
          const isSelected = windowsMatch(windows, preset.windows)
          return (
            <button
              type="button"
              key={preset.label}
              className={isSelected ? 'is-selected' : ''}
              onClick={() => onChange(preset.windows.map((w) => ({ ...w })))}
              aria-pressed={isSelected}
            >
              <strong>{preset.label}</strong>
              <small>{preset.detail}</small>
            </button>
          )
        })}
      </div>
      <div className="founder-hours__window-list">
        {windows.map((window, index) => (
          <div className="founder-hours__window" key={index}>
            <label>
              <span>Start</span>
              <select
                value={window.startTime}
                onChange={(event) => updateWindow(index, 'startTime', event.target.value)}
              >
                {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
            <span aria-hidden="true">–</span>
            <label>
              <span>End</span>
              <select
                value={window.endTime}
                onChange={(event) => updateWindow(index, 'endTime', event.target.value)}
              >
                {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
            <button
              type="button"
              className="founder-hours__remove-window"
              onClick={() => onChange(windows.filter((_, windowIndex) => windowIndex !== index))}
              disabled={windows.length === 1}
              aria-label={`Remove time period ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="founder-hours__add-window"
        onClick={() => onChange([...windows, { startTime: '13:00', endTime: '17:00' }])}
      >
        + Add another time period
      </button>
      {!compact && (
        <p className="founder-hours__window-help">
          Add another period when you want a break between appointments.
        </p>
      )}
    </div>
  )
}
