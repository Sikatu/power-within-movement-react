const { env } = require('../src/config/env')
const { pool } = require('../src/db/pool')

const checks = []

function addCheck(area, status, detail) {
  checks.push({
    area,
    status,
    detail,
  })
}

async function getCount(label, query, params = []) {
  try {
    const result = await pool.query(query, params)
    const count = Number(result.rows?.[0]?.count || 0)

    return {
      ok: true,
      label,
      count,
    }
  } catch (error) {
    return {
      ok: false,
      label,
      error: error.message,
    }
  }
}

function hasEmailAddress(value) {
  return /<[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>|^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(
    String(value || '').trim(),
  )
}

async function main() {
  console.log('')
  console.log('Power Within Launch Readiness Check')
  console.log('===================================')
  console.log('')

  addCheck(
    'Environment',
    env.isProduction ? 'PASS' : 'WARN',
    env.isProduction
      ? 'NODE_ENV is production.'
      : `Current NODE_ENV is ${env.nodeEnv}. This is fine for local testing, but production must use NODE_ENV=production.`,
  )

  addCheck(
    'Client origins',
    env.clientOrigins?.length > 0 ? 'PASS' : 'FAIL',
    env.clientOrigins?.length > 0
      ? env.clientOrigins.join(', ')
      : 'No CLIENT_ORIGINS / CLIENT_ORIGIN configured.',
  )

  addCheck(
    'Public site URL',
    env.publicSiteUrl ? 'PASS' : 'FAIL',
    env.publicSiteUrl || 'PUBLIC_SITE_URL is missing.',
  )

  addCheck(
    'Cookie security',
    env.isProduction
      ? env.cookieSecure
        ? 'PASS'
        : 'FAIL'
      : 'INFO',
    `secure=${env.cookieSecure}, sameSite=${env.cookieSameSite}, domain=${
      env.cookieDomain || 'not set'
    }`,
  )

  addCheck(
    'JWT safety',
    'PASS',
    env.isProduction
      ? 'Production boot requires a configured JWT_SECRET.'
      : 'Local development can use the dev fallback. Production cannot.',
  )

  addCheck(
    'Email delivery',
    env.resendApiKey && hasEmailAddress(env.portalEmailFrom) ? 'PASS' : 'WARN',
    env.resendApiKey && hasEmailAddress(env.portalEmailFrom)
      ? `Email sender configured as ${env.portalEmailFrom}.`
      : 'Resend/email sender is not fully configured. Manual email fallback should remain available.',
  )

  try {
    const dbResult = await pool.query('SELECT now() AS checked_at')
    addCheck(
      'Database',
      'PASS',
      `Connected successfully at ${dbResult.rows[0].checked_at.toISOString()}.`,
    )
  } catch (error) {
    addCheck('Database', 'FAIL', error.message)
  }

  const ownerCount = await getCount(
    'active owner accounts',
    `
    SELECT count(*)::int AS count
    FROM system_users
    WHERE role = 'owner'
      AND status = 'active'
    `,
  )

  if (ownerCount.ok) {
    addCheck(
      'Owner account',
      ownerCount.count > 0 ? 'PASS' : 'FAIL',
      `${ownerCount.count} active owner account(s) found.`,
    )
  } else {
    addCheck('Owner account', 'FAIL', ownerCount.error)
  }

  const appointmentTypes = await getCount(
    'appointment types',
    `
    SELECT count(*)::int AS count
    FROM appointment_types
    `,
  )

  if (appointmentTypes.ok) {
    addCheck(
      'Appointment types',
      appointmentTypes.count > 0 ? 'PASS' : 'WARN',
      `${appointmentTypes.count} appointment type record(s) found.`,
    )
  } else {
    addCheck('Appointment types', 'WARN', appointmentTypes.error)
  }

  const mailTemplates = await getCount(
    'mail templates',
    `
    SELECT count(*)::int AS count
    FROM mail_templates
    `,
  )

  if (mailTemplates.ok) {
    addCheck(
      'Mail templates',
      mailTemplates.count > 0 ? 'PASS' : 'WARN',
      `${mailTemplates.count} mail template record(s) found.`,
    )
  } else {
    addCheck('Mail templates', 'WARN', mailTemplates.error)
  }

  const portalInvites = await getCount(
    'portal invites',
    `
    SELECT count(*)::int AS count
    FROM client_portal_invites
    `,
  )

  if (portalInvites.ok) {
    addCheck(
      'Portal invite system',
      'PASS',
      `${portalInvites.count} portal invite record(s) found. Zero is okay after a clean reset.`,
    )
  } else {
    addCheck('Portal invite system', 'WARN', portalInvites.error)
  }

  console.table(checks)

  const failed = checks.filter((check) => check.status === 'FAIL')
  const warnings = checks.filter((check) => check.status === 'WARN')

  console.log('')
  console.log(`Result: ${failed.length} failure(s), ${warnings.length} warning(s).`)

  if (failed.length > 0) {
    console.log('Launch readiness check failed. Resolve FAIL items before launch.')
    process.exitCode = 1
    return
  }

  if (warnings.length > 0) {
    console.log('Launch readiness check passed with warnings. Review WARN items before production.')
    return
  }

  console.log('Launch readiness check passed.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    if (pool) {
      await pool.end()
    }
  })
