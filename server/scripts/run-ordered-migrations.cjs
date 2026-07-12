const { spawnSync } = require('child_process')
const path = require('path')

const orderedMigrations = [
  'db:migrate-owner-password-reset',
  'db:migrate-founder-availability',
  'db:migrate-client-portal-foundation',
  'db:migrate-client-portal-invites',
  'db:migrate-developer-access',
  'db:migrate-developer-operations',
  'db:migrate-account-governance',
  'db:migrate-team-management',
  'db:migrate-client-360',
  'db:migrate-lead-pipeline',
  'db:migrate-automation-studio',
  'db:migrate-booking-onboarding',
  'db:migrate-learning-library',
  'db:migrate-membership-circle',
  'db:migrate-circle-community',
  'db:migrate-client-session-self-service',
  'db:migrate-secure-client-inbox',
  'db:migrate-notification-center',
]

function main() {
  const packageJson = require(path.resolve(__dirname, '..', 'package.json'))
  const availableScripts = packageJson.scripts || {}

  for (const scriptName of orderedMigrations) {
    if (!availableScripts[scriptName]) {
      console.log(`Skipping ${scriptName}; script is not present in this release.`)
      continue
    }

    console.log(`\n==========================================`)
    console.log(`Running ${scriptName}`)
    console.log(`==========================================`)

    const result = spawnSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['run', scriptName],
      {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
        env: process.env,
      },
    )

    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status || 1)
  }

  console.log('\nAll ordered database migrations completed successfully.')
}

try {
  main()
} catch (error) {
  console.error('Ordered migration runner failed:', error.message)
  process.exitCode = 1
}
