require('dotenv').config()

const { Pool } = require('pg')

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing in server/.env')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
    `)

    await client.query(`
      ALTER TABLE system_users
      ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    await client.query(`
      INSERT INTO platform_settings (key, value)
      VALUES (
        'developer_operations',
        '{
          "maintenanceMode": false,
          "maintenanceMessage": "Power Within is receiving a brief update. Please try again shortly.",
          "bookingsPaused": false,
          "clientLoginsPaused": false,
          "outgoingEmailPaused": false,
          "featureFlags": {
            "clientMessages": true,
            "courses": false,
            "memberships": true,
            "circleCommunity": true,
            "founderReports": false,
            "adminBroadcasts": false,
            "newClientDashboard": true,
            "experimentalScheduler": false
          }
        }'::jsonb
      )
      ON CONFLICT (key) DO NOTHING;
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_system_users_session_version
      ON system_users(session_version);
    `)

    await client.query('COMMIT')

    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM system_users) AS system_users,
        (SELECT COUNT(*)::int FROM platform_settings) AS platform_settings,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'system_users'
            AND column_name = 'session_version'
        ) AS session_revocation_ready;
    `)

    console.log('Developer Operations database support is ready.')
    console.table(result.rows)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Developer Operations migration failed.')
  console.error(error.message)
  process.exitCode = 1
})
