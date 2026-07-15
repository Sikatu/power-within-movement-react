import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame.jsx'
import { getDeveloperSecurityIntegrity } from '../../lib/nativeApi.js'

const CATEGORY_LABELS = {
  accounts: 'Accounts',
  permissions: 'Permissions',
  data: 'Data integrity',
  security: 'Runtime security',
}

function statusLabel(status) {
  return {
    pass: 'Passed',
    warning: 'Review',
    critical: 'Critical',
  }[status] || 'Review'
}

function statusClass(status) {
  return {
    pass: 'balanced',
    warning: 'high',
    critical: 'overloaded',
  }[status] || 'high'
}

function summaryLabel(status) {
  return {
    healthy: 'Controls healthy',
    review: 'Review recommended',
    critical: 'Critical findings',
  }[status] || 'Audit pending'
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

export default function AdminSecurityIntegrity({ embedded = false }) {
  const navigate = useNavigate()
  const [snapshot, setSnapshot] = useState({
    summary: {},
    runtime: {},
    checks: [],
    staff: [],
  })
  const [selectedCheckId, setSelectedCheckId] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadAudit = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const response = await getDeveloperSecurityIntegrity()
      setSnapshot(response)
      setSelectedCheckId((current) => (
        response.checks?.some((check) => check.id === current)
          ? current
          : response.checks?.find((check) => check.status === 'critical')?.id
            || response.checks?.find((check) => check.status === 'warning')?.id
            || response.checks?.[0]?.id
            || ''
      ))
    } catch (loadError) {
      setError(loadError.message || 'The security and integrity audit could not be loaded.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadAudit, 0)
    return () => window.clearTimeout(timer)
  }, [loadAudit])

  const filteredChecks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return (snapshot.checks || []).filter((check) => {
      if (category !== 'all' && check.category !== category) return false
      if (status !== 'all' && check.status !== status) return false
      if (!normalizedQuery) return true

      return [
        check.title,
        check.detail,
        check.recommendation,
        CATEGORY_LABELS[check.category],
        statusLabel(check.status),
      ].join(' ').toLowerCase().includes(normalizedQuery)
    })
  }, [category, query, snapshot.checks, status])

  const selectedCheck = useMemo(() => (
    snapshot.checks?.find((check) => check.id === selectedCheckId)
      || filteredChecks[0]
      || null
  ), [filteredChecks, selectedCheckId, snapshot.checks])

  const staffGaps = useMemo(() => (
    (snapshot.staff || []).filter((member) => !member.hasProfile || !member.hasPermissions)
  ), [snapshot.staff])

  function resetFilters() {
    setQuery('')
    setCategory('all')
    setStatus('all')
  }

  const content = (
      <div className="pwc-week16-page pwc-capacity17-page">
        <header className="pwc-week16-hero pwc-capacity17-hero">
          <div>
            <p className="admin-eyebrow">Security &amp; Data Integrity</p>
            <h1>Verify privileged access, staff permissions, and operational records before deployment.</h1>
            <p>
              Review runtime protections and database relationships in one developer-only audit.
              Findings are read-only and never alter production records automatically.
            </p>
          </div>

          <aside className="pwc-week16-role-card" aria-label="Security audit status">
            <span aria-hidden="true">✓</span>
            <div>
              <small>Developer-only audit</small>
              <strong>{summaryLabel(snapshot.summary?.status)}</strong>
              <p>Last evaluated {formatDateTime(snapshot.generatedAt)}</p>
            </div>
          </aside>
        </header>

        <section className="pwc-week16-toolbar pwc-capacity17-toolbar" aria-label="Security audit controls">
          <div>
            <small>Deployment gate</small>
            <strong>Accounts, permissions, request trust, session revocation, and referential integrity</strong>
          </div>
          <button type="button" disabled={refreshing} onClick={() => loadAudit({ quiet: true })}>
            {refreshing ? 'Running audit…' : 'Run audit again'}
          </button>
        </section>

        {error && <div className="pwc-week16-message is-error" role="alert">{error}</div>}

        <section className="pwc-week16-metrics" aria-label="Security and integrity summary">
          <article>
            <span>Checks passed</span>
            <strong>{snapshot.summary?.passed || 0}</strong>
            <p>Of {snapshot.summary?.total || 0} deployment controls</p>
          </article>
          <article className={snapshot.summary?.warning ? 'is-warning' : ''}>
            <span>Review findings</span>
            <strong>{snapshot.summary?.warning || 0}</strong>
            <p>Require an intentional decision</p>
          </article>
          <article className={snapshot.summary?.critical ? 'is-danger' : ''}>
            <span>Critical findings</span>
            <strong>{snapshot.summary?.critical || 0}</strong>
            <p>Resolve before production deployment</p>
          </article>
          <article className={staffGaps.length ? 'is-warning' : ''}>
            <span>Staff configuration gaps</span>
            <strong>{staffGaps.length}</strong>
            <p>Missing profile or permission records</p>
          </article>
        </section>

        <section className="pwc-week16-filters" aria-label="Audit filters">
          <label className="pwc-week16-search">
            <span>Search checks</span>
            <input
              type="search"
              value={query}
              placeholder="Account, permission, origin, session, or data"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span>Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">All categories</option>
              <option value="accounts">Accounts</option>
              <option value="permissions">Permissions</option>
              <option value="data">Data integrity</option>
              <option value="security">Runtime security</option>
            </select>
          </label>
          <label>
            <span>Result</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All results</option>
              <option value="critical">Critical</option>
              <option value="warning">Review</option>
              <option value="pass">Passed</option>
            </select>
          </label>
          <button type="button" onClick={resetFilters}>Reset filters</button>
        </section>

        {loading ? (
          <section className="pwc-week16-loading" aria-label="Loading security audit">
            {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
          </section>
        ) : (
          <div className="pwc-capacity17-grid pwc-momentum18-grid">
            <section aria-label="Security and integrity checks">
              <div className="pwc-capacity17-cards pwc-momentum18-cards" aria-live="polite">
                {filteredChecks.map((check) => {
                  const selected = check.id === selectedCheck?.id
                  const band = statusClass(check.status)

                  return (
                    <button
                      className={`pwc-capacity17-card pwc-momentum18-card is-${band}${selected ? ' is-selected' : ''}`}
                      key={check.id}
                      type="button"
                      onClick={() => setSelectedCheckId(check.id)}
                    >
                      <span className="pwc-capacity17-card-heading">
                        <span>
                          <small>{CATEGORY_LABELS[check.category] || 'Audit control'}</small>
                          <strong>{check.title}</strong>
                          <em>{statusLabel(check.status)}</em>
                        </span>
                        <b>{check.count || 0}</b>
                      </span>
                      <span className="pwc-capacity17-signal">
                        <strong>{statusLabel(check.status)}</strong>
                        <small>{check.detail}</small>
                      </span>
                    </button>
                  )
                })}
              </div>

              {!filteredChecks.length && (
                <div className="pwc-capacity17-empty pwc-momentum18-empty">
                  <span aria-hidden="true">✓</span>
                  <h3>No controls match these filters</h3>
                  <p>Reset the filters or broaden the search to review the complete deployment audit.</p>
                </div>
              )}
            </section>

            <aside className="pwc-capacity17-detail pwc-momentum18-detail" aria-label="Selected audit control">
              {selectedCheck ? (
                <>
                  <header>
                    <div>
                      <p className="admin-eyebrow">Selected control</p>
                      <h2>{selectedCheck.title}</h2>
                      <small>{CATEGORY_LABELS[selectedCheck.category]}</small>
                    </div>
                    <span className={`is-${statusClass(selectedCheck.status)}`}>
                      {statusLabel(selectedCheck.status)}
                    </span>
                  </header>

                  <dl>
                    <div><dt>Result</dt><dd>{statusLabel(selectedCheck.status)}</dd></div>
                    <div><dt>Affected records</dt><dd>{selectedCheck.count || 0}</dd></div>
                    <div><dt>Environment</dt><dd>{snapshot.runtime?.environment || 'Unknown'}</dd></div>
                    <div><dt>JWT algorithm</dt><dd>{snapshot.runtime?.jwtAlgorithm || 'Unknown'}</dd></div>
                    <div><dt>Mutation protection</dt><dd>{snapshot.runtime?.mutationOriginProtection ? 'Active' : 'Review'}</dd></div>
                    <div><dt>Response caching</dt><dd>{snapshot.runtime?.sensitiveResponseCaching || 'Unknown'}</dd></div>
                  </dl>

                  <section className="pwc-momentum18-focus">
                    <header><h3>Finding</h3><span>{selectedCheck.count || 0}</span></header>
                    <p>{selectedCheck.detail}</p>
                  </section>

                  <section className="pwc-momentum18-focus">
                    <header><h3>Recommended action</h3></header>
                    <p>{selectedCheck.recommendation || 'No action is required for this control.'}</p>
                  </section>

                  <div className="pwc-momentum18-actions">
                    <button type="button" onClick={() => navigate('/admin/developer')}>Account governance</button>
                    <button type="button" onClick={() => navigate('/admin/team')}>Staff permissions</button>
                    <button type="button" onClick={() => navigate('/admin/audit-log')}>Activity journal</button>
                    <button type="button" onClick={() => navigate('/admin/developer/errors')}>Error Center</button>
                  </div>
                </>
              ) : (
                <div className="pwc-capacity17-empty pwc-momentum18-empty">
                  <span aria-hidden="true">✓</span>
                  <h3>No audit control selected</h3>
                  <p>Select a control to review its result and recommended action.</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
  )

  return embedded ? content : <AdminFrame>{content}</AdminFrame>
}
