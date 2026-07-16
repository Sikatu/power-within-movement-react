import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  archiveFounderRecording,
  assignFounderRecording,
  getFounderRecordingAccess,
  permanentlyDeleteFounderRecording,
  requestFounderTranscription,
  restoreFounderRecording,
  reuseFounderTranscriptInLetter,
  saveFounderRecording,
  saveFounderToolPreferences,
  unassignFounderRecording,
  uploadFounderRecording,
} from '../../lib/nativeApi.js'

const EMPTY_RECORDINGS = []

function formatDuration(value) {
  const totalSeconds = Math.max(0, Math.floor(Number(value || 0) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatDate(value) {
  if (!value) return 'Not recorded'
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) } catch { return 'Not recorded' }
}

function clientName(client) {
  return [client?.first_name, client?.last_name].filter(Boolean).join(' ') || client?.email || 'Client'
}

function chooseAudioType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((value) => globalThis.MediaRecorder?.isTypeSupported?.(value)) || ''
}

export default function FounderVoiceRecorder({ workspace, onRefresh, onNotice, onError }) {
  const navigate = useNavigate()
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const animationRef = useRef(null)
  const audioContextRef = useRef(null)
  const searchMountedRef = useRef(false)
  const startedAtRef = useRef(0)
  const accumulatedRef = useRef(0)
  const [captureState, setCaptureState] = useState('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [recordingBlob, setRecordingBlob] = useState(null)
  const [localAudioUrl, setLocalAudioUrl] = useState('')
  const [savedAudioUrl, setSavedAudioUrl] = useState('')
  const [consentAcknowledged, setConsentAcknowledged] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [folderId, setFolderId] = useState('')
  const [keepPrivate, setKeepPrivate] = useState(true)
  const [shareClientId, setShareClientId] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [busy, setBusy] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [selectedId, setSelectedId] = useState('')
  const [editor, setEditor] = useState(null)
  const [assignClientId, setAssignClientId] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [retentionDays, setRetentionDays] = useState(workspace?.preferences?.recordingRetentionDays || 365)

  const recordings = workspace?.recordings || EMPTY_RECORDINGS
  const selected = recordings.find((recording) => recording.id === selectedId) || recordings[0] || null
  const activeSelectedId = selected?.id || ''
  const detail = selected && editor?.recordingId === selected.id
    ? editor
    : {
        recordingId: selected?.id || '',
        title: selected?.title || '',
        notes: selected?.notes || '',
        tags: (selected?.tags || []).join(', '),
        transcript: selected?.transcript_text || '',
      }
  const mediaSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia && globalThis.MediaRecorder)

  useEffect(() => {
    if (!searchMountedRef.current) {
      searchMountedRef.current = true
      return undefined
    }
    const timer = window.setTimeout(() => onRefresh?.({ search, status }), 350)
    return () => window.clearTimeout(timer)
  }, [onRefresh, search, status])

  const hasPendingTranscription = recordings.some((recording) => ['queued', 'processing'].includes(recording.transcript_status))
  useEffect(() => {
    if (!hasPendingTranscription) return undefined
    const timer = window.setInterval(() => onRefresh?.({ search, status }), 15_000)
    return () => window.clearInterval(timer)
  }, [hasPendingTranscription, onRefresh, search, status])

  useEffect(() => () => {
    if (localAudioUrl) URL.revokeObjectURL(localAudioUrl)
  }, [localAudioUrl])

  useEffect(() => () => {
    window.clearInterval(timerRef.current)
    window.cancelAnimationFrame(animationRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    audioContextRef.current?.close?.()
  }, [])

  function startTimer() {
    window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      if (startedAtRef.current) setElapsedMs(accumulatedRef.current + performance.now() - startedAtRef.current)
    }, 200)
  }

  function startMeter(stream) {
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const analyser = context.createAnalyser()
    analyser.fftSize = 256
    context.createMediaStreamSource(stream).connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    audioContextRef.current = context
    const read = () => {
      analyser.getByteFrequencyData(data)
      const average = data.reduce((sum, value) => sum + value, 0) / data.length
      setAudioLevel(Math.min(100, Math.round((average / 128) * 100)))
      animationRef.current = window.requestAnimationFrame(read)
    }
    read()
  }

  function stopCaptureResources() {
    window.clearInterval(timerRef.current)
    window.cancelAnimationFrame(animationRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    audioContextRef.current?.close?.()
    audioContextRef.current = null
    setAudioLevel(0)
  }

  async function startRecording() {
    if (!mediaSupported) return onError?.('This browser does not support secure microphone recording.')
    if (!consentAcknowledged) return onError?.('Confirm consent and privacy before recording.')
    setBusy('microphone')
    try {
      if (localAudioUrl) URL.revokeObjectURL(localAudioUrl)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = chooseAudioType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunksRef.current.push(event.data) })
      recorder.addEventListener('stop', () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setRecordingBlob(blob)
        setLocalAudioUrl(url)
        setCaptureState('ready')
        stopCaptureResources()
      })
      mediaRecorderRef.current = recorder
      streamRef.current = stream
      accumulatedRef.current = 0
      startedAtRef.current = performance.now()
      setElapsedMs(0)
      setRecordingBlob(null)
      setLocalAudioUrl('')
      recorder.start(1000)
      setCaptureState('recording')
      startTimer()
      startMeter(stream)
    } catch (error) { onError?.(error.message || 'Microphone access could not start.') } finally { setBusy('') }
  }

  function pauseRecording() {
    if (mediaRecorderRef.current?.state !== 'recording') return
    mediaRecorderRef.current.pause()
    accumulatedRef.current += performance.now() - startedAtRef.current
    startedAtRef.current = 0
    setElapsedMs(accumulatedRef.current)
    setCaptureState('paused')
  }

  function resumeRecording() {
    if (mediaRecorderRef.current?.state !== 'paused') return
    mediaRecorderRef.current.resume()
    startedAtRef.current = performance.now()
    setCaptureState('recording')
  }

  function stopRecording() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return
    if (startedAtRef.current) accumulatedRef.current += performance.now() - startedAtRef.current
    startedAtRef.current = 0
    setElapsedMs(accumulatedRef.current)
    setCaptureState('processing')
    mediaRecorderRef.current.stop()
  }

  function resetDraft() {
    if (localAudioUrl) URL.revokeObjectURL(localAudioUrl)
    setLocalAudioUrl('')
    setRecordingBlob(null)
    setCaptureState('idle')
    setElapsedMs(0)
    accumulatedRef.current = 0
    setTitle('')
    setNotes('')
    setTags('')
    setKeepPrivate(true)
    setShareClientId('')
    setUploadProgress(0)
  }

  function selectRecording(recording) {
    setSelectedId(recording.id)
    setEditor({
      recordingId: recording.id,
      title: recording.title || '',
      notes: recording.notes || '',
      tags: (recording.tags || []).join(', '),
      transcript: recording.transcript_text || '',
    })
    setDeleteConfirmation('')
    setSavedAudioUrl('')
  }

  async function saveDraft(event) {
    event.preventDefault()
    if (!recordingBlob || !title.trim()) return
    if (!keepPrivate && !shareClientId) return onError?.('Choose the client who may receive this recording, or keep it private.')
    setBusy('save')
    try {
      const extension = recordingBlob.type.includes('mp4') ? 'm4a' : 'webm'
      const file = new File([recordingBlob], `founder-recording-${Date.now()}.${extension}`, { type: recordingBlob.type || 'audio/webm' })
      const response = await uploadFounderRecording(file, {
        title: title.trim(),
        notes: notes.trim(),
        tags: tags.split(',').map((value) => value.trim()).filter(Boolean),
        folderId: folderId || workspace?.folders?.find((folder) => folder.slug === 'founder-recordings')?.id || null,
        durationMs: Math.round(elapsedMs),
      }, { onProgress: ({ percent }) => setUploadProgress(percent) })
      let shareError = null
      if (!keepPrivate && shareClientId) {
        try { await assignFounderRecording(response.recording.id, shareClientId) } catch (error) { shareError = error }
      }
      await onRefresh?.({ search, status, selectId: response.recording.id })
      setSelectedId(response.recording.id)
      resetDraft()
      if (shareError) {
        onError?.(`Recording saved privately, but client sharing did not complete: ${shareError.message}`)
      } else {
        onNotice?.(!keepPrivate ? 'Recording saved and explicitly shared with the selected client.' : response.message)
      }
    } catch (error) { onError?.(error.message || 'Recording could not be saved.') } finally { setBusy('') }
  }

  async function runAction(key, action, successMessage, refresh = true) {
    if (!selected) return
    setBusy(key)
    try {
      const response = await action()
      if (refresh) await onRefresh?.({ search, status, selectId: selected.id })
      onNotice?.(response?.message || successMessage)
      return response
    } catch (error) { onError?.(error.message || 'That recording action could not be completed.') } finally { setBusy('') }
    return null
  }

  async function previewSaved() {
    const response = await runAction('preview', () => getFounderRecordingAccess(selected.id, 'preview'), '', false)
    if (response?.url) setSavedAudioUrl(response.url)
  }

  async function downloadSaved() {
    const response = await runAction('download', () => getFounderRecordingAccess(selected.id, 'download'), '', false)
    if (!response?.url) return
    const link = document.createElement('a')
    link.href = response.url
    link.download = selected.original_filename || `${selected.title}.webm`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  async function copyTranscript() {
    try {
      await navigator.clipboard.writeText(detail.transcript || selected?.transcript_text || '')
      onNotice?.('Transcript copied.')
    } catch { onError?.('The browser could not copy the transcript.') }
  }

  async function saveRetention() {
    setBusy('retention')
    try {
      const response = await saveFounderToolPreferences({
        primaryTimezone: workspace.preferences.primaryTimezone,
        comparisonTimezones: workspace.preferences.comparisonTimezones,
        recordingRetentionDays: Number(retentionDays),
      })
      await onRefresh?.({ search, status, selectId: selected?.id })
      onNotice?.(response.message)
    } catch (error) { onError?.(error.message || 'Retention preference could not be saved.') } finally { setBusy('') }
  }

  async function reuseInLetter() {
    const response = await runAction('letter', () => reuseFounderTranscriptInLetter(selected.id), '', false)
    if (response?.path) navigate(response.path)
  }

  async function permanentlyDelete() {
    const deletedId = selected.id
    const response = await runAction('delete', () => permanentlyDeleteFounderRecording(selected.id, deleteConfirmation), '', false)
    if (!response) return
    setSelectedId('')
    setDeleteConfirmation('')
    setSavedAudioUrl('')
    await onRefresh?.({ search, status, deletedId })
  }

  return (
    <section className="pwc-founder29-recorder" aria-labelledby="founder-recorder-title">
      <header className="pwc-founder29-recorder-heading">
        <div>
          <p className="admin-eyebrow">Private voice studio</p>
          <h2 id="founder-recorder-title">Capture the thought while it is alive.</h2>
          <p>Record privately, listen first, then choose whether it belongs in the Vault, with a client, or inside a Letter.</p>
        </div>
        <div className={`pwc-founder29-transcription is-${workspace?.transcription?.status || 'disabled'}`}>
          <span aria-hidden="true" />
          <div><small>Server transcription</small><strong>{workspace?.transcription?.status || 'Disabled'}</strong><p>{workspace?.transcription?.message}</p></div>
        </div>
      </header>

      <div className="pwc-founder29-recorder-grid">
        <article className="pwc-founder29-capture">
          <div className="pwc-founder29-consent">
            <label>
              <input type="checkbox" checked={consentAcknowledged} onChange={(event) => setConsentAcknowledged(event.target.checked)} />
              <span>I have permission to record every person who may be heard. New recordings stay private to Founder and Developer until I explicitly share them.</span>
            </label>
          </div>

          <div className={`pwc-founder29-mic is-${captureState}`}>
            <div className="pwc-founder29-level" style={{ '--audio-level': `${audioLevel}%` }} aria-label={`Audio level ${audioLevel} percent`}>
              <span aria-hidden="true">●</span>
              <i />
            </div>
            <strong>{formatDuration(elapsedMs)}</strong>
            <small>{captureState === 'idle' ? 'Ready when you are' : captureState === 'recording' ? 'Recording live' : captureState === 'paused' ? 'Paused' : captureState === 'ready' ? 'Ready to review' : 'Finishing recording'}</small>
          </div>

          <div className="pwc-founder29-transport">
            {['idle', 'ready'].includes(captureState) && <button type="button" className="is-record" onClick={startRecording} disabled={!consentAcknowledged || busy === 'microphone'}>{captureState === 'ready' ? 'Record again' : 'Start recording'}</button>}
            {captureState === 'recording' && <button type="button" onClick={pauseRecording}>Pause</button>}
            {captureState === 'paused' && <button type="button" onClick={resumeRecording}>Resume</button>}
            {['recording', 'paused'].includes(captureState) && <button type="button" className="is-stop" onClick={stopRecording}>Stop</button>}
          </div>

          {!mediaSupported && <div className="admin-notice is-error">This browser does not expose MediaRecorder and microphone access.</div>}
          {localAudioUrl && <div className="pwc-founder29-review-audio"><span>Listen before saving</span><audio controls src={localAudioUrl} /></div>}

          <form className="pwc-founder29-save-form" onSubmit={saveDraft}>
            <label><span>Recording name</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Morning reflection on confidence" maxLength={240} required /></label>
            <label><span>Private notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What this recording is for…" maxLength={5000} /></label>
            <div className="pwc-founder29-form-row">
              <label><span>Tags</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="reflection, letter idea" /></label>
              <label><span>Asset Vault folder</span><select value={folderId} onChange={(event) => setFolderId(event.target.value)}><option value="">Founder Recordings</option>{(workspace?.folders || []).map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label>
            </div>
            <div className="pwc-founder29-private-choice">
              <label><input type="checkbox" checked={keepPrivate} onChange={(event) => setKeepPrivate(event.target.checked)} /><span><strong>Keep private</strong><small>Founder and Developer only — recommended default</small></span></label>
              {!keepPrivate && <label><span>Explicitly share with</span><select value={shareClientId} onChange={(event) => setShareClientId(event.target.value)} required><option value="">Choose a client</option>{(workspace?.clients || []).map((client) => <option value={client.id} key={client.id}>{clientName(client)}</option>)}</select></label>}
            </div>
            {busy === 'save' && <div className="pwc-founder29-upload-progress"><i style={{ width: `${uploadProgress}%` }} /><span>{uploadProgress}% uploaded</span></div>}
            <div className="pwc-founder29-form-actions"><button type="submit" disabled={!recordingBlob || !title.trim() || busy === 'save'}>{busy === 'save' ? 'Saving privately…' : 'Save to Asset Vault'}</button>{recordingBlob && <button type="button" onClick={resetDraft}>Discard draft</button>}</div>
          </form>
        </article>

        <article className="pwc-founder29-library">
          <header>
            <div><p className="admin-eyebrow">Recording library</p><h3>{recordings.length} {status === 'archived' ? 'archived' : 'active'}</h3></div>
            <div><input aria-label="Search recordings and transcripts" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search audio or transcript…" /><select aria-label="Recording status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Active</option><option value="archived">Archived</option></select></div>
          </header>
          <div className="pwc-founder29-recording-list">
            {recordings.length ? recordings.map((recording) => (
              <button type="button" key={recording.id} className={activeSelectedId === recording.id ? 'is-selected' : ''} onClick={() => selectRecording(recording)}>
                <span className="pwc-founder29-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span>
                <span><strong>{recording.title}</strong><small>{formatDate(recording.created_at)} · {formatDuration(recording.duration_ms)}</small><em>{recording.is_private ? 'Private' : `${recording.assignment_count} shared`} · Transcript {String(recording.transcript_status).replaceAll('_', ' ')}</em></span>
              </button>
            )) : <p className="pwc-founder29-empty">No {status} recordings match this view.</p>}
          </div>

          <div className="pwc-founder29-retention">
            <div><strong>Private recording retention</strong><p>New recordings receive this review date. Permanent deletion always requires the exact title.</p></div>
            <select value={retentionDays} onChange={(event) => setRetentionDays(event.target.value)}><option value="90">90 days</option><option value="180">180 days</option><option value="365">1 year</option><option value="730">2 years</option><option value="1825">5 years</option><option value="3650">10 years</option></select>
            <button type="button" onClick={saveRetention} disabled={busy === 'retention'}>Save retention</button>
          </div>
        </article>
      </div>

      {selected && <article className="pwc-founder29-detail">
        <header>
          <div><p className="admin-eyebrow">Selected recording</p><h3>{selected.title}</h3><p>Asset Vault · {selected.folder_name || 'Founder Recordings'} · Retention review {formatDate(selected.retention_until)}</p></div>
          <div><span className={selected.is_private ? 'is-private' : 'is-shared'}>{selected.is_private ? 'Founder + Developer only' : 'Explicitly shared'}</span><button type="button" onClick={previewSaved} disabled={busy === 'preview'}>Listen</button><button type="button" onClick={downloadSaved} disabled={busy === 'download'}>Download</button></div>
        </header>
        {savedAudioUrl && <audio className="pwc-founder29-saved-audio" controls autoPlay src={savedAudioUrl} />}
        <div className="pwc-founder29-detail-grid">
          <section>
            <h4>Details</h4>
            <label><span>Name</span><input value={detail.title} onChange={(event) => setEditor({ ...detail, title: event.target.value })} /></label>
            <label><span>Notes</span><textarea value={detail.notes} onChange={(event) => setEditor({ ...detail, notes: event.target.value })} /></label>
            <label><span>Tags</span><input value={detail.tags} onChange={(event) => setEditor({ ...detail, tags: event.target.value })} /></label>
            <button type="button" onClick={() => runAction('metadata', () => saveFounderRecording(selected.id, { title: detail.title, notes: detail.notes, tags: detail.tags.split(',').map((value) => value.trim()).filter(Boolean) }), 'Recording details saved.')} disabled={busy === 'metadata' || !detail.title.trim()}>Save details</button>
          </section>
          <section className="pwc-founder29-transcript-editor">
            <div><h4>Transcript</h4><span className={`is-${selected.transcript_status}`}>{String(selected.transcript_status).replaceAll('_', ' ')}</span></div>
            {selected.transcript_error && <p className="is-error">{selected.transcript_error}</p>}
            <textarea value={detail.transcript} onChange={(event) => setEditor({ ...detail, transcript: event.target.value })} placeholder="Request server transcription or write the transcript here…" />
            <div><button type="button" onClick={() => runAction('transcribe', () => requestFounderTranscription(selected.id), 'Transcription requested.')} disabled={busy === 'transcribe'}>Request transcription</button><button type="button" onClick={() => runAction('transcript', () => saveFounderRecording(selected.id, { transcriptText: detail.transcript }), 'Transcript saved.')} disabled={busy === 'transcript'}>Save transcript</button><button type="button" onClick={copyTranscript} disabled={!detail.transcript}>Copy</button><button type="button" onClick={reuseInLetter} disabled={!String(selected.transcript_text || '').trim() || detail.transcript !== selected.transcript_text || busy === 'letter'}>Reuse in Letters</button></div>
          </section>
          <section className="pwc-founder29-sharing">
            <h4>Client access</h4>
            <p>Sharing is always explicit. Removing the final client returns the Asset Vault file to private.</p>
            {(selected.assignments || []).map((assignment) => <div key={assignment.id}><span><strong>{assignment.clientName || 'Client'}</strong><small>Shared {formatDate(assignment.assignedAt)}</small></span><button type="button" onClick={() => runAction('unassign', () => unassignFounderRecording(selected.id, assignment.id), 'Client access removed.')}>Remove</button></div>)}
            <label><span>Assign client</span><select value={assignClientId} onChange={(event) => setAssignClientId(event.target.value)}><option value="">Choose a client</option>{(workspace?.clients || []).map((client) => <option value={client.id} key={client.id}>{clientName(client)}</option>)}</select></label>
            <button type="button" onClick={() => runAction('assign', () => assignFounderRecording(selected.id, assignClientId), 'Recording shared.')} disabled={!assignClientId || busy === 'assign'}>Explicitly share recording</button>
          </section>
        </div>
        <footer className="pwc-founder29-danger">
          <div><strong>Archive or permanently delete</strong><p>Archive keeps the private file recoverable. Permanent deletion removes audio, transcript, grants, and client access.</p></div>
          {selected.status === 'archived' ? <button type="button" onClick={() => runAction('restore', () => restoreFounderRecording(selected.id), 'Recording restored.')}>Restore</button> : <button type="button" onClick={() => runAction('archive', () => archiveFounderRecording(selected.id), 'Recording archived.')}>Archive</button>}
          <label><span>Type “{selected.title}”</span><input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label>
          <button type="button" className="is-delete" onClick={permanentlyDelete} disabled={deleteConfirmation !== selected.title || busy === 'delete'}>Permanently delete</button>
        </footer>
      </article>}
    </section>
  )
}
