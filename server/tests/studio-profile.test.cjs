const test = require('node:test')
const assert = require('node:assert/strict')

const {
  DEFAULT_STUDIO_PROFILE,
  isUsableProfileImage,
  normalizeStudioProfile,
} = require('../src/services/studioProfile.service')

test('Studio Profile normalization provides calm owner defaults', () => {
  assert.deepEqual(normalizeStudioProfile(), DEFAULT_STUDIO_PROFILE)
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
