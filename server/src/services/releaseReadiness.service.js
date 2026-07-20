const { env } = require('../config/env')
const { getStorageStatus } = require('./assetStorage.service')
const { getTranscriptionConfiguration } = require('./founderTranscription.service')

const RELEASE_CANDIDATE_PHASE = 50
const RELEASE_CANDIDATE_REQUIRED_TABLES = [
  'system_users',
  'client_profiles',
  'bookings',
  'booking_change_requests',
  'audit_logs',
  'appointment_types',
  'client_portal_invites',
  'client_portal_resources',
  'encouragement_posts',
  'encouragement_recipients',
  'platform_settings',
  'team_member_profiles',
  'team_member_permissions',
  'team_client_assignments',
  'client_care_plans',
  'client_care_actions',
  'lead_follow_ups',
  'lead_pipeline_activities',
  'automation_workflows',
  'automation_steps',
  'automation_enrollments',
  'automation_step_runs',
  'mail_templates',
  'client_portal_email_logs',
  'booking_communications',
  'client_onboarding_records',
  'intake_form_templates',
  'intake_form_fields',
  'application_errors',
  'asset_folders',
  'assets',
  'asset_versions',
  'asset_assignments',
  'asset_access_grants',
  'asset_access_logs',
  'asset_relationships',
  'subscribers',
  'email_tags',
  'subscriber_tag_links',
  'newsletter_segments',
  'newsletter_segment_members',
  'newsletter_consent_events',
  'newsletter_suppressions',
  'newsletter_imports',
  'newsletter_send_history',
  'letter_documents',
  'letter_versions',
  'letter_templates',
  'letter_broadcasts',
  'letter_broadcast_recipients',
  'letter_test_sends',
  'letter_tracking_links',
  'letter_events',
  'founder_tool_preferences',
  'founder_recordings',
  'founder_transcription_jobs',
  'founder_recording_events',
  'courses',
  'course_modules',
  'course_lessons',
  'course_access',
  'lesson_progress',
  'memberships',
  'membership_enrollments',
  'membership_resources',
  'membership_course_links',
  'membership_announcements',
  'circle_posts',
  'circle_comments',
  'circle_reactions',
  'circle_reports',
  'client_conversations',
  'client_conversation_messages',
  'notifications',
  'notification_preferences',
  'studio_profiles',
]

// Retained as an internal compatibility alias for the established deployment tooling.
const PHASE30_REQUIRED_TABLES = RELEASE_CANDIDATE_REQUIRED_TABLES
const RELEASE_CANDIDATE_REQUIRED_CONSTRAINTS = [
  'application_errors_fingerprint_unique',
]
const RELEASE_CANDIDATE_REQUIRED_INDEXES = [
  'idx_notifications_dedupe_key',
]

function check({ id, title, category, status, detail, critical = true }) {
  return { id, title, category, status, detail, critical }
}

function isSecurePublicUrl(value) {
  try {
    return new URL(String(value || '')).protocol === 'https:'
  } catch {
    return false
  }
}

function summarizeChecks(checks = []) {
  const passed = checks.filter((item) => item.status === 'pass').length
  const review = checks.filter((item) => item.status === 'review').length
  const blocked = checks.filter((item) => item.status === 'block').length

  return {
    total: checks.length,
    passed,
    review,
    blocked,
    status: blocked ? 'blocked' : review ? 'review' : 'ready',
    automatedReady: blocked === 0 && review === 0,
  }
}

function buildReleaseReadinessSnapshot({
  config = env,
  storage = getStorageStatus(),
  transcription = getTranscriptionConfiguration(config),
  foundTables = [],
  foundConstraints = [],
  foundIndexes = [],
  databaseLatencyMs = null,
  databaseTime = null,
  founderTimezone = null,
  studioProfileCount = 0,
} = {}) {
  const production = config.nodeEnv === 'production'
  const found = new Set(foundTables)
  const foundConstraintSet = new Set(foundConstraints)
  const foundIndexSet = new Set(foundIndexes)
  const missingTables = RELEASE_CANDIDATE_REQUIRED_TABLES.filter((tableName) => !found.has(tableName))
  const missingConstraints = RELEASE_CANDIDATE_REQUIRED_CONSTRAINTS.filter(
    (constraintName) => !foundConstraintSet.has(constraintName),
  )
  const missingIndexes = RELEASE_CANDIDATE_REQUIRED_INDEXES.filter(
    (indexName) => !foundIndexSet.has(indexName),
  )
  const missingInvariants = [...missingConstraints, ...missingIndexes]
  const emailConfigured = Boolean(config.resendApiKey && (config.newsletterEmailFrom || config.portalEmailFrom))
  const secureJwtConfigured = Boolean(
    config.jwtSecret && config.jwtSecret !== 'change-this-dev-secret-before-production',
  )
  const publicUrlsSecure = isSecurePublicUrl(config.publicSiteUrl) && isSecurePublicUrl(config.publicApiUrl)
  const storageProductionReady = storage.configured && (!production || storage.driver === 's3')

  const checks = [
    check({
      id: 'production-runtime',
      title: 'Production-shaped runtime',
      category: 'Environment',
      status: production ? 'pass' : 'review',
      detail: production
        ? 'NODE_ENV is production.'
        : 'Run the live gate again in the production-shaped environment before deployment.',
    }),
    check({
      id: 'release-candidate-schema',
      title: 'Complete release-candidate schema',
      category: 'Database',
      status: missingTables.length ? 'block' : 'pass',
      detail: missingTables.length
        ? `Missing ${missingTables.length} required table${missingTables.length === 1 ? '' : 's'}.`
        : `${RELEASE_CANDIDATE_REQUIRED_TABLES.length} required tables are present.`,
    }),
    check({
      id: 'release-candidate-invariants',
      title: 'Persistence and deduplication invariants',
      category: 'Database',
      status: missingInvariants.length ? 'block' : 'pass',
      detail: missingInvariants.length
        ? `Missing required database invariant${missingInvariants.length === 1 ? '' : 's'}: ${missingInvariants.join(', ')}.`
        : 'Error capture and notification deduplication invariants are ready.',
    }),
    check({
      id: 'studio-profile-foundation',
      title: 'Primary Studio Profile',
      category: 'Studio identity',
      status: Number(studioProfileCount) === 1 ? 'pass' : 'block',
      detail: Number(studioProfileCount) === 1
        ? 'Exactly one primary Studio Profile is available.'
        : `Expected one primary Studio Profile; found ${Number(studioProfileCount) || 0}.`,
    }),
    check({
      id: 'database-latency',
      title: 'Database response',
      category: 'Database',
      status: Number(databaseLatencyMs) >= 2500 ? 'block' : Number(databaseLatencyMs) >= 1200 ? 'review' : 'pass',
      detail: databaseLatencyMs === null
        ? 'Database timing was not captured.'
        : `Database responded in ${databaseLatencyMs} ms.`,
    }),
    check({
      id: 'private-object-storage',
      title: 'Private object storage configuration',
      category: 'Storage',
      status: storageProductionReady ? 'pass' : storage.configured ? 'review' : 'block',
      detail: storageProductionReady
        ? `${storage.driver.toUpperCase()} storage is configured for authenticated delivery.`
        : storage.configured
          ? `${storage.driver.toUpperCase()} storage is configured; production requires the S3-compatible driver.`
          : 'The selected storage driver is incomplete.',
    }),
    check({
      id: 'short-lived-private-access',
      title: 'Short-lived private access',
      category: 'Storage',
      status: storage.privateDelivery === 'authenticated_proxy' && storage.accessGrants === 'short_lived_scoped'
        ? 'pass'
        : 'block',
      detail: 'Private files must use authenticated proxy delivery and scoped, expiring grants.',
    }),
    check({
      id: 'newsletter-provider',
      title: 'Newsletter delivery provider',
      category: 'Communication',
      status: emailConfigured ? 'pass' : 'block',
      detail: emailConfigured
        ? 'The newsletter provider credential and From address are configured.'
        : 'RESEND_API_KEY and a newsletter From address are required.',
    }),
    check({
      id: 'founder-transcription-provider',
      title: 'Founder transcription provider',
      category: 'Founder tools',
      status: transcription.configured ? 'pass' : 'block',
      detail: transcription.message,
    }),
    check({
      id: 'founder-primary-timezone',
      title: 'Founder primary timezone',
      category: 'Founder tools',
      status: founderTimezone === 'America/Chicago' ? 'pass' : 'review',
      detail: founderTimezone
        ? `Founder clock preference is ${founderTimezone}; scheduling timezone remains independent.`
        : 'No Founder preference row was found; the application default is America/Chicago.',
      critical: false,
    }),
    check({
      id: 'secure-authentication',
      title: 'Production authentication settings',
      category: 'Security',
      status: secureJwtConfigured && (!production || config.cookieSecure) ? 'pass' : 'block',
      detail: secureJwtConfigured && (!production || config.cookieSecure)
        ? 'JWT and cookie security configuration is production-shaped.'
        : 'A non-default JWT secret and secure production cookies are required.',
    }),
    check({
      id: 'secure-public-urls',
      title: 'HTTPS public endpoints',
      category: 'Security',
      status: publicUrlsSecure ? 'pass' : production ? 'block' : 'review',
      detail: publicUrlsSecure
        ? 'Public site and API URLs use HTTPS.'
        : 'Production PUBLIC_SITE_URL and PUBLIC_API_URL must use HTTPS.',
    }),
  ]

  return {
    ok: true,
    phase: RELEASE_CANDIDATE_PHASE,
    checkedAt: new Date().toISOString(),
    summary: summarizeChecks(checks),
    checks,
    database: {
      connected: true,
      latencyMs: databaseLatencyMs,
      time: databaseTime,
      requiredTableCount: RELEASE_CANDIDATE_REQUIRED_TABLES.length,
      foundTableCount: RELEASE_CANDIDATE_REQUIRED_TABLES.length - missingTables.length,
      missingTables,
      requiredConstraints: RELEASE_CANDIDATE_REQUIRED_CONSTRAINTS,
      missingConstraints,
      requiredIndexes: RELEASE_CANDIDATE_REQUIRED_INDEXES,
      missingIndexes,
      studioProfileCount: Number(studioProfileCount) || 0,
    },
    storage: {
      driver: storage.driver,
      configured: storage.configured,
      privateDelivery: storage.privateDelivery,
      accessGrants: storage.accessGrants,
      malwareScanner: storage.malwareScanner,
    },
    providers: {
      newsletterConfigured: emailConfigured,
      transcription: {
        provider: transcription.provider,
        configured: transcription.configured,
        status: transcription.status,
      },
    },
    environment: {
      name: config.nodeEnv,
      production,
      allowedClientOrigins: config.clientOrigins,
      secureCookies: config.cookieSecure,
      sameSite: config.cookieSameSite,
      publicSiteHttps: isSecurePublicUrl(config.publicSiteUrl),
      publicApiHttps: isSecurePublicUrl(config.publicApiUrl),
    },
    externalEvidenceRequired: true,
  }
}

async function getReleaseReadinessSnapshot(pool) {
  const startedAt = Date.now()
  const databaseResult = await pool.query('SELECT now() AS database_time')
  const databaseLatencyMs = Date.now() - startedAt
  const tablesResult = await pool.query(
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
    ORDER BY table_name
    `,
    [RELEASE_CANDIDATE_REQUIRED_TABLES],
  )

  const foundTables = tablesResult.rows.map((row) => row.table_name)
  const [constraintResult, indexResult] = await Promise.all([
    pool.query(
      `
      SELECT conname
      FROM pg_constraint
      WHERE conname = ANY($1::text[])
      `,
      [RELEASE_CANDIDATE_REQUIRED_CONSTRAINTS],
    ),
    pool.query(
      `
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])
      `,
      [RELEASE_CANDIDATE_REQUIRED_INDEXES],
    ),
  ])

  let founderTimezone = null
  if (foundTables.includes('founder_tool_preferences')) {
    const preferenceResult = await pool.query(
      `SELECT primary_timezone FROM founder_tool_preferences ORDER BY updated_at DESC LIMIT 1`,
    )
    founderTimezone = preferenceResult.rows[0]?.primary_timezone || null
  }

  let studioProfileCount = 0
  if (foundTables.includes('studio_profiles')) {
    const studioProfileResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM studio_profiles WHERE profile_key = 'primary'`,
    )
    studioProfileCount = Number(studioProfileResult.rows[0]?.count || 0)
  }

  return buildReleaseReadinessSnapshot({
    foundTables,
    foundConstraints: constraintResult.rows.map((row) => row.conname),
    foundIndexes: indexResult.rows.map((row) => row.indexname),
    databaseLatencyMs,
    databaseTime: databaseResult.rows[0]?.database_time,
    founderTimezone,
    studioProfileCount,
  })
}

module.exports = {
  PHASE30_REQUIRED_TABLES,
  RELEASE_CANDIDATE_PHASE,
  RELEASE_CANDIDATE_REQUIRED_CONSTRAINTS,
  RELEASE_CANDIDATE_REQUIRED_INDEXES,
  RELEASE_CANDIDATE_REQUIRED_TABLES,
  buildReleaseReadinessSnapshot,
  getReleaseReadinessSnapshot,
  summarizeChecks,
}
