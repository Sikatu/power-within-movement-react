import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame.jsx'
import { useAdminConfirm } from '../../components/admin/AdminConfirmContext.js'
import LetterBlockSettings from '../../components/admin/LetterBlockSettings.jsx'
import LetterCanvas from '../../components/admin/LetterCanvas.jsx'
import {
  cancelLetterBroadcast,
  createLetter,
  duplicateLetter,
  getLetter,
  getLetterBroadcast,
  getLetterBroadcastExportUrl,
  getLetterBuilderOverview,
  getLetterVersions,
  getNewsletterAudienceSubscribers,
  getNewsletterAudienceSummary,
  prepareLetterBroadcast,
  previewLetterAudience,
  processDueLetterBroadcasts,
  restoreLetterVersion,
  saveLetter,
  saveLetterAsTemplate,
  scheduleLetterBroadcast,
  sendLetterBroadcastNow,
  sendLetterTest,
} from '../../lib/nativeApi.js'

const workspaceTabs = [
  ['letters', 'Letters'],
  ['delivery', 'Delivery'],
  ['results', 'Results'],
]

const blockPalette = [
  ['heading', 'Heading', 'H'],
  ['text', 'Text', '¶'],
  ['image', 'Image', '▧'],
  ['button', 'Button', '→'],
  ['divider', 'Divider', '—'],
  ['spacer', 'Spacer', '↕'],
  ['two_column', 'Two columns', '▥'],
  ['quote', 'Quote', '“'],
  ['signature', 'Signature', '✦'],
  ['social_links', 'Social links', '◎'],
  ['video_preview', 'Video preview', '▶'],
  ['resource', 'Resource', '↓'],
  ['greeting', 'Personal greeting', '{ }'],
  ['footer', 'Footer', 'F'],
]

const defaultBlockContent = {
  heading: { text: 'A heading for your letter', level: 2 },
  text: { text: 'Write your thoughtful message here.' },
  image: { assetId: '', alt: 'Power Within newsletter image', caption: '' },
  button: { text: 'Continue your journey', url: 'https://powerwithinmovement.com' },
  divider: {},
  spacer: {},
  two_column: { left: 'A reflection for today.', right: 'A next step for tomorrow.' },
  quote: { text: 'You are not starting over. You are returning to yourself.', attribution: 'Power Within Collective' },
  signature: { name: 'Kim Mittelstadt', title: 'Power Within Collective' },
  social_links: { website: 'https://powerwithinmovement.com', instagram: '', facebook: '', youtube: '' },
  video_preview: { assetId: '', title: 'Watch this private reflection', url: '' },
  resource: { assetId: '', title: 'Download your resource', description: '' },
  greeting: { text: 'Hello {{firstName}},' },
  footer: { text: 'Power Within Collective · Thoughtful support for a new season.' },
}

const defaultBlockSettings = {
  heading: { align: 'center', padding: 20 },
  text: { align: 'left', padding: 16 },
  image: { align: 'center', padding: 12, width: 100 },
  button: { align: 'center', padding: 18 },
  divider: { align: 'left', padding: 14, color: '#dfcdbf' },
  spacer: { align: 'left', padding: 0, height: 32 },
  two_column: { align: 'left', padding: 16, gap: 20 },
  quote: { align: 'center', padding: 22 },
  signature: { align: 'left', padding: 18 },
  social_links: { align: 'center', padding: 16 },
  video_preview: { align: 'center', padding: 16 },
  resource: { align: 'left', padding: 16 },
  greeting: { align: 'left', padding: 16 },
  footer: { align: 'center', padding: 18 },
}

const initialAudienceFilter = { mode: 'all', tag: '', segment: '', source: '', subscriberIds: [] }

function makeBlock(type, source = null) {
  const id = `${type}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`
  return {
    id,
    type,
    content: { ...(defaultBlockContent[type] || {}), ...(source?.content || {}) },
    settings: { ...(defaultBlockSettings[type] || { align: 'left', padding: 16 }), ...(source?.settings || {}), backgroundColor: source?.settings?.backgroundColor || 'transparent' },
  }
}

function formatStatus(value) {
  return String(value || 'draft').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function rate(part, whole) {
  return Number(whole || 0) ? `${((Number(part || 0) / Number(whole)) * 100).toFixed(1)}%` : '0.0%'
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function readCachedAdminUser() {
  try {
    return JSON.parse(window.sessionStorage.getItem('pwc_admin_user') || 'null')
  } catch {
    return null
  }
}

export default function AdminLetters() {
  const requestConfirm = useAdminConfirm()
  const [searchParams] = useSearchParams()
  const [adminUser] = useState(readCachedAdminUser)
  const [activeTab, setActiveTab] = useState('letters')
  const [libraryMode, setLibraryMode] = useState('drafts')
  const [creatingLetter, setCreatingLetter] = useState(false)
  const [deliveryView, setDeliveryView] = useState('scheduled')
  const [overview, setOverview] = useState({ metrics: {}, letters: [], templates: [], broadcasts: [] })
  const [audience, setAudience] = useState({ metrics: {}, tags: [], segments: [], sources: [] })
  const [audienceMembers, setAudienceMembers] = useState([])
  const [working, setWorking] = useState(null)
  const [selectedBlockId, setSelectedBlockId] = useState('')
  const [versions, setVersions] = useState([])
  const [selectedBroadcast, setSelectedBroadcast] = useState(null)
  const [newLetter, setNewLetter] = useState({ title: '', templateId: '' })
  const [previewMode, setPreviewMode] = useState('desktop')
  const [flowStep, setFlowStep] = useState('design')
  const [audienceFilter, setAudienceFilter] = useState(initialAudienceFilter)
  const [audiencePreview, setAudiencePreview] = useState(0)
  const [preparedBroadcast, setPreparedBroadcast] = useState(null)
  const [testEmail, setTestEmail] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState('saved')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const saveSequenceRef = useRef(0)
  const editVersionRef = useRef(0)
  const audiencePreviewSequenceRef = useRef(0)
  const audiencePreviewTimerRef = useRef(null)
  const requestedLetterRef = useRef('')

  const loadWorkspace = useCallback(async ({ preserveMessages = false } = {}) => {
    setLoading(true)
    if (!preserveMessages) {
      setError('')
      setNotice('')
    }
    try {
      const [overviewResponse, audienceResponse, membersResponse] = await Promise.all([
        getLetterBuilderOverview(),
        getNewsletterAudienceSummary(),
        getNewsletterAudienceSubscribers({ status: 'subscribed', limit: 100 }),
      ])
      setOverview(overviewResponse)
      setAudience(audienceResponse)
      setAudienceMembers(membersResponse.subscribers || [])
    } catch (loadError) {
      setError(loadError.message || 'Letters & Broadcasts could not open.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => loadWorkspace(), 0)
    return () => window.clearTimeout(timer)
  }, [loadWorkspace])

  useEffect(() => () => {
    if (audiencePreviewTimerRef.current) window.clearTimeout(audiencePreviewTimerRef.current)
  }, [])

  const selectedBlock = useMemo(() => working?.design?.blocks?.find((block) => block.id === selectedBlockId) || null, [selectedBlockId, working])
  const metrics = overview.metrics || {}
  const scheduledBroadcasts = (overview.broadcasts || []).filter((broadcast) => ['scheduled', 'processing', 'failed'].includes(broadcast.status))
  const sentBroadcasts = (overview.broadcasts || []).filter((broadcast) => ['sent', 'partial'].includes(broadcast.status))
  const readOnly = ['scheduled', 'sent', 'sending', 'archived'].includes(working?.status)

  const openLetter = useCallback(async (letterId) => {
    setBusy('open-letter')
    setError('')
    try {
      const [letterResponse, versionResponse] = await Promise.all([getLetter(letterId), getLetterVersions(letterId)])
      setWorking(letterResponse.letter)
      setAudienceFilter(letterResponse.letter.audience_filter || initialAudienceFilter)
      setVersions(versionResponse.versions || [])
      setSelectedBlockId(letterResponse.letter.design?.blocks?.[0]?.id || '')
      setUndoStack([])
      setRedoStack([])
      setDirty(false)
      setSaveState('saved')
      setFlowStep('design')
      setPreparedBroadcast(letterResponse.letter.latest_broadcast?.status === 'draft' ? letterResponse.letter.latest_broadcast : null)
      setActiveTab('letters')
      setLibraryMode('drafts')
    } catch (openError) {
      setError(openError.message || 'The letter could not be opened.')
    } finally {
      setBusy('')
    }
  }, [])

  useEffect(() => {
    const requestedLetterId = searchParams.get('letter') || ''
    if (loading || !requestedLetterId || requestedLetterRef.current === requestedLetterId) return
    requestedLetterRef.current = requestedLetterId
    openLetter(requestedLetterId)
  }, [loading, openLetter, searchParams])

  const persistWorking = useCallback(async (reason = 'autosave') => {
    if (!working || readOnly) return null
    const sequence = saveSequenceRef.current + 1
    const editVersion = editVersionRef.current
    saveSequenceRef.current = sequence
    setDirty(false)
    setSaveState('saving')
    try {
      const response = await saveLetter(working.id, {
        title: working.title,
        subject: working.subject,
        previewText: working.preview_text,
        design: working.design,
        audienceFilter,
        baseRevision: working.autosave_revision,
        saveReason: reason,
      })
      if (saveSequenceRef.current !== sequence) return null
      if (editVersionRef.current === editVersion) {
        setWorking(response.letter)
        setSaveState('saved')
        if (reason === 'manual') setNotice(`Saved revision ${response.letter.autosave_revision}.`)
        return response.letter
      }
      setWorking((current) => ({
        ...current,
        autosave_revision: response.letter.autosave_revision,
        updated_at: response.letter.updated_at,
      }))
      setDirty(true)
      setSaveState('unsaved')
      return null
    } catch (saveError) {
      if (saveSequenceRef.current === sequence) {
        setDirty(true)
        setSaveState('error')
        setError(saveError.message || 'The letter draft could not be saved.')
      }
      return null
    }
  }, [audienceFilter, readOnly, working])

  useEffect(() => {
    if (!dirty || !working || readOnly) return undefined
    const timer = window.setTimeout(() => persistWorking('autosave'), 900)
    return () => window.clearTimeout(timer)
  }, [dirty, persistWorking, readOnly, working])

  function updateLetter(patch) {
    if (readOnly) return
    editVersionRef.current += 1
    setWorking((current) => ({ ...current, ...patch }))
    setDirty(true)
    setSaveState('unsaved')
  }

  function updateDesign(nextDesign, { remember = true } = {}) {
    if (!working || readOnly) return
    if (remember) {
      setUndoStack((current) => [...current.slice(-29), clone(working.design)])
      setRedoStack([])
    }
    updateLetter({ design: nextDesign })
  }

  function addBlock(type) {
    const blocks = working?.design?.blocks || []
    const block = makeBlock(type)
    const requiredIndex = blocks.findIndex((entry) => entry.type === 'unsubscribe')
    const next = [...blocks]
    next.splice(requiredIndex >= 0 ? requiredIndex : next.length, 0, block)
    updateDesign({ ...working.design, blocks: next })
    setSelectedBlockId(block.id)
  }

  function changeBlock(nextBlock) {
    updateDesign({ ...working.design, blocks: working.design.blocks.map((block) => block.id === nextBlock.id ? nextBlock : block) })
  }

  function duplicateBlock(blockId) {
    const blocks = working.design.blocks
    const index = blocks.findIndex((block) => block.id === blockId)
    const source = blocks[index]
    if (!source || source.type === 'unsubscribe') return
    const duplicate = makeBlock(source.type, source)
    const next = [...blocks]
    next.splice(index + 1, 0, duplicate)
    updateDesign({ ...working.design, blocks: next })
    setSelectedBlockId(duplicate.id)
  }

  function deleteBlock(blockId) {
    const source = working.design.blocks.find((block) => block.id === blockId)
    if (!source || source.type === 'unsubscribe') return
    const next = working.design.blocks.filter((block) => block.id !== blockId)
    updateDesign({ ...working.design, blocks: next })
    setSelectedBlockId(next[0]?.id || '')
  }

  function moveBlock(sourceId, targetId) {
    const blocks = [...working.design.blocks]
    const sourceIndex = blocks.findIndex((block) => block.id === sourceId)
    const targetIndex = blocks.findIndex((block) => block.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0 || blocks[sourceIndex].type === 'unsubscribe') return
    const [source] = blocks.splice(sourceIndex, 1)
    const nextTargetIndex = blocks.findIndex((block) => block.id === targetId)
    blocks.splice(nextTargetIndex, 0, source)
    const unsubscribe = blocks.find((block) => block.type === 'unsubscribe')
    const ordered = [...blocks.filter((block) => block.type !== 'unsubscribe'), ...(unsubscribe ? [unsubscribe] : [])]
    updateDesign({ ...working.design, blocks: ordered })
  }

  function undo() {
    const previous = undoStack.at(-1)
    if (!previous) return
    setRedoStack((current) => [clone(working.design), ...current].slice(0, 30))
    setUndoStack((current) => current.slice(0, -1))
    updateDesign(previous, { remember: false })
  }

  function redo() {
    const next = redoStack[0]
    if (!next) return
    setUndoStack((current) => [...current, clone(working.design)].slice(-30))
    setRedoStack((current) => current.slice(1))
    updateDesign(next, { remember: false })
  }

  async function handleCreateLetter(event) {
    event.preventDefault()
    setBusy('create')
    setError('')
    try {
      const response = await createLetter({ title: newLetter.title, templateId: newLetter.templateId || null })
      setNewLetter({ title: '', templateId: '' })
      setCreatingLetter(false)
      await loadWorkspace({ preserveMessages: true })
      await openLetter(response.letter.id)
      setNotice('New letter draft created.')
    } catch (createError) {
      setError(createError.message || 'The letter could not be created.')
    } finally {
      setBusy('')
    }
  }

  async function handleDuplicateLetter(letterId) {
    setBusy('duplicate-letter')
    try {
      const response = await duplicateLetter(letterId)
      await loadWorkspace({ preserveMessages: true })
      await openLetter(response.letter.id)
      setNotice('Letter duplicated into a new editable draft.')
    } catch (duplicateError) {
      setError(duplicateError.message || 'The letter could not be duplicated.')
    } finally {
      setBusy('')
    }
  }

  async function handleAudiencePreview(nextFilter = audienceFilter) {
    const sequence = audiencePreviewSequenceRef.current + 1
    audiencePreviewSequenceRef.current = sequence
    setBusy('audience-preview')
    setError('')
    try {
      const response = await previewLetterAudience(nextFilter)
      if (audiencePreviewSequenceRef.current === sequence) setAudiencePreview(response.eligible || 0)
      return response
    } catch (previewError) {
      if (audiencePreviewSequenceRef.current === sequence) setError(previewError.message || 'The recipient count could not be calculated.')
      return null
    } finally {
      if (audiencePreviewSequenceRef.current === sequence) {
        setBusy((current) => current === 'audience-preview' ? '' : current)
      }
    }
  }

  function changeAudienceFilter(patch) {
    const next = { ...audienceFilter, ...patch }
    editVersionRef.current += 1
    setAudienceFilter(next)
    setDirty(true)
    setSaveState('unsaved')
    if (audiencePreviewTimerRef.current) window.clearTimeout(audiencePreviewTimerRef.current)
    audiencePreviewTimerRef.current = window.setTimeout(() => handleAudiencePreview(next), 250)
  }

  async function prepareBroadcast() {
    if (!working) return
    const saved = await persistWorking('manual')
    if (!saved) return
    setBusy('prepare')
    setError('')
    try {
      const response = await prepareLetterBroadcast(working.id, audienceFilter)
      setPreparedBroadcast(response.broadcast)
      setAudiencePreview(response.broadcast.recipient_count || 0)
      setFlowStep('review')
      setNotice(`${response.broadcast.recipient_count} eligible recipients locked into the review snapshot.`)
      await loadWorkspace({ preserveMessages: true })
    } catch (prepareError) {
      setError(prepareError.message || 'The broadcast audience could not be prepared.')
    } finally {
      setBusy('')
    }
  }

  async function handleTestSend(event) {
    event.preventDefault()
    setBusy('test')
    setError('')
    try {
      const response = await sendLetterTest(working.id, testEmail)
      setNotice(response.message || 'Test letter sent.')
      setFlowStep('send')
    } catch (testError) {
      setError(testError.message || 'The test letter could not be sent.')
    } finally {
      setBusy('')
    }
  }

  async function handleSchedule(event) {
    event.preventDefault()
    if (!preparedBroadcast) return
    setBusy('schedule')
    setError('')
    try {
      const response = await scheduleLetterBroadcast(preparedBroadcast.id, new Date(scheduleAt).toISOString())
      setPreparedBroadcast(response.broadcast)
      setNotice(`Broadcast scheduled for ${formatDate(response.broadcast.scheduled_at)}.`)
      await loadWorkspace({ preserveMessages: true })
      setDeliveryView('scheduled')
      setActiveTab('delivery')
      setWorking(null)
    } catch (scheduleError) {
      setError(scheduleError.message || 'The broadcast could not be scheduled.')
    } finally {
      setBusy('')
    }
  }

  async function handleSendNow() {
    if (!preparedBroadcast) return
    const accepted = await requestConfirm({
      title: `Send to ${preparedBroadcast.recipient_count} recipients now?`,
      message: 'Every recipient will be checked again for current consent and suppression immediately before delivery. Sending cannot be undone.',
      detail: working?.subject || working?.title,
      confirmLabel: 'Send broadcast now',
      tone: 'danger',
    })
    if (!accepted) return
    setBusy('send-now')
    setError('')
    try {
      const response = await sendLetterBroadcastNow(preparedBroadcast.id)
      setNotice(`Broadcast completed with status ${formatStatus(response.broadcast.status)}.`)
      await loadWorkspace({ preserveMessages: true })
      setWorking(null)
      setPreparedBroadcast(null)
      setActiveTab('results')
    } catch (sendError) {
      setError(sendError.message || 'The broadcast could not be sent.')
    } finally {
      setBusy('')
    }
  }

  async function handleSaveTemplate(event) {
    event.preventDefault()
    if (!templateName.trim()) return
    setBusy('template')
    try {
      const saved = await persistWorking('manual')
      if (!saved) return
      await saveLetterAsTemplate(working.id, { name: templateName })
      setTemplateName('')
      setNotice('Reusable template saved.')
      await loadWorkspace({ preserveMessages: true })
    } catch (templateError) {
      setError(templateError.message || 'The reusable template could not be saved.')
    } finally {
      setBusy('')
    }
  }

  async function handleRestoreVersion(version) {
    const accepted = await requestConfirm({ title: `Restore revision ${version.revision}?`, message: 'Your current draft remains in version history, and this snapshot becomes the newest editable revision.', confirmLabel: 'Restore version' })
    if (!accepted) return
    setBusy('restore')
    try {
      const response = await restoreLetterVersion(working.id, version.id)
      setWorking(response.letter)
      setSelectedBlockId(response.letter.design?.blocks?.[0]?.id || '')
      setVersions((await getLetterVersions(working.id)).versions || [])
      setNotice(`Revision ${version.revision} restored.`)
    } catch (restoreError) {
      setError(restoreError.message || 'The version could not be restored.')
    } finally {
      setBusy('')
    }
  }

  async function openBroadcast(broadcastId) {
    setBusy('broadcast')
    try {
      const response = await getLetterBroadcast(broadcastId)
      setSelectedBroadcast(response)
      setActiveTab('results')
    } catch (broadcastError) {
      setError(broadcastError.message || 'Broadcast results could not load.')
    } finally {
      setBusy('')
    }
  }

  async function handleCancelBroadcast(broadcast) {
    const accepted = await requestConfirm({ title: 'Cancel this scheduled broadcast?', message: 'No recipients will be sent this broadcast. The letter can be duplicated into a new draft afterward.', confirmLabel: 'Cancel broadcast', tone: 'danger' })
    if (!accepted) return
    try {
      await cancelLetterBroadcast(broadcast.id)
      setNotice('Scheduled broadcast cancelled.')
      await loadWorkspace({ preserveMessages: true })
    } catch (cancelError) {
      setError(cancelError.message || 'The broadcast could not be cancelled.')
    }
  }

  async function runDueBroadcasts() {
    setBusy('process-due')
    try {
      const response = await processDueLetterBroadcasts()
      setNotice(`${response.processed || 0} scheduled broadcast${response.processed === 1 ? '' : 's'} processed.`)
      await loadWorkspace({ preserveMessages: true })
    } catch (processError) {
      setError(processError.message || 'Scheduled broadcasts could not be processed.')
    } finally {
      setBusy('')
    }
  }

  function renderBroadcastList(items, emptyMessage, allowCancel = false) {
    return <div className="pwc-letters28-broadcast-list">{items.length ? items.map((broadcast) => <article key={broadcast.id}><div><span className={`pwc-letters28-status is-${broadcast.status}`}>{formatStatus(broadcast.status)}</span><h3>{broadcast.title}</h3><p>{broadcast.subject || 'No subject'} · {broadcast.recipient_count} recipients</p></div><dl><div><dt>Scheduled</dt><dd>{formatDate(broadcast.scheduled_at)}</dd></div><div><dt>Sent</dt><dd>{broadcast.sent_count || 0}</dd></div></dl><footer><button type="button" onClick={() => openBroadcast(broadcast.id)}>View details</button>{allowCancel && <button type="button" className="is-danger" onClick={() => handleCancelBroadcast(broadcast)}>Cancel</button>}</footer></article>) : <p className="pwc-letters28-empty">{emptyMessage}</p>}</div>
  }

  function renderFlowPanel() {
    if (flowStep === 'recipients') {
      return <div className="pwc-letters28-recipient-panel"><header><p className="admin-eyebrow">Choose Recipients</p><h2>Consent-aware audience</h2></header><label><span>Selection mode</span><select value={audienceFilter.mode} onChange={(event) => changeAudienceFilter({ mode: event.target.value, subscriberIds: [] })}><option value="all">All eligible subscribers</option><option value="filtered">Filtered segment</option><option value="selected">Selected people</option></select></label>{audienceFilter.mode === 'filtered' && <><label><span>Tag</span><select value={audienceFilter.tag} onChange={(event) => changeAudienceFilter({ tag: event.target.value })}><option value="">Any tag</option>{(audience.tags || []).map((tag) => <option key={tag.name} value={tag.name}>{tag.name} ({tag.count})</option>)}</select></label><label><span>Segment</span><select value={audienceFilter.segment} onChange={(event) => changeAudienceFilter({ segment: event.target.value })}><option value="">Any segment</option>{(audience.segments || []).map((segment) => <option key={segment.id} value={segment.name}>{segment.name} ({segment.count})</option>)}</select></label><label><span>Source</span><select value={audienceFilter.source} onChange={(event) => changeAudienceFilter({ source: event.target.value })}><option value="">Any source</option>{(audience.sources || []).map((source) => <option key={source.source} value={source.source}>{formatStatus(source.source)} ({source.count})</option>)}</select></label></>}{audienceFilter.mode === 'selected' && <div className="pwc-letters28-recipient-options">{audienceMembers.map((member) => <label key={member.id}><input type="checkbox" checked={audienceFilter.subscriberIds.includes(member.id)} onChange={() => changeAudienceFilter({ subscriberIds: audienceFilter.subscriberIds.includes(member.id) ? audienceFilter.subscriberIds.filter((id) => id !== member.id) : [...audienceFilter.subscriberIds, member.id] })} /><span><strong>{[member.first_name, member.last_name].filter(Boolean).join(' ') || member.email}</strong><small>{member.email}</small></span></label>)}</div>}<aside><span>Eligible recipients</span><strong>{audiencePreview}</strong><small>Unsubscribed, bounced, complained, suppressed, pending, and unconsented addresses excluded.</small></aside><div className="pwc-letters28-panel-actions"><button type="button" className="is-secondary" onClick={() => setFlowStep('design')}>Back to design</button><button type="button" onClick={prepareBroadcast} disabled={busy === 'prepare' || audiencePreview === 0}>{busy === 'prepare' ? 'Preparing…' : 'Continue to review'}</button></div></div>
    }
    if (flowStep === 'review') {
      return <div className="pwc-letters28-review-panel"><header><p className="admin-eyebrow">Review</p><h2>Ready for a test</h2></header><dl><div><dt>Letter</dt><dd>{working.title}</dd></div><div><dt>Subject</dt><dd>{working.subject || 'Missing subject'}</dd></div><div><dt>Blocks</dt><dd>{working.design.blocks.length}</dd></div><div><dt>Recipients</dt><dd>{preparedBroadcast?.recipient_count || 0}</dd></div><div><dt>Unsubscribe</dt><dd>Required block present</dd></div><div><dt>Pre-send recheck</dt><dd>Enabled</dd></div></dl><p>Recipient eligibility will be checked again at the exact moment of sending.</p><div className="pwc-letters28-panel-actions"><button type="button" className="is-secondary" onClick={() => setFlowStep('recipients')}>Change recipients</button><button type="button" onClick={() => setFlowStep('test')}>Continue to test</button></div></div>
    }
    if (flowStep === 'test') {
      return <form className="pwc-letters28-test-panel" onSubmit={handleTestSend}><header><p className="admin-eyebrow">Test</p><h2>Send a private preview</h2></header><label><span>Test email address</span><input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} required /></label><p>The subject is prefixed with [TEST]. Test activity is stored separately from broadcast analytics.</p><div className="pwc-letters28-panel-actions"><button type="button" className="is-secondary" onClick={() => setFlowStep('review')}>Back</button><button type="submit" disabled={busy === 'test'}>{busy === 'test' ? 'Sending…' : 'Send test letter'}</button></div></form>
    }
    if (flowStep === 'send') {
      return <div className="pwc-letters28-send-panel"><header><p className="admin-eyebrow">Schedule or Send</p><h2>Final delivery choice</h2></header><form onSubmit={handleSchedule}><label><span>Schedule date and time</span><input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} required /></label><button type="submit" disabled={busy === 'schedule'}>{busy === 'schedule' ? 'Scheduling…' : 'Schedule broadcast'}</button></form><div className="pwc-letters28-send-divider"><span>or</span></div><button type="button" className="is-danger" onClick={handleSendNow} disabled={busy === 'send-now'}>{busy === 'send-now' ? 'Sending safely…' : `Send now to ${preparedBroadcast?.recipient_count || 0}`}</button><p>Immediate sending cannot be undone. Consent and suppressions are rechecked for every recipient.</p></div>
    }
    return <LetterBlockSettings block={selectedBlock} onChange={changeBlock} onDuplicate={duplicateBlock} onDelete={deleteBlock} />
  }

  return (
    <AdminFrame>
      <section className="pwc-letters28-page">
        <header className="pwc-letters28-hero"><div><p className="admin-eyebrow">Power Within Communications</p><h1>Letters & Broadcasts</h1><p>Design thoughtful, branded letters and deliver them only to people whose current consent allows it.</p></div><aside><span>Eligible audience</span><strong>{Number(audience.metrics?.eligible || 0).toLocaleString()}</strong><small>Phase 27 protections active</small></aside></header>

        {error && <div className="pwc-letters28-alert is-error" role="alert">{error}</div>}
        {notice && <div className="pwc-letters28-alert is-success" role="status">{notice}</div>}

        <nav className="pwc-letters28-tabs pwc-phase35-primary-tabs" aria-label="Letters workspace sections">
          {workspaceTabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={activeTab === id ? 'is-active' : ''}
              aria-current={activeTab === id ? 'page' : undefined}
              onClick={() => {
                setActiveTab(id)
                if (id !== 'letters') setWorking(null)
              }}
            >
              {label}
              {id === 'delivery' && scheduledBroadcasts.length > 0 ? <span>{scheduledBroadcasts.length}</span> : null}
            </button>
          ))}
        </nav>

        {activeTab === 'letters' && !working && (
          <section className="pwc-phase35-letter-library">
            <header className="pwc-phase35-taskbar">
              <div>
                <p className="admin-eyebrow">Letter Library</p>
                <h2>{libraryMode === 'drafts' ? 'Draft and recent work' : 'Reusable designs'}</h2>
              </div>
              <div className="pwc-phase35-taskbar__actions">
                <div className="pwc-phase35-view-switch" role="tablist" aria-label="Letter library view">
                  <button type="button" role="tab" aria-selected={libraryMode === 'drafts'} className={libraryMode === 'drafts' ? 'is-active' : ''} onClick={() => setLibraryMode('drafts')}>Letters</button>
                  <button type="button" role="tab" aria-selected={libraryMode === 'templates'} className={libraryMode === 'templates' ? 'is-active' : ''} onClick={() => setLibraryMode('templates')}>Templates</button>
                </div>
                <button type="button" className="pwc-phase35-primary-action" onClick={() => setCreatingLetter((current) => !current)}>{creatingLetter ? 'Close' : '+ New letter'}</button>
              </div>
            </header>

            {creatingLetter && (
              <section className="pwc-letters28-panel pwc-letters28-new pwc-phase35-create-panel">
                <header><div><p className="admin-eyebrow">Create</p><h2>Begin a new letter</h2></div></header>
                <form onSubmit={handleCreateLetter}>
                  <label><span>Internal letter title</span><input value={newLetter.title} onChange={(event) => setNewLetter((current) => ({ ...current, title: event.target.value }))} placeholder="July reflection for a new season" required /></label>
                  <label><span>Starting template</span><select value={newLetter.templateId} onChange={(event) => setNewLetter((current) => ({ ...current, templateId: event.target.value }))}><option value="">Clean Power Within letter</option>{(overview.templates || []).map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
                  <button type="submit" disabled={busy === 'create'}>{busy === 'create' ? 'Creating…' : 'Create letter'}</button>
                </form>
              </section>
            )}

            {libraryMode === 'drafts' ? (
              <section className="pwc-letters28-panel pwc-letters28-letter-list">
                <header><div><p className="admin-eyebrow">Letters</p><h2>Open a letter to continue</h2></div><span>{overview.letters?.length || 0} letters</span></header>
                <div>{loading ? <p className="pwc-letters28-empty">Loading letters…</p> : (overview.letters || []).length ? overview.letters.map((letter) => <article key={letter.id}><button type="button" onClick={() => openLetter(letter.id)}><span className={`pwc-letters28-status is-${letter.status}`}>{formatStatus(letter.status)}</span><strong>{letter.title}</strong><p>{letter.subject || 'Subject not written yet'}</p><small>Revision {letter.autosave_revision} · {formatDate(letter.updated_at)}</small></button><button type="button" className="is-copy" onClick={() => handleDuplicateLetter(letter.id)}>Duplicate</button></article>) : <p className="pwc-letters28-empty">Create the first visual Power Within letter.</p>}</div>
              </section>
            ) : (
              <section className="pwc-letters28-panel pwc-letters28-templates">
                <header><div><p className="admin-eyebrow">Templates</p><h2>Start from a reusable design</h2></div><span>{overview.templates?.length || 0} active</span></header>
                <div>{(overview.templates || []).map((template) => <article key={template.id}><span>{formatStatus(template.category)}</span><h3>{template.name}</h3><p>{template.description || template.preview_text}</p><small>{template.design?.blocks?.length || 0} blocks · Updated {formatDate(template.updated_at)}</small><button type="button" onClick={() => { setNewLetter({ title: `${template.name} letter`, templateId: template.id }); setLibraryMode('drafts'); setCreatingLetter(true) }}>Use template</button></article>)}</div>
              </section>
            )}
          </section>
        )}

        {activeTab === 'letters' && working && <section className="pwc-letters28-builder"><header className="pwc-letters28-topbar"><button type="button" className="is-back" onClick={() => { setWorking(null); loadWorkspace({ preserveMessages: true }) }}>← Letters</button><div className="pwc-letters28-title-fields"><input aria-label="Internal letter title" value={working.title} onChange={(event) => updateLetter({ title: event.target.value })} /><input aria-label="Email subject" value={working.subject || ''} onChange={(event) => updateLetter({ subject: event.target.value })} placeholder="Email subject" /></div><div className="pwc-letters28-save-state"><span className={`is-${saveState}`}>{saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save error' : 'Unsaved'}</span><small>Revision {working.autosave_revision}</small></div><div className="pwc-letters28-top-actions"><button type="button" onClick={undo} disabled={!undoStack.length || readOnly}>Undo</button><button type="button" onClick={redo} disabled={!redoStack.length || readOnly}>Redo</button><div><button type="button" className={previewMode === 'desktop' ? 'is-active' : ''} onClick={() => setPreviewMode('desktop')}>Desktop</button><button type="button" className={previewMode === 'mobile' ? 'is-active' : ''} onClick={() => setPreviewMode('mobile')}>Mobile</button></div><button type="button" onClick={() => persistWorking('manual')} disabled={readOnly}>Save now</button><button type="button" className="is-primary" onClick={() => { setFlowStep('recipients'); handleAudiencePreview() }} disabled={readOnly || !working.subject}>Choose recipients →</button></div></header><div className="pwc-letters28-flow"><span className={flowStep === 'design' ? 'is-active' : ''}>1 Design</span><span className={flowStep === 'recipients' ? 'is-active' : ''}>2 Recipients</span><span className={flowStep === 'review' ? 'is-active' : ''}>3 Review</span><span className={flowStep === 'test' ? 'is-active' : ''}>4 Test</span><span className={flowStep === 'send' ? 'is-active' : ''}>5 Schedule or send</span></div><div className="pwc-letters28-builder-grid"><aside className="pwc-letters28-blocks"><header><p className="admin-eyebrow">Content Blocks</p><h2>Build your letter</h2></header><div>{blockPalette.map(([type, label, icon]) => <button type="button" key={type} onClick={() => addBlock(type)} disabled={readOnly}><span>{icon}</span><strong>{label}</strong></button>)}</div><section><p className="admin-eyebrow">Global Style</p><label><span>Page color</span><input type="color" value={working.design.settings.backgroundColor} onChange={(event) => updateDesign({ ...working.design, settings: { ...working.design.settings, backgroundColor: event.target.value } })} /></label><label><span>Content color</span><input type="color" value={working.design.settings.contentColor} onChange={(event) => updateDesign({ ...working.design, settings: { ...working.design.settings, contentColor: event.target.value } })} /></label><label><span>Text color</span><input type="color" value={working.design.settings.textColor} onChange={(event) => updateDesign({ ...working.design, settings: { ...working.design.settings, textColor: event.target.value } })} /></label><label><span>Accent color</span><input type="color" value={working.design.settings.accentColor} onChange={(event) => updateDesign({ ...working.design, settings: { ...working.design.settings, accentColor: event.target.value } })} /></label><label><span>Display type</span><select value={working.design.settings.fontFamily} onChange={(event) => updateDesign({ ...working.design, settings: { ...working.design.settings, fontFamily: event.target.value } })}><option value="Georgia, serif">Georgia</option><option value="'Times New Roman', serif">Times New Roman</option></select></label><label><span>Body type</span><select value={working.design.settings.bodyFontFamily} onChange={(event) => updateDesign({ ...working.design, settings: { ...working.design.settings, bodyFontFamily: event.target.value } })}><option value="Arial, sans-serif">Arial</option><option value="Helvetica, Arial, sans-serif">Helvetica</option><option value="'Trebuchet MS', Arial, sans-serif">Trebuchet</option></select></label></section></aside><main className="pwc-letters28-canvas-column"><label className="pwc-letters28-preview-text"><span>Inbox preview text</span><input value={working.preview_text || ''} onChange={(event) => updateLetter({ preview_text: event.target.value })} placeholder="A short line shown beside the subject" /></label><LetterCanvas design={working.design} selectedBlockId={selectedBlockId} onSelect={(blockId) => { setSelectedBlockId(blockId); setFlowStep('design') }} onMove={moveBlock} previewMode={previewMode} readOnly={readOnly} /></main><aside className="pwc-letters28-right-panel">{renderFlowPanel()}{flowStep === 'design' && <><section className="pwc-letters28-version-box"><header><p className="admin-eyebrow">Draft Recovery</p><strong>{versions.length} versions</strong></header><div>{versions.slice(0, 6).map((version) => <button type="button" key={version.id} onClick={() => handleRestoreVersion(version)} disabled={readOnly || busy === 'restore'}><span>Revision {version.revision}</span><small>{formatStatus(version.reason)} · {formatDate(version.created_at)}</small></button>)}</div></section><form className="pwc-letters28-template-save" onSubmit={handleSaveTemplate}><label><span>Save as reusable template</span><input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" /></label><button type="submit" disabled={!templateName.trim() || busy === 'template'}>Save template</button></form></>}</aside></div></section>}

        {activeTab === 'delivery' && (
          <div className="pwc-phase35-delivery-stack">
            <section className="pwc-letters28-panel pwc-phase35-audience-ready">
              <div><p className="admin-eyebrow">Audience Readiness</p><h2>{Number(audience.metrics?.eligible || 0).toLocaleString()} eligible recipients</h2><p>Consent and suppression protections are checked again at send time.</p></div>
              <Link to="/admin/audience">Manage audience →</Link>
            </section>
            <section className="pwc-letters28-panel pwc-letters28-broadcasts">
              <header>
                <div><p className="admin-eyebrow">Delivery Queue</p><h2>{deliveryView === 'scheduled' ? 'Upcoming broadcasts' : 'Delivered letters'}</h2></div>
                <div className="pwc-phase35-taskbar__actions">
                  <div className="pwc-phase35-view-switch" role="tablist" aria-label="Broadcast delivery view">
                    <button type="button" role="tab" aria-selected={deliveryView === 'scheduled'} className={deliveryView === 'scheduled' ? 'is-active' : ''} onClick={() => setDeliveryView('scheduled')}>Scheduled {scheduledBroadcasts.length}</button>
                    <button type="button" role="tab" aria-selected={deliveryView === 'sent'} className={deliveryView === 'sent' ? 'is-active' : ''} onClick={() => setDeliveryView('sent')}>Sent {sentBroadcasts.length}</button>
                  </div>
                  {deliveryView === 'scheduled' && adminUser?.role === 'developer' && <button type="button" onClick={runDueBroadcasts} disabled={busy === 'process-due'}>{busy === 'process-due' ? 'Checking…' : 'Process due now'}</button>}
                </div>
              </header>
              {deliveryView === 'scheduled'
                ? renderBroadcastList(scheduledBroadcasts, 'No broadcasts are scheduled.', true)
                : renderBroadcastList(sentBroadcasts, 'No broadcasts have been sent yet.')}
            </section>
          </div>
        )}

        {activeTab === 'results' && <section className="pwc-letters28-analytics"><div className="pwc-letters28-metrics">{[['Sent', metrics.delivered_to_provider], ['Opened', metrics.opened], ['Clicked', metrics.clicked], ['Open rate', rate(metrics.opened, metrics.delivered_to_provider)], ['Click rate', rate(metrics.clicked, metrics.delivered_to_provider)], ['Broadcasts', metrics.sent]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong></article>)}</div>{selectedBroadcast ? <section className="pwc-letters28-panel pwc-letters28-results"><header><div><p className="admin-eyebrow">Broadcast Results</p><h2>{selectedBroadcast.broadcast.title}</h2><p>{selectedBroadcast.broadcast.subject}</p></div><a href={getLetterBroadcastExportUrl(selectedBroadcast.broadcast.id)}>Export CSV</a></header><div className="pwc-letters28-result-metrics">{[['Recipients', selectedBroadcast.broadcast.recipient_count], ['Sent', selectedBroadcast.broadcast.sent_count], ['Delivered', selectedBroadcast.broadcast.delivered_count], ['Opened', selectedBroadcast.broadcast.opened_count], ['Clicked', selectedBroadcast.broadcast.clicked_count], ['Bounced', selectedBroadcast.broadcast.bounced_count], ['Unsubscribed', selectedBroadcast.broadcast.unsubscribed_count]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || 0}</strong></div>)}</div><div className="pwc-letters28-results-grid"><section><h3>Per-link activity</h3>{selectedBroadcast.links.length ? selectedBroadcast.links.map((link) => <article key={link.id}><div><strong>{link.label || 'Tracked link'}</strong><small>{link.destination_url}</small></div><span>{link.click_count} clicks · {link.unique_click_count} unique</span></article>) : <p>No tracked link activity yet.</p>}</section><section><h3>Subscriber activity</h3>{selectedBroadcast.recipients.slice(0, 100).map((recipient) => <article key={recipient.id}><div><strong>{[recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || recipient.email}</strong><small>{recipient.email}</small></div><span className={`pwc-letters28-status is-${recipient.delivery_status}`}>{formatStatus(recipient.delivery_status)}</span></article>)}</section></div></section> : <section className="pwc-letters28-panel pwc-letters28-analytics-list"><header><div><p className="admin-eyebrow">Results</p><h2>Choose a sent broadcast</h2></div></header>{renderBroadcastList(sentBroadcasts, 'Analytics will appear after the first broadcast.')}</section>}</section>}
      </section>
    </AdminFrame>
  )
}
