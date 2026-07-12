import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame'
import {
  addAdminLeadNote,
  createAdminLeadFollowUp,
  getAdminLeadDetail,
  getAdminLeadPipeline,
  updateAdminLead,
  updateAdminLeadFollowUp,
} from '../../lib/nativeApi'

import './Admin.css'
import './LeadPipeline.css'

const stageLabels = {
  new_inquiry: 'New inquiry',
  contacted: 'Contacted',
  consultation_booked: 'Consultation booked',
  qualified: 'Qualified',
  nurturing: 'Nurturing',
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

  try {
    return new Intl.DateTimeFormat(undefined, includeTime
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return 'Unknown date'
  }
}

function toLocalDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
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

const emptyFollowUp = {
  title: '',
  notes: '',
  assignedToUserId: '',
  priority: 'normal',
  dueAt: '',
}

function LeadCard({ lead, isSelected, onSelect }) {
  return (
    <button
      className={`lead-pipeline-card${isSelected ? ' is-selected' : ''}`}
      onClick={() => onSelect(lead.id)}
      type="button"
    >
      <div className="lead-pipeline-card-topline">
        <span className={`lead-priority lead-priority-${lead.priority}`}>
          {priorityLabels[lead.priority] || lead.priority}
        </span>
        {lead.overdueFollowUps > 0 && (
          <span className="lead-overdue-badge">{lead.overdueFollowUps} overdue</span>
        )}
      </div>
      <strong>{lead.name}</strong>
      <p>{lead.interest || 'General inquiry'}</p>
      <div className="lead-pipeline-card-meta">
        <span>{lead.ownerName || 'Unassigned'}</span>
        <span>{lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt, false) : 'No follow-up'}</span>
      </div>
    </button>
  )
}

export default function AdminLeadPipeline() {
  const [pipeline, setPipeline] = useState(null)
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [detail, setDetail] = useState(null)
  const [leadForm, setLeadForm] = useState(initialLeadForm(null))
  const [followUpForm, setFollowUpForm] = useState(emptyFollowUp)
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadPipeline = useCallback(async ({ preserveSelection = true } = {}) => {
    setIsLoading(true)
    setError('')

    try {
      const result = await getAdminLeadPipeline()
      setPipeline(result)

      const leads = result.leads || []
      const nextLeadId = preserveSelection && leads.some((lead) => lead.id === selectedLeadId)
        ? selectedLeadId
        : leads.find((lead) => lead.clientStatus === 'lead')?.id || leads[0]?.id || ''

      setSelectedLeadId(nextLeadId)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load the Leads & Intake Pipeline.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedLeadId])

  const loadDetail = useCallback(async (clientId) => {
    if (!clientId) {
      setDetail(null)
      return
    }

    setIsDetailLoading(true)
    setError('')

    try {
      const result = await getAdminLeadDetail(clientId)
      setDetail(result.detail || null)
      setLeadForm(initialLeadForm(result.detail?.lead))
    } catch (loadError) {
      setError(loadError.message || 'Unable to load this lead.')
      setDetail(null)
    } finally {
      setIsDetailLoading(false)
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
  }, [selectedLeadId, loadDetail])

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase()

    return (pipeline?.leads || []).filter((lead) => {
      if (priorityFilter !== 'all' && lead.priority !== priorityFilter) return false
      if (!query) return true

      return [
        lead.name,
        lead.email,
        lead.phone,
        lead.interest,
        lead.source,
        lead.ownerName,
      ].some((value) => String(value || '').toLowerCase().includes(query))
    })
  }, [pipeline?.leads, priorityFilter, search])

  const leadsByStage = useMemo(() => Object.fromEntries(
    (pipeline?.stages || []).map((stage) => [
      stage,
      filteredLeads.filter((lead) => lead.pipelineStage === stage),
    ]),
  ), [filteredLeads, pipeline?.stages])

  async function handleLeadSave(event) {
    event.preventDefault()
    if (!selectedLeadId) return

    setIsSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await updateAdminLead(selectedLeadId, {
        pipelineStage: leadForm.pipelineStage,
        priority: leadForm.priority,
        ownerUserId: leadForm.ownerUserId || null,
        nextFollowUpAt: toIsoOrNull(leadForm.nextFollowUpAt),
        summary: leadForm.summary,
        lostReason: leadForm.lostReason,
      })

      setNotice(result.message || 'Lead details saved.')
      setPipeline(result.pipeline || pipeline)
      setDetail(result.detail || detail)
      setLeadForm(initialLeadForm(result.detail?.lead))

      if (leadForm.pipelineStage === 'converted') {
        await loadPipeline({ preserveSelection: true })
      }
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the lead details.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleFollowUpCreate(event) {
    event.preventDefault()
    if (!selectedLeadId) return

    setIsSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await createAdminLeadFollowUp(selectedLeadId, {
        title: followUpForm.title,
        notes: followUpForm.notes,
        assignedToUserId: followUpForm.assignedToUserId || null,
        priority: followUpForm.priority,
        dueAt: toIsoOrNull(followUpForm.dueAt),
      })

      setNotice(result.message || 'Follow-up scheduled.')
      setPipeline(result.pipeline || pipeline)
      setDetail(result.detail || detail)
      setLeadForm(initialLeadForm(result.detail?.lead))
      setFollowUpForm(emptyFollowUp)
    } catch (saveError) {
      setError(saveError.message || 'Unable to schedule the follow-up.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleFollowUpStatus(followUp, status) {
    setIsSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await updateAdminLeadFollowUp(selectedLeadId, followUp.id, { status })
      setNotice(result.message || 'Follow-up updated.')
      setPipeline(result.pipeline || pipeline)
      setDetail(result.detail || detail)
      setLeadForm(initialLeadForm(result.detail?.lead))
    } catch (saveError) {
      setError(saveError.message || 'Unable to update the follow-up.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleNoteAdd(event) {
    event.preventDefault()
    if (!selectedLeadId || !note.trim()) return

    setIsSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await addAdminLeadNote(selectedLeadId, note.trim())
      setNotice(result.message || 'Lead note added.')
      setDetail(result.detail || detail)
      setNote('')
    } catch (saveError) {
      setError(saveError.message || 'Unable to add the note.')
    } finally {
      setIsSaving(false)
    }
  }

  const selectedLead = detail?.lead

  return (
    <AdminFrame>
      <div className="lead-pipeline-page">
        <header className="lead-pipeline-header">
          <div>
            <p className="eyebrow">Client growth</p>
            <h1>Leads & Intake Pipeline</h1>
            <p>
              A calm, native workspace for inquiries, consultation readiness,
              intentional follow-up, and client conversion.
            </p>
          </div>
          <div className="lead-pipeline-header-actions">
            <Link className="button secondary" to="/admin/clients">All clients</Link>
            <button className="button secondary" onClick={() => loadPipeline()} type="button">
              Refresh
            </button>
          </div>
        </header>

        {error && <div className="lead-pipeline-alert is-error" role="alert">{error}</div>}
        {notice && <div className="lead-pipeline-alert is-success" role="status">{notice}</div>}

        <section className="lead-pipeline-metrics" aria-label="Lead pipeline summary">
          <article><span>Active leads</span><strong>{pipeline?.metrics?.total || 0}</strong></article>
          <article><span>Urgent</span><strong>{pipeline?.metrics?.urgent || 0}</strong></article>
          <article><span>Overdue follow-ups</span><strong>{pipeline?.metrics?.overdue || 0}</strong></article>
          <article><span>Consultations booked</span><strong>{pipeline?.metrics?.consultationBooked || 0}</strong></article>
          <article><span>Converted in 30 days</span><strong>{pipeline?.metrics?.convertedLast30Days || 0}</strong></article>
        </section>

        <section className="lead-pipeline-toolbar">
          <label>
            <span>Search leads</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email, interest, source, or owner"
              type="search"
              value={search}
            />
          </label>
          <label>
            <span>Priority</span>
            <select onChange={(event) => setPriorityFilter(event.target.value)} value={priorityFilter}>
              <option value="all">All priorities</option>
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="lead-pipeline-board" aria-busy={isLoading}>
          {(pipeline?.stages || Object.keys(stageLabels)).map((stage) => (
            <article className="lead-pipeline-column" key={stage}>
              <header>
                <div>
                  <span>{stageLabels[stage] || stage}</span>
                  <strong>{leadsByStage[stage]?.length || 0}</strong>
                </div>
              </header>
              <div className="lead-pipeline-column-body">
                {(leadsByStage[stage] || []).map((lead) => (
                  <LeadCard
                    isSelected={lead.id === selectedLeadId}
                    key={lead.id}
                    lead={lead}
                    onSelect={setSelectedLeadId}
                  />
                ))}
                {!isLoading && !(leadsByStage[stage] || []).length && (
                  <p className="lead-pipeline-empty">No leads here.</p>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="lead-pipeline-workspace">
          {!selectedLeadId && (
            <div className="lead-pipeline-placeholder">
              <h2>Select a lead</h2>
              <p>Choose a lead card to review intake details and next steps.</p>
            </div>
          )}

          {selectedLeadId && isDetailLoading && (
            <div className="lead-pipeline-placeholder"><p>Loading lead workspace…</p></div>
          )}

          {selectedLead && !isDetailLoading && (
            <>
              <div className="lead-pipeline-detail-heading">
                <div>
                  <p className="eyebrow">Selected inquiry</p>
                  <h2>{selectedLead.name}</h2>
                  <p>{selectedLead.email || 'No email'} · {selectedLead.phone || 'No phone'}</p>
                </div>
                <div>
                  <Link className="button secondary" to={`/admin/client-360/${selectedLead.id}`}>
                    Open Client 360
                  </Link>
                  <Link className="button secondary" to={`/admin/clients/${selectedLead.id}`}>
                    Full profile
                  </Link>
                </div>
              </div>

              <div className="lead-pipeline-detail-grid">
                <form className="lead-pipeline-panel" onSubmit={handleLeadSave}>
                  <header>
                    <h3>Pipeline profile</h3>
                    <p>Shape the next best step without losing the human context.</p>
                  </header>

                  <div className="lead-pipeline-form-grid">
                    <label>
                      <span>Stage</span>
                      <select
                        onChange={(event) => setLeadForm((current) => ({ ...current, pipelineStage: event.target.value }))}
                        value={leadForm.pipelineStage}
                      >
                        {(pipeline?.stages || []).map((stage) => (
                          <option key={stage} value={stage}>{stageLabels[stage] || stage}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Priority</span>
                      <select
                        onChange={(event) => setLeadForm((current) => ({ ...current, priority: event.target.value }))}
                        value={leadForm.priority}
                      >
                        {Object.entries(priorityLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Lead owner</span>
                      <select
                        onChange={(event) => setLeadForm((current) => ({ ...current, ownerUserId: event.target.value }))}
                        value={leadForm.ownerUserId}
                      >
                        <option value="">Unassigned</option>
                        {(pipeline?.teamUsers || []).map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.displayName} · {user.role}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Next follow-up</span>
                      <input
                        onChange={(event) => setLeadForm((current) => ({ ...current, nextFollowUpAt: event.target.value }))}
                        type="datetime-local"
                        value={leadForm.nextFollowUpAt}
                      />
                    </label>
                  </div>

                  <label>
                    <span>Lead summary</span>
                    <textarea
                      onChange={(event) => setLeadForm((current) => ({ ...current, summary: event.target.value }))}
                      placeholder="What matters most, what they are seeking, and what should guide the next conversation."
                      rows="5"
                      value={leadForm.summary}
                    />
                  </label>

                  {leadForm.pipelineStage === 'not_a_fit' && (
                    <label>
                      <span>Not-a-fit reason</span>
                      <textarea
                        onChange={(event) => setLeadForm((current) => ({ ...current, lostReason: event.target.value }))}
                        placeholder="Capture the reason respectfully for future learning."
                        rows="3"
                        value={leadForm.lostReason}
                      />
                    </label>
                  )}

                  <button className="button" disabled={isSaving} type="submit">
                    {isSaving ? 'Saving…' : leadForm.pipelineStage === 'converted' ? 'Convert and save' : 'Save lead'}
                  </button>
                </form>

                <form className="lead-pipeline-panel" onSubmit={handleFollowUpCreate}>
                  <header>
                    <h3>Schedule follow-up</h3>
                    <p>Create a clear next action and assign it to the right team member.</p>
                  </header>

                  <label>
                    <span>Follow-up</span>
                    <input
                      onChange={(event) => setFollowUpForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Send consultation recap"
                      required
                      value={followUpForm.title}
                    />
                  </label>

                  <div className="lead-pipeline-form-grid">
                    <label>
                      <span>Due</span>
                      <input
                        onChange={(event) => setFollowUpForm((current) => ({ ...current, dueAt: event.target.value }))}
                        type="datetime-local"
                        value={followUpForm.dueAt}
                      />
                    </label>
                    <label>
                      <span>Priority</span>
                      <select
                        onChange={(event) => setFollowUpForm((current) => ({ ...current, priority: event.target.value }))}
                        value={followUpForm.priority}
                      >
                        {Object.entries(priorityLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="lead-pipeline-span-2">
                      <span>Assigned to</span>
                      <select
                        onChange={(event) => setFollowUpForm((current) => ({ ...current, assignedToUserId: event.target.value }))}
                        value={followUpForm.assignedToUserId}
                      >
                        <option value="">Unassigned</option>
                        {(pipeline?.teamUsers || []).map((user) => (
                          <option key={user.id} value={user.id}>{user.displayName}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label>
                    <span>Notes</span>
                    <textarea
                      onChange={(event) => setFollowUpForm((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="Context the assignee should know."
                      rows="4"
                      value={followUpForm.notes}
                    />
                  </label>

                  <button className="button" disabled={isSaving} type="submit">
                    {isSaving ? 'Scheduling…' : 'Schedule follow-up'}
                  </button>
                </form>
              </div>

              <div className="lead-pipeline-detail-grid lead-pipeline-lower-grid">
                <section className="lead-pipeline-panel">
                  <header>
                    <h3>Follow-up queue</h3>
                    <p>{detail.followUps?.length || 0} recorded action(s)</p>
                  </header>

                  <div className="lead-follow-up-list">
                    {(detail.followUps || []).map((followUp) => (
                      <article className={`lead-follow-up-item is-${followUp.status}`} key={followUp.id}>
                        <div>
                          <div className="lead-follow-up-topline">
                            <span className={`lead-priority lead-priority-${followUp.priority}`}>
                              {priorityLabels[followUp.priority]}
                            </span>
                            <span>{followUp.status.replaceAll('_', ' ')}</span>
                          </div>
                          <strong>{followUp.title}</strong>
                          <p>{followUp.notes || 'No additional notes.'}</p>
                          <small>
                            {followUp.assigneeName || 'Unassigned'} · {formatDate(followUp.dueAt)}
                          </small>
                        </div>
                        <div className="lead-follow-up-actions">
                          {followUp.status === 'open' && (
                            <button
                              className="button secondary"
                              disabled={isSaving}
                              onClick={() => handleFollowUpStatus(followUp, 'completed')}
                              type="button"
                            >
                              Complete
                            </button>
                          )}
                          {followUp.status !== 'cancelled' && followUp.status !== 'completed' && (
                            <button
                              className="button ghost"
                              disabled={isSaving}
                              onClick={() => handleFollowUpStatus(followUp, 'cancelled')}
                              type="button"
                            >
                              Cancel
                            </button>
                          )}
                          {followUp.status !== 'open' && (
                            <button
                              className="button ghost"
                              disabled={isSaving}
                              onClick={() => handleFollowUpStatus(followUp, 'open')}
                              type="button"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                    {!detail.followUps?.length && <p className="lead-pipeline-empty">No follow-ups yet.</p>}
                  </div>
                </section>

                <section className="lead-pipeline-panel">
                  <header>
                    <h3>Activity & notes</h3>
                    <p>A shared operational history for the team.</p>
                  </header>

                  <form className="lead-note-form" onSubmit={handleNoteAdd}>
                    <textarea
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Add a private team note…"
                      rows="3"
                      value={note}
                    />
                    <button className="button secondary" disabled={isSaving || !note.trim()} type="submit">
                      Add note
                    </button>
                  </form>

                  <div className="lead-activity-list">
                    {(detail.activities || []).map((activity) => (
                      <article key={activity.id}>
                        <span>{formatDate(activity.createdAt)}</span>
                        <strong>{activity.title}</strong>
                        {activity.details && <p>{activity.details}</p>}
                        <small>{activity.actorName}</small>
                      </article>
                    ))}
                    {!detail.activities?.length && <p className="lead-pipeline-empty">No activity recorded yet.</p>}
                  </div>
                </section>
              </div>
            </>
          )}
        </section>
      </div>
    </AdminFrame>
  )
}
