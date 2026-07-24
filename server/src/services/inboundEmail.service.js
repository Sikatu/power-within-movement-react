const { env } = require('../config/env')

const MAX_MESSAGE_BODY_LENGTH = 10000
const EMAIL_ADDRESS_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/i

function normalizeEmailAddress(value) {
  const input = String(value || '').trim()
  const bracketMatch = input.match(/<([^<>]+)>/)
  const address = String(bracketMatch?.[1] || input).trim().toLowerCase()
  return EMAIL_ADDRESS_PATTERN.test(address) ? address : ''
}

function extractDisplayName(value) {
  const input = String(value || '').trim()
  const match = input.match(/^(.+?)\s*<[^<>]+>$/)
  return String(match?.[1] || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .slice(0, 160)
}

function normalizeAddressList(value) {
  const values = Array.isArray(value) ? value : [value]
  return values.map(normalizeEmailAddress).filter(Boolean)
}

function normalizeReferences(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item || '').split(/\s+/))
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 100)
  }

  return String(value || '')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 100)
}

function htmlToPlainText(value) {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function getHeader(headers, name) {
  if (!headers || typeof headers !== 'object') return ''
  const expected = String(name || '').toLowerCase()
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === expected)
  return key ? String(headers[key] || '') : ''
}

function recipientReplyTo(recipient, receivingDomain = env.newsletterReceivingDomain) {
  const alias = String(recipient?.reply_alias || '').trim().toLowerCase()
  const domain = String(receivingDomain || '').trim().toLowerCase()

  if (!alias || !domain || !/^[a-z0-9]{16,80}$/.test(alias)) return ''

  return `Power Within Collective <replies+${alias}@${domain}>`
}

function extractReplyRoute(addresses, receivingDomain = env.newsletterReceivingDomain) {
  const domain = String(receivingDomain || '').trim().toLowerCase()
  if (!domain) return { accepted: false, alias: '', address: '', reason: 'receiving_domain_not_configured' }

  for (const address of normalizeAddressList(addresses)) {
    const separator = address.lastIndexOf('@')
    if (separator < 1) continue

    const localPart = address.slice(0, separator)
    const addressDomain = address.slice(separator + 1)

    if (addressDomain !== domain) continue
    if (localPart === 'replies') {
      return { accepted: true, alias: '', address, reason: 'direct_reply_address' }
    }

    const match = localPart.match(/^replies\+([a-z0-9]{16,80})$/i)
    if (match) {
      return {
        accepted: true,
        alias: match[1].toLowerCase(),
        address,
        reason: 'recipient_alias',
      }
    }
  }

  return { accepted: false, alias: '', address: '', reason: 'unsupported_destination' }
}

async function retrieveReceivedEmail(emailId, {
  fetchImpl = fetch,
  apiKey = env.resendApiKey,
} = {}) {
  const normalizedId = String(emailId || '').trim()
  const normalizedKey = String(apiKey || '').trim()

  if (!normalizedId) {
    const error = new Error('The inbound email event is missing email_id.')
    error.statusCode = 400
    error.code = 'INBOUND_EMAIL_ID_MISSING'
    throw error
  }

  if (!normalizedKey) {
    const error = new Error('RESEND_API_KEY is required to retrieve received email content.')
    error.statusCode = 503
    error.code = 'INBOUND_EMAIL_PROVIDER_NOT_CONFIGURED'
    throw error
  }

  const response = await fetchImpl(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(normalizedId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${normalizedKey}`,
        Accept: 'application/json',
      },
    },
  )

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || 'Resend could not retrieve the received email.')
    error.statusCode = 502
    error.code = 'INBOUND_EMAIL_RETRIEVAL_FAILED'
    error.providerStatus = response.status
    error.providerData = data
    throw error
  }

  return data
}

async function claimInboundEvent(pool, {
  providerEventId,
  providerEmailId,
  eventType,
  payload,
}) {
  const db = await pool.connect()

  try {
    await db.query('BEGIN')
    const existingResult = await db.query(
      `
      SELECT *
      FROM inbound_email_events
      WHERE provider_event_id = $1
         OR provider_email_id = $2
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE
      `,
      [providerEventId, providerEmailId],
    )
    const existing = existingResult.rows[0]

    if (existing && ['processed', 'ignored'].includes(existing.processing_status)) {
      await db.query('COMMIT')
      return { duplicate: true, event: existing }
    }

    let event
    if (existing) {
      const updated = await db.query(
        `
        UPDATE inbound_email_events
        SET
          provider_event_id = $2,
          provider_email_id = $3,
          event_type = $4,
          processing_status = 'processing',
          attempt_count = attempt_count + 1,
          failure_reason = NULL,
          payload = $5::jsonb,
          last_attempt_at = now(),
          updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [
          existing.id,
          providerEventId,
          providerEmailId,
          eventType,
          JSON.stringify(payload || {}),
        ],
      )
      event = updated.rows[0]
    } else {
      const inserted = await db.query(
        `
        INSERT INTO inbound_email_events (
          provider_event_id,
          provider_email_id,
          event_type,
          processing_status,
          attempt_count,
          payload,
          last_attempt_at
        )
        VALUES ($1, $2, $3, 'processing', 1, $4::jsonb, now())
        RETURNING *
        `,
        [
          providerEventId,
          providerEmailId,
          eventType,
          JSON.stringify(payload || {}),
        ],
      )
      event = inserted.rows[0]
    }

    await db.query('COMMIT')
    return { duplicate: false, event }
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {})

    if (error.code === '23505') {
      return { duplicate: true, event: null }
    }

    throw error
  } finally {
    db.release()
  }
}

async function updateInboundEvent(pool, eventId, {
  status,
  failureReason = null,
}) {
  if (!eventId) return

  await pool.query(
    `
    UPDATE inbound_email_events
    SET
      processing_status = $2,
      failure_reason = $3,
      processed_at = CASE WHEN $2 IN ('processed', 'ignored') THEN now() ELSE processed_at END,
      updated_at = now()
    WHERE id = $1
    `,
    [eventId, status, failureReason],
  )
}

async function findRecipientByAlias(db, alias) {
  if (!alias) return null

  const result = await db.query(
    `
    SELECT
      lbr.*,
      s.client_profile_id,
      s.first_name AS subscriber_first_name,
      s.last_name AS subscriber_last_name,
      s.email AS subscriber_email,
      cp.user_id AS client_user_id
    FROM letter_broadcast_recipients lbr
    JOIN subscribers s ON s.id = lbr.subscriber_id
    LEFT JOIN client_profiles cp ON cp.id = s.client_profile_id
    WHERE lower(lbr.reply_alias) = lower($1)
    LIMIT 1
    `,
    [alias],
  )

  return result.rows[0] || null
}

async function findOrCreateConversation(db, {
  recipient,
  senderEmail,
  senderName,
  subject,
  route,
  providerMessageId,
}) {
  if (recipient) {
    const existing = await db.query(
      `
      SELECT *
      FROM client_conversations
      WHERE lower(reply_alias) = lower($1)
      LIMIT 1
      FOR UPDATE
      `,
      [route.alias],
    )

    if (existing.rows[0]) return existing.rows[0]
  } else {
    const existing = await db.query(
      `
      SELECT *
      FROM client_conversations
      WHERE channel = 'email'
        AND source_type = 'direct_email'
        AND lower(external_email) = lower($1)
        AND status <> 'closed'
      ORDER BY last_message_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [senderEmail],
    )

    if (existing.rows[0]) return existing.rows[0]
  }

  const result = await db.query(
    `
    INSERT INTO client_conversations (
      client_profile_id,
      subscriber_id,
      external_email,
      external_name,
      subject,
      status,
      priority,
      channel,
      source_type,
      provider_thread_key,
      reply_alias
    )
    VALUES ($1, $2, $3, $4, $5, 'waiting_on_team', 'normal', 'email', $6, $7, $8)
    RETURNING *
    `,
    [
      recipient?.client_profile_id || null,
      recipient?.subscriber_id || null,
      senderEmail,
      senderName || null,
      String(subject || 'Email reply').trim().slice(0, 180) || 'Email reply',
      recipient ? 'broadcast_reply' : 'direct_email',
      recipient
        ? `broadcast:${recipient.broadcast_id}:${recipient.id}`
        : `direct:${senderEmail}:${providerMessageId}`,
      recipient ? route.alias : null,
    ],
  )

  return result.rows[0]
}

async function processInboundEmailEvent({
  pool,
  event,
  providerEventId,
  fetchImpl = fetch,
}) {
  const eventType = String(event?.type || '').trim()
  const providerEmailId = String(event?.data?.email_id || '').trim()
  const stableEventId = String(
    providerEventId ||
    event?.id ||
    (providerEmailId ? `email.received:${providerEmailId}` : ''),
  ).trim()

  if (eventType !== 'email.received') {
    return { ignored: true, reason: 'unsupported_event_type' }
  }

  if (!stableEventId || !providerEmailId) {
    const error = new Error('The inbound email webhook is missing its provider identifiers.')
    error.statusCode = 400
    error.code = 'INBOUND_EMAIL_IDENTIFIERS_MISSING'
    throw error
  }

  const claim = await claimInboundEvent(pool, {
    providerEventId: stableEventId,
    providerEmailId,
    eventType,
    payload: event,
  })

  if (claim.duplicate) {
    return { duplicate: true }
  }

  const eventId = claim.event?.id

  try {
    const email = await retrieveReceivedEmail(providerEmailId, { fetchImpl })
    const route = extractReplyRoute(
      email.to || event?.data?.to || [],
      env.newsletterReceivingDomain,
    )

    if (!route.accepted) {
      await updateInboundEvent(pool, eventId, {
        status: 'ignored',
        failureReason: route.reason,
      })
      return { ignored: true, reason: route.reason }
    }

    const senderHeader = getHeader(email.headers, 'from') || email.from || event?.data?.from
    const senderEmail = normalizeEmailAddress(email.from || event?.data?.from || senderHeader)
    const senderName = extractDisplayName(senderHeader)

    if (!senderEmail) {
      await updateInboundEvent(pool, eventId, {
        status: 'ignored',
        failureReason: 'sender_address_missing',
      })
      return { ignored: true, reason: 'sender_address_missing' }
    }

    const body = String(email.text || htmlToPlainText(email.html) || '[No readable message body was provided.]')
      .trim()
      .slice(0, MAX_MESSAGE_BODY_LENGTH)
    const subject = String(email.subject || event?.data?.subject || 'Email reply').trim().slice(0, 180)
    const internetMessageId = String(email.message_id || event?.data?.message_id || '').trim() || null
    const inReplyTo = getHeader(email.headers, 'in-reply-to').trim() || null
    const references = normalizeReferences(getHeader(email.headers, 'references'))
    const emailTo = normalizeAddressList(email.to || event?.data?.to || [route.address])[0] || route.address
    const attachments = Array.isArray(email.attachments) ? email.attachments : event?.data?.attachments || []

    const db = await pool.connect()

    try {
      await db.query('BEGIN')
      const recipient = route.alias ? await findRecipientByAlias(db, route.alias) : null

      if (route.alias && !recipient) {
        await db.query('ROLLBACK')
        await updateInboundEvent(pool, eventId, {
          status: 'ignored',
          failureReason: 'reply_alias_not_found',
        })
        return { ignored: true, reason: 'reply_alias_not_found' }
      }

      const conversation = await findOrCreateConversation(db, {
        recipient,
        senderEmail,
        senderName,
        subject,
        route,
        providerMessageId: providerEmailId,
      })

      const senderMatchesRecipient = Boolean(
        recipient?.subscriber_email &&
        normalizeEmailAddress(recipient.subscriber_email) === senderEmail
      )

      const messageResult = await db.query(
        `
        INSERT INTO client_conversation_messages (
          conversation_id,
          sender_user_id,
          sender_role,
          body,
          is_internal_note,
          read_by_client_at,
          provider_email_id,
          internet_message_id,
          in_reply_to,
          reference_ids,
          provider_event_id,
          email_from,
          email_to,
          channel,
          delivery_status,
          provider_metadata
        )
        VALUES (
          $1, $2, 'client', $3, false, now(), $4, $5, $6, $7::text[],
          $8, $9, $10, 'email', 'received', $11::jsonb
        )
        ON CONFLICT DO NOTHING
        RETURNING *
        `,
        [
          conversation.id,
          senderMatchesRecipient ? recipient?.client_user_id || null : null,
          body,
          providerEmailId,
          internetMessageId,
          inReplyTo,
          references,
          stableEventId,
          senderEmail,
          emailTo,
          JSON.stringify({
            attachments,
            cc: email.cc || event?.data?.cc || [],
            bcc: email.bcc || event?.data?.bcc || [],
            replyTo: email.reply_to || [],
            route: {
              address: route.address,
              aliasMatched: Boolean(recipient),
            },
            senderMismatch: Boolean(recipient && !senderMatchesRecipient),
          }),
        ],
      )

      const message = messageResult.rows[0]
      await db.query(
        `
        UPDATE client_conversations
        SET
          external_email = $2,
          external_name = COALESCE(NULLIF($3, ''), external_name),
          status = 'waiting_on_team',
          last_message_at = now(),
          closed_at = NULL,
          updated_at = now()
        WHERE id = $1
        `,
        [conversation.id, senderEmail, senderName],
      )

      await db.query(
        `
        UPDATE inbound_email_events
        SET
          processing_status = 'processed',
          failure_reason = NULL,
          processed_at = now(),
          updated_at = now()
        WHERE id = $1
        `,
        [eventId],
      )

      await db.query('COMMIT')

      return {
        processed: true,
        duplicateMessage: !message,
        conversationId: conversation.id,
        messageId: message?.id || null,
        matchedBroadcastRecipient: Boolean(recipient),
        attachmentCount: attachments.length,
      }
    } catch (error) {
      await db.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      db.release()
    }
  } catch (error) {
    await updateInboundEvent(pool, eventId, {
      status: 'failed',
      failureReason: String(error.message || 'Inbound email processing failed.').slice(0, 1000),
    }).catch(() => {})
    throw error
  }
}

module.exports = {
  extractDisplayName,
  extractReplyRoute,
  getHeader,
  htmlToPlainText,
  normalizeAddressList,
  normalizeEmailAddress,
  normalizeReferences,
  processInboundEmailEvent,
  recipientReplyTo,
  retrieveReceivedEmail,
}
