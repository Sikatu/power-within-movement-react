import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame.jsx'
import { useAdminConfirm } from '../../components/admin/AdminConfirmContext.js'
import {
  BroadcastAnalytics,
  DeliveryQueue,
  LetterEditor,
  LettersLibrary,
  LettersWorkspace,
} from '../../components/admin/letters/LettersWorkspace.jsx'
import {
  cancelLetterBroadcast,
  createLetter,
  duplicateLetter,
  getLetter,
  getLetterBroadcast,
  getLetterBroadcastPreflight,
  getLetterBroadcastExportUrl,
  getLetterBuilderOverview,
  getLetterVersions,
  getNewsletterAudienceSubscribers,
  getNewsletterAudienceSummary,
  prepareLetterBroadcast,
  previewLetterAudience,
  renderLetterPreview,
  processDueLetterBroadcasts,
  retryFailedLetterBroadcast,
  restoreLetterVersion,
  saveLetter,
  saveLetterAsTemplate,
  scheduleLetterBroadcast,
  sendLetterBroadcastNow,
  sendLetterTest,
} from '../../lib/nativeApi.js'

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
  const [previewMode, setPreviewMode] = useState('edit')
  const [renderedPreview, setRenderedPreview] = useState({ html: '', text: '' })
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [flowStep, setFlowStep] = useState('design')
  const [audienceFilter, setAudienceFilter] = useState(initialAudienceFilter)
  const [audiencePreview, setAudiencePreview] = useState(0)
  const [preparedBroadcast, setPreparedBroadcast] = useState(null)
  const [preflight, setPreflight] = useState(null)
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

  useEffect(() => {
    if (!working || previewMode === 'edit') return undefined
    let active = true
    const timer = window.setTimeout(async () => {
      if (active) setPreviewLoading(true)
      try {
        const response = await renderLetterPreview({
          title: working.title,
          subject: working.subject || '',
          previewText: working.preview_text || '',
          design: working.design,
        })
        if (active) {
          setRenderedPreview({ html: response.html || '', text: response.text || '' })
          setPreviewError('')
        }
      } catch (previewFailure) {
        if (active) setPreviewError(previewFailure.message || 'The production preview could not be rendered.')
      } finally {
        if (active) setPreviewLoading(false)
      }
    }, 300)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [previewMode, working])

  const selectedBlock = useMemo(() => working?.design?.blocks?.find((block) => block.id === selectedBlockId) || null, [selectedBlockId, working])
  const metrics = overview.metrics || {}
  const scheduledBroadcasts = (overview.broadcasts || []).filter((broadcast) => ['scheduled', 'processing', 'failed'].includes(broadcast.status))
  const sentBroadcasts = (overview.broadcasts || []).filter((broadcast) => ['sent', 'partial'].includes(broadcast.status))
  const readOnly = working?.status === 'archived'

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

  function insertBlock(index, type = 'text') {
    const blocks = [...(working?.design?.blocks || [])]
    const block = makeBlock(type)
    const safeIndex = Math.max(0, Math.min(Number(index) || 0, Math.max(0, blocks.length - 1)))
    blocks.splice(safeIndex, 0, block)
    updateDesign({ ...working.design, blocks })
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
      const preflightResponse = await getLetterBroadcastPreflight(response.broadcast.id)
      setPreflight(preflightResponse.preflight)
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
      const preflightResponse = await getLetterBroadcastPreflight(preparedBroadcast.id)
      setPreflight(preflightResponse.preflight)
      if (!preflightResponse.preflight.ready) {
        throw new Error(preflightResponse.preflight.blockers.join(' '))
      }
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
    try {
      const preflightResponse = await getLetterBroadcastPreflight(preparedBroadcast.id)
      setPreflight(preflightResponse.preflight)
      if (!preflightResponse.preflight.ready) {
        setError(preflightResponse.preflight.blockers.join(' '))
        return
      }
    } catch (preflightError) {
      setError(preflightError.message || 'Final delivery review could not be completed.')
      return
    }
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
    const accepted = await requestConfirm({ title: 'Cancel this scheduled broadcast?', message: 'No recipients will be sent this broadcast. The original letter remains available to edit or use for another broadcast.', confirmLabel: 'Cancel broadcast', tone: 'danger' })
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
      const details = [
        `${response.processed || 0} processed`,
        `${response.recovered || 0} recovered`,
        `${response.failed || 0} failed`,
      ]
      setNotice(`Delivery worker check complete: ${details.join(', ')}.`)
      await loadWorkspace({ preserveMessages: true })
    } catch (processError) {
      setError(processError.message || 'Scheduled broadcasts could not be processed.')
    } finally {
      setBusy('')
    }
  }

  async function handleRetryFailedBroadcast(broadcast) {
    const accepted = await requestConfirm({
      title: 'Retry failed recipients?',
      message: 'Only recipients whose earlier attempt failed will be queued. Already sent, skipped, unsubscribed, or suppressed recipients will not be sent again.',
      confirmLabel: 'Queue safe retry',
    })
    if (!accepted) return
    setBusy(`retry-${broadcast.id}`)
    try {
      const response = await retryFailedLetterBroadcast(broadcast.id)
      setNotice(`${response.retryCount || 0} failed recipient${response.retryCount === 1 ? '' : 's'} queued for a safe retry.`)
      await loadWorkspace({ preserveMessages: true })
    } catch (retryError) {
      setError(retryError.message || 'Failed recipients could not be queued for retry.')
    } finally {
      setBusy('')
    }
  }

  function renderBroadcastList(items, emptyMessage, allowCancel = false) {
    return <div className="pwc-letters28-broadcast-list">{items.length ? items.map((broadcast) => <article key={broadcast.id}><div><span className={`pwc-letters28-status is-${broadcast.status}`}>{formatStatus(broadcast.status)}</span><h3>{broadcast.title}</h3><p>{broadcast.subject || 'No subject'} · {broadcast.recipient_count} recipients</p>{broadcast.error_message && <small role="status">{broadcast.error_message}</small>}</div><dl><div><dt>Scheduled</dt><dd>{formatDate(broadcast.scheduled_at)}</dd></div><div><dt>Sent</dt><dd>{broadcast.sent_count || 0}</dd></div><div><dt>Failed</dt><dd>{broadcast.failed_count || 0}</dd></div></dl><footer><button type="button" onClick={() => openBroadcast(broadcast.id)}>View details</button>{Number(broadcast.failed_count || 0) > 0 && ['failed', 'partial'].includes(broadcast.status) && <button type="button" onClick={() => handleRetryFailedBroadcast(broadcast)} disabled={busy === `retry-${broadcast.id}`}>{busy === `retry-${broadcast.id}` ? 'Queuing…' : 'Retry failures'}</button>}{allowCancel && ['draft', 'scheduled', 'failed'].includes(broadcast.status) && <button type="button" className="is-danger" onClick={() => handleCancelBroadcast(broadcast)}>Cancel</button>}</footer></article>) : <p className="pwc-letters28-empty">{emptyMessage}</p>}</div>
  }

  function renderFlowPanel() {
    if (flowStep === 'recipients') {
      return <div className="pwc-letters28-recipient-panel"><header><p className="admin-eyebrow">Choose Recipients</p><h2>Consent-aware audience</h2></header><label><span>Selection mode</span><select value={audienceFilter.mode} onChange={(event) => changeAudienceFilter({ mode: event.target.value, subscriberIds: [] })}><option value="all">All eligible subscribers</option><option value="filtered">Filtered segment</option><option value="selected">Selected people</option></select></label>{audienceFilter.mode === 'filtered' && <><label><span>Tag</span><select value={audienceFilter.tag} onChange={(event) => changeAudienceFilter({ tag: event.target.value })}><option value="">Any tag</option>{(audience.tags || []).map((tag) => <option key={tag.name} value={tag.name}>{tag.name} ({tag.count})</option>)}</select></label><label><span>Segment</span><select value={audienceFilter.segment} onChange={(event) => changeAudienceFilter({ segment: event.target.value })}><option value="">Any segment</option>{(audience.segments || []).map((segment) => <option key={segment.id} value={segment.name}>{segment.name} ({segment.count})</option>)}</select></label><label><span>Source</span><select value={audienceFilter.source} onChange={(event) => changeAudienceFilter({ source: event.target.value })}><option value="">Any source</option>{(audience.sources || []).map((source) => <option key={source.source} value={source.source}>{formatStatus(source.source)} ({source.count})</option>)}</select></label></>}{audienceFilter.mode === 'selected' && <div className="pwc-letters28-recipient-options">{audienceMembers.map((member) => <label key={member.id}><input type="checkbox" checked={audienceFilter.subscriberIds.includes(member.id)} onChange={() => changeAudienceFilter({ subscriberIds: audienceFilter.subscriberIds.includes(member.id) ? audienceFilter.subscriberIds.filter((id) => id !== member.id) : [...audienceFilter.subscriberIds, member.id] })} /><span><strong>{[member.first_name, member.last_name].filter(Boolean).join(' ') || member.email}</strong><small>{member.email}</small></span></label>)}</div>}<aside><span>Eligible recipients</span><strong>{audiencePreview}</strong><small>Unsubscribed, bounced, complained, suppressed, pending, and unconsented addresses excluded.</small></aside><div className="pwc-letters28-panel-actions"><button type="button" className="is-secondary" onClick={() => setFlowStep('design')}>Back to design</button><button type="button" onClick={prepareBroadcast} disabled={busy === 'prepare' || audiencePreview === 0}>{busy === 'prepare' ? 'Preparing…' : 'Continue to review'}</button></div></div>
    }
    if (flowStep === 'review') {
      return <div className="pwc-letters28-review-panel"><header><p className="admin-eyebrow">Final readiness</p><h2>{preflight?.ready ? 'Ready for a test' : 'Needs attention'}</h2></header><dl><div><dt>Letter</dt><dd>{working.title}</dd></div><div><dt>Subject</dt><dd>{working.subject || 'Missing subject'}</dd></div><div><dt>Blocks</dt><dd>{working.design.blocks.length}</dd></div><div><dt>Recipients now eligible</dt><dd>{preflight?.recipientCount ?? preparedBroadcast?.recipient_count ?? 0}</dd></div><div><dt>Content</dt><dd>{preflight?.checks?.content ? 'Passed' : 'Blocked'}</dd></div><div><dt>Delivery provider</dt><dd>{preflight?.checks?.provider ? 'Ready' : 'Unavailable'}</dd></div><div><dt>Outgoing email</dt><dd>{preflight?.checks?.outgoingEmail ? 'Available' : 'Paused'}</dd></div><div><dt>Audience snapshot</dt><dd>{preflight?.checks?.snapshotFresh ? 'Current' : 'Changed'}</dd></div></dl>{preflight?.blockers?.length ? <ul className="pwc-letters-preflight is-blocked">{preflight.blockers.map((item) => <li key={item}>{item}</li>)}</ul> : null}{preflight?.warnings?.length ? <ul className="pwc-letters-preflight is-warning">{preflight.warnings.map((item) => <li key={item}>{item}</li>)}</ul> : null}<p>Recipient eligibility will be checked again at the exact moment of sending.</p><div className="pwc-letters28-panel-actions"><button type="button" className="is-secondary" onClick={() => setFlowStep('recipients')}>Change recipients</button><button type="button" onClick={() => setFlowStep('test')} disabled={!preflight?.ready}>Continue to test</button></div></div>
    }
    if (flowStep === 'test') {
      return <form className="pwc-letters28-test-panel" onSubmit={handleTestSend}><header><p className="admin-eyebrow">Test</p><h2>Send a private preview</h2></header><label><span>Test email address</span><input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} required /></label><p>The subject is prefixed with [TEST]. Test activity is stored separately from broadcast analytics.</p><div className="pwc-letters28-panel-actions"><button type="button" className="is-secondary" onClick={() => setFlowStep('review')}>Back</button><button type="submit" disabled={busy === 'test'}>{busy === 'test' ? 'Sending…' : 'Send test letter'}</button></div></form>
    }
    if (flowStep === 'send') {
      return <div className="pwc-letters28-send-panel"><header><p className="admin-eyebrow">Schedule or Send</p><h2>Final delivery choice</h2></header><form onSubmit={handleSchedule}><label><span>Schedule date and time</span><input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} required /></label><button type="submit" disabled={busy === 'schedule'}>{busy === 'schedule' ? 'Scheduling…' : 'Schedule broadcast'}</button></form><div className="pwc-letters28-send-divider"><span>or</span></div><button type="button" className="is-danger" onClick={handleSendNow} disabled={busy === 'send-now'}>{busy === 'send-now' ? 'Sending safely…' : `Send now to ${preparedBroadcast?.recipient_count || 0}`}</button><p>Immediate sending cannot be undone. Consent and suppressions are rechecked for every recipient.</p></div>
    }
    return null
  }

  return (
    <AdminFrame>
      <LettersWorkspace
        audience={audience}
        activeTab={activeTab}
        scheduledCount={scheduledBroadcasts.length}
        error={error}
        notice={notice}
        onTabChange={(tab) => {
          setActiveTab(tab)
          if (tab !== 'letters') setWorking(null)
        }}
      >
        {activeTab === 'letters' && !working && <LettersLibrary
          libraryMode={libraryMode}
          setLibraryMode={setLibraryMode}
          creatingLetter={creatingLetter}
          setCreatingLetter={setCreatingLetter}
          newLetter={newLetter}
          setNewLetter={setNewLetter}
          overview={overview}
          loading={loading}
          busy={busy}
          onCreate={handleCreateLetter}
          onOpen={openLetter}
          onDuplicate={handleDuplicateLetter}
          formatStatus={formatStatus}
          formatDate={formatDate}
          onUseTemplate={(template) => {
            setNewLetter({ title: `${template.name} letter`, templateId: template.id })
            setLibraryMode('drafts')
            setCreatingLetter(true)
          }}
        />}
        {activeTab === 'letters' && working && <LetterEditor
          working={working}
          readOnly={readOnly}
          saveState={saveState}
          undoCount={undoStack.length}
          redoCount={redoStack.length}
          previewMode={previewMode}
          setPreviewMode={setPreviewMode}
          renderedPreview={renderedPreview}
          previewLoading={previewLoading}
          previewError={previewError}
          flowStep={flowStep}
          selectedBlockId={selectedBlockId}
          selectedBlock={selectedBlock}
          versions={versions}
          busy={busy}
          templateName={templateName}
          setTemplateName={setTemplateName}
          palette={blockPalette}
          onBack={() => { setWorking(null); loadWorkspace({ preserveMessages: true }) }}
          onUpdateLetter={updateLetter}
          onUpdateDesign={updateDesign}
          onUndo={undo}
          onRedo={redo}
          onSave={() => persistWorking('manual')}
          onChooseRecipients={() => { setFlowStep('recipients'); handleAudiencePreview() }}
          onAddBlock={addBlock}
          onInsertBlock={insertBlock}
          onSelectBlock={(blockId) => { setSelectedBlockId(blockId); setFlowStep('design') }}
          onMoveBlock={moveBlock}
          onChangeBlock={changeBlock}
          onDuplicateBlock={duplicateBlock}
          onDeleteBlock={deleteBlock}
          renderFlowPanel={renderFlowPanel}
          onRestoreVersion={handleRestoreVersion}
          onSaveTemplate={handleSaveTemplate}
          formatStatus={formatStatus}
          formatDate={formatDate}
        />}
        {activeTab === 'delivery' && <DeliveryQueue audience={audience} deliveryView={deliveryView} setDeliveryView={setDeliveryView} scheduled={scheduledBroadcasts} sent={sentBroadcasts} adminUser={adminUser} busy={busy} onProcessDue={runDueBroadcasts} renderBroadcastList={renderBroadcastList} />}
        {activeTab === 'results' && <BroadcastAnalytics metrics={metrics} selectedBroadcast={selectedBroadcast} sentBroadcasts={sentBroadcasts} rate={rate} formatStatus={formatStatus} exportUrl={getLetterBroadcastExportUrl} renderBroadcastList={renderBroadcastList} />}
      </LettersWorkspace>
    </AdminFrame>
  )
}
