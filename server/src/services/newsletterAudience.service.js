const AUDIENCE_STATUSES = new Set([
  'subscribed',
  'unsubscribed',
  'bounced',
  'complained',
  'suppressed',
  'pending',
])

const CONSENT_STATUSES = new Set(['granted', 'pending', 'withdrawn', 'not_recorded'])
const SUPPRESSION_STATUSES = new Set(['unsubscribed', 'bounced', 'complained', 'suppressed'])
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeLabel(value, maxLength = 60) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

function uniqueLabels(values, maxItems = 30) {
  const labels = []
  const seen = new Set()

  for (const value of values || []) {
    const label = normalizeLabel(value)
    const key = label.toLowerCase()
    if (!label || seen.has(key)) continue
    labels.push(label)
    seen.add(key)
    if (labels.length >= maxItems) break
  }

  return labels
}

function isValidEmail(value) {
  const email = normalizeEmail(value)
  return email.length <= 320 && EMAIL_PATTERN.test(email)
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const source = String(text || '').replace(/^\uFEFF/, '')

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (character === ',' && !quoted) {
      row.push(field.trim())
      field = ''
      continue
    }

    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(field.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      field = ''
      continue
    }

    field += character
  }

  if (quoted) throw new Error('CSV contains an unfinished quoted value.')
  row.push(field.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function parseBooleanConsent(value) {
  return ['true', 'yes', 'y', '1', 'granted', 'subscribed', 'consented'].includes(
    String(value || '').trim().toLowerCase(),
  )
}

function parseAudienceCsv(text, { defaultSource = 'csv_import', defaultTags = [] } = {}) {
  const rows = parseCsv(text)
  if (!rows.length) return { recipients: [], errors: [] }

  const headerAliases = {
    email: ['email', 'email_address', 'email address'],
    firstName: ['first_name', 'first name', 'firstname'],
    lastName: ['last_name', 'last name', 'lastname'],
    tags: ['tags', 'tag'],
    segments: ['segments', 'segment'],
    source: ['source'],
    consent: ['consent', 'consented', 'newsletter_consent', 'newsletter consent'],
    consentAt: ['consent_at', 'consent at', 'consented_at', 'consented at'],
    notes: ['notes', 'note'],
  }
  const normalizedHeader = rows[0].map((value) => String(value).trim().toLowerCase())
  const recognized = Object.values(headerAliases).flat().some((name) => normalizedHeader.includes(name))
  const header = recognized ? normalizedHeader : ['email', 'first_name', 'last_name', 'tags', 'consent']
  const dataRows = recognized ? rows.slice(1) : rows
  const indexFor = (key) => header.findIndex((name) => headerAliases[key].includes(name))
  const indexes = Object.fromEntries(Object.keys(headerAliases).map((key) => [key, indexFor(key)]))
  const recipients = []
  const errors = []

  dataRows.forEach((values, rowIndex) => {
    const line = rowIndex + (recognized ? 2 : 1)
    const valueAt = (key) => indexes[key] >= 0 ? values[indexes[key]] : ''
    const email = normalizeEmail(valueAt('email'))
    if (!isValidEmail(email)) {
      errors.push({ line, email, message: 'A valid email address is required.' })
      return
    }

    const explicitConsent = parseBooleanConsent(valueAt('consent'))
    const tags = uniqueLabels([
      ...defaultTags,
      ...String(valueAt('tags') || '').split(/[;|]/),
    ])
    const segments = uniqueLabels(String(valueAt('segments') || '').split(/[;|]/))
    recipients.push({
      email,
      firstName: normalizeLabel(valueAt('firstName'), 120),
      lastName: normalizeLabel(valueAt('lastName'), 120),
      tags,
      segments,
      source: normalizeLabel(valueAt('source'), 120) || defaultSource,
      notes: String(valueAt('notes') || '').trim().slice(0, 5000),
      explicitConsent,
      consentAt: explicitConsent && valueAt('consentAt') ? valueAt('consentAt') : null,
      status: explicitConsent ? 'subscribed' : 'pending',
      consentStatus: explicitConsent ? 'granted' : 'not_recorded',
      rowNumber: line,
    })
  })

  return { recipients, errors }
}

function mergeSubscriberRecords(current = {}, incoming = {}) {
  const currentConsent = current.explicitConsent || current.consentStatus === 'granted'
  const incomingConsent = incoming.explicitConsent || incoming.consentStatus === 'granted'
  return {
    ...current,
    ...incoming,
    email: normalizeEmail(incoming.email || current.email),
    firstName: incoming.firstName || current.firstName || '',
    lastName: incoming.lastName || current.lastName || '',
    tags: uniqueLabels([...(current.tags || []), ...(incoming.tags || [])]),
    segments: uniqueLabels([...(current.segments || []), ...(incoming.segments || [])]),
    notes: incoming.notes || current.notes || '',
    explicitConsent: Boolean(currentConsent || incomingConsent),
    consentStatus: currentConsent || incomingConsent ? 'granted' : (incoming.consentStatus || current.consentStatus || 'not_recorded'),
    status: currentConsent || incomingConsent ? 'subscribed' : (incoming.status || current.status || 'pending'),
    consentAt: incoming.consentAt || current.consentAt || null,
  }
}

function mergeDuplicateRecipients(recipients = []) {
  const merged = new Map()
  let duplicates = 0

  for (const recipient of recipients) {
    const email = normalizeEmail(recipient.email)
    if (merged.has(email)) duplicates += 1
    merged.set(email, mergeSubscriberRecords(merged.get(email), recipient))
  }

  return { recipients: [...merged.values()], duplicates }
}

function suppressionReasonForStatus(status) {
  const normalized = AUDIENCE_STATUSES.has(status) ? status : 'suppressed'
  return normalized === 'suppressed' ? 'manual' : normalized
}

function canReceiveNewsletter(subscriber, activeSuppression = false) {
  return Boolean(
    subscriber &&
    subscriber.status === 'subscribed' &&
    subscriber.consent_status === 'granted' &&
    !activeSuppression &&
    !subscriber.suppression_reason,
  )
}

async function syncNamedLinks(db, { subscriberId, names, table, linkTable, nameColumn, linkColumn, actorUserId }) {
  for (const name of uniqueLabels(names)) {
    const named = await db.query(
      `
      INSERT INTO ${table} (${nameColumn}, created_by_user_id)
      VALUES ($1, $2)
      ON CONFLICT (lower(${nameColumn})) WHERE archived_at IS NULL
      DO UPDATE SET updated_at = now()
      RETURNING id
      `,
      [name, actorUserId || null],
    )
    await db.query(
      `INSERT INTO ${linkTable} (subscriber_id, ${linkColumn}) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [subscriberId, named.rows[0].id],
    )
  }
}

async function syncTags(db, subscriberId, names = []) {
  for (const name of uniqueLabels(names)) {
    const tag = await db.query(
      `INSERT INTO email_tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [name],
    )
    await db.query(
      `INSERT INTO subscriber_tag_links (subscriber_id, email_tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [subscriberId, tag.rows[0].id],
    )
  }
}

async function syncSegments(db, subscriberId, names = [], actorUserId = null) {
  return syncNamedLinks(db, {
    subscriberId,
    names,
    table: 'newsletter_segments',
    linkTable: 'newsletter_segment_members',
    nameColumn: 'name',
    linkColumn: 'segment_id',
    actorUserId,
  })
}

async function writeConsentEvent(db, {
  subscriberId,
  eventType,
  statusBefore = null,
  statusAfter = null,
  consentBefore = null,
  consentAfter = null,
  source = 'admin',
  actorUserId = null,
  metadata = {},
}) {
  await db.query(
    `
    INSERT INTO newsletter_consent_events (
      subscriber_id, event_type, status_before, status_after,
      consent_before, consent_after, source, actor_user_id, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
    `,
    [subscriberId, eventType, statusBefore, statusAfter, consentBefore, consentAfter, source, actorUserId, JSON.stringify(metadata)],
  )
}

async function getActiveSuppression(db, email) {
  const result = await db.query(
    `SELECT * FROM newsletter_suppressions WHERE email = $1 AND active = true ORDER BY created_at DESC LIMIT 1`,
    [normalizeEmail(email)],
  )
  return result.rows[0] || null
}

async function createSuppression(db, { subscriberId, email, reason, actorUserId = null, metadata = {} }) {
  await db.query(
    `
    INSERT INTO newsletter_suppressions (subscriber_id, email, reason, actor_user_id, metadata)
    VALUES ($1, $2, $3, $4, $5::jsonb)
    ON CONFLICT (email) WHERE active = true
    DO UPDATE SET subscriber_id = EXCLUDED.subscriber_id, reason = EXCLUDED.reason,
      actor_user_id = EXCLUDED.actor_user_id, metadata = EXCLUDED.metadata, updated_at = now()
    `,
    [subscriberId, normalizeEmail(email), reason, actorUserId, JSON.stringify(metadata)],
  )
}

async function upsertSubscriber(db, input, context = {}) {
  const email = normalizeEmail(input.email)
  if (!isValidEmail(email)) throw new Error('A valid email address is required.')

  const source = normalizeLabel(input.source, 120) || context.source || 'admin_manual'
  const explicitConsent = input.explicitConsent === true || input.consentStatus === 'granted'
  const requestedStatus = AUDIENCE_STATUSES.has(input.status) ? input.status : (explicitConsent ? 'subscribed' : 'pending')
  await db.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [email])
  const existingResult = await db.query(`SELECT * FROM subscribers WHERE email = $1 FOR UPDATE`, [email])
  const existing = existingResult.rows[0] || null
  const suppression = await getActiveSuppression(db, email)
  let status = requestedStatus
  let consentStatus = CONSENT_STATUSES.has(input.consentStatus) ? input.consentStatus : (explicitConsent ? 'granted' : 'not_recorded')
  let suppressionBlocked = false

  if (existing?.consent_status === 'granted' && !explicitConsent && requestedStatus === 'pending') {
    status = existing.status
    consentStatus = existing.consent_status
  }

  if (status === 'subscribed' && !explicitConsent && existing?.consent_status !== 'granted') {
    status = existing?.status === 'subscribed' ? 'subscribed' : 'pending'
    consentStatus = existing?.consent_status || 'not_recorded'
  }

  if (suppression && !SUPPRESSION_STATUSES.has(status)) {
    const canRestoreUnsubscribe = status === 'subscribed' && suppression.reason === 'unsubscribed' && explicitConsent
    if (canRestoreUnsubscribe) {
      await db.query(
        `UPDATE newsletter_suppressions SET active = false, lifted_at = now(), lifted_by_user_id = $2, updated_at = now() WHERE id = $1`,
        [suppression.id, context.actorUserId || null],
      )
    } else {
      status = suppression.reason === 'unsubscribed' ? 'unsubscribed' : (suppression.reason === 'manual' ? 'suppressed' : suppression.reason)
      consentStatus = status === 'unsubscribed' ? 'withdrawn' : (existing?.consent_status || consentStatus)
      suppressionBlocked = true
    }
  }

  const values = {
    firstName: normalizeLabel(input.firstName, 120) || existing?.first_name || '',
    lastName: normalizeLabel(input.lastName, 120) || existing?.last_name || '',
    notes: String(input.notes || '').trim().slice(0, 5000) || existing?.notes || '',
    customFields: input.customFields && typeof input.customFields === 'object' ? input.customFields : (existing?.custom_fields || {}),
    consentAt: explicitConsent ? (input.consentAt || existing?.consent_at || new Date().toISOString()) : existing?.consent_at || null,
  }

  let subscriber
  if (existing) {
    const updated = await db.query(
      `
      UPDATE subscribers SET
        first_name = $2, last_name = $3, status = $4, source = COALESCE(NULLIF($5, ''), source),
        consent_status = $6, consent_source = CASE WHEN $6 = 'granted' THEN $5 ELSE consent_source END,
        consent_at = $7, subscribed_at = CASE WHEN $4 = 'subscribed' THEN COALESCE(subscribed_at, $7, now()) ELSE subscribed_at END,
        unsubscribed_at = CASE WHEN $4 = 'unsubscribed' THEN now() WHEN $4 = 'subscribed' THEN NULL ELSE unsubscribed_at END,
        suppression_reason = CASE WHEN $4 IN ('bounced', 'complained', 'suppressed') THEN $4 WHEN $4 = 'unsubscribed' THEN 'unsubscribed' ELSE NULL END,
        notes = $8, custom_fields = $9::jsonb, client_profile_id = COALESCE($10, client_profile_id), updated_by_user_id = $11
      WHERE id = $1 RETURNING *
      `,
      [existing.id, values.firstName, values.lastName, status, source, consentStatus, values.consentAt, values.notes, JSON.stringify(values.customFields), input.clientProfileId || null, context.actorUserId || null],
    )
    subscriber = updated.rows[0]
  } else {
    const inserted = await db.query(
      `
      INSERT INTO subscribers (
        email, first_name, last_name, status, source, consent_status, consent_source,
        consent_at, subscribed_at, suppression_reason, notes, custom_fields, client_profile_id, created_by_user_id, updated_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $5, $7,
        CASE WHEN $4 = 'subscribed' THEN COALESCE($7, now()) ELSE NULL END,
        CASE WHEN $4 IN ('bounced', 'complained', 'suppressed') THEN $4 WHEN $4 = 'unsubscribed' THEN 'unsubscribed' ELSE NULL END,
        $8, $9::jsonb, $10, $11, $11)
      RETURNING *
      `,
      [email, values.firstName, values.lastName, status, source, consentStatus, values.consentAt, values.notes, JSON.stringify(values.customFields), input.clientProfileId || null, context.actorUserId || null],
    )
    subscriber = inserted.rows[0]
  }

  if (SUPPRESSION_STATUSES.has(status)) {
    await createSuppression(db, {
      subscriberId: subscriber.id,
      email,
      reason: suppressionReasonForStatus(status),
      actorUserId: context.actorUserId,
      metadata: { source },
    })
  }

  await syncTags(db, subscriber.id, input.tags)
  await syncSegments(db, subscriber.id, input.segments, context.actorUserId)
  await writeConsentEvent(db, {
    subscriberId: subscriber.id,
    eventType: existing ? 'subscriber_merged' : 'subscriber_created',
    statusBefore: existing?.status || null,
    statusAfter: subscriber.status,
    consentBefore: existing?.consent_status || null,
    consentAfter: subscriber.consent_status,
    source,
    actorUserId: context.actorUserId,
    metadata: { suppressionBlocked, importId: context.importId || null, clientProfileId: input.clientProfileId || null },
  })

  return { subscriber, created: !existing, suppressionBlocked }
}

module.exports = {
  AUDIENCE_STATUSES,
  CONSENT_STATUSES,
  SUPPRESSION_STATUSES,
  canReceiveNewsletter,
  createSuppression,
  getActiveSuppression,
  isValidEmail,
  mergeDuplicateRecipients,
  mergeSubscriberRecords,
  normalizeEmail,
  parseAudienceCsv,
  parseBooleanConsent,
  suppressionReasonForStatus,
  syncSegments,
  syncTags,
  uniqueLabels,
  upsertSubscriber,
  writeConsentEvent,
}
