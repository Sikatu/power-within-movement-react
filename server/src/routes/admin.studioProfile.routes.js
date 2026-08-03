const express = require('express')
const { z } = require('zod')

const { pool } = require('../db/pool')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const {
  enforceTeamClientAssignment,
  enforceTeamPermission,
} = require('../services/teamManagement.service')
const {
  isUsableProfileImage,
  normalizeStudioProfile,
} = require('../services/studioProfile.service')

const router = express.Router()

const studioProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'Add a display name.').max(120),
  welcomeMessage: z.string().trim().min(1, 'Add a short welcome message.').max(280),
  bio: z.string().trim().max(3000).optional().default(''),
  signatureLine: z.string().trim().min(1, 'Add a signature line.').max(160),
  publicEmail: z.union([z.string().trim().email('Enter a valid public email.'), z.literal('')]).optional().default(''),
  publicPhone: z.string().trim().max(80).optional().default(''),
  profileAssetId: z.string().uuid().nullable().optional().default(null),
  clientPortalEnabled: z.boolean().optional().default(false),
  clientPortalContactEnabled: z.boolean().optional().default(false),
})

const requireAdmin = [
  requireAuth,
  requireRole(['developer', 'owner', 'admin', 'staff']),
  enforceTeamPermission,
  enforceTeamClientAssignment,
]

async function readStudioProfile() {
  const result = await pool.query(`
    SELECT
      profile.*,
      asset.title AS profile_asset_title,
      asset.original_filename AS profile_asset_filename,
      asset.mime_type AS profile_asset_mime_type,
      asset.status AS profile_asset_status,
      asset.scan_status AS profile_asset_scan_status
    FROM studio_profiles profile
    LEFT JOIN assets asset ON asset.id = profile.profile_asset_id
    WHERE profile.profile_key = 'primary'
    LIMIT 1
  `)
  const row = result.rows[0] || {}
  return {
    ...normalizeStudioProfile(row),
    id: row.id || null,
    updatedAt: row.updated_at || null,
    profileAsset: row.profile_asset_id ? {
      id: row.profile_asset_id,
      title: row.profile_asset_title,
      originalFilename: row.profile_asset_filename,
      mimeType: row.profile_asset_mime_type,
      status: row.profile_asset_status,
      scanStatus: row.profile_asset_scan_status,
    } : null,
  }
}

router.get('/studio-profile', requireAdmin, async (_req, res, next) => {
  try {
    return res.json({ ok: true, profile: await readStudioProfile() })
  } catch (error) {
    return next(error)
  }
})

router.patch('/studio-profile', requireAdmin, async (req, res, next) => {
  const parsed = studioProfileSchema.safeParse(req.body || {})
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please review the Studio Profile details.',
    })
  }

  const profile = normalizeStudioProfile(parsed.data)
  const dbClient = await pool.connect()
  try {
    await dbClient.query('BEGIN')
    if (profile.profileAssetId) {
      const assetResult = await dbClient.query(
        'SELECT id, status, scan_status, mime_type FROM assets WHERE id = $1 LIMIT 1',
        [profile.profileAssetId],
      )
      if (!isUsableProfileImage(assetResult.rows[0])) {
        await dbClient.query('ROLLBACK')
        return res.status(400).json({ ok: false, error: 'Choose an active image from the Asset Vault whose security state is ready.' })
      }
    }

    const beforeResult = await dbClient.query(
      "SELECT * FROM studio_profiles WHERE profile_key = 'primary' LIMIT 1",
    )
    const savedResult = await dbClient.query(`
      INSERT INTO studio_profiles (
        profile_key, display_name, welcome_message, bio, signature_line,
        public_email, public_phone, profile_asset_id,
        client_portal_enabled, client_portal_contact_enabled,
        created_by, updated_by
      )
      VALUES ('primary', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
      ON CONFLICT (profile_key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        welcome_message = EXCLUDED.welcome_message,
        bio = EXCLUDED.bio,
        signature_line = EXCLUDED.signature_line,
        public_email = EXCLUDED.public_email,
        public_phone = EXCLUDED.public_phone,
        profile_asset_id = EXCLUDED.profile_asset_id,
        client_portal_enabled = EXCLUDED.client_portal_enabled,
        client_portal_contact_enabled = EXCLUDED.client_portal_contact_enabled,
        updated_by = EXCLUDED.updated_by,
        updated_at = now()
      RETURNING *
    `, [
      profile.displayName,
      profile.welcomeMessage,
      profile.bio,
      profile.signatureLine,
      profile.publicEmail,
      profile.publicPhone,
      profile.profileAssetId,
      profile.clientPortalEnabled,
      profile.clientPortalContactEnabled,
      req.user.id,
    ])
    const saved = savedResult.rows[0]
    await dbClient.query(`
      INSERT INTO audit_logs (
        actor_user_id, action, entity_type, entity_id, before_data, after_data
      )
      VALUES ($1, 'studio_profile_updated', 'studio_profiles', $2, $3::jsonb, $4::jsonb)
    `, [
      req.user.id,
      saved.id,
      JSON.stringify(beforeResult.rows[0] || {}),
      JSON.stringify(saved),
    ])
    await dbClient.query('COMMIT')
    return res.json({ ok: true, profile: await readStudioProfile(), message: 'Studio Profile saved.' })
  } catch (error) {
    await dbClient.query('ROLLBACK')
    return next(error)
  } finally {
    dbClient.release()
  }
})

module.exports = router
