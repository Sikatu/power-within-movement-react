require('dotenv').config()

const { Pool } = require('pg')

const databaseUrl = process.env.DATABASE_URL

async function main() {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing in server/.env')
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    await pool.query(`
      ALTER TABLE system_users
      ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ
    `)

    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'system_users'
        AND column_name IN (
          'must_change_password',
          'temporary_password_expires_at',
          'password_changed_at'
        )
      ORDER BY column_name
    `)

    console.log('Owner password-reset fields are ready.')
    console.table(result.rows)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Owner password-reset migration failed.')
  console.error(error.message)
  process.exitCode = 1
})
