import { useEffect, useMemo, useState } from 'react'
import AdminFrame from '../../components/admin/AdminFrame'
import {
  createAdminIntakeTemplate,
  getAdminOnboardingStudio,
  runAdminBookingCommunications,
  startAdminClientOnboarding,
  updateAdminAppointmentOnboarding,
  updateAdminClientOnboarding,
  updateAdminIntakeTemplate,
} from '../../lib/nativeApi'


const emptyField = (position = 1) => ({
  fieldKey: `field_${position}`,
  label: '',
  helpText: '',
  placeholder: '',
  fieldType: 'short_text',
  required: false,
  options: [],
  position,
})

const emptyTemplate = {
  name: '',
  description: '',
  formScope: 'onboarding',
  status: 'draft',
  welcomeMessage: '',
  completionMessage: '',
  fields: [emptyField(1)],
}

const emptyOnboarding = {
  clientId: '',
  templateId: '',
  assignedToUserId: '',
  dueAt: '',
  status: 'not_started',
  clientWelcomeMessage: '',
  privateNotes: '',
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

function toDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function statusLabel(value) {
  return String(value || 'not_started').replaceAll('_', ' ')
}

function templateToForm(template) {
  if (!template) return { ...emptyTemplate, fields: [emptyField(1)] }
  return {
    name: template.name || '',
    description: template.description || '',
    formScope: template.formScope || 'onboarding',
    status: template.status || 'draft',
    welcomeMessage: template.welcomeMessage || '',
    completionMessage: template.completionMessage || '',
    fields: (template.fields || []).map((field, index) => ({
      ...field,
      options: Array.isArray(field.options) ? field.options : [],
      position: index + 1,
    })),
  }
}

function onboardingToForm(record) {
  if (!record) return { ...emptyOnboarding }
  return {
    clientId: record.clientProfileId,
    templateId: record.templateId || '',
    assignedToUserId: record.assignedToUserId || '',
    dueAt: toDateInput(record.dueAt),
    status: record.status || 'not_started',
    clientWelcomeMessage: record.clientWelcomeMessage || '',
    privateNotes: record.privateNotes || '',
  }
}

export default function AdminOnboardingStudio() {
  const [studio, setStudio] = useState(null)
  const [activeTab, setActiveTab] = useState('clients')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateForm, setTemplateForm] = useState({ ...emptyTemplate, fields: [emptyField(1)] })
  const [selectedRecordId, setSelectedRecordId] = useState('')
  const [onboardingForm, setOnboardingForm] = useState({ ...emptyOnboarding })
  const [isOnboardingEditorOpen, setIsOnboardingEditorOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const bookingTemplates = useMemo(
    () => (studio?.templates || []).filter((template) => template.formScope === 'booking'),
    [studio?.templates],
  )
  const onboardingTemplates = useMemo(
    () => (studio?.templates || []).filter((template) => template.formScope === 'onboarding'),
    [studio?.templates],
  )
  const activeBookingTemplates = useMemo(
    () => bookingTemplates.filter((template) => template.status === 'active'),
    [bookingTemplates],
  )
  const activeOnboardingTemplates = useMemo(
    () => onboardingTemplates.filter((template) => template.status === 'active'),
    [onboardingTemplates],
  )
  const selectedTemplate = useMemo(
    () => (studio?.templates || []).find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, studio?.templates],
  )
  const selectedRecord = useMemo(
    () => (studio?.onboardingRecords || []).find((record) => record.id === selectedRecordId) || null,
    [selectedRecordId, studio?.onboardingRecords],
  )

  function applyStudio(response, message = '') {
    setStudio({
      templates: response.templates || [],
      onboardingRecords: response.onboardingRecords || [],
      appointmentTypes: response.appointmentTypes || [],
      team: response.team || [],
      clients: response.clients || [],
      stats: response.stats || {},
    })
    if (message) setNotice(message)
  }

  useEffect(() => {
    let active = true
    getAdminOnboardingStudio()
      .then((response) => {
        if (!active) return
        applyStudio(response)
        const firstTemplate = response.templates?.[0]
        if (firstTemplate) {
          setSelectedTemplateId(firstTemplate.id)
          setTemplateForm(templateToForm(firstTemplate))
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Unable to open Booking & Onboarding.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
  }, [])

  function selectTemplate(template) {
    setSelectedTemplateId(template.id)
    setTemplateForm(templateToForm(template))
    setError('')
    setNotice('')
  }

  function startNewTemplate(scope = 'onboarding') {
    setSelectedTemplateId('')
    setTemplateForm({ ...emptyTemplate, formScope: scope, fields: [emptyField(1)] })
    setError('')
    setNotice('')
  }

  function updateTemplateField(event) {
    const { name, value } = event.target
    setTemplateForm((current) => ({ ...current, [name]: value }))
  }

  function updateFormField(index, key, value) {
    setTemplateForm((current) => ({
      ...current,
      fields: current.fields.map((field, fieldIndex) => (
        fieldIndex === index ? { ...field, [key]: value } : field
      )),
    }))
  }

  function addFormField() {
    setTemplateForm((current) => ({
      ...current,
      fields: [...current.fields, emptyField(current.fields.length + 1)],
    }))
  }

  function removeFormField(index) {
    setTemplateForm((current) => ({
      ...current,
      fields: current.fields
        .filter((_, fieldIndex) => fieldIndex !== index)
        .map((field, fieldIndex) => ({ ...field, position: fieldIndex + 1 })),
    }))
  }

  async function saveTemplate(event) {
    event.preventDefault()
    setIsSaving(true)
    setNotice('')
    setError('')
    try {
      const payload = {
        ...templateForm,
        fields: templateForm.fields.map((field, index) => ({
          ...field,
          position: index + 1,
          options: ['select', 'multiselect'].includes(field.fieldType)
            ? field.options
            : [],
        })),
      }
      const response = selectedTemplateId
        ? await updateAdminIntakeTemplate(selectedTemplateId, payload)
        : await createAdminIntakeTemplate(payload)
      applyStudio(response, response.message || 'Template saved.')
      setSelectedTemplateId(response.template?.id || '')
      setTemplateForm(templateToForm(response.template))
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the intake template.')
    } finally {
      setIsSaving(false)
    }
  }

  async function saveAppointmentSettings(appointment, changes) {
    setIsSaving(true)
    setNotice('')
    setError('')
    try {
      const payload = {
        bookingIntakeTemplateId: appointment.bookingIntakeTemplateId || null,
        onboardingTemplateId: appointment.onboardingTemplateId || null,
        autoCreateClientProfile: appointment.autoCreateClientProfile,
        autoStartOnboarding: appointment.autoStartOnboarding,
        sendConfirmationEmail: appointment.sendConfirmationEmail,
        reminder24hEnabled: appointment.reminder24hEnabled,
        reminder2hEnabled: appointment.reminder2hEnabled,
        ...changes,
      }
      const response = await updateAdminAppointmentOnboarding(appointment.id, payload)
      applyStudio(response, response.message || 'Appointment automation saved.')
    } catch (saveError) {
      setError(saveError.message || 'Unable to save appointment automation.')
    } finally {
      setIsSaving(false)
    }
  }

  function selectRecord(record) {
    setSelectedRecordId(record.id)
    setOnboardingForm(onboardingToForm(record))
    setIsOnboardingEditorOpen(true)
    setError('')
    setNotice('')
  }

  function startNewOnboarding() {
    setSelectedRecordId('')
    setOnboardingForm({
      ...emptyOnboarding,
      clientId: studio?.clients?.[0]?.id || '',
      templateId: activeOnboardingTemplates[0]?.id || '',
      assignedToUserId: studio?.team?.[0]?.id || '',
    })
    setIsOnboardingEditorOpen(true)
  }

  async function saveOnboarding(event) {
    event.preventDefault()
    if (!onboardingForm.clientId) return
    setIsSaving(true)
    setNotice('')
    setError('')
    try {
      const payload = {
        templateId: onboardingForm.templateId || null,
        assignedToUserId: onboardingForm.assignedToUserId || null,
        dueAt: onboardingForm.dueAt ? new Date(onboardingForm.dueAt).toISOString() : null,
        clientWelcomeMessage: onboardingForm.clientWelcomeMessage,
        privateNotes: onboardingForm.privateNotes,
        status: onboardingForm.status,
      }
      const response = selectedRecordId
        ? await updateAdminClientOnboarding(onboardingForm.clientId, payload)
        : await startAdminClientOnboarding(onboardingForm.clientId, payload)
      applyStudio(response, response.message || 'Client onboarding saved.')
      const nextRecord = response.onboardingRecords?.find(
        (record) => record.clientProfileId === onboardingForm.clientId,
      )
      setSelectedRecordId(nextRecord?.id || '')
      setOnboardingForm(onboardingToForm(nextRecord))
    } catch (saveError) {
      setError(saveError.message || 'Unable to save client onboarding.')
    } finally {
      setIsSaving(false)
    }
  }

  async function runDueMessages() {
    setIsSaving(true)
    setNotice('')
    setError('')
    try {
      const response = await runAdminBookingCommunications()
      applyStudio(response, response.message || 'Booking communications processed.')
    } catch (runError) {
      setError(runError.message || 'Unable to process booking communications.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <AdminFrame><div className="onboarding-studio-loading" aria-live="polite" aria-busy="true">Opening Booking & Onboarding...</div></AdminFrame>
  }

  return (
    <AdminFrame>
      <div className="onboarding-studio-page">
        <header className="onboarding-studio-header">
          <div>
            <p className="eyebrow">Client Journey</p>
            <h1>Onboarding</h1>
            <p>Move each client from booking to a prepared, welcoming start.</p>
          </div>
          <button type="button" onClick={runDueMessages} disabled={isSaving}>Send Due Messages</button>
        </header>

        {error && <div className="onboarding-studio-alert is-error" role="alert">{error}</div>}
        {notice && <div className="onboarding-studio-alert is-success" role="status">{notice}</div>}

        <section className="onboarding-studio-metrics" aria-label="Onboarding summary">
          <article><span>Active onboarding</span><strong>{studio?.stats?.active || 0}</strong></article>
          <article><span>Ready for review</span><strong>{studio?.stats?.submitted || 0}</strong></article>
          <article><span>Completed</span><strong>{studio?.stats?.completed || 0}</strong></article>
          <article><span>Overdue</span><strong>{studio?.stats?.overdue || 0}</strong></article>
          <article><span>Messages pending</span><strong>{studio?.stats?.communications?.pending || 0}</strong></article>
        </section>

        <nav className="onboarding-studio-tabs" aria-label="Booking and onboarding sections">
          <button className={activeTab === 'clients' ? 'is-active' : ''} type="button" onClick={() => setActiveTab('clients')}>Clients</button>
          <button className={activeTab === 'appointments' ? 'is-active' : ''} type="button" onClick={() => setActiveTab('appointments')}>Booking Rules</button>
          <button className={activeTab === 'templates' ? 'is-active' : ''} type="button" onClick={() => setActiveTab('templates')}>Forms</button>
        </nav>

        {activeTab === 'templates' && (
          <section className="onboarding-studio-layout">
            <aside className="onboarding-studio-list">
              <header><h2>Templates</h2><div><button type="button" onClick={() => startNewTemplate('booking')}>New Booking Form</button><button type="button" onClick={() => startNewTemplate('onboarding')}>New Onboarding Form</button></div></header>
              {(studio?.templates || []).map((template) => (
                <button className={selectedTemplateId === template.id ? 'is-selected' : ''} type="button" key={template.id} onClick={() => selectTemplate(template)}>
                  <span>{template.formScope}</span><strong>{template.name}</strong><small>{template.status} · {template.fields.length} fields</small>
                </button>
              ))}
            </aside>

            <form className="onboarding-template-editor" onSubmit={saveTemplate}>
              <header><div><p className="eyebrow">{selectedTemplate ? 'Edit Template' : 'New Template'}</p><h2>{templateForm.name || 'Untitled Intake Template'}</h2></div><button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Template'}</button></header>
              <div className="onboarding-form-grid">
                <label><span>Name</span><input name="name" value={templateForm.name} onChange={updateTemplateField} required /></label>
                <label><span>Purpose</span><select name="formScope" value={templateForm.formScope} onChange={updateTemplateField}><option value="booking">Booking request</option><option value="onboarding">Client onboarding</option></select></label>
                <label><span>Status</span><select name="status" value={templateForm.status} onChange={updateTemplateField}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
                <label className="is-wide"><span>Description</span><textarea name="description" rows="3" value={templateForm.description} onChange={updateTemplateField} /></label>
                <label className="is-wide"><span>Welcome message</span><textarea name="welcomeMessage" rows="3" value={templateForm.welcomeMessage} onChange={updateTemplateField} /></label>
                <label className="is-wide"><span>Completion message</span><textarea name="completionMessage" rows="3" value={templateForm.completionMessage} onChange={updateTemplateField} /></label>
              </div>

              <section className="onboarding-field-builder">
                <header><div><p className="eyebrow">Form Fields</p><h3>Questions and consent</h3></div><button type="button" onClick={addFormField}>Add Field</button></header>
                {templateForm.fields.map((field, index) => (
                  <article key={`${field.fieldKey}-${index}`}>
                    <div className="onboarding-field-number">{index + 1}</div>
                    <div className="onboarding-form-grid">
                      <label><span>Label</span><input value={field.label} onChange={(event) => updateFormField(index, 'label', event.target.value)} required /></label>
                      <label><span>Field key</span><input value={field.fieldKey} onChange={(event) => updateFormField(index, 'fieldKey', event.target.value)} required /></label>
                      <label><span>Type</span><select value={field.fieldType} onChange={(event) => updateFormField(index, 'fieldType', event.target.value)}><option value="short_text">Short text</option><option value="long_text">Long text</option><option value="email">Email</option><option value="phone">Phone</option><option value="date">Date</option><option value="select">Single choice</option><option value="multiselect">Multiple choice</option><option value="checkbox">Consent checkbox</option></select></label>
                      <label><span>Placeholder</span><input value={field.placeholder} onChange={(event) => updateFormField(index, 'placeholder', event.target.value)} /></label>
                      <label className="is-wide"><span>Help text</span><input value={field.helpText} onChange={(event) => updateFormField(index, 'helpText', event.target.value)} /></label>
                      {['select', 'multiselect'].includes(field.fieldType) && <label className="is-wide"><span>Options, separated by commas</span><input value={field.options.join(', ')} onChange={(event) => updateFormField(index, 'options', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} /></label>}
                    </div>
                    <div className="onboarding-field-actions"><label><input type="checkbox" checked={field.required} onChange={(event) => updateFormField(index, 'required', event.target.checked)} /> Required</label><button type="button" onClick={() => removeFormField(index)} disabled={templateForm.fields.length === 1}>Remove</button></div>
                  </article>
                ))}
              </section>
            </form>
          </section>
        )}

        {activeTab === 'appointments' && (
          <section className="onboarding-appointment-grid">
            {(studio?.appointmentTypes || []).map((appointment) => (
              <article key={appointment.id}>
                <header><div><span>{appointment.isActive ? 'Active' : 'Inactive'}</span><h2>{appointment.name}</h2></div><small>{appointment.requiresApproval ? 'Approval required' : 'Instant confirmation'}</small></header>
                <label><span>Booking intake form</span><select value={appointment.bookingIntakeTemplateId || ''} onChange={(event) => saveAppointmentSettings(appointment, { bookingIntakeTemplateId: event.target.value || null })}><option value="">No dynamic form</option>{activeBookingTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
                <label><span>Client onboarding form</span><select value={appointment.onboardingTemplateId || ''} onChange={(event) => saveAppointmentSettings(appointment, { onboardingTemplateId: event.target.value || null })}><option value="">No onboarding form</option>{activeOnboardingTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
                <div className="onboarding-toggle-list">
                  {[['autoCreateClientProfile', 'Create a lead and Client 360 automatically'], ['autoStartOnboarding', 'Start portal onboarding automatically'], ['sendConfirmationEmail', 'Send confirmation email'], ['reminder24hEnabled', 'Send a 24-hour reminder'], ['reminder2hEnabled', 'Send a 2-hour reminder']].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(appointment[key])} onChange={(event) => saveAppointmentSettings(appointment, { [key]: event.target.checked })} /><span>{label}</span></label>)}
                </div>
              </article>
            ))}
          </section>
        )}

        {activeTab === 'clients' && (
          <section className="onboarding-studio-layout">
            <aside className="onboarding-studio-list">
              <header><h2>Client Onboarding</h2><button type="button" onClick={startNewOnboarding}>Start Onboarding</button></header>
              {(studio?.onboardingRecords || []).map((record) => (
                <button className={selectedRecordId === record.id ? 'is-selected' : ''} type="button" key={record.id} onClick={() => selectRecord(record)}>
                  <span>{statusLabel(record.status)}</span><strong>{record.clientName}</strong><small>{record.templateName} · {formatDateTime(record.dueAt)}</small>
                </button>
              ))}
              {(studio?.onboardingRecords || []).length === 0 && <p className="onboarding-empty">No client onboarding records yet.</p>}
            </aside>

            {!isOnboardingEditorOpen ? (
              <section className="onboarding-start-card">
                <span aria-hidden="true">✦</span>
                <div>
                  <p className="eyebrow">Client journey</p>
                  <h2>Start onboarding when a client is ready.</h2>
                  <p>Choose an existing journey from the left, or begin a focused welcome flow for a new client.</p>
                </div>
                <button type="button" onClick={startNewOnboarding}>Start client onboarding</button>
              </section>
            ) : (
            <form className="onboarding-template-editor" onSubmit={saveOnboarding}>
              <header><div><p className="eyebrow">Client Journey</p><h2>{selectedRecord?.clientName || 'Start client onboarding'}</h2></div><button type="submit" disabled={isSaving || !onboardingForm.clientId}>{isSaving ? 'Saving...' : 'Save Onboarding'}</button></header>
              <div className="onboarding-form-grid">
                <label><span>Client</span><select value={onboardingForm.clientId} onChange={(event) => setOnboardingForm((current) => ({ ...current, clientId: event.target.value }))} disabled={Boolean(selectedRecordId)} required><option value="">Choose a client</option>{(studio?.clients || []).map((client) => <option key={client.id} value={client.id}>{client.name} · {client.email}</option>)}</select></label>
                <label><span>Template</span><select value={onboardingForm.templateId} onChange={(event) => setOnboardingForm((current) => ({ ...current, templateId: event.target.value }))}><option value="">No template</option>{activeOnboardingTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
                <label><span>Assigned team member</span><select value={onboardingForm.assignedToUserId} onChange={(event) => setOnboardingForm((current) => ({ ...current, assignedToUserId: event.target.value }))}><option value="">Unassigned</option>{(studio?.team || []).map((member) => <option key={member.id} value={member.id}>{member.displayName} · {member.role}</option>)}</select></label>
                <label><span>Due date</span><input type="datetime-local" value={onboardingForm.dueAt} onChange={(event) => setOnboardingForm((current) => ({ ...current, dueAt: event.target.value }))} /></label>
                {selectedRecordId && <label><span>Status</span><select value={onboardingForm.status} onChange={(event) => setOnboardingForm((current) => ({ ...current, status: event.target.value }))}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="submitted">Submitted</option><option value="reviewed">Reviewed</option><option value="completed">Completed</option><option value="paused">Paused</option></select></label>}
                <label className="is-wide"><span>Client welcome message</span><textarea rows="4" value={onboardingForm.clientWelcomeMessage} onChange={(event) => setOnboardingForm((current) => ({ ...current, clientWelcomeMessage: event.target.value }))} /></label>
                <label className="is-wide"><span>Private team notes</span><textarea rows="5" value={onboardingForm.privateNotes} onChange={(event) => setOnboardingForm((current) => ({ ...current, privateNotes: event.target.value }))} /></label>
              </div>

              {selectedRecord && (
                <section className="onboarding-response-review">
                  <header><div><p className="eyebrow">Submitted Responses</p><h3>Private intake review</h3></div><span>{Object.keys(selectedRecord.answers || {}).length} answers</span></header>
                  {Object.entries(selectedRecord.answers || {}).map(([key, value]) => <article key={key}><strong>{key.replaceAll('_', ' ')}</strong><p>{Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '—')}</p></article>)}
                  {Object.keys(selectedRecord.answers || {}).length === 0 && <p className="onboarding-empty">The client has not submitted responses yet.</p>}
                </section>
              )}
            </form>
            )}
          </section>
        )}
      </div>
    </AdminFrame>
  )
}
