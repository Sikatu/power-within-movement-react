import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import {
  addAdminLeadNote,
  createAdminLeadFollowUp,
  getAdminLeadDetail,
  getAdminLeadPipeline,
  updateAdminLead,
  updateAdminLeadFollowUp,
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

const emptyFollowUp = {
  title: '',
  notes: '',
  assignedToUserId: '',
  priority: 'normal',
  dueAt: '',
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

function toLocalDateTimeInput(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset()

  return new Date(date.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 16)
}

function toIsoOrNull(value) {
  if (!value) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function initialLeadForm(lead) {
  return {
    pipelineStage: lead?.pipelineStage || 'new_inquiry',
    priority: lead?.priority || 'normal',
    ownerUserId: lead?.ownerUserId || '',
    nextFollowUpAt: toLocalDateTimeInput(lead?.nextFollowUpAt),
    summary: lead?.summary || '',
    lostReason: lead?.lostReason || '',
  }
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
  const [leadForm, setLeadForm] = useState(initialLeadForm(null))
  const [followUpForm, setFollowUpForm] = useState(emptyFollowUp)
  const [note, setNote] = useState('')
  const [stageView, setStageView] = useState('all')
  const [detailView, setDetailView] = useState('overview')
  const [filters, setFilters] = useState({
    search: '',
    priority: 'all',
    owner: 'all',
  })
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pendingAction, setPendingAction] = useState(null)

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
      setLeadForm(initialLeadForm(null))
      return
    }

    setDetailLoading(true)
    setError('')
    setNotice('')

    try {
      const result = await getAdminLeadDetail(clientId)
      setDetail(result.detail || null)
      setLeadForm(initialLeadForm(result.detail?.lead))
    } catch (loadError) {
      setError(
        loadError.message
        || 'Unable to load this lead.',
      )
      setDetail(null)
      setLeadForm(initialLeadForm(null))
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

  useEffect(() => {
    if (!pendingAction) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !saving) {
        setPendingAction(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [pendingAction, saving])

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
    setPendingAction(null)
  }

  function syncMutationResult(result, fallbackMessage) {
    setPipeline(result.pipeline || pipeline)
    setDetail(result.detail || detail)
    setLeadForm(initialLeadForm(result.detail?.lead || detail?.lead))
    setNotice(result.message || fallbackMessage)
  }

  async function persistLead(payload) {
    if (!selectedLeadId) return

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const previousStage = selectedLead?.pipelineStage
      const result = await updateAdminLead(selectedLeadId, payload)

      syncMutationResult(result, 'Lead details saved.')

      if (
        payload.pipelineStage
        && payload.pipelineStage !== previousStage
      ) {
        setStageView(payload.pipelineStage)
      }
    } catch (saveError) {
      setError(
        saveError.message
        || 'Unable to save the lead details.',
      )
    } finally {
      setSaving(false)
      setPendingAction(null)
    }
  }

  async function handleLeadSave(event) {
    event.preventDefault()
    if (!selectedLeadId) return

    const payload = {
      pipelineStage: leadForm.pipelineStage,
      priority: leadForm.priority,
      ownerUserId: leadForm.ownerUserId || null,
      nextFollowUpAt: toIsoOrNull(leadForm.nextFollowUpAt),
      summary: leadForm.summary.trim(),
      lostReason: leadForm.lostReason.trim(),
    }

    const previousStage = selectedLead?.pipelineStage

    if (
      payload.pipelineStage === 'not_a_fit'
      && !payload.lostReason
    ) {
      setError(
        'Record a respectful closure reason before marking this lead as not a fit.',
      )
      return
    }

    if (
      payload.pipelineStage === 'converted'
      && previousStage !== 'converted'
    ) {
      setPendingAction({
        title: `Convert ${selectedLead?.name || 'this lead'}?`,
        message:
          'This changes the person to an active client and may start configured conversion automations.',
        detail:
          'Lead history, follow-ups, notes, and activity will remain available.',
        confirmLabel: 'Convert to client',
        payload,
      })
      return
    }

    if (
      payload.pipelineStage === 'not_a_fit'
      && previousStage !== 'not_a_fit'
    ) {
      setPendingAction({
        title: `Close ${selectedLead?.name || 'this lead'} as not a fit?`,
        message:
          'This makes the profile inactive and removes it from the active lead workload.',
        detail:
          'The recorded history remains available for future context and reporting.',
        confirmLabel: 'Mark as not a fit',
        payload,
      })
      return
    }

    await persistLead(payload)
  }

  async function handleFollowUpCreate(event) {
    event.preventDefault()
    if (!selectedLeadId) return

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await createAdminLeadFollowUp(
        selectedLeadId,
        {
          title: followUpForm.title.trim(),
          notes: followUpForm.notes.trim(),
          assignedToUserId:
            followUpForm.assignedToUserId || null,
          priority: followUpForm.priority,
          dueAt: toIsoOrNull(followUpForm.dueAt),
        },
      )

      syncMutationResult(result, 'Follow-up scheduled.')
      setFollowUpForm(emptyFollowUp)
    } catch (saveError) {
      setError(
        saveError.message
        || 'Unable to schedule the follow-up.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleFollowUpStatus(followUp, status) {
    if (!selectedLeadId) return

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await updateAdminLeadFollowUp(
        selectedLeadId,
        followUp.id,
        { status },
      )

      syncMutationResult(result, 'Follow-up updated.')
    } catch (saveError) {
      setError(
        saveError.message
        || 'Unable to update the follow-up.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleNoteAdd(event) {
    event.preventDefault()
    if (!selectedLeadId || !note.trim()) return

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await addAdminLeadNote(
        selectedLeadId,
        note.trim(),
      )

      setDetail(result.detail || detail)
      setNote('')
      setNotice(result.message || 'Private team note added.')
    } catch (saveError) {
      setError(
        saveError.message
        || 'Unable to add the private note.',
      )
    } finally {
      setSaving(false)
    }
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
            disabled={loading || saving}
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

      <aside className="studio-pipeline-actions-note">
        <strong>Protected actions enabled</strong>
        <span>
          Lead updates, assignments, next actions, follow-ups, notes,
          conversion, and closure now use the existing secured APIs.
        </span>
      </aside>

      {error && (
        <div className="studio-pipeline-alert is-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div
          className="studio-pipeline-alert is-success"
          role="status"
        >
          {notice}
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
                <form
                  className="studio-pipeline-action-form"
                  onSubmit={handleLeadSave}
                >
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
                      <dt>Status</dt>
                      <dd>{selectedLead.clientStatus || 'Lead'}</dd>
                    </div>
                  </dl>

                  <div className="studio-pipeline-form-grid">
                    <label>
                      <span>Pipeline stage</span>
                      <select
                        onChange={(event) => {
                          setLeadForm((current) => ({
                            ...current,
                            pipelineStage: event.target.value,
                          }))
                        }}
                        value={leadForm.pipelineStage}
                      >
                        {(pipeline?.stages || []).map((stage) => (
                          <option key={stage} value={stage}>
                            {stageLabels[stage] || stage}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Priority</span>
                      <select
                        onChange={(event) => {
                          setLeadForm((current) => ({
                            ...current,
                            priority: event.target.value,
                          }))
                        }}
                        value={leadForm.priority}
                      >
                        {Object.entries(priorityLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>

                    <label>
                      <span>Relationship owner</span>
                      <select
                        onChange={(event) => {
                          setLeadForm((current) => ({
                            ...current,
                            ownerUserId: event.target.value,
                          }))
                        }}
                        value={leadForm.ownerUserId}
                      >
                        <option value="">Unassigned</option>

                        {(pipeline?.teamUsers || []).map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.displayName || user.email}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Next action due</span>
                      <input
                        onChange={(event) => {
                          setLeadForm((current) => ({
                            ...current,
                            nextFollowUpAt: event.target.value,
                          }))
                        }}
                        type="datetime-local"
                        value={leadForm.nextFollowUpAt}
                      />
                    </label>
                  </div>

                  <label>
                    <span>
                      Consultation and recommendation summary
                    </span>
                    <textarea
                      onChange={(event) => {
                        setLeadForm((current) => ({
                          ...current,
                          summary: event.target.value,
                        }))
                      }}
                      placeholder="Needs, consultation context, recommendation, and decision notes"
                      rows="5"
                      value={leadForm.summary}
                    />
                  </label>

                  {leadForm.pipelineStage === 'not_a_fit' && (
                    <label>
                      <span>Closure reason</span>
                      <textarea
                        onChange={(event) => {
                          setLeadForm((current) => ({
                            ...current,
                            lostReason: event.target.value,
                          }))
                        }}
                        placeholder="Record a respectful private reason"
                        required
                        rows="3"
                        value={leadForm.lostReason}
                      />
                    </label>
                  )}

                  <div className="studio-pipeline-form-actions">
                    <Link
                      className="studio-v2-button is-secondary"
                      to={`/admin/client-360/${selectedLead.id}`}
                    >
                      Open Client 360
                    </Link>

                    <button
                      className="studio-v2-button is-primary"
                      disabled={saving}
                      type="submit"
                    >
                      {saving
                        ? 'Saving...'
                        : leadForm.pipelineStage === 'converted'
                          ? 'Convert and save'
                          : 'Save lead'}
                    </button>
                  </div>
                </form>
              )}

              {detailView === 'followups' && (
                <section className="studio-pipeline-workspace-section">
                  <form
                    className="studio-pipeline-action-form"
                    onSubmit={handleFollowUpCreate}
                  >
                    <header className="studio-pipeline-section-heading">
                      <div>
                        <p className="studio-v2-eyebrow">
                          Next action
                        </p>
                        <h3>Schedule follow-up</h3>
                      </div>

                      <span>
                        Create a clear action and assign ownership.
                      </span>
                    </header>

                    <label>
                      <span>Action</span>
                      <input
                        maxLength="240"
                        onChange={(event) => {
                          setFollowUpForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }}
                        placeholder="Send consultation recap"
                        required
                        value={followUpForm.title}
                      />
                    </label>

                    <div className="studio-pipeline-form-grid">
                      <label>
                        <span>Due date</span>
                        <input
                          onChange={(event) => {
                            setFollowUpForm((current) => ({
                              ...current,
                              dueAt: event.target.value,
                            }))
                          }}
                          required
                          type="datetime-local"
                          value={followUpForm.dueAt}
                        />
                      </label>

                      <label>
                        <span>Priority</span>
                        <select
                          onChange={(event) => {
                            setFollowUpForm((current) => ({
                              ...current,
                              priority: event.target.value,
                            }))
                          }}
                          value={followUpForm.priority}
                        >
                          {Object.entries(priorityLabels).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>

                      <label className="studio-pipeline-span-2">
                        <span>Assigned to</span>
                        <select
                          onChange={(event) => {
                            setFollowUpForm((current) => ({
                              ...current,
                              assignedToUserId: event.target.value,
                            }))
                          }}
                          value={followUpForm.assignedToUserId}
                        >
                          <option value="">Unassigned</option>

                          {(pipeline?.teamUsers || []).map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.displayName || user.email}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label>
                      <span>Notes</span>
                      <textarea
                        onChange={(event) => {
                          setFollowUpForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }}
                        placeholder="Context the assignee should know"
                        rows="3"
                        value={followUpForm.notes}
                      />
                    </label>

                    <button
                      className="studio-v2-button is-primary"
                      disabled={saving}
                      type="submit"
                    >
                      {saving ? 'Scheduling...' : 'Schedule follow-up'}
                    </button>
                  </form>

                  <div className="studio-pipeline-record-list">
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

                        <div className="studio-pipeline-record-actions">
                          <span className={`studio-pipeline-status is-${followUp.status}`}>
                            {followUp.status.replaceAll('_', ' ')}
                          </span>

                          {followUp.status === 'open' && (
                            <button
                              disabled={saving}
                              onClick={() => {
                                handleFollowUpStatus(
                                  followUp,
                                  'completed',
                                )
                              }}
                              type="button"
                            >
                              Complete
                            </button>
                          )}

                          {followUp.status === 'open' && (
                            <button
                              disabled={saving}
                              onClick={() => {
                                handleFollowUpStatus(
                                  followUp,
                                  'cancelled',
                                )
                              }}
                              type="button"
                            >
                              Cancel
                            </button>
                          )}

                          {followUp.status !== 'open' && (
                            <button
                              disabled={saving}
                              onClick={() => {
                                handleFollowUpStatus(
                                  followUp,
                                  'open',
                                )
                              }}
                              type="button"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      </article>
                    ))}

                    {(detail.followUps || []).length === 0 && (
                      <div className="studio-pipeline-empty is-compact">
                        No follow-ups recorded yet.
                      </div>
                    )}
                  </div>
                </section>
              )}

              {detailView === 'activity' && (
                <section className="studio-pipeline-workspace-section">
                  <form
                    className="studio-pipeline-note-form"
                    onSubmit={handleNoteAdd}
                  >
                    <label>
                      <span>Add private team note</span>
                      <textarea
                        onChange={(event) => {
                          setNote(event.target.value)
                        }}
                        placeholder="Add context the team should remember"
                        required
                        rows="3"
                        value={note}
                      />
                    </label>

                    <button
                      className="studio-v2-button is-primary"
                      disabled={saving || !note.trim()}
                      type="submit"
                    >
                      {saving ? 'Adding...' : 'Add note'}
                    </button>
                  </form>

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
                </section>
              )}
            </>
          )}
        </aside>
      </div>

      {pendingAction && (
        <div
          className="studio-pipeline-dialog-scrim"
          role="presentation"
        >
          <section
            aria-describedby="studio-pipeline-dialog-description"
            aria-labelledby="studio-pipeline-dialog-title"
            aria-modal="true"
            className="studio-pipeline-dialog"
            role="dialog"
          >
            <p className="studio-v2-eyebrow">Confirm change</p>

            <h2 id="studio-pipeline-dialog-title">
              {pendingAction.title}
            </h2>

            <p id="studio-pipeline-dialog-description">
              {pendingAction.message}
            </p>

            <small>{pendingAction.detail}</small>

            <div>
              <button
                className="studio-v2-button is-secondary"
                disabled={saving}
                onClick={() => setPendingAction(null)}
                type="button"
              >
                Cancel
              </button>

              <button
                className="studio-v2-button is-primary"
                disabled={saving}
                onClick={() => persistLead(pendingAction.payload)}
                type="button"
              >
                {saving ? 'Saving...' : pendingAction.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}