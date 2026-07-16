import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminFrame from '../../components/admin/AdminFrame.jsx'
import { useAdminConfirm } from '../../components/admin/AdminConfirmContext.js'
import AssetVaultPicker from '../../components/admin/AssetVaultPicker.jsx'
import {
  archiveAssetVaultAsset,
  assignAssetVaultAsset,
  assignAssetVaultAssetToAllClients,
  assignAssetVaultAssetToClients,
  createAssetVaultAccessGrant,
  createAssetVaultFolder,
  createAssetVaultRelationship,
  getAdminClients,
  getAssetVaultAsset,
  getAssetVaultAssets,
  getAssetVaultRelationships,
  getAssetVaultSummary,
  removeAssetVaultRelationship,
  restoreAssetVaultAsset,
  unassignAssetVaultAsset,
  updateAssetVaultAsset,
  uploadAssetVaultFile,
  uploadAssetVaultVersion,
} from '../../lib/nativeApi.js'

const typeFilters = [
  { id: '', label: 'All file types' },
  { id: 'application/pdf', label: 'PDFs' },
  { id: 'image/', label: 'Images' },
  { id: 'audio/', label: 'Audio' },
  { id: 'video/', label: 'Video' },
  { id: 'text/', label: 'Text and CSV' },
  { id: 'application/vnd', label: 'Office documents' },
]

function formatBytes(value) {
  const bytes = Number(value || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function formatDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function fileFamily(mimeType) {
  const mime = String(mimeType || '')
  if (mime.startsWith('image/')) return 'Image'
  if (mime.startsWith('audio/')) return 'Audio'
  if (mime.startsWith('video/')) return 'Video'
  if (mime === 'application/pdf') return 'PDF'
  if (mime.startsWith('text/')) return 'Text'
  return 'Document'
}

function clientName(client) {
  return [client?.first_name, client?.last_name].filter(Boolean).join(' ') || client?.email || 'Client'
}

function assetName(asset) {
  return asset?.title || asset?.original_filename || 'Untitled asset'
}

function canPreview(asset) {
  const mime = String(asset?.mime_type || '').toLowerCase()
  return mime === 'application/pdf' || mime.startsWith('image/') || mime.startsWith('audio/') || mime.startsWith('video/') || mime.startsWith('text/')
}

function scanLabel(asset) {
  const status = String(asset?.scan_status || 'disabled')
  if (status === 'clean') return 'Security scan clean'
  if (status === 'disabled') return 'Scanner not configured'
  if (status === 'blocked') return 'Security scan blocked'
  if (status === 'failed') return 'Security scan failed'
  return 'Security scan pending'
}

function AdminAssetVault() {
  const requestConfirm = useAdminConfirm()
  const fileInputRef = useRef(null)
  const versionInputRef = useRef(null)
  const [summary, setSummary] = useState({})
  const [storage, setStorage] = useState({})
  const [folders, setFolders] = useState([])
  const [tags, setTags] = useState([])
  const [assets, setAssets] = useState([])
  const [clients, setClients] = useState([])
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [detail, setDetail] = useState(null)
  const [workspaceView, setWorkspaceView] = useState('library')
  const [assetDetailView, setAssetDetailView] = useState('clients')
  const [filters, setFilters] = useState({ search: '', folderId: '', type: '', status: 'active', tag: '' })
  const [metadataDraft, setMetadataDraft] = useState({ title: '', description: '', folderId: '', tags: '' })
  const [assignmentDraft, setAssignmentDraft] = useState({ clientProfileId: '', title: '', description: '' })
  const [uploadDraft, setUploadDraft] = useState({ title: '', folderId: '', tags: '' })
  const [newFolderName, setNewFolderName] = useState('')
  const [versionNotes, setVersionNotes] = useState('')
  const [versionProgress, setVersionProgress] = useState(0)
  const [uploadQueue, setUploadQueue] = useState([])
  const [selectedClientIds, setSelectedClientIds] = useState([])
  const [clientSearch, setClientSearch] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [relationships, setRelationships] = useState([])
  const [relatedAssetId, setRelatedAssetId] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const loadSummary = useCallback(async () => {
    const response = await getAssetVaultSummary()
    setSummary(response.summary || {})
    setStorage(response.storage || {})
    setFolders(response.folders || [])
    setTags(response.tags || [])
  }, [])

  const loadAssets = useCallback(async () => {
    const response = await getAssetVaultAssets(filters)
    setAssets(response.assets || [])
    setSelectedAssetId((current) => (
      response.assets?.some((asset) => asset.id === current)
        ? current
        : response.assets?.[0]?.id || ''
    ))
  }, [filters])

  const loadDetail = useCallback(async (assetId) => {
    if (!assetId) {
      setDetail(null)
      setRelationships([])
      setPreviewUrl('')
      return
    }
    const [response, relationshipResponse] = await Promise.all([
      getAssetVaultAsset(assetId),
      getAssetVaultRelationships(assetId),
    ])
    setDetail(response)
    setRelationships(relationshipResponse.relationships || [])
    setPreviewUrl('')
    setSelectedClientIds([])
    const asset = response.asset || {}
    setMetadataDraft({
      title: asset.title || '',
      description: asset.description || '',
      folderId: asset.folder_id || '',
      tags: (asset.tags || []).join(', '),
    })
    setAssignmentDraft((current) => ({ ...current, title: asset.title || '', description: asset.description || '' }))
  }, [])

  const refreshAll = useCallback(async ({ preserveNotice = false } = {}) => {
    setLoading(true)
    setError('')
    if (!preserveNotice) setNotice('')
    try {
      await Promise.all([loadSummary(), loadAssets(), getAdminClients().then((response) => setClients(response.clients || []))])
    } catch (loadError) {
      setError(loadError.message || 'The Asset Vault could not open.')
    } finally {
      setLoading(false)
    }
  }, [loadAssets, loadSummary])

  useEffect(() => {
    const timer = window.setTimeout(refreshAll, 0)
    return () => window.clearTimeout(timer)
  }, [refreshAll])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDetail(selectedAssetId).catch((loadError) => setError(loadError.message || 'Asset details could not load.'))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadDetail, selectedAssetId])

  const activeAssignments = useMemo(() => (detail?.assignments || []).filter((assignment) => assignment.status === 'active'), [detail])
  const eligibleBulkClients = useMemo(() => clients.filter((client) => client.client_status !== 'archived' && (!client.role || client.role === 'client')), [clients])
  const activeAssignmentClientIds = useMemo(() => new Set(activeAssignments.map((assignment) => assignment.client_profile_id)), [activeAssignments])
  const bulkAssignableCount = useMemo(() => eligibleBulkClients.filter((client) => !activeAssignmentClientIds.has(client.id)).length, [activeAssignmentClientIds, eligibleBulkClients])
  const selectedAsset = detail?.asset || assets.find((asset) => asset.id === selectedAssetId) || null
  const assetUsable = selectedAsset?.status === 'active' && ['clean', 'disabled'].includes(selectedAsset?.scan_status || 'disabled')
  const selectableClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase()
    return eligibleBulkClients.filter((client) => {
      if (activeAssignmentClientIds.has(client.id)) return false
      return !query || `${clientName(client)} ${client.email || ''}`.toLowerCase().includes(query)
    })
  }, [activeAssignmentClientIds, clientSearch, eligibleBulkClients])

  async function handleFiles(fileList) {
    const files = [...(fileList || [])]
    if (!files.length) return
    const queue = files.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      file,
      name: file.name,
      percent: 0,
      status: 'queued',
    }))
    setUploadQueue(queue)
    setBusy('upload')
    setError('')
    setNotice('')

    try {
      let lastAsset = null
      for (const entry of queue) {
        setUploadQueue((current) => current.map((item) => item.id === entry.id ? { ...item, status: 'uploading' } : item))
        const response = await uploadAssetVaultFile(entry.file, {
          title: files.length === 1 ? uploadDraft.title : '',
          folderId: uploadDraft.folderId,
          tags: uploadDraft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        }, {
          onProgress: ({ percent }) => setUploadQueue((current) => current.map((item) => item.id === entry.id ? { ...item, percent } : item)),
        })
        setUploadQueue((current) => current.map((item) => item.id === entry.id ? { ...item, percent: 100, status: 'complete' } : item))
        lastAsset = response.asset
      }
      setUploadDraft({ title: '', folderId: uploadDraft.folderId, tags: '' })
      setNotice(`${files.length} asset${files.length === 1 ? '' : 's'} uploaded securely.`)
      await Promise.all([loadSummary(), loadAssets()])
      if (lastAsset?.id) {
        setSelectedAssetId(lastAsset.id)
        setAssetDetailView('clients')
        setWorkspaceView('library')
      }
    } catch (uploadError) {
      setUploadQueue((current) => current.map((item) => ['queued', 'uploading'].includes(item.status) ? { ...item, status: 'failed' } : item))
      setError(uploadError.message || 'The upload could not be completed.')
    } finally {
      setBusy('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleMetadataSave() {
    if (!selectedAsset) return
    setBusy('metadata')
    setError('')
    try {
      const response = await updateAssetVaultAsset(selectedAsset.id, {
        title: metadataDraft.title,
        description: metadataDraft.description,
        folderId: metadataDraft.folderId || null,
        tags: metadataDraft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      })
      setNotice(response.message || 'Asset details saved.')
      await Promise.all([loadSummary(), loadAssets(), loadDetail(selectedAsset.id)])
    } catch (saveError) {
      setError(saveError.message || 'Asset details could not be saved.')
    } finally {
      setBusy('')
    }
  }

  function selectAsset(assetId) {
    setSelectedAssetId(assetId)
    setAssetDetailView('clients')
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return
    setBusy('folder')
    setError('')
    try {
      const response = await createAssetVaultFolder({ name: newFolderName.trim() })
      setNotice(response.message || 'Folder created.')
      setNewFolderName('')
      await loadSummary()
    } catch (folderError) {
      setError(folderError.message || 'The folder could not be created.')
    } finally {
      setBusy('')
    }
  }

  async function handleArchiveToggle() {
    if (!selectedAsset) return
    const restoring = selectedAsset.status === 'archived'
    const accepted = await requestConfirm({
      title: restoring ? 'Restore this asset?' : 'Archive this asset?',
      message: restoring
        ? 'The asset will return to the active library.'
        : 'Existing client assignments remain recorded, but the asset will be removed from active Studio views.',
      confirmLabel: restoring ? 'Restore asset' : 'Archive asset',
      tone: restoring ? 'default' : 'danger',
    })
    if (!accepted) return

    setBusy('archive')
    try {
      const response = restoring
        ? await restoreAssetVaultAsset(selectedAsset.id)
        : await archiveAssetVaultAsset(selectedAsset.id)
      setNotice(response.message)
      setSelectedAssetId('')
      setDetail(null)
      await Promise.all([loadSummary(), loadAssets()])
    } catch (archiveError) {
      setError(archiveError.message || 'The asset status could not be changed.')
    } finally {
      setBusy('')
    }
  }

  async function handleAssign() {
    if (!selectedAsset || !assetUsable || !assignmentDraft.clientProfileId) return
    setBusy('assign')
    setError('')
    try {
      const response = await assignAssetVaultAsset(selectedAsset.id, assignmentDraft)
      setNotice(response.message || 'Asset assigned.')
      setAssignmentDraft((current) => ({ ...current, clientProfileId: '' }))
      await Promise.all([loadSummary(), loadAssets(), loadDetail(selectedAsset.id)])
    } catch (assignError) {
      setError(assignError.message || 'The client assignment could not be created.')
    } finally {
      setBusy('')
    }
  }

  async function handleAssignAll() {
    if (!selectedAsset || !assetUsable || eligibleBulkClients.length === 0) return
    const alreadyAssignedCount = eligibleBulkClients.length - bulkAssignableCount
    const accepted = await requestConfirm({
      title: `Assign to all ${eligibleBulkClients.length} clients?`,
      message: `“${assetName(selectedAsset)}” will be added to every non-archived client portal. ${alreadyAssignedCount} existing assignment${alreadyAssignedCount === 1 ? ' will' : 's will'} be skipped, so no duplicate resources are created.`,
      confirmLabel: 'Assign to all clients',
      tone: 'default',
    })
    if (!accepted) return

    setBusy('assign-all')
    setError('')
    try {
      const response = await assignAssetVaultAssetToAllClients(selectedAsset.id, {
        title: assignmentDraft.title,
        description: assignmentDraft.description,
      })
      setNotice(response.message || 'Asset assigned to all eligible clients.')
      await Promise.all([loadSummary(), loadAssets(), loadDetail(selectedAsset.id)])
    } catch (assignError) {
      setError(assignError.message || 'The bulk client assignment could not be completed.')
    } finally {
      setBusy('')
    }
  }

  async function handleAssignSelected() {
    if (!selectedAsset || !assetUsable || selectedClientIds.length === 0) return
    const accepted = await requestConfirm({
      title: `Assign to ${selectedClientIds.length} selected client${selectedClientIds.length === 1 ? '' : 's'}?`,
      message: `“${assetName(selectedAsset)}” will be added to the chosen client portals. Existing assignments are skipped safely.`,
      confirmLabel: 'Assign selected clients',
      tone: 'default',
    })
    if (!accepted) return

    setBusy('assign-selected')
    setError('')
    try {
      const response = await assignAssetVaultAssetToClients(selectedAsset.id, {
        clientProfileIds: selectedClientIds,
        title: assignmentDraft.title,
        description: assignmentDraft.description,
      })
      setNotice(response.message || 'Asset assigned to the selected clients.')
      setSelectedClientIds([])
      await Promise.all([loadSummary(), loadAssets(), loadDetail(selectedAsset.id)])
    } catch (assignError) {
      setError(assignError.message || 'The selected client assignments could not be completed.')
    } finally {
      setBusy('')
    }
  }

  async function handleAssetAccess(purpose) {
    if (!selectedAsset || !assetUsable) return
    setBusy(`access-${purpose}`)
    setError('')
    try {
      const response = await createAssetVaultAccessGrant(selectedAsset.id, purpose)
      if (purpose === 'preview') {
        setPreviewUrl(response.url)
        setNotice('A short-lived preview was opened. It will not remain publicly accessible.')
      } else {
        const link = document.createElement('a')
        link.href = response.url
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        document.body.appendChild(link)
        link.click()
        link.remove()
        setNotice('A short-lived download link was created and opened.')
      }
    } catch (accessError) {
      setError(accessError.message || `The asset ${purpose} could not be opened.`)
    } finally {
      setBusy('')
    }
  }

  async function handleCreateRelationship() {
    if (!selectedAsset || !relatedAssetId) return
    setBusy('relationship')
    setError('')
    try {
      const response = await createAssetVaultRelationship(selectedAsset.id, {
        relatedAssetId,
        relationshipType: 'attachment',
        contextType: 'generic',
      })
      setNotice(response.message || 'Asset relationship saved.')
      setRelatedAssetId('')
      await loadDetail(selectedAsset.id)
    } catch (relationshipError) {
      setError(relationshipError.message || 'The asset relationship could not be saved.')
    } finally {
      setBusy('')
    }
  }

  async function handleRemoveRelationship(relationshipId) {
    if (!selectedAsset) return
    setBusy(`relationship-${relationshipId}`)
    setError('')
    try {
      const response = await removeAssetVaultRelationship(selectedAsset.id, relationshipId)
      setNotice(response.message || 'Asset relationship removed.')
      await loadDetail(selectedAsset.id)
    } catch (relationshipError) {
      setError(relationshipError.message || 'The asset relationship could not be removed.')
    } finally {
      setBusy('')
    }
  }

  async function handleUnassign(assignment) {
    const accepted = await requestConfirm({
      title: 'Remove this client assignment?',
      message: 'The resource will be removed from the client portal, while its assignment history remains in the Asset Vault.',
      confirmLabel: 'Remove assignment',
      tone: 'danger',
    })
    if (!accepted) return

    setBusy(`unassign-${assignment.id}`)
    try {
      const response = await unassignAssetVaultAsset(selectedAsset.id, assignment.id)
      setNotice(response.message)
      await Promise.all([loadSummary(), loadAssets(), loadDetail(selectedAsset.id)])
    } catch (unassignError) {
      setError(unassignError.message || 'The assignment could not be removed.')
    } finally {
      setBusy('')
    }
  }

  async function handleVersionFile(file) {
    if (!selectedAsset || !file) return
    setBusy('version')
    setVersionProgress(0)
    setError('')
    try {
      const response = await uploadAssetVaultVersion(selectedAsset.id, file, versionNotes, {
        onProgress: ({ percent }) => setVersionProgress(percent),
      })
      setNotice(response.message || 'A new version was uploaded.')
      setVersionNotes('')
      await Promise.all([loadSummary(), loadAssets(), loadDetail(selectedAsset.id)])
    } catch (versionError) {
      setError(versionError.message || 'The new version could not be uploaded.')
    } finally {
      setBusy('')
      if (versionInputRef.current) versionInputRef.current.value = ''
    }
  }

  return (
    <AdminFrame>
      <div className="pwc-assets26-page">
        <header className="pwc-assets26-hero">
          <div>
            <p className="pwc-assets26-eyebrow">Client resources</p>
            <h1>Asset Vault</h1>
            <p>Store private resources once, then deliver them safely to the right clients.</p>
            <div className="pwc-assets26-hero-meta">
              <span>{storage.driver === 's3' ? 'S3-compatible storage' : 'Private local storage'}</span>
              <span>{formatBytes(storage.maxUploadBytes)} per file</span>
              <span>Authenticated delivery</span>
            </div>
          </div>
          <div className="pwc-assets26-hero-actions">
            <button type="button" className="is-secondary" onClick={() => refreshAll()} disabled={loading}>Refresh vault</button>
            <button type="button" onClick={() => setWorkspaceView('upload')} disabled={busy === 'upload'}>{busy === 'upload' ? 'Uploading…' : 'Upload assets'}</button>
          </div>
        </header>

        {(error || notice) && <div className={`pwc-assets26-notice ${error ? 'is-error' : 'is-success'}`} role={error ? 'alert' : 'status'}>{error || notice}</div>}

        <section className="pwc-assets26-metrics" aria-label="Asset Vault summary">
          <article><span>Active assets</span><strong>{Number(summary.active_assets || 0)}</strong><small>Ready for reuse</small></article>
          <article><span>Assigned assets</span><strong>{Number(summary.assigned_assets || 0)}</strong><small>Visible in client care</small></article>
          <article><span>Vault storage</span><strong>{formatBytes(summary.active_bytes)}</strong><small>Active file volume</small></article>
          <article><span>Archived</span><strong>{Number(summary.archived_assets || 0)}</strong><small>Retained history</small></article>
        </section>

        <nav className="onboarding-studio-tabs" aria-label="Asset Vault workspace">
          <button className={workspaceView === 'library' ? 'is-active' : ''} onClick={() => setWorkspaceView('library')} type="button">
            Library ({assets.length})
          </button>
          <button className={workspaceView === 'upload' ? 'is-active' : ''} onClick={() => setWorkspaceView('upload')} type="button">
            Upload
          </button>
        </nav>

        {workspaceView === 'upload' && (
        <>
        <section className="pwc-assets26-upload-grid">
          <div
            className={`pwc-assets26-dropzone${dragActive ? ' is-dragging' : ''}`}
            onDragEnter={(event) => { event.preventDefault(); setDragActive(true) }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => { event.preventDefault(); setDragActive(false); handleFiles(event.dataTransfer.files) }}
          >
            <input ref={fileInputRef} type="file" multiple hidden onChange={(event) => handleFiles(event.target.files)} />
            <span className="pwc-assets26-drop-icon" aria-hidden="true">↑</span>
            <div><p className="pwc-assets26-eyebrow">Secure upload</p><h2>Drop files into the vault</h2><p>PDFs, images, Office files, audio, video, text, and CSV are supported.</p></div>
            <button type="button" onClick={() => fileInputRef.current?.click()}>Choose files</button>
          </div>
          <div className="pwc-assets26-upload-options">
            <label><span>Optional title</span><input value={uploadDraft.title} onChange={(event) => setUploadDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Uses the filename when empty" /></label>
            <label><span>Folder</span><select value={uploadDraft.folderId} onChange={(event) => setUploadDraft((current) => ({ ...current, folderId: event.target.value }))}><option value="">General vault</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
            <label><span>Tags</span><input value={uploadDraft.tags} onChange={(event) => setUploadDraft((current) => ({ ...current, tags: event.target.value }))} placeholder="client, confidence, worksheet" /></label>
          </div>
        </section>

        {uploadQueue.length > 0 && (
          <section className="pwc-assets26-upload-queue" aria-label="Upload progress" aria-live="polite">
            <header><div><p className="pwc-assets26-eyebrow">Transfer queue</p><h2>Secure upload progress</h2></div><button type="button" onClick={() => setUploadQueue([])} disabled={busy === 'upload'}>Clear completed</button></header>
            <div>{uploadQueue.map((item) => <article key={item.id} className={`is-${item.status}`}><div><strong>{item.name}</strong><span>{item.status === 'failed' ? 'Upload failed' : item.status === 'complete' ? 'Stored securely' : item.status === 'queued' ? 'Waiting' : `${item.percent}% uploaded`}</span></div><progress max="100" value={item.percent}>{item.percent}%</progress></article>)}</div>
          </section>
        )}
        </>
        )}

        {workspaceView === 'library' && (
        <section className="pwc-assets26-workspace">
          <aside className="pwc-assets26-library">
            <header><div><p className="pwc-assets26-eyebrow">Vault library</p><h2>{assets.length} asset{assets.length === 1 ? '' : 's'}</h2></div><button type="button" className="is-compact" onClick={() => setFilters((current) => ({ ...current, status: current.status === 'active' ? 'archived' : 'active' }))}>{filters.status === 'active' ? 'View archive' : 'View active'}</button></header>
            <div className="pwc-assets26-filters">
              <input type="search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search assets" aria-label="Search assets" />
              <select value={filters.folderId} onChange={(event) => setFilters((current) => ({ ...current, folderId: event.target.value }))} aria-label="Filter by folder"><option value="">All folders</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
              <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))} aria-label="Filter by file type">{typeFilters.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
              <select value={filters.tag} onChange={(event) => setFilters((current) => ({ ...current, tag: event.target.value }))} aria-label="Filter by tag"><option value="">All tags</option>{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select>
            </div>

            <div className="pwc-assets26-asset-list" aria-label="Assets">
              {loading ? <p className="pwc-assets26-empty">Opening the private vault…</p> : assets.length === 0 ? <div className="pwc-assets26-empty"><strong>No assets match this view.</strong><span>Upload a file or change the filters.</span></div> : assets.map((asset) => (
                <button type="button" key={asset.id} className={asset.id === selectedAssetId ? 'is-selected' : ''} onClick={() => selectAsset(asset.id)}>
                  <span className={`pwc-assets26-filemark is-${fileFamily(asset.mime_type).toLowerCase()}`}>{fileFamily(asset.mime_type).slice(0, 3).toUpperCase()}</span>
                  <span className="pwc-assets26-asset-copy"><strong>{assetName(asset)}</strong><small>{asset.folder_name || 'General vault'} · {formatBytes(asset.size_bytes)}</small><em>{asset.original_filename}</em></span>
                  <span className="pwc-assets26-assignment-count">{Number(asset.assignment_count || 0)} assigned</span>
                </button>
              ))}
            </div>

            <div className="pwc-assets26-folder-create">
              <label><span>New folder</span><input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="Folder name" /></label>
              <button type="button" onClick={handleCreateFolder} disabled={!newFolderName.trim() || busy === 'folder'}>{busy === 'folder' ? 'Creating…' : 'Create'}</button>
            </div>
          </aside>

          <div className="pwc-assets26-detail">
            {!selectedAsset ? (
              <div className="pwc-assets26-detail-empty"><p className="pwc-assets26-eyebrow">Asset details</p><h2>Select a file from the vault</h2><p>Metadata, versions, client assignments, and secure download controls will appear here.</p></div>
            ) : (
              <>
                <header className="pwc-assets26-detail-header">
                  <div><span className={`pwc-assets26-filemark is-${fileFamily(selectedAsset.mime_type).toLowerCase()}`}>{fileFamily(selectedAsset.mime_type).slice(0, 3).toUpperCase()}</span><div><p className="pwc-assets26-eyebrow">Version {selectedAsset.current_version_number}</p><h2>{assetName(selectedAsset)}</h2><p>{selectedAsset.original_filename}</p></div></div>
                  <div>{canPreview(selectedAsset) && <button type="button" className="is-secondary" onClick={() => handleAssetAccess('preview')} disabled={!assetUsable || busy === 'access-preview'}>{busy === 'access-preview' ? 'Opening…' : 'Preview'}</button>}<button type="button" onClick={() => handleAssetAccess('download')} disabled={!assetUsable || busy === 'access-download'}>{busy === 'access-download' ? 'Preparing…' : 'Download'}</button><button type="button" className="is-secondary" onClick={handleArchiveToggle}>{selectedAsset.status === 'archived' ? 'Restore' : 'Archive'}</button></div>
                </header>

                <nav className="onboarding-studio-tabs" aria-label="Selected asset workspace">
                  <button className={assetDetailView === 'clients' ? 'is-active' : ''} onClick={() => setAssetDetailView('clients')} type="button">
                    Client delivery ({activeAssignments.length})
                  </button>
                  <button className={assetDetailView === 'details' ? 'is-active' : ''} onClick={() => setAssetDetailView('details')} type="button">
                    Details
                  </button>
                  <button className={assetDetailView === 'reuse' ? 'is-active' : ''} onClick={() => setAssetDetailView('reuse')} type="button">
                    Reuse & versions
                  </button>
                </nav>

                <div className="pwc-assets26-facts">
                  <div><span>Type</span><strong>{selectedAsset.mime_type}</strong></div><div><span>Size</span><strong>{formatBytes(selectedAsset.size_bytes)}</strong></div><div><span>Updated</span><strong>{formatDate(selectedAsset.updated_at)}</strong></div><div><span>Checksum</span><strong title={selectedAsset.checksum_sha256}>{String(selectedAsset.checksum_sha256 || '').slice(0, 12)}…</strong></div><div className={`is-scan-${selectedAsset.scan_status || 'disabled'}`}><span>File security</span><strong>{scanLabel(selectedAsset)}</strong></div>
                </div>

                {!assetUsable && <div className="pwc-assets26-scan-warning" role="alert"><strong>{scanLabel(selectedAsset)}</strong><span>{selectedAsset.scan_message || 'Preview, download, and client assignment are locked until this asset is safe to use.'}</span></div>}

                {previewUrl && (
                  <section className="pwc-assets26-preview" aria-label={`Preview of ${assetName(selectedAsset)}`}>
                    <header><div><p className="pwc-assets26-eyebrow">Short-lived preview</p><h3>{assetName(selectedAsset)}</h3></div><button type="button" onClick={() => setPreviewUrl('')}>Close preview</button></header>
                    {selectedAsset.mime_type.startsWith('image/') ? <img src={previewUrl} alt={`Preview of ${assetName(selectedAsset)}`} /> : selectedAsset.mime_type.startsWith('audio/') ? <audio src={previewUrl} controls /> : selectedAsset.mime_type.startsWith('video/') ? <video src={previewUrl} controls /> : <iframe src={previewUrl} title={`Preview of ${assetName(selectedAsset)}`} />}
                  </section>
                )}

                {assetDetailView === 'details' && (
                <section className="pwc-assets26-panel">
                  <header><div><p className="pwc-assets26-eyebrow">Organization</p><h3>Reusable asset details</h3></div><button type="button" onClick={handleMetadataSave} disabled={busy === 'metadata'}>{busy === 'metadata' ? 'Saving…' : 'Save details'}</button></header>
                  <div className="pwc-assets26-form-grid"><label><span>Title</span><input value={metadataDraft.title} onChange={(event) => setMetadataDraft((current) => ({ ...current, title: event.target.value }))} /></label><label><span>Folder</span><select value={metadataDraft.folderId} onChange={(event) => setMetadataDraft((current) => ({ ...current, folderId: event.target.value }))}><option value="">General vault</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><label className="is-wide"><span>Description</span><textarea rows="3" value={metadataDraft.description} onChange={(event) => setMetadataDraft((current) => ({ ...current, description: event.target.value }))} /></label><label className="is-wide"><span>Tags</span><input value={metadataDraft.tags} onChange={(event) => setMetadataDraft((current) => ({ ...current, tags: event.target.value }))} placeholder="Comma-separated tags" /></label></div>
                </section>
                )}

                {assetDetailView === 'clients' && (
                <section className="pwc-assets26-panel">
                  <header><div><p className="pwc-assets26-eyebrow">Client delivery</p><h3>Assignments</h3></div><span>{activeAssignments.length} active</span></header>
                  <div className="pwc-assets26-assignment-form"><select value={assignmentDraft.clientProfileId} onChange={(event) => setAssignmentDraft((current) => ({ ...current, clientProfileId: event.target.value }))}><option value="">Choose a client</option>{clients.map((client) => <option key={client.id} value={client.id}>{clientName(client)}</option>)}</select><input value={assignmentDraft.title} onChange={(event) => setAssignmentDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Client-facing title" /><button type="button" onClick={handleAssign} disabled={!assetUsable || !assignmentDraft.clientProfileId || busy === 'assign'}>{busy === 'assign' ? 'Assigning…' : 'Assign to portal'}</button></div>
                  <div className="pwc-assets26-client-multi">
                    <header><div><strong>Choose multiple clients</strong><span>Select only the portals that should receive this resource.</span></div><em>{selectedClientIds.length} selected</em></header>
                    <div className="pwc-assets26-client-multi-tools"><input type="search" value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Search eligible clients" aria-label="Search eligible clients" /><button type="button" onClick={() => setSelectedClientIds(selectableClients.map((client) => client.id))}>Select shown</button><button type="button" onClick={() => setSelectedClientIds([])}>Clear</button></div>
                    <div className="pwc-assets26-client-options">{selectableClients.length === 0 ? <p>No unassigned clients match this search.</p> : selectableClients.map((client) => <label key={client.id}><input type="checkbox" checked={selectedClientIds.includes(client.id)} onChange={(event) => setSelectedClientIds((current) => event.target.checked ? [...new Set([...current, client.id])] : current.filter((id) => id !== client.id))} /><span><strong>{clientName(client)}</strong><small>{client.email || 'Private client profile'}</small></span></label>)}</div>
                    <button type="button" onClick={handleAssignSelected} disabled={!assetUsable || selectedClientIds.length === 0 || busy === 'assign-selected'}>{busy === 'assign-selected' ? 'Assigning selected…' : `Assign ${selectedClientIds.length || ''} selected client${selectedClientIds.length === 1 ? '' : 's'}`}</button>
                  </div>
                  <div className="pwc-assets26-assignment-bulk"><div><strong>Share with every client</strong><span>{bulkAssignableCount > 0 ? `${bulkAssignableCount} of ${eligibleBulkClients.length} eligible clients do not have this resource yet.` : eligibleBulkClients.length > 0 ? 'Every eligible client already has this resource.' : 'No eligible client profiles are available.'}</span><small>Archived profiles and non-client system accounts are excluded.</small></div><button type="button" onClick={handleAssignAll} disabled={!assetUsable || busy === 'assign-all' || eligibleBulkClients.length === 0}>{busy === 'assign-all' ? 'Assigning to all…' : 'Assign to all clients'}</button></div>
                  <div className="pwc-assets26-assignment-list">{activeAssignments.length === 0 ? <p>No active client assignments.</p> : activeAssignments.map((assignment) => <article key={assignment.id}><div><strong>{[assignment.first_name, assignment.last_name].filter(Boolean).join(' ') || assignment.email || 'Client'}</strong><span>{assignment.email || 'Private client profile'}</span><small>Assigned {formatDate(assignment.assigned_at)}</small></div><button type="button" onClick={() => handleUnassign(assignment)} disabled={busy === `unassign-${assignment.id}`}>Remove</button></article>)}</div>
                </section>
                )}

                {assetDetailView === 'reuse' && (
                <>
                <section className="pwc-assets26-panel">
                  <header><div><p className="pwc-assets26-eyebrow">Reuse foundation</p><h3>Asset relationships</h3></div><span>{relationships.length} linked</span></header>
                  <div className="pwc-assets26-relationship-create"><AssetVaultPicker value={relatedAssetId} onChange={setRelatedAssetId} excludeAssetIds={[selectedAsset.id]} label="Relate another vault asset" /><button type="button" onClick={handleCreateRelationship} disabled={!relatedAssetId || busy === 'relationship'}>{busy === 'relationship' ? 'Linking…' : 'Link asset'}</button></div>
                  <div className="pwc-assets26-relationship-list">{relationships.length === 0 ? <p>No related assets yet. This foundation can be reused by letters, Circle posts, recordings, and transcripts.</p> : relationships.map((relationship) => <article key={relationship.id}><div><strong>{relationship.related_asset_title || relationship.context_id || 'Related content'}</strong><span>{relationship.related_asset_filename || `${relationship.context_type} · ${relationship.relationship_type}`}</span></div><button type="button" onClick={() => handleRemoveRelationship(relationship.id)} disabled={busy === `relationship-${relationship.id}`}>Remove</button></article>)}</div>
                </section>

                <section className="pwc-assets26-panel">
                  <header><div><p className="pwc-assets26-eyebrow">Version history</p><h3>{detail?.versions?.length || 0} saved version{detail?.versions?.length === 1 ? '' : 's'}</h3></div><button type="button" className="is-secondary" onClick={() => versionInputRef.current?.click()} disabled={busy === 'version'}>{busy === 'version' ? 'Uploading…' : 'Upload new version'}</button></header>
                  <input ref={versionInputRef} type="file" hidden onChange={(event) => handleVersionFile(event.target.files?.[0])} />
                  <label className="pwc-assets26-version-notes"><span>Version notes</span><input value={versionNotes} onChange={(event) => setVersionNotes(event.target.value)} placeholder="What changed in this version?" /></label>
                  {(busy === 'version' || versionProgress > 0) && <div className="pwc-assets26-version-progress" aria-live="polite"><progress max="100" value={versionProgress}>{versionProgress}%</progress><span>{versionProgress < 100 ? `${versionProgress}% uploaded` : 'Upload complete'}</span></div>}
                  <div className="pwc-assets26-version-list">{(detail?.versions || []).map((version) => <article key={version.id}><span>v{version.version_number}</span><div><strong>{version.original_filename}</strong><small>{formatBytes(version.size_bytes)} · {formatDate(version.created_at)}</small></div><em>{version.notes || (version.version_number === selectedAsset.current_version_number ? 'Current version' : 'Saved version')}</em></article>)}</div>
                </section>
                </>
                )}
              </>
            )}
          </div>
        </section>
        )}
      </div>
    </AdminFrame>
  )
}

export default AdminAssetVault
