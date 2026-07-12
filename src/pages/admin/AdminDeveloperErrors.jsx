import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminFrame from '../../components/admin/AdminFrame'
import {
  createDeveloperErrorTest,
  deleteDeveloperError,
  getDeveloperErrorCenter,
  runDeveloperErrorChecks,
  saveDeveloperErrorSettings,
  updateDeveloperErrorStatus,
} from '../../lib/nativeApi'

import './Admin.css'
import './DeveloperErrorCenter.css'

const statusOptions = ['open', 'investigating', 'resolved', 'ignored']
const severityOptions = ['critical', 'high', 'medium', 'low']
const sourceOptions = ['backend', 'frontend', 'api', 'database', 'uptime', 'asset', 'schema', 'worker']

function label(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function buildQuery(filters) {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.severity) params.set('severity', filters.severity)
  if (filters.source) params.set('source', filters.source)
  if (filters.search.trim()) params.set('search', filters.search.trim())
  params.set('limit', '100')
  return params.toString()
}

export default function AdminDeveloperErrors() {
  const [snapshot, setSnapshot] = useState(null)
  const [selectedId, setSelectedId] = useState('')
  const [filters, setFilters] = useState({ status: '', severity: '', source: '', search: '' })
  const [settingsDraft, setSettingsDraft] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const result = await getDeveloperErrorCenter(buildQuery(filters))
      setSnapshot(result)
      setSettingsDraft((current) => current || result.settings)
      const errors = result.errors || []
      setSelectedId((current) => errors.some((item) => item.id === current) ? current : errors[0]?.id || '')
    } catch (loadError) {
      setError(loadError.message || 'Unable to load the Developer Error Center.')
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const timer = window.setTimeout(load, 180)
    return () => window.clearTimeout(timer)
  }, [load])

  const errors = useMemo(() => snapshot?.errors || [], [snapshot])
  const selected = errors.find((item) => item.id === selectedId) || null
  const summary = snapshot?.summary || {}

  const act = async (callback, successMessage) => {
    setIsWorking(true)
    setError('')
    setNotice('')
    try {
      await callback()
      setNotice(successMessage)
      await load()
    } catch (actionError) {
      setError(actionError.message || 'The Error Center action failed.')
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <AdminFrame>
      <div className="pwc-admin-page-header pwc-admin-page-header-balanced">
        <div>
          <p className="eyebrow">Developer Operations</p>
          <h1>Developer Error Center</h1>
          <p>
            One private command center for backend exceptions, database drift, frontend crashes,
            API failures, missing assets, and public-site availability.
          </p>
        </div>
        <div className="error-center-header-actions">
          <button
            className="btn secondary"
            type="button"
            disabled={isWorking}
            onClick={() => act(createDeveloperErrorTest, 'Safe test event recorded.')}
          >
            Create safe test
          </button>
          <button
            className="btn secondary"
            type="button"
            disabled={isWorking}
            onClick={() => act(runDeveloperErrorChecks, 'Production checks completed.')}
          >
            Run checks now
          </button>
          <button className="btn primary" type="button" disabled={isLoading} onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      <div className="pwc-admin-metrics-grid error-center-metrics">
        <article><span>Open</span><strong>{summary.open || 0}</strong></article>
        <article><span>Critical</span><strong>{summary.critical || 0}</strong></article>
        <article><span>Last 24 hours</span><strong>{summary.last_24_hours || 0}</strong></article>
        <article><span>Total occurrences</span><strong>{summary.total_occurrences || 0}</strong></article>
      </div>

      {(error || notice) && (
        <div className={`error-center-notice ${error ? 'is-error' : 'is-success'}`} role="status">
          {error || notice}
        </div>
      )}

      <section className="error-center-toolbar">
        <input
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          placeholder="Search title, message, or route"
          aria-label="Search errors"
        />
        <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
          <option value="">All statuses</option>
          {statusOptions.map((item) => <option key={item} value={item}>{label(item)}</option>)}
        </select>
        <select value={filters.severity} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}>
          <option value="">All severity</option>
          {severityOptions.map((item) => <option key={item} value={item}>{label(item)}</option>)}
        </select>
        <select value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}>
          <option value="">All sources</option>
          {sourceOptions.map((item) => <option key={item} value={item}>{label(item)}</option>)}
        </select>
      </section>

      <div className="error-center-layout">
        <section className="error-center-list" aria-label="Detected errors">
          <div className="error-center-section-heading">
            <div><p className="eyebrow">Detected Issues</p><h2>{isLoading ? 'Loading…' : `${errors.length} record(s)`}</h2></div>
          </div>

          {!isLoading && errors.length === 0 && (
            <div className="error-center-empty">
              <strong>No matching errors.</strong>
              <span>The current filters are clean.</span>
            </div>
          )}

          {errors.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`error-center-row ${selectedId === item.id ? 'is-selected' : ''}`}
              onClick={() => setSelectedId(item.id)}
            >
              <span className={`error-center-severity is-${item.severity}`}>{label(item.severity)}</span>
              <span className="error-center-row-copy">
                <strong>{item.title}</strong>
                <small>{item.route || label(item.source)} · {formatDate(item.lastSeenAt)}</small>
              </span>
              <span className="error-center-count">×{item.occurrenceCount}</span>
            </button>
          ))}
        </section>

        <aside className="error-center-detail">
          {!selected ? (
            <div className="error-center-empty"><strong>Select an error.</strong><span>Technical details will appear here.</span></div>
          ) : (
            <>
              <div className="error-center-detail-heading">
                <div>
                  <span className={`error-center-severity is-${selected.severity}`}>{label(selected.severity)}</span>
                  <h2>{selected.title}</h2>
                </div>
                <span className={`error-center-status is-${selected.status}`}>{label(selected.status)}</span>
              </div>

              <p className="error-center-message">{selected.message}</p>

              <dl className="error-center-facts">
                <div><dt>Source</dt><dd>{label(selected.source)}</dd></div>
                <div><dt>Route</dt><dd>{selected.method ? `${selected.method} ` : ''}{selected.route || 'Not available'}</dd></div>
                <div><dt>HTTP status</dt><dd>{selected.httpStatus || '—'}</dd></div>
                <div><dt>Occurrences</dt><dd>{selected.occurrenceCount}</dd></div>
                <div><dt>First seen</dt><dd>{formatDate(selected.firstSeenAt)}</dd></div>
                <div><dt>Last seen</dt><dd>{formatDate(selected.lastSeenAt)}</dd></div>
                <div><dt>Request ID</dt><dd>{selected.requestId || '—'}</dd></div>
                <div><dt>User role</dt><dd>{selected.userRole || 'Anonymous/System'}</dd></div>
              </dl>

              {selected.stackTrace && (
                <details className="error-center-technical">
                  <summary>Stack trace</summary>
                  <pre>{selected.stackTrace}</pre>
                </details>
              )}

              {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                <details className="error-center-technical">
                  <summary>Safe technical metadata</summary>
                  <pre>{JSON.stringify(selected.metadata, null, 2)}</pre>
                </details>
              )}

              <div className="error-center-status-actions">
                {statusOptions.map((status) => (
                  <button
                    type="button"
                    key={status}
                    disabled={isWorking || selected.status === status}
                    onClick={() => act(
                      () => updateDeveloperErrorStatus(selected.id, status),
                      `Error marked ${label(status).toLowerCase()}.`,
                    )}
                  >
                    {label(status)}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="error-center-delete"
                disabled={isWorking}
                onClick={() => {
                  if (!window.confirm('Delete this error record permanently?')) return
                  act(() => deleteDeveloperError(selected.id), 'Error record deleted.')
                }}
              >
                Delete record
              </button>
            </>
          )}
        </aside>
      </div>

      {settingsDraft && (
        <section className="error-center-settings">
          <div className="error-center-section-heading">
            <div><p className="eyebrow">Detection Policy</p><h2>Monitoring settings</h2></div>
          </div>

          <div className="error-center-settings-grid">
            {[
              ['enabled', 'Error Center enabled'],
              ['frontendCaptureEnabled', 'Frontend browser capture'],
              ['uptimeChecksEnabled', 'Automated uptime checks'],
              ['criticalNotificationsEnabled', 'Critical developer alerts'],
            ].map(([key, title]) => (
              <label className="error-center-toggle" key={key}>
                <input
                  type="checkbox"
                  checked={Boolean(settingsDraft[key])}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, [key]: event.target.checked }))}
                />
                <span><strong>{title}</strong></span>
              </label>
            ))}

            <label>
              <span>Retention days</span>
              <input type="number" min="7" max="365" value={settingsDraft.retentionDays} onChange={(event) => setSettingsDraft((current) => ({ ...current, retentionDays: Number(event.target.value) }))} />
            </label>
            <label>
              <span>Uptime interval (minutes)</span>
              <input type="number" min="1" max="60" value={settingsDraft.uptimeIntervalMinutes} onChange={(event) => setSettingsDraft((current) => ({ ...current, uptimeIntervalMinutes: Number(event.target.value) }))} />
            </label>
            <label>
              <span>Slow-response threshold (ms)</span>
              <input type="number" min="500" max="30000" step="100" value={settingsDraft.slowResponseThresholdMs} onChange={(event) => setSettingsDraft((current) => ({ ...current, slowResponseThresholdMs: Number(event.target.value) }))} />
            </label>
          </div>

          <button className="btn primary" type="button" disabled={isWorking} onClick={() => act(() => saveDeveloperErrorSettings(settingsDraft), 'Monitoring settings saved.')}>
            Save monitoring settings
          </button>
        </section>
      )}
    </AdminFrame>
  )
}
