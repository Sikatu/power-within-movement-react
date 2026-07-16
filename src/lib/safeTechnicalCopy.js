const MAX_COPY_LENGTH = 12_000

const sensitiveValuePattern = /\b(authorization|password|passwd|secret|token|api[-_ ]?key|client[-_ ]?secret|cookie|set-cookie)\b\s*[:=]\s*([^\s,;]+)/gi
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi

export function redactTechnicalText(value) {
  return String(value || '')
    .replace(bearerPattern, 'Bearer [redacted]')
    .replace(sensitiveValuePattern, '$1=[redacted]')
    .replace(emailPattern, '[redacted-email]')
    .replace(uuidPattern, '[redacted-id]')
    .slice(0, MAX_COPY_LENGTH)
}

function summaryLines(error) {
  return [
    `Title: ${error?.title || 'Untitled error'}`,
    `Severity: ${error?.severity || 'unknown'}`,
    `Status: ${error?.status || 'unknown'}`,
    `Source: ${error?.source || 'unknown'}`,
    `Route: ${[error?.method, error?.route].filter(Boolean).join(' ') || 'not available'}`,
    `HTTP status: ${error?.httpStatus || 'not available'}`,
    `Occurrences: ${error?.occurrenceCount || 0}`,
    `First seen: ${error?.firstSeenAt || 'not available'}`,
    `Last seen: ${error?.lastSeenAt || 'not available'}`,
  ]
}

export function buildDeveloperErrorCopy(error, kind = 'summary') {
  if (!error) return ''

  let lines = summaryLines(error)
  if (kind === 'message') lines = [`Error: ${error.title || 'Untitled error'}`, '', error.message || 'No message recorded.']
  if (kind === 'stack') lines = [`Error: ${error.title || 'Untitled error'}`, '', error.stackTrace || 'No stack trace recorded.']

  return redactTechnicalText(lines.join('\n'))
}
