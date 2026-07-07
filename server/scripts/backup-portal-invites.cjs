const fs = require('fs')
const path = require('path')
const { pool } = require('../src/db/pool')

async function main() {
  const result = await pool.query(`
    SELECT *
    FROM client_portal_invites
    ORDER BY client_profile_id, created_at DESC
  `)

  const outputPath = path.resolve(
    '..',
    'power-within-movement-react-manual-backups',
    'phase-3-13q-dev-clean-portal-invite-history',
    'client_portal_invites_backup.json',
  )

  fs.writeFileSync(outputPath, JSON.stringify(result.rows, null, 2), 'utf8')
  console.log(`Backed up ${result.rowCount} portal invite rows.`)
  console.log(outputPath)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
