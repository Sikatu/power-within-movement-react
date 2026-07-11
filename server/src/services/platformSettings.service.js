const { pool } = require('../db/pool')

const SETTINGS_KEY = 'developer_operations'

const DEFAULT_FEATURE_FLAGS = {
  clientMessages: true,
  secureClientInbox: true,
  courses: true,
  memberships: true,
  circleCommunity: true,
  founderReports: false,
  adminBroadcasts: false,
  newClientDashboard: true,
  experimentalScheduler: false,
}

const DEFAULT_PLATFORM_SETTINGS = {
  maintenanceMode: false,
  maintenanceMessage: 'Power Within is receiving a brief update. Please try again shortly.',
  bookingsPaused: false,
  clientLoginsPaused: false,
  outgoingEmailPaused: false,
  featureFlags: DEFAULT_FEATURE_FLAGS,
}

function normalizePlatformSettings(value = {}) {
  const featureFlags = {
    ...DEFAULT_FEATURE_FLAGS,
    ...(value.featureFlags || {}),
  }

  return {
    ...DEFAULT_PLATFORM_SETTINGS,
    ...value,
    maintenanceMode: Boolean(value.maintenanceMode),
    bookingsPaused: Boolean(value.bookingsPaused),
    clientLoginsPaused: Boolean(value.clientLoginsPaused),
    outgoingEmailPaused: Boolean(value.outgoingEmailPaused),
    maintenanceMessage:
      String(value.maintenanceMessage || DEFAULT_PLATFORM_SETTINGS.maintenanceMessage)
        .trim()
        .slice(0, 300) || DEFAULT_PLATFORM_SETTINGS.maintenanceMessage,
    featureFlags,
  }
}

async function getPlatformSettings(db = pool) {
  if (!db) return normalizePlatformSettings()

  const result = await db.query(
    `
    SELECT value
    FROM platform_settings
    WHERE key = $1
    LIMIT 1
    `,
    [SETTINGS_KEY],
  )

  return normalizePlatformSettings(result.rows[0]?.value || {})
}

async function savePlatformSettings(value, updatedByUserId, db = pool) {
  const normalized = normalizePlatformSettings(value)

  const result = await db.query(
    `
    INSERT INTO platform_settings (
      key,
      value,
      updated_by_user_id
    )
    VALUES ($1, $2::jsonb, $3)
    ON CONFLICT (key)
    DO UPDATE SET
      value = EXCLUDED.value,
      updated_by_user_id = EXCLUDED.updated_by_user_id,
      updated_at = now()
    RETURNING key, value, updated_by_user_id, updated_at
    `,
    [SETTINGS_KEY, JSON.stringify(normalized), updatedByUserId || null],
  )

  return {
    ...result.rows[0],
    value: normalizePlatformSettings(result.rows[0]?.value || normalized),
  }
}

module.exports = {
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_PLATFORM_SETTINGS,
  getPlatformSettings,
  normalizePlatformSettings,
  savePlatformSettings,
}
