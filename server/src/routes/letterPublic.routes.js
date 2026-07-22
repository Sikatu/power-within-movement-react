const express = require('express')
const { pipeline } = require('stream/promises')

const { env } = require('../config/env')
const { pool } = require('../db/pool')
const { publicSubmissionRateLimit } = require('../middleware/securityRateLimits.middleware')
const { assertAssetUsable } = require('../services/assetScan.service')
const { getObjectStream, safeSegment } = require('../services/assetStorage.service')
const {
  decodeSignedToken,
  escapeHtml,
  verifyResendWebhook,
} = require('../services/letterBuilder.service')
const {
  logRecipientEvent,
  refreshBroadcastAnalytics,
} = require('../services/letterBroadcast.service')
const { processInboundEmailEvent } = require('../services/inboundEmail.service')
const {
  createSuppression,
  writeConsentEvent,
} = require('../services/newsletterAudience.service')

const router = express.Router()
const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')

function decode(token, type) {
  return decodeSignedToken(token, { type, secret: env.letterSigningSecret })
}

function tinyGif(res) {
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': String(TRANSPARENT_GIF.length),
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  })
  return res.send(TRANSPARENT_GIF)
}

async function getRecipient(payload) {
  const result = await pool.query(
    `
    SELECT lbr.*, lb.letter_id, lb.status AS broadcast_status, s.status AS subscriber_status, s.consent_status
    FROM letter_broadcast_recipients lbr
    JOIN letter_broadcasts lb ON lb.id = lbr.broadcast_id
    JOIN subscribers s ON s.id = lbr.subscriber_id
    WHERE lbr.id = $1 AND lbr.broadcast_id = $2
    LIMIT 1
    `,
    [payload.recipientId, payload.broadcastId],
  )
  return result.rows[0] || null
}

function confirmationPage({ token, email, complete = false, test = false }) {
  const safeToken = escapeHtml(token)
  const safeEmail = escapeHtml(email || 'this address')
  const content = test
    ? '<p>This is the unsubscribe preview for a test letter. No audience preference has been changed.</p>'
    : complete
    ? `<p>Your preference has been saved. <strong>${safeEmail}</strong> will not receive future Power Within newsletter broadcasts.</p>`
    : `<p>Confirm that <strong>${safeEmail}</strong> should stop receiving Power Within newsletter broadcasts.</p><form method="post" action="/api/public/letters/unsubscribe/${safeToken}"><button type="submit">Confirm unsubscribe</button></form>`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Newsletter preference | Power Within Collective</title></head><body style="margin:0;padding:32px;background:#f6eee9;color:#4d343c;font-family:Arial,sans-serif;"><main style="max-width:620px;margin:8vh auto;padding:36px;border:1px solid #e1cdbd;border-radius:24px;background:#fffdf9;"><p style="color:#9b7650;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Power Within Collective</p><h1 style="font-family:Georgia,serif;font-size:38px;font-weight:500;">Newsletter preference</h1>${content}<p style="margin-top:28px;color:#806b72;font-size:13px;">This does not change client services, private portal access, or appointment communication.</p></main></body></html>`
}

router.get('/test-unsubscribe', (req, res) => {
  res.type('html').send(confirmationPage({ token: '', email: 'the test address', test: true }))
})

router.get('/unsubscribe/:token', async (req, res) => {
  if (!pool) return res.status(503).send('Newsletter preferences are temporarily unavailable.')
  try {
    const payload = decode(req.params.token, 'unsubscribe')
    const recipient = await getRecipient(payload)
    if (!recipient || recipient.subscriber_id !== payload.subscriberId) return res.status(404).send('This newsletter preference link is not available.')
    res.type('html').send(confirmationPage({ token: req.params.token, email: recipient.email, complete: recipient.subscriber_status === 'unsubscribed' }))
  } catch (error) {
    res.status(400).send(error.message || 'This newsletter preference link is not valid.')
  }
})

router.post('/unsubscribe/:token', publicSubmissionRateLimit, async (req, res) => {
  if (!pool) return res.status(503).send('Newsletter preferences are temporarily unavailable.')
  const db = await pool.connect()
  try {
    const payload = decode(req.params.token, 'unsubscribe')
    await db.query('BEGIN')
    const recipientResult = await db.query(
      `SELECT * FROM letter_broadcast_recipients WHERE id = $1 AND broadcast_id = $2 AND subscriber_id = $3 FOR UPDATE`,
      [payload.recipientId, payload.broadcastId, payload.subscriberId],
    )
    const recipient = recipientResult.rows[0]
    if (!recipient) {
      await db.query('ROLLBACK')
      return res.status(404).send('This newsletter preference link is not available.')
    }
    const subscriberResult = await db.query(`SELECT * FROM subscribers WHERE id = $1 FOR UPDATE`, [recipient.subscriber_id])
    const subscriber = subscriberResult.rows[0]
    if (subscriber.status !== 'unsubscribed') {
      await db.query(`UPDATE subscribers SET status = 'unsubscribed', consent_status = 'withdrawn', suppression_reason = 'unsubscribed', unsubscribed_at = now(), updated_at = now() WHERE id = $1`, [subscriber.id])
      await createSuppression(db, { subscriberId: subscriber.id, email: subscriber.email, reason: 'unsubscribed', metadata: { broadcastId: recipient.broadcast_id, recipientId: recipient.id, source: 'letter_unsubscribe' } })
      await writeConsentEvent(db, {
        subscriberId: subscriber.id,
        eventType: 'consent_withdrawn',
        statusBefore: subscriber.status,
        statusAfter: 'unsubscribed',
        consentBefore: subscriber.consent_status,
        consentAfter: 'withdrawn',
        source: 'letter_unsubscribe',
        metadata: { broadcastId: recipient.broadcast_id, recipientId: recipient.id },
      })
    }
    await db.query(`UPDATE letter_broadcast_recipients SET delivery_status = 'unsubscribed', unsubscribed_at = COALESCE(unsubscribed_at, now()), updated_at = now() WHERE id = $1`, [recipient.id])
    await logRecipientEvent(db, { broadcastId: recipient.broadcast_id, recipientId: recipient.id, subscriberId: recipient.subscriber_id, eventType: 'unsubscribed', metadata: { source: 'visible_link_or_one_click' } })
    await db.query(`UPDATE newsletter_send_history SET delivery_status = 'unsubscribed', metadata = metadata || $2::jsonb WHERE subscriber_id = $1 AND metadata ->> 'broadcastId' = $3`, [subscriber.id, JSON.stringify({ unsubscribedAt: new Date().toISOString() }), recipient.broadcast_id])
    await db.query('COMMIT')
    await refreshBroadcastAnalytics(pool, recipient.broadcast_id)
    res.type('html').send(confirmationPage({ token: req.params.token, email: recipient.email, complete: true }))
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})
    res.status(400).send(error.message || 'Newsletter preference could not be updated.')
  } finally {
    db.release()
  }
})

router.get('/open/:token.gif', async (req, res) => {
  if (!pool) return tinyGif(res)
  try {
    const payload = decode(req.params.token, 'open')
    const recipient = await getRecipient(payload)
    if (recipient) {
      await pool.query(`UPDATE letter_broadcast_recipients SET delivery_status = CASE WHEN delivery_status IN ('sent', 'delivered') THEN 'opened' ELSE delivery_status END, first_opened_at = COALESCE(first_opened_at, now()), last_opened_at = now(), updated_at = now() WHERE id = $1`, [recipient.id])
      await logRecipientEvent(pool, { broadcastId: recipient.broadcast_id, recipientId: recipient.id, subscriberId: recipient.subscriber_id, eventType: 'opened', metadata: { userAgent: req.get('user-agent') || null } })
      await refreshBroadcastAnalytics(pool, recipient.broadcast_id)
    }
  } catch {
    // Tracking pixels must remain invisible even when a token is invalid.
  }
  return tinyGif(res)
})

router.get('/click/:token', async (req, res) => {
  if (!pool) return res.status(503).send('This link is temporarily unavailable.')
  try {
    const payload = decode(req.params.token, 'click')
    const [recipient, linkResult] = await Promise.all([
      getRecipient(payload),
      pool.query(`SELECT * FROM letter_tracking_links WHERE id = $1 AND broadcast_id = $2 LIMIT 1`, [payload.linkId, payload.broadcastId]),
    ])
    const link = linkResult.rows[0]
    if (!recipient || !link) return res.status(404).send('This letter link is not available.')
    const existing = await pool.query(`SELECT id FROM letter_events WHERE recipient_id = $1 AND link_id = $2 AND event_type = 'clicked' LIMIT 1`, [recipient.id, link.id])
    await logRecipientEvent(pool, { broadcastId: recipient.broadcast_id, recipientId: recipient.id, subscriberId: recipient.subscriber_id, linkId: link.id, eventType: 'clicked', metadata: { userAgent: req.get('user-agent') || null } })
    await pool.query(`UPDATE letter_tracking_links SET click_count = click_count + 1, unique_click_count = unique_click_count + $2, updated_at = now() WHERE id = $1`, [link.id, existing.rows[0] ? 0 : 1])
    await pool.query(`UPDATE letter_broadcast_recipients SET delivery_status = CASE WHEN delivery_status IN ('sent', 'delivered', 'opened') THEN 'clicked' ELSE delivery_status END, first_clicked_at = COALESCE(first_clicked_at, now()), last_clicked_at = now(), updated_at = now() WHERE id = $1`, [recipient.id])
    await refreshBroadcastAnalytics(pool, recipient.broadcast_id)
    return res.redirect(302, link.destination_url)
  } catch (error) {
    return res.status(400).send(error.message || 'This letter link is not valid.')
  }
})

router.get('/assets/:token', async (req, res, next) => {
  if (!pool) return res.status(503).json({ ok: false, error: 'Newsletter assets are temporarily unavailable.' })
  try {
    const payload = decode(req.params.token, 'asset')
    const recipient = await getRecipient(payload)
    if (!recipient) return res.status(404).json({ ok: false, error: 'This newsletter asset link is not available.' })
    const result = await pool.query(`SELECT * FROM assets WHERE id = $1 AND status = 'active' LIMIT 1`, [payload.assetId])
    const asset = result.rows[0]
    if (!asset) return res.status(404).json({ ok: false, error: 'Newsletter asset not found.' })
    assertAssetUsable(asset)
    const stream = await getObjectStream(asset)
    const disposition = payload.disposition === 'attachment' ? 'attachment' : 'inline'
    res.set({
      'Content-Type': asset.mime_type,
      'Content-Length': String(asset.size_bytes),
      'Content-Disposition': `${disposition}; filename="${safeSegment(asset.original_filename)}"`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    })
    await pool.query(`INSERT INTO asset_access_logs (asset_id, action, metadata) VALUES ($1, $2, $3::jsonb)`, [asset.id, disposition === 'inline' ? 'preview' : 'download', JSON.stringify({ newsletter: true, broadcastId: recipient.broadcast_id, recipientId: recipient.id })])
    await pipeline(stream, res)
  } catch (error) {
    next(error)
  }
})

function providerEventType(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized.includes('delivered')) return 'delivered'
  if (normalized.includes('opened')) return 'opened'
  if (normalized.includes('clicked')) return 'clicked'
  if (normalized.includes('bounced')) return 'bounced'
  if (normalized.includes('complained') || normalized.includes('complaint')) return 'complained'
  return null
}

router.post('/webhooks/resend', async (req, res) => {
  if (!pool) return res.status(503).json({ ok: false })
  const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(req.body || {})
  const verified = verifyResendWebhook({
    rawBody,
    webhookId: req.get('svix-id'),
    timestamp: req.get('svix-timestamp'),
    signature: req.get('svix-signature'),
    secret: env.resendWebhookSecret,
  })
  if (!env.resendWebhookSecret) return res.status(503).json({ ok: false, error: 'Webhook verification is not configured.' })
  if (!verified) return res.status(401).json({ ok: false, error: 'Invalid webhook signature.' })

  if (req.body?.type === 'email.received') {
    try {
      const result = await processInboundEmailEvent({
        pool,
        event: req.body,
        providerEventId: req.get('svix-id') || req.body?.id || null,
      })
      return res.json({ ok: true, ...result })
    } catch (error) {
      console.error('Inbound Resend email processing failed:', error.message)
      return res.status(error.statusCode || 500).json({
        ok: false,
        error: error.statusCode && error.statusCode < 500
          ? error.message
          : 'Inbound email processing failed.',
        code: error.code || 'INBOUND_EMAIL_PROCESSING_FAILED',
      })
    }
  }

  const eventType = providerEventType(req.body?.type)
  if (!eventType) return res.json({ ok: true, ignored: true })
  const providerMessageId = req.body?.data?.email_id || req.body?.data?.id
  const providerEventId = req.get('svix-id') || req.body?.id || null
  const recipientResult = await pool.query(`SELECT * FROM letter_broadcast_recipients WHERE provider_message_id = $1 LIMIT 1`, [providerMessageId])
  const recipient = recipientResult.rows[0]
  if (!recipient) return res.json({ ok: true, ignored: true })

  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const timestamp = req.body?.created_at || new Date().toISOString()
    const statusSql = {
      delivered: `delivery_status = CASE WHEN delivery_status = 'sent' THEN 'delivered' ELSE delivery_status END, delivered_at = COALESCE(delivered_at, $2)`,
      opened: `delivery_status = CASE WHEN delivery_status IN ('sent', 'delivered') THEN 'opened' ELSE delivery_status END, first_opened_at = COALESCE(first_opened_at, $2), last_opened_at = $2`,
      clicked: `delivery_status = CASE WHEN delivery_status IN ('sent', 'delivered', 'opened') THEN 'clicked' ELSE delivery_status END, first_clicked_at = COALESCE(first_clicked_at, $2), last_clicked_at = $2`,
      bounced: `delivery_status = 'bounced', bounced_at = $2`,
      complained: `delivery_status = 'complained', complained_at = $2`,
    }[eventType]
    const insertedEvent = await logRecipientEvent(db, { broadcastId: recipient.broadcast_id, recipientId: recipient.id, subscriberId: recipient.subscriber_id, eventType, providerEventId, metadata: req.body?.data || {}, occurredAt: timestamp })
    if (providerEventId && !insertedEvent) {
      await db.query('COMMIT')
      return res.json({ ok: true, duplicate: true })
    }
    await db.query(`UPDATE letter_broadcast_recipients SET ${statusSql}, updated_at = now() WHERE id = $1`, [recipient.id, timestamp])
    if (['bounced', 'complained'].includes(eventType)) {
      const subscriberResult = await db.query(`SELECT * FROM subscribers WHERE id = $1 FOR UPDATE`, [recipient.subscriber_id])
      const subscriber = subscriberResult.rows[0]
      await db.query(`UPDATE subscribers SET status = $2, suppression_reason = $2, updated_at = now() WHERE id = $1`, [subscriber.id, eventType])
      await createSuppression(db, { subscriberId: subscriber.id, email: subscriber.email, reason: eventType, metadata: { providerMessageId, providerEventId } })
      await writeConsentEvent(db, { subscriberId: subscriber.id, eventType: `delivery_${eventType}`, statusBefore: subscriber.status, statusAfter: eventType, consentBefore: subscriber.consent_status, consentAfter: subscriber.consent_status, source: 'resend_webhook', metadata: { providerMessageId, providerEventId } })
    }
    await db.query(
      `UPDATE newsletter_send_history SET delivery_status = CASE WHEN delivery_status IN ('bounced', 'complained', 'unsubscribed') AND $2 NOT IN ('bounced', 'complained', 'unsubscribed') THEN delivery_status ELSE $2 END, metadata = metadata || $3::jsonb WHERE provider_message_id = $1`,
      [providerMessageId, eventType, JSON.stringify({ providerEventId, occurredAt: timestamp })],
    )
    await db.query('COMMIT')
    await refreshBroadcastAnalytics(pool, recipient.broadcast_id)
    return res.json({ ok: true })
  } catch (_error) {
    await db.query('ROLLBACK').catch(() => {})
    return res.status(500).json({ ok: false })
  } finally {
    db.release()
  }
})

module.exports = router
