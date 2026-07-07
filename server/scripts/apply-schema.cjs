require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

const databaseUrl = process.env.DATABASE_URL
const sqlPath = path.resolve(__dirname, '../sql/001_initial_schema.sql')

async function main() {
  if (!databaseUrl) {
    console.error('DATABASE_URL is missing in server/.env')
    process.exit(1)
  }

  if (!fs.existsSync(sqlPath)) {
    console.error(`Schema file not found: ${sqlPath}`)
    process.exit(1)
  }

  const sql = fs.readFileSync(sqlPath, 'utf8')
  const pool = new Pool({
    connectionString: databaseUrl,
  })

  try {
    console.log('Applying initial schema...')
    await pool.query(sql)

    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)

    console.log('Schema applied successfully.')
    console.log(`Tables found: ${tables.rows.length}`)
    console.table(tables.rows)
  } catch (error) {
    console.error('Schema migration failed.')
    console.error(error.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()