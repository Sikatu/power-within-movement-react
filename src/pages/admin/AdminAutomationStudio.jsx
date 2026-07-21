import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminFrame from '../../components/admin/AdminFrame'
import {
  createAdminAutomationWorkflow,
  enrollAdminAutomationClient,
  getAdminAutomationStudio,
  runAdminDueAutomations,
  updateAdminAutomationEnrollment,
  updateAdminAutomationWorkflow,
} from '../../lib/nativeApi'


const triggerLabels = {
  manual: 'Manual enrollment',
  new_lead: 'New website inquiry',
  pipeline_stage: 'Lead enters a stage',
  client_converted: 'Lead converts to client',
}

const stageLabels = {
  new_inquiry: 'New inquiry',
  contacted: 'Contacted',
  consultation_booked: 'Consultation booked',
  qualified: 'Qualified',
  nurturing: 'Nurturing',
  converted: 'Converted',
  not_a_fit: 'Not a fit',
}

const statusLabels = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Needs attention',
}

function emptyStep(type = 'email') {
  return {
    stepType: type,
    delayMinutes: 0,
    templateId: '',
    subject: '',
    bodyText: '',
    taskTitle: '',
    taskNotes: '',
    taskPriority: 'normal',
    notificationTitle: '',
    notificationBody: '',
    notificationImportance: 'normal',
  }
}

const emptyWorkflow = {
  name: '',
  description: '',
  triggerType: 'manual',
  triggerStage: '',
  status: 'draft',
  defaultAssigneeUserId: '',
  steps: [],
}

function workflowToForm(workflow) {
  if (!workflow) return { ...emptyWorkflow, steps: [] }

  return {
    name: workflow.name || '',
    description: workflow.description || '',
    triggerType: workflow.triggerType || 'manual',
    triggerStage: workflow.triggerStage || '',
    status: workflow.status || 'draft',
    defaultAssigneeUserId: workflow.defaultAssigneeUserId || '',
    steps: (workflow.steps || []).map((step) => ({
      stepType: step.stepType,
      delayMinutes: Number(step.delayMinutes || 0),
      templateId: step.templateId || '',
      subject: step.subject || '',
      bodyText: step.bodyText || '',
      taskTitle: step.taskTitle || '',
      taskNotes: step.taskNotes || '',
      taskPriority: step.taskPriority || 'normal',
      notificationTitle: step.notificationTitle || '',
      notificationBody: step.notificationBody || '',
      notificationImportance: step.notificationImportance || 'normal',
    })),
  }
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled'

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return 'Unknown date'
  }
}

function formatDelay(minutes) {
  const total = Number(minutes || 0)
  if (total <= 0) return 'Immediately'
  if (total % 1440 === 0) return `${total / 1440} day${total === 1440 ? '' : 's'} later`
  if (total % 60 === 0) return `${total / 60} hour${total === 60 ? '' : 's'} later`
  return `${total} minutes later`
}

function stepLabel(step) {
  if (step.stepType === 'follow_up_task') return 'Create follow-up task'
  if (step.stepType === 'internal_notification') return 'Notify the team'
  return 'Send email'
}

export default function AdminAutomationStudio() {
  const [studio, setStudio] = useState(null)
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('')
  const [workflowForm, setWorkflowForm] = useState({ ...emptyWorkflow, steps: [] })
  const [enrollmentClientId, setEnrollmentClientId] = useState('')
  const [runImmediately, setRunImmediately] = useState(false)
  const [workspaceView, setWorkspaceView] = useState('activity')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const selectedWorkflow = useMemo(
    () => studio?.workflows?.find((workflow) => workflow.id === selectedWorkflowId) || null,
    [selectedWorkflowId, studio?.workflows],
  )

  const workflowEnrollments = useMemo(
    () => (studio?.enrollments || []).filter((item) => (
      !selectedWorkflowId || item.workflowId === selectedWorkflowId
    )),
    [selectedWorkflowId, studio?.enrollments],
  )

  const loadStudio = useCallback(async ({ preserveSelection = true } = {}) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await getAdminAutomationStudio()
      const nextStudio = response.studio || null
      const workflows = nextStudio?.workflows || []
      const nextWorkflowId = preserveSelection && workflows.some((item) => item.id === selectedWorkflowId)
        ? selectedWorkflowId
        : workflows[0]?.id || ''

      setStudio(nextStudio)
      setSelectedWorkflowId(nextWorkflowId)
      setWorkflowForm(workflowToForm(workflows.find((item) => item.id === nextWorkflowId)))
      setEnrollmentClientId((current) => current || nextStudio?.clients?.[0]?.id || '')
      if (!workflows.length) setWorkspaceView('builder')
    } catch (loadError) {
      setError(loadError.message || 'Unable to load Automation Studio.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedWorkflowId])

  useEffect(() => {
    const timer = window.setTimeout(() => loadStudio({ preserveSelection: false }), 0)
    return () => window.clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function selectWorkflow(workflow) {
    setSelectedWorkflowId(workflow.id)
    setWorkflowForm(workflowToForm(workflow))
    setNotice('')
    setError('')
  }

  function startNewWorkflow() {
    setSelectedWorkflowId('')
    setWorkflowForm({ ...emptyWorkflow, steps: [] })
    setNotice('')
    setError('')
    setWorkspaceView('builder')
  }

  function updateWorkflowField(event) {
    const { name, value } = event.target
    setWorkflowForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'triggerType' && value !== 'pipeline_stage' ? { triggerStage: '' } : {}),
    }))
  }

  function updateStep(index, field, value) {
    setWorkflowForm((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => (
        stepIndex === index ? { ...step, [field]: value } : step
      )),
    }))
  }

  function addStep(type) {
    setWorkflowForm((current) => ({
      ...current,
      steps: [...current.steps, emptyStep(type)],
    }))
  }

  function removeStep(index) {
    setWorkflowForm((current) => ({
      ...current,
      steps: current.steps.filter((_, stepIndex) => stepIndex !== index),
    }))
  }

  function moveStep(index, direction) {
    setWorkflowForm((current) => {
      const target = index + direction
      if (target < 0 || target >= current.steps.length) return current
      const steps = [...current.steps]
      const [step] = steps.splice(index, 1)
      steps.splice(target, 0, step)
      return { ...current, steps }
    })
  }

  async function saveWorkflow(event) {
    event.preventDefault()
    setIsSaving(true)
    setNotice('')
    setError('')

    try {
      const payload = {
        ...workflowForm,
        triggerStage: workflowForm.triggerType === 'pipeline_stage'
          ? workflowForm.triggerStage || null
          : null,
        defaultAssigneeUserId: workflowForm.defaultAssigneeUserId || null,
        steps: workflowForm.steps.map((step) => ({
          ...step,
          delayMinutes: Number(step.delayMinutes || 0),
          templateId: step.templateId || null,
        })),
      }

      const response = selectedWorkflowId
        ? await updateAdminAutomationWorkflow(selectedWorkflowId, payload)
        : await createAdminAutomationWorkflow(payload)

      setStudio(response.studio)
      const nextWorkflow = response.studio?.workflows?.find((item) => (
        item.id === response.workflow?.id
      ))
      setSelectedWorkflowId(nextWorkflow?.id || '')
      setWorkflowForm(workflowToForm(nextWorkflow))
      setNotice(response.message || 'Automation workflow saved.')
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the automation workflow.')
    } finally {
      setIsSaving(false)
    }
  }

  async function enrollClient(event) {
    event.preventDefault()
    if (!selectedWorkflowId || !enrollmentClientId) return

    setIsSaving(true)
    setNotice('')
    setError('')

    try {
      const response = await enrollAdminAutomationClient(selectedWorkflowId, {
        clientProfileId: enrollmentClientId,
        runNow: runImmediately,
      })
      setStudio(response.studio)
      setNotice(response.message || 'Client enrolled in this workflow.')
    } catch (enrollError) {
      setError(enrollError.message || 'Unable to enroll this client.')
    } finally {
      setIsSaving(false)
    }
  }

  async function enrollmentAction(enrollmentId, action) {
    setIsSaving(true)
    setNotice('')
    setError('')

    try {
      const response = await updateAdminAutomationEnrollment(enrollmentId, action)
      setStudio(response.studio)
      setNotice(response.message || 'Automation enrollment updated.')
    } catch (actionError) {
      setError(actionError.message || 'Unable to update this automation enrollment.')
    } finally {
      setIsSaving(false)
    }
  }

  async function runDueNow() {
    setIsSaving(true)
    setNotice('')
    setError('')

    try {
      const response = await runAdminDueAutomations()
      setStudio(response.studio)
      setNotice(response.message || 'Due automation steps processed.')
    } catch (runError) {
      setError(runError.message || 'Unable to process due automation steps.')
    } finally {
      setIsSaving(false)
    }
  }

  const metrics = studio?.metrics || {}

  return (
    <AdminFrame>
      <div className="automation-studio-page">
        <header className="automation-studio-header">
          <div>
            <p className="eyebrow">Client growth</p>
            <h1>Automations</h1>
            <p>Monitor client sequences, handle exceptions, and edit workflows when needed.</p>
          </div>
          <div className="automation-studio-header-actions">
            <button className="pwc-admin-secondary-button" onClick={startNewWorkflow} type="button">
              New workflow
            </button>
            <button
              className="pwc-admin-primary-button"
              disabled={isSaving}
              onClick={runDueNow}
              type="button"
            >
              Process due steps
            </button>
          </div>
        </header>

        {error && <div className="automation-studio-alert is-error" role="alert">{error}</div>}
        {notice && <div className="automation-studio-alert is-success" role="status">{notice}</div>}

        <section className="automation-studio-metrics" aria-label="Automation metrics">
          <article><span>Workflows</span><strong>{metrics.totalWorkflows || 0}</strong></article>
          <article><span>Active</span><strong>{metrics.activeWorkflows || 0}</strong></article>
          <article><span>Enrolled now</span><strong>{metrics.activeEnrollments || 0}</strong></article>
          <article><span>Needs attention</span><strong>{metrics.failedEnrollments || 0}</strong></article>
          <article><span>Steps completed</span><strong>{metrics.completedSteps30Days || 0}</strong><small>Last 30 days</small></article>
        </section>

        {isLoading ? (
          <section className="automation-studio-empty" aria-live="polite" aria-busy="true">Preparing Automation Studio…</section>
        ) : (
          <div className="automation-studio-layout">
            <aside className="automation-workflow-list">
              <header>
                <div>
                  <p className="eyebrow">Sequences</p>
                  <h2>Workflows</h2>
                </div>
                <span>{studio?.workflows?.length || 0}</span>
              </header>

              <div className="automation-workflow-list-body">
                {(studio?.workflows || []).map((workflow) => (
                  <button
                    className={`automation-workflow-card${workflow.id === selectedWorkflowId ? ' is-selected' : ''}`}
                    key={workflow.id}
                    onClick={() => selectWorkflow(workflow)}
                    type="button"
                  >
                    <div>
                      <span className={`automation-status automation-status-${workflow.status}`}>
                        {statusLabels[workflow.status] || workflow.status}
                      </span>
                      <span>{workflow.steps?.length || 0} steps</span>
                    </div>
                    <strong>{workflow.name}</strong>
                    <p>
                      {triggerLabels[workflow.triggerType] || workflow.triggerType}
                      {workflow.triggerStage ? ` · ${stageLabels[workflow.triggerStage]}` : ''}
                    </p>
                    <small>{workflow.activeEnrollmentCount || 0} active enrollments</small>
                  </button>
                ))}

                {!studio?.workflows?.length && (
                  <div className="automation-studio-empty">Create your first workflow to begin.</div>
                )}
              </div>
            </aside>

            <main className="automation-studio-workspace">
              <nav className="onboarding-studio-tabs" aria-label="Automation workspace">
                <button
                  className={workspaceView === 'activity' ? 'is-active' : ''}
                  onClick={() => setWorkspaceView('activity')}
                  type="button"
                >
                  People & activity ({workflowEnrollments.length})
                </button>
                <button
                  className={workspaceView === 'builder' ? 'is-active' : ''}
                  onClick={() => setWorkspaceView('builder')}
                  type="button"
                >
                  Workflow builder
                </button>
              </nav>

              {workspaceView === 'builder' && (
              <form className="automation-workflow-editor" onSubmit={saveWorkflow}>
                <header>
                  <div>
                    <p className="eyebrow">Workflow builder</p>
                    <h2>{selectedWorkflow ? selectedWorkflow.name : 'New automation workflow'}</h2>
                  </div>
                  <button className="pwc-admin-primary-button" disabled={isSaving} type="submit">
                    {isSaving ? 'Saving…' : 'Save workflow'}
                  </button>
                </header>

                <div className="automation-form-grid">
                  <label className="automation-field automation-field-wide">
                    <span>Workflow name</span>
                    <input name="name" onChange={updateWorkflowField} required value={workflowForm.name} />
                  </label>

                  <label className="automation-field">
                    <span>Trigger</span>
                    <select name="triggerType" onChange={updateWorkflowField} value={workflowForm.triggerType}>
                      {(studio?.triggerTypes || []).map((trigger) => (
                        <option key={trigger} value={trigger}>{triggerLabels[trigger] || trigger}</option>
                      ))}
                    </select>
                  </label>

                  {workflowForm.triggerType === 'pipeline_stage' && (
                    <label className="automation-field">
                      <span>Pipeline stage</span>
                      <select name="triggerStage" onChange={updateWorkflowField} required value={workflowForm.triggerStage}>
                        <option value="">Choose stage</option>
                        {(studio?.pipelineStages || []).map((stage) => (
                          <option key={stage} value={stage}>{stageLabels[stage] || stage}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="automation-field">
                    <span>Default team owner</span>
                    <select name="defaultAssigneeUserId" onChange={updateWorkflowField} value={workflowForm.defaultAssigneeUserId}>
                      <option value="">Lead owner or permanent Admin</option>
                      {(studio?.teamUsers || []).map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.displayName} · {user.role}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="automation-field">
                    <span>Status</span>
                    <select name="status" onChange={updateWorkflowField} value={workflowForm.status}>
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>

                  <label className="automation-field automation-field-wide">
                    <span>Purpose and internal guidance</span>
                    <textarea
                      name="description"
                      onChange={updateWorkflowField}
                      rows="3"
                      value={workflowForm.description}
                    />
                  </label>
                </div>

                <section className="automation-steps-section">
                  <header>
                    <div>
                      <p className="eyebrow">Sequence</p>
                      <h3>Workflow steps</h3>
                    </div>
                    <div className="automation-step-add-actions">
                      <button onClick={() => addStep('email')} type="button">+ Email</button>
                      <button onClick={() => addStep('follow_up_task')} type="button">+ Follow-up</button>
                      <button onClick={() => addStep('internal_notification')} type="button">+ Team alert</button>
                    </div>
                  </header>

                  <div className="automation-steps-list">
                    {workflowForm.steps.map((step, index) => (
                      <article className="automation-step-card" key={`${step.stepType}-${index}`}>
                        <header>
                          <div className="automation-step-number">{index + 1}</div>
                          <div>
                            <strong>{stepLabel(step)}</strong>
                            <span>{formatDelay(step.delayMinutes)}</span>
                          </div>
                          <div className="automation-step-controls">
                            <button disabled={index === 0} onClick={() => moveStep(index, -1)} type="button">↑</button>
                            <button disabled={index === workflowForm.steps.length - 1} onClick={() => moveStep(index, 1)} type="button">↓</button>
                            <button className="is-danger" onClick={() => removeStep(index)} type="button">Remove</button>
                          </div>
                        </header>

                        <div className="automation-step-grid">
                          <label className="automation-field">
                            <span>Wait before this step</span>
                            <div className="automation-delay-input">
                              <input
                                min="0"
                                onChange={(event) => updateStep(index, 'delayMinutes', event.target.value)}
                                type="number"
                                value={step.delayMinutes}
                              />
                              <em>minutes</em>
                            </div>
                          </label>

                          {step.stepType === 'email' && (
                            <>
                              <label className="automation-field">
                                <span>Mail template</span>
                                <select onChange={(event) => updateStep(index, 'templateId', event.target.value)} value={step.templateId}>
                                  <option value="">Custom email</option>
                                  {(studio?.templates || []).map((template) => (
                                    <option key={template.id} value={template.id}>
                                      {template.name} · {template.category}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="automation-field automation-field-wide">
                                <span>Custom subject or fallback subject</span>
                                <input onChange={(event) => updateStep(index, 'subject', event.target.value)} value={step.subject} />
                              </label>
                              <label className="automation-field automation-field-wide">
                                <span>Custom message or fallback message</span>
                                <textarea onChange={(event) => updateStep(index, 'bodyText', event.target.value)} rows="6" value={step.bodyText} />
                              </label>
                            </>
                          )}

                          {step.stepType === 'follow_up_task' && (
                            <>
                              <label className="automation-field automation-field-wide">
                                <span>Task title</span>
                                <input onChange={(event) => updateStep(index, 'taskTitle', event.target.value)} required value={step.taskTitle} />
                              </label>
                              <label className="automation-field">
                                <span>Priority</span>
                                <select onChange={(event) => updateStep(index, 'taskPriority', event.target.value)} value={step.taskPriority}>
                                  <option value="low">Low</option>
                                  <option value="normal">Normal</option>
                                  <option value="high">High</option>
                                  <option value="urgent">Urgent</option>
                                </select>
                              </label>
                              <label className="automation-field automation-field-wide">
                                <span>Task guidance</span>
                                <textarea onChange={(event) => updateStep(index, 'taskNotes', event.target.value)} rows="4" value={step.taskNotes} />
                              </label>
                            </>
                          )}

                          {step.stepType === 'internal_notification' && (
                            <>
                              <label className="automation-field automation-field-wide">
                                <span>Alert title</span>
                                <input onChange={(event) => updateStep(index, 'notificationTitle', event.target.value)} required value={step.notificationTitle} />
                              </label>
                              <label className="automation-field">
                                <span>Importance</span>
                                <select onChange={(event) => updateStep(index, 'notificationImportance', event.target.value)} value={step.notificationImportance}>
                                  <option value="normal">Normal</option>
                                  <option value="high">High</option>
                                  <option value="urgent">Urgent</option>
                                </select>
                              </label>
                              <label className="automation-field automation-field-wide">
                                <span>Alert message</span>
                                <textarea onChange={(event) => updateStep(index, 'notificationBody', event.target.value)} rows="4" value={step.notificationBody} />
                              </label>
                            </>
                          )}
                        </div>
                      </article>
                    ))}

                    {!workflowForm.steps.length && (
                      <div className="automation-studio-empty">
                        Add an email, follow-up task, or team alert. Draft workflows remain safe until activated.
                      </div>
                    )}
                  </div>

                  <p className="automation-variable-note">
                    Personalization variables: <code>{'{{clientName}}'}</code>, <code>{'{{firstName}}'}</code>,
                    {' '}<code>{'{{email}}'}</code>, <code>{'{{interest}}'}</code>, <code>{'{{pipelineStage}}'}</code>,
                    {' '}and <code>{'{{workflowName}}'}</code>.
                  </p>
                </section>
              </form>
              )}

              {workspaceView === 'activity' && (
              <>
              {selectedWorkflow && (
                <section className="automation-enrollment-panel">
                  <header>
                    <div>
                      <p className="eyebrow">Enrollment</p>
                      <h3>Start this workflow for a client</h3>
                    </div>
                    <span>{selectedWorkflow.activeEnrollmentCount || 0} active</span>
                  </header>

                  <form className="automation-enrollment-form" onSubmit={enrollClient}>
                    <label className="automation-field">
                      <span>Client or lead</span>
                      <select onChange={(event) => setEnrollmentClientId(event.target.value)} required value={enrollmentClientId}>
                        <option value="">Choose client</option>
                        {(studio?.clients || []).map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name} · {stageLabels[client.pipelineStage] || client.clientStatus}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="automation-checkbox-field">
                      <input checked={runImmediately} onChange={(event) => setRunImmediately(event.target.checked)} type="checkbox" />
                      <span>Process the first step immediately</span>
                    </label>
                    <button className="pwc-admin-primary-button" disabled={isSaving} type="submit">
                      Enroll client
                    </button>
                  </form>
                </section>
              )}

              <section className="automation-enrollment-panel">
                <header>
                  <div>
                    <p className="eyebrow">Activity</p>
                    <h3>Workflow enrollments</h3>
                  </div>
                  <span>{workflowEnrollments.length}</span>
                </header>

                <div className="automation-enrollment-list">
                  {workflowEnrollments.map((enrollment) => (
                    <article className="automation-enrollment-card" key={enrollment.id}>
                      <div>
                        <span className={`automation-status automation-status-${enrollment.status}`}>
                          {statusLabels[enrollment.status] || enrollment.status}
                        </span>
                        <strong>{enrollment.clientName}</strong>
                        <p>{enrollment.workflowName}</p>
                      </div>
                      <dl>
                        <div><dt>Next step</dt><dd>{enrollment.currentStepPosition}</dd></div>
                        <div><dt>Scheduled</dt><dd>{formatDateTime(enrollment.nextRunAt)}</dd></div>
                        <div><dt>Source</dt><dd>{triggerLabels[enrollment.triggerSource] || enrollment.triggerSource}</dd></div>
                      </dl>
                      {enrollment.lastError && <p className="automation-enrollment-error">{enrollment.lastError}</p>}
                      <div className="automation-enrollment-actions">
                        {enrollment.status === 'active' && (
                          <>
                            <button onClick={() => enrollmentAction(enrollment.id, 'run_now')} type="button">Run now</button>
                            <button onClick={() => enrollmentAction(enrollment.id, 'pause')} type="button">Pause</button>
                          </>
                        )}
                        {enrollment.status === 'paused' && (
                          <button onClick={() => enrollmentAction(enrollment.id, 'resume')} type="button">Resume</button>
                        )}
                        {enrollment.status === 'failed' && (
                          <button onClick={() => enrollmentAction(enrollment.id, 'retry')} type="button">Retry</button>
                        )}
                        {['active', 'paused', 'failed'].includes(enrollment.status) && (
                          <button className="is-danger" onClick={() => enrollmentAction(enrollment.id, 'cancel')} type="button">Cancel</button>
                        )}
                      </div>
                    </article>
                  ))}

                  {!workflowEnrollments.length && (
                    <div className="automation-studio-empty">No clients are enrolled in this workflow yet.</div>
                  )}
                </div>
              </section>
              </>
              )}
            </main>
          </div>
        )}
      </div>
    </AdminFrame>
  )
}
