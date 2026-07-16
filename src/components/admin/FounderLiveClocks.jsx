import { useState } from 'react'
import { saveFounderToolPreferences } from '../../lib/nativeApi.js'

const ZONE_OPTIONS = [
  ['America/New_York', 'Eastern'],
  ['America/Chicago', 'Central'],
  ['America/Denver', 'Mountain'],
  ['America/Los_Angeles', 'Pacific'],
  ['Asia/Manila', 'Philippines'],
  ['Europe/London', 'UK'],
]
const SUPPORTED_TIMEZONES = (() => {
  try { return Intl.supportedValuesOf?.('timeZone') || [] } catch { return [] }
})()

function formatZone(value, timeZone, timeZoneName) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(value).find((part) => part.type === 'timeZoneName')?.value || timeZone
  } catch { return timeZone }
}

function clockParts(value, timeZone) {
  try {
    return {
      time: new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      }).format(value),
      date: new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(value),
      abbreviation: formatZone(value, timeZone, 'short'),
      name: formatZone(value, timeZone, 'long'),
    }
  } catch {
    return { time: '--:--:--', date: 'Timezone unavailable', abbreviation: '', name: timeZone }
  }
}

function zoneLabel(timeZone) {
  return ZONE_OPTIONS.find(([value]) => value === timeZone)?.[1] || timeZone.split('/').pop()?.replaceAll('_', ' ') || timeZone
}

export default function FounderLiveClocks({ currentTime, preferences, scheduling, onSaved, onNotice, onError }) {
  const [primaryTimezone, setPrimaryTimezone] = useState(preferences?.primaryTimezone || 'America/Chicago')
  const [comparisonTimezones, setComparisonTimezones] = useState(preferences?.comparisonTimezones || [])
  const [customTimezone, setCustomTimezone] = useState('')
  const [saving, setSaving] = useState(false)

  const primary = clockParts(currentTime, primaryTimezone)

  function toggleComparison(timeZone) {
    setComparisonTimezones((current) => current.includes(timeZone)
      ? current.filter((value) => value !== timeZone)
      : [...current, timeZone].slice(0, 8))
  }

  function addCustomTimezone() {
    const value = customTimezone.trim()
    if (!value || comparisonTimezones.includes(value)) return
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format(currentTime)
      setComparisonTimezones((current) => [...current, value].slice(0, 8))
      setCustomTimezone('')
    } catch { onError?.('Enter a valid IANA timezone, such as Pacific/Honolulu.') }
  }

  async function savePreferences() {
    setSaving(true)
    try {
      const response = await saveFounderToolPreferences({
        primaryTimezone,
        comparisonTimezones,
        recordingRetentionDays: preferences?.recordingRetentionDays || 365,
      })
      onSaved?.({
        primaryTimezone,
        comparisonTimezones,
        recordingRetentionDays: preferences?.recordingRetentionDays || 365,
      })
      onNotice?.(response.message || 'Clock preferences saved.')
    } catch (error) { onError?.(error.message || 'Clock preferences could not be saved.') } finally { setSaving(false) }
  }

  return (
    <section className="pwc-founder29-clocks" aria-labelledby="founder-live-clock-title">
      <div className="pwc-founder29-clock-hero">
        <div>
          <p className="admin-eyebrow">Founder live clock</p>
          <h2 id="founder-live-clock-title">{primary.time}</h2>
          <p>{primary.date}</p>
          <span>{primary.name} · {primary.abbreviation}</span>
        </div>
        <label>
          <span>My primary clock</span>
          <select value={primaryTimezone} onChange={(event) => setPrimaryTimezone(event.target.value)}>
            {ZONE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label} — {value}</option>)}
            {!ZONE_OPTIONS.some(([value]) => value === primaryTimezone) && <option value={primaryTimezone}>{primaryTimezone}</option>}
          </select>
        </label>
      </div>

      <div className="pwc-founder29-schedule-zone">
        <span aria-hidden="true">◇</span>
        <div>
          <small>Scheduling timezone — controls bookings and availability</small>
          <strong>{scheduling?.timezone || 'America/New_York'}</strong>
          <p>Changing clocks below never moves booked sessions, stored availability, or scheduling rules.</p>
        </div>
      </div>

      <div className="pwc-founder29-comparisons">
        {(comparisonTimezones || []).map((timeZone) => {
          const clock = clockParts(currentTime, timeZone)
          return (
            <article key={timeZone}>
              <button type="button" onClick={() => toggleComparison(timeZone)} aria-label={`Remove ${zoneLabel(timeZone)} clock`}>×</button>
              <small>{zoneLabel(timeZone)}</small>
              <strong>{clock.time}</strong>
              <span>{clock.abbreviation} · {clock.date.replace(/,? \d{4}$/, '')}</span>
            </article>
          )
        })}
      </div>

      <div className="pwc-founder29-clock-controls">
        <div>
          <span>Comparison clocks</span>
          <div className="pwc-founder29-zone-pills">
            {ZONE_OPTIONS.map(([value, label]) => (
              <button type="button" key={value} className={comparisonTimezones.includes(value) ? 'is-active' : ''} onClick={() => toggleComparison(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="pwc-founder29-custom-zone">
          <label>
            <span>Custom timezone</span>
            <input list="pwc-founder-timezones" value={customTimezone} onChange={(event) => setCustomTimezone(event.target.value)} placeholder="Pacific/Honolulu" />
          </label>
          <datalist id="pwc-founder-timezones">
            {SUPPORTED_TIMEZONES.map((timeZone) => <option key={timeZone} value={timeZone} />)}
          </datalist>
          <button type="button" onClick={addCustomTimezone} disabled={!customTimezone.trim()}>Add</button>
        </div>
        <button type="button" className="pwc-founder29-save-clock" onClick={savePreferences} disabled={saving || comparisonTimezones.length === 0}>
          {saving ? 'Saving…' : 'Save clock view'}
        </button>
      </div>
    </section>
  )
}
