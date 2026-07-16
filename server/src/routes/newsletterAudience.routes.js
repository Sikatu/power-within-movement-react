const express = require('express')
const { z } = require('zod')

const { pool } = require('../db/pool')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const { enforceTeamPermission } = require('../services/teamManagement.service')
const {
  AUDIENCE_STATUSES,
  mergeDuplicateRecipients,
  parseAudienceCsv,
  syncSegments,
  syncTags,
  uniqueLabels,
  upsertSubscriber,
} = require('../services/newsletterAudience.service')

const router = express.Router()
const requireAudienceManager = [
  requireAuth,
  requireRole(['developer', 'owner', 'admin', 'staff']),
  enforceTeamPermission,
]

const labelListSchema = z.array(z.string().trim().min(1).max(60)).max(30).optional().default([])
const subscriberSchema = z.object({
  email: z.string().trim().email().max(320),
  firstName: z.string().trim().max(120).optional().default(''),
  lastName: z.string().trim().max(120).optional().default(''),
  status: z.enum([...AUDIENCE_STATUSES]).optional(),
  consentStatus: z.enum(['granted', 'pending', 'withdrawn', 'not_recorded']).optional(),
  explicitConsent: z.boolean().optional().default(false),
  consentAt: z.string().datetime({ offset: true }).nullable().optional(),
  source: z.string().trim().max(120).optional().default('admin_manual'),
  notes: z.string().trim().max(5000).optional().default(''),
  tags: labelListSchema,
  segments: labelListSchema,
  customFields: z.record(z.string(), z.unknown()).optional().default({}),
})

const subscriberUpdateSchema = subscriberSchema.omit({ email: true }).partial()
const bulkSchema = z.object({ recipients: z.array(subscriberSchema).min(1).max(500) })
const csvSchema = z.object({
  csv: z.string().min(1).max(900000),
  fileName: z.string().trim().max(240).optional().default('audience-import.csv'),
  source: z.string().trim().max(120).optional().default('csv_import'),
  defaultTags: labelListSchema,
})
const clientConsentSchema = z.object({
  consentConfirmed: z.literal(true),
  consentAt: z.string().datetime({ offset: true }).optional(),
  tags: labelListSchema,
  segments: labelListSchema,
  notes: z.string().trim().max(5000).optional().default(''),
})
const statusSchema = z.object({
  status: z.enum([...AUDIENCE_STATUSES]),
  explicitConsent: z.boolean().optional().default(false),
  source: z.string().trim().max(120).optional().default('admin_status_change'),
})
const bulkLabelsSchema = z.object({
  subscriberIds: z.array(z.string().uuid()).min(1).max(500),
  labels: z.array(z.string().trim().min(1).max(60)).min(1).max(30),
  action: z.enum(['add', 'remove']).optional().default('add'),
})
const segmentSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(1000).optional().default(''),
})

function firstIssue(parsed, fallback) {
  return parsed.error?.issues?.[0]?.message || fallback
}

function databaseUnavailable(res) {
  if (pool) return false
  res.status(503).json({ ok: false, error: 'Database is not configured.' })
  return true
}

async function writeAudit(db, req, action, entityType, entityId, afterData = {}) {
  await db.query(
    `
    INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, after_data, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
    `,
    [req.user?.id || null, action, entityType, entityId || null, JSON.stringify(afterData), req.ip || null, req.get('user-agent') || null],
  )
}

const subscriberProjection = `
  s.*,
  cp.first_name AS client_first_name,
  cp.last_name AS client_last_name,
  COALESCE((
    SELECT json_agg(et.name ORDER BY et.name)
    FROM subscriber_tag_links stl
    JOIN email_tags et ON et.id = stl.email_tag_id
    WHERE stl.subscriber_id = s.id
  ), '[]'::json) AS tags,
  COALESCE((
    SELECT json_agg(ns.name ORDER BY ns.name)
    FROM newsletter_segment_members nsm
    JOIN newsletter_segments ns ON ns.id = nsm.segment_id
    WHERE nsm.subscriber_id = s.id AND ns.archived_at IS NULL
  ), '[]'::json) AS segments,
  (
    SELECT json_build_object('id', sup.id, 'reason', sup.reason, 'createdAt', sup.created_at)
    FROM newsletter_suppressions sup
    WHERE sup.email = s.email AND sup.active = true
    ORDER BY sup.created_at DESC LIMIT 1
  ) AS active_suppression
`

function buildAudienceFilters(query, { eligibleOnly = false } = {}) {
  const clauses = []
  const values = []
  const add = (value) => {
    values.push(value)
    return `$${values.length}`
  }

  if (eligibleOnly) {
    clauses.push(`s.status = 'subscribed'`)
    clauses.push(`s.consent_status = 'granted'`)
    clauses.push(`NOT EXISTS (SELECT 1 FROM newsletter_suppressions sup WHERE sup.email = s.email AND sup.active = true)`)
  } else if (query.status && AUDIENCE_STATUSES.has(String(query.status))) {
    clauses.push(`s.status = ${add(String(query.status))}`)
  }

  if (query.search) {
    const token = add(`%${String(query.search).trim()}%`)
    clauses.push(`(s.email ILIKE ${token} OR COALESCE(s.first_name, '') ILIKE ${token} OR COALESCE(s.last_name, '') ILIKE ${token})`)
  }
  if (query.source) clauses.push(`s.source = ${add(String(query.source))}`)
  if (query.tag) {
    const token = add(String(query.tag))
    clauses.push(`EXISTS (SELECT 1 FROM subscriber_tag_links stl JOIN email_tags et ON et.id = stl.email_tag_id WHERE stl.subscriber_id = s.id AND lower(et.name) = lower(${token}))`)
  }
  if (query.segment) {
    const token = add(String(query.segment))
    clauses.push(`EXISTS (SELECT 1 FROM newsletter_segment_members nsm JOIN newsletter_segments ns ON ns.id = nsm.segment_id WHERE nsm.subscriber_id = s.id AND ns.archived_at IS NULL AND lower(ns.name) = lower(${token}))`)
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values }
}

async function getSubscriberDetail(db, subscriberId) {
  const subscriberResult = await db.query(
    `SELECT ${subscriberProjection} FROM subscribers s LEFT JOIN client_profiles cp ON cp.id = s.client_profile_id WHERE s.id = $1`,
    [subscriberId],
  )
  const subscriber = subscriberResult.rows[0]
  if (!subscriber) return null

  const [consent, sends] = await Promise.all([
    db.query(`SELECT * FROM newsletter_consent_events WHERE subscriber_id = $1 ORDER BY created_at DESC LIMIT 100`, [subscriberId]),
    db.query(`SELECT * FROM newsletter_send_history WHERE subscriber_id = $1 ORDER BY created_at DESC LIMIT 100`, [subscriberId]),
  ])
  return { subscriber, consentHistory: consent.rows, sendHistory: sends.rows }
}

async function importRecipients(req, { recipients, errors = [], fileName, source, duplicateCount = 0 }) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const imported = await db.query(
      `INSERT INTO newsletter_imports (file_name, source, total_rows, duplicate_count, created_by_user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [fileName, source, recipients.length + errors.length, duplicateCount, req.user.id],
    )
    const importRecord = imported.rows[0]
    let createdCount = 0
    let mergedCount = 0
    let suppressionBlockedCount = 0

    for (const recipient of recipients) {
      const result = await upsertSubscriber(db, recipient, {
        actorUserId: req.user.id,
        source,
        importId: importRecord.id,
      })
      if (result.created) createdCount += 1
      else mergedCount += 1
      if (result.suppressionBlocked) suppressionBlockedCount += 1
    }

    const status = errors.length ? 'completed_with_errors' : 'completed'
    const completed = await db.query(
      `
      UPDATE newsletter_imports SET status = $2, created_count = $3, merged_count = $4,
        skipped_count = $5, errors = $6::jsonb, completed_at = now()
      WHERE id = $1 RETURNING *
      `,
      [importRecord.id, status, createdCount, mergedCount, errors.length, JSON.stringify(errors.slice(0, 250))],
    )
    await writeAudit(db, req, 'newsletter_audience_imported', 'newsletter_imports', importRecord.id, {
      source,
      createdCount,
      mergedCount,
      duplicateCount,
      skippedCount: errors.length,
      suppressionBlockedCount,
    })
    await db.query('COMMIT')
    return { import: completed.rows[0], suppressionBlockedCount }
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  } finally {
    db.release()
  }
}

router.use(requireAudienceManager)

router.get('/summary', async (req, res, next) => {
  if (databaseUnavailable(res)) return
  try {
    const [counts, tags, segments, sources, imports] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'subscribed' AND consent_status = 'granted')::int AS subscribed,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'unsubscribed')::int AS unsubscribed,
          COUNT(*) FILTER (WHERE status = 'bounced')::int AS bounced,
          COUNT(*) FILTER (WHERE status = 'complained')::int AS complained,
          COUNT(*) FILTER (WHERE status = 'suppressed')::int AS suppressed,
          COUNT(*) FILTER (WHERE client_profile_id IS NOT NULL)::int AS linked_clients,
          COUNT(*) FILTER (WHERE status = 'subscribed' AND consent_status = 'granted' AND NOT EXISTS (
            SELECT 1 FROM newsletter_suppressions sup WHERE sup.email = subscribers.email AND sup.active = true
          ))::int AS eligible
        FROM subscribers
      `),
      pool.query(`SELECT et.name, COUNT(stl.subscriber_id)::int AS count FROM email_tags et LEFT JOIN subscriber_tag_links stl ON stl.email_tag_id = et.id GROUP BY et.id ORDER BY et.name`),
      pool.query(`SELECT ns.id, ns.name, ns.description, COUNT(nsm.subscriber_id)::int AS count FROM newsletter_segments ns LEFT JOIN newsletter_segment_members nsm ON nsm.segment_id = ns.id WHERE ns.archived_at IS NULL GROUP BY ns.id ORDER BY ns.name`),
      pool.query(`SELECT source, COUNT(*)::int AS count FROM subscribers WHERE source IS NOT NULL GROUP BY source ORDER BY count DESC, source LIMIT 30`),
      pool.query(`SELECT * FROM newsletter_imports ORDER BY created_at DESC LIMIT 8`),
    ])
    res.json({ ok: true, metrics: counts.rows[0] || {}, tags: tags.rows, segments: segments.rows, sources: sources.rows, recentImports: imports.rows })
  } catch (error) {
    next(error)
  }
})

router.get('/subscribers', async (req, res, next) => {
  if (databaseUnavailable(res)) return
  try {
    const { where, values } = buildAudienceFilters(req.query)
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit, 10) || 50))
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM subscribers s ${where}`, values)
    const rows = await pool.query(
      `SELECT ${subscriberProjection} FROM subscribers s LEFT JOIN client_profiles cp ON cp.id = s.client_profile_id ${where} ORDER BY s.updated_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, (page - 1) * limit],
    )
    res.json({ ok: true, subscribers: rows.rows, pagination: { page, limit, total: count.rows[0]?.total || 0 } })
  } catch (error) {
    next(error)
  }
})

router.get('/preview-count', async (req, res, next) => {
  if (databaseUnavailable(res)) return
  try {
    const { where, values } = buildAudienceFilters(req.query, { eligibleOnly: true })
    const result = await pool.query(`SELECT COUNT(*)::int AS eligible FROM subscribers s ${where}`, values)
    res.json({ ok: true, eligible: result.rows[0]?.eligible || 0, protections: ['explicit_consent', 'unsubscribe', 'bounce', 'complaint', 'suppression'] })
  } catch (error) {
    next(error)
  }
})

router.get('/subscribers/:subscriberId', async (req, res, next) => {
  if (databaseUnavailable(res)) return
  try {
    const detail = await getSubscriberDetail(pool, req.params.subscriberId)
    if (!detail) return res.status(404).json({ ok: false, error: 'Audience member not found.' })
    res.json({ ok: true, ...detail })
  } catch (error) {
    next(error)
  }
})

router.post('/subscribers', async (req, res, next) => {
  if (databaseUnavailable(res)) return
  const parsed = subscriberSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: firstIssue(parsed, 'Invalid subscriber details.') })
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const result = await upsertSubscriber(db, parsed.data, { actorUserId: req.user.id, source: parsed.data.source })
    await writeAudit(db, req, result.created ? 'newsletter_subscriber_created' : 'newsletter_subscriber_merged', 'subscribers', result.subscriber.id, { email: result.subscriber.email, status: result.subscriber.status, suppressionBlocked: result.suppressionBlocked })
    await db.query('COMMIT')
    const detail = await getSubscriberDetail(pool, result.subscriber.id)
    res.status(result.created ? 201 : 200).json({ ok: true, ...result, ...detail })
  } catch (error) {
    await db.query('ROLLBACK')
    next(error)
  } finally {
    db.release()
  }
})

router.post('/subscribers/bulk', async (req, res, next) => {
  if (databaseUnavailable(res)) return
  const parsed = bulkSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: firstIssue(parsed, 'Invalid audience list.') })
  try {
    const merged = mergeDuplicateRecipients(parsed.data.recipients)
    const result = await importRecipients(req, { recipients: merged.recipients, fileName: 'manual-bulk-entry', source: 'admin_bulk', duplicateCount: merged.duplicates })
    res.status(201).json({ ok: true, ...result })
  } catch (error) {
    next(error)
  }
})

router.post('/imports/csv', async (req, res, next) => {
  if (databaseUnavailable(res)) return
  const parsed = csvSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: firstIssue(parsed, 'Invalid CSV import.') })
  try {
    const csv = parseAudienceCsv(parsed.data.csv, { defaultSource: parsed.data.source, defaultTags: parsed.data.defaultTags })
    if (csv.recipients.length > 5000) return res.status(400).json({ ok: false, error: 'CSV imports are limited to 5,000 valid rows.' })
    const merged = mergeDuplicateRecipients(csv.recipients)
    const result = await importRecipients(req, { recipients: merged.recipients, errors: csv.errors, fileName: parsed.data.fileName, source: parsed.data.source, duplicateCount: merged.duplicates })
    res.status(201).json({ ok: true, ...result })
  } catch (error) {
    next(error)
  }
})

router.post('/clients/:clientProfileId', async (req, res, next) => {
  if (databaseUnavailable(res)) return
  const parsed = clientConsentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'Explicit newsletter consent must be confirmed before adding a client.' })
  const db = await pool.connect()
  try {
    const clientResult = await db.query(
      `SELECT cp.id, cp.first_name, cp.last_name, COALESCE(su.email::text, cp.public_contact_email) AS email FROM client_profiles cp LEFT JOIN system_users su ON su.id = cp.user_id WHERE cp.id = $1 LIMIT 1`,
      [req.params.clientProfileId],
    )
    const client = clientResult.rows[0]
    if (!client?.email) return res.status(404).json({ ok: false, error: 'This client does not have an email address available.' })
    await db.query('BEGIN')
    const result = await upsertSubscriber(db, {
      email: client.email,
      firstName: client.first_name,
      lastName: client.last_name,
      clientProfileId: client.id,
      explicitConsent: true,
      consentStatus: 'granted',
      consentAt: parsed.data.consentAt,
      status: 'subscribed',
      source: 'existing_client_explicit_consent',
      tags: parsed.data.tags,
      segments: parsed.data.segments,
      notes: parsed.data.notes,
    }, { actorUserId: req.user.id, source: 'existing_client_explicit_consent' })
    await writeAudit(db, req, 'newsletter_client_added_with_consent', 'subscribers', result.subscriber.id, { clientProfileId: client.id, email: result.subscriber.email })
    await db.query('COMMIT')
    res.status(result.created ? 201 : 200).json({ ok: true, ...result })
  } catch (error) {
    await db.query('ROLLBACK')
    next(error)
  } finally {
    db.release()
  }
})

router.patch('/subscribers/:subscriberId', async (req, res, next) => {
  if (databaseUnavailable(res)) return
  const parsed = subscriberUpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: firstIssue(parsed, 'Invalid audience update.') })
  const db = await pool.connect()
  try {
    const existing = await db.query(`SELECT * FROM subscribers WHERE id = $1`, [req.params.subscriberId])
    if (!existing.rows[0]) return res.status(404).json({ ok: false, error: 'Audience member not found.' })
    await db.query('BEGIN')
    const current = existing.rows[0]
    const result = await upsertSubscriber(db, {
      email: current.email,
      firstName: parsed.data.firstName ?? current.first_name,
      lastName: parsed.data.lastName ?? current.last_name,
      status: parsed.data.status ?? current.status,
      consentStatus: parsed.data.consentStatus ?? current.consent_status,
      explicitConsent: parsed.data.explicitConsent,
      consentAt: parsed.data.consentAt ?? current.consent_at,
      source: parsed.data.source || 'admin_profile_update',
      notes: parsed.data.notes ?? current.notes,
      tags: parsed.data.tags,
      segments: parsed.data.segments,
      customFields: parsed.data.customFields ?? current.custom_fields,
      clientProfileId: current.client_profile_id,
    }, { actorUserId: req.user.id, source: 'admin_profile_update' })
    await writeAudit(db, req, 'newsletter_subscriber_updated', 'subscribers', current.id, { status: result.subscriber.status, consentStatus: result.subscriber.consent_status })
    await db.query('COMMIT')
    res.json({ ok: true, ...(await getSubscriberDetail(pool, current.id)) })
  } catch (error) {
    await db.query('ROLLBACK')
    next(error)
  } finally {
    db.release()
  }
})

router.post('/subscribers/:subscriberId/status', async (req, res, next) => {
  if (databaseUnavailable(res)) return
  const parsed = statusSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: firstIssue(parsed, 'Invalid status change.') })
  if (parsed.data.status === 'subscribed' && !parsed.data.explicitConsent) {
    return res.status(400).json({ ok: false, error: 'Explicit consent must be confirmed before restoring subscribed status.' })
  }
  const db = await pool.connect()
  try {
    const existing = await db.query(`SELECT * FROM subscribers WHERE id = $1`, [req.params.subscriberId])
    const current = existing.rows[0]
    if (!current) return res.status(404).json({ ok: false, error: 'Audience member not found.' })
    await db.query('BEGIN')
    const result = await upsertSubscriber(db, {
      email: current.email,
      firstName: current.first_name,
      lastName: current.last_name,
      status: parsed.data.status,
      explicitConsent: parsed.data.explicitConsent,
      consentStatus: parsed.data.status === 'subscribed' ? 'granted' : (parsed.data.status === 'unsubscribed' ? 'withdrawn' : current.consent_status),
      source: parsed.data.source,
      notes: current.notes,
      customFields: current.custom_fields,
      clientProfileId: current.client_profile_id,
    }, { actorUserId: req.user.id, source: parsed.data.source })
    await writeAudit(db, req, 'newsletter_subscriber_status_changed', 'subscribers', current.id, { before: current.status, after: result.subscriber.status, suppressionBlocked: result.suppressionBlocked })
    await db.query('COMMIT')
    res.json({ ok: true, ...result, ...(await getSubscriberDetail(pool, current.id)) })
  } catch (error) {
    await db.query('ROLLBACK')
    next(error)
  } finally {
    db.release()
  }
})

async function bulkLabels(req, res, next, type) {
  if (databaseUnavailable(res)) return
  const parsed = bulkLabelsSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: firstIssue(parsed, 'Invalid bulk update.') })
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const labels = uniqueLabels(parsed.data.labels)
    if (parsed.data.action === 'add') {
      for (const subscriberId of parsed.data.subscriberIds) {
        if (type === 'tags') await syncTags(db, subscriberId, labels)
        else await syncSegments(db, subscriberId, labels, req.user.id)
      }
    } else if (type === 'tags') {
      await db.query(`DELETE FROM subscriber_tag_links stl USING email_tags et WHERE stl.email_tag_id = et.id AND stl.subscriber_id = ANY($1::uuid[]) AND lower(et.name) = ANY($2::text[])`, [parsed.data.subscriberIds, labels.map((label) => label.toLowerCase())])
    } else {
      await db.query(`DELETE FROM newsletter_segment_members nsm USING newsletter_segments ns WHERE nsm.segment_id = ns.id AND nsm.subscriber_id = ANY($1::uuid[]) AND lower(ns.name) = ANY($2::text[])`, [parsed.data.subscriberIds, labels.map((label) => label.toLowerCase())])
    }
    await writeAudit(db, req, `newsletter_bulk_${type}_${parsed.data.action}`, 'subscribers', null, { subscriberIds: parsed.data.subscriberIds, labels })
    await db.query('COMMIT')
    res.json({ ok: true, updated: parsed.data.subscriberIds.length, labels })
  } catch (error) {
    await db.query('ROLLBACK')
    next(error)
  } finally {
    db.release()
  }
}

router.post('/bulk/tags', (req, res, next) => bulkLabels(req, res, next, 'tags'))
router.post('/bulk/segments', (req, res, next) => bulkLabels(req, res, next, 'segments'))

router.post('/segments', async (req, res, next) => {
  if (databaseUnavailable(res)) return
  const parsed = segmentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: firstIssue(parsed, 'Invalid segment.') })
  try {
    const result = await pool.query(
      `INSERT INTO newsletter_segments (name, description, created_by_user_id) VALUES ($1, $2, $3) ON CONFLICT (lower(name)) WHERE archived_at IS NULL DO UPDATE SET description = EXCLUDED.description, updated_at = now() RETURNING *`,
      [parsed.data.name, parsed.data.description, req.user.id],
    )
    await writeAudit(pool, req, 'newsletter_segment_saved', 'newsletter_segments', result.rows[0].id, { name: result.rows[0].name })
    res.status(201).json({ ok: true, segment: result.rows[0] })
  } catch (error) {
    next(error)
  }
})

module.exports = router
