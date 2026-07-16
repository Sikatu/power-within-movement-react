import { useCallback, useEffect, useRef, useState } from 'react'
import AdminFrame from '../../components/admin/AdminFrame'
import {
  addClientToNewsletterAudience,
  bulkUpdateNewsletterAudienceSegments,
  bulkUpdateNewsletterAudienceTags,
  createNewsletterAudienceBulk,
  createNewsletterAudienceSubscriber,
  getAdminClients,
  getNewsletterAudiencePreviewCount,
  getNewsletterAudienceSubscriber,
  getNewsletterAudienceSubscribers,
  getNewsletterAudienceSummary,
  importNewsletterAudienceCsv,
  updateNewsletterAudienceStatus,
  updateNewsletterAudienceSubscriber,
} from '../../lib/nativeApi'

const emptySingle = {
  email: '',
  firstName: '',
  lastName: '',
  tags: '',
  segments: '',
  source: 'admin_manual',
  explicitConsent: false,
  notes: '',
}

const emptyFilters = { search: '', status: '', tag: '', segment: '', source: '', page: 1, limit: 50 }

function labels(value) {
  return [...new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean))]
}

function formatStatus(value) {
  return String(value || 'pending').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function memberName(member) {
  return [member?.first_name, member?.last_name].filter(Boolean).join(' ') || member?.email || 'Audience member'
}

function clientName(client) {
  return [client?.first_name, client?.last_name].filter(Boolean).join(' ') || client?.email || 'Client'
}

function splitManualEmails(value) {
  return [...new Set(String(value || '')
    .split(/[\n;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean))]
}

export default function AdminAudience() {
  const csvInputRef = useRef(null)
  const [summary, setSummary] = useState({ metrics: {}, tags: [], segments: [], sources: [], recentImports: [] })
  const [subscribers, setSubscribers] = useState([])
  const [clients, setClients] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 })
  const [filters, setFilters] = useState(emptyFilters)
  const [previewCount, setPreviewCount] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [detail, setDetail] = useState(null)
  const [entryMode, setEntryMode] = useState('single')
  const [single, setSingle] = useState(emptySingle)
  const [multipleEmails, setMultipleEmails] = useState('')
  const [multipleTags, setMultipleTags] = useState('')
  const [csvFile, setCsvFile] = useState(null)
  const [csvText, setCsvText] = useState('')
  const [csvTags, setCsvTags] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientConsent, setClientConsent] = useState(false)
  const [bulkLabelType, setBulkLabelType] = useState('tags')
  const [bulkLabelAction, setBulkLabelAction] = useState('add')
  const [bulkLabelValue, setBulkLabelValue] = useState('')
  const [detailDraft, setDetailDraft] = useState({ firstName: '', lastName: '', notes: '' })
  const [statusDraft, setStatusDraft] = useState('pending')
  const [restoreConsent, setRestoreConsent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const loadDirectory = useCallback(async () => {
    const [listResponse, previewResponse] = await Promise.all([
      getNewsletterAudienceSubscribers(filters),
      getNewsletterAudiencePreviewCount(filters),
    ])
    setSubscribers(listResponse.subscribers || [])
    setPagination(listResponse.pagination || { page: 1, limit: 50, total: 0 })
    setPreviewCount(previewResponse.eligible || 0)
    setSelectedIds((current) => current.filter((id) => listResponse.subscribers?.some((member) => member.id === id)))
    setSelectedId((current) => (
      listResponse.subscribers?.some((member) => member.id === current)
        ? current
        : listResponse.subscribers?.[0]?.id || ''
    ))
  }, [filters])

  const refreshWorkspace = useCallback(async ({ preserveNotice = false } = {}) => {
    setLoading(true)
    setError('')
    if (!preserveNotice) setNotice('')
    try {
      const [summaryResponse, clientsResponse] = await Promise.all([
        getNewsletterAudienceSummary(),
        getAdminClients(),
        loadDirectory(),
      ])
      setSummary(summaryResponse)
      setClients((clientsResponse.clients || []).filter((client) => client.client_status !== 'archived' && client.email))
    } catch (loadError) {
      setError(loadError.message || 'The newsletter audience could not open.')
    } finally {
      setLoading(false)
    }
  }, [loadDirectory])

  useEffect(() => {
    const timer = window.setTimeout(() => refreshWorkspace(), 0)
    return () => window.clearTimeout(timer)
  }, [refreshWorkspace])

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (!selectedId) {
        setDetail(null)
        return
      }
      try {
        const response = await getNewsletterAudienceSubscriber(selectedId)
        setDetail(response)
        setDetailDraft({
          firstName: response.subscriber?.first_name || '',
          lastName: response.subscriber?.last_name || '',
          notes: response.subscriber?.notes || '',
        })
        setStatusDraft(response.subscriber?.status || 'pending')
        setRestoreConsent(false)
      } catch (loadError) {
        setError(loadError.message || 'Audience member details could not load.')
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [selectedId])

  const allVisibleSelected = subscribers.length > 0 && subscribers.every((member) => selectedIds.includes(member.id))
  const selectedMember = detail?.subscriber || subscribers.find((member) => member.id === selectedId) || null
  const pageCount = Math.max(1, Math.ceil((pagination.total || 0) / (pagination.limit || 50)))
  const metrics = summary.metrics || {}

  async function runAction(key, action, successMessage) {
    setBusy(key)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(successMessage)
      await refreshWorkspace({ preserveNotice: true })
    } catch (actionError) {
      setError(actionError.message || 'The audience update could not be completed.')
    } finally {
      setBusy('')
    }
  }

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value, page: 1 }))
  }

  async function handleSingleSubmit(event) {
    event.preventDefault()
    await runAction('single', () => createNewsletterAudienceSubscriber({
      ...single,
      tags: labels(single.tags),
      segments: labels(single.segments),
      status: single.explicitConsent ? 'subscribed' : 'pending',
      consentStatus: single.explicitConsent ? 'granted' : 'not_recorded',
    }), single.explicitConsent ? 'Subscriber added with recorded consent.' : 'Audience member saved as pending until consent is recorded.')
    if (!error) setSingle(emptySingle)
  }

  async function handleMultipleSubmit(event) {
    event.preventDefault()
    const emails = splitManualEmails(multipleEmails)
    if (!emails.length) {
      setError('Enter at least one email address.')
      return
    }
    await runAction('multiple', () => createNewsletterAudienceBulk({
      recipients: emails.map((email) => ({
        email,
        status: 'pending',
        consentStatus: 'not_recorded',
        explicitConsent: false,
        source: 'admin_bulk',
        tags: labels(multipleTags),
      })),
    }), `${emails.length} address${emails.length === 1 ? '' : 'es'} processed safely. New records remain pending.`)
    setMultipleEmails('')
  }

  async function handleCsvFile(event) {
    const file = event.target.files?.[0]
    setCsvFile(file || null)
    setCsvText(file ? await file.text() : '')
  }

  async function handleCsvSubmit(event) {
    event.preventDefault()
    if (!csvText) {
      setError('Choose a CSV file first.')
      return
    }
    await runAction('csv', () => importNewsletterAudienceCsv({
      csv: csvText,
      fileName: csvFile?.name || 'audience-import.csv',
      source: 'csv_import',
      defaultTags: labels(csvTags),
    }), 'CSV processed. Invalid rows were isolated and unconsented rows remain pending.')
    setCsvFile(null)
    setCsvText('')
    if (csvInputRef.current) csvInputRef.current.value = ''
  }

  async function handleClientSubmit(event) {
    event.preventDefault()
    if (!clientConsent) {
      setError('Confirm that the client explicitly agreed to receive the newsletter.')
      return
    }
    await runAction('client', () => addClientToNewsletterAudience(clientId, {
      consentConfirmed: true,
      tags: ['Existing client'],
      segments: [],
    }), 'Client added as a separate newsletter subscriber with explicit consent recorded.')
    setClientId('')
    setClientConsent(false)
  }

  async function handleBulkLabels(event) {
    event.preventDefault()
    const nextLabels = labels(bulkLabelValue)
    if (!selectedIds.length || !nextLabels.length) {
      setError('Select audience members and enter at least one label.')
      return
    }
    const action = bulkLabelType === 'tags' ? bulkUpdateNewsletterAudienceTags : bulkUpdateNewsletterAudienceSegments
    await runAction('bulk-labels', () => action({
      subscriberIds: selectedIds,
      labels: nextLabels,
      action: bulkLabelAction,
    }), `${formatStatus(bulkLabelType)} ${bulkLabelAction === 'add' ? 'added to' : 'removed from'} ${selectedIds.length} audience member${selectedIds.length === 1 ? '' : 's'}.`)
    setBulkLabelValue('')
  }

  async function handleDetailSave(event) {
    event.preventDefault()
    if (!selectedMember) return
    await runAction('detail', () => updateNewsletterAudienceSubscriber(selectedMember.id, detailDraft), 'Audience member details saved.')
  }

  async function handleStatusChange(event) {
    event.preventDefault()
    if (!selectedMember) return
    if (statusDraft === 'subscribed' && !restoreConsent) {
      setError('Confirm current explicit consent before restoring subscribed status.')
      return
    }
    await runAction('status', () => updateNewsletterAudienceStatus(selectedMember.id, {
      status: statusDraft,
      explicitConsent: statusDraft === 'subscribed' ? restoreConsent : false,
      source: 'admin_status_change',
    }), `Status changed to ${formatStatus(statusDraft)}. Delivery protections were updated.`)
  }

  function toggleVisible() {
    setSelectedIds(allVisibleSelected ? [] : subscribers.map((member) => member.id))
  }

  function toggleMember(memberId) {
    setSelectedIds((current) => current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : [...current, memberId])
  }

  return (
    <AdminFrame>
      <section className="pwc-audience27-page">
        <header className="pwc-audience27-hero">
          <div>
            <p className="admin-eyebrow">Audience & Consent</p>
            <h1>Newsletter Audience</h1>
            <p>A durable recipient directory where consent, suppression, source, and history stay attached to every address.</p>
          </div>
          <aside aria-label="Current eligible audience">
            <span>Eligible now</span>
            <strong>{Number(metrics.eligible || 0).toLocaleString()}</strong>
            <small>Consent and suppression checked</small>
          </aside>
        </header>

        {error && <div className="pwc-audience27-alert is-error" role="alert">{error}</div>}
        {notice && <div className="pwc-audience27-alert is-success" role="status">{notice}</div>}

        <section className="pwc-audience27-metrics" aria-label="Audience status summary">
          {[
            ['Total directory', metrics.total],
            ['Subscribed', metrics.subscribed],
            ['Pending consent', metrics.pending],
            ['Unsubscribed', metrics.unsubscribed],
            ['Bounced', metrics.bounced],
            ['Suppressed', Number(metrics.suppressed || 0) + Number(metrics.complained || 0)],
          ].map(([label, value]) => <article key={label}><span>{label}</span><strong>{Number(value || 0).toLocaleString()}</strong></article>)}
        </section>

        <div className="pwc-audience27-entry-layout">
          <section className="pwc-audience27-panel pwc-audience27-entry">
            <header>
              <div><p className="admin-eyebrow">Add Recipients</p><h2>Grow the directory safely</h2></div>
              <span className="pwc-audience27-protection">Consent-aware</span>
            </header>
            <div className="pwc-audience27-tabs" role="tablist" aria-label="Audience entry methods">
              {[
                ['single', 'One email'],
                ['multiple', 'Multiple'],
                ['csv', 'CSV import'],
                ['client', 'Existing client'],
              ].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={entryMode === id} className={entryMode === id ? 'is-active' : ''} onClick={() => setEntryMode(id)}>{label}</button>
              ))}
            </div>

            {entryMode === 'single' && (
              <form className="pwc-audience27-form" onSubmit={handleSingleSubmit}>
                <label><span>Email</span><input type="email" value={single.email} onChange={(event) => setSingle((current) => ({ ...current, email: event.target.value }))} required /></label>
                <label><span>First name</span><input value={single.firstName} onChange={(event) => setSingle((current) => ({ ...current, firstName: event.target.value }))} /></label>
                <label><span>Last name</span><input value={single.lastName} onChange={(event) => setSingle((current) => ({ ...current, lastName: event.target.value }))} /></label>
                <label><span>Tags</span><input value={single.tags} onChange={(event) => setSingle((current) => ({ ...current, tags: event.target.value }))} placeholder="Reflection, Events" /></label>
                <label><span>Segments</span><input value={single.segments} onChange={(event) => setSingle((current) => ({ ...current, segments: event.target.value }))} placeholder="New season" /></label>
                <label className="is-wide"><span>Notes</span><textarea rows="2" value={single.notes} onChange={(event) => setSingle((current) => ({ ...current, notes: event.target.value }))} /></label>
                <label className="pwc-audience27-check is-wide"><input type="checkbox" checked={single.explicitConsent} onChange={(event) => setSingle((current) => ({ ...current, explicitConsent: event.target.checked }))} /><span>This person explicitly agreed to receive the newsletter. Leave unchecked to save as pending.</span></label>
                <button type="submit" disabled={busy === 'single'}>{busy === 'single' ? 'Saving…' : 'Save audience member'}</button>
              </form>
            )}

            {entryMode === 'multiple' && (
              <form className="pwc-audience27-form" onSubmit={handleMultipleSubmit}>
                <label className="is-wide"><span>Email addresses, one per line</span><textarea rows="6" value={multipleEmails} onChange={(event) => setMultipleEmails(event.target.value)} placeholder={'hello@example.com\nnotes@example.com'} required /></label>
                <label className="is-wide"><span>Tags for this group</span><input value={multipleTags} onChange={(event) => setMultipleTags(event.target.value)} placeholder="Manual import, July list" /></label>
                <p className="pwc-audience27-guidance is-wide">Manual bulk entry does not assume consent. New addresses are stored as pending.</p>
                <button type="submit" disabled={busy === 'multiple'}>{busy === 'multiple' ? 'Processing…' : 'Add pending addresses'}</button>
              </form>
            )}

            {entryMode === 'csv' && (
              <form className="pwc-audience27-form" onSubmit={handleCsvSubmit}>
                <label className="is-wide pwc-audience27-file"><span>CSV file</span><input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleCsvFile} required /><small>{csvFile ? csvFile.name : 'Choose a UTF-8 CSV up to 5,000 rows.'}</small></label>
                <label className="is-wide"><span>Default tags</span><input value={csvTags} onChange={(event) => setCsvTags(event.target.value)} placeholder="Legacy list, Workshop" /></label>
                <p className="pwc-audience27-guidance is-wide">Recognized columns: email, first_name, last_name, tags, segments, source, consent, consent_at, notes. Only rows with a true consent value become subscribed.</p>
                <button type="submit" disabled={busy === 'csv'}>{busy === 'csv' ? 'Importing…' : 'Validate and import CSV'}</button>
              </form>
            )}

            {entryMode === 'client' && (
              <form className="pwc-audience27-form" onSubmit={handleClientSubmit}>
                <label className="is-wide"><span>Client</span><select value={clientId} onChange={(event) => setClientId(event.target.value)} required><option value="">Choose a client</option>{clients.map((client) => <option key={client.id} value={client.id}>{clientName(client)} · {client.email}</option>)}</select></label>
                <label className="pwc-audience27-check is-wide"><input type="checkbox" checked={clientConsent} onChange={(event) => setClientConsent(event.target.checked)} /><span>I confirm this client explicitly agreed to newsletter email. Client service consent alone does not count.</span></label>
                <p className="pwc-audience27-guidance is-wide">The newsletter record remains separate from the client profile, so client removal never erases communication history.</p>
                <button type="submit" disabled={busy === 'client' || !clientId}>{busy === 'client' ? 'Linking…' : 'Add client with consent'}</button>
              </form>
            )}
          </section>

          <aside className="pwc-audience27-panel pwc-audience27-preview">
            <p className="admin-eyebrow">Audience Preview</p>
            <strong>{Number(previewCount).toLocaleString()}</strong>
            <h2>eligible recipients</h2>
            <p>Current search, tag, segment, and source filters are applied. Unsubscribed, bounced, complained, suppressed, pending, and unconsented addresses are excluded.</p>
            <div><span>Filter total</span><b>{Number(pagination.total || 0).toLocaleString()}</b></div>
            <div><span>Delivery protection</span><b>Enforced</b></div>
          </aside>
        </div>

        <section className="pwc-audience27-panel pwc-audience27-directory">
          <header>
            <div><p className="admin-eyebrow">Stored Directory</p><h2>Search, filter, and segment</h2></div>
            <span>{pagination.total || 0} matching</span>
          </header>
          <div className="pwc-audience27-filters">
            <label><span className="sr-only">Search audience</span><input type="search" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search name or email" /></label>
            <label><span className="sr-only">Status</span><select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">All statuses</option>{['subscribed', 'pending', 'unsubscribed', 'bounced', 'complained', 'suppressed'].map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></label>
            <label><span className="sr-only">Tag</span><select value={filters.tag} onChange={(event) => updateFilter('tag', event.target.value)}><option value="">All tags</option>{(summary.tags || []).map((tag) => <option key={tag.name} value={tag.name}>{tag.name} ({tag.count})</option>)}</select></label>
            <label><span className="sr-only">Segment</span><select value={filters.segment} onChange={(event) => updateFilter('segment', event.target.value)}><option value="">All segments</option>{(summary.segments || []).map((segment) => <option key={segment.id} value={segment.name}>{segment.name} ({segment.count})</option>)}</select></label>
            <label><span className="sr-only">Source</span><select value={filters.source} onChange={(event) => updateFilter('source', event.target.value)}><option value="">All sources</option>{(summary.sources || []).map((source) => <option key={source.source} value={source.source}>{formatStatus(source.source)} ({source.count})</option>)}</select></label>
            <button type="button" onClick={() => setFilters(emptyFilters)}>Clear</button>
          </div>

          {selectedIds.length > 0 && (
            <form className="pwc-audience27-bulk" onSubmit={handleBulkLabels}>
              <strong>{selectedIds.length} selected</strong>
              <select value={bulkLabelAction} onChange={(event) => setBulkLabelAction(event.target.value)}><option value="add">Add</option><option value="remove">Remove</option></select>
              <select value={bulkLabelType} onChange={(event) => setBulkLabelType(event.target.value)}><option value="tags">Tags</option><option value="segments">Segments</option></select>
              <input value={bulkLabelValue} onChange={(event) => setBulkLabelValue(event.target.value)} placeholder="Comma-separated labels" />
              <button type="submit" disabled={busy === 'bulk-labels'}>{busy === 'bulk-labels' ? 'Updating…' : 'Apply'}</button>
            </form>
          )}

          <div className="pwc-audience27-table-wrap">
            <table>
              <thead><tr><th><input type="checkbox" aria-label="Select visible audience" checked={allVisibleSelected} onChange={toggleVisible} /></th><th>Recipient</th><th>Status</th><th>Consent</th><th>Tags & segments</th><th>Source</th><th>Updated</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="7" className="pwc-audience27-empty">Loading the audience…</td></tr> : subscribers.length === 0 ? <tr><td colSpan="7" className="pwc-audience27-empty">No audience members match these filters.</td></tr> : subscribers.map((member) => (
                  <tr key={member.id} className={selectedId === member.id ? 'is-selected' : ''}>
                    <td><input type="checkbox" aria-label={`Select ${memberName(member)}`} checked={selectedIds.includes(member.id)} onChange={() => toggleMember(member.id)} /></td>
                    <td><button type="button" onClick={() => setSelectedId(member.id)}><strong>{memberName(member)}</strong><span>{member.email}</span></button></td>
                    <td><span className={`pwc-audience27-status is-${member.status}`}>{formatStatus(member.status)}</span>{member.active_suppression && <small>Suppression active</small>}</td>
                    <td><strong>{formatStatus(member.consent_status)}</strong><small>{member.consent_at ? formatDate(member.consent_at) : 'No consent timestamp'}</small></td>
                    <td><div className="pwc-audience27-labels">{[...(member.tags || []), ...(member.segments || []).map((segment) => `◦ ${segment}`)].slice(0, 4).map((label) => <span key={label}>{label}</span>)}</div></td>
                    <td>{formatStatus(member.source)}</td>
                    <td>{formatDate(member.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="pwc-audience27-pagination"><span>Page {pagination.page || 1} of {pageCount}</span><div><button type="button" disabled={(pagination.page || 1) <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button><button type="button" disabled={(pagination.page || 1) >= pageCount} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button></div></footer>
        </section>

        {selectedMember && (
          <section className="pwc-audience27-detail-grid">
            <article className="pwc-audience27-panel pwc-audience27-detail">
              <header><div><p className="admin-eyebrow">Recipient Record</p><h2>{memberName(selectedMember)}</h2><p>{selectedMember.email}</p></div><span className={`pwc-audience27-status is-${selectedMember.status}`}>{formatStatus(selectedMember.status)}</span></header>
              <form className="pwc-audience27-form" onSubmit={handleDetailSave}>
                <label><span>First name</span><input value={detailDraft.firstName} onChange={(event) => setDetailDraft((current) => ({ ...current, firstName: event.target.value }))} /></label>
                <label><span>Last name</span><input value={detailDraft.lastName} onChange={(event) => setDetailDraft((current) => ({ ...current, lastName: event.target.value }))} /></label>
                <label className="is-wide"><span>Internal notes</span><textarea rows="4" value={detailDraft.notes} onChange={(event) => setDetailDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
                <button type="submit" disabled={busy === 'detail'}>{busy === 'detail' ? 'Saving…' : 'Save details'}</button>
              </form>
              <div className="pwc-audience27-record-meta">
                <div><span>Tags</span><p>{selectedMember.tags?.join(', ') || 'None'}</p></div>
                <div><span>Segments</span><p>{selectedMember.segments?.join(', ') || 'None'}</p></div>
                <div><span>Source</span><p>{formatStatus(selectedMember.source)}</p></div>
                <div><span>Client link</span><p>{selectedMember.client_profile_id ? 'Linked without ownership' : 'Newsletter-only record'}</p></div>
              </div>
            </article>

            <article className="pwc-audience27-panel pwc-audience27-status-card">
              <p className="admin-eyebrow">Delivery Protection</p>
              <h2>Status & suppression</h2>
              <form onSubmit={handleStatusChange}>
                <label><span>Status</span><select value={statusDraft} onChange={(event) => { setStatusDraft(event.target.value); setRestoreConsent(false) }}>{['subscribed', 'pending', 'unsubscribed', 'bounced', 'complained', 'suppressed'].map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></label>
                {statusDraft === 'subscribed' && <label className="pwc-audience27-check"><input type="checkbox" checked={restoreConsent} onChange={(event) => setRestoreConsent(event.target.checked)} /><span>I verified current explicit newsletter consent.</span></label>}
                <button type="submit" disabled={busy === 'status'}>{busy === 'status' ? 'Applying…' : 'Apply protected status'}</button>
              </form>
              {selectedMember.active_suppression ? <div className="pwc-audience27-suppression"><strong>Active suppression</strong><p>{formatStatus(selectedMember.active_suppression.reason)} · {formatDate(selectedMember.active_suppression.createdAt)}</p></div> : <div className="pwc-audience27-suppression is-clear"><strong>No active suppression</strong><p>Eligibility still requires subscribed status and granted consent.</p></div>}
            </article>

            <article className="pwc-audience27-panel pwc-audience27-history">
              <header><div><p className="admin-eyebrow">Consent History</p><h2>Immutable audience events</h2></div><span>{detail?.consentHistory?.length || 0} events</span></header>
              <div>{detail?.consentHistory?.length ? detail.consentHistory.slice(0, 10).map((event) => <article key={event.id}><span>{formatStatus(event.event_type)}</span><strong>{formatStatus(event.status_after || event.consent_after)}</strong><p>{formatStatus(event.source)} · {formatDate(event.created_at)}</p></article>) : <p className="pwc-audience27-empty">No consent events recorded yet.</p>}</div>
            </article>

            <article className="pwc-audience27-panel pwc-audience27-history">
              <header><div><p className="admin-eyebrow">Send History</p><h2>Recipient delivery record</h2></div><span>{detail?.sendHistory?.length || 0} deliveries</span></header>
              <div>{detail?.sendHistory?.length ? detail.sendHistory.slice(0, 10).map((send) => <article key={send.id}><span>{formatStatus(send.delivery_status)}</span><strong>{send.subject || 'Newsletter delivery'}</strong><p>{formatDate(send.sent_at || send.created_at)}</p></article>) : <p className="pwc-audience27-empty">No newsletter delivery history yet. Broadcast sending begins in a later phase.</p>}</div>
            </article>
          </section>
        )}

        {(summary.recentImports || []).length > 0 && (
          <section className="pwc-audience27-panel pwc-audience27-imports">
            <header><div><p className="admin-eyebrow">Import Audit</p><h2>Recent manual and CSV changes</h2></div></header>
            <div>{summary.recentImports.map((record) => <article key={record.id}><div><strong>{record.file_name || 'Manual audience update'}</strong><span>{formatStatus(record.status)}</span></div><p>{record.created_count} created · {record.merged_count} merged · {record.duplicate_count} duplicates · {record.skipped_count} skipped</p><time>{formatDate(record.created_at)}</time></article>)}</div>
          </section>
        )}
      </section>
    </AdminFrame>
  )
}
