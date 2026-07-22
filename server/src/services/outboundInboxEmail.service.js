const { env } = require('../config/env')
const {
  normalizeEmailAddress,
  recipientReplyTo,
} = require('./inboundEmail.service')

const MAX_REFERENCE_IDS = 100

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

function replySubject(value) {
  const subject = String(value || 'Email conversation').trim().slice(0, 180) || 'Email conversation'
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`
}

function buildThreadingHeaders(messages = []) {
  const latest = [...messages]
    .reverse()
    .find((message) => message?.channel === 'email' && String(message.internet_message_id || '').trim())

  if (!latest) {
    return {
      headers: {},
      inReplyTo: null,
      referenceIds: [],
    }
  }

  const inReplyTo = String(latest.internet_message_id).trim()
  const referenceIds = uniqueValues([
    ...(Array.isArray(latest.reference_ids) ? latest.reference_ids : []),
    inReplyTo,
  ]).slice(-MAX_REFERENCE_IDS)

  return {
    headers: {
      'In-Reply-To': inReplyTo,
      References: referenceIds.join(' '),
    },
    inReplyTo,
    referenceIds,
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderReplyContent({ body, attachmentUrl = '', attachmentLabel = '' }) {
  const normalizedBody = String(body || '').trim()
  const normalizedUrl = String(attachmentUrl || '').trim()
  const normalizedLabel = String(attachmentLabel || 'Open attachment').trim() || 'Open attachment'
  const attachmentText = normalizedUrl ? `\n\n${normalizedLabel}: ${normalizedUrl}` : ''

  const text = `${normalizedBody}${attachmentText}\n\nWith care,\nPower Within Collective`
  const paragraphs = normalizedBody
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
  const attachmentHtml = normalizedUrl
    ? `<p><a href="${escapeHtml(normalizedUrl)}">${escapeHtml(normalizedLabel)}</a></p>`
    : ''

  return {
    text,
    html: `${paragraphs}${attachmentHtml}<p>With care,<br>Power Within Collective</p>`,
  }
}

function directReplyTo(receivingDomain) {
  const domain = String(receivingDomain || '').trim().toLowerCase()
  return domain ? `Power Within Collective <replies@${domain}>` : ''
}

function createInboxEmailPayload({
  conversation,
  messages = [],
  body,
  attachmentUrl = '',
  attachmentLabel = '',
  configuredFrom = env.newsletterEmailFrom || env.portalEmailFrom,
  configuredReplyTo = env.newsletterReplyTo,
  receivingDomain = env.newsletterReceivingDomain,
}) {
  const to = normalizeEmailAddress(
    conversation?.external_email ||
    conversation?.client_email,
  )

  if (!to) {
    const error = new Error('This email conversation does not have a valid recipient address.')
    error.statusCode = 409
    error.code = 'INBOX_EMAIL_RECIPIENT_MISSING'
    throw error
  }

  const fromAddress = normalizeEmailAddress(configuredFrom)
  const aliasReplyTo = recipientReplyTo(conversation, receivingDomain)
  const replyTo = aliasReplyTo || directReplyTo(receivingDomain) || String(configuredReplyTo || '').trim()
  const threading = buildThreadingHeaders(messages)
  const content = renderReplyContent({ body, attachmentUrl, attachmentLabel })

  return {
    to,
    fromAddress,
    subject: replySubject(conversation?.subject),
    replyTo,
    headers: threading.headers,
    inReplyTo: threading.inReplyTo,
    referenceIds: threading.referenceIds,
    html: content.html,
    text: content.text,
  }
}

module.exports = {
  buildThreadingHeaders,
  createInboxEmailPayload,
  directReplyTo,
  renderReplyContent,
  replySubject,
}