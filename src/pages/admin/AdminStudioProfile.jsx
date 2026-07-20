import { useEffect, useRef, useState } from 'react'
import AdminFrame from '../../components/admin/AdminFrame.jsx'
import AssetVaultPicker from '../../components/admin/AssetVaultPicker.jsx'
import {
  createAssetVaultAccessGrant,
  getStudioProfile,
  saveStudioProfile,
  uploadAssetVaultFile,
} from '../../lib/nativeApi.js'
import '../../styles/AdminStudioProfile.css'

const emptyProfile = {
  displayName: '',
  welcomeMessage: '',
  bio: '',
  signatureLine: '',
  publicEmail: '',
  publicPhone: '',
  profileAssetId: null,
}

function AdminStudioProfile() {
  const fileInputRef = useRef(null)
  const [profile, setProfile] = useState(emptyProfile)
  const [savedProfile, setSavedProfile] = useState(emptyProfile)
  const [previewUrl, setPreviewUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function openProtectedPreview(assetId) {
    setPreviewUrl('')
    if (!assetId) return
    const grant = await createAssetVaultAccessGrant(assetId, 'preview')
    setPreviewUrl(grant.url)
  }

  useEffect(() => {
    let active = true
    getStudioProfile()
      .then(async (response) => {
        if (!active) return
        const next = { ...emptyProfile, ...(response.profile || {}) }
        setProfile(next)
        setSavedProfile(next)
        if (next.profileAssetId) {
          try {
            const grant = await createAssetVaultAccessGrant(next.profileAssetId, 'preview')
            if (active) setPreviewUrl(grant.url)
          } catch {
            if (active) setPreviewUrl('')
          }
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'The Studio Profile could not open.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  function updateField(event) {
    const { name, value } = event.target
    setProfile((current) => ({ ...current, [name]: value }))
    setNotice('')
  }

  async function chooseAsset(assetId) {
    setError('')
    setNotice('')
    setProfile((current) => ({ ...current, profileAssetId: assetId || null }))
    try {
      await openProtectedPreview(assetId)
    } catch (previewError) {
      setError(previewError.message || 'The selected image could not be previewed.')
    }
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file such as JPG, PNG, or WebP.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Choose an image smaller than 10 MB.')
      return
    }

    setBusy('upload')
    setError('')
    setNotice('')
    try {
      const response = await uploadAssetVaultFile(file, {
        title: `Studio profile · ${file.name.replace(/\.[^.]+$/, '')}`,
        tags: ['studio-profile', 'brand'],
      })
      const assetId = response.asset?.id
      if (!assetId) throw new Error('The uploaded image did not return an Asset Vault record.')
      await chooseAsset(assetId)
      setNotice('Image uploaded. Save the profile when the preview feels right.')
    } catch (uploadError) {
      setError(uploadError.message || 'The image could not be uploaded.')
    } finally {
      setBusy('')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy('save')
    setError('')
    setNotice('')
    try {
      const response = await saveStudioProfile(profile)
      const next = { ...emptyProfile, ...(response.profile || profile) }
      setProfile(next)
      setSavedProfile(next)
      setNotice(response.message || 'Studio Profile saved.')
    } catch (saveError) {
      setError(saveError.message || 'The Studio Profile could not be saved.')
    } finally {
      setBusy('')
    }
  }

  const hasChanges = JSON.stringify(profile) !== JSON.stringify(savedProfile)
  const initials = profile.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'PW'

  return (
    <AdminFrame>
      <main id="main-content" className="studio-profile46" tabIndex={-1}>
        <header className="studio-profile46__hero">
          <div><p className="admin-eyebrow">Studio identity</p><h1>Studio Profile</h1><p>Keep the face, voice, and public contact details of Power Within in one calm place.</p></div>
          <aside><span>Save state</span><strong>{hasChanges ? 'Changes ready' : 'Up to date'}</strong><small>{hasChanges ? 'Review the preview, then save.' : 'Your latest profile is safely stored.'}</small></aside>
        </header>

        {error && <div className="studio-profile46__alert is-error" role="alert">{error}</div>}
        {notice && <div className="studio-profile46__alert is-success" role="status">{notice}</div>}

        {loading ? <section className="studio-profile46__loading" aria-busy="true">Opening the Studio Profile…</section> : (
          <div className="studio-profile46__layout">
            <form className="studio-profile46__editor" onSubmit={handleSubmit}>
              <section>
                <div className="studio-profile46__section-heading"><span>01</span><div><h2>Profile image</h2><p>Upload one image or choose an existing image from the private Vault.</p></div></div>
                <div className="studio-profile46__image-tools">
                  <div className="studio-profile46__avatar">{previewUrl ? <img src={previewUrl} alt="Current Studio profile preview" /> : <span>{initials}</span>}</div>
                  <div><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadImage} hidden /><button type="button" className="btn secondary" onClick={() => fileInputRef.current?.click()} disabled={Boolean(busy)}>{busy === 'upload' ? 'Uploading…' : 'Upload image'}</button>{profile.profileAssetId && <button type="button" className="btn text" onClick={() => chooseAsset('')} disabled={Boolean(busy)}>Remove</button>}<small>JPG, PNG, WebP, or GIF · maximum 10 MB</small></div>
                </div>
                <details className="studio-profile46__vault"><summary>Choose from Asset Vault</summary><AssetVaultPicker value={profile.profileAssetId || ''} onChange={chooseAsset} label="Search profile images" type="image/" /></details>
              </section>

              <section>
                <div className="studio-profile46__section-heading"><span>02</span><div><h2>Voice & identity</h2><p>Use short, warm copy that still sounds like you.</p></div></div>
                <div className="studio-profile46__fields">
                  <label><span>Display name</span><input name="displayName" value={profile.displayName} onChange={updateField} maxLength="120" required /></label>
                  <label className="is-wide"><span>Welcome message</span><input name="welcomeMessage" value={profile.welcomeMessage} onChange={updateField} maxLength="280" required /><small>{profile.welcomeMessage.length} / 280</small></label>
                  <label className="is-wide"><span>Short bio</span><textarea name="bio" value={profile.bio} onChange={updateField} rows="5" maxLength="3000" placeholder="A few warm sentences about your work and care philosophy." /></label>
                  <label><span>Signature line</span><input name="signatureLine" value={profile.signatureLine} onChange={updateField} maxLength="160" required /></label>
                </div>
              </section>

              <section>
                <div className="studio-profile46__section-heading"><span>03</span><div><h2>Public contact</h2><p>Store the contact details you intend to share later. This phase does not publish them.</p></div></div>
                <div className="studio-profile46__fields">
                  <label><span>Public email <em>optional</em></span><input name="publicEmail" type="email" value={profile.publicEmail} onChange={updateField} maxLength="254" /></label>
                  <label><span>Public phone <em>optional</em></span><input name="publicPhone" type="tel" value={profile.publicPhone} onChange={updateField} maxLength="80" /></label>
                </div>
              </section>

              <footer><p>{hasChanges ? 'You have unsaved changes.' : 'No unsaved changes.'}</p><button type="submit" className="btn primary" disabled={Boolean(busy) || !hasChanges}>{busy === 'save' ? 'Saving…' : 'Save Studio Profile'}</button></footer>
            </form>

            <aside className="studio-profile46__preview" aria-label="Studio Profile preview">
              <p className="admin-eyebrow">Live preview</p>
              <div className="studio-profile46__preview-avatar">{previewUrl ? <img src={previewUrl} alt="" /> : <span>{initials}</span>}</div>
              <h2>{profile.displayName || 'Your name'}</h2>
              <blockquote>{profile.welcomeMessage || 'Your welcome message will appear here.'}</blockquote>
              {profile.bio && <p>{profile.bio}</p>}
              <strong>{profile.signatureLine || 'Your signature'}</strong>
              {(profile.publicEmail || profile.publicPhone) && <address>{profile.publicEmail && <span>{profile.publicEmail}</span>}{profile.publicPhone && <span>{profile.publicPhone}</span>}</address>}
              <small>Private preview · nothing is published by this screen.</small>
            </aside>
          </div>
        )}
      </main>
    </AdminFrame>
  )
}

export default AdminStudioProfile
