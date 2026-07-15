import {
  useCallback,
  useMemo,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame.jsx'
import {
  RELEASE_QA_CHECKS,
  RELEASE_QA_VIEWPORTS,
  buildReleaseQaReport,
  inspectReleaseQaResponse,
  summarizeReleaseQaResults,
} from '../../components/admin/adminReleaseQa.js'
import { apiRequest } from '../../lib/nativeApi.js'

function statusLabel(status) {
  return {
    pass: 'Passed',
    review: 'Review',
    fail: 'Failed',
    running: 'Running',
    pending: 'Not run',
  }[status] || 'Not run'
}

function statusClass(status) {
  return {
    pass: 'balanced',
    review: 'high',
    fail: 'overloaded',
    running: 'watch',
    pending: 'watch',
  }[status] || 'watch'
}

function releaseLabel(summary) {
  if (!summary.completed) return 'QA not started'
  if (summary.failed) return 'Release blocked'
  if (summary.review) return 'Manual review needed'
  if (summary.ready) return 'Automated gate passed'
  return 'QA in progress'
}

function formatDateTime(value) {
  if (!value) return 'Not run yet'

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return 'Time unavailable'
  }
}

function emptyResult(check) {
  return {
    ...check,
    status: 'pending',
    durationMs: 0,
    count: null,
    notes: ['Run this check against the current environment.'],
    topLevelKeys: [],
  }
}

export default function AdminReleaseQa({ embedded = false }) {
  const navigate = useNavigate()
  const [results, setResults] = useState(() => RELEASE_QA_CHECKS.map(emptyResult))
  const [selectedId, setSelectedId] = useState(RELEASE_QA_CHECKS[0]?.id || '')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [running, setRunning] = useState(false)
  const [lastRunAt, setLastRunAt] = useState('')
  const [notice, setNotice] = useState('')

  const summary = useMemo(() => summarizeReleaseQaResults(results), [results])

  const categories = useMemo(() => (
    Array.from(new Set(RELEASE_QA_CHECKS.map((check) => check.category))).sort()
  ), [])

  const filteredResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return results.filter((result) => {
      if (category !== 'all' && result.category !== category) return false
      if (status !== 'all' && result.status !== status) return false
      if (!normalizedQuery) return true

      return [
        result.title,
        result.category,
        result.description,
        result.endpoint,
        ...(result.notes || []),
      ].join(' ').toLowerCase().includes(normalizedQuery)
    })
  }, [category, query, results, status])

  const selectedResult = useMemo(() => (
    results.find((result) => result.id === selectedId)
      || filteredResults[0]
      || null
  ), [filteredResults, results, selectedId])

  const runCheck = useCallback(async (check) => {
    const startedAt = performance.now()

    setResults((current) => current.map((result) => (
      result.id === check.id
        ? { ...result, status: 'running', notes: ['Requesting current production-shaped data…'] }
        : result
    )))

    try {
      const response = await apiRequest(check.endpoint)
      const inspected = inspectReleaseQaResponse({
        response,
        durationMs: performance.now() - startedAt,
        contract: check,
      })

      const nextResult = { ...check, ...inspected }
      setResults((current) => current.map((result) => (
        result.id === check.id ? nextResult : result
      )))
      return nextResult
    } catch (error) {
      const inspected = inspectReleaseQaResponse({
        error,
        durationMs: performance.now() - startedAt,
        contract: check,
      })
      const nextResult = { ...check, ...inspected }
      setResults((current) => current.map((result) => (
        result.id === check.id ? nextResult : result
      )))
      return nextResult
    }
  }, [])

  const runAllChecks = useCallback(async () => {
    if (running) return

    setRunning(true)
    setNotice('')
    setResults(RELEASE_QA_CHECKS.map(emptyResult))

    const completed = []
    for (const check of RELEASE_QA_CHECKS) {
      completed.push(await runCheck(check))
    }

    const completedSummary = summarizeReleaseQaResults(completed)
    setLastRunAt(new Date().toISOString())
    setRunning(false)
    setNotice(
      completedSummary.failed
        ? `${completedSummary.failed} release check${completedSummary.failed === 1 ? '' : 's'} failed.`
        : completedSummary.review
          ? `Automated checks passed with ${completedSummary.review} manual review item${completedSummary.review === 1 ? '' : 's'}.`
          : 'All automated real-data checks passed.',
    )
  }, [runCheck, running])

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(buildReleaseQaReport(results, lastRunAt || new Date().toISOString()))
      setNotice('Release QA report copied to the clipboard.')
    } catch {
      setNotice('The report could not be copied. Review browser clipboard permissions.')
    }
  }

  function resetFilters() {
    setQuery('')
    setCategory('all')
    setStatus('all')
  }

  const content = (
      <div className="pwc-week16-page pwc-capacity17-page developer-release-workspace">
        {!embedded && (
        <header className="pwc-week16-hero pwc-capacity17-hero">
          <div>
            <p className="admin-eyebrow">Phase 23 · Release QA</p>
            <h1>Validate real Studio data before the production deployment gate.</h1>
            <p>
              Run read-only endpoint contracts, response-time checks, and high-density visual flags
              against the current environment. No client, session, or system record is modified.
            </p>
          </div>

          <aside className="pwc-week16-role-card" aria-label="Release QA status">
            <span aria-hidden="true">◎</span>
            <div>
              <small>Developer-only release gate</small>
              <strong>{releaseLabel(summary)}</strong>
              <p>Last completed {formatDateTime(lastRunAt)}</p>
            </div>
          </aside>
        </header>
        )}

        <section className="pwc-week16-toolbar pwc-capacity17-toolbar" aria-label="Release QA controls">
          <div>
            <small>Read-only live inspection</small>
            <strong>API contracts, latency, realistic density, empty states, and viewport review</strong>
          </div>
          <span className="pwc-week16-week-switcher">
            <button type="button" disabled={running || !summary.completed} onClick={copyReport}>
              Copy report
            </button>
            <button className="pwc-week16-refresh" type="button" disabled={running} onClick={runAllChecks}>
              {running ? 'Running full QA…' : 'Run full QA'}
            </button>
          </span>
        </section>

        {notice && (
          <div className={`pwc-week16-message${summary.failed ? ' is-error' : ''}`} role="status">
            {notice}
          </div>
        )}

        <section className="pwc-week16-metrics" aria-label="Release QA summary">
          <article>
            <span>Checks completed</span>
            <strong>{summary.completed}/{summary.total}</strong>
            <p>Read-only production-shaped contracts</p>
          </article>
          <article>
            <span>Passed</span>
            <strong>{summary.passed}</strong>
            <p>Within response and shape thresholds</p>
          </article>
          <article className={summary.review ? 'is-warning' : ''}>
            <span>Manual review</span>
            <strong>{summary.review}</strong>
            <p>Latency or high-density visual states</p>
          </article>
          <article className={summary.failed ? 'is-danger' : ''}>
            <span>Release blockers</span>
            <strong>{summary.failed}</strong>
            <p>Resolve before Phase 24 deployment</p>
          </article>
        </section>

        <section className="pwc-week16-filters" aria-label="Release QA filters">
          <label className="pwc-week16-search">
            <span>Search checks</span>
            <input
              type="search"
              value={query}
              placeholder="Clients, sessions, latency, security, or endpoint"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span>Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Result</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All results</option>
              <option value="fail">Failed</option>
              <option value="review">Review</option>
              <option value="pass">Passed</option>
              <option value="pending">Not run</option>
            </select>
          </label>
          <label>
            <span>Average response</span>
            <input value={`${summary.averageLatencyMs} ms`} readOnly aria-label="Average API response time" />
          </label>
          <button type="button" onClick={resetFilters}>Reset filters</button>
        </section>

        <div className="pwc-capacity17-grid pwc-momentum18-grid">
          <section aria-label="Release QA checks">
            <div className="pwc-capacity17-cards pwc-momentum18-cards" aria-live="polite">
              {filteredResults.map((result) => {
                const selected = result.id === selectedResult?.id
                const band = statusClass(result.status)

                return (
                  <button
                    className={`pwc-capacity17-card pwc-momentum18-card is-${band}${selected ? ' is-selected' : ''}`}
                    key={result.id}
                    type="button"
                    onClick={() => setSelectedId(result.id)}
                  >
                    <span className="pwc-capacity17-card-heading">
                      <span>
                        <small>{result.category}</small>
                        <strong>{result.title}</strong>
                        <em>{result.endpoint}</em>
                      </span>
                      <b>{result.status === 'running' ? '…' : result.durationMs || 0}</b>
                    </span>
                    <span className="pwc-capacity17-signal">
                      <strong>{statusLabel(result.status)}</strong>
                      <small>{result.notes?.[0]}</small>
                    </span>
                    <span className="pwc-capacity17-stats">
                      <span><b>{result.count ?? '—'}</b><small>Records</small></span>
                      <span><b>{result.durationMs || 0}</b><small>Milliseconds</small></span>
                      <span><b>{result.topLevelKeys?.length || 0}</b><small>Top-level fields</small></span>
                    </span>
                  </button>
                )
              })}
            </div>

            {!filteredResults.length && (
              <div className="pwc-capacity17-empty pwc-momentum18-empty">
                <span aria-hidden="true">◎</span>
                <h3>No release checks match these filters</h3>
                <p>Reset the filters to review the complete real-data QA matrix.</p>
              </div>
            )}
          </section>

          <aside className="pwc-capacity17-detail pwc-momentum18-detail" aria-label="Selected release check">
            {selectedResult ? (
              <>
                <header>
                  <div>
                    <small>{selectedResult.category}</small>
                    <h2>{selectedResult.title}</h2>
                    <p>{selectedResult.description}</p>
                  </div>
                  <span className={`is-${statusClass(selectedResult.status)}`}>
                    {statusLabel(selectedResult.status)}
                  </span>
                </header>

                <section className="pwc-momentum18-focus">
                  <small>Live contract</small>
                  <strong>{selectedResult.endpoint}</strong>
                  <p>
                    {selectedResult.critical
                      ? 'Critical deployment dependency.'
                      : 'Operational dependency requiring successful read access.'}
                  </p>
                </section>

                <dl>
                  <div><dt>Response</dt><dd>{selectedResult.durationMs || 0} ms</dd></div>
                  <div><dt>Records</dt><dd>{selectedResult.count ?? 'Not applicable'}</dd></div>
                  <div><dt>Top-level fields</dt><dd>{selectedResult.topLevelKeys?.length || 0}</dd></div>
                </dl>

                <section>
                  <header><h3>Findings</h3><span>{selectedResult.notes?.length || 0}</span></header>
                  <div className="pwc-momentum18-reasons">
                    {(selectedResult.notes || []).map((note) => <p key={note}>{note}</p>)}
                  </div>
                </section>

                <section>
                  <header><h3>Responsive visual matrix</h3><span>{RELEASE_QA_VIEWPORTS.length}</span></header>
                  <div className="pwc-capacity17-detail-list">
                    {RELEASE_QA_VIEWPORTS.map((viewport) => (
                      <div className="pwc-capacity17-session" key={viewport.id}>
                        <span>{viewport.width} × {viewport.height}</span>
                        <strong>{viewport.label}</strong>
                        <small>Check wrapping, overflow, sticky panels, dialogs, and touch targets.</small>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="pwc-momentum18-actions">
                  <button type="button" disabled={running} onClick={() => runCheck(selectedResult)}>
                    Run this check
                  </button>
                  <button type="button" onClick={() => navigate(selectedResult.route)}>
                    Open workspace
                  </button>
                  <button type="button" onClick={() => navigate('/admin/developer/integrity')}>
                    Security audit
                  </button>
                  <button type="button" onClick={() => navigate('/admin/developer/errors')}>
                    Error Center
                  </button>
                </div>
              </>
            ) : (
              <div className="pwc-capacity17-empty pwc-momentum18-empty">
                <span aria-hidden="true">◎</span>
                <h3>Select a release check</h3>
                <p>Choose a contract to inspect its live result and responsive review matrix.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
  )

  return embedded ? content : <AdminFrame>{content}</AdminFrame>
}
