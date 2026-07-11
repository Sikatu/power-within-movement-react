require('dotenv').config()

const { Pool } = require('pg')

const databaseUrl = process.env.DATABASE_URL

async function main() {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing in server/.env')
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query(`
      ALTER TABLE system_users
      ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ
    `)

    await client.query(`
      ALTER TABLE system_users
      DROP CONSTRAINT IF EXISTS system_users_role_check
    `)

    await client.query(`
      ALTER TABLE system_users
      ADD CONSTRAINT system_users_role_check
      CHECK (role IN ('developer', 'owner', 'admin', 'staff', 'client', 'member'))
    `)

    await client.query('COMMIT')

    const constraintResult = await pool.query(`
      SELECT
        conname AS constraint_name,
        pg_get_constraintdef(pg_constraint.oid) AS definition
      FROM pg_constraint
      INNER JOIN pg_class
        ON pg_class.oid = pg_constraint.conrelid
      WHERE pg_class.relname = 'system_users'
        AND conname = 'system_users_role_check'
      LIMIT 1
    `)

    console.log('Developer access database support is ready.')
    console.table(constraintResult.rows)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Developer access migration failed.')
  console.error(error.message)
  process.exitCode = 1
})
