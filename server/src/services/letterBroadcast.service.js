const { env } = require('../config/env')
const { recipientReplyTo } = require('./inboundEmail.service')
const { getPlatformSettings } = require('./platformSettings.service')
const {
  collectTrackedLinks,
  encodeSignedToken,
  renderLetter,
  validateLetter,
} = require('./letterBuilder.service')

const DISPATCH_INTERVAL_MS = 60_000
const STALE_PROCESSING_MINUTES = 15
const TRACKING_TTL_SECONDS = 365 * 24 * 60 * 60
const ASSET_TTL_SECONDS = 180 * 24 * 60 * 60

function letterPublicBaseUrl() {
  return `${String(env.publicApiUrl || env.publicSiteUrl || '').replace(/\/$/, '')}/api/public/letters`
}

function normalizeAudienceFilter(input = {}) {
  const mode = ['all', 'filtered', 'selected'].includes(input.mode) ? input.mode : 'all'
  return {
    mode,
    tag: mode === 'filtered' ? String(input.tag || '').trim().slice(0, 60) : '',
    segment: mode === 'filtered' ? String(input.segment || '').trim().slice(0, 60) : '',
    source: mode === 'filtered' ? String(input.source || '').trim().slice(0, 120) : '',
    subscriberIds: mode === 'selected' && Array.isArray(input.subscriberIds)
      ? [...new Set(input.subscriberIds.filter((value) => /^[0-9a-f-]{36}$/i.test(String(value))))].slice(0, 5000)
      : [],
  }
}

function audienceFilterSql(input = {}) {
  const filter = normalizeAudienceFilter(input)
  const values = []
  const clauses = [
    `s.status = 'subscribed'`,
    `s.consent_status = 'granted'`,
    `NOT EXISTS (SELECT 1 FROM newsletter_suppressions sup WHERE sup.email = s.email AND sup.active = true)`,
  ]
  const add = (value) => {
    values.push(value)
    return `$${values.length}`
  }
  if (filter.tag) {
    const token = add(filter.tag)
    clauses.push(`EXISTS (SELECT 1 FROM subscriber_tag_links stl JOIN email_tags et ON et.id = stl.email_tag_id WHERE stl.subscriber_id = s.id AND lower(et.name) = lower(${token}))`)
  }
  if (filter.segment) {
    const token = add(filter.segment)
    clauses.push(`EXISTS (SELECT 1 FROM newsletter_segment_members nsm JOIN newsletter_segments ns ON ns.id = nsm.segment_id WHERE nsm.subscriber_id = s.id AND ns.archived_at IS NULL AND lower(ns.name) = lower(${token}))`)
  }
  if (filter.source) clauses.push(`s.source = ${add(filter.source)}`)
  if (filter.mode === 'selected') {
    if (!filter.subscriberIds.length) clauses.push('false')
    else clauses.push(`s.id = ANY(${add(filter.subscriberIds)}::uuid[])`)
  }
  return { filter, where: clauses.join(' AND '), values }
}

async function previewLetterAudience(db, audienceFilter) {
  const { filter, where, values } = audienceFilterSql(audienceFilter)
  const result = await db.query(`SELECT COUNT(*)::int AS eligible FROM subscribers s WHERE ${where}`, values)
  return { filter, eligible: result.rows[0]?.eligible || 0 }
}

async function snapshotBroadcastRecipients(db, broadcastId, audienceFilter) {
  const { filter, where, values } = audienceFilterSql(audienceFilter)
  const result = await db.query(
    `
    INSERT INTO letter_broadcast_recipients (
      broadcast_id,
      subscriber_id,
      email,
      personalization,
      reply_alias
    )
    SELECT $${values.length + 1}, s.id, s.email,
      jsonb_build_object(
        'firstName', COALESCE(s.first_name, ''),
        'lastName', COALESCE(s.last_name, ''),
        'email', s.email,
        'subscriberId', s.id
      ),
      lower(replace(gen_random_uuid()::text, '-', ''))
    FROM subscribers s
    WHERE ${where}
    ON CONFLICT (broadcast_id, subscriber_id) DO NOTHING
    RETURNING id
    `,
    [...values, broadcastId],
  )
  await db.query(
    `
    UPDATE letter_broadcast_recipients
    SET reply_alias = lower(replace(gen_random_uuid()::text, '-', '')),
        updated_at = now()
    WHERE broadcast_id = $1
      AND reply_alias IS NULL
    `,
    [broadcastId],
  )
  await db.query(
    `UPDATE letter_broadcasts SET audience_snapshot = $2::jsonb, recipient_count = (SELECT COUNT(*)::int FROM letter_broadcast_recipients WHERE broadcast_id = $1), updated_at = now() WHERE id = $1`,
    [broadcastId, JSON.stringify(filter)],
  )
  return result.rowCount
}

async function ensureTrackingLinks(db, broadcast) {
  const links = collectTrackedLinks(broadcast.design)
  for (const link of links) {
    await db.query(
      `
      INSERT INTO letter_tracking_links (broadcast_id, letter_id, block_id, label, destination_url)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (broadcast_id, block_id, destination_url)
      DO UPDATE SET label = EXCLUDED.label, updated_at = now()
      `,
      [broadcast.id, broadcast.letter_id, link.blockId, link.label, link.destinationUrl],
    )
  }
  const result = await db.query(`SELECT * FROM letter_tracking_links WHERE broadcast_id = $1`, [broadcast.id])
  return result.rows
}

function providerConfiguration() {
  return {
    apiKey: String(env.resendApiKey || '').trim(),
    from: String(env.newsletterEmailFrom || env.portalEmailFrom || '').trim(),
    replyTo: String(env.newsletterReplyTo || '').trim(),
    receivingDomain: String(env.newsletterReceivingDomain || '').trim().toLowerCase(),
  }
}


function assertProviderConfigured() {
  const config = providerConfiguration()
  if (!config.apiKey || !config.from) {
    const error = new Error('Newsletter delivery is not configured. Add RESEND_API_KEY and NEWSLETTER_EMAIL_FROM to server/.env.')
    error.statusCode = 409
    error.code = 'LETTER_PROVIDER_NOT_CONFIGURED'
    throw error
  }
  return config
}

async function assertOutgoingEmailAvailable(db) {
  const settings = await getPlatformSettings(db)
  if (settings.maintenanceMode || settings.outgoingEmailPaused) {
    const error = new Error(settings.maintenanceMode ? settings.maintenanceMessage : 'Outgoing email is temporarily paused by the developer.')
    error.statusCode = 503
    error.code = 'OUTGOING_EMAIL_PAUSED'
    throw error
  }
}

async function sendLetterEmail({
  to,
  subject,
  html,
  text,
  headers = {},
  idempotencyKey = '',
  replyTo = '',
}) {
  const config = assertProviderConfigured()
  const resolvedReplyTo = String(replyTo || config.replyTo || '').trim()
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      subject,
      html,
      text,
      ...(resolvedReplyTo ? { reply_to: resolvedReplyTo } : {}),
      ...(Object.keys(headers).length ? { headers } : {}),
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || 'Email provider rejected the letter.')
    const retryAfterSeconds = Number(response.headers.get('retry-after'))
    error.statusCode = 502
    error.providerStatus = response.status
    error.retryAfterMs = Number.isFinite(retryAfterSeconds)
      ? Math.min(Math.max(retryAfterSeconds * 1000, 500), 10_000)
      : 1000
    error.providerData = data
    throw error
  }
  return data
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function sendLetterEmailWithRateLimitRetry(message) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await sendLetterEmail(message)
    } catch (error) {
      if (error.providerStatus !== 429 || attempt === 2) throw error
      await wait(error.retryAfterMs)
    }
  }
  throw new Error('Email provider retry limit reached.')
}

async function logRecipientEvent(db, {
  broadcastId,
  recipientId,
  subscriberId,
  eventType,
  linkId = null,
  providerEventId = null,
  metadata = {},
  occurredAt = null,
}) {
  const result = await db.query(
    `
    INSERT INTO letter_events (
      broadcast_id, recipient_id, subscriber_id, link_id, event_type,
      provider_event_id, metadata, occurred_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, COALESCE($8, now()))
    ON CONFLICT (provider_event_id) WHERE provider_event_id IS NOT NULL DO NOTHING
    RETURNING id
    `,
    [broadcastId, recipientId, subscriberId, linkId, eventType, providerEventId, JSON.stringify(metadata), occurredAt],
  )
  return result.rows[0] || null
}

async function refreshBroadcastAnalytics(db, broadcastId) {
  const result = await db.query(
    `
    WITH recipient_counts AS (
      SELECT
        COUNT(*)::int AS recipient_count,
        COUNT(*) FILTER (WHERE sent_at IS NOT NULL)::int AS sent_count,
        COUNT(*) FILTER (WHERE delivery_status = 'bounced')::int AS bounced_count,
        COUNT(*) FILTER (WHERE delivery_status = 'complained')::int AS complained_count,
        COUNT(*) FILTER (WHERE delivery_status = 'unsubscribed')::int AS unsubscribed_count,
        COUNT(*) FILTER (WHERE delivery_status = 'failed')::int AS failed_count,
        COUNT(*) FILTER (WHERE delivery_status = 'skipped')::int AS skipped_count
      FROM letter_broadcast_recipients WHERE broadcast_id = $1
    ), event_counts AS (
      SELECT
        COUNT(DISTINCT recipient_id) FILTER (WHERE event_type IN ('delivered', 'opened', 'clicked'))::int AS delivered_count,
        COUNT(DISTINCT recipient_id) FILTER (WHERE event_type = 'opened')::int AS opened_count,
        COUNT(DISTINCT recipient_id) FILTER (WHERE event_type = 'clicked')::int AS clicked_count
      FROM letter_events WHERE broadcast_id = $1
    )
    UPDATE letter_broadcasts lb SET
      recipient_count = rc.recipient_count,
      sent_count = rc.sent_count,
      delivered_count = ec.delivered_count,
      opened_count = ec.opened_count,
      clicked_count = ec.clicked_count,
      bounced_count = rc.bounced_count,
      complained_count = rc.complained_count,
      unsubscribed_count = rc.unsubscribed_count,
      failed_count = rc.failed_count,
      skipped_count = rc.skipped_count,
      updated_at = now()
    FROM recipient_counts rc, event_counts ec
    WHERE lb.id = $1 RETURNING lb.*
    `,
    [broadcastId],
  )
  return result.rows[0]
}

function recipientUrls({ recipient, links }) {
  const base = letterPublicBaseUrl()
  const secret = env.letterSigningSecret
  const unsubscribeToken = encodeSignedToken('unsubscribe', {
    subscriberId: recipient.subscriber_id,
    recipientId: recipient.id,
    broadcastId: recipient.broadcast_id,
  }, secret)
  const openToken = encodeSignedToken('open', { recipientId: recipient.id, broadcastId: recipient.broadcast_id }, secret, TRACKING_TTL_SECONDS)
  const trackingUrls = Object.fromEntries(links.map((link) => [
    link.block_id,
    `${base}/click/${encodeSignedToken('click', { recipientId: recipient.id, broadcastId: recipient.broadcast_id, linkId: link.id }, secret, TRACKING_TTL_SECONDS)}`,
  ]))
  return {
    unsubscribeUrl: `${base}/unsubscribe/${unsubscribeToken}`,
    oneClickUnsubscribeUrl: `${base}/unsubscribe/${unsubscribeToken}`,
    openPixelUrl: `${base}/open/${openToken}.gif`,
    trackingUrls,
    assetUrl(assetId, block) {
      if (!assetId) return ''
      const token = encodeSignedToken('asset', {
        recipientId: recipient.id,
        broadcastId: recipient.broadcast_id,
        assetId,
        disposition: block.type === 'resource' ? 'attachment' : 'inline',
      }, secret, ASSET_TTL_SECONDS)
      return `${base}/assets/${token}`
    },
  }
}

async function markRecipientSkipped(db, recipient, reason) {
  await db.query(
    `UPDATE letter_broadcast_recipients SET delivery_status = 'skipped', skip_reason = $2, updated_at = now() WHERE id = $1`,
    [recipient.id, reason],
  )
  await logRecipientEvent(db, { broadcastId: recipient.broadcast_id, recipientId: recipient.id, subscriberId: recipient.subscriber_id, eventType: 'skipped', metadata: { reason } })
  await db.query(
    `INSERT INTO newsletter_send_history (subscriber_id, email_to, subject, delivery_status, metadata) VALUES ($1, $2, $3, 'skipped', $4::jsonb)`,
    [recipient.subscriber_id, recipient.email, recipient.subject, JSON.stringify({ broadcastId: recipient.broadcast_id, reason })],
  )
}

async function sendBroadcastRecipient(db, broadcast, recipient, links) {
  const eligibility = await db.query(
    `
    SELECT s.* FROM subscribers s
    WHERE s.id = $1 AND s.status = 'subscribed' AND s.consent_status = 'granted'
      AND NOT EXISTS (SELECT 1 FROM newsletter_suppressions sup WHERE sup.email = s.email AND sup.active = true)
    LIMIT 1
    `,
    [recipient.subscriber_id],
  )
  const subscriber = eligibility.rows[0]
  if (!subscriber) {
    await markRecipientSkipped(db, recipient, 'recipient_no_longer_eligible')
    return { status: 'skipped' }
  }

  const variables = {
    firstName: subscriber.first_name || '',
    lastName: subscriber.last_name || '',
    email: subscriber.email,
  }
  const urls = recipientUrls({ recipient, links })
  const rendered = renderLetter({
    design: broadcast.design,
    subject: broadcast.subject,
    previewText: broadcast.preview_text,
    variables,
    ...urls,
  })
  const subject = String(broadcast.subject || '').replace(/\{\{\s*firstName\s*\}\}/g, variables.firstName)

  try {
    const providerData = await sendLetterEmailWithRateLimitRetry({
      to: recipient.email,
      subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: `pwc-letter-${recipient.id}`,
      replyTo: recipientReplyTo(recipient),
      headers: {
        'List-Unsubscribe': `<${urls.oneClickUnsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
    await db.query(
      `
      UPDATE letter_broadcast_recipients SET delivery_status = 'sent', provider_message_id = $2,
        provider_response = $3::jsonb, sent_at = now(), updated_at = now()
      WHERE id = $1
      `,
      [recipient.id, providerData?.id || null, JSON.stringify(providerData || {})],
    )
    await logRecipientEvent(db, { broadcastId: broadcast.id, recipientId: recipient.id, subscriberId: recipient.subscriber_id, eventType: 'sent', metadata: { providerMessageId: providerData?.id || null } })
    await db.query(
      `INSERT INTO newsletter_send_history (subscriber_id, email_to, subject, delivery_status, provider, provider_message_id, sent_at, metadata) VALUES ($1, $2, $3, 'sent', 'resend', $4, now(), $5::jsonb)`,
      [recipient.subscriber_id, recipient.email, subject, providerData?.id || null, JSON.stringify({ broadcastId: broadcast.id, letterId: broadcast.letter_id })],
    )
    return { status: 'sent' }
  } catch (error) {
    await db.query(
      `UPDATE letter_broadcast_recipients SET delivery_status = 'failed', error_message = $2, provider_response = $3::jsonb, updated_at = now() WHERE id = $1`,
      [recipient.id, error.message, JSON.stringify(error.providerData || {})],
    )
    await logRecipientEvent(db, { broadcastId: broadcast.id, recipientId: recipient.id, subscriberId: recipient.subscriber_id, eventType: 'failed', metadata: { error: error.message } })
    await db.query(
      `INSERT INTO newsletter_send_history (subscriber_id, email_to, subject, delivery_status, provider, error_message, metadata) VALUES ($1, $2, $3, 'failed', 'resend', $4, $5::jsonb)`,
      [recipient.subscriber_id, recipient.email, subject, error.message, JSON.stringify({ broadcastId: broadcast.id, letterId: broadcast.letter_id })],
    )
    return { status: 'failed', error }
  }
}

async function processLetterBroadcast(pool, broadcastId, { alreadyClaimed = false } = {}) {
  assertProviderConfigured()
  await assertOutgoingEmailAvailable(pool)
  const claim = await pool.connect()
  let broadcast
  try {
    await claim.query('BEGIN')
    const result = await claim.query(
      `
      SELECT lb.*,
        COALESCE(NULLIF(lb.subject_snapshot, ''), ld.subject) AS subject,
        COALESCE(NULLIF(lb.preview_text_snapshot, ''), ld.preview_text) AS preview_text,
        lb.design_snapshot AS design,
        COALESCE(NULLIF(lb.title_snapshot, ''), ld.title) AS title
      FROM letter_broadcasts lb JOIN letter_documents ld ON ld.id = lb.letter_id
      WHERE lb.id = $1 FOR UPDATE OF lb, ld
      `,
      [broadcastId],
    )
    broadcast = result.rows[0]
    if (!broadcast) throw Object.assign(new Error('Broadcast not found.'), { statusCode: 404 })
    const processable = ['draft', 'scheduled', 'failed'].includes(broadcast.status)
      || (alreadyClaimed && broadcast.status === 'processing')
    if (!processable) {
      await claim.query('ROLLBACK')
      return broadcast
    }
    const validation = validateLetter({ title: broadcast.title, subject: broadcast.subject, design: broadcast.design })
    if (!validation.ok) throw Object.assign(new Error(validation.errors.join(' ')), { statusCode: 400 })
    if (broadcast.status !== 'processing') {
      await claim.query(`UPDATE letter_broadcasts SET status = 'processing', started_at = COALESCE(started_at, now()), error_message = NULL, updated_at = now() WHERE id = $1`, [broadcastId])
    }
    await claim.query('COMMIT')
  } catch (error) {
    await claim.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    claim.release()
  }

  const links = await ensureTrackingLinks(pool, broadcast)
  const recipients = await pool.query(
    `SELECT lbr.*, $2::text AS subject FROM letter_broadcast_recipients lbr WHERE broadcast_id = $1 AND delivery_status = 'pending' ORDER BY created_at ASC`,
    [broadcastId, broadcast.subject],
  )
  const concurrency = env.letterSendConcurrency
  for (let index = 0; index < recipients.rows.length; index += concurrency) {
    const batch = recipients.rows.slice(index, index + concurrency)
    await Promise.all(batch.map((recipient) => sendBroadcastRecipient(pool, broadcast, recipient, links)))
    if (index + concurrency < recipients.rows.length && env.letterSendBatchDelayMs > 0) {
      await wait(env.letterSendBatchDelayMs)
    }
  }

  const analytics = await refreshBroadcastAnalytics(pool, broadcastId)
  const finalStatus = analytics.failed_count > 0 || analytics.skipped_count > 0 ? 'partial' : 'sent'
  const final = await pool.query(
    `UPDATE letter_broadcasts SET status = $2, completed_at = now(), updated_at = now() WHERE id = $1 RETURNING *`,
    [broadcastId, finalStatus],
  )
  return final.rows[0]
}

function buildBroadcastPreflight({
  broadcast,
  validation = { ok: false, errors: ['Letter validation was unavailable.'], warnings: [] },
  eligibleRecipients = 0,
  providerConfigured = false,
  outgoingEmailAvailable = false,
} = {}) {
  const blockers = []
  const warnings = [...(validation.warnings || [])]
  if (!broadcast) blockers.push('The prepared broadcast could not be found.')
  if (broadcast && broadcast.status !== 'draft') blockers.push('Only a prepared draft broadcast can pass final delivery review.')
  blockers.push(...(validation.errors || []))
  if (!Number(eligibleRecipients)) blockers.push('No recipients remain eligible after the consent and suppression recheck.')
  if (!providerConfigured) blockers.push('Newsletter delivery is not configured.')
  if (!outgoingEmailAvailable) blockers.push('Outgoing email is currently paused or unavailable.')
  if (broadcast && Number(broadcast.recipient_count || 0) !== Number(eligibleRecipients || 0)) {
    warnings.push(`The eligible audience changed from ${Number(broadcast.recipient_count || 0)} to ${Number(eligibleRecipients || 0)}. Prepare a fresh snapshot before delivery.`)
  }
  const ready = blockers.length === 0
  return {
    ready,
    status: ready ? (warnings.length ? 'ready_with_warnings' : 'ready') : 'blocked',
    blockers,
    warnings,
    checks: {
      content: Boolean(validation.ok),
      audience: Number(eligibleRecipients) > 0,
      provider: Boolean(providerConfigured),
      outgoingEmail: Boolean(outgoingEmailAvailable),
      snapshotFresh: Boolean(broadcast) && Number(broadcast.recipient_count || 0) === Number(eligibleRecipients || 0),
    },
    recipientCount: Number(eligibleRecipients || 0),
  }
}

async function processDueLetterBroadcasts(pool) {
  if (!providerConfiguration().apiKey || !providerConfiguration().from) return { processed: 0, skipped: 'provider_not_configured' }
  const lockClient = await pool.connect()
  try {
    const lock = await lockClient.query(`SELECT pg_try_advisory_lock(hashtext('pwc-letter-broadcast-dispatcher')) AS acquired`)
    if (!lock.rows[0]?.acquired) return { processed: 0, skipped: 'dispatcher_busy' }
    const recovered = await lockClient.query(
      `
      UPDATE letter_broadcasts
      SET status = 'scheduled', started_at = NULL,
        error_message = 'Recovered automatically after an interrupted delivery worker.',
        updated_at = now()
      WHERE status = 'processing'
        AND updated_at < now() - ($1::int * interval '1 minute')
        AND EXISTS (
          SELECT 1 FROM letter_broadcast_recipients lbr
          WHERE lbr.broadcast_id = letter_broadcasts.id
            AND lbr.delivery_status IN ('pending', 'failed')
        )
      RETURNING id
      `,
      [STALE_PROCESSING_MINUTES],
    )
    const due = await lockClient.query(
      `
      UPDATE letter_broadcasts
      SET status = 'processing', started_at = COALESCE(started_at, now()),
        error_message = NULL, updated_at = now()
      WHERE id IN (
        SELECT id FROM letter_broadcasts
        WHERE status = 'scheduled' AND scheduled_at <= now()
        ORDER BY scheduled_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 5
      )
      RETURNING id
      `,
    )
    let processed = 0
    let failed = 0
    for (const row of due.rows) {
      try {
        await processLetterBroadcast(pool, row.id, { alreadyClaimed: true })
        processed += 1
      } catch (error) {
        failed += 1
        await pool.query(`UPDATE letter_broadcasts SET status = 'failed', error_message = $2, completed_at = now(), updated_at = now() WHERE id = $1`, [row.id, error.message])
      }
    }
    return { processed, failed, recovered: recovered.rowCount }
  } finally {
    await lockClient.query(`SELECT pg_advisory_unlock(hashtext('pwc-letter-broadcast-dispatcher'))`).catch(() => {})
    lockClient.release()
  }
}

let dispatcherTimer = null

function startLetterBroadcastDispatcher(pool) {
  if (!pool || dispatcherTimer) return dispatcherTimer
  const run = () => processDueLetterBroadcasts(pool).catch((error) => {
    console.error('Letter broadcast dispatcher failed:', error.message)
  })
  dispatcherTimer = setInterval(run, DISPATCH_INTERVAL_MS)
  dispatcherTimer.unref?.()
  setTimeout(run, 12_000).unref?.()
  return dispatcherTimer
}

module.exports = {
  assertOutgoingEmailAvailable,
  assertProviderConfigured,
  audienceFilterSql,
  buildBroadcastPreflight,
  letterPublicBaseUrl,
  logRecipientEvent,
  normalizeAudienceFilter,
  previewLetterAudience,
  processDueLetterBroadcasts,
  processLetterBroadcast,
  refreshBroadcastAnalytics,
  sendLetterEmail,
  snapshotBroadcastRecipients,
  STALE_PROCESSING_MINUTES,
  startLetterBroadcastDispatcher,
}
