const test = require('node:test')
const assert = require('node:assert/strict')

const {
  DEFAULT_STUDIO_PROFILE,
  buildClientStudioIdentity,
  isUsableProfileImage,
  normalizeStudioProfile,
} = require('../src/services/studioProfile.service')

test('Studio Profile normalization provides calm owner defaults', () => {
  assert.deepEqual(normalizeStudioProfile(), DEFAULT_STUDIO_PROFILE)
})

test('Studio Profile keeps private client sharing off by default', () => {
  assert.equal(buildClientStudioIdentity(DEFAULT_STUDIO_PROFILE), null)
})

test('Studio Profile exposes only approved identity fields to authenticated clients', () => {
  const identity = buildClientStudioIdentity({
    displayName: '  Kim M. ',
    welcomeMessage: ' Welcome home. ',
    bio: 'Private long-form owner context.',
    signatureLine: ' With care, Kim ',
    publicEmail: 'PRIVATE@EXAMPLE.COM',
    publicPhone: '555-0100',
    profileAssetId: '2f6ef8ea-8f64-4e79-b9e4-c49cd80249d9',
    profile_asset_status: 'active',
    profile_asset_scan_status: 'clean',
    profile_asset_mime_type: 'image/webp',
    clientPortalEnabled: true,
    clientPortalContactEnabled: false,
  })

  assert.equal(identity.displayName, 'Kim M.')
  assert.equal(identity.publicEmail, '')
  assert.equal(identity.publicPhone, '')
  assert.equal('bio' in identity, false)
  assert.equal(identity.profileImageUrl, '/api/public/client-portal/studio-identity/image')
})

test('Studio Profile shares contact details only after separate approval', () => {
  const identity = buildClientStudioIdentity({
    clientPortalEnabled: true,
    clientPortalContactEnabled: true,
    publicEmail: 'HELLO@EXAMPLE.COM',
    publicPhone: '555-0100',
  })

  assert.equal(identity.publicEmail, 'hello@example.com')
  assert.equal(identity.publicPhone, '555-0100')
})

test('Studio Profile normalization trims fields and limits stored copy', () => {
  const profile = normalizeStudioProfile({
    displayName: '  Kim M.  ',
    welcomeMessage: `  ${'a'.repeat(400)}  `,
    publicEmail: '  KIM@EXAMPLE.COM  ',
  })
  assert.equal(profile.displayName, 'Kim M.')
  assert.equal(profile.welcomeMessage.length, 280)
  assert.equal(profile.publicEmail, 'kim@example.com')
})

test('Studio Profile accepts only active, safe-state image assets', () => {
  assert.equal(isUsableProfileImage({ status: 'active', scan_status: 'clean', mime_type: 'image/webp' }), true)
  assert.equal(isUsableProfileImage({ status: 'active', scan_status: 'disabled', mime_type: 'image/png' }), true)
  assert.equal(isUsableProfileImage({ status: 'archived', scan_status: 'clean', mime_type: 'image/png' }), false)
  assert.equal(isUsableProfileImage({ status: 'active', scan_status: 'pending', mime_type: 'image/png' }), false)
  assert.equal(isUsableProfileImage({ status: 'active', scan_status: 'clean', mime_type: 'application/pdf' }), false)
})
