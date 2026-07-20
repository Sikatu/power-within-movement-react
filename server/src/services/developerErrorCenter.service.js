const crypto = require('crypto')
const { env } = require('../config/env')
const { pool } = require('../db/pool')

const SOURCES = ['backend', 'frontend', 'api', 'database', 'uptime', 'asset', 'schema', 'worker']
const SEVERITIES = ['low', 'medium', 'high', 'critical']
const STATUSES = ['open', 'investigating', 'resolved', 'ignored']

const DEFAULT_SETTINGS = {
  enabled: true,
  frontendCaptureEnabled: true,
  uptimeChecksEnabled: true,
  criticalNotificationsEnabled: true,
  retentionDays: 90,
  uptimeIntervalMinutes: 5,
  slowResponseThresholdMs: 4000,
}

const SECRET_KEY_PATTERN = /password|passwd|token|secret|authorization|cookie|api[_-]?key|session|credit|card|cvv/i
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi

function clampText(value, maxLength = 4000) {
  return String(value ?? '').slice(0, maxLength)
}

function redactText(value, maxLength = 4000) {
  return clampText(value, maxLength)
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
}

function sanitizeValue(value, depth = 0) {
  if (depth > 4) return '[MAX_DEPTH]'
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return redactText(value, 2000)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizeValue(item, depth + 1))
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 60)
        .map(([key, item]) => [
          key,
          SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitizeValue(item, depth + 1),
        ]),
    )
  }
  return redactText(value, 500)
}

function normalizeRoute(value) {
  if (!value) return null
  const route = String(value).split('?')[0].slice(0, 500)
  return route.replace(UUID_PATTERN, ':id')
}

function normalizeMessageForFingerprint(value) {
  return redactText(value, 1000)
    .replace(UUID_PATTERN, ':id')
    .replace(/\b\d{3,}\b/g, ':number')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function createFingerprint(input = {}) {
  const fingerprintInput = input.detectorKey
    ? [input.source || 'backend', input.detectorKey].join('|')
    : [
        input.source || 'backend',
        input.title || '',
        normalizeMessageForFingerprint(input.message || ''),
        normalizeRoute(input.route) || '',
        String(input.method || '').toUpperCase(),
        input.httpStatus || '',
      ].join('|')

  return crypto.createHash('sha256').update(fingerprintInput).digest('hex')
}

function normalizeSettings(value = {}) {
  const retentionDays = Number(value.retentionDays ?? value.retention_days)
  const uptimeIntervalMinutes = Number(value.uptimeIntervalMinutes ?? value.uptime_interval_minutes)
  const slowResponseThresholdMs = Number(value.slowResponseThresholdMs ?? value.slow_response_threshold_ms)

  return {
    enabled: value.enabled === undefined ? DEFAULT_SETTINGS.enabled : Boolean(value.enabled),
    frontendCaptureEnabled:
      value.frontendCaptureEnabled === undefined
        ? value.frontend_capture_enabled === undefined
          ? DEFAULT_SETTINGS.frontendCaptureEnabled
          : Boolean(value.frontend_capture_enabled)
        : Boolean(value.frontendCaptureEnabled),
    uptimeChecksEnabled:
      value.uptimeChecksEnabled === undefined
        ? value.uptime_checks_enabled === undefined
          ? DEFAULT_SETTINGS.uptimeChecksEnabled
          : Boolean(value.uptime_checks_enabled)
        : Boolean(value.uptimeChecksEnabled),
    criticalNotificationsEnabled:
      value.criticalNotificationsEnabled === undefined
        ? value.critical_notifications_enabled === undefined
          ? DEFAULT_SETTINGS.criticalNotificationsEnabled
          : Boolean(value.critical_notifications_enabled)
        : Boolean(value.criticalNotificationsEnabled),
    retentionDays: Number.isFinite(retentionDays)
      ? Math.min(Math.max(Math.round(retentionDays), 7), 365)
      : DEFAULT_SETTINGS.retentionDays,
    uptimeIntervalMinutes: Number.isFinite(uptimeIntervalMinutes)
      ? Math.min(Math.max(Math.round(uptimeIntervalMinutes), 1), 60)
      : DEFAULT_SETTINGS.uptimeIntervalMinutes,
    slowResponseThresholdMs: Number.isFinite(slowResponseThresholdMs)
      ? Math.min(Math.max(Math.round(slowResponseThresholdMs), 500), 30000)
      : DEFAULT_SETTINGS.slowResponseThresholdMs,
  }
}

async function getErrorCenterSettings(db = pool) {
  if (!db) return { ...DEFAULT_SETTINGS }

  const result = await db.query(
    `SELECT value FROM platform_settings WHERE key = 'developer_error_center' LIMIT 1`,
  )

  return normalizeSettings(result.rows[0]?.value || {})
}

async function saveErrorCenterSettings(value, actorUserId, db = pool) {
  if (!db) throw new Error('Database is not configured.')
  const settings = normalizeSettings(value)

  await db.query(
    `
    INSERT INTO platform_settings (key, value, updated_by_user_id)
    VALUES ('developer_error_center', $1::jsonb, $2)
    ON CONFLICT (key)
    DO UPDATE SET
      value = EXCLUDED.value,
      updated_by_user_id = EXCLUDED.updated_by_user_id,
      updated_at = now()
    `,
    [JSON.stringify(settings), actorUserId || null],
  )

  return settings
}

async function notifyDevelopers(errorRow, settings, db = pool) {
  if (!db || !settings.criticalNotificationsEnabled) return
  if (!['high', 'critical'].includes(errorRow.severity)) return

  const hourKey = new Date().toISOString().slice(0, 13)
  const developers = await db.query(
    `SELECT id FROM system_users WHERE role = 'developer' AND status = 'active'`,
  )

  for (const developer of developers.rows) {
    await db.query(
      `
      INSERT INTO notifications (
        recipient_user_id,
        category,
        title,
        body,
        action_url,
        action_label,
        entity_type,
        entity_id,
        importance,
        dedupe_key
      )
      VALUES ($1, 'system', $2, $3, '/admin/developer/errors', 'Review error',
              'application_errors', $4, $5, $6)
      ON CONFLICT (dedupe_key)
        WHERE dedupe_key IS NOT NULL
      DO NOTHING
      `,
      [
        developer.id,
        `${errorRow.severity === 'critical' ? 'Critical' : 'High'} production error detected`,
        clampText(`${errorRow.title}: ${errorRow.message}`, 500),
        errorRow.id,
        errorRow.severity === 'critical' ? 'urgent' : 'high',
        `developer-error:${developer.id}:${errorRow.fingerprint}:${hourKey}`,
      ],
    )
  }
}

async function captureApplicationError(input = {}, db = pool) {
  if (!db) return null

  try {
    const settings = await getErrorCenterSettings(db)
    if (!settings.enabled) return null
    if (input.source === 'frontend' && !settings.frontendCaptureEnabled) return null

    const source = SOURCES.includes(input.source) ? input.source : 'backend'
    const severity = SEVERITIES.includes(input.severity) ? input.severity : 'medium'
    const title = redactText(input.title || 'Application error', 250) || 'Application error'
    const message = redactText(input.message || 'No error message was provided.', 6000)
    const route = normalizeRoute(input.route)
    const fingerprint = input.fingerprint || createFingerprint({ ...input, source, title, message, route })
    const metadata = sanitizeValue(input.metadata || {})
    const stackTrace = redactText(input.stackTrace || input.stack || '', 20000) || null

    const result = await db.query(
      `
      INSERT INTO application_errors (
        fingerprint,
        detector_key,
        source,
        severity,
        status,
        title,
        message,
        stack_trace,
        route,
        method,
        http_status,
        request_id,
        user_id,
        user_role,
        build_version,
        browser,
        metadata
      )
      VALUES (
        $1, $2, $3, $4, 'open', $5, $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16::jsonb
      )
      ON CONFLICT ON CONSTRAINT application_errors_fingerprint_unique
      DO UPDATE SET
        detector_key = COALESCE(EXCLUDED.detector_key, application_errors.detector_key),
        source = EXCLUDED.source,
        severity = CASE
          WHEN application_errors.severity = 'critical' THEN 'critical'
          WHEN EXCLUDED.severity = 'critical' THEN 'critical'
          WHEN application_errors.severity = 'high' THEN 'high'
          WHEN EXCLUDED.severity = 'high' THEN 'high'
          WHEN application_errors.severity = 'medium' THEN 'medium'
          ELSE EXCLUDED.severity
        END,
        status = CASE
          WHEN application_errors.status = 'ignored' THEN 'ignored'
          ELSE 'open'
        END,
        title = EXCLUDED.title,
        message = EXCLUDED.message,
        stack_trace = COALESCE(EXCLUDED.stack_trace, application_errors.stack_trace),
        route = COALESCE(EXCLUDED.route, application_errors.route),
        method = COALESCE(EXCLUDED.method, application_errors.method),
        http_status = COALESCE(EXCLUDED.http_status, application_errors.http_status),
        request_id = COALESCE(EXCLUDED.request_id, application_errors.request_id),
        user_id = COALESCE(EXCLUDED.user_id, application_errors.user_id),
        user_role = COALESCE(EXCLUDED.user_role, application_errors.user_role),
        build_version = COALESCE(EXCLUDED.build_version, application_errors.build_version),
        browser = COALESCE(EXCLUDED.browser, application_errors.browser),
        metadata = application_errors.metadata || EXCLUDED.metadata,
        occurrence_count = application_errors.occurrence_count + 1,
        last_seen_at = now(),
        resolved_at = CASE
          WHEN application_errors.status = 'ignored' THEN application_errors.resolved_at
          ELSE NULL
        END
      RETURNING *
      `,
      [
        fingerprint,
        input.detectorKey || null,
        source,
        severity,
        title,
        message,
        stackTrace,
        route,
        input.method ? String(input.method).toUpperCase().slice(0, 12) : null,
        Number.isInteger(Number(input.httpStatus)) ? Number(input.httpStatus) : null,
        input.requestId ? String(input.requestId).slice(0, 100) : null,
        input.userId || null,
        input.userRole ? String(input.userRole).slice(0, 80) : null,
        input.buildVersion ? String(input.buildVersion).slice(0, 120) : null,
        input.browser ? redactText(input.browser, 500) : null,
        JSON.stringify(metadata),
      ],
    )

    const row = result.rows[0]

    try {
      await notifyDevelopers(row, settings, db)
    } catch (notificationError) {
      console.error(
        'Developer Error Center persisted an error but could not notify developers:',
        notificationError.message,
      )
    }

    return row
  } catch (captureError) {
    console.error('Developer Error Center could not persist an error:', captureError.message)
    return null
  }
}

async function resolveDetectorError(detectorKey, db = pool) {
  if (!db || !detectorKey) return
  await db.query(
    `
    UPDATE application_errors
    SET status = 'resolved', resolved_at = now(), status_updated_at = now()
    WHERE detector_key = $1 AND status IN ('open', 'investigating')
    `,
    [detectorKey],
  )
}

function serializeError(row) {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    detectorKey: row.detector_key,
    source: row.source,
    severity: row.severity,
    status: row.status,
    title: row.title,
    message: row.message,
    stackTrace: row.stack_trace,
    route: row.route,
    method: row.method,
    httpStatus: row.http_status,
    requestId: row.request_id,
    userId: row.user_id,
    userRole: row.user_role,
    buildVersion: row.build_version,
    browser: row.browser,
    metadata: row.metadata || {},
    occurrenceCount: row.occurrence_count,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    statusUpdatedAt: row.status_updated_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function getErrorSummary(db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const result = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'open')::int AS open,
      COUNT(*) FILTER (WHERE status = 'investigating')::int AS investigating,
      COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
      COUNT(*) FILTER (WHERE status = 'ignored')::int AS ignored,
      COUNT(*) FILTER (
        WHERE severity = 'critical' AND status IN ('open', 'investigating')
      )::int AS critical,
      COUNT(*) FILTER (
        WHERE severity = 'high' AND status IN ('open', 'investigating')
      )::int AS high,
      COUNT(*) FILTER (
        WHERE last_seen_at >= now() - interval '24 hours'
      )::int AS last_24_hours,
      COALESCE(SUM(occurrence_count), 0)::int AS total_occurrences
    FROM application_errors
  `)

  const sourceResult = await db.query(`
    SELECT source, COUNT(*)::int AS count
    FROM application_errors
    WHERE status IN ('open', 'investigating')
    GROUP BY source
    ORDER BY count DESC, source
  `)

  return {
    ...result.rows[0],
    bySource: sourceResult.rows,
  }
}

async function getErrorCenterPersistenceHealth(db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const result = await db.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM pg_constraint constraint_record
        JOIN pg_class table_record
          ON table_record.oid = constraint_record.conrelid
        JOIN pg_namespace schema_record
          ON schema_record.oid = table_record.relnamespace
        JOIN pg_attribute attribute_record
          ON attribute_record.attrelid = table_record.oid
         AND attribute_record.attname = 'fingerprint'
        WHERE schema_record.nspname = current_schema()
          AND table_record.relname = 'application_errors'
          AND constraint_record.conname = 'application_errors_fingerprint_unique'
          AND constraint_record.contype = 'u'
          AND constraint_record.convalidated
          AND NOT constraint_record.condeferrable
          AND constraint_record.conkey = ARRAY[attribute_record.attnum]::smallint[]
      ) AS constraint_ready,
      (SELECT MAX(last_seen_at) FROM application_errors) AS last_captured_at
  `)

  const row = result.rows[0] || {}
  const constraintReady = Boolean(row.constraint_ready)

  return {
    status: constraintReady ? 'ready' : 'repair_required',
    constraintReady,
    lastCapturedAt: row.last_captured_at || null,
  }
}

async function listErrors(options = {}, db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const status = STATUSES.includes(options.status) ? options.status : null
  const severity = SEVERITIES.includes(options.severity) ? options.severity : null
  const source = SOURCES.includes(options.source) ? options.source : null
  const search = clampText(options.search || '', 200).trim() || null
  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200)
  const offset = Math.max(Number(options.offset) || 0, 0)

  const result = await db.query(
    `
    SELECT *
    FROM application_errors
    WHERE ($1::text IS NULL OR status = $1)
      AND ($2::text IS NULL OR severity = $2)
      AND ($3::text IS NULL OR source = $3)
      AND (
        $4::text IS NULL
        OR title ILIKE '%' || $4 || '%'
        OR message ILIKE '%' || $4 || '%'
        OR COALESCE(route, '') ILIKE '%' || $4 || '%'
      )
    ORDER BY
      CASE severity
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        ELSE 3
      END,
      CASE status
        WHEN 'open' THEN 0
        WHEN 'investigating' THEN 1
        WHEN 'resolved' THEN 2
        ELSE 3
      END,
      last_seen_at DESC
    LIMIT $5 OFFSET $6
    `,
    [status, severity, source, search, limit, offset],
  )

  return result.rows.map(serializeError)
}

async function getErrorById(errorId, db = pool) {
  if (!db) throw new Error('Database is not configured.')
  const result = await db.query(`SELECT * FROM application_errors WHERE id = $1 LIMIT 1`, [errorId])
  return result.rows[0] ? serializeError(result.rows[0]) : null
}

async function updateErrorStatus(errorId, status, actorUserId, db = pool) {
  if (!db) throw new Error('Database is not configured.')
  if (!STATUSES.includes(status)) throw new Error('Invalid error status.')

  const result = await db.query(
    `
    UPDATE application_errors
    SET
      status = $2,
      status_updated_at = now(),
      status_updated_by = $3,
      resolved_at = CASE WHEN $2 = 'resolved' THEN now() ELSE NULL END
    WHERE id = $1
    RETURNING *
    `,
    [errorId, status, actorUserId || null],
  )

  return result.rows[0] ? serializeError(result.rows[0]) : null
}

async function deleteError(errorId, db = pool) {
  if (!db) throw new Error('Database is not configured.')
  const result = await db.query(`DELETE FROM application_errors WHERE id = $1 RETURNING id`, [errorId])
  return Boolean(result.rowCount)
}

async function cleanupErrors(db = pool) {
  if (!db) return 0
  const settings = await getErrorCenterSettings(db)
  const result = await db.query(
    `
    DELETE FROM application_errors
    WHERE last_seen_at < now() - ($1::int * interval '1 day')
      AND status IN ('resolved', 'ignored')
    `,
    [settings.retentionDays],
  )
  return result.rowCount
}

async function runSchemaDriftCheck(db = pool) {
  if (!db) return { ok: false, missing: ['database'] }

  const expected = {
    client_profiles: [
      'id',
      'user_id',
      'client_status',
      'public_contact_email',
      'lead_interest',
      'lead_source',
      'inquiry_received_at',
      'pipeline_stage',
    ],
    application_errors: ['id', 'fingerprint', 'source', 'severity', 'status', 'occurrence_count'],
  }

  const result = await db.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
  `, [Object.keys(expected)])

  const present = new Set(result.rows.map((row) => `${row.table_name}.${row.column_name}`))
  const missing = []

  for (const [tableName, columns] of Object.entries(expected)) {
    for (const column of columns) {
      const detectorKey = `schema:${tableName}.${column}`
      if (!present.has(`${tableName}.${column}`)) {
        missing.push(`${tableName}.${column}`)
        await captureApplicationError({
          detectorKey,
          source: 'schema',
          severity: 'critical',
          title: `Database schema drift: ${tableName}.${column}`,
          message: `The backend expects ${tableName}.${column}, but the production database does not contain it.`,
          metadata: { tableName, column },
        }, db)
      } else {
        await resolveDetectorError(detectorKey, db)
      }
    }
  }

  return { ok: missing.length === 0, missing }
}

async function checkUrl(name, url, settings, db = pool) {
  const detectorKey = `uptime:${name}`
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'PowerWithin-Internal-Monitor/1.0' },
    })
    const durationMs = Date.now() - startedAt

    if (!response.ok) {
      await captureApplicationError({
        detectorKey,
        source: 'uptime',
        severity: response.status >= 500 ? 'critical' : 'high',
        title: `${name} availability check failed`,
        message: `${url} returned HTTP ${response.status}.`,
        route: new URL(url).pathname,
        method: 'GET',
        httpStatus: response.status,
        metadata: { durationMs, url: new URL(url).origin },
      }, db)
      return { name, ok: false, status: response.status, durationMs }
    }

    if (durationMs > settings.slowResponseThresholdMs) {
      await captureApplicationError({
        detectorKey: `${detectorKey}:slow`,
        source: 'uptime',
        severity: 'medium',
        title: `${name} is responding slowly`,
        message: `${name} took ${durationMs} ms to respond.`,
        route: new URL(url).pathname,
        method: 'GET',
        httpStatus: response.status,
        metadata: { durationMs, thresholdMs: settings.slowResponseThresholdMs },
      }, db)
    } else {
      await resolveDetectorError(`${detectorKey}:slow`, db)
    }

    await resolveDetectorError(detectorKey, db)
    return { name, ok: true, status: response.status, durationMs }
  } catch (error) {
    const durationMs = Date.now() - startedAt
    await captureApplicationError({
      detectorKey,
      source: 'uptime',
      severity: 'critical',
      title: `${name} availability check failed`,
      message: error.name === 'AbortError' ? `${name} timed out.` : error.message,
      route: (() => { try { return new URL(url).pathname } catch { return null } })(),
      method: 'GET',
      metadata: { durationMs },
    }, db)
    return { name, ok: false, status: null, durationMs, error: error.message }
  } finally {
    clearTimeout(timeout)
  }
}

async function runUptimeChecks(db = pool) {
  if (!db) return []
  const settings = await getErrorCenterSettings(db)
  if (!settings.enabled || !settings.uptimeChecksEnabled) return []

  const baseUrl = String(env.publicSiteUrl || '').replace(/\/$/, '')
  if (!baseUrl) return []

  const checks = [
    ['Homepage', `${baseUrl}/`],
    ['Admin login', `${baseUrl}/admin/login`],
    ['Client Portal login', `${baseUrl}/client-portal/login`],
    ['Backend health', `${baseUrl}/api/health`],
  ]

  const results = []
  for (const [name, url] of checks) results.push(await checkUrl(name, url, settings, db))
  return results
}

async function runAllErrorChecks(db = pool) {
  const [schema, uptime] = await Promise.all([
    runSchemaDriftCheck(db),
    env.isProduction ? runUptimeChecks(db) : Promise.resolve([]),
  ])
  return { schema, uptime, checkedAt: new Date().toISOString() }
}

function installProcessErrorHandlers() {
  if (global.__pwcErrorHandlersInstalled) return
  global.__pwcErrorHandlersInstalled = true

  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason))
    console.error('Unhandled promise rejection:', error)
    captureApplicationError({
      source: 'worker',
      severity: 'high',
      title: 'Unhandled promise rejection',
      message: error.message,
      stackTrace: error.stack,
    }).catch(() => {})
  })

  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error)
    captureApplicationError({
      source: 'backend',
      severity: 'critical',
      title: 'Uncaught backend exception',
      message: error.message,
      stackTrace: error.stack,
    })
      .catch(() => {})
      .finally(() => {
        setTimeout(() => process.exit(1), 250).unref?.()
      })
  })
}

function startDeveloperErrorMonitor() {
  if (!pool || global.__pwcErrorMonitorStarted) return null
  global.__pwcErrorMonitorStarted = true

  let interval = null

  const schedule = async () => {
    try {
      const settings = await getErrorCenterSettings()
      if (!settings.enabled) return
      await runSchemaDriftCheck()
      if (env.isProduction && settings.uptimeChecksEnabled) await runUptimeChecks()
      await cleanupErrors()

      if (!interval) {
        interval = setInterval(() => {
          runAllErrorChecks().catch((error) => {
            captureApplicationError({
              source: 'worker',
              severity: 'high',
              title: 'Developer Error Center monitor failed',
              message: error.message,
              stackTrace: error.stack,
            }).catch(() => {})
          })
        }, settings.uptimeIntervalMinutes * 60_000)
        interval.unref?.()
      }
    } catch (error) {
      console.error('Developer Error Center startup check failed:', error.message)
    }
  }

  const initialTimer = setTimeout(schedule, 15_000)
  initialTimer.unref?.()
  return initialTimer
}

module.exports = {
  DEFAULT_SETTINGS,
  SEVERITIES,
  SOURCES,
  STATUSES,
  captureApplicationError,
  cleanupErrors,
  createFingerprint,
  deleteError,
  getErrorById,
  getErrorCenterPersistenceHealth,
  getErrorCenterSettings,
  getErrorSummary,
  installProcessErrorHandlers,
  listErrors,
  normalizeSettings,
  runAllErrorChecks,
  runSchemaDriftCheck,
  runUptimeChecks,
  sanitizeValue,
  saveErrorCenterSettings,
  startDeveloperErrorMonitor,
  updateErrorStatus,
}
