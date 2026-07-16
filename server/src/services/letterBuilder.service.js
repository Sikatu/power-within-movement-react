const crypto = require('crypto')

const LETTER_BLOCK_TYPES = new Set([
  'heading',
  'text',
  'image',
  'button',
  'divider',
  'spacer',
  'two_column',
  'quote',
  'signature',
  'social_links',
  'video_preview',
  'resource',
  'greeting',
  'footer',
  'unsubscribe',
])

const DEFAULT_SETTINGS = Object.freeze({
  backgroundColor: '#f6eee9',
  contentColor: '#fffdf9',
  textColor: '#4d343c',
  accentColor: '#7a3f50',
  mutedColor: '#8f727b',
  fontFamily: 'Georgia, serif',
  bodyFontFamily: 'Arial, sans-serif',
  contentWidth: 640,
})

const BLOCK_DEFAULTS = Object.freeze({
  heading: { content: { text: 'A heading for your letter', level: 2 }, settings: { align: 'center', padding: 20 } },
  text: { content: { text: 'Write your thoughtful message here.' }, settings: { align: 'left', padding: 16 } },
  image: { content: { assetId: '', alt: 'Power Within newsletter image', caption: '' }, settings: { align: 'center', padding: 12, width: 100 } },
  button: { content: { text: 'Continue your journey', url: 'https://powerwithinmovement.com' }, settings: { align: 'center', padding: 18 } },
  divider: { content: {}, settings: { padding: 14, color: '#dfcdbf' } },
  spacer: { content: {}, settings: { height: 32, padding: 0 } },
  two_column: { content: { left: 'A reflection for today.', right: 'A next step for tomorrow.' }, settings: { align: 'left', padding: 16, gap: 20 } },
  quote: { content: { text: 'You are not starting over. You are returning to yourself.', attribution: 'Power Within Collective' }, settings: { align: 'center', padding: 22 } },
  signature: { content: { name: 'Kim Mittelstadt', title: 'Power Within Collective' }, settings: { align: 'left', padding: 18 } },
  social_links: { content: { instagram: '', facebook: '', youtube: '', website: 'https://powerwithinmovement.com' }, settings: { align: 'center', padding: 16 } },
  video_preview: { content: { assetId: '', title: 'Watch this private reflection', url: '' }, settings: { align: 'center', padding: 16 } },
  resource: { content: { assetId: '', title: 'Download your resource', description: '' }, settings: { align: 'left', padding: 16 } },
  greeting: { content: { text: 'Hello {{firstName}},' }, settings: { align: 'left', padding: 16 } },
  footer: { content: { text: 'Power Within Collective · Thoughtful support for a new season.' }, settings: { align: 'center', padding: 18 } },
  unsubscribe: { content: { text: 'Unsubscribe from these letters' }, settings: { align: 'center', padding: 16 } },
})

function clamp(value, minimum, maximum, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback
}

function safeColor(value, fallback) {
  const color = String(value || '').trim()
  return /^(?:#[0-9a-f]{3}|#[0-9a-f]{4}|#[0-9a-f]{6}|#[0-9a-f]{8}|transparent)$/i.test(color) ? color : fallback
}

function safeAlign(value) {
  return ['left', 'center', 'right'].includes(value) ? value : 'left'
}

function safeFontFamily(value, fallback) {
  const allowed = new Set([
    'Georgia, serif',
    'Arial, sans-serif',
    'Helvetica, Arial, sans-serif',
    "'Trebuchet MS', Arial, sans-serif",
    "'Times New Roman', serif",
  ])
  return allowed.has(String(value || '')) ? String(value) : fallback
}

function safeUrl(value, { allowEmpty = true } = {}) {
  const url = String(value || '').trim()
  if (!url && allowEmpty) return ''
  try {
    const parsed = new URL(url)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) ? parsed.toString() : ''
  } catch {
    return ''
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;')
}

function randomBlockId(type = 'block') {
  return `${type}-${crypto.randomUUID()}`
}

function createLetterBlock(type, overrides = {}) {
  const normalizedType = LETTER_BLOCK_TYPES.has(type) ? type : 'text'
  const defaults = BLOCK_DEFAULTS[normalizedType]
  return {
    id: String(overrides.id || randomBlockId(normalizedType)).slice(0, 160),
    type: normalizedType,
    content: { ...defaults.content, ...(overrides.content || {}) },
    settings: { ...defaults.settings, ...(overrides.settings || {}) },
  }
}

function normalizeBlock(block, index = 0) {
  const normalized = createLetterBlock(block?.type, {
    ...block,
    id: block?.id || `block-${index + 1}-${crypto.randomUUID()}`,
  })
  normalized.settings = {
    ...normalized.settings,
    align: safeAlign(normalized.settings.align),
    padding: clamp(normalized.settings.padding, 0, 80, 16),
    backgroundColor: normalized.settings.backgroundColor
      ? safeColor(normalized.settings.backgroundColor, 'transparent')
      : 'transparent',
  }
  if (normalized.type === 'heading') normalized.content.level = clamp(normalized.content.level, 1, 3, 2)
  if (normalized.type === 'spacer') normalized.settings.height = clamp(normalized.settings.height, 4, 160, 32)
  if (normalized.type === 'image') normalized.settings.width = clamp(normalized.settings.width, 20, 100, 100)
  return normalized
}

function normalizeDesign(input = {}) {
  const settings = input.settings || {}
  const blocks = Array.isArray(input.blocks) ? input.blocks.slice(0, 100).map(normalizeBlock) : []
  const unsubscribeIndexes = blocks
    .map((block, index) => block.type === 'unsubscribe' ? index : -1)
    .filter((index) => index >= 0)

  if (!unsubscribeIndexes.length) blocks.push(createLetterBlock('unsubscribe'))
  if (unsubscribeIndexes.length > 1) {
    const keep = unsubscribeIndexes[unsubscribeIndexes.length - 1]
    blocks.splice(0, blocks.length, ...blocks.filter((block, index) => block.type !== 'unsubscribe' || index === keep))
  }
  const unsubscribe = blocks.find((block) => block.type === 'unsubscribe')
  blocks.splice(0, blocks.length, ...blocks.filter((block) => block.type !== 'unsubscribe'), unsubscribe)

  return {
    version: 1,
    settings: {
      backgroundColor: safeColor(settings.backgroundColor, DEFAULT_SETTINGS.backgroundColor),
      contentColor: safeColor(settings.contentColor, DEFAULT_SETTINGS.contentColor),
      textColor: safeColor(settings.textColor, DEFAULT_SETTINGS.textColor),
      accentColor: safeColor(settings.accentColor, DEFAULT_SETTINGS.accentColor),
      mutedColor: safeColor(settings.mutedColor, DEFAULT_SETTINGS.mutedColor),
      fontFamily: safeFontFamily(settings.fontFamily, DEFAULT_SETTINGS.fontFamily),
      bodyFontFamily: safeFontFamily(settings.bodyFontFamily, DEFAULT_SETTINGS.bodyFontFamily),
      contentWidth: clamp(settings.contentWidth, 420, 760, DEFAULT_SETTINGS.contentWidth),
    },
    blocks,
  }
}

function validateLetter({ title, subject, design }) {
  const normalized = normalizeDesign(design)
  const errors = []
  const warnings = []
  if (!String(title || '').trim()) errors.push('Letter title is required.')
  if (!String(subject || '').trim()) errors.push('Email subject is required.')
  if (!normalized.blocks.some((block) => block.type === 'unsubscribe')) errors.push('An unsubscribe block is required.')
  if (!normalized.blocks.some((block) => ['heading', 'text', 'quote', 'two_column'].includes(block.type))) warnings.push('Add at least one meaningful text block.')

  for (const block of normalized.blocks) {
    if (['image', 'resource'].includes(block.type) && !block.content.assetId) {
      warnings.push(`${block.type === 'image' ? 'Image' : 'Resource'} block ${block.id} does not have an Asset Vault selection.`)
    }
    if (['button', 'video_preview'].includes(block.type) && !safeUrl(block.content.url)) {
      warnings.push(`${block.type === 'button' ? 'Button' : 'Video'} block ${block.id} needs a safe destination URL.`)
    }
  }
  return { ok: errors.length === 0, errors, warnings, design: normalized }
}

function personalize(value, variables = {}) {
  return String(value || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const replacement = variables[key]
    return replacement === undefined || replacement === null ? '' : String(replacement)
  })
}

function paragraphHtml(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>')
}

function blockWrapper(block, content) {
  const settings = block.settings || {}
  return `<tr><td data-letter-block="${escapeAttribute(block.id)}" style="padding:${settings.padding}px;text-align:${settings.align};background:${safeColor(settings.backgroundColor, 'transparent')};">${content}</td></tr>`
}

function resolveTrackedUrl(block, destination, context) {
  const tracked = context.trackingUrls?.[block.id]
  return tracked || safeUrl(destination) || '#'
}

function renderBlock(block, context) {
  const { settings, variables } = context
  const content = block.content || {}
  const color = settings.textColor
  const accent = settings.accentColor
  const muted = settings.mutedColor
  const bodyFont = settings.bodyFontFamily
  const displayFont = settings.fontFamily

  if (block.type === 'heading') {
    const level = clamp(content.level, 1, 3, 2)
    const size = level === 1 ? 42 : level === 2 ? 32 : 24
    return blockWrapper(block, `<h${level} style="margin:0;color:${color};font-family:${displayFont};font-size:${size}px;font-weight:500;line-height:1.08;">${paragraphHtml(personalize(content.text, variables))}</h${level}>`)
  }
  if (block.type === 'text' || block.type === 'greeting') {
    const weight = block.type === 'greeting' ? 700 : 400
    return blockWrapper(block, `<div style="color:${color};font-family:${bodyFont};font-size:16px;font-weight:${weight};line-height:1.72;">${paragraphHtml(personalize(content.text, variables))}</div>`)
  }
  if (block.type === 'image') {
    const source = context.assetUrl?.(content.assetId, block) || ''
    if (!source) return blockWrapper(block, `<div style="padding:28px;border:1px dashed #d9c8bd;color:${muted};font-family:${bodyFont};font-size:13px;">Image selected from Asset Vault</div>`)
    const caption = content.caption ? `<p style="margin:9px 0 0;color:${muted};font-family:${bodyFont};font-size:12px;">${escapeHtml(content.caption)}</p>` : ''
    return blockWrapper(block, `<img src="${escapeAttribute(source)}" width="${Math.round(600 * (block.settings.width / 100))}" alt="${escapeAttribute(content.alt || '')}" style="display:inline-block;width:${block.settings.width}%;max-width:100%;height:auto;border:0;border-radius:12px;">${caption}`)
  }
  if (block.type === 'button') {
    const url = resolveTrackedUrl(block, content.url, context)
    return blockWrapper(block, `<a href="${escapeAttribute(url)}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:${accent};color:#fff;font-family:${bodyFont};font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(personalize(content.text, variables))}</a>`)
  }
  if (block.type === 'divider') {
    return blockWrapper(block, `<div style="height:1px;background:${safeColor(block.settings.color, '#dfcdbf')};font-size:0;line-height:0;">&nbsp;</div>`)
  }
  if (block.type === 'spacer') {
    return `<tr><td data-letter-block="${escapeAttribute(block.id)}" height="${block.settings.height}" style="height:${block.settings.height}px;font-size:0;line-height:0;">&nbsp;</td></tr>`
  }
  if (block.type === 'two_column') {
    return blockWrapper(block, `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="50%" valign="top" style="padding-right:${block.settings.gap / 2}px;color:${color};font-family:${bodyFont};font-size:15px;line-height:1.65;">${paragraphHtml(personalize(content.left, variables))}</td><td width="50%" valign="top" style="padding-left:${block.settings.gap / 2}px;color:${color};font-family:${bodyFont};font-size:15px;line-height:1.65;">${paragraphHtml(personalize(content.right, variables))}</td></tr></table>`)
  }
  if (block.type === 'quote') {
    const attribution = content.attribution ? `<p style="margin:12px 0 0;color:${muted};font-family:${bodyFont};font-size:12px;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(content.attribution)}</p>` : ''
    return blockWrapper(block, `<blockquote style="margin:0;color:${color};font-family:${displayFont};font-size:27px;font-style:italic;line-height:1.25;">“${escapeHtml(personalize(content.text, variables))}”</blockquote>${attribution}`)
  }
  if (block.type === 'signature') {
    return blockWrapper(block, `<p style="margin:0;color:${color};font-family:${displayFont};font-size:28px;font-style:italic;">${escapeHtml(content.name)}</p><p style="margin:5px 0 0;color:${muted};font-family:${bodyFont};font-size:12px;">${escapeHtml(content.title)}</p>`)
  }
  if (block.type === 'social_links') {
    const links = Object.entries(content).filter(([, url]) => safeUrl(url)).map(([name, url]) => `<a href="${escapeAttribute(safeUrl(url))}" style="margin:0 8px;color:${accent};font-family:${bodyFont};font-size:13px;text-decoration:underline;">${escapeHtml(name.replace(/\b\w/g, (letter) => letter.toUpperCase()))}</a>`).join('')
    return blockWrapper(block, links || `<span style="color:${muted};font-family:${bodyFont};font-size:13px;">Add social links in block settings.</span>`)
  }
  if (block.type === 'video_preview') {
    const assetSource = context.assetUrl?.(content.assetId, block) || ''
    const image = assetSource ? `<img src="${escapeAttribute(assetSource)}" alt="" width="560" style="display:block;width:100%;height:auto;border-radius:12px 12px 0 0;">` : ''
    return blockWrapper(block, `<a href="${escapeAttribute(resolveTrackedUrl(block, content.url, context))}" style="display:inline-block;max-width:560px;color:${accent};font-family:${bodyFont};font-size:15px;font-weight:700;text-decoration:none;">${image}<span style="display:block;padding:14px;border:1px solid #e6d7cc;border-radius:${image ? '0 0 12px 12px' : '12px'};">▶ ${escapeHtml(content.title)}</span></a>`)
  }
  if (block.type === 'resource') {
    const destination = context.assetUrl?.(content.assetId, block) || ''
    const url = context.trackingUrls?.[block.id] || destination || '#'
    return blockWrapper(block, `<a href="${escapeAttribute(url)}" style="display:block;padding:18px;border:1px solid #e3d2c5;border-radius:12px;color:${color};font-family:${bodyFont};text-decoration:none;"><strong style="display:block;color:${accent};font-size:15px;">↓ ${escapeHtml(content.title)}</strong><span style="display:block;margin-top:5px;color:${muted};font-size:13px;line-height:1.5;">${escapeHtml(content.description)}</span></a>`)
  }
  if (block.type === 'footer') {
    return blockWrapper(block, `<p style="margin:0;color:${muted};font-family:${bodyFont};font-size:12px;line-height:1.55;">${paragraphHtml(content.text)}</p>`)
  }
  if (block.type === 'unsubscribe') {
    return blockWrapper(block, `<a href="${escapeAttribute(context.unsubscribeUrl || '#')}" style="color:${muted};font-family:${bodyFont};font-size:11px;text-decoration:underline;">${escapeHtml(content.text || 'Unsubscribe')}</a>`)
  }
  return ''
}

function renderLetter({ design, subject, previewText = '', variables = {}, unsubscribeUrl = '#', openPixelUrl = '', trackingUrls = {}, assetUrl }) {
  const normalized = normalizeDesign(design)
  const settings = normalized.settings
  const rows = normalized.blocks.map((block) => renderBlock(block, { settings, variables, unsubscribeUrl, trackingUrls, assetUrl })).join('')
  const pixel = openPixelUrl ? `<img src="${escapeAttribute(openPixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;overflow:hidden;">` : ''
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(personalize(subject, variables))}</title></head><body style="margin:0;padding:0;background:${settings.backgroundColor};"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(personalize(previewText, variables))}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:${settings.backgroundColor};"><tr><td align="center" style="padding:28px 12px;"><table role="presentation" width="${settings.contentWidth}" cellspacing="0" cellpadding="0" style="width:100%;max-width:${settings.contentWidth}px;background:${settings.contentColor};border:1px solid #eadbd0;border-radius:24px;overflow:hidden;">${rows}</table><p style="margin:16px 0 0;color:${settings.mutedColor};font-family:${settings.bodyFontFamily};font-size:11px;">Power Within Collective</p></td></tr></table>${pixel}</body></html>`
  const text = normalized.blocks.map((block) => {
    const content = block.content || {}
    if (['heading', 'text', 'greeting', 'quote', 'footer'].includes(block.type)) return personalize(content.text, variables)
    if (block.type === 'two_column') return `${personalize(content.left, variables)}\n${personalize(content.right, variables)}`
    if (block.type === 'signature') return `${content.name}\n${content.title}`
    if (block.type === 'button') return `${personalize(content.text, variables)}: ${safeUrl(content.url)}`
    if (block.type === 'resource') return `${content.title}: ${assetUrl?.(content.assetId, block) || ''}`
    if (block.type === 'unsubscribe') return `${content.text}: ${unsubscribeUrl}`
    return ''
  }).filter(Boolean).join('\n\n')
  return { html, text, design: normalized }
}

function collectTrackedLinks(design) {
  return normalizeDesign(design).blocks.flatMap((block) => {
    if (['button', 'video_preview'].includes(block.type) && safeUrl(block.content.url)) {
      return [{ blockId: block.id, label: block.content.text || block.content.title || block.type, destinationUrl: safeUrl(block.content.url) }]
    }
    return []
  })
}

function encodeSignedToken(type, payload, secret, ttlSeconds = null, now = Date.now()) {
  if (!secret) throw new Error('Letter token secret is not configured.')
  const data = {
    v: 1,
    type,
    payload,
    issuedAt: Math.floor(now / 1000),
    expiresAt: ttlSeconds ? Math.floor(now / 1000) + ttlSeconds : null,
  }
  const encoded = Buffer.from(JSON.stringify(data)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

function decodeSignedToken(token, { type, secret, now = Date.now() }) {
  const [encoded, providedSignature] = String(token || '').split('.')
  if (!encoded || !providedSignature || !secret) throw new Error('Invalid letter link.')
  const expectedSignature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url')
  const expected = Buffer.from(expectedSignature)
  const provided = Buffer.from(providedSignature)
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) throw new Error('Invalid letter link.')
  let data
  try { data = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) } catch { throw new Error('Invalid letter link.') }
  if (data.type !== type) throw new Error('This letter link cannot be used here.')
  if (data.expiresAt && Math.floor(now / 1000) > data.expiresAt) throw new Error('This letter link has expired.')
  return data.payload
}

function verifyResendWebhook({ rawBody, webhookId, timestamp, signature, secret, now = Date.now() }) {
  if (!secret) return false
  const unixTimestamp = Number(timestamp)
  if (!Number.isFinite(unixTimestamp) || Math.abs(Math.floor(now / 1000) - unixTimestamp) > 300) return false
  const secretValue = secret.startsWith('whsec_') ? Buffer.from(secret.slice(6), 'base64') : Buffer.from(secret)
  const expected = crypto.createHmac('sha256', secretValue).update(`${webhookId}.${timestamp}.${rawBody}`).digest('base64')
  return String(signature || '').split(' ').some((part) => {
    const value = part.includes(',') ? part.split(',').pop() : part
    const expectedBuffer = Buffer.from(expected)
    const actualBuffer = Buffer.from(value || '')
    return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  })
}

module.exports = {
  BLOCK_DEFAULTS,
  DEFAULT_SETTINGS,
  LETTER_BLOCK_TYPES,
  collectTrackedLinks,
  createLetterBlock,
  decodeSignedToken,
  encodeSignedToken,
  escapeHtml,
  normalizeDesign,
  personalize,
  renderLetter,
  safeUrl,
  validateLetter,
  verifyResendWebhook,
}
