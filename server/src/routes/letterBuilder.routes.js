const express = require('express')
const { z } = require('zod')

const { pool } = require('../db/pool')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const { enforceTeamPermission } = require('../services/teamManagement.service')
const {
  createLetterBlock,
  normalizeDesign,
  renderLetter,
  validateLetter,
} = require('../services/letterBuilder.service')
const {
  assertOutgoingEmailAvailable,
  assertProviderConfigured,
  letterPublicBaseUrl,
  normalizeAudienceFilter,
  previewLetterAudience,
  processDueLetterBroadcasts,
  processLetterBroadcast,
  sendLetterEmail,
  snapshotBroadcastRecipients,
} = require('../services/letterBroadcast.service')

const router = express.Router()
const requireLetterManager = [
  requireAuth,
  requireRole(['developer', 'owner', 'admin', 'staff']),
  enforceTeamPermission,
]

const audienceFilterSchema = z.object({
  mode: z.enum(['all', 'filtered', 'selected']).optional().default('all'),
  tag: z.string().trim().max(60).optional().default(''),
  segment: z.string().trim().max(60).optional().default(''),
  source: z.string().trim().max(120).optional().default(''),
  subscriberIds: z.array(z.string().uuid()).max(5000).optional().default([]),
})
const createLetterSchema = z.object({
  title: z.string().trim().min(1).max(240),
  subject: z.string().trim().max(250).optional().default(''),
  previewText: z.string().trim().max(300).optional().default(''),
  templateId: z.string().uuid().nullable().optional(),
})
const saveLetterSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  subject: z.string().trim().max(250).optional(),
  previewText: z.string().trim().max(300).optional(),
  design: z.unknown().optional(),
  audienceFilter: audienceFilterSchema.optional(),
  baseRevision: z.number().int().min(0).optional(),
  saveReason: z.enum(['autosave', 'manual']).optional().default('autosave'),
})
const renderPreviewSchema = z.object({
  title: z.string().trim().max(240).optional().default('Preview letter'),
  subject: z.string().trim().max(250).optional().default(''),
  previewText: z.string().trim().max(300).optional().default(''),
  design: z.unknown(),
})
const templateSchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1000).optional().default(''),
  category: z.string().trim().max(80).optional().default('newsletter'),
  subject: z.string().trim().max(250).optional().default(''),
  previewText: z.string().trim().max(300).optional().default(''),
  design: z.unknown(),
  status: z.enum(['active', 'archived']).optional().default('active'),
})
const testSendSchema = z.object({ email: z.string().trim().email().max(320) })
const scheduleSchema = z.object({ scheduledAt: z.string().datetime({ offset: true }) })

function issue(parsed, fallback) {
  return parsed.error?.issues?.[0]?.message || fallback
}

function unavailable(res) {
  if (pool) return false
  res.status(503).json({ ok: false, error: 'Database is not configured.' })
  return true
}

async function writeAudit(db, req, action, entityType, entityId, afterData = {}) {
  await db.query(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, after_data, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
    [req.user?.id || null, action, entityType, entityId || null, JSON.stringify(afterData), req.ip || null, req.get('user-agent') || null],
  )
}

function letterSnapshot(letter) {
  return {
    title: letter.title,
    subject: letter.subject,
    previewText: letter.preview_text,
    design: letter.design,
    audienceFilter: letter.audience_filter,
  }
}

async function getLetter(letterId, db = pool) {
  const result = await db.query(
    `
    SELECT ld.*,
      (SELECT COUNT(*)::int FROM letter_versions lv WHERE lv.letter_id = ld.id) AS version_count,
      (SELECT json_build_object('id', lb.id, 'status', lb.status, 'recipient_count', lb.recipient_count, 'scheduled_at', lb.scheduled_at) FROM letter_broadcasts lb WHERE lb.letter_id = ld.id ORDER BY lb.created_at DESC LIMIT 1) AS latest_broadcast
    FROM letter_documents ld WHERE ld.id = $1 LIMIT 1
    `,
    [letterId],
  )
  return result.rows[0] || null
}

async function getBroadcastDetail(broadcastId) {
  const broadcastResult = await pool.query(
    `SELECT lb.*, COALESCE(NULLIF(lb.title_snapshot, ''), ld.title) AS title, COALESCE(NULLIF(lb.subject_snapshot, ''), ld.subject) AS subject, COALESCE(NULLIF(lb.preview_text_snapshot, ''), ld.preview_text) AS preview_text FROM letter_broadcasts lb JOIN letter_documents ld ON ld.id = lb.letter_id WHERE lb.id = $1 LIMIT 1`,
    [broadcastId],
  )
  const broadcast = broadcastResult.rows[0]
  if (!broadcast) return null
  const [recipients, links, events] = await Promise.all([
    pool.query(`SELECT lbr.*, s.first_name, s.last_name FROM letter_broadcast_recipients lbr JOIN subscribers s ON s.id = lbr.subscriber_id WHERE lbr.broadcast_id = $1 ORDER BY lbr.created_at ASC LIMIT 1000`, [broadcastId]),
    pool.query(`SELECT * FROM letter_tracking_links WHERE broadcast_id = $1 ORDER BY click_count DESC, created_at ASC`, [broadcastId]),
    pool.query(`SELECT * FROM letter_events WHERE broadcast_id = $1 ORDER BY occurred_at DESC LIMIT 500`, [broadcastId]),
  ])
  return { broadcast, recipients: recipients.rows, links: links.rows, events: events.rows }
}

router.use(requireLetterManager)

router.get('/overview', async (req, res, next) => {
  if (unavailable(res)) return
  try {
    const [metrics, letters, templates, broadcasts] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM letter_documents WHERE status <> 'archived') AS letters,
          (SELECT COUNT(*)::int FROM letter_documents WHERE status = 'draft') AS drafts,
          (SELECT COUNT(*)::int FROM letter_templates WHERE status = 'active') AS templates,
          (SELECT COUNT(*)::int FROM letter_broadcasts WHERE status = 'scheduled') AS scheduled,
          (SELECT COUNT(*)::int FROM letter_broadcasts WHERE status IN ('sent', 'partial')) AS sent,
          (SELECT COALESCE(SUM(sent_count), 0)::int FROM letter_broadcasts) AS delivered_to_provider,
          (SELECT COALESCE(SUM(opened_count), 0)::int FROM letter_broadcasts) AS opened,
          (SELECT COALESCE(SUM(clicked_count), 0)::int FROM letter_broadcasts) AS clicked
      `),
      pool.query(`SELECT * FROM letter_documents WHERE status <> 'archived' ORDER BY updated_at DESC LIMIT 20`),
      pool.query(`SELECT * FROM letter_templates WHERE status = 'active' ORDER BY updated_at DESC LIMIT 20`),
      pool.query(`SELECT lb.*, COALESCE(NULLIF(lb.title_snapshot, ''), ld.title) AS title, COALESCE(NULLIF(lb.subject_snapshot, ''), ld.subject) AS subject FROM letter_broadcasts lb JOIN letter_documents ld ON ld.id = lb.letter_id ORDER BY lb.created_at DESC LIMIT 20`),
    ])
    res.json({ ok: true, metrics: metrics.rows[0] || {}, letters: letters.rows, templates: templates.rows, broadcasts: broadcasts.rows })
  } catch (error) {
    next(error)
  }
})

router.get('/letters', async (req, res, next) => {
  if (unavailable(res)) return
  try {
    const status = String(req.query.status || '').trim()
    const search = String(req.query.search || '').trim()
    const result = await pool.query(
      `SELECT ld.*, (SELECT COUNT(*)::int FROM letter_versions WHERE letter_id = ld.id) AS version_count FROM letter_documents ld WHERE ($1 = '' OR ld.status = $1) AND ($2 = '' OR ld.title ILIKE '%' || $2 || '%' OR ld.subject ILIKE '%' || $2 || '%') ORDER BY ld.updated_at DESC LIMIT 100`,
      [status, search],
    )
    res.json({ ok: true, letters: result.rows })
  } catch (error) {
    next(error)
  }
})

router.post('/letters', async (req, res, next) => {
  if (unavailable(res)) return
  const parsed = createLetterSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: issue(parsed, 'Invalid letter details.') })
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    let design = normalizeDesign({ blocks: [createLetterBlock('heading'), createLetterBlock('text'), createLetterBlock('signature'), createLetterBlock('unsubscribe')] })
    let subject = parsed.data.subject
    let previewText = parsed.data.previewText
    if (parsed.data.templateId) {
      const template = await db.query(`SELECT * FROM letter_templates WHERE id = $1 AND status = 'active'`, [parsed.data.templateId])
      if (!template.rows[0]) {
        await db.query('ROLLBACK')
        return res.status(404).json({ ok: false, error: 'Letter template not found.' })
      }
      design = normalizeDesign(template.rows[0].design)
      subject = subject || template.rows[0].subject
      previewText = previewText || template.rows[0].preview_text
    }
    const result = await db.query(
      `INSERT INTO letter_documents (title, subject, preview_text, design, template_source_id, created_by_user_id, updated_by_user_id) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $6) RETURNING *`,
      [parsed.data.title, subject, previewText, JSON.stringify(design), parsed.data.templateId || null, req.user.id],
    )
    const letter = result.rows[0]
    await db.query(`INSERT INTO letter_versions (letter_id, revision, snapshot, reason, created_by_user_id) VALUES ($1, 0, $2::jsonb, 'manual', $3)`, [letter.id, JSON.stringify(letterSnapshot(letter)), req.user.id])
    await writeAudit(db, req, 'letter_created', 'letter_documents', letter.id, { title: letter.title, templateId: parsed.data.templateId || null })
    await db.query('COMMIT')
    res.status(201).json({ ok: true, letter })
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    next(error)
  } finally {
    db.release()
  }
})

router.get('/letters/:letterId', async (req, res, next) => {
  if (unavailable(res)) return
  try {
    const letter = await getLetter(req.params.letterId)
    if (!letter) return res.status(404).json({ ok: false, error: 'Letter not found.' })
    res.json({ ok: true, letter })
  } catch (error) {
    next(error)
  }
})

router.patch('/letters/:letterId', async (req, res, next) => {
  if (unavailable(res)) return
  const parsed = saveLetterSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: issue(parsed, 'Invalid letter update.') })
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const currentResult = await db.query(`SELECT * FROM letter_documents WHERE id = $1 FOR UPDATE`, [req.params.letterId])
    const current = currentResult.rows[0]
    if (!current) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Letter not found.' })
    }
    if (current.status === 'archived') {
      await db.query('ROLLBACK')
      return res.status(409).json({ ok: false, error: 'Archived letters are read-only. Restore or duplicate the letter to continue editing.' })
    }
    if (parsed.data.baseRevision !== undefined && parsed.data.baseRevision !== current.autosave_revision) {
      await db.query('ROLLBACK')
      return res.status(409).json({ ok: false, code: 'LETTER_REVISION_CONFLICT', error: 'A newer draft is already saved. Reload it before continuing.', letter: current })
    }
    const revision = current.autosave_revision + 1
    const design = parsed.data.design === undefined ? current.design : normalizeDesign(parsed.data.design)
    const audienceFilter = parsed.data.audienceFilter === undefined ? current.audience_filter : normalizeAudienceFilter(parsed.data.audienceFilter)
    const updated = await db.query(
      `UPDATE letter_documents SET title = $2, subject = $3, preview_text = $4, design = $5::jsonb, audience_filter = $6::jsonb, autosave_revision = $7, last_saved_at = now(), updated_by_user_id = $8, updated_at = now() WHERE id = $1 RETURNING *`,
      [current.id, parsed.data.title ?? current.title, parsed.data.subject ?? current.subject, parsed.data.previewText ?? current.preview_text, JSON.stringify(design), JSON.stringify(audienceFilter), revision, req.user.id],
    )
    const letter = updated.rows[0]
    await db.query(
      `INSERT INTO letter_versions (letter_id, revision, snapshot, reason, created_by_user_id) VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [letter.id, revision, JSON.stringify(letterSnapshot(letter)), parsed.data.saveReason, req.user.id],
    )
    await db.query(`DELETE FROM letter_versions WHERE letter_id = $1 AND id NOT IN (SELECT id FROM letter_versions WHERE letter_id = $1 ORDER BY revision DESC LIMIT 100)`, [letter.id])
    if (parsed.data.saveReason === 'manual') await writeAudit(db, req, 'letter_saved', 'letter_documents', letter.id, { revision })
    await db.query('COMMIT')
    res.json({ ok: true, letter, saveState: 'saved' })
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    next(error)
  } finally {
    db.release()
  }
})

router.post('/letters/:letterId/duplicate', async (req, res, next) => {
  if (unavailable(res)) return
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const original = await getLetter(req.params.letterId, db)
    if (!original) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Letter not found.' })
    }
    const result = await db.query(
      `INSERT INTO letter_documents (title, subject, preview_text, design, audience_filter, created_by_user_id, updated_by_user_id) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $6) RETURNING *`,
      [`${original.title} — Copy`, original.subject, original.preview_text, JSON.stringify(original.design), JSON.stringify(original.audience_filter), req.user.id],
    )
    const letter = result.rows[0]
    await db.query(`INSERT INTO letter_versions (letter_id, revision, snapshot, reason, created_by_user_id) VALUES ($1, 0, $2::jsonb, 'manual', $3)`, [letter.id, JSON.stringify(letterSnapshot(letter)), req.user.id])
    await writeAudit(db, req, 'letter_duplicated', 'letter_documents', letter.id, { sourceLetterId: original.id })
    await db.query('COMMIT')
    res.status(201).json({ ok: true, letter })
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    next(error)
  } finally {
    db.release()
  }
})

router.get('/letters/:letterId/versions', async (req, res, next) => {
  if (unavailable(res)) return
  try {
    const result = await pool.query(`SELECT id, letter_id, revision, reason, created_by_user_id, created_at FROM letter_versions WHERE letter_id = $1 ORDER BY revision DESC LIMIT 100`, [req.params.letterId])
    res.json({ ok: true, versions: result.rows })
  } catch (error) {
    next(error)
  }
})

router.post('/letters/:letterId/versions/:versionId/restore', async (req, res, next) => {
  if (unavailable(res)) return
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const currentResult = await db.query(`SELECT * FROM letter_documents WHERE id = $1 FOR UPDATE`, [req.params.letterId])
    const versionResult = await db.query(`SELECT * FROM letter_versions WHERE id = $1 AND letter_id = $2`, [req.params.versionId, req.params.letterId])
    const current = currentResult.rows[0]
    const version = versionResult.rows[0]
    if (!current || !version) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Letter version not found.' })
    }
    if (current.status === 'archived') {
      await db.query('ROLLBACK')
      return res.status(409).json({ ok: false, error: 'Archived letters are read-only.' })
    }
    const revision = current.autosave_revision + 1
    const snapshot = version.snapshot
    const updated = await db.query(
      `UPDATE letter_documents SET title = $2, subject = $3, preview_text = $4, design = $5::jsonb, audience_filter = $6::jsonb, autosave_revision = $7, last_saved_at = now(), updated_by_user_id = $8, updated_at = now() WHERE id = $1 RETURNING *`,
      [current.id, snapshot.title, snapshot.subject, snapshot.previewText, JSON.stringify(normalizeDesign(snapshot.design)), JSON.stringify(normalizeAudienceFilter(snapshot.audienceFilter)), revision, req.user.id],
    )
    const letter = updated.rows[0]
    await db.query(`INSERT INTO letter_versions (letter_id, revision, snapshot, reason, created_by_user_id) VALUES ($1, $2, $3::jsonb, 'restored', $4)`, [letter.id, revision, JSON.stringify(letterSnapshot(letter)), req.user.id])
    await writeAudit(db, req, 'letter_version_restored', 'letter_documents', letter.id, { restoredVersionId: version.id, revision })
    await db.query('COMMIT')
    res.json({ ok: true, letter })
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    next(error)
  } finally {
    db.release()
  }
})

router.post('/letters/:letterId/preview', async (req, res, next) => {
  if (unavailable(res)) return
  try {
    const letter = await getLetter(req.params.letterId)
    if (!letter) return res.status(404).json({ ok: false, error: 'Letter not found.' })
    const validation = validateLetter({ title: letter.title, subject: letter.subject, design: letter.design })
    const rendered = renderLetter({
      design: validation.design,
      subject: letter.subject,
      previewText: letter.preview_text,
      variables: { firstName: 'Kim', lastName: '', email: 'preview@powerwithinmovement.com' },
      unsubscribeUrl: '#unsubscribe-preview',
    })
    res.json({ ok: true, validation, html: rendered.html, text: rendered.text })
  } catch (error) {
    next(error)
  }
})

router.post('/render-preview', async (req, res) => {
  const parsed = renderPreviewSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: issue(parsed, 'The letter preview is invalid.') })
  const validation = validateLetter(parsed.data)
  const rendered = renderLetter({
    design: validation.design,
    subject: parsed.data.subject,
    previewText: parsed.data.previewText,
    variables: { firstName: 'Kim', lastName: '', email: 'preview@powerwithinmovement.com' },
    unsubscribeUrl: '#unsubscribe-preview',
  })
  res.json({ ok: true, validation, html: rendered.html, text: rendered.text })
})

router.post('/letters/:letterId/test-send', async (req, res, _next) => {
  if (unavailable(res)) return
  const parsed = testSendSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: issue(parsed, 'A valid test email is required.') })
  try {
    assertProviderConfigured()
    await assertOutgoingEmailAvailable(pool)
    const letter = await getLetter(req.params.letterId)
    if (!letter) return res.status(404).json({ ok: false, error: 'Letter not found.' })
    const validation = validateLetter({ title: letter.title, subject: letter.subject, design: letter.design })
    if (!validation.ok) return res.status(400).json({ ok: false, error: validation.errors.join(' '), validation })
    const logged = await pool.query(`INSERT INTO letter_test_sends (letter_id, email_to, sent_by_user_id) VALUES ($1, $2, $3) RETURNING *`, [letter.id, parsed.data.email, req.user.id])
    const testSend = logged.rows[0]
    try {
      const rendered = renderLetter({ design: letter.design, subject: letter.subject, previewText: letter.preview_text, variables: { firstName: 'Friend', lastName: '', email: parsed.data.email }, unsubscribeUrl: `${letterPublicBaseUrl()}/test-unsubscribe` })
      const provider = await sendLetterEmail({ to: parsed.data.email, subject: `[TEST] ${letter.subject}`, html: rendered.html, text: rendered.text })
      const sent = await pool.query(`UPDATE letter_test_sends SET status = 'sent', provider_message_id = $2, provider_response = $3::jsonb, sent_at = now() WHERE id = $1 RETURNING *`, [testSend.id, provider?.id || null, JSON.stringify(provider || {})])
      await writeAudit(pool, req, 'letter_test_sent', 'letter_documents', letter.id, { email: parsed.data.email, testSendId: testSend.id })
      return res.json({ ok: true, message: 'Test letter sent.', testSend: sent.rows[0], warnings: validation.warnings })
    } catch (error) {
      await pool.query(`UPDATE letter_test_sends SET status = 'failed', provider_response = $2::jsonb, error_message = $3 WHERE id = $1`, [testSend.id, JSON.stringify(error.providerData || {}), error.message])
      throw error
    }
  } catch (error) {
    res.status(error.statusCode || 500).json({ ok: false, code: error.code, error: error.message || 'Test letter could not be sent.' })
  }
})

router.get('/templates', async (req, res, next) => {
  if (unavailable(res)) return
  try {
    const result = await pool.query(`SELECT * FROM letter_templates WHERE ($1 = 'all' OR status = $1) ORDER BY updated_at DESC LIMIT 100`, [String(req.query.status || 'active')])
    res.json({ ok: true, templates: result.rows })
  } catch (error) {
    next(error)
  }
})

router.post('/templates', async (req, res, next) => {
  if (unavailable(res)) return
  const parsed = templateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: issue(parsed, 'Invalid letter template.') })
  try {
    const result = await pool.query(
      `INSERT INTO letter_templates (name, description, category, subject, preview_text, design, status, created_by_user_id, updated_by_user_id) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $8) RETURNING *`,
      [parsed.data.name, parsed.data.description, parsed.data.category, parsed.data.subject, parsed.data.previewText, JSON.stringify(normalizeDesign(parsed.data.design)), parsed.data.status, req.user.id],
    )
    await writeAudit(pool, req, 'letter_template_created', 'letter_templates', result.rows[0].id, { name: result.rows[0].name })
    res.status(201).json({ ok: true, template: result.rows[0] })
  } catch (error) {
    next(error)
  }
})

router.post('/letters/:letterId/save-template', async (req, res, next) => {
  if (unavailable(res)) return
  const name = String(req.body.name || '').trim()
  if (!name) return res.status(400).json({ ok: false, error: 'Template name is required.' })
  try {
    const letter = await getLetter(req.params.letterId)
    if (!letter) return res.status(404).json({ ok: false, error: 'Letter not found.' })
    const result = await pool.query(`INSERT INTO letter_templates (name, description, category, subject, preview_text, design, created_by_user_id, updated_by_user_id) VALUES ($1, $2, 'newsletter', $3, $4, $5::jsonb, $6, $6) RETURNING *`, [name.slice(0, 180), String(req.body.description || '').slice(0, 1000), letter.subject, letter.preview_text, JSON.stringify(letter.design), req.user.id])
    await writeAudit(pool, req, 'letter_saved_as_template', 'letter_templates', result.rows[0].id, { letterId: letter.id, name })
    res.status(201).json({ ok: true, template: result.rows[0] })
  } catch (error) {
    next(error)
  }
})

router.post('/audience-preview', async (req, res, next) => {
  if (unavailable(res)) return
  const parsed = audienceFilterSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: issue(parsed, 'Invalid audience filters.') })
  try {
    const preview = await previewLetterAudience(pool, parsed.data)
    res.json({ ok: true, ...preview, protections: ['explicit_consent', 'unsubscribe', 'bounce', 'complaint', 'suppression', 'pre_send_recheck'] })
  } catch (error) {
    next(error)
  }
})

router.post('/letters/:letterId/broadcasts/prepare', async (req, res, next) => {
  if (unavailable(res)) return
  const parsed = audienceFilterSchema.safeParse(req.body.audienceFilter || req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: issue(parsed, 'Invalid recipient selection.') })
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const letterResult = await db.query(`SELECT * FROM letter_documents WHERE id = $1 FOR UPDATE`, [req.params.letterId])
    const letter = letterResult.rows[0]
    if (!letter) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Letter not found.' })
    }
    if (letter.status === 'archived') {
      await db.query('ROLLBACK')
      return res.status(409).json({ ok: false, error: 'Archived letters cannot prepare a broadcast. Restore or duplicate the letter first.' })
    }
    const validation = validateLetter({ title: letter.title, subject: letter.subject, design: letter.design })
    if (!validation.ok) {
      await db.query('ROLLBACK')
      return res.status(400).json({ ok: false, error: validation.errors.join(' '), validation })
    }
    const previous = await db.query(`SELECT id FROM letter_broadcasts WHERE letter_id = $1 AND status = 'draft' ORDER BY created_at DESC LIMIT 1`, [letter.id])
    let broadcastId = previous.rows[0]?.id
    if (broadcastId) {
      await db.query(`DELETE FROM letter_broadcast_recipients WHERE broadcast_id = $1`, [broadcastId])
      await db.query(`DELETE FROM letter_tracking_links WHERE broadcast_id = $1`, [broadcastId])
    } else {
      const created = await db.query(`INSERT INTO letter_broadcasts (letter_id, audience_snapshot, created_by_user_id) VALUES ($1, $2::jsonb, $3) RETURNING id`, [letter.id, JSON.stringify(normalizeAudienceFilter(parsed.data)), req.user.id])
      broadcastId = created.rows[0].id
    }
    await db.query(
      `UPDATE letter_broadcasts SET title_snapshot = $2, subject_snapshot = $3, preview_text_snapshot = $4, design_snapshot = $5::jsonb, updated_at = now() WHERE id = $1`,
      [broadcastId, letter.title, letter.subject, letter.preview_text, JSON.stringify(normalizeDesign(letter.design))],
    )
    await db.query(`UPDATE letter_documents SET audience_filter = $2::jsonb, updated_by_user_id = $3, updated_at = now() WHERE id = $1`, [letter.id, JSON.stringify(normalizeAudienceFilter(parsed.data)), req.user.id])
    await snapshotBroadcastRecipients(db, broadcastId, parsed.data)
    const broadcastResult = await db.query(`SELECT * FROM letter_broadcasts WHERE id = $1`, [broadcastId])
    const broadcast = broadcastResult.rows[0]
    if (!broadcast.recipient_count) {
      await db.query('ROLLBACK')
      return res.status(400).json({ ok: false, error: 'No eligible recipients match this audience. Consent and suppression protections remain enforced.' })
    }
    await db.query(
      `INSERT INTO letter_versions (letter_id, revision, snapshot, reason, created_by_user_id) VALUES ($1, $2, $3::jsonb, 'pre_send', $4) ON CONFLICT (letter_id, revision) DO UPDATE SET reason = 'pre_send'`,
      [letter.id, letter.autosave_revision, JSON.stringify(letterSnapshot(letter)), req.user.id],
    )
    await writeAudit(db, req, 'letter_broadcast_prepared', 'letter_broadcasts', broadcast.id, { letterId: letter.id, recipientCount: broadcast.recipient_count, audienceFilter: parsed.data })
    await db.query('COMMIT')
    res.status(201).json({ ok: true, broadcast, validation })
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    next(error)
  } finally {
    db.release()
  }
})

router.get('/broadcasts', async (req, res, next) => {
  if (unavailable(res)) return
  try {
    const status = String(req.query.status || '').trim()
    const result = await pool.query(`SELECT lb.*, COALESCE(NULLIF(lb.title_snapshot, ''), ld.title) AS title, COALESCE(NULLIF(lb.subject_snapshot, ''), ld.subject) AS subject, COALESCE(NULLIF(lb.preview_text_snapshot, ''), ld.preview_text) AS preview_text FROM letter_broadcasts lb JOIN letter_documents ld ON ld.id = lb.letter_id WHERE ($1 = '' OR lb.status = $1) ORDER BY COALESCE(lb.scheduled_at, lb.created_at) DESC LIMIT 100`, [status])
    res.json({ ok: true, broadcasts: result.rows })
  } catch (error) {
    next(error)
  }
})

router.get('/broadcasts/:broadcastId', async (req, res, next) => {
  if (unavailable(res)) return
  try {
    const detail = await getBroadcastDetail(req.params.broadcastId)
    if (!detail) return res.status(404).json({ ok: false, error: 'Broadcast not found.' })
    res.json({ ok: true, ...detail })
  } catch (error) {
    next(error)
  }
})

router.post('/broadcasts/:broadcastId/schedule', async (req, res, _next) => {
  if (unavailable(res)) return
  const parsed = scheduleSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: issue(parsed, 'A valid schedule time is required.') })
  try {
    assertProviderConfigured()
    const scheduledAt = new Date(parsed.data.scheduledAt)
    if (scheduledAt <= new Date(Date.now() + 60_000)) return res.status(400).json({ ok: false, error: 'Schedule the broadcast at least one minute in the future.' })
    if (scheduledAt > new Date(Date.now() + 366 * 24 * 60 * 60 * 1000)) return res.status(400).json({ ok: false, error: 'Broadcasts may be scheduled up to one year ahead.' })
    const result = await pool.query(`UPDATE letter_broadcasts SET status = 'scheduled', scheduled_at = $2, updated_at = now() WHERE id = $1 AND status = 'draft' RETURNING *`, [req.params.broadcastId, scheduledAt.toISOString()])
    const broadcast = result.rows[0]
    if (!broadcast) return res.status(409).json({ ok: false, error: 'Only prepared draft broadcasts can be scheduled.' })
    await writeAudit(pool, req, 'letter_broadcast_scheduled', 'letter_broadcasts', broadcast.id, { scheduledAt: broadcast.scheduled_at, recipientCount: broadcast.recipient_count })
    res.json({ ok: true, broadcast })
  } catch (error) {
    res.status(error.statusCode || 500).json({ ok: false, code: error.code, error: error.message })
  }
})

router.post('/broadcasts/:broadcastId/send-now', async (req, res) => {
  if (unavailable(res)) return
  try {
    const broadcast = await processLetterBroadcast(pool, req.params.broadcastId)
    await writeAudit(pool, req, 'letter_broadcast_sent', 'letter_broadcasts', broadcast.id, { status: broadcast.status, recipientCount: broadcast.recipient_count, sentCount: broadcast.sent_count })
    res.json({ ok: true, broadcast })
  } catch (error) {
    res.status(error.statusCode || 500).json({ ok: false, code: error.code, error: error.message || 'Broadcast could not be sent.' })
  }
})

router.post('/broadcasts/:broadcastId/cancel', async (req, res, next) => {
  if (unavailable(res)) return
  try {
    const result = await pool.query(`UPDATE letter_broadcasts SET status = 'cancelled', updated_at = now() WHERE id = $1 AND status IN ('draft', 'scheduled', 'failed') RETURNING *`, [req.params.broadcastId])
    const broadcast = result.rows[0]
    if (!broadcast) return res.status(409).json({ ok: false, error: 'Only draft, scheduled, or failed broadcasts can be cancelled.' })
    await writeAudit(pool, req, 'letter_broadcast_cancelled', 'letter_broadcasts', broadcast.id, { letterId: broadcast.letter_id })
    res.json({ ok: true, broadcast })
  } catch (error) {
    next(error)
  }
})

router.post('/process-due', async (req, res) => {
  if (unavailable(res)) return
  if (req.user?.role !== 'developer') {
    return res.status(403).json({ ok: false, error: 'Manual broadcast processing requires the developer account.' })
  }
  try {
    const result = await processDueLetterBroadcasts(pool)
    res.json({ ok: true, ...result })
  } catch (error) {
    res.status(error.statusCode || 500).json({ ok: false, code: error.code, error: error.message })
  }
})

router.get('/broadcasts/:broadcastId/export.csv', async (req, res, next) => {
  if (unavailable(res)) return
  try {
    const detail = await getBroadcastDetail(req.params.broadcastId)
    if (!detail) return res.status(404).json({ ok: false, error: 'Broadcast not found.' })
    const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const lines = [
      ['email', 'first_name', 'last_name', 'status', 'sent_at', 'delivered_at', 'first_opened_at', 'first_clicked_at', 'error'].join(','),
      ...detail.recipients.map((row) => [row.email, row.first_name, row.last_name, row.delivery_status, row.sent_at, row.delivered_at, row.first_opened_at, row.first_clicked_at, row.error_message].map(quote).join(',')),
    ]
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="letter-results-${detail.broadcast.id}.csv"`)
    res.send(`\uFEFF${lines.join('\r\n')}`)
  } catch (error) {
    next(error)
  }
})

module.exports = router
