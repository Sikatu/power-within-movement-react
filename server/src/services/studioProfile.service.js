const DEFAULT_STUDIO_PROFILE = Object.freeze({
  displayName: 'Kim Mittelstadt',
  welcomeMessage: 'A private space for meaningful transformation.',
  bio: '',
  signatureLine: 'With care, Kim',
  publicEmail: '',
  publicPhone: '',
  profileAssetId: null,
  clientPortalEnabled: false,
  clientPortalContactEnabled: false,
})

function cleanText(value, maximum = 5000) {
  return String(value || '').trim().slice(0, maximum)
}

function cleanBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value === undefined || value === null || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase())
}

function normalizeStudioProfile(value = {}) {
  const clientPortalEnabled = cleanBoolean(
    value.clientPortalEnabled ?? value.client_portal_enabled,
    DEFAULT_STUDIO_PROFILE.clientPortalEnabled,
  )

  return {
    displayName: cleanText(value.displayName ?? value.display_name, 120) || DEFAULT_STUDIO_PROFILE.displayName,
    welcomeMessage: cleanText(value.welcomeMessage ?? value.welcome_message, 280) || DEFAULT_STUDIO_PROFILE.welcomeMessage,
    bio: cleanText(value.bio, 3000),
    signatureLine: cleanText(value.signatureLine ?? value.signature_line, 160) || DEFAULT_STUDIO_PROFILE.signatureLine,
    publicEmail: cleanText(value.publicEmail ?? value.public_email, 254).toLowerCase(),
    publicPhone: cleanText(value.publicPhone ?? value.public_phone, 80),
    profileAssetId: value.profileAssetId ?? value.profile_asset_id ?? null,
    clientPortalEnabled,
    clientPortalContactEnabled: clientPortalEnabled && cleanBoolean(
      value.clientPortalContactEnabled ?? value.client_portal_contact_enabled,
      DEFAULT_STUDIO_PROFILE.clientPortalContactEnabled,
    ),
  }
}

function isUsableProfileImage(asset) {
  if (!asset) return false
  return asset.status === 'active'
    && ['clean', 'disabled'].includes(asset.scan_status || 'disabled')
    && String(asset.mime_type || '').toLowerCase().startsWith('image/')
}

function buildClientStudioIdentity(value = {}) {
  const profile = normalizeStudioProfile(value)
  if (!profile.clientPortalEnabled) return null

  const profileAsset = value.profileAsset || {
    status: value.profile_asset_status,
    scan_status: value.profile_asset_scan_status,
    mime_type: value.profile_asset_mime_type,
  }
  const hasProfileImage = Boolean(profile.profileAssetId && isUsableProfileImage(profileAsset))

  return {
    displayName: profile.displayName,
    welcomeMessage: profile.welcomeMessage,
    signatureLine: profile.signatureLine,
    publicEmail: profile.clientPortalContactEnabled ? profile.publicEmail : '',
    publicPhone: profile.clientPortalContactEnabled ? profile.publicPhone : '',
    profileImageUrl: hasProfileImage
      ? '/api/public/client-portal/studio-identity/image'
      : null,
  }
}

module.exports = {
  DEFAULT_STUDIO_PROFILE,
  buildClientStudioIdentity,
  isUsableProfileImage,
  normalizeStudioProfile,
}
