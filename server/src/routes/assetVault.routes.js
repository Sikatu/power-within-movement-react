const express = require('express')
const { z } = require('zod')

const { pool } = require('../db/pool')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const {
  collectRequestBuffer,
  deleteObject,
  getStorageStatus,
  readObject,
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
          folder_id,
          tags,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11, $11)
        RETURNING *
        `,
        [title || stored.originalFilename, stored.originalFilename, stored.fileExtension || null, stored.mimeType, stored.sizeBytes, stored.checksumSha256, stored.storageDriver, stored.storageKey, folderId, tags, req.user.id],
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
          updated_by = $10
        WHERE id = $1
        RETURNING *
        `,
        [asset.id, stored.originalFilename, stored.fileExtension || null, stored.mimeType, stored.sizeBytes, stored.checksumSha256, stored.storageDriver, stored.storageKey, nextVersion, req.user.id],
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

router.get('/:assetId/download', async (req, res, next) => {
  try {
    const asset = await getAsset(req.params.assetId)
    if (!asset) return res.status(404).json({ ok: false, error: 'Asset not found.' })
    const buffer = await readObject(asset)
    await recordAccess({ assetId: asset.id, actorUserId: req.user.id, action: 'download', metadata: { versionNumber: asset.current_version_number } })
    res.set({
      'Content-Type': asset.mime_type,
      'Content-Length': String(buffer.length),
      'Content-Disposition': `attachment; filename="${safeSegment(asset.original_filename)}"`,
      'Cache-Control': 'private, no-store, max-age=0',
    })
    return res.send(buffer)
  } catch (error) {
    return next(error)
  }
})

module.exports = router
