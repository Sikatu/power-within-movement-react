import { useEffect, useState } from 'react'
import { createAdminEncouragement, getAdminClients } from '../../lib/nativeApi'

const messageTypeOptions = [
  {
    id: 'encouragement',
    label: 'Encouragement',
    description: 'A warm, steady note for a client’s day.',
  },
  {
    id: 'announcement',
    label: 'Portal announcement',
    description: 'A clear update clients should notice and remember.',
  },
]

function messageTypeCopy(value) {
  return value === 'announcement'
    ? {
        titlePlaceholder: 'A helpful update from Power Within',
        bodyPlaceholder: 'Share the update, what it means, and any next step…',
      }
    : {
        titlePlaceholder: 'A note of encouragement',
        bodyPlaceholder: 'Write your message of support or observation here…',
      }
}

export default function FounderMessageComposer({ onNotice, onError, onCancel }) {
  const [form, setForm] = useState({
    title: '',
    body: '',
    messageType: 'encouragement',
    visibility: 'all_members',
    clientProfileId: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [clients, setClients] = useState([])
  const [isLoadingClients, setIsLoadingClients] = useState(true)

  useEffect(() => {
    async function loadClients() {
      try {
        const response = await getAdminClients()
        setClients(response.clients || [])
      } catch (err) {
        console.error('Failed to load clients', err)
      } finally {
        setIsLoadingClients(false)
      }
    }
    loadClients()
  }, [])

  const copy = messageTypeCopy(form.messageType)
  const isDirect = form.visibility === 'specific_client'

  function updateForm(event) {
    const { name, value } = event.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  async function handleSend(mode) {
    setIsSaving(true)
    try {
      await createAdminEncouragement({
        title: form.title,
        body: form.body,
        messageType: form.messageType,
        visibility: form.visibility,
        clientProfileId: form.clientProfileId || null,
        status: mode === 'immediate' ? 'published' : 'draft',
      })
      onNotice(mode === 'immediate' ? 'Message sent successfully.' : 'Message saved as draft.')
      setForm({
        ...form,
        title: '',
        body: '',
        visibility: 'all_members',
        clientProfileId: '',
      })
      if (onCancel) onCancel()
    } catch (err) {
      onError(err.message || 'Failed to send message.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <article className="founder-home__panel founder-home__panel--compose">
      <div className="founder-home__panel-heading">
        <div>
          <p className="founder-home__eyebrow">Direct to clients</p>
          <h2>Share a message</h2>
        </div>
        {onCancel && (
          <button type="button" className="admin-button is-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <div className="founder-message__composer-body">
        <div className="admin-form-group">
          <label className="admin-form-label">Message type</label>
          <div className="admin-radio-grid">
            {messageTypeOptions.map((opt) => (
              <label
                key={opt.id}
                className={`admin-radio-card ${form.messageType === opt.id ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="messageType"
                  value={opt.id}
                  checked={form.messageType === opt.id}
                  onChange={updateForm}
                  className="admin-sr-only"
                />
                <strong>{opt.label}</strong>
                <p>{opt.description}</p>
              </label>
            ))}
          </div>
        </div>

        <div className="founder-message__composer-row">
          <div className="admin-form-group">
            <label className="admin-form-label">Audience</label>
            <select
              className="admin-input"
              name="visibility"
              value={form.visibility}
              onChange={updateForm}
            >
              <option value="all_members">All members</option>
              <option value="specific_client">A specific client</option>
            </select>
          </div>

          {isDirect && (
            <div className="admin-form-group">
              <label className="admin-form-label">Select client</label>
              <select
                className="admin-input"
                name="clientProfileId"
                value={form.clientProfileId}
                onChange={updateForm}
                disabled={isLoadingClients}
              >
                <option value="">Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="admin-form-group">
          <label className="admin-form-label">Title</label>
          <input
            className="admin-input"
            type="text"
            name="title"
            value={form.title}
            onChange={updateForm}
            placeholder={copy.titlePlaceholder}
          />
        </div>

        <div className="admin-form-group">
          <label className="admin-form-label">Message body</label>
          <textarea
            className="admin-input founder-message__textarea"
            name="body"
            value={form.body}
            onChange={updateForm}
            placeholder={copy.bodyPlaceholder}
            rows={5}
          />
        </div>

        <div className="founder-message__actions">
          <button
            type="button"
            className="admin-button is-primary"
            onClick={() => handleSend('immediate')}
            disabled={isSaving || !form.title || !form.body || (isDirect && !form.clientProfileId)}
          >
            {isSaving ? 'Sending...' : 'Send now'}
          </button>
        </div>
      </div>
    </article>
  )
}
