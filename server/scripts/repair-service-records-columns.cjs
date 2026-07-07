const { pool } = require('../src/db/pool')

async function columnExists(tableName, columnName) {
  const result = await pool.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS exists
    `,
    [tableName, columnName],
  )

  return Boolean(result.rows[0]?.exists)
}

async function addColumnIfMissing(columnName, definition) {
  const exists = await columnExists('service_records', columnName)

  if (!exists) {
    console.log(`Adding service_records.${columnName}`)
    await pool.query(`ALTER TABLE service_records ADD COLUMN ${columnName} ${definition}`)
  } else {
    console.log(`service_records.${columnName} already exists`)
  }
}

async function main() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_profile_id uuid REFERENCES client_profiles(id) ON DELETE CASCADE,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `)

  await addColumnIfMissing('title', 'text')
  await addColumnIfMissing('service_name', 'text')
  await addColumnIfMissing('service_type', "text DEFAULT 'session_note'")
  await addColumnIfMissing('service_date', 'timestamp with time zone DEFAULT now()')
  await addColumnIfMissing('occurred_at', 'timestamp with time zone DEFAULT now()')
  await addColumnIfMissing('status', "text DEFAULT 'completed'")
  await addColumnIfMissing('summary', 'text')
  await addColumnIfMissing('notes', 'text')
  await addColumnIfMissing('description', 'text')
  await addColumnIfMissing('private_notes', 'text')
  await addColumnIfMissing('client_visible_notes', 'text')
  await addColumnIfMissing('follow_up_at', 'timestamp with time zone')
  await addColumnIfMissing('created_by_user_id', 'uuid REFERENCES system_users(id) ON DELETE SET NULL')

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_service_records_client_profile_id
    ON service_records(client_profile_id)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_service_records_service_date
    ON service_records(service_date DESC)
  `)

  console.log('\n=== service_records columns after repair ===')

  const columns = await pool.query(
    `
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_records'
    ORDER BY ordinal_position
    `,
  )

  console.table(columns.rows)

  console.log('\nservice_records table repair complete.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
