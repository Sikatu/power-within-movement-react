const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:8787')

let installed = false
let reporting = false
const recentFingerprints = new Map()

function normalizeMessage(value) {
  return String(value || 'Unknown frontend error').slice(0, 6000)
}

function shouldReport(payload) {
  const key = [payload.type, payload.message, payload.route, payload.httpStatus].join('|')
  const now = Date.now()
  const lastSeen = recentFingerprints.get(key) || 0

  if (now - lastSeen < 10_000) return false
  recentFingerprints.set(key, now)

  if (recentFingerprints.size > 100) {
    for (const [fingerprint, timestamp] of recentFingerprints) {
      if (now - timestamp > 60_000) recentFingerprints.delete(fingerprint)
    }
  }

  return true
}

function buildPayload(input = {}) {
  return {
    type: input.type || 'javascript',
    severity: input.severity || 'medium',
    title: String(input.title || 'Frontend application error').slice(0, 250),
    message: normalizeMessage(input.message),
    stack: input.stack ? String(input.stack).slice(0, 20000) : undefined,
    route: input.route || (typeof window !== 'undefined' ? window.location.pathname : undefined),
    method: input.method,
    httpStatus: input.httpStatus ?? null,
    buildVersion:
      input.buildVersion ||
      import.meta.env.VITE_APP_VERSION ||
      import.meta.env.VITE_GIT_COMMIT ||
      undefined,
    browser: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    metadata: input.metadata || {},
  }
}

export function reportClientError(input = {}) {
  if (reporting) return

  const payload = buildPayload(input)
  if (!shouldReport(payload)) return

  const url = `${API_BASE_URL}/api/public/error-reports`
  const body = JSON.stringify(payload)

  reporting = true

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      const accepted = navigator.sendBeacon(url, blob)
      if (accepted) return
    }

    fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Error reporting must never interrupt the application.
  } finally {
    window.setTimeout(() => {
      reporting = false
    }, 250)
  }
}

export function installGlobalErrorReporting() {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event) => {
    const target = event.target
    const assetUrl = target?.src || target?.href

    if (assetUrl && target !== window) {
      reportClientError({
        type: 'asset',
        severity: 'high',
        title: 'Frontend asset failed to load',
        message: `A required ${String(target.tagName || 'asset').toLowerCase()} resource failed to load.`,
        metadata: {
          assetPath: (() => {
            try {
              return new URL(assetUrl, window.location.origin).pathname
            } catch {
              return String(assetUrl).slice(0, 500)
            }
          })(),
          tagName: target.tagName || null,
        },
      })
      return
    }

    reportClientError({
      type: 'javascript',
      severity: 'high',
      title: 'Unhandled browser JavaScript error',
      message: event.message || event.error?.message || 'Unknown browser error',
      stack: event.error?.stack,
      metadata: {
        filename: event.filename ? String(event.filename).split('?')[0] : null,
        line: event.lineno || null,
        column: event.colno || null,
      },
    })
  }, true)

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    reportClientError({
      type: 'promise',
      severity: 'high',
      title: 'Unhandled frontend promise rejection',
      message: reason?.message || String(reason || 'Unknown promise rejection'),
      stack: reason?.stack,
    })
  })
}
