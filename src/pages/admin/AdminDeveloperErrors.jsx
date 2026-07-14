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

import './DeveloperErrorCenter.css'
import './AdminDeveloperOperationsPhase8.css'

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
      const loadedErrors = result.errors || []
      setSelectedId((current) => (
        loadedErrors.some((item) => item.id === current)
          ? current
          : loadedErrors[0]?.id || ''
      ))
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
  const hasActiveFilters = Boolean(
    filters.status || filters.severity || filters.source || filters.search.trim(),
  )

  const clearFilters = () => {
    setFilters({ status: '', severity: '', source: '', search: '' })
  }

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
      <div className="developer-error-center-page">
        <header className="pwc-admin-page-header error-center-page-header">
        <div className="error-center-title-block">
          <p className="eyebrow">Developer Operations</p>
          <h1>Developer Error Center</h1>
          <p>
            Review backend exceptions, database drift, frontend crashes, API failures,
            missing assets, and public-site availability from one private workspace.
          </p>

          {settingsDraft && (
            <div className="error-center-health-strip" aria-label="Monitoring status">
              <span className={settingsDraft.enabled ? 'is-active' : 'is-paused'}>
                <i aria-hidden="true" />
                {settingsDraft.enabled ? 'Monitoring active' : 'Monitoring paused'}
              </span>
              <span>Uptime every {settingsDraft.uptimeIntervalMinutes} min</span>
              <span>{settingsDraft.retentionDays}-day retention</span>
            </div>
          )}
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
            className="btn primary"
            type="button"
            disabled={isWorking}
            onClick={() => act(runDeveloperErrorChecks, 'Production checks completed.')}
          >
            Run health checks
          </button>
          <button
            className="error-center-refresh-button"
            type="button"
            disabled={isLoading || isWorking}
            onClick={load}
          >
            Refresh data
          </button>
        </div>
      </header>

      <section className="pwc-admin-metrics-grid error-center-metrics" aria-label="Error summary">
        <article className={Number(summary.open) > 0 ? 'is-attention' : ''}>
          <span>Open</span>
          <strong>{summary.open || 0}</strong>
          <small>Needs developer review</small>
        </article>
        <article className={Number(summary.critical) > 0 ? 'is-critical' : ''}>
          <span>Critical</span>
          <strong>{summary.critical || 0}</strong>
          <small>Requires immediate action</small>
        </article>
        <article>
          <span>Last 24 hours</span>
          <strong>{summary.last_24_hours || 0}</strong>
          <small>Recently detected records</small>
        </article>
        <article>
          <span>Total occurrences</span>
          <strong>{summary.total_occurrences || 0}</strong>
          <small>Across all captured issues</small>
        </article>
      </section>

      {(error || notice) && (
        <div
          className={`error-center-notice ${error ? 'is-error' : 'is-success'}`}
          role={error ? 'alert' : 'status'}
          aria-live="polite"
        >
          {error || notice}
        </div>
      )}

      <section className={`error-center-toolbar ${hasActiveFilters ? 'has-clear' : ''}`}>
        <label className="error-center-search-field">
          <span className="sr-only">Search errors</span>
          <input
            value={filters.search}
            onChange={(event) => setFilters((current) => ({
              ...current,
              search: event.target.value,
            }))}
            placeholder="Search title, message, or route"
            aria-label="Search errors"
          />
        </label>
        <select
          value={filters.status}
          aria-label="Filter by status"
          onChange={(event) => setFilters((current) => ({
            ...current,
            status: event.target.value,
          }))}
        >
          <option value="">All statuses</option>
          {statusOptions.map((item) => <option key={item} value={item}>{label(item)}</option>)}
        </select>
        <select
          value={filters.severity}
          aria-label="Filter by severity"
          onChange={(event) => setFilters((current) => ({
            ...current,
            severity: event.target.value,
          }))}
        >
          <option value="">All severity</option>
          {severityOptions.map((item) => <option key={item} value={item}>{label(item)}</option>)}
        </select>
        <select
          value={filters.source}
          aria-label="Filter by source"
          onChange={(event) => setFilters((current) => ({
            ...current,
            source: event.target.value,
          }))}
        >
          <option value="">All sources</option>
          {sourceOptions.map((item) => <option key={item} value={item}>{label(item)}</option>)}
        </select>
        {hasActiveFilters && (
          <button type="button" className="error-center-clear-filters" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </section>

      {isLoading && (
        <section className="error-center-state-card" aria-live="polite">
          <div className="error-center-state-icon is-loading" aria-hidden="true">•••</div>
          <p className="eyebrow">Refreshing</p>
          <h2>Checking the Error Center</h2>
          <p>Loading the newest production signals and monitoring settings.</p>
        </section>
      )}

      {!isLoading && errors.length === 0 && (
        <section className="error-center-state-card is-clear">
          <div className="error-center-state-icon" aria-hidden="true">✓</div>
          <p className="eyebrow">{hasActiveFilters ? 'Filtered View' : 'System Status'}</p>
          <h2>{hasActiveFilters ? 'No matching records' : 'All monitored systems are clear'}</h2>
          <p>
            {hasActiveFilters
              ? 'No error records match the current search and filters.'
              : 'There are no captured issues requiring attention in the current view.'}
          </p>
          <div className="error-center-state-actions">
            {hasActiveFilters && (
              <button className="btn secondary" type="button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
            <button
              className="btn primary"
              type="button"
              disabled={isWorking}
              onClick={() => act(runDeveloperErrorChecks, 'Production checks completed.')}
            >
              Run health checks
            </button>
          </div>
        </section>
      )}

      {!isLoading && errors.length > 0 && (
        <div className="error-center-layout">
          <section className="error-center-list" aria-label="Detected errors">
            <div className="error-center-section-heading">
              <div>
                <p className="eyebrow">Detected Issues</p>
                <h2>{errors.length} record{errors.length === 1 ? '' : 's'}</h2>
              </div>
              <span className="error-center-list-count">{errors.length}</span>
            </div>

            <div className="error-center-list-scroll">
              {errors.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`error-center-row ${selectedId === item.id ? 'is-selected' : ''}`}
                  aria-pressed={selectedId === item.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className={`error-center-severity is-${item.severity}`}>
                    {label(item.severity)}
                  </span>
                  <span className="error-center-row-copy">
                    <strong>{item.title}</strong>
                    <small>{item.route || label(item.source)} · {formatDate(item.lastSeenAt)}</small>
                  </span>
                  <span className="error-center-count">×{item.occurrenceCount}</span>
                </button>
              ))}
            </div>
          </section>

          <aside className="error-center-detail">
            {!selected ? (
              <div className="error-center-empty">
                <strong>Select an error.</strong>
                <span>Technical details will appear here.</span>
              </div>
            ) : (
              <>
                <div className="error-center-detail-heading">
                  <div>
                    <span className={`error-center-severity is-${selected.severity}`}>
                      {label(selected.severity)}
                    </span>
                    <h2>{selected.title}</h2>
                  </div>
                  <span className={`error-center-status is-${selected.status}`}>
                    {label(selected.status)}
                  </span>
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

                <div className="error-center-detail-footer">
                  <div className="error-center-status-actions" aria-label="Update error status">
                    {statusOptions.map((status) => (
                      <button
                        type="button"
                        key={status}
                        disabled={isWorking || selected.status === status}
                        aria-pressed={selected.status === status}
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
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {settingsDraft && (
        <section className="error-center-settings">
          <div className="error-center-section-heading error-center-settings-heading">
            <div>
              <p className="eyebrow">Detection Policy</p>
              <h2>Monitoring settings</h2>
              <p>Control what is captured, how often checks run, and how long resolved records remain.</p>
            </div>
            <span className={`error-center-monitoring-badge ${settingsDraft.enabled ? 'is-active' : 'is-paused'}`}>
              {settingsDraft.enabled ? 'Monitoring on' : 'Monitoring paused'}
            </span>
          </div>

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
                      checked={Boolean(settingsDraft[key])}
                      onChange={(event) => setSettingsDraft((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))}
                    />
                    <span>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
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
                  <small>Resolved and ignored records are eligible for cleanup after this period.</small>
                  <div className="error-center-input-with-suffix">
                    <input
                      type="number"
                      min="7"
                      max="365"
                      value={settingsDraft.retentionDays}
                      onChange={(event) => setSettingsDraft((current) => ({
                        ...current,
                        retentionDays: Number(event.target.value),
                      }))}
                    />
                    <span>days</span>
                  </div>
                </label>
                <label>
                  <span>Uptime interval</span>
                  <small>How frequently automated availability checks should run.</small>
                  <div className="error-center-input-with-suffix">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={settingsDraft.uptimeIntervalMinutes}
                      onChange={(event) => setSettingsDraft((current) => ({
                        ...current,
                        uptimeIntervalMinutes: Number(event.target.value),
                      }))}
                    />
                    <span>minutes</span>
                  </div>
                </label>
                <label>
                  <span>Slow-response threshold</span>
                  <small>Responses slower than this threshold are recorded for review.</small>
                  <div className="error-center-input-with-suffix">
                    <input
                      type="number"
                      min="500"
                      max="30000"
                      step="100"
                      value={settingsDraft.slowResponseThresholdMs}
                      onChange={(event) => setSettingsDraft((current) => ({
                        ...current,
                        slowResponseThresholdMs: Number(event.target.value),
                      }))}
                    />
                    <span>ms</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="error-center-settings-footer">
            <p>Settings apply to the private developer monitor and do not change client-facing content.</p>
            <button
              className="btn primary"
              type="button"
              disabled={isWorking}
              onClick={() => act(
                () => saveDeveloperErrorSettings(settingsDraft),
                'Monitoring settings saved.',
              )}
            >
              Save monitoring settings
            </button>
          </div>
        </section>
      )}
      </div>
    </AdminFrame>
  )
}
