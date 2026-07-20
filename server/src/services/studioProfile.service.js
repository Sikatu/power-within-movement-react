const DEFAULT_STUDIO_PROFILE = Object.freeze({
  displayName: 'Kim Mittelstadt',
  welcomeMessage: 'A private space for meaningful transformation.',
  bio: '',
  signatureLine: 'With care, Kim',
  publicEmail: '',
  publicPhone: '',
  profileAssetId: null,
})

function cleanText(value, maximum = 5000) {
  return String(value || '').trim().slice(0, maximum)
}

function normalizeStudioProfile(value = {}) {
  return {
    displayName: cleanText(value.displayName ?? value.display_name, 120) || DEFAULT_STUDIO_PROFILE.displayName,
    welcomeMessage: cleanText(value.welcomeMessage ?? value.welcome_message, 280) || DEFAULT_STUDIO_PROFILE.welcomeMessage,
    bio: cleanText(value.bio, 3000),
    signatureLine: cleanText(value.signatureLine ?? value.signature_line, 160) || DEFAULT_STUDIO_PROFILE.signatureLine,
    publicEmail: cleanText(value.publicEmail ?? value.public_email, 254).toLowerCase(),
    publicPhone: cleanText(value.publicPhone ?? value.public_phone, 80),
    profileAssetId: value.profileAssetId ?? value.profile_asset_id ?? null,
  }
}

function isUsableProfileImage(asset) {
  if (!asset) return false
  return asset.status === 'active'
    && ['clean', 'disabled'].includes(asset.scan_status || 'disabled')
    && String(asset.mime_type || '').toLowerCase().startsWith('image/')
}

module.exports = {
  DEFAULT_STUDIO_PROFILE,
  isUsableProfileImage,
  normalizeStudioProfile,
}
