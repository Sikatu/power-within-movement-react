import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getAssetVaultAssets,
  getAssetVaultPreviewUrl,
  uploadAssetVaultFile,
} from '../../lib/nativeApi.js'

function displayName(asset) {
  return asset?.title || asset?.original_filename || 'Untitled asset'
}

function isUsable(asset) {
  return asset?.status === 'active' && ['clean', 'disabled'].includes(asset?.scan_status)
}

export default function AssetVaultPicker({
  value = '',
  onChange,
  excludeAssetIds = [],
  label = 'Choose an asset',
  type = '',
  accept = '',
  allowUpload = false,
}) {
  const [search, setSearch] = useState('')
  const [assets, setAssets] = useState([])
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef(null)
  const excluded = useMemo(() => new Set(excludeAssetIds), [excludeAssetIds])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const response = await getAssetVaultAssets({ search: search.trim(), status: 'active', type })
        if (active) {
          const nextAssets = (response.assets || []).slice(0, 25)
          setAssets(nextAssets)
          const current = nextAssets.find((asset) => asset.id === value)
          if (current) setSelectedAsset(current)
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Vault assets could not load.')
      } finally {
        if (active) setLoading(false)
      }
    }, 180)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [search, type, value])

  const options = assets.filter((asset) => !excluded.has(asset.id) && isUsable(asset))
  const selected = options.find((asset) => asset.id === value) || selectedAsset

  async function uploadFile(file) {
    if (!file) return
    if (accept && !file.type.startsWith(accept.replace('/*', '/'))) {
      setError(`Choose a ${accept.replace('/*', '')} file for this block.`)
      return
    }
    setUploading(true)
    setUploadProgress(0)
    setError('')
    try {
      const response = await uploadAssetVaultFile(
        file,
        { title: file.name.replace(/\.[^.]+$/, ''), tags: ['letter-builder'] },
        { onProgress: ({ percent }) => setUploadProgress(percent) },
      )
      const uploaded = response.asset
      setSelectedAsset(uploaded)
      setAssets((current) => [uploaded, ...current.filter((asset) => asset.id !== uploaded.id)])
      if (isUsable(uploaded)) {
        onChange?.(uploaded.id)
      } else {
        setError('Upload complete. This asset must finish its safety scan before it can be selected.')
      }
    } catch (uploadError) {
      setError(uploadError.message || 'The asset could not be uploaded.')
    } finally {
      setUploading(false)
    }
  }

  function handleUpload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    uploadFile(file)
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragActive(false)
    const files = Array.from(event.dataTransfer.files || [])
    if (files.length !== 1) {
      setError('Drop one file at a time.')
      return
    }
    uploadFile(files[0])
  }

  return (
    <div
      className={`pwc-asset-picker${dragActive ? ' is-drag-active' : ''}`}
      onDragEnter={(event) => {
        if (!allowUpload || uploading) return
        event.preventDefault()
        setDragActive(true)
      }}
      onDragOver={(event) => {
        if (!allowUpload || uploading) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false)
      }}
      onDrop={(event) => {
        if (!allowUpload || uploading) return
        handleDrop(event)
      }}
    >
      <div className="pwc-asset-picker-heading">
        <label>
          <span>{label}</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the private vault" />
        </label>
        {allowUpload && <>
          <input ref={inputRef} className="pwc-asset-picker-file" type="file" accept={accept || undefined} onChange={handleUpload} />
          <button type="button" className="pwc-asset-picker-upload" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? `Uploading ${uploadProgress}%` : 'Upload new'}
          </button>
        </>}
      </div>
      {allowUpload && <button type="button" className="pwc-asset-picker-dropzone" onClick={() => inputRef.current?.click()} disabled={uploading}>
        <strong>{dragActive ? 'Drop to upload' : 'Drag an image here'}</strong>
        <span>{uploading ? `Saving to Asset Vault… ${uploadProgress}%` : 'or click to browse your computer'}</span>
      </button>}
      {selected && <article className="pwc-asset-picker-selected">
        {selected.mime_type?.startsWith('image/') && <img src={getAssetVaultPreviewUrl(selected.id)} alt="" />}
        <span><small>Selected asset</small><strong>{displayName(selected)}</strong><em>{selected.original_filename}</em></span>
        <button type="button" onClick={() => onChange?.('')}>Remove</button>
      </article>}
      <div className="pwc-asset-picker-options" role="listbox" aria-label={label}>
        {loading ? <p>Searching the vault…</p> : error ? <p role="alert">{error}</p> : options.length === 0 ? <p>No matching active assets.</p> : options.map((asset) => (
          <button
            type="button"
            role="option"
            aria-selected={value === asset.id}
            className={value === asset.id ? 'is-selected' : ''}
            key={asset.id}
            onClick={() => {
              setSelectedAsset(asset)
              onChange?.(value === asset.id ? '' : asset.id)
            }}
          >
            {asset.mime_type?.startsWith('image/') && <img src={getAssetVaultPreviewUrl(asset.id)} alt="" loading="lazy" />}
            <span><strong>{displayName(asset)}</strong><small>{asset.original_filename}</small></span>
            <em>{value === asset.id ? 'Selected' : 'Choose'}</em>
          </button>
        ))}
      </div>
    </div>
  )
}
