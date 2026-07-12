const path = require('path')

require(path.resolve(__dirname, '..', 'node_modules', 'dotenv')).config({
  path: path.resolve(__dirname, '..', '.env'),
})

const { Pool } = require(path.resolve(__dirname, '..', 'node_modules', 'pg'))

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query(`
      ALTER TABLE client_profiles
        ADD COLUMN IF NOT EXISTS public_contact_email TEXT,
        ADD COLUMN IF NOT EXISTS lead_interest TEXT,
        ADD COLUMN IF NOT EXISTS lead_source TEXT,
        ADD COLUMN IF NOT EXISTS inquiry_received_at TIMESTAMPTZ
    `)

    await client.query(`
      UPDATE client_profiles cp
      SET public_contact_email = NULLIF(BTRIM(su.email), '')
      FROM system_users su
      WHERE su.id = cp.user_id
        AND (cp.public_contact_email IS NULL OR BTRIM(cp.public_contact_email) = '')
        AND su.email IS NOT NULL
        AND BTRIM(su.email) <> ''
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_client_profiles_public_contact_email_lower
      ON client_profiles (lower(public_contact_email))
      WHERE public_contact_email IS NOT NULL
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_client_profiles_inquiry_received_at
      ON client_profiles (inquiry_received_at DESC)
      WHERE inquiry_received_at IS NOT NULL
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS application_errors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fingerprint TEXT NOT NULL UNIQUE,
        detector_key TEXT,
        source TEXT NOT NULL CHECK (
          source IN ('backend', 'frontend', 'api', 'database', 'uptime', 'asset', 'schema', 'worker')
        ),
        severity TEXT NOT NULL DEFAULT 'medium' CHECK (
          severity IN ('low', 'medium', 'high', 'critical')
        ),
        status TEXT NOT NULL DEFAULT 'open' CHECK (
          status IN ('open', 'investigating', 'resolved', 'ignored')
        ),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        stack_trace TEXT,
        route TEXT,
        method TEXT,
        http_status INTEGER,
        request_id TEXT,
        user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        user_role TEXT,
        build_version TEXT,
        browser TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        occurrence_count INTEGER NOT NULL DEFAULT 1,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        status_updated_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_application_errors_detector_key
      ON application_errors(detector_key)
      WHERE detector_key IS NOT NULL
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_application_errors_status_last_seen
      ON application_errors(status, last_seen_at DESC)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_application_errors_source_severity
      ON application_errors(source, severity, last_seen_at DESC)
    `)

    await client.query(`
      DROP TRIGGER IF EXISTS set_application_errors_updated_at ON application_errors
    `)

    await client.query(`
      CREATE TRIGGER set_application_errors_updated_at
      BEFORE UPDATE ON application_errors
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at()
    `)

    await client.query(`
      INSERT INTO platform_settings (key, value)
      VALUES (
        'developer_error_center',
        '{
          "enabled": true,
          "frontendCaptureEnabled": true,
          "uptimeChecksEnabled": true,
          "criticalNotificationsEnabled": true,
          "retentionDays": 90,
          "uptimeIntervalMinutes": 5,
          "slowResponseThresholdMs": 4000
        }'::jsonb
      )
      ON CONFLICT (key) DO NOTHING
    `)

    await client.query('COMMIT')

    const summary = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IN ('open', 'investigating'))::int AS active,
        COUNT(*) FILTER (WHERE severity = 'critical' AND status IN ('open', 'investigating'))::int AS critical
      FROM application_errors
    `)

    const schema = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'client_profiles'
        AND column_name IN (
          'public_contact_email',
          'lead_interest',
          'lead_source',
          'inquiry_received_at'
        )
      ORDER BY column_name
    `)

    console.log('\nDeveloper Error Center database support is ready.')
    console.table(summary.rows)
    console.log('\nPermanent client-profile schema repair:')
    console.table(schema.rows)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Developer Error Center migration failed:', error)
  process.exitCode = 1
})
