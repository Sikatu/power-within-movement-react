const { pool } = require('../src/db/pool')

async function main() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS availability_exceptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL DEFAULT 'Unavailable',
      exception_type text NOT NULL DEFAULT 'day',
      starts_at timestamp with time zone NOT NULL,
      ends_at timestamp with time zone NOT NULL,
      timezone text NOT NULL DEFAULT 'America/New_York',
      status text NOT NULL DEFAULT 'active',
      notes text,
      created_by_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      CONSTRAINT availability_exceptions_type_check
        CHECK (exception_type IN ('day', 'time_range', 'date_range')),
      CONSTRAINT availability_exceptions_status_check
        CHECK (status IN ('active', 'archived'))
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_availability_exceptions_range
    ON availability_exceptions(starts_at, ends_at)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_availability_exceptions_status
    ON availability_exceptions(status)
  `)

  console.log('\navailability_exceptions table confirmed.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
