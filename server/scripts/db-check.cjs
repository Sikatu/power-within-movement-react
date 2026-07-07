require('dotenv').config()

const { Pool } = require('pg')

const databaseUrl = process.env.DATABASE_URL

async function main() {
  if (!databaseUrl) {
    console.error('DATABASE_URL is missing in server/.env')
    process.exit(1)
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  })

  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        version() AS postgres_version,
        now() AS checked_at
    `)

    console.log('Database connection successful.')
    console.table(result.rows)
  } catch (error) {
    console.error('Database connection failed.')
    console.error(error.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()