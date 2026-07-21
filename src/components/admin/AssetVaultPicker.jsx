import { useEffect, useMemo, useState } from 'react'
import { getAssetVaultAssets } from '../../lib/nativeApi.js'

function displayName(asset) {
  return asset?.title || asset?.original_filename || 'Untitled asset'
}

export default function AssetVaultPicker({
  value = '',
  onChange,
  excludeAssetIds = [],
  label = 'Choose an asset',
  type = '',
}) {
  const [search, setSearch] = useState('')
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const excluded = useMemo(() => new Set(excludeAssetIds), [excludeAssetIds])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const response = await getAssetVaultAssets({ search: search.trim(), status: 'active', type })
        if (active) setAssets((response.assets || []).slice(0, 25))
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
  }, [search, type])

  const options = assets.filter((asset) => !excluded.has(asset.id))

  return (
    <div className="pwc-asset-picker">
      <label>
        <span>{label}</span>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the private vault" />
      </label>
      <div className="pwc-asset-picker-options" role="listbox" aria-label={label}>
        {loading ? <p>Searching the vault…</p> : error ? <p role="alert">{error}</p> : options.length === 0 ? <p>No matching active assets.</p> : options.map((asset) => (
          <button
            type="button"
            role="option"
            aria-selected={value === asset.id}
            className={value === asset.id ? 'is-selected' : ''}
            key={asset.id}
            onClick={() => onChange?.(value === asset.id ? '' : asset.id)}
          >
            <span><strong>{displayName(asset)}</strong><small>{asset.original_filename}</small></span>
            <em>{value === asset.id ? 'Selected' : 'Choose'}</em>
          </button>
        ))}
      </div>
    </div>
  )
}
