const { env } = require('../config/env')
const { pool } = require('../db/pool')
const {
  buildIntegritySummary,
  buildSecurityIntegrityChecks,
} = require('./securityIntegritySignal')

const PERMISSION_COLUMNS = [
  'dashboard_access',
  'clients_access',
  'sessions_access',
  'inbox_access',
  'communications_access',
  'learning_access',
  'memberships_access',
  'circle_access',
  'encouragements_access',
  'audit_access',
]

async function getSecurityIntegritySnapshot(db = pool) {
  if (!db) {
    const error = new Error('Database is not configured.')
    error.statusCode = 503
    throw error
  }

  const [accountResult, staffResult, countResult] = await Promise.all([
    db.query(
      `
      SELECT
        id,
        email,
        role,
        status,
        must_change_password,
        temporary_password_expires_at,
        session_version,
        last_login_at,
        updated_at
      FROM system_users
      WHERE role IN ('developer', 'owner')
         OR lower(email) IN (lower($1), lower($2))
         OR must_change_password = true
      ORDER BY role, lower(email)
      `,
      [env.canonicalDeveloperEmail, env.canonicalOwnerEmail],
    ),
    db.query(
      `
      SELECT
        su.id,
        su.email,
        tmp.user_id AS profile_user_id,
        tmp.display_name,
        tmp.availability_status,
        tmp.capacity_percent,
        tmp.is_assignable,
        tmper.user_id AS permissions_user_id,
        ${PERMISSION_COLUMNS.map((column) => `tmper.${column}`).join(',\n        ')}
      FROM system_users su
      LEFT JOIN team_member_profiles tmp ON tmp.user_id = su.id
      LEFT JOIN team_member_permissions tmper ON tmper.user_id = su.id
      WHERE su.role = 'staff'
        AND su.status = 'active'
      ORDER BY lower(su.email)
      `,
    ),
    db.query(
      `
      SELECT
        (
          (SELECT count(*) FROM client_profiles cp LEFT JOIN system_users su ON su.id = cp.user_id WHERE su.id IS NULL)
          + (SELECT count(*) FROM team_client_assignments tca LEFT JOIN system_users su ON su.id = tca.team_user_id LEFT JOIN client_profiles cp ON cp.id = tca.client_profile_id WHERE su.id IS NULL OR cp.id IS NULL)
          + (SELECT count(*) FROM client_care_actions cca LEFT JOIN client_profiles cp ON cp.id = cca.client_profile_id WHERE cp.id IS NULL)
          + (SELECT count(*) FROM bookings b LEFT JOIN client_profiles cp ON cp.id = b.client_profile_id WHERE b.client_profile_id IS NOT NULL AND cp.id IS NULL)
          + (SELECT count(*) FROM booking_change_requests bcr LEFT JOIN client_profiles cp ON cp.id = bcr.client_profile_id WHERE cp.id IS NULL)
          + (SELECT count(*) FROM client_conversations cc LEFT JOIN client_profiles cp ON cp.id = cc.client_profile_id WHERE cp.id IS NULL)
          + (SELECT count(*) FROM service_records sr LEFT JOIN client_profiles cp ON cp.id = sr.client_profile_id WHERE cp.id IS NULL)
          + (SELECT count(*) FROM client_portal_resources cpr LEFT JOIN client_profiles cp ON cp.id = cpr.client_profile_id WHERE cp.id IS NULL)
        )::int AS orphan_operational_records,
        jsonb_build_object(
          'clientProfiles', (SELECT count(*)::int FROM client_profiles cp LEFT JOIN system_users su ON su.id = cp.user_id WHERE su.id IS NULL),
          'teamAssignments', (SELECT count(*)::int FROM team_client_assignments tca LEFT JOIN system_users su ON su.id = tca.team_user_id LEFT JOIN client_profiles cp ON cp.id = tca.client_profile_id WHERE su.id IS NULL OR cp.id IS NULL),
          'careActions', (SELECT count(*)::int FROM client_care_actions cca LEFT JOIN client_profiles cp ON cp.id = cca.client_profile_id WHERE cp.id IS NULL),
          'bookings', (SELECT count(*)::int FROM bookings b LEFT JOIN client_profiles cp ON cp.id = b.client_profile_id WHERE b.client_profile_id IS NOT NULL AND cp.id IS NULL),
          'changeRequests', (SELECT count(*)::int FROM booking_change_requests bcr LEFT JOIN client_profiles cp ON cp.id = bcr.client_profile_id WHERE cp.id IS NULL),
          'conversations', (SELECT count(*)::int FROM client_conversations cc LEFT JOIN client_profiles cp ON cp.id = cc.client_profile_id WHERE cp.id IS NULL),
          'serviceRecords', (SELECT count(*)::int FROM service_records sr LEFT JOIN client_profiles cp ON cp.id = sr.client_profile_id WHERE cp.id IS NULL),
          'portalResources', (SELECT count(*)::int FROM client_portal_resources cpr LEFT JOIN client_profiles cp ON cp.id = cpr.client_profile_id WHERE cp.id IS NULL)
        ) AS orphan_breakdown,
        (
          SELECT count(*)::int
          FROM client_profiles cp
          JOIN system_users su ON su.id = cp.user_id
          WHERE su.role <> 'client'
        ) AS client_role_mismatches,
        (
          (SELECT count(*) FROM team_member_profiles tmp JOIN system_users su ON su.id = tmp.user_id WHERE su.role <> 'staff' OR su.status <> 'active')
          + (SELECT count(*) FROM team_member_permissions tmper JOIN system_users su ON su.id = tmper.user_id WHERE su.role <> 'staff' OR su.status <> 'active')
        )::int AS stale_team_rows,
        (
          SELECT count(*)::int
          FROM system_users
          WHERE status = 'active'
            AND COALESCE(session_version, 0) < 1
        ) AS invalid_session_versions
      `,
    ),
  ])

  const counts = countResult.rows[0] || {}
  const checks = buildSecurityIntegrityChecks({
    accounts: accountResult.rows,
    staff: staffResult.rows,
    counts,
    runtime: {
      isProduction: env.isProduction,
      clientOrigins: env.clientOrigins,
      cookieSecure: env.cookieSecure,
      cookieSameSite: env.cookieSameSite,
      jwtSecretLength: env.jwtSecret.length,
    },
    canonicalDeveloperEmail: env.canonicalDeveloperEmail,
    canonicalOwnerEmail: env.canonicalOwnerEmail,
  })

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: buildIntegritySummary(checks),
    runtime: {
      environment: env.nodeEnv,
      approvedOriginCount: env.clientOrigins.length,
      cookieSecure: env.cookieSecure,
      cookieSameSite: env.cookieSameSite,
      jwtAlgorithm: 'HS256',
      mutationOriginProtection: true,
      sensitiveResponseCaching: 'no-store',
    },
    checks,
    staff: staffResult.rows.map((member) => ({
      id: member.id,
      email: member.email,
      displayName: member.display_name || member.email,
      hasProfile: Boolean(member.profile_user_id),
      hasPermissions: Boolean(member.permissions_user_id),
      availabilityStatus: member.availability_status || 'unconfigured',
      capacityPercent: member.capacity_percent === null
        ? null
        : Number(member.capacity_percent),
    })),
  }
}

module.exports = {
  getSecurityIntegritySnapshot,
}
