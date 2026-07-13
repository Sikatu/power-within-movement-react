import { useEffect, useMemo, useState } from 'react'
import AdminFrame from '../../components/admin/AdminFrame'
import {
  createAdminMailStudioEmailDraft,
  createAdminMailStudioTemplate,
  getAdminClients,
  getAdminMailStudioEmailLogs,
  getAdminMailStudioOverview,
  getAdminMailStudioTemplates,
  previewAdminMailStudioEmail,
  sendAdminMailStudioEmail,
  updateAdminMailStudioTemplate,
} from '../../lib/nativeApi'

import './Admin.css'
const emptyTemplateForm = {
  name: '',
  category: 'general',
  subject: '',
  bodyText: '',
  status: 'active',
}

const emptyComposer = {
  clientProfileId: '',
  templateId: '',
  resourceTitle: '',
  followUpNotes: '',
  sessionDate: '',
  customMessage: '',
}

function formatDateTime(value) {
  if (!value) return 'Not recorded'

  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return 'Not recorded'
  }
}

function formatCategory(value) {
  return String(value || 'general')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatStatus(value) {
  return String(value || 'active')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getClientName(client) {
  return (
    [client?.first_name, client?.last_name].filter(Boolean).join(' ') ||
    client?.email ||
    'Client'
  )
}

function getLogClientName(log) {
  return (
    [log?.first_name, log?.last_name].filter(Boolean).join(' ') ||
    log?.email_to ||
    'Client'
  )
}

function buildComposerPayload(composer) {
  return {
    clientProfileId: composer.clientProfileId,
    templateId: composer.templateId,
    variables: {
      resourceTitle: composer.resourceTitle,
      followUpNotes: composer.followUpNotes,
      sessionDate: composer.sessionDate,
      customMessage: composer.customMessage,
    },
  }
}

export default function AdminMailStudio() {
  const [overview, setOverview] = useState(null)
  const [templates, setTemplates] = useState([])
  const [emailLogs, setEmailLogs] = useState([])
  const [clients, setClients] = useState([])
  const [templateFilter, setTemplateFilter] = useState('active')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm)
  const [composer, setComposer] = useState(emptyComposer)
  const [composerPreview, setComposerPreview] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isDrafting, setIsDrafting] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates],
  )

  const selectedComposerClient = useMemo(
    () => clients.find((client) => client.id === composer.clientProfileId) || null,
    [clients, composer.clientProfileId],
  )

  const selectedComposerTemplate = useMemo(
    () => templates.find((template) => template.id === composer.templateId) || null,
    [composer.templateId, templates],
  )

  const metrics = overview?.metrics || {}

  async function loadMailStudio() {
    setIsLoading(true)
    setError('')

    try {
      const [
        overviewResponse,
        templatesResponse,
        logsResponse,
        clientsResponse,
      ] = await Promise.all([
        getAdminMailStudioOverview(),
        getAdminMailStudioTemplates(templateFilter),
        getAdminMailStudioEmailLogs(),
        getAdminClients(),
      ])

      const nextTemplates = templatesResponse.templates || []
      const nextClients = clientsResponse.clients || []

      setOverview(overviewResponse)
      setTemplates(nextTemplates)
      setEmailLogs(logsResponse.emailLogs || [])
      setClients(nextClients)

      setComposer((current) => ({
        ...current,
        clientProfileId: current.clientProfileId || nextClients[0]?.id || '',
        templateId: current.templateId || nextTemplates[0]?.id || '',
      }))
    } catch (loadError) {
      setError(loadError.message || 'Unable to load Mail Studio.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMailStudio()
    }, 0)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateFilter])

  function handleTemplateFormChange(event) {
    const { name, value } = event.target

    setTemplateForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleComposerChange(event) {
    const { name, value } = event.target

    setComposer((current) => ({
      ...current,
      [name]: value,
    }))

    setComposerPreview(null)
  }

  function handleSelectTemplate(template) {
    setSelectedTemplateId(template.id)
    setTemplateForm({
      name: template.name || '',
      category: template.category || 'general',
      subject: template.subject || '',
      bodyText: template.body_text || '',
      status: template.status || 'active',
    })
    setNotice('')
    setError('')
  }

  function handleNewTemplate() {
    setSelectedTemplateId('')
    setTemplateForm(emptyTemplateForm)
    setNotice('')
    setError('')
  }

  async function handleSaveTemplate(event) {
    event.preventDefault()

    setIsSaving(true)
    setNotice('')
    setError('')

    try {
      const payload = {
        name: templateForm.name,
        category: templateForm.category,
        subject: templateForm.subject,
        bodyText: templateForm.bodyText,
        status: templateForm.status,
      }

      if (selectedTemplateId) {
        await updateAdminMailStudioTemplate(selectedTemplateId, payload)
        setNotice('Mail template updated.')
      } else {
        await createAdminMailStudioTemplate(payload)
        setNotice('Mail template created.')
      }

      await loadMailStudio()
      handleNewTemplate()
    } catch (saveError) {
      setError(saveError.message || 'Unable to save this mail template.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePreviewComposerEmail() {
    setIsPreviewing(true)
    setNotice('')
    setError('')

    try {
      const response = await previewAdminMailStudioEmail(
        buildComposerPayload(composer),
      )

      setComposerPreview(response)
      setNotice('Email preview prepared.')
    } catch (previewError) {
      setError(previewError.message || 'Unable to preview this email.')
    } finally {
      setIsPreviewing(false)
    }
  }

  async function handleSaveComposerDraft() {
    setIsDrafting(true)
    setNotice('')
    setError('')

    try {
      const response = await createAdminMailStudioEmailDraft(
        buildComposerPayload(composer),
      )

      setComposerPreview(response)
      await loadMailStudio()
      setNotice('Email draft saved to Mail Studio activity.')
    } catch (draftError) {
      setError(draftError.message || 'Unable to save this email draft.')
    } finally {
      setIsDrafting(false)
    }
  }

  async function handleSendComposerEmail() {
    setIsSending(true)
    setNotice('')
    setError('')

    try {
      const response = await sendAdminMailStudioEmail(buildComposerPayload(composer))

      setComposerPreview(response)
      await loadMailStudio()
      setNotice('Email sent from Mail Studio.')
    } catch (sendError) {
      setError(sendError.message || 'Unable to send this email.')
    } finally {
      setIsSending(false)
    }
  }

  async function handleCopyPreview() {
    const draft = composerPreview?.draft

    if (!draft) return

    const text = `To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.bodyText}`

    try {
      await navigator.clipboard.writeText(text)
      setNotice('Email preview copied.')
    } catch {
      setNotice('Copy the email manually from the preview box.')
    }
  }

  function handleOpenEmailApp() {
    const draft = composerPreview?.draft

    if (!draft) return

    const mailto = `mailto:${encodeURIComponent(
      draft.to,
    )}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(
      draft.bodyText,
    )}`

    window.location.href = mailto
  }

  return (
    <AdminFrame>
      <section className="mail-studio-page-v1">
        <div className="admin-page-heading">
          <p className="admin-eyebrow">Letters & Broadcasts</p>
          <h1>Power Within Mail Studio</h1>
          <p>
            A private email command center for client invitations, follow-ups,
            portal resources, reminders, and future broadcasts.
          </p>
        </div>

        {notice && <div className="admin-notice is-success">{notice}</div>}
        {error && <div className="admin-notice is-error">{error}</div>}

        <div className="mail-studio-metrics-v1">
          <article>
            <span>Templates</span>
            <strong>{metrics.total_templates || 0}</strong>
            <p>{metrics.active_templates || 0} active</p>
          </article>

          <article>
            <span>Email Logs</span>
            <strong>{metrics.total_email_logs || 0}</strong>
            <p>Portal + client activity</p>
          </article>

          <article>
            <span>Sent</span>
            <strong>
              {(metrics.sent || 0) + (metrics.sent_manual || 0)}
            </strong>
            <p>Automatic + manual</p>
          </article>

          <article>
            <span>Needs Review</span>
            <strong>{metrics.failed || 0}</strong>
            <p>Failed delivery attempts</p>
          </article>
        </div>

        <section className="mail-studio-composer-v1">
          <div className="mail-studio-panel-header-v1">
            <div>
              <p className="admin-eyebrow">Composer</p>
              <h2>Prepare a Client Email</h2>
            </div>

            <span>
              {selectedComposerClient
                ? getClientName(selectedComposerClient)
                : 'No client selected'}
            </span>
          </div>

          <div className="mail-studio-composer-grid-v1">
            <div className="mail-studio-composer-form-v1">
              <label>
                <span>Client</span>
                <select
                  name="clientProfileId"
                  value={composer.clientProfileId}
                  onChange={handleComposerChange}
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {getClientName(client)}
                      {client.email ? `  ${client.email}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Template</span>
                <select
                  name="templateId"
                  value={composer.templateId}
                  onChange={handleComposerChange}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}  {formatCategory(template.category)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Resource Title</span>
                <input
                  name="resourceTitle"
                  value={composer.resourceTitle}
                  onChange={handleComposerChange}
                  placeholder="Optional: New guide, worksheet, or video"
                />
              </label>

              <label>
                <span>Session Date</span>
                <input
                  name="sessionDate"
                  value={composer.sessionDate}
                  onChange={handleComposerChange}
                  placeholder="Optional: July 10, 2026 at 2:00 PM"
                />
              </label>

              <label className="is-wide">
                <span>Follow-Up Notes</span>
                <textarea
                  name="followUpNotes"
                  value={composer.followUpNotes}
                  onChange={handleComposerChange}
                  rows={4}
                  placeholder="Optional notes for {{followUpNotes}}."
                />
              </label>

              <label className="is-wide">
                <span>Custom Message</span>
                <textarea
                  name="customMessage"
                  value={composer.customMessage}
                  onChange={handleComposerChange}
                  rows={4}
                  placeholder="Optional message for {{customMessage}}."
                />
              </label>

              <div className="mail-studio-composer-actions-v1">
                <button
                  type="button"
                  onClick={handlePreviewComposerEmail}
                  disabled={
                    isPreviewing ||
                    !composer.clientProfileId ||
                    !composer.templateId
                  }
                >
                  {isPreviewing ? 'Previewing...' : 'Preview Email'}
                </button>

                <button
                  type="button"
                  onClick={handleSaveComposerDraft}
                  disabled={
                    isDrafting ||
                    !composer.clientProfileId ||
                    !composer.templateId
                  }
                >
                  {isDrafting ? 'Saving...' : 'Save Draft Log'}
                </button>

                <button
                  type="button"
                  onClick={handleSendComposerEmail}
                  disabled={
                    isSending ||
                    !composer.clientProfileId ||
                    !composer.templateId
                  }
                >
                  {isSending ? 'Sending...' : 'Send Email Now'}
                </button>
              </div>
            </div>

            <div className="mail-studio-preview-v1">
              <div className="mail-studio-preview-header-v1">
                <div>
                  <span>Preview</span>
                  <strong>
                    {composerPreview?.draft?.subject ||
                      selectedComposerTemplate?.subject ||
                      'Choose a template to preview'}
                  </strong>
                </div>

                {composerPreview?.draft && (
                  <div>
                    <button type="button" onClick={handleCopyPreview}>
                      Copy
                    </button>
                    <button type="button" onClick={handleOpenEmailApp}>
                      Open Email App
                    </button>
                  </div>
                )}
              </div>

              {composerPreview?.draft ? (
                <div className="mail-studio-preview-body-v1">
                  <p>
                    <strong>To:</strong> {composerPreview.draft.to}
                  </p>
                  <p>
                    <strong>Subject:</strong> {composerPreview.draft.subject}
                  </p>
                  <textarea
                    value={composerPreview.draft.bodyText}
                    readOnly
                    rows={14}
                  />
                </div>
              ) : (
                <p className="mail-studio-empty-v1">
                  Click Preview Email to merge the selected template with the
                  selected client.
                </p>
              )}
            </div>
          </div>
        </section>

        <div className="mail-studio-grid-v1">
          <section className="mail-studio-panel-v1">
            <div className="mail-studio-panel-header-v1">
              <div>
                <p className="admin-eyebrow">Template Library</p>
                <h2>Reusable Brand Letters</h2>
              </div>

              <select
                value={templateFilter}
                onChange={(event) => setTemplateFilter(event.target.value)}
              >
                <option value="active">Active</option>
                <option value="all">All</option>
              </select>
            </div>

            {isLoading ? (
              <p className="mail-studio-empty-v1">Loading templates...</p>
            ) : templates.length === 0 ? (
              <p className="mail-studio-empty-v1">
                No templates yet. Create the first Power Within letter.
              </p>
            ) : (
              <div className="mail-studio-template-list-v1">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={
                      selectedTemplateId === template.id ? 'is-selected' : ''
                    }
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <span>{formatCategory(template.category)}</span>
                    <strong>{template.name}</strong>
                    <p>{template.subject}</p>
                    <small>{formatStatus(template.status)}</small>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="mail-studio-panel-v1">
            <div className="mail-studio-panel-header-v1">
              <div>
                <p className="admin-eyebrow">
                  {selectedTemplate ? 'Edit Template' : 'New Template'}
                </p>
                <h2>
                  {selectedTemplate
                    ? selectedTemplate.name
                    : 'Create a Brand Letter'}
                </h2>
              </div>

              <button type="button" onClick={handleNewTemplate}>
                New
              </button>
            </div>

            <form className="mail-studio-form-v1" onSubmit={handleSaveTemplate}>
              <label>
                <span>Template Name</span>
                <input
                  name="name"
                  value={templateForm.name}
                  onChange={handleTemplateFormChange}
                  placeholder="Example: Session Reminder"
                  required
                />
              </label>

              <label>
                <span>Category</span>
                <select
                  name="category"
                  value={templateForm.category}
                  onChange={handleTemplateFormChange}
                >
                  <option value="portal_invite">Portal Invite</option>
                  <option value="welcome">Welcome</option>
                  <option value="follow_up">Follow-Up</option>
                  <option value="resource_notice">Resource Notice</option>
                  <option value="session_reminder">Session Reminder</option>
                  <option value="broadcast">Broadcast</option>
                  <option value="general">General</option>
                </select>
              </label>

              <label>
                <span>Status</span>
                <select
                  name="status"
                  value={templateForm.status}
                  onChange={handleTemplateFormChange}
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              <label className="is-wide">
                <span>Subject</span>
                <input
                  name="subject"
                  value={templateForm.subject}
                  onChange={handleTemplateFormChange}
                  placeholder="Email subject line"
                  required
                />
              </label>

              <label className="is-wide">
                <span>Body</span>
                <textarea
                  name="bodyText"
                  value={templateForm.bodyText}
                  onChange={handleTemplateFormChange}
                  rows={13}
                  placeholder="Use tokens like {{clientName}}, {{resourceTitle}}, {{followUpNotes}}, {{sessionDate}}, {{customMessage}}."
                  required
                />
              </label>

              <div className="mail-studio-form-actions-v1">
                <button type="submit" disabled={isSaving}>
                  {isSaving
                    ? 'Saving...'
                    : selectedTemplateId
                      ? 'Save Template'
                      : 'Create Template'}
                </button>
              </div>
            </form>
          </section>
        </div>

        <section className="mail-studio-panel-v1 mail-studio-activity-v1">
          <div className="mail-studio-panel-header-v1">
            <div>
              <p className="admin-eyebrow">Email Activity</p>
              <h2>Recent Sent, Drafted, and Failed Emails</h2>
            </div>
          </div>

          {emailLogs.length === 0 ? (
            <p className="mail-studio-empty-v1">
              No email activity yet. Portal invite emails and composer emails
              will appear here.
            </p>
          ) : (
            <div className="mail-studio-log-list-v1">
              {emailLogs.slice(0, 12).map((log) => (
                <article key={log.id}>
                  <div>
                    <span>{formatStatus(log.status)}</span>
                    <strong>{log.subject}</strong>
                    <p>
                      {getLogClientName(log)}  {log.email_to}
                    </p>
                  </div>

                  <time>{formatDateTime(log.sent_at || log.created_at)}</time>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </AdminFrame>
  )
}
