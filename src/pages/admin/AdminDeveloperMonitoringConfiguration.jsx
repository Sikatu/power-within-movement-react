import { useCallback, useEffect, useState } from 'react'
import { getDeveloperErrorCenter, saveDeveloperErrorSettings } from '../../lib/nativeApi.js'

const monitoringOptions = [
  {
    key: 'enabled',
    title: 'Error Center enabled',
    description: 'Capture and organize production issues in this private workspace.',
  },
  {
    key: 'frontendCaptureEnabled',
    title: 'Frontend browser capture',
    description: 'Record safe client-side crashes without exposing private information.',
  },
  {
    key: 'uptimeChecksEnabled',
    title: 'Automated uptime checks',
    description: 'Monitor the public site, portals, and backend health automatically.',
  },
  {
    key: 'criticalNotificationsEnabled',
    title: 'Critical developer alerts',
    description: 'Notify active developers when a high or critical issue is detected.',
  },
]

export default function AdminDeveloperMonitoringConfiguration() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getDeveloperErrorCenter('limit=1')
      setSettings(response.settings)
    } catch (loadError) {
      setError(loadError.message || 'Monitoring configuration could not load.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function save() {
    if (!settings) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await saveDeveloperErrorSettings(settings)
      setSettings(response.settings || settings)
      setNotice(response.message || 'Monitoring settings saved.')
    } catch (saveError) {
      setError(saveError.message || 'Monitoring settings could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="error-center-settings developer-monitoring-configuration" aria-labelledby="monitoring-configuration-title">
      <header className="error-center-section-heading error-center-settings-heading">
        <div>
          <p className="eyebrow">Detection policy</p>
          <h2 id="monitoring-configuration-title">Monitoring configuration</h2>
          <p>Capture rules, alert behavior, retention, and automated check cadence.</p>
        </div>
        {settings && (
          <span className={`error-center-monitoring-badge ${settings.enabled ? 'is-active' : 'is-paused'}`}>
            {settings.enabled ? 'Monitoring on' : 'Monitoring paused'}
          </span>
        )}
      </header>

      {(error || notice) && (
        <div className={`error-center-notice ${error ? 'is-error' : 'is-success'}`} role={error ? 'alert' : 'status'}>
          {error || notice}
        </div>
      )}

      {loading && <p className="developer-monitoring-loading" role="status">Loading monitoring policy…</p>}

      {settings && (
        <div className="error-center-settings-body">
          <div className="error-center-settings-layout">
            <div className="error-center-settings-panel">
              <div className="error-center-panel-heading">
                <p className="eyebrow">Capture & Alerts</p>
                <h3>What the system watches</h3>
              </div>
              <div className="error-center-toggle-grid">
                {monitoringOptions.map(({ key, title, description }) => (
                  <label className="error-center-toggle" key={key}>
                    <input
                      type="checkbox"
                      checked={Boolean(settings[key])}
                      onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.checked }))}
                    />
                    <span><strong>{title}</strong><small>{description}</small></span>
                  </label>
                ))}
              </div>
            </div>

            <div className="error-center-settings-panel">
              <div className="error-center-panel-heading">
                <p className="eyebrow">Retention & Timing</p>
                <h3>Monitoring cadence</h3>
              </div>
              <div className="error-center-field-grid">
                <label>
                  <span>Retention days</span>
                  <small>Resolved and ignored records become eligible for cleanup after this period.</small>
                  <div className="error-center-input-with-suffix">
                    <input type="number" min="7" max="365" value={settings.retentionDays} onChange={(event) => setSettings((current) => ({ ...current, retentionDays: Number(event.target.value) }))} />
                    <span>days</span>
                  </div>
                </label>
                <label>
                  <span>Uptime interval</span>
                  <small>How frequently automated availability checks should run.</small>
                  <div className="error-center-input-with-suffix">
                    <input type="number" min="1" max="60" value={settings.uptimeIntervalMinutes} onChange={(event) => setSettings((current) => ({ ...current, uptimeIntervalMinutes: Number(event.target.value) }))} />
                    <span>minutes</span>
                  </div>
                </label>
                <label>
                  <span>Slow-response threshold</span>
                  <small>Responses slower than this threshold are recorded for review.</small>
                  <div className="error-center-input-with-suffix">
                    <input type="number" min="500" max="30000" step="100" value={settings.slowResponseThresholdMs} onChange={(event) => setSettings((current) => ({ ...current, slowResponseThresholdMs: Number(event.target.value) }))} />
                    <span>ms</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="error-center-settings-footer">
            <p>Settings apply only to the private developer monitor and never change client-facing content.</p>
            <button className="btn primary" type="button" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save monitoring settings'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
