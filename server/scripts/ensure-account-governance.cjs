const { pool } = require('../src/db/pool')
const {
  ensureGovernanceSettings,
  getAccountGovernanceSnapshot,
  reconcileCanonicalAccounts,
} = require('../src/services/accountGovernance.service')

async function main() {
  if (!pool) {
    throw new Error('Database is not configured.')
  }

  await ensureGovernanceSettings(pool)
  const before = await getAccountGovernanceSnapshot(pool)

  console.log('\nAccount Governance configuration is ready.')
  console.log(`Canonical Developer: ${before.canonical.developerEmail}`)
  console.log(`Canonical Owner: ${before.canonical.ownerEmail}`)

  if (!before.developer || !before.owner) {
    console.log('\nCanonical accounts were not changed because one or more accounts are missing.')
    console.table([
      {
        identity: 'Developer',
        email: before.canonical.developerEmail,
        exists: Boolean(before.developer),
        role: before.developer?.role || 'missing',
        status: before.developer?.status || 'missing',
      },
      {
        identity: 'Owner',
        email: before.canonical.ownerEmail,
        exists: Boolean(before.owner),
        role: before.owner?.role || 'missing',
        status: before.owner?.status || 'missing',
      },
    ])
    return
  }

  const after = await reconcileCanonicalAccounts(pool)

  console.log('\nCanonical roles and Founder availability ownership are reconciled.')
  console.table([
    {
      identity: 'Developer',
      email: after.developer?.email,
      role: after.developer?.role,
      status: after.developer?.status,
    },
    {
      identity: 'Owner',
      email: after.owner?.email,
      role: after.owner?.role,
      status: after.owner?.status,
    },
    {
      identity: 'Founder Availability',
      email: after.founderAvailability?.owner_email || 'unassigned',
      role: after.founderAvailability?.owner_role || 'unassigned',
      status: after.founderAvailability?.owner_status || 'unassigned',
    },
  ])
}

main()
  .catch((error) => {
    console.error('Account Governance migration failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool?.end()
  })
