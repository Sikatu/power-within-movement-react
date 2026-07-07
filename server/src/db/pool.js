const { Pool } = require('pg')
const { env } = require('../config/env')

const pool = env.databaseUrl
  ? new Pool({
      connectionString: env.databaseUrl,
    })
  : null

async function checkDatabase() {
  if (!pool) {
    return {
      configured: false,
      ok: false,
      message: 'DATABASE_URL is not configured yet.',
    }
  }

  try {
    const result = await pool.query('select now() as current_time')
    return {
      configured: true,
      ok: true,
      currentTime: result.rows[0]?.current_time,
    }
  } catch (error) {
    return {
      configured: true,
      ok: false,
      message: error.message,
    }
  }
}

module.exports = {
  pool,
  checkDatabase,
}