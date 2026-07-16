const express = require('express')
const { z } = require('zod')

const { env } = require('../config/env')
const { pool } = require('../db/pool')
const { requireAuth } = require('../middleware/auth.middleware')
const { createSignedGrant } = require('../services/assetAccessGrant.service')
const { assertAssetUsable, getInitialScanState } = require('../services/assetScan.service')
const {
  collectRequestBuffer,
  deleteObject,
  writeUploadedAsset,
} = require('../services/assetStorage.service')
const { getFounderAvailabilitySettings } = require('../services/founderAvailability.service')
const {
  createLetterBlock,
  normalizeDesign,
} = require('../services/letterBuilder.service')
const {
  DEFAULT_PRIMARY_TIMEZONE,
  getTranscriptionConfiguration,
  isValidTimeZone,
  normalizeComparisonTimeZones,
  processFounderTranscriptions,
} = require('../services/founderTranscription.service')

const router = express.Router()

const preferenceSchema = z.object({
  primaryTimezone: z.string().trim().min(1).max(100),
  comparisonTimezones: z.array(z.string().trim().min(1).max(100)).min(1).max(8),
  recordingRetentionDays: z.coerce.number().int().min(30).max(3650),
})
const recordingPatchSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  notes: z.string().trim().max(5000).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  folderId: z.string().uuid().nullable().optional(),
  transcriptText: z.string().trim().max(250000).optional(),
})
const accessSchema = z.object({ purpose: z.enum(['preview', 'download']) })
const assignmentSchema = z.object({ clientProfileId: z.string().uuid() })
const deleteSchema = z.object({ confirmation: z.string() })

function issue(parsed, fallback) {
  return parsed.error?.issues?.[0]?.message || fallback
}

function decodeHeader(value, fallback = '') {
  try { return decodeURIComponent(String(value || fallback)) } catch { return String(value || fallback) }
}

function parseTags(value) {
  return [...new Set(String(value || '').split(',').map((tag) => tag.trim().slice(0, 50)).filter(Boolean))].slice(0, 20)
}

async function writeAudit(db, req, action, entityType, entityId, afterData = {}, beforeData = {}) {
  await db.query(
    `
    INSERT INTO audit_logs (
      actor_user_id, action, entity_type, entity_id, before_data, after_data, ip_address, user_agent
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
    `,
    [
      req.user?.id || null,
      action,
      entityType,
      entityId || null,
      JSON.stringify(beforeData || {}),
      JSON.stringify(afterData || {}),
      req.ip || null,
      req.get('user-agent') || null,
    ],
  )
}

async function writeEvent(db, req, recording, eventType, metadata = {}, clientProfileId = null) {
  await db.query(
    `
    INSERT INTO founder_recording_events (
      recording_id, asset_id, actor_user_id, client_profile_id, event_type, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [recording?.id || null, recording?.asset_id || null, req.user?.id || null, clientProfileId, eventType, JSON.stringify(metadata)],
  )
}

async function getActiveFounderOwner() {
  const result = await pool.query(
    `
    SELECT id, email, role, status
    FROM system_users
    WHERE role = 'owner' AND status = 'active'
    ORDER BY CASE WHEN lower(email) = lower($1) THEN 0 ELSE 1 END, created_at ASC
    LIMIT 1
    `,
    [env.canonicalOwnerEmail],
  )
  return result.rows[0] || null
}

async function requireFounderToolsAccess(req, res, next) {
  if (!pool) return res.status(503).json({ ok: false, error: 'Database is not configured.' })
  if (req.user?.role === 'owner') {
    req.founderOwnerUserId = req.user.id
    req.founderAccessMode = 'owner'
    return next()
  }
  if (req.user?.role === 'developer') {
    try {
      const owner = await getActiveFounderOwner()
      if (!owner) return res.status(409).json({ ok: false, error: 'No active owner account is available for the Founder workspace.' })
      req.founderOwnerUserId = owner.id
      req.founderAccessMode = 'developer'
      return next()
    } catch (error) { return next(error) }
  }

  try {
    await writeAudit(pool, req, 'founder_tools_access_denied', 'system_users', req.user?.id, {
      role: req.user?.role,
      method: req.method,
      path: req.originalUrl,
      reason: 'owner_or_developer_role_required',
    })
  } catch { /* access remains denied even if audit persistence is unavailable */ }
  return res.status(403).json({ ok: false, error: 'Founder tools require the owner or developer account.' })
}

async function ensurePreferences(db, founderUserId) {
  await db.query(
    `
    INSERT INTO founder_tool_preferences (founder_user_id)
    VALUES ($1)
    ON CONFLICT (founder_user_id) DO NOTHING
    `,
    [founderUserId],
  )
  const result = await db.query(`SELECT * FROM founder_tool_preferences WHERE founder_user_id = $1 LIMIT 1`, [founderUserId])
  return result.rows[0]
}

const recordingSelect = `
  SELECT recording.*,
    asset.title AS asset_title,
    asset.original_filename,
    asset.storage_driver,
    asset.storage_key,
    asset.status AS asset_status,
    asset.scan_status,
    asset.visibility,
    folder.name AS folder_name,
    COALESCE(assignments.items, '[]'::json) AS assignments,
    COALESCE(assignments.assignment_count, 0)::int AS assignment_count
  FROM founder_recordings recording
  JOIN assets asset ON asset.id = recording.asset_id
  LEFT JOIN asset_folders folder ON folder.id = recording.folder_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS assignment_count,
      json_agg(json_build_object(
        'id', assignment.id,
        'clientProfileId', assignment.client_profile_id,
        'clientName', trim(concat(profile.first_name, ' ', profile.last_name)),
        'status', assignment.status,
        'assignedAt', assignment.assigned_at
      ) ORDER BY assignment.assigned_at DESC) AS items
    FROM asset_assignments assignment
    JOIN client_profiles profile ON profile.id = assignment.client_profile_id
    WHERE assignment.asset_id = asset.id AND assignment.status = 'active'
  ) assignments ON true
`

async function getRecording(recordingId, founderUserId, db = pool, { lock = false } = {}) {
  const result = await db.query(
    `${recordingSelect} WHERE recording.id = $1 AND recording.founder_user_id = $2 LIMIT 1${lock ? ' FOR UPDATE OF recording, asset' : ''}`,
    [recordingId, founderUserId],
  )
  return result.rows[0] || null
}

async function getWorkspace(req) {
  const preferences = await ensurePreferences(pool, req.founderOwnerUserId)
  const search = String(req.query.search || '').trim()
  const status = req.query.status === 'archived' ? 'archived' : 'active'
  const [recordings, folders, clients, scheduling] = await Promise.all([
    pool.query(
      `
      ${recordingSelect}
      WHERE recording.founder_user_id = $1 AND recording.status = $2
        AND ($3 = ''
          OR recording.title ILIKE '%' || $3 || '%'
          OR COALESCE(recording.notes, '') ILIKE '%' || $3 || '%'
          OR recording.transcript_text ILIKE '%' || $3 || '%'
          OR EXISTS (SELECT 1 FROM unnest(recording.tags) tag WHERE tag ILIKE '%' || $3 || '%'))
      ORDER BY recording.updated_at DESC
      LIMIT 150
      `,
      [req.founderOwnerUserId, status, search],
    ),
    pool.query(`SELECT id, name, slug FROM asset_folders WHERE archived_at IS NULL ORDER BY CASE WHEN slug = 'founder-recordings' THEN 0 ELSE 1 END, name ASC`),
    pool.query(
      `
      SELECT profile.id, profile.first_name, profile.last_name, user_record.email
      FROM client_profiles profile
      LEFT JOIN system_users user_record ON user_record.id = profile.user_id
      WHERE COALESCE(profile.client_status, 'lead') <> 'archived'
        AND (user_record.id IS NULL OR user_record.role = 'client')
      ORDER BY profile.first_name ASC, profile.last_name ASC
      LIMIT 500
      `,
    ),
    getFounderAvailabilitySettings(pool, req.founderOwnerUserId),
  ])

  return {
    ok: true,
    accessMode: req.founderAccessMode,
    generatedAt: new Date().toISOString(),
    preferences: {
      primaryTimezone: preferences.primary_timezone || DEFAULT_PRIMARY_TIMEZONE,
      comparisonTimezones: normalizeComparisonTimeZones(preferences.comparison_timezones),
      recordingRetentionDays: Number(preferences.recording_retention_days || 365),
    },
    scheduling: {
      timezone: scheduling.timezone,
      scheduleEnabled: scheduling.scheduleEnabled,
      note: 'Scheduling timezone controls booked sessions and availability. Clock preferences do not change it.',
    },
    transcription: getTranscriptionConfiguration(),
    recordings: recordings.rows,
    folders: folders.rows,
    clients: clients.rows,
  }
}

router.use(requireAuth, requireFounderToolsAccess)

router.get('/overview', async (req, res, next) => {
  try { return res.json(await getWorkspace(req)) } catch (error) { return next(error) }
})

router.patch('/preferences', async (req, res, next) => {
  const parsed = preferenceSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: issue(parsed, 'Check the Founder preferences.') })
  if (!isValidTimeZone(parsed.data.primaryTimezone)) return res.status(400).json({ ok: false, error: 'Choose a valid primary timezone.' })
  const comparisons = normalizeComparisonTimeZones(parsed.data.comparisonTimezones)
  if (comparisons.length !== parsed.data.comparisonTimezones.length) return res.status(400).json({ ok: false, error: 'One or more comparison timezones are invalid or duplicated.' })

  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const before = await ensurePreferences(db, req.founderOwnerUserId)
    const result = await db.query(
      `
      UPDATE founder_tool_preferences
      SET primary_timezone = $2, comparison_timezones = $3::jsonb,
          recording_retention_days = $4, updated_by_user_id = $5
      WHERE founder_user_id = $1
      RETURNING *
      `,
      [req.founderOwnerUserId, parsed.data.primaryTimezone, JSON.stringify(comparisons), parsed.data.recordingRetentionDays, req.user.id],
    )
    await writeAudit(db, req, 'founder_tool_preferences_updated', 'founder_tool_preferences', req.founderOwnerUserId, {
      primaryTimezone: parsed.data.primaryTimezone,
      comparisonTimezones: comparisons,
      recordingRetentionDays: parsed.data.recordingRetentionDays,
      schedulingTimezoneChanged: false,
    }, before)
    await db.query('COMMIT')
    return res.json({ ok: true, preferences: result.rows[0], message: 'Founder clock and retention preferences saved. Scheduling was not changed.' })
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    return next(error)
  } finally { db.release() }
})

router.post('/recordings/upload', async (req, res, next) => {
  let stored
  try {
    const fileName = decodeHeader(req.headers['x-pwc-file-name'], `founder-recording-${Date.now()}.webm`)
    const title = decodeHeader(req.headers['x-pwc-recording-title'], fileName.replace(/\.[^.]+$/, '')).trim().slice(0, 240)
    const notes = decodeHeader(req.headers['x-pwc-recording-notes'], '').trim().slice(0, 5000)
    const tags = parseTags(decodeHeader(req.headers['x-pwc-tags'], ''))
    const requestedFolderId = String(req.headers['x-pwc-folder-id'] || '').trim() || null
    if (requestedFolderId && !z.string().uuid().safeParse(requestedFolderId).success) {
      return res.status(400).json({ ok: false, error: 'Choose a valid Asset Vault folder.' })
    }
    const requestedDurationMs = Number(req.headers['x-pwc-duration-ms'] || 0)
    const durationMs = Number.isFinite(requestedDurationMs)
      ? Math.min(Math.max(requestedDurationMs, 0), 7200000)
      : 0
    const mimeType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    if (!mimeType.startsWith('audio/')) return res.status(415).json({ ok: false, error: 'Founder recordings must be an audio file.' })
    if (!title) return res.status(400).json({ ok: false, error: 'Recording title is required.' })
    const buffer = await collectRequestBuffer(req)
    stored = await writeUploadedAsset({ fileName, mimeType, buffer })
    const scan = getInitialScanState(env.assetMalwareScanner)
    const db = await pool.connect()
    try {
      await db.query('BEGIN')
      const preferences = await ensurePreferences(db, req.founderOwnerUserId)
      let folderId = requestedFolderId
      if (!folderId) {
        const folder = await db.query(`SELECT id FROM asset_folders WHERE slug = 'founder-recordings' AND archived_at IS NULL LIMIT 1`)
        folderId = folder.rows[0]?.id || null
      }
      const assetResult = await db.query(
        `
        INSERT INTO assets (
          title, description, original_filename, file_extension, mime_type, size_bytes,
          checksum_sha256, storage_driver, storage_key, scan_status, scan_message,
          scanned_at, visibility, folder_id, tags, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'private', $13, $14::text[], $15, $15)
        RETURNING *
        `,
        [title, notes || null, stored.originalFilename, stored.fileExtension || null, stored.mimeType, stored.sizeBytes, stored.checksumSha256, stored.storageDriver, stored.storageKey, scan.status, scan.message, scan.scannedAt, folderId, tags, req.user.id],
      )
      const asset = assetResult.rows[0]
      await db.query(
        `
        INSERT INTO asset_versions (
          asset_id, version_number, original_filename, mime_type, size_bytes,
          checksum_sha256, storage_driver, storage_key, notes, created_by
        ) VALUES ($1, 1, $2, $3, $4, $5, $6, $7, 'Original Founder recording', $8)
        `,
        [asset.id, stored.originalFilename, stored.mimeType, stored.sizeBytes, stored.checksumSha256, stored.storageDriver, stored.storageKey, req.user.id],
      )
      const recordingResult = await db.query(
        `
        INSERT INTO founder_recordings (
          founder_user_id, asset_id, title, notes, tags, folder_id, is_private,
          duration_ms, mime_type, size_bytes, retention_until, created_by_user_id, updated_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5::text[], $6, true, $7, $8, $9,
          now() + ($10::int * interval '1 day'), $11, $11)
        RETURNING *
        `,
        [req.founderOwnerUserId, asset.id, title, notes || null, tags, folderId, durationMs, stored.mimeType, stored.sizeBytes, Number(preferences.recording_retention_days || 365), req.user.id],
      )
      const recording = recordingResult.rows[0]
      await db.query(
        `INSERT INTO asset_relationships (asset_id, context_type, context_id, relationship_type, created_by) VALUES ($1, 'founder_recording', $2, 'source_recording', $3)`,
        [asset.id, recording.id, req.user.id],
      )
      await db.query(
        `INSERT INTO asset_access_logs (asset_id, actor_user_id, action, metadata) VALUES ($1, $2, 'upload', $3::jsonb)`,
        [asset.id, req.user.id, JSON.stringify({ source: 'founder_voice_recorder', private: true, sizeBytes: stored.sizeBytes })],
      )
      await writeEvent(db, req, recording, 'created', { private: true, retentionUntil: recording.retention_until })
      await writeAudit(db, req, 'founder_recording_created', 'founder_recordings', recording.id, { assetId: asset.id, title, private: true })
      await db.query('COMMIT')
      return res.status(201).json({ ok: true, recording, asset, message: 'Private Founder recording saved to Asset Vault.' })
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    } finally { db.release() }
  } catch (error) {
    if (stored) {
      try { await deleteObject(stored) } catch { /* preserve the upload error */ }
    }
    return next(error)
  }
})

router.get('/recordings/:recordingId', async (req, res, next) => {
  try {
    const recording = await getRecording(req.params.recordingId, req.founderOwnerUserId)
    if (!recording) return res.status(404).json({ ok: false, error: 'Founder recording not found.' })
    const events = await pool.query(
      `SELECT event.*, actor.email AS actor_email FROM founder_recording_events event LEFT JOIN system_users actor ON actor.id = event.actor_user_id WHERE event.recording_id = $1 ORDER BY event.created_at DESC LIMIT 60`,
      [recording.id],
    )
    return res.json({ ok: true, recording, events: events.rows })
  } catch (error) { return next(error) }
})

router.patch('/recordings/:recordingId', async (req, res, next) => {
  const parsed = recordingPatchSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: issue(parsed, 'Check the recording details.') })
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const before = await getRecording(req.params.recordingId, req.founderOwnerUserId, db, { lock: true })
    if (!before) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Founder recording not found.' })
    }
    const input = parsed.data
    const transcriptChanged = Object.prototype.hasOwnProperty.call(input, 'transcriptText')
    const result = await db.query(
      `
      UPDATE founder_recordings SET
        title = COALESCE($3, title),
        notes = CASE WHEN $4::boolean THEN $5 ELSE notes END,
        tags = COALESCE($6::text[], tags),
        folder_id = CASE WHEN $7::boolean THEN $8::uuid ELSE folder_id END,
        transcript_text = CASE WHEN $9::boolean THEN $10 ELSE transcript_text END,
        transcript_status = CASE WHEN $9::boolean THEN 'ready' ELSE transcript_status END,
        transcript_edited_at = CASE WHEN $9::boolean THEN now() ELSE transcript_edited_at END,
        transcript_edited_by = CASE WHEN $9::boolean THEN $11 ELSE transcript_edited_by END,
        updated_by_user_id = $11
      WHERE id = $1 AND founder_user_id = $2
      RETURNING *
      `,
      [before.id, req.founderOwnerUserId, input.title || null, Object.prototype.hasOwnProperty.call(input, 'notes'), input.notes || null, input.tags || null, Object.prototype.hasOwnProperty.call(input, 'folderId'), input.folderId || null, transcriptChanged, input.transcriptText || '', req.user.id],
    )
    const recording = result.rows[0]
    await db.query(
      `UPDATE assets SET title = $2, description = $3, tags = $4::text[], folder_id = $5, updated_by = $6 WHERE id = $1`,
      [recording.asset_id, recording.title, recording.notes || null, recording.tags, recording.folder_id, req.user.id],
    )
    await writeEvent(db, req, recording, transcriptChanged ? 'transcript_edited' : 'metadata_updated', { transcriptChanged })
    await writeAudit(db, req, transcriptChanged ? 'founder_transcript_edited' : 'founder_recording_updated', 'founder_recordings', recording.id, { title: recording.title, tags: recording.tags }, { title: before.title, tags: before.tags })
    await db.query('COMMIT')
    return res.json({ ok: true, recording, message: transcriptChanged ? 'Transcript saved.' : 'Recording details saved.' })
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    return next(error)
  } finally { db.release() }
})

router.post('/recordings/:recordingId/transcription', async (req, res, next) => {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const recording = await getRecording(req.params.recordingId, req.founderOwnerUserId, db, { lock: true })
    if (!recording) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Founder recording not found.' })
    }
    assertAssetUsable({ ...recording, status: recording.asset_status })
    const configuration = getTranscriptionConfiguration()
    await db.query(
      `
      INSERT INTO founder_transcription_jobs (recording_id, status, provider, requested_by_user_id)
      VALUES ($1, 'queued', $2, $3)
      ON CONFLICT (recording_id) DO UPDATE SET
        status = 'queued', provider = EXCLUDED.provider, attempts = 0,
        available_at = now(), locked_at = NULL, completed_at = NULL,
        error_message = NULL, requested_by_user_id = EXCLUDED.requested_by_user_id
      `,
      [recording.id, configuration.provider, req.user.id],
    )
    await db.query(
      `UPDATE founder_recordings SET transcript_status = 'queued', transcript_provider = $2, transcript_error = NULL, transcript_requested_at = now(), updated_by_user_id = $3 WHERE id = $1`,
      [recording.id, configuration.provider, req.user.id],
    )
    await writeEvent(db, req, recording, 'transcript_requested', { provider: configuration.provider, configured: configuration.configured })
    await writeAudit(db, req, 'founder_transcription_requested', 'founder_recordings', recording.id, { provider: configuration.provider, configured: configuration.configured })
    await db.query('COMMIT')
    return res.status(202).json({
      ok: true,
      queued: true,
      transcription: configuration,
      message: configuration.configured
        ? 'Transcription queued securely.'
        : 'Transcription request saved. Configure the server provider before processing it.',
    })
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    return next(error)
  } finally { db.release() }
})

router.post('/transcriptions/process', async (req, res, next) => {
  try {
    const result = await processFounderTranscriptions(pool)
    await writeAudit(pool, req, 'founder_transcriptions_processed', 'founder_transcription_jobs', null, result)
    return res.json({ ok: true, ...result })
  } catch (error) { return next(error) }
})

router.post('/recordings/:recordingId/access', async (req, res, next) => {
  const parsed = accessSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: issue(parsed, 'Choose preview or download.') })
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const recording = await getRecording(req.params.recordingId, req.founderOwnerUserId, db)
    if (!recording) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Founder recording not found.' })
    }
    assertAssetUsable({ ...recording, status: recording.asset_status })
    const grant = createSignedGrant({
      assetId: recording.asset_id,
      actorUserId: req.user.id,
      purpose: parsed.data.purpose,
      ttlSeconds: env.assetAccessGrantTtlSeconds,
      secret: env.assetAccessGrantSecret,
    })
    await db.query(
      `INSERT INTO asset_access_grants (id, token_hash, asset_id, issued_to_user_id, purpose, expires_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [grant.grantId, grant.tokenHash, recording.asset_id, req.user.id, parsed.data.purpose, grant.expiresAt],
    )
    await db.query(
      `INSERT INTO asset_access_logs (asset_id, actor_user_id, action, metadata) VALUES ($1, $2, 'grant_create', $3::jsonb)`,
      [recording.asset_id, req.user.id, JSON.stringify({ grantId: grant.grantId, purpose: parsed.data.purpose, source: 'founder_voice_recorder' })],
    )
    await writeEvent(db, req, recording, parsed.data.purpose === 'preview' ? 'playback' : 'download', { grantId: grant.grantId, expiresAt: grant.expiresAt })
    await db.query('COMMIT')
    return res.status(201).json({ ok: true, purpose: parsed.data.purpose, expiresAt: grant.expiresAt, path: `/api/admin/assets/access/${encodeURIComponent(grant.token)}` })
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    return next(error)
  } finally { db.release() }
})

router.post('/recordings/:recordingId/assignments', async (req, res, next) => {
  const parsed = assignmentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: issue(parsed, 'Choose a client.') })
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const recording = await getRecording(req.params.recordingId, req.founderOwnerUserId, db, { lock: true })
    if (!recording) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Founder recording not found.' })
    }
    assertAssetUsable({ ...recording, status: recording.asset_status })
    const clientResult = await db.query(
      `SELECT id, first_name, last_name FROM client_profiles WHERE id = $1 AND COALESCE(client_status, 'lead') <> 'archived' LIMIT 1`,
      [parsed.data.clientProfileId],
    )
    const clientProfile = clientResult.rows[0]
    if (!clientProfile) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Eligible client profile not found.' })
    }
    const existing = await db.query(
      `SELECT * FROM asset_assignments WHERE asset_id = $1 AND client_profile_id = $2 ORDER BY (status = 'active') DESC, created_at DESC LIMIT 1`,
      [recording.asset_id, clientProfile.id],
    )
    if (existing.rows[0]?.status === 'active') {
      await db.query('COMMIT')
      return res.json({ ok: true, assignment: existing.rows[0], message: 'This client already has the recording.' })
    }
    const portalResult = await db.query(
      `
      INSERT INTO client_portal_resources (
        client_profile_id, title, resource_type, description, resource_url, status, created_by_user_id
      ) VALUES ($1, $2, 'link', $3, $4, 'active', $5)
      RETURNING *
      `,
      [clientProfile.id, recording.title, recording.notes || 'Private audio from Power Within.', `/api/public/client-portal/assets/${recording.asset_id}/download`, req.user.id],
    )
    const portalResource = portalResult.rows[0]
    const assignmentResult = existing.rows[0]
      ? await db.query(
        `UPDATE asset_assignments SET status = 'active', revoked_at = NULL, assigned_at = now(), assigned_by = $3, portal_resource_id = $4, title_override = $5, description_override = $6 WHERE id = $1 AND asset_id = $2 RETURNING *`,
        [existing.rows[0].id, recording.asset_id, req.user.id, portalResource.id, recording.title, recording.notes || null],
      )
      : await db.query(
        `INSERT INTO asset_assignments (asset_id, client_profile_id, assigned_by, title_override, description_override, portal_resource_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [recording.asset_id, clientProfile.id, req.user.id, recording.title, recording.notes || null, portalResource.id],
      )
    const assignment = assignmentResult.rows[0]
    await db.query(`UPDATE assets SET visibility = 'client_assigned', updated_by = $2 WHERE id = $1`, [recording.asset_id, req.user.id])
    await db.query(`UPDATE founder_recordings SET is_private = false, updated_by_user_id = $2 WHERE id = $1`, [recording.id, req.user.id])
    await db.query(
      `INSERT INTO asset_access_logs (asset_id, assignment_id, actor_user_id, client_profile_id, action, metadata) VALUES ($1, $2, $3, $4, 'assign', $5::jsonb)`,
      [recording.asset_id, assignment.id, req.user.id, clientProfile.id, JSON.stringify({ source: 'founder_voice_recorder', explicitShare: true })],
    )
    await writeEvent(db, req, recording, 'shared', { assignmentId: assignment.id, explicitShare: true }, clientProfile.id)
    await writeAudit(db, req, 'founder_recording_shared', 'founder_recordings', recording.id, { assetId: recording.asset_id, clientProfileId: clientProfile.id, assignmentId: assignment.id })
    await db.query('COMMIT')
    return res.status(201).json({ ok: true, assignment, message: 'Recording explicitly shared with the client.' })
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    return next(error)
  } finally { db.release() }
})

router.delete('/recordings/:recordingId/assignments/:assignmentId', async (req, res, next) => {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const recording = await getRecording(req.params.recordingId, req.founderOwnerUserId, db, { lock: true })
    if (!recording) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Founder recording not found.' })
    }
    const result = await db.query(
      `UPDATE asset_assignments SET status = 'revoked', revoked_at = now() WHERE id = $1 AND asset_id = $2 AND status = 'active' RETURNING *`,
      [req.params.assignmentId, recording.asset_id],
    )
    const assignment = result.rows[0]
    if (!assignment) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Active recording assignment not found.' })
    }
    if (assignment.portal_resource_id) await db.query(`UPDATE client_portal_resources SET status = 'archived', updated_at = now() WHERE id = $1`, [assignment.portal_resource_id])
    const remaining = await db.query(`SELECT COUNT(*)::int AS count FROM asset_assignments WHERE asset_id = $1 AND status = 'active'`, [recording.asset_id])
    if (Number(remaining.rows[0]?.count || 0) === 0) {
      await db.query(`UPDATE assets SET visibility = 'private', updated_by = $2 WHERE id = $1`, [recording.asset_id, req.user.id])
      await db.query(`UPDATE founder_recordings SET is_private = true, updated_by_user_id = $2 WHERE id = $1`, [recording.id, req.user.id])
    }
    await db.query(
      `INSERT INTO asset_access_logs (asset_id, assignment_id, actor_user_id, client_profile_id, action, metadata) VALUES ($1, $2, $3, $4, 'unassign', $5::jsonb)`,
      [recording.asset_id, assignment.id, req.user.id, assignment.client_profile_id, JSON.stringify({ source: 'founder_voice_recorder' })],
    )
    await writeEvent(db, req, recording, 'unshared', { assignmentId: assignment.id }, assignment.client_profile_id)
    await writeAudit(db, req, 'founder_recording_unshared', 'founder_recordings', recording.id, { assignmentId: assignment.id, clientProfileId: assignment.client_profile_id })
    await db.query('COMMIT')
    return res.json({ ok: true, message: 'Client access removed.' })
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    return next(error)
  } finally { db.release() }
})

router.post('/recordings/:recordingId/reuse-letter', async (req, res, next) => {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const recording = await getRecording(req.params.recordingId, req.founderOwnerUserId, db)
    if (!recording) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Founder recording not found.' })
    }
    if (!String(recording.transcript_text || '').trim()) {
      await db.query('ROLLBACK')
      return res.status(409).json({ ok: false, error: 'Add or complete the transcript before reusing it in a Letter.' })
    }
    const heading = createLetterBlock('heading')
    heading.content = { ...heading.content, text: recording.title, level: 1 }
    const text = createLetterBlock('text')
    text.content = { ...text.content, text: recording.transcript_text }
    const signature = createLetterBlock('signature')
    const unsubscribe = createLetterBlock('unsubscribe')
    const design = normalizeDesign({ blocks: [heading, text, signature, unsubscribe] })
    const result = await db.query(
      `INSERT INTO letter_documents (title, subject, preview_text, design, created_by_user_id, updated_by_user_id) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING *`,
      [`${recording.title} — transcript draft`, recording.title, 'A note from Power Within Collective', JSON.stringify(design), req.user.id],
    )
    const letter = result.rows[0]
    const snapshot = { title: letter.title, subject: letter.subject, previewText: letter.preview_text, design: letter.design, audienceFilter: letter.audience_filter }
    await db.query(
      `INSERT INTO letter_versions (letter_id, revision, snapshot, reason, created_by_user_id) VALUES ($1, 0, $2::jsonb, 'manual', $3)`,
      [letter.id, JSON.stringify(snapshot), req.user.id],
    )
    await db.query(
      `INSERT INTO asset_relationships (asset_id, context_type, context_id, relationship_type, created_by) VALUES ($1, 'letter', $2, 'source_recording', $3) ON CONFLICT DO NOTHING`,
      [recording.asset_id, letter.id, req.user.id],
    )
    await writeEvent(db, req, recording, 'reused_in_letter', { letterId: letter.id })
    await writeAudit(db, req, 'founder_transcript_reused_in_letter', 'letter_documents', letter.id, { recordingId: recording.id, assetId: recording.asset_id })
    await db.query('COMMIT')
    return res.status(201).json({ ok: true, letterId: letter.id, path: `/admin/letters?letter=${letter.id}`, message: 'Transcript opened as a new Letter draft.' })
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    return next(error)
  } finally { db.release() }
})

router.post('/recordings/:recordingId/archive', async (req, res, next) => {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const recording = await getRecording(req.params.recordingId, req.founderOwnerUserId, db, { lock: true })
    if (!recording) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Founder recording not found.' })
    }
    await db.query(`UPDATE founder_recordings SET status = 'archived', archived_at = now(), updated_by_user_id = $2 WHERE id = $1`, [recording.id, req.user.id])
    await db.query(`UPDATE assets SET status = 'archived', archived_at = now(), updated_by = $2 WHERE id = $1`, [recording.asset_id, req.user.id])
    await writeEvent(db, req, recording, 'archived')
    await writeAudit(db, req, 'founder_recording_archived', 'founder_recordings', recording.id, { assetId: recording.asset_id })
    await db.query('COMMIT')
    return res.json({ ok: true, message: 'Recording archived. Permanent deletion is still available separately.' })
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    return next(error)
  } finally { db.release() }
})

router.post('/recordings/:recordingId/restore', async (req, res, next) => {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const recording = await getRecording(req.params.recordingId, req.founderOwnerUserId, db, { lock: true })
    if (!recording) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Founder recording not found.' })
    }
    await db.query(`UPDATE founder_recordings SET status = 'active', archived_at = NULL, updated_by_user_id = $2 WHERE id = $1`, [recording.id, req.user.id])
    await db.query(`UPDATE assets SET status = 'active', archived_at = NULL, updated_by = $2 WHERE id = $1`, [recording.asset_id, req.user.id])
    await writeEvent(db, req, recording, 'restored')
    await writeAudit(db, req, 'founder_recording_restored', 'founder_recordings', recording.id, { assetId: recording.asset_id })
    await db.query('COMMIT')
    return res.json({ ok: true, message: 'Recording restored.' })
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    return next(error)
  } finally { db.release() }
})

router.delete('/recordings/:recordingId', async (req, res, next) => {
  const parsed = deleteSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: issue(parsed, 'Type the recording title to permanently delete it.') })
  const db = await pool.connect()
  let storageObjects
  try {
    await db.query('BEGIN')
    const recording = await getRecording(req.params.recordingId, req.founderOwnerUserId, db, { lock: true })
    if (!recording) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Founder recording not found.' })
    }
    if (parsed.data.confirmation !== recording.title) {
      await db.query('ROLLBACK')
      return res.status(400).json({ ok: false, error: 'The confirmation must exactly match the recording title.' })
    }
    const versions = await db.query(
      `SELECT DISTINCT storage_driver, storage_key FROM asset_versions WHERE asset_id = $1`,
      [recording.asset_id],
    )
    storageObjects = versions.rows.length
      ? versions.rows
      : [{ storage_driver: recording.storage_driver, storage_key: recording.storage_key }]
    await db.query(
      `UPDATE client_portal_resources resource SET status = 'archived', updated_at = now() FROM asset_assignments assignment WHERE assignment.asset_id = $1 AND assignment.portal_resource_id = resource.id`,
      [recording.asset_id],
    )
    await db.query(`UPDATE asset_assignments SET status = 'revoked', revoked_at = now() WHERE asset_id = $1 AND status = 'active'`, [recording.asset_id])
    await db.query(`UPDATE asset_access_grants SET status = 'revoked' WHERE asset_id = $1 AND status = 'active'`, [recording.asset_id])
    await writeEvent(db, req, recording, 'permanently_deleted', { title: recording.title, retentionUntil: recording.retention_until })
    await writeAudit(db, req, 'founder_recording_permanently_deleted', 'founder_recordings', recording.id, { assetId: recording.asset_id, title: recording.title })
    await db.query(`DELETE FROM founder_recordings WHERE id = $1`, [recording.id])
    await db.query(`DELETE FROM assets WHERE id = $1`, [recording.asset_id])
    await db.query('COMMIT')
    const storageFailures = []
    for (const storageObject of storageObjects) {
      try { await deleteObject(storageObject) } catch { storageFailures.push(storageObject) }
    }
    const storageDeleted = storageFailures.length === 0
    if (!storageDeleted) {
      try {
        await writeAudit(pool, req, 'founder_recording_storage_cleanup_failed', 'founder_recordings', recording.id, {
          assetId: recording.asset_id,
          failedObjects: storageFailures,
        })
      } catch { /* the response still reports incomplete cleanup */ }
    }
    return res.json({ ok: true, storageDeleted, message: storageDeleted ? 'Recording and transcript permanently deleted.' : 'Database record deleted; private storage cleanup needs attention.' })
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    return next(error)
  } finally { db.release() }
})

module.exports = router
