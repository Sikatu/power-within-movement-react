function normalizeCount(value) {
  const count = Number(value || 0)
  return Number.isFinite(count) && count > 0 ? count : 0
}

function makeCheck({
  id,
  category,
  title,
  status = 'pass',
  count = 0,
  detail,
  recommendation = '',
  metadata = {},
}) {
  return {
    id,
    category,
    title,
    status,
    count: normalizeCount(count),
    detail,
    recommendation,
    metadata,
  }
}

function buildIntegritySummary(checks = []) {
  const summary = checks.reduce(
    (result, check) => {
      result.total += 1
      if (check.status === 'critical') result.critical += 1
      else if (check.status === 'warning') result.warning += 1
      else result.passed += 1
      return result
    },
    { total: 0, passed: 0, warning: 0, critical: 0 },
  )

  return {
    ...summary,
    status: summary.critical > 0
      ? 'critical'
      : summary.warning > 0
        ? 'review'
        : 'healthy',
  }
}

function canonicalAccountCheck({ id, title, expectedRole, canonicalEmail, accounts }) {
  const matches = accounts.filter(
    (account) => String(account.email || '').toLowerCase() === canonicalEmail.toLowerCase(),
  )
  const correct = matches.filter(
    (account) => account.role === expectedRole && account.status === 'active',
  )

  if (correct.length === 1 && matches.length === 1) {
    return makeCheck({
      id,
      category: 'accounts',
      title,
      detail: `${canonicalEmail} is the single active ${expectedRole} account.`,
      metadata: { canonicalEmail, expectedRole },
    })
  }

  return makeCheck({
    id,
    category: 'accounts',
    title,
    status: 'critical',
    count: Math.max(matches.length, 1),
    detail: matches.length
      ? `${canonicalEmail} does not resolve to exactly one active ${expectedRole} account.`
      : `${canonicalEmail} is missing from system accounts.`,
    recommendation: 'Open Account Governance and reconcile canonical privileged accounts before deployment.',
    metadata: { canonicalEmail, expectedRole, matches: matches.length },
  })
}

function buildSecurityIntegrityChecks({
  accounts = [],
  staff = [],
  counts = {},
  runtime = {},
  canonicalDeveloperEmail = '',
  canonicalOwnerEmail = '',
  now = Date.now(),
}) {
  const checks = []

  checks.push(canonicalAccountCheck({
    id: 'canonical-developer',
    title: 'Canonical developer account',
    expectedRole: 'developer',
    canonicalEmail: canonicalDeveloperEmail,
    accounts,
  }))

  checks.push(canonicalAccountCheck({
    id: 'canonical-owner',
    title: 'Canonical owner account',
    expectedRole: 'owner',
    canonicalEmail: canonicalOwnerEmail,
    accounts,
  }))

  const additionalPrivileged = accounts.filter((account) => (
    account.status === 'active'
    && ['developer', 'owner'].includes(account.role)
    && ![
      canonicalDeveloperEmail.toLowerCase(),
      canonicalOwnerEmail.toLowerCase(),
    ].includes(String(account.email || '').toLowerCase())
  ))
  checks.push(makeCheck({
    id: 'privileged-account-scope',
    category: 'accounts',
    title: 'Privileged account scope',
    status: additionalPrivileged.length ? 'warning' : 'pass',
    count: additionalPrivileged.length,
    detail: additionalPrivileged.length
      ? `${additionalPrivileged.length} additional active owner or developer account${additionalPrivileged.length === 1 ? '' : 's'} require review.`
      : 'No unexpected active owner or developer accounts were found.',
    recommendation: additionalPrivileged.length
      ? 'Confirm each additional privileged account is intentional or suspend it.'
      : '',
  }))

  const expiredTemporary = accounts.filter((account) => {
    if (account.status !== 'active' || !account.must_change_password) return false
    const expiresAt = account.temporary_password_expires_at
      ? new Date(account.temporary_password_expires_at).getTime()
      : 0
    return !expiresAt || expiresAt <= now
  })
  checks.push(makeCheck({
    id: 'expired-temporary-access',
    category: 'accounts',
    title: 'Temporary-password lifecycle',
    status: expiredTemporary.length ? 'warning' : 'pass',
    count: expiredTemporary.length,
    detail: expiredTemporary.length
      ? `${expiredTemporary.length} active account${expiredTemporary.length === 1 ? ' has' : 's have'} an expired or missing temporary-password deadline.`
      : 'No active account is stranded on an expired temporary password.',
    recommendation: expiredTemporary.length
      ? 'Issue a fresh temporary password or suspend the affected account.'
      : '',
  }))

  const missingProfiles = staff.filter((member) => !member.profile_user_id)
  checks.push(makeCheck({
    id: 'staff-profile-coverage',
    category: 'permissions',
    title: 'Staff profile coverage',
    status: missingProfiles.length ? 'critical' : 'pass',
    count: missingProfiles.length,
    detail: missingProfiles.length
      ? `${missingProfiles.length} active staff account${missingProfiles.length === 1 ? ' is' : 's are'} missing a team profile.`
      : 'Every active staff account has a team profile.',
    recommendation: missingProfiles.length
      ? 'Create or repair the team profile before assigning client work.'
      : '',
  }))

  const missingPermissions = staff.filter((member) => !member.permissions_user_id)
  checks.push(makeCheck({
    id: 'staff-permission-coverage',
    category: 'permissions',
    title: 'Staff permission coverage',
    status: missingPermissions.length ? 'critical' : 'pass',
    count: missingPermissions.length,
    detail: missingPermissions.length
      ? `${missingPermissions.length} active staff account${missingPermissions.length === 1 ? ' has' : 's have'} no permission record.`
      : 'Every active staff account has an explicit permission record.',
    recommendation: missingPermissions.length
      ? 'Assign a least-privilege access template in Staff & Team Management.'
      : '',
  }))

  const unrestrictedStaff = staff.filter((member) => {
    const values = Object.entries(member)
      .filter(([key]) => key.endsWith('_access'))
      .map(([, value]) => value)
    return values.length > 0 && values.every((value) => value === 'manage')
  })
  checks.push(makeCheck({
    id: 'staff-least-privilege',
    category: 'permissions',
    title: 'Staff least-privilege review',
    status: unrestrictedStaff.length ? 'warning' : 'pass',
    count: unrestrictedStaff.length,
    detail: unrestrictedStaff.length
      ? `${unrestrictedStaff.length} staff account${unrestrictedStaff.length === 1 ? ' has' : 's have'} manage access across every Studio module.`
      : 'No staff account has unrestricted manage access across every module.',
    recommendation: unrestrictedStaff.length
      ? 'Confirm broad access is required and reduce permissions where practical.'
      : '',
  }))

  const orphanRecords = normalizeCount(counts.orphan_operational_records)
  checks.push(makeCheck({
    id: 'referential-integrity',
    category: 'data',
    title: 'Operational referential integrity',
    status: orphanRecords ? 'critical' : 'pass',
    count: orphanRecords,
    detail: orphanRecords
      ? `${orphanRecords} operational record${orphanRecords === 1 ? '' : 's'} no longer resolve to a valid client or user.`
      : 'Client care, session, conversation, resource, and assignment records retain valid ownership links.',
    recommendation: orphanRecords
      ? 'Review the integrity breakdown before any deployment or cleanup action.'
      : '',
    metadata: counts.orphan_breakdown || {},
  }))

  const roleMismatches = normalizeCount(counts.client_role_mismatches)
  checks.push(makeCheck({
    id: 'client-role-alignment',
    category: 'data',
    title: 'Client account role alignment',
    status: roleMismatches ? 'warning' : 'pass',
    count: roleMismatches,
    detail: roleMismatches
      ? `${roleMismatches} client profile${roleMismatches === 1 ? ' is' : 's are'} attached to a non-client system role.`
      : 'Client profiles are attached only to client system accounts.',
    recommendation: roleMismatches
      ? 'Inspect each profile before changing roles; a privileged email may have been reused as a client record.'
      : '',
  }))

  const staleTeamRows = normalizeCount(counts.stale_team_rows)
  checks.push(makeCheck({
    id: 'team-record-hygiene',
    category: 'data',
    title: 'Team record hygiene',
    status: staleTeamRows ? 'warning' : 'pass',
    count: staleTeamRows,
    detail: staleTeamRows
      ? `${staleTeamRows} team profile or permission row${staleTeamRows === 1 ? '' : 's'} belong to inactive or non-staff accounts.`
      : 'Team profiles and permissions align with active staff accounts.',
    recommendation: staleTeamRows
      ? 'Review role changes and remove stale team configuration after confirming historical needs.'
      : '',
  }))

  const invalidSessions = normalizeCount(counts.invalid_session_versions)
  checks.push(makeCheck({
    id: 'session-revocation-integrity',
    category: 'security',
    title: 'Session revocation integrity',
    status: invalidSessions ? 'critical' : 'pass',
    count: invalidSessions,
    detail: invalidSessions
      ? `${invalidSessions} active account${invalidSessions === 1 ? ' has' : 's have'} an invalid session-version value.`
      : 'Every active account has a valid revocable session version.',
    recommendation: invalidSessions
      ? 'Repair session versions and revoke affected sessions before launch.'
      : '',
  }))

  const insecureOrigins = (runtime.clientOrigins || []).filter((origin) => (
    runtime.isProduction
    && !String(origin).startsWith('https://')
  ))
  checks.push(makeCheck({
    id: 'trusted-origin-policy',
    category: 'security',
    title: 'Trusted mutation origins',
    status: insecureOrigins.length ? 'critical' : 'pass',
    count: insecureOrigins.length,
    detail: insecureOrigins.length
      ? `${insecureOrigins.length} production client origin${insecureOrigins.length === 1 ? ' is' : 's are'} not HTTPS.`
      : `${runtime.clientOrigins?.length || 0} approved client origin${runtime.clientOrigins?.length === 1 ? ' is' : 's are'} protected by the mutation-origin policy.`,
    recommendation: insecureOrigins.length
      ? 'Use HTTPS-only production origins before deployment.'
      : '',
  }))

  const weakSecret = Number(runtime.jwtSecretLength || 0) < 32
  checks.push(makeCheck({
    id: 'jwt-secret-strength',
    category: 'security',
    title: 'JWT signing secret strength',
    status: weakSecret ? (runtime.isProduction ? 'critical' : 'warning') : 'pass',
    count: weakSecret ? 1 : 0,
    detail: weakSecret
      ? 'The configured JWT secret is shorter than the recommended 32 characters.'
      : 'The JWT signing secret meets the minimum length check.',
    recommendation: weakSecret
      ? 'Set a unique high-entropy JWT_SECRET before production deployment.'
      : '',
  }))

  checks.push(makeCheck({
    id: 'cookie-policy',
    category: 'security',
    title: 'Protected cookie policy',
    status: runtime.cookieSecure || !runtime.isProduction ? 'pass' : 'critical',
    count: runtime.cookieSecure || !runtime.isProduction ? 0 : 1,
    detail: runtime.cookieSecure
      ? `Authentication cookies are Secure with SameSite=${runtime.cookieSameSite}.`
      : runtime.isProduction
        ? 'Production authentication cookies are not marked Secure.'
        : `Development cookies use SameSite=${runtime.cookieSameSite}.`,
    recommendation: runtime.cookieSecure || !runtime.isProduction
      ? ''
      : 'Enable COOKIE_SECURE before production deployment.',
  }))

  return checks
}

module.exports = {
  buildIntegritySummary,
  buildSecurityIntegrityChecks,
  makeCheck,
}
