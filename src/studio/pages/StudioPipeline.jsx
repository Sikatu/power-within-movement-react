import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import {
  getAdminLeadDetail,
  getAdminLeadPipeline,
} from '../../lib/nativeApi'

const stageLabels = {
  new_inquiry: 'New inquiry',
  contacted: 'Contacted',
  consultation_booked: 'Consultation scheduled',
  qualified: 'Consultation completed',
  nurturing: 'Decision pending',
  converted: 'Converted',
  not_a_fit: 'Not a fit',
}

const priorityLabels = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

function formatDate(value, includeTime = true) {
  if (!value) return 'Not scheduled'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'

  return new Intl.DateTimeFormat(
    undefined,
    includeTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'medium' },
  ).format(date)
}

function leadMatchesFilters(lead, filters) {
  if (
    filters.priority !== 'all'
    && lead.priority !== filters.priority
  ) {
    return false
  }

  if (
    filters.owner !== 'all'
    && (lead.ownerUserId || 'unassigned') !== filters.owner
  ) {
    return false
  }

  const query = filters.search.trim().toLowerCase()
  if (!query) return true

  return [
    lead.name,
    lead.email,
    lead.phone,
    lead.interest,
    lead.source,
    lead.ownerName,
  ].some((value) => (
    String(value || '').toLowerCase().includes(query)
  ))
}

function LeadCard({ lead, selected, onSelect }) {
  return (
    <button
      aria-pressed={selected}
      className={`studio-pipeline-card${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect(lead.id)}
      type="button"
    >
      <span className="studio-pipeline-card-topline">
        <span className={`studio-pipeline-priority is-${lead.priority}`}>
          {priorityLabels[lead.priority] || lead.priority}
        </span>

        {lead.overdueFollowUps > 0 && (
          <span className="studio-pipeline-overdue">
            {lead.overdueFollowUps} overdue
          </span>
        )}
      </span>

      <strong>{lead.name}</strong>

      <span className="studio-pipeline-interest">
        {lead.interest || 'General inquiry'}
      </span>

      <span className="studio-pipeline-card-meta">
        <span>{lead.ownerName || 'Unassigned'}</span>
        <span>
          {lead.nextFollowUpAt
            ? formatDate(lead.nextFollowUpAt, false)
            : 'No next action'}
        </span>
      </span>
    </button>
  )
}

export default function StudioPipeline() {
  const [pipeline, setPipeline] = useState(null)
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [detail, setDetail] = useState(null)
  const [stageView, setStageView] = useState('all')
  const [detailView, setDetailView] = useState('overview')
  const [filters, setFilters] = useState({
    search: '',
    priority: 'all',
    owner: 'all',
  })
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  const loadPipeline = useCallback(async ({
    preserveSelection = true,
  } = {}) => {
    setLoading(true)
    setError('')

    try {
      const result = await getAdminLeadPipeline()
      const leads = result.leads || []

      setPipeline(result)

      const nextLeadId = (
        preserveSelection
        && leads.some((lead) => lead.id === selectedLeadId)
      )
        ? selectedLeadId
        : (
          leads.find((lead) => lead.clientStatus === 'lead')?.id
          || leads[0]?.id
          || ''
        )

      setSelectedLeadId(nextLeadId)
    } catch (loadError) {
      setError(
        loadError.message
        || 'Unable to load the Studio Pipeline.',
      )
    } finally {
      setLoading(false)
    }
  }, [selectedLeadId])

  const loadDetail = useCallback(async (clientId) => {
    if (!clientId) {
      setDetail(null)
      return
    }

    setDetailLoading(true)
    setError('')

    try {
      const result = await getAdminLeadDetail(clientId)
      setDetail(result.detail || null)
    } catch (loadError) {
      setError(
        loadError.message
        || 'Unable to load this lead.',
      )
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPipeline({ preserveSelection: false })
    }, 0)

    return () => window.clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDetail(selectedLeadId)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadDetail, selectedLeadId])

  const filteredLeads = useMemo(
    () => (pipeline?.leads || []).filter(
      (lead) => leadMatchesFilters(lead, filters),
    ),
    [filters, pipeline?.leads],
  )

  const visibleStages = useMemo(() => {
    const stages = pipeline?.stages || []

    if (stageView === 'all') return stages
    return stages.includes(stageView) ? [stageView] : stages
  }, [pipeline?.stages, stageView])

  const leadsByStage = useMemo(
    () => Object.fromEntries(
      visibleStages.map((stage) => [
        stage,
        filteredLeads.filter(
          (lead) => lead.pipelineStage === stage,
        ),
      ]),
    ),
    [filteredLeads, visibleStages],
  )

  const selectedLead = detail?.lead || null

  function updateFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function clearFilters() {
    setFilters({
      search: '',
      priority: 'all',
      owner: 'all',
    })
  }

  function selectLead(clientId) {
    setSelectedLeadId(clientId)
    setDetailView('overview')
  }

  return (
    <div className="studio-v2-page studio-pipeline-page">
      <header className="studio-v2-page-header">
        <div>
          <p className="studio-v2-eyebrow">Lead journey</p>
          <h1>Pipeline</h1>
          <p>
            See every inquiry, who owns the relationship, and the next
            action required to keep the journey moving.
          </p>
        </div>

        <div className="studio-pipeline-header-actions">
          <button
            className="studio-v2-button is-primary"
            disabled={loading}
            onClick={() => loadPipeline()}
            type="button"
          >
            {loading ? 'Refreshing...' : 'Refresh Pipeline'}
          </button>

          <Link
            className="studio-v2-button is-secondary"
            to="/admin/leads"
          >
            Legacy Leads
          </Link>
        </div>
      </header>

      <aside className="studio-pipeline-readonly-note">
        <strong>Real data connected</strong>
        <span>
          This first pass is intentionally read-only. Editing and
          conversion controls arrive after the real records and layout
          are verified.
        </span>
      </aside>

      {error && (
        <div className="studio-pipeline-alert is-error" role="alert">
          {error}
        </div>
      )}

      <section
        aria-label="Pipeline attention summary"
        className="studio-pipeline-attention"
      >
        <div>
          <span>Active leads</span>
          <strong>{pipeline?.metrics?.total || 0}</strong>
        </div>

        <div>
          <span>Urgent</span>
          <strong>{pipeline?.metrics?.urgent || 0}</strong>
        </div>

        <div>
          <span>Overdue follow-ups</span>
          <strong>{pipeline?.metrics?.overdue || 0}</strong>
        </div>

        <div>
          <span>Consultations scheduled</span>
          <strong>
            {pipeline?.metrics?.consultationBooked || 0}
          </strong>
        </div>

        <div>
          <span>Converted in 30 days</span>
          <strong>
            {pipeline?.metrics?.convertedLast30Days || 0}
          </strong>
        </div>
      </section>

      <section className="studio-pipeline-toolbar">
        <label className="studio-pipeline-search">
          <span>Search leads</span>
          <input
            onChange={(event) => {
              updateFilter('search', event.target.value)
            }}
            placeholder="Name, interest, source, email, or owner"
            type="search"
            value={filters.search}
          />
        </label>

        <label>
          <span>Priority</span>
          <select
            onChange={(event) => {
              updateFilter('priority', event.target.value)
            }}
            value={filters.priority}
          >
            <option value="all">All priorities</option>

            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Owner</span>
          <select
            onChange={(event) => {
              updateFilter('owner', event.target.value)
            }}
            value={filters.owner}
          >
            <option value="all">All owners</option>
            <option value="unassigned">Unassigned</option>

            {(pipeline?.teamUsers || []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName || user.email}
              </option>
            ))}
          </select>
        </label>

        {(filters.search
          || filters.priority !== 'all'
          || filters.owner !== 'all') && (
          <button
            className="studio-pipeline-clear"
            onClick={clearFilters}
            type="button"
          >
            Clear filters
          </button>
        )}
      </section>

      <nav
        aria-label="Pipeline stage view"
        className="studio-pipeline-view-switcher"
      >
        <button
          aria-pressed={stageView === 'all'}
          className={stageView === 'all' ? 'is-active' : ''}
          onClick={() => setStageView('all')}
          type="button"
        >
          All stages
        </button>

        {(pipeline?.stages || []).map((stage) => (
          <button
            aria-pressed={stageView === stage}
            className={stageView === stage ? 'is-active' : ''}
            key={stage}
            onClick={() => setStageView(stage)}
            type="button"
          >
            {stageLabels[stage] || stage}
          </button>
        ))}
      </nav>

      <div className="studio-pipeline-layout">
        <section
          aria-label="Lead pipeline board"
          className="studio-pipeline-board"
        >
          {loading && !pipeline ? (
            <div className="studio-pipeline-empty">
              <span>Loading the Pipeline...</span>
            </div>
          ) : visibleStages.map((stage) => (
            <section
              className="studio-pipeline-column"
              key={stage}
            >
              <header>
                <div>
                  <span>{stageLabels[stage] || stage}</span>
                  <strong>{leadsByStage[stage]?.length || 0}</strong>
                </div>
              </header>

              <div className="studio-pipeline-column-list">
                {(leadsByStage[stage] || []).map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onSelect={selectLead}
                    selected={lead.id === selectedLeadId}
                  />
                ))}

                {(leadsByStage[stage] || []).length === 0 && (
                  <div className="studio-pipeline-column-empty">
                    No matching leads
                  </div>
                )}
              </div>
            </section>
          ))}
        </section>

        <aside
          aria-label="Selected lead workspace"
          className="studio-pipeline-detail"
        >
          {detailLoading ? (
            <div className="studio-pipeline-empty">
              <span>Opening lead...</span>
            </div>
          ) : !selectedLead ? (
            <div className="studio-pipeline-empty">
              <strong>No lead selected</strong>
              <span>
                Select a lead to review the relationship and next action.
              </span>
            </div>
          ) : (
            <>
              <header className="studio-pipeline-detail-header">
                <div>
                  <p className="studio-v2-eyebrow">
                    {stageLabels[selectedLead.pipelineStage]
                      || selectedLead.pipelineStage}
                  </p>

                  <h2>{selectedLead.name}</h2>

                  <p>
                    {selectedLead.email || 'No email'}
                    {selectedLead.phone
                      ? ` | ${selectedLead.phone}`
                      : ''}
                  </p>
                </div>

                <span className={`studio-pipeline-priority is-${selectedLead.priority}`}>
                  {priorityLabels[selectedLead.priority]
                    || selectedLead.priority}
                </span>
              </header>

              <nav
                aria-label="Lead detail sections"
                className="studio-pipeline-detail-tabs"
              >
                {[
                  ['overview', 'Overview'],
                  ['followups', 'Follow-ups'],
                  ['activity', 'Activity'],
                ].map(([value, label]) => (
                  <button
                    aria-selected={detailView === value}
                    className={detailView === value ? 'is-active' : ''}
                    key={value}
                    onClick={() => setDetailView(value)}
                    role="tab"
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </nav>

              {detailView === 'overview' && (
                <section className="studio-pipeline-detail-section">
                  <dl className="studio-pipeline-facts">
                    <div>
                      <dt>Interest</dt>
                      <dd>
                        {selectedLead.interest || 'General inquiry'}
                      </dd>
                    </div>

                    <div>
                      <dt>Source</dt>
                      <dd>{selectedLead.source || 'Not recorded'}</dd>
                    </div>

                    <div>
                      <dt>Owner</dt>
                      <dd>{selectedLead.ownerName || 'Unassigned'}</dd>
                    </div>

                    <div>
                      <dt>Received</dt>
                      <dd>
                        {formatDate(
                          selectedLead.inquiryReceivedAt
                          || selectedLead.createdAt,
                          false,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>Next action</dt>
                      <dd>
                        {formatDate(selectedLead.nextFollowUpAt)}
                      </dd>
                    </div>

                    <div>
                      <dt>Status</dt>
                      <dd>
                        {selectedLead.clientStatus || 'Lead'}
                      </dd>
                    </div>
                  </dl>

                  <article className="studio-pipeline-summary">
                    <span>Relationship summary</span>
                    <p>
                      {selectedLead.summary
                        || 'No consultation or recommendation summary has been recorded yet.'}
                    </p>
                  </article>

                  {selectedLead.lostReason && (
                    <article className="studio-pipeline-summary">
                      <span>Closure context</span>
                      <p>{selectedLead.lostReason}</p>
                    </article>
                  )}
                </section>
              )}

              {detailView === 'followups' && (
                <section className="studio-pipeline-record-list">
                  {(detail.followUps || []).map((followUp) => (
                    <article key={followUp.id}>
                      <div>
                        <span className={`studio-pipeline-priority is-${followUp.priority}`}>
                          {priorityLabels[followUp.priority]
                            || followUp.priority}
                        </span>

                        <strong>{followUp.title}</strong>

                        {followUp.notes && <p>{followUp.notes}</p>}

                        <small>
                          {followUp.assigneeName || 'Unassigned'}
                          {' | '}
                          {formatDate(followUp.dueAt)}
                        </small>
                      </div>

                      <span className={`studio-pipeline-status is-${followUp.status}`}>
                        {followUp.status}
                      </span>
                    </article>
                  ))}

                  {(detail.followUps || []).length === 0 && (
                    <div className="studio-pipeline-empty is-compact">
                      No follow-ups recorded yet.
                    </div>
                  )}
                </section>
              )}

              {detailView === 'activity' && (
                <ol className="studio-pipeline-timeline">
                  {(detail.activities || []).map((activity) => (
                    <li key={activity.id}>
                      <span aria-hidden="true" />

                      <div>
                        <strong>{activity.title}</strong>

                        {activity.details && <p>{activity.details}</p>}

                        <small>
                          {activity.actorName || 'Studio team'}
                          {' | '}
                          {formatDate(activity.createdAt)}
                        </small>
                      </div>
                    </li>
                  ))}

                  {(detail.activities || []).length === 0 && (
                    <li className="studio-pipeline-empty is-compact">
                      No activity recorded yet.
                    </li>
                  )}
                </ol>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}