const express = require('express')
const { z } = require('zod')
const { pipeline } = require('stream/promises')

const { env } = require('../config/env')
const { pool } = require('../db/pool')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const { createSignedGrant, hashGrantToken, verifySignedGrant } = require('../services/assetAccessGrant.service')
const { buildBulkAssignmentPlan } = require('../services/assetAssignment.service')
const { assertAssetUsable, getInitialScanState } = require('../services/assetScan.service')
const {
  canPreviewAsset,
  collectRequestBuffer,
  deleteObject,
  getObjectStream,
  getStorageStatus,
  safeSegment,
  writeUploadedAsset,
} = require('../services/assetStorage.service')

const router = express.Router()
const requireAssetManager = [requireAuth, requireRole(['developer', 'owner', 'admin'])]

const metadataSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  folderId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  visibility: z.enum(['private', 'client_assigned']).optional(),
})

const folderSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().uuid().nullable().optional(),
})

const assignmentSchema = z.object({
  clientProfileId: z.string().uuid(),
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().trim().max(5000).optional().default(''),
})

const bulkAssignmentSchema = assignmentSchema.omit({ clientProfileId: true })
const selectedAssignmentSchema = bulkAssignmentSchema.extend({
  clientProfileIds: z.array(z.string().uuid()).min(1).max(250),
})
const accessGrantSchema = z.object({
  purpose: z.enum(['download', 'preview']).default('download'),
})
const relationshipSchema = z.object({
  relatedAssetId: z.string().uuid().nullable().optional(),
  contextType: z.enum(['letter', 'circle_post', 'founder_recording', 'transcript', 'generic']).default('generic'),
  contextId: z.string().trim().min(1).max(240).nullable().optional(),
  relationshipType: z.enum(['attachment', 'source_recording', 'transcript', 'featured']).default('attachment'),
}).refine((value) => value.relatedAssetId || value.contextId, {
  message: 'Choose a related asset or provide a content context.',
})

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'folder'
}

function parseTags(value) {
  return [...new Set(String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20))]
}

function decodeHeader(value, fallback = '') {
  try {
    return decodeURIComponent(String(value || fallback))
  } catch {
    return String(value || fallback)
  }
}

function portalResourceType(asset) {
  const mime = String(asset.mime_type || '').toLowerCase()
  const name = String(asset.original_filename || '').toLowerCase()
  if (mime.startsWith('video/')) return 'video'
  if (name.includes('worksheet')) return 'worksheet'
  if (mime.startsWith('image/')) return 'guide'
  if (mime === 'application/pdf') return 'guide'
  return 'link'
}

async function recordAccess({ assetId, assignmentId = null, actorUserId = null, clientProfileId = null, action, metadata = {} }) {
  await pool.query(
    `
    INSERT INTO asset_access_logs (
      asset_id,
      assignment_id,
      actor_user_id,
      client_profile_id,
      action,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [assetId, assignmentId, actorUserId, clientProfileId, action, JSON.stringify(metadata)],
  )
}

async function recordAudit(req, action, entityId, beforeData, afterData) {
  await pool.query(
    `
    INSERT INTO audit_logs (
      actor_user_id,
      action,
      entity_type,
      entity_id,
      before_data,
      after_data
    )
    VALUES ($1, $2, 'assets', $3, $4::jsonb, $5::jsonb)
    `,
    [req.user?.id || null, action, entityId, JSON.stringify(beforeData || {}), JSON.stringify(afterData || {})],
  )
}

async function getAsset(assetId) {
  const result = await pool.query(
    `
    SELECT
      asset.*,
      folder.name AS folder_name,
      folder.slug AS folder_slug,
      COALESCE(assignments.assignment_count, 0)::int AS assignment_count
    FROM assets asset
    LEFT JOIN asset_folders folder ON folder.id = asset.folder_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS assignment_count
      FROM asset_assignments assignment
      WHERE assignment.asset_id = asset.id
        AND assignment.status = 'active'
    ) assignments ON true
    WHERE asset.id = $1
    LIMIT 1
    `,
    [assetId],
  )
  return result.rows[0] || null
}

async function deliverAsset(res, asset, purpose) {
  const stream = await getObjectStream(asset)
  res.set({
    'Content-Type': asset.mime_type,
    'Content-Length': String(asset.size_bytes),
    'Content-Disposition': `${purpose === 'preview' ? 'inline' : 'attachment'}; filename="${safeSegment(asset.original_filename)}"`,
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  })
  await pipeline(stream, res)
}

async function assignAssetToClientIds({ dbClient, req, asset, clientIds, input }) {
  const existingResult = await dbClient.query(
    `
    SELECT id, client_profile_id, status, portal_resource_id
    FROM asset_assignments
    WHERE asset_id = $1
      AND client_profile_id = ANY($2::uuid[])
    ORDER BY client_profile_id, (status = 'active') DESC, created_at DESC
    `,
    [asset.id, clientIds],
  )
  const plan = buildBulkAssignmentPlan({ clientIds, existingAssignments: existingResult.rows })
  const title = input.title || asset.title
  const description = input.description || asset.description || ''
  const assignedRows = []

  for (const target of plan.pending) {
    const existing = target.existing
    let portalResourceId = existing?.portal_resource_id || null

    if (portalResourceId) {
      await dbClient.query(
        `
        UPDATE client_portal_resources
        SET title = $2, resource_type = $3, description = $4, resource_url = $5,
            status = 'active', updated_at = now()
        WHERE id = $1
        `,
        [portalResourceId, title, portalResourceType(asset), description || null, `/api/public/client-portal/assets/${asset.id}/download`],
      )
    } else {
      const portalResult = await dbClient.query(
        `
        INSERT INTO client_portal_resources (
          client_profile_id, title, resource_type, description, resource_url, status
        )
        VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING id
        `,
        [target.clientProfileId, title, portalResourceType(asset), description || null, `/api/public/client-portal/assets/${asset.id}/download`],
      )
      portalResourceId = portalResult.rows[0].id
    }

    const assignmentResult = existing
      ? await dbClient.query(
        `
        UPDATE asset_assignments
        SET status = 'active', revoked_at = NULL, assigned_by = $3, title_override = $4,
            description_override = $5, portal_resource_id = $6, assigned_at = now()
        WHERE id = $1 AND asset_id = $2
        RETURNING *
        `,
        [existing.id, asset.id, req.user.id, input.title || null, input.description || null, portalResourceId],
      )
      : await dbClient.query(
        `
        INSERT INTO asset_assignments (
          asset_id, client_profile_id, assigned_by, title_override, description_override, portal_resource_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [asset.id, target.clientProfileId, req.user.id, input.title || null, input.description || null, portalResourceId],
      )
    assignedRows.push(assignmentResult.rows[0])
  }

  if (plan.eligibleCount > 0) {
    await dbClient.query(
      `UPDATE assets SET visibility = 'client_assigned', updated_by = $2 WHERE id = $1`,
      [asset.id, req.user.id],
    )
  }

  return { plan, assignedRows }
}

function assignmentResult(plan, assignedRows) {
  return {
    eligibleClients: plan.eligibleCount,
    assigned: assignedRows.length,
    alreadyAssigned: plan.alreadyAssigned.length,
  }
}

function assignmentMessage(result) {
  if (result.assigned > 0) {
    return `Asset assigned to ${result.assigned} client${result.assigned === 1 ? '' : 's'}. ${result.alreadyAssigned} existing assignment${result.alreadyAssigned === 1 ? ' was' : 's were'} skipped.`
  }
  return result.eligibleClients > 0
    ? `All ${result.alreadyAssigned} selected clients already have this asset.`
    : 'No eligible client profiles are available for assignment.'
}

router.get('/access/:token', async (req, res, next) => {
  let dbClient
  try {
    const payload = verifySignedGrant(req.params.token, { secret: env.assetAccessGrantSecret })
    dbClient = await pool.connect()
    await dbClient.query('BEGIN')
    const result = await dbClient.query(
      `
      SELECT
        grant.*,
        asset.title,
        asset.original_filename,
        asset.mime_type,
        asset.size_bytes,
        asset.storage_driver,
        asset.storage_key,
        asset.status AS asset_status,
        asset.scan_status
      FROM asset_access_grants grant
      JOIN assets asset ON asset.id = grant.asset_id
      WHERE grant.id = $1 AND grant.asset_id = $2
      LIMIT 1
      FOR UPDATE OF grant
      `,
      [payload.jti, payload.assetId],
    )
    const grant = result.rows[0]
    if (!grant || grant.status !== 'active' || grant.token_hash !== hashGrantToken(req.params.token)) {
      const error = new Error('This asset access link has already been used or revoked.')
      error.statusCode = 401
      throw error
    }
    if (new Date(grant.expires_at).getTime() <= Date.now()) {
      await dbClient.query(`UPDATE asset_access_grants SET status = 'expired' WHERE id = $1`, [grant.id])
      await dbClient.query('COMMIT')
      dbClient.release()
      dbClient = null
      const error = new Error('This asset access link has expired.')
      error.statusCode = 401
      throw error
    }

    const asset = { ...grant, status: grant.asset_status }
    assertAssetUsable(asset)
    if (grant.purpose === 'preview' && !canPreviewAsset(asset)) {
      const error = new Error('This file type does not support an in-browser preview.')
      error.statusCode = 415
      throw error
    }

    if (grant.purpose === 'download') {
      await dbClient.query(
        `UPDATE asset_access_grants SET status = 'consumed', consumed_at = now() WHERE id = $1`,
        [grant.id],
      )
    }
    await dbClient.query('COMMIT')
    await recordAccess({
      assetId: grant.asset_id,
      assignmentId: grant.assignment_id,
      actorUserId: grant.issued_to_user_id,
      clientProfileId: grant.client_profile_id,
      action: 'grant_redeem',
      metadata: { grantId: grant.id, purpose: grant.purpose },
    })
    return await deliverAsset(res, asset, grant.purpose)
  } catch (error) {
    if (dbClient) {
      try { await dbClient.query('ROLLBACK') } catch { /* preserve the original grant error */ }
    }
    if (res.headersSent) {
      res.destroy(error)
      return undefined
    }
    return next(error)
  } finally {
    dbClient?.release()
  }
})

router.use(requireAssetManager)

router.get('/summary', async (req, res, next) => {
  try {
    const [countsResult, foldersResult, tagsResult] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')::int AS active_assets,
          COUNT(*) FILTER (WHERE status = 'archived')::int AS archived_assets,
          COALESCE(SUM(size_bytes) FILTER (WHERE status = 'active'), 0)::bigint AS active_bytes,
          COUNT(*) FILTER (WHERE status = 'active' AND assignment_count > 0)::int AS assigned_assets
        FROM (
          SELECT asset.*, COUNT(assignment.id) FILTER (WHERE assignment.status = 'active') AS assignment_count
          FROM assets asset
          LEFT JOIN asset_assignments assignment ON assignment.asset_id = asset.id
          GROUP BY asset.id
        ) asset_totals
      `),
      pool.query(`
        SELECT folder.id, folder.name, folder.slug, COUNT(asset.id) FILTER (WHERE asset.status = 'active')::int AS asset_count
        FROM asset_folders folder
        LEFT JOIN assets asset ON asset.folder_id = folder.id
        WHERE folder.archived_at IS NULL
        GROUP BY folder.id
        ORDER BY folder.name ASC
      `),
      pool.query(`
        SELECT DISTINCT unnest(tags) AS tag
        FROM assets
        WHERE status = 'active'
        ORDER BY tag ASC
        LIMIT 100
      `),
    ])

    return res.json({
      ok: true,
      summary: countsResult.rows[0],
      folders: foldersResult.rows,
      tags: tagsResult.rows.map((row) => row.tag),
      storage: getStorageStatus(),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/folders', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, name, slug, parent_id, created_at, updated_at
      FROM asset_folders
      WHERE archived_at IS NULL
      ORDER BY name ASC
    `)
    return res.json({ ok: true, folders: result.rows })
  } catch (error) {
    return next(error)
  }
})

router.post('/folders', async (req, res, next) => {
  const parsed = folderSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'Check the folder details.' })

  try {
    const baseSlug = slugify(parsed.data.name)
    const slug = `${baseSlug}-${Date.now().toString(36)}`
    const result = await pool.query(
      `
      INSERT INTO asset_folders (name, slug, parent_id, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [parsed.data.name, slug, parsed.data.parentId || null, req.user.id],
    )
    await recordAccess({ actorUserId: req.user.id, action: 'folder_create', metadata: { folderId: result.rows[0].id, name: parsed.data.name } })
    return res.status(201).json({ ok: true, folder: result.rows[0], message: 'Folder created.' })
  } catch (error) {
    return next(error)
  }
})

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim()
    const folderId = String(req.query.folderId || '').trim()
    const type = String(req.query.type || '').trim().toLowerCase()
    const status = req.query.status === 'archived' ? 'archived' : 'active'
    const tag = String(req.query.tag || '').trim()

    const result = await pool.query(
      `
      SELECT
        asset.*,
        folder.name AS folder_name,
        COALESCE(assignments.assignment_count, 0)::int AS assignment_count,
        creator.email AS created_by_email
      FROM assets asset
      LEFT JOIN asset_folders folder ON folder.id = asset.folder_id
      LEFT JOIN system_users creator ON creator.id = asset.created_by
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS assignment_count
        FROM asset_assignments assignment
        WHERE assignment.asset_id = asset.id
          AND assignment.status = 'active'
      ) assignments ON true
      WHERE asset.status = $1
        AND ($2 = '' OR asset.folder_id::text = $2)
        AND ($3 = '' OR lower(asset.mime_type) LIKE $3 || '%')
        AND ($4 = '' OR $4 = ANY(asset.tags))
        AND (
          $5 = ''
          OR lower(asset.title) LIKE '%' || lower($5) || '%'
          OR lower(asset.original_filename) LIKE '%' || lower($5) || '%'
          OR lower(COALESCE(asset.description, '')) LIKE '%' || lower($5) || '%'
        )
      ORDER BY asset.updated_at DESC
      LIMIT 250
      `,
      [status, folderId, type, tag, search],
    )

    return res.json({ ok: true, assets: result.rows })
  } catch (error) {
    return next(error)
  }
})

router.post('/upload', async (req, res, next) => {
  let stored
  try {
    const fileName = decodeHeader(req.headers['x-pwc-file-name'], 'upload.bin')
    const title = decodeHeader(req.headers['x-pwc-asset-title'], fileName.replace(/\.[^.]+$/, ''))
    const folderId = String(req.headers['x-pwc-folder-id'] || '').trim() || null
    const tags = parseTags(decodeHeader(req.headers['x-pwc-tags'], ''))
    const buffer = await collectRequestBuffer(req)
    stored = await writeUploadedAsset({ fileName, mimeType: req.headers['content-type'], buffer })
    const scan = getInitialScanState(env.assetMalwareScanner)

    const dbClient = await pool.connect()
    try {
      await dbClient.query('BEGIN')
      const result = await dbClient.query(
        `
        INSERT INTO assets (
          title,
          original_filename,
          file_extension,
          mime_type,
          size_bytes,
          checksum_sha256,
          storage_driver,
          storage_key,
          scan_status,
          scan_message,
          scanned_at,
          folder_id,
          tags,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::text[], $14, $14)
        RETURNING *
        `,
        [title || stored.originalFilename, stored.originalFilename, stored.fileExtension || null, stored.mimeType, stored.sizeBytes, stored.checksumSha256, stored.storageDriver, stored.storageKey, scan.status, scan.message, scan.scannedAt, folderId, tags, req.user.id],
      )
      const asset = result.rows[0]
      await dbClient.query(
        `
        INSERT INTO asset_versions (
          asset_id, version_number, original_filename, mime_type, size_bytes,
          checksum_sha256, storage_driver, storage_key, created_by
        )
        VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [asset.id, stored.originalFilename, stored.mimeType, stored.sizeBytes, stored.checksumSha256, stored.storageDriver, stored.storageKey, req.user.id],
      )
      await dbClient.query('COMMIT')
      await recordAccess({ assetId: asset.id, actorUserId: req.user.id, action: 'upload', metadata: { originalFilename: stored.originalFilename, sizeBytes: stored.sizeBytes } })
      await recordAudit(req, 'asset_uploaded', asset.id, {}, asset)
      return res.status(201).json({ ok: true, asset, message: 'Asset uploaded securely.' })
    } catch (error) {
      await dbClient.query('ROLLBACK')
      throw error
    } finally {
      dbClient.release()
    }
  } catch (error) {
    if (stored) {
      try { await deleteObject(stored) } catch { /* preserve the original upload error */ }
    }
    return next(error)
  }
})

router.get('/:assetId', async (req, res, next) => {
  try {
    const asset = await getAsset(req.params.assetId)
    if (!asset) return res.status(404).json({ ok: false, error: 'Asset not found.' })

    const [versionsResult, assignmentsResult, accessResult] = await Promise.all([
      pool.query(`
        SELECT id, version_number, original_filename, mime_type, size_bytes, checksum_sha256, notes, created_at
        FROM asset_versions
        WHERE asset_id = $1
        ORDER BY version_number DESC
      `, [asset.id]),
      pool.query(`
        SELECT
          assignment.id,
          assignment.client_profile_id,
          assignment.title_override,
          assignment.description_override,
          assignment.status,
          assignment.assigned_at,
          profile.first_name,
          profile.last_name,
          user_record.email
        FROM asset_assignments assignment
        JOIN client_profiles profile ON profile.id = assignment.client_profile_id
        LEFT JOIN system_users user_record ON user_record.id = profile.user_id
        WHERE assignment.asset_id = $1
        ORDER BY assignment.assigned_at DESC
      `, [asset.id]),
      pool.query(`
        SELECT log.action, log.metadata, log.created_at, actor.email AS actor_email
        FROM asset_access_logs log
        LEFT JOIN system_users actor ON actor.id = log.actor_user_id
        WHERE log.asset_id = $1
        ORDER BY log.created_at DESC
        LIMIT 30
      `, [asset.id]),
    ])

    return res.json({ ok: true, asset, versions: versionsResult.rows, assignments: assignmentsResult.rows, accessLog: accessResult.rows })
  } catch (error) {
    return next(error)
  }
})

router.post('/:assetId/access-grants', async (req, res, next) => {
  const parsed = accessGrantSchema.safeParse(req.body || {})
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'Choose a supported access purpose.' })

  try {
    const asset = await getAsset(req.params.assetId)
    if (!asset) return res.status(404).json({ ok: false, error: 'Asset not found.' })
    assertAssetUsable(asset)
    if (parsed.data.purpose === 'preview' && !canPreviewAsset(asset)) {
      return res.status(415).json({ ok: false, error: 'This file type does not support an in-browser preview.' })
    }

    const grant = createSignedGrant({
      assetId: asset.id,
      actorUserId: req.user.id,
      purpose: parsed.data.purpose,
      ttlSeconds: env.assetAccessGrantTtlSeconds,
      secret: env.assetAccessGrantSecret,
    })
    await pool.query(
      `
      INSERT INTO asset_access_grants (
        id, token_hash, asset_id, issued_to_user_id, purpose, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [grant.grantId, grant.tokenHash, asset.id, req.user.id, parsed.data.purpose, grant.expiresAt],
    )
    await recordAccess({
      assetId: asset.id,
      actorUserId: req.user.id,
      action: 'grant_create',
      metadata: { grantId: grant.grantId, purpose: parsed.data.purpose, expiresAt: grant.expiresAt },
    })

    return res.status(201).json({
      ok: true,
      purpose: parsed.data.purpose,
      expiresAt: grant.expiresAt,
      path: `/api/admin/assets/access/${encodeURIComponent(grant.token)}`,
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/:assetId/relationships', async (req, res, next) => {
  try {
    const asset = await getAsset(req.params.assetId)
    if (!asset) return res.status(404).json({ ok: false, error: 'Asset not found.' })
    const result = await pool.query(
      `
      SELECT
        relationship.*,
        related.title AS related_asset_title,
        related.original_filename AS related_asset_filename,
        related.mime_type AS related_asset_mime_type
      FROM asset_relationships relationship
      LEFT JOIN assets related ON related.id = relationship.related_asset_id
      WHERE relationship.asset_id = $1
        AND relationship.archived_at IS NULL
      ORDER BY relationship.created_at DESC
      `,
      [asset.id],
    )
    return res.json({ ok: true, relationships: result.rows })
  } catch (error) {
    return next(error)
  }
})

router.post('/:assetId/relationships', async (req, res, next) => {
  const parsed = relationshipSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'Check the asset relationship.' })

  try {
    const asset = await getAsset(req.params.assetId)
    if (!asset) return res.status(404).json({ ok: false, error: 'Asset not found.' })
    if (parsed.data.relatedAssetId === asset.id) return res.status(400).json({ ok: false, error: 'An asset cannot be related to itself.' })
    if (parsed.data.relatedAssetId) {
      const related = await getAsset(parsed.data.relatedAssetId)
      if (!related) return res.status(404).json({ ok: false, error: 'Related asset not found.' })
    }

    const result = await pool.query(
      `
      INSERT INTO asset_relationships (
        asset_id, related_asset_id, context_type, context_id, relationship_type, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
      RETURNING *
      `,
      [asset.id, parsed.data.relatedAssetId || null, parsed.data.contextType, parsed.data.contextId || null, parsed.data.relationshipType, req.user.id],
    )
    const relationship = result.rows[0]
    if (!relationship) return res.status(409).json({ ok: false, error: 'That active asset relationship already exists.' })
    await recordAccess({ assetId: asset.id, actorUserId: req.user.id, action: 'relationship_create', metadata: { relationshipId: relationship.id } })
    await recordAudit(req, 'asset_relationship_created', asset.id, {}, relationship)
    return res.status(201).json({ ok: true, relationship, message: 'Asset relationship saved.' })
  } catch (error) {
    return next(error)
  }
})

router.delete('/:assetId/relationships/:relationshipId', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      UPDATE asset_relationships
      SET archived_at = now()
      WHERE id = $1 AND asset_id = $2 AND archived_at IS NULL
      RETURNING *
      `,
      [req.params.relationshipId, req.params.assetId],
    )
    const relationship = result.rows[0]
    if (!relationship) return res.status(404).json({ ok: false, error: 'Active asset relationship not found.' })
    await recordAccess({ assetId: req.params.assetId, actorUserId: req.user.id, action: 'relationship_remove', metadata: { relationshipId: relationship.id } })
    await recordAudit(req, 'asset_relationship_removed', req.params.assetId, relationship, { ...relationship, archived_at: new Date().toISOString() })
    return res.json({ ok: true, message: 'Asset relationship removed.' })
  } catch (error) {
    return next(error)
  }
})

router.patch('/:assetId', async (req, res, next) => {
  const parsed = metadataSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'Check the asset details.' })

  try {
    const before = await getAsset(req.params.assetId)
    if (!before) return res.status(404).json({ ok: false, error: 'Asset not found.' })
    const input = parsed.data
    const result = await pool.query(
      `
      UPDATE assets
      SET
        title = COALESCE($2, title),
        description = CASE WHEN $3::boolean THEN $4 ELSE description END,
        folder_id = CASE WHEN $5::boolean THEN $6::uuid ELSE folder_id END,
        tags = COALESCE($7::text[], tags),
        visibility = COALESCE($8, visibility),
        updated_by = $9
      WHERE id = $1
      RETURNING *
      `,
      [before.id, input.title || null, Object.prototype.hasOwnProperty.call(input, 'description'), input.description ?? null, Object.prototype.hasOwnProperty.call(input, 'folderId'), input.folderId ?? null, input.tags || null, input.visibility || null, req.user.id],
    )
    const asset = result.rows[0]
    await recordAccess({ assetId: asset.id, actorUserId: req.user.id, action: 'metadata_update', metadata: input })
    await recordAudit(req, 'asset_updated', asset.id, before, asset)
    return res.json({ ok: true, asset, message: 'Asset details saved.' })
  } catch (error) {
    return next(error)
  }
})

router.post('/:assetId/versions', async (req, res, next) => {
  let stored
  try {
    const asset = await getAsset(req.params.assetId)
    if (!asset) return res.status(404).json({ ok: false, error: 'Asset not found.' })
    const fileName = decodeHeader(req.headers['x-pwc-file-name'], asset.original_filename)
    const notes = decodeHeader(req.headers['x-pwc-version-notes'], '')
    const buffer = await collectRequestBuffer(req)
    stored = await writeUploadedAsset({ fileName, mimeType: req.headers['content-type'], buffer })
    const nextVersion = Number(asset.current_version_number || 1) + 1
    const scan = getInitialScanState(env.assetMalwareScanner)

    const dbClient = await pool.connect()
    try {
      await dbClient.query('BEGIN')
      await dbClient.query(
        `
        INSERT INTO asset_versions (
          asset_id, version_number, original_filename, mime_type, size_bytes,
          checksum_sha256, storage_driver, storage_key, notes, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [asset.id, nextVersion, stored.originalFilename, stored.mimeType, stored.sizeBytes, stored.checksumSha256, stored.storageDriver, stored.storageKey, notes || null, req.user.id],
      )
      const updatedResult = await dbClient.query(
        `
        UPDATE assets
        SET
          original_filename = $2,
          file_extension = $3,
          mime_type = $4,
          size_bytes = $5,
          checksum_sha256 = $6,
          storage_driver = $7,
          storage_key = $8,
          current_version_number = $9,
          scan_status = $10,
          scan_message = $11,
          scanned_at = $12,
          updated_by = $13
        WHERE id = $1
        RETURNING *
        `,
        [asset.id, stored.originalFilename, stored.fileExtension || null, stored.mimeType, stored.sizeBytes, stored.checksumSha256, stored.storageDriver, stored.storageKey, nextVersion, scan.status, scan.message, scan.scannedAt, req.user.id],
      )
      await dbClient.query('COMMIT')
      const updated = updatedResult.rows[0]
      await recordAccess({ assetId: asset.id, actorUserId: req.user.id, action: 'version_upload', metadata: { versionNumber: nextVersion, notes } })
      await recordAudit(req, 'asset_version_uploaded', asset.id, asset, updated)
      return res.status(201).json({ ok: true, asset: updated, versionNumber: nextVersion, message: `Version ${nextVersion} uploaded.` })
    } catch (error) {
      await dbClient.query('ROLLBACK')
      throw error
    } finally {
      dbClient.release()
    }
  } catch (error) {
    if (stored) {
      try { await deleteObject(stored) } catch { /* preserve the original version error */ }
    }
    return next(error)
  }
})

router.post('/:assetId/archive', async (req, res, next) => {
  const dbClient = await pool.connect()
  try {
    await dbClient.query('BEGIN')
    const before = await getAsset(req.params.assetId)
    if (!before) {
      await dbClient.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Asset not found.' })
    }
    const result = await dbClient.query(`UPDATE assets SET status = 'archived', archived_at = now(), updated_by = $2 WHERE id = $1 RETURNING *`, [before.id, req.user.id])
    await dbClient.query(`
      UPDATE client_portal_resources resource
      SET status = 'archived', updated_at = now()
      FROM asset_assignments assignment
      WHERE assignment.asset_id = $1
        AND assignment.status = 'active'
        AND assignment.portal_resource_id = resource.id
    `, [before.id])
    await dbClient.query('COMMIT')
    await recordAccess({ assetId: before.id, actorUserId: req.user.id, action: 'archive' })
    await recordAudit(req, 'asset_archived', before.id, before, result.rows[0])
    return res.json({ ok: true, asset: result.rows[0], message: 'Asset archived.' })
  } catch (error) {
    try { await dbClient.query('ROLLBACK') } catch { /* preserve original error */ }
    return next(error)
  } finally {
    dbClient.release()
  }
})

router.post('/:assetId/restore', async (req, res, next) => {
  const dbClient = await pool.connect()
  try {
    await dbClient.query('BEGIN')
    const before = await getAsset(req.params.assetId)
    if (!before) {
      await dbClient.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Asset not found.' })
    }
    const result = await dbClient.query(`UPDATE assets SET status = 'active', archived_at = NULL, updated_by = $2 WHERE id = $1 RETURNING *`, [before.id, req.user.id])
    await dbClient.query(`
      UPDATE client_portal_resources resource
      SET status = 'active', updated_at = now()
      FROM asset_assignments assignment
      WHERE assignment.asset_id = $1
        AND assignment.status = 'active'
        AND assignment.portal_resource_id = resource.id
    `, [before.id])
    await dbClient.query('COMMIT')
    await recordAccess({ assetId: before.id, actorUserId: req.user.id, action: 'restore' })
    await recordAudit(req, 'asset_restored', before.id, before, result.rows[0])
    return res.json({ ok: true, asset: result.rows[0], message: 'Asset restored.' })
  } catch (error) {
    try { await dbClient.query('ROLLBACK') } catch { /* preserve original error */ }
    return next(error)
  } finally {
    dbClient.release()
  }
})

router.post('/:assetId/assignments/all', async (req, res, next) => {
  const parsed = bulkAssignmentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'Check the bulk assignment details.' })

  const dbClient = await pool.connect()
  try {
    await dbClient.query('BEGIN')
    const assetResult = await dbClient.query(
      `SELECT * FROM assets WHERE id = $1 AND status = 'active' LIMIT 1 FOR UPDATE`,
      [req.params.assetId],
    )
    const asset = assetResult.rows[0]
    if (!asset) {
      await dbClient.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Active asset not found.' })
    }
    assertAssetUsable(asset)

    const clientsResult = await dbClient.query(`
      SELECT cp.id
      FROM client_profiles cp
      LEFT JOIN system_users user_record ON user_record.id = cp.user_id
      WHERE COALESCE(cp.client_status, 'lead') <> 'archived'
        AND (user_record.id IS NULL OR user_record.role = 'client')
      ORDER BY cp.created_at ASC
    `)
    const clientIds = clientsResult.rows.map((row) => row.id)

    if (clientIds.length === 0) {
      await dbClient.query('COMMIT')
      return res.json({
        ok: true,
        eligibleClients: 0,
        assigned: 0,
        alreadyAssigned: 0,
        message: 'No eligible client profiles are available for assignment.',
      })
    }

    const existingResult = await dbClient.query(
      `
      SELECT id, client_profile_id, status, portal_resource_id
      FROM asset_assignments
      WHERE asset_id = $1
        AND client_profile_id = ANY($2::uuid[])
      ORDER BY client_profile_id, (status = 'active') DESC, created_at DESC
      `,
      [asset.id, clientIds],
    )
    const plan = buildBulkAssignmentPlan({ clientIds, existingAssignments: existingResult.rows })
    const title = parsed.data.title || asset.title
    const description = parsed.data.description || asset.description || ''
    const assignedRows = []

    for (const target of plan.pending) {
      const existing = target.existing
      let portalResourceId = existing?.portal_resource_id || null

      if (portalResourceId) {
        await dbClient.query(
          `
          UPDATE client_portal_resources
          SET title = $2, resource_type = $3, description = $4, resource_url = $5,
              status = 'active', updated_at = now()
          WHERE id = $1
          `,
          [portalResourceId, title, portalResourceType(asset), description || null, `/api/public/client-portal/assets/${asset.id}/download`],
        )
      } else {
        const portalResult = await dbClient.query(
          `
          INSERT INTO client_portal_resources (
            client_profile_id, title, resource_type, description, resource_url, status
          )
          VALUES ($1, $2, $3, $4, $5, 'active')
          RETURNING id
          `,
          [target.clientProfileId, title, portalResourceType(asset), description || null, `/api/public/client-portal/assets/${asset.id}/download`],
        )
        portalResourceId = portalResult.rows[0].id
      }

      let assignmentResult
      if (existing) {
        assignmentResult = await dbClient.query(
          `
          UPDATE asset_assignments
          SET status = 'active', revoked_at = NULL, assigned_by = $3, title_override = $4,
              description_override = $5, portal_resource_id = $6, assigned_at = now()
          WHERE id = $1 AND asset_id = $2
          RETURNING *
          `,
          [existing.id, asset.id, req.user.id, parsed.data.title || null, parsed.data.description || null, portalResourceId],
        )
      } else {
        assignmentResult = await dbClient.query(
          `
          INSERT INTO asset_assignments (
            asset_id, client_profile_id, assigned_by, title_override, description_override, portal_resource_id
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
          `,
          [asset.id, target.clientProfileId, req.user.id, parsed.data.title || null, parsed.data.description || null, portalResourceId],
        )
      }
      assignedRows.push(assignmentResult.rows[0])
    }

    await dbClient.query(
      `UPDATE assets SET visibility = 'client_assigned', updated_by = $2 WHERE id = $1`,
      [asset.id, req.user.id],
    )
    await dbClient.query('COMMIT')

    const result = {
      eligibleClients: plan.eligibleCount,
      assigned: assignedRows.length,
      alreadyAssigned: plan.alreadyAssigned.length,
    }
    await recordAccess({
      assetId: asset.id,
      actorUserId: req.user.id,
      action: 'assign_bulk',
      metadata: { bulk: true, ...result },
    })
    await recordAudit(req, 'asset_assigned_to_all_clients', asset.id, {}, result)

    const message = assignedRows.length > 0
      ? `Asset assigned to ${assignedRows.length} client${assignedRows.length === 1 ? '' : 's'}. ${plan.alreadyAssigned.length} existing assignment${plan.alreadyAssigned.length === 1 ? ' was' : 's were'} skipped.`
      : `All ${plan.alreadyAssigned.length} eligible clients already have this asset.`

    return res.status(201).json({ ok: true, ...result, assignments: assignedRows, message })
  } catch (error) {
    try { await dbClient.query('ROLLBACK') } catch { /* preserve original error */ }
    return next(error)
  } finally {
    dbClient.release()
  }
})

router.post('/:assetId/assignments/selected', async (req, res, next) => {
  const parsed = selectedAssignmentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'Choose one or more clients.' })

  const dbClient = await pool.connect()
  try {
    await dbClient.query('BEGIN')
    const assetResult = await dbClient.query(
      `SELECT * FROM assets WHERE id = $1 LIMIT 1 FOR UPDATE`,
      [req.params.assetId],
    )
    const asset = assetResult.rows[0]
    assertAssetUsable(asset)

    const requestedIds = [...new Set(parsed.data.clientProfileIds)]
    const clientsResult = await dbClient.query(
      `
      SELECT cp.id
      FROM client_profiles cp
      LEFT JOIN system_users user_record ON user_record.id = cp.user_id
      WHERE cp.id = ANY($1::uuid[])
        AND COALESCE(cp.client_status, 'lead') <> 'archived'
        AND (user_record.id IS NULL OR user_record.role = 'client')
      ORDER BY cp.created_at ASC
      `,
      [requestedIds],
    )
    const clientIds = clientsResult.rows.map((row) => row.id)
    const skippedIneligible = requestedIds.length - clientIds.length

    if (clientIds.length === 0) {
      await dbClient.query('COMMIT')
      return res.status(400).json({ ok: false, error: 'None of the selected client profiles are eligible for assignment.' })
    }

    const { plan, assignedRows } = await assignAssetToClientIds({
      dbClient,
      req,
      asset,
      clientIds,
      input: parsed.data,
    })
    await dbClient.query('COMMIT')

    const result = { ...assignmentResult(plan, assignedRows), requestedClients: requestedIds.length, skippedIneligible }
    await recordAccess({
      assetId: asset.id,
      actorUserId: req.user.id,
      action: 'assign_bulk',
      metadata: { selected: true, ...result },
    })
    await recordAudit(req, 'asset_assigned_to_selected_clients', asset.id, {}, result)

    return res.status(201).json({
      ok: true,
      ...result,
      assignments: assignedRows,
      message: `${assignmentMessage(result)}${skippedIneligible ? ` ${skippedIneligible} ineligible selection${skippedIneligible === 1 ? ' was' : 's were'} excluded.` : ''}`,
    })
  } catch (error) {
    try { await dbClient.query('ROLLBACK') } catch { /* preserve original error */ }
    return next(error)
  } finally {
    dbClient.release()
  }
})

router.post('/:assetId/assignments', async (req, res, next) => {
  const parsed = assignmentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'Choose a client.' })

  const dbClient = await pool.connect()
  try {
    await dbClient.query('BEGIN')
    const assetResult = await dbClient.query(`SELECT * FROM assets WHERE id = $1 AND status = 'active' LIMIT 1`, [req.params.assetId])
    const asset = assetResult.rows[0]
    if (!asset) {
      await dbClient.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Active asset not found.' })
    }
    assertAssetUsable(asset)
    const profileResult = await dbClient.query(`SELECT id FROM client_profiles WHERE id = $1 LIMIT 1`, [parsed.data.clientProfileId])
    if (!profileResult.rows[0]) {
      await dbClient.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Client profile not found.' })
    }

    const title = parsed.data.title || asset.title
    const description = parsed.data.description || asset.description || ''
    const existingResult = await dbClient.query(
      `
      SELECT id, status, portal_resource_id
      FROM asset_assignments
      WHERE asset_id = $1 AND client_profile_id = $2
      ORDER BY (status = 'active') DESC, created_at DESC
      LIMIT 1
      `,
      [asset.id, parsed.data.clientProfileId],
    )
    const existing = existingResult.rows[0]
    let portalResourceId = existing?.portal_resource_id || null

    if (existing?.status === 'active' && portalResourceId) {
      await dbClient.query(
        `
        UPDATE client_portal_resources
        SET title = $2, resource_type = $3, description = $4, resource_url = $5, status = 'active', updated_at = now()
        WHERE id = $1
        `,
        [portalResourceId, title, portalResourceType(asset), description || null, `/api/public/client-portal/assets/${asset.id}/download`],
      )
    } else {
      const portalResult = await dbClient.query(
        `
        INSERT INTO client_portal_resources (
          client_profile_id, title, resource_type, description, resource_url, status
        )
        VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING *
        `,
        [parsed.data.clientProfileId, title, portalResourceType(asset), description || null, `/api/public/client-portal/assets/${asset.id}/download`],
      )
      portalResourceId = portalResult.rows[0].id
    }

    let assignmentResult
    if (existing) {
      assignmentResult = await dbClient.query(
        `
        UPDATE asset_assignments
        SET status = 'active', revoked_at = NULL, assigned_by = $3, title_override = $4,
            description_override = $5, portal_resource_id = $6, assigned_at = now()
        WHERE id = $1 AND asset_id = $2
        RETURNING *
        `,
        [existing.id, asset.id, req.user.id, parsed.data.title || null, parsed.data.description || null, portalResourceId],
      )
    } else {
      assignmentResult = await dbClient.query(
        `
        INSERT INTO asset_assignments (
          asset_id, client_profile_id, assigned_by, title_override, description_override, portal_resource_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [asset.id, parsed.data.clientProfileId, req.user.id, parsed.data.title || null, parsed.data.description || null, portalResourceId],
      )
    }

    await dbClient.query(`UPDATE assets SET visibility = 'client_assigned', updated_by = $2 WHERE id = $1`, [asset.id, req.user.id])
    await dbClient.query('COMMIT')
    const assignment = assignmentResult.rows[0]
    await recordAccess({ assetId: asset.id, assignmentId: assignment.id, actorUserId: req.user.id, clientProfileId: parsed.data.clientProfileId, action: 'assign' })
    await recordAudit(req, 'asset_assigned_to_client', asset.id, {}, assignment)
    return res.status(201).json({ ok: true, assignment, message: 'Asset assigned to the client portal.' })
  } catch (error) {
    try { await dbClient.query('ROLLBACK') } catch { /* preserve original error */ }
    return next(error)
  } finally {
    dbClient.release()
  }
})

router.delete('/:assetId/assignments/:assignmentId', async (req, res, next) => {
  const dbClient = await pool.connect()
  try {
    await dbClient.query('BEGIN')
    const result = await dbClient.query(
      `
      UPDATE asset_assignments
      SET status = 'revoked', revoked_at = now()
      WHERE id = $1 AND asset_id = $2 AND status = 'active'
      RETURNING *
      `,
      [req.params.assignmentId, req.params.assetId],
    )
    const assignment = result.rows[0]
    if (!assignment) {
      await dbClient.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Active assignment not found.' })
    }
    if (assignment.portal_resource_id) {
      await dbClient.query(`UPDATE client_portal_resources SET status = 'archived', updated_at = now() WHERE id = $1`, [assignment.portal_resource_id])
    }
    const remainingResult = await dbClient.query(`SELECT COUNT(*)::int AS count FROM asset_assignments WHERE asset_id = $1 AND status = 'active'`, [req.params.assetId])
    if (Number(remainingResult.rows[0]?.count || 0) === 0) {
      await dbClient.query(`UPDATE assets SET visibility = 'private', updated_by = $2 WHERE id = $1`, [req.params.assetId, req.user.id])
    }
    await dbClient.query('COMMIT')
    await recordAccess({ assetId: req.params.assetId, assignmentId: assignment.id, actorUserId: req.user.id, clientProfileId: assignment.client_profile_id, action: 'unassign' })
    await recordAudit(req, 'asset_unassigned_from_client', req.params.assetId, assignment, { ...assignment, status: 'revoked' })
    return res.json({ ok: true, message: 'Client assignment removed.' })
  } catch (error) {
    try { await dbClient.query('ROLLBACK') } catch { /* preserve original error */ }
    return next(error)
  } finally {
    dbClient.release()
  }
})

router.get('/:assetId/preview', async (req, res, next) => {
  try {
    const asset = await getAsset(req.params.assetId)
    if (!asset) return res.status(404).json({ ok: false, error: 'Asset not found.' })
    assertAssetUsable(asset)
    if (!canPreviewAsset(asset)) return res.status(415).json({ ok: false, error: 'This file type does not support an in-browser preview.' })
    await recordAccess({ assetId: asset.id, actorUserId: req.user.id, action: 'preview', metadata: { versionNumber: asset.current_version_number } })
    return await deliverAsset(res, asset, 'preview')
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error)
      return undefined
    }
    return next(error)
  }
})

router.get('/:assetId/download', async (req, res, next) => {
  try {
    const asset = await getAsset(req.params.assetId)
    if (!asset) return res.status(404).json({ ok: false, error: 'Asset not found.' })
    assertAssetUsable(asset)
    await recordAccess({ assetId: asset.id, actorUserId: req.user.id, action: 'download', metadata: { versionNumber: asset.current_version_number } })
    return await deliverAsset(res, asset, 'download')
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error)
      return undefined
    }
    return next(error)
  }
})

module.exports = router
