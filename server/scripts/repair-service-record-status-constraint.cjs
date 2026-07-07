const { pool } = require('../src/db/pool')

async function main() {
  console.log('\n=== Existing service_records constraints ===')

  const before = await pool.query(`
    SELECT
      conname,
      pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'service_records'::regclass
    ORDER BY conname
  `)

  console.table(before.rows)

  await pool.query(`
    UPDATE service_records
    SET status = 'completed'
    WHERE status IS NULL
      OR trim(status) = ''
  `)

  await pool.query(`
    ALTER TABLE service_records
    DROP CONSTRAINT IF EXISTS service_records_status_check
  `)

  await pool.query(`
    ALTER TABLE service_records
    ADD CONSTRAINT service_records_status_check
    CHECK (
      status IN (
        'completed',
        'planned',
        'follow_up',
        'archived',
        'in_progress',
        'cancelled'
      )
    )
  `)

  console.log('\n=== Updated service_records constraints ===')

  const after = await pool.query(`
    SELECT
      conname,
      pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'service_records'::regclass
    ORDER BY conname
  `)

  console.table(after.rows)

  console.log('\nservice_records status constraint repaired.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
