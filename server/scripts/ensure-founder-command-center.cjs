const path = require('path')

require(path.resolve(__dirname, '..', 'node_modules', 'dotenv')).config({
  path: path.resolve(__dirname, '..', '.env'),
})

const { Pool } = require(path.resolve(__dirname, '..', 'node_modules', 'pg'))

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.')

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

    await client.query(`
      CREATE TABLE IF NOT EXISTS founder_tool_preferences (
        founder_user_id UUID PRIMARY KEY REFERENCES system_users(id) ON DELETE CASCADE,
        primary_timezone TEXT NOT NULL DEFAULT 'America/Chicago',
        comparison_timezones JSONB NOT NULL DEFAULT '["America/New_York","America/Chicago","America/Denver","America/Los_Angeles","Asia/Manila","Europe/London"]'::jsonb,
        recording_retention_days INTEGER NOT NULL DEFAULT 365 CHECK (recording_retention_days BETWEEN 30 AND 3650),
        updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS founder_recordings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        founder_user_id UUID NOT NULL REFERENCES system_users(id) ON DELETE RESTRICT,
        asset_id UUID NOT NULL UNIQUE REFERENCES assets(id) ON DELETE RESTRICT,
        title TEXT NOT NULL,
        notes TEXT,
        tags TEXT[] NOT NULL DEFAULT '{}'::text[],
        folder_id UUID REFERENCES asset_folders(id) ON DELETE SET NULL,
        is_private BOOLEAN NOT NULL DEFAULT true,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
        duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms BETWEEN 0 AND 7200000),
        mime_type TEXT NOT NULL,
        size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
        transcript_status TEXT NOT NULL DEFAULT 'not_requested'
          CHECK (transcript_status IN ('not_requested', 'queued', 'processing', 'ready', 'failed', 'unavailable')),
        transcript_text TEXT NOT NULL DEFAULT '',
        transcript_provider TEXT,
        transcript_error TEXT,
        transcript_requested_at TIMESTAMPTZ,
        transcript_completed_at TIMESTAMPTZ,
        transcript_edited_at TIMESTAMPTZ,
        transcript_edited_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
        retention_until TIMESTAMPTZ,
        archived_at TIMESTAMPTZ,
        created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS founder_transcription_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recording_id UUID NOT NULL UNIQUE REFERENCES founder_recordings(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'queued'
          CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'unavailable', 'cancelled')),
        provider TEXT NOT NULL DEFAULT 'disabled',
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        locked_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        error_message TEXT,
        requested_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS founder_recording_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recording_id UUID REFERENCES founder_recordings(id) ON DELETE SET NULL,
        asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
        actor_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        client_profile_id UUID REFERENCES client_profiles(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL CHECK (event_type IN (
          'created', 'metadata_updated', 'playback', 'download', 'transcript_requested',
          'transcript_completed', 'transcript_edited', 'shared', 'unshared',
          'reused_in_letter', 'archived', 'restored', 'permanently_deleted'
        )),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`CREATE INDEX IF NOT EXISTS idx_founder_recordings_owner_status ON founder_recordings(founder_user_id, status, updated_at DESC)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_founder_recordings_tags ON founder_recordings USING GIN(tags)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_founder_transcription_jobs_status ON founder_transcription_jobs(status, available_at)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_founder_recording_events_recording ON founder_recording_events(recording_id, created_at DESC)`)

    for (const tableName of ['founder_tool_preferences', 'founder_recordings', 'founder_transcription_jobs']) {
      await client.query(`DROP TRIGGER IF EXISTS set_${tableName}_updated_at ON ${tableName}`)
      await client.query(`
        CREATE TRIGGER set_${tableName}_updated_at
        BEFORE UPDATE ON ${tableName}
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
      `)
    }

    await client.query('COMMIT')

    const summary = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM founder_tool_preferences) AS preferences,
        (SELECT COUNT(*)::int FROM founder_recordings) AS recordings,
        (SELECT COUNT(*)::int FROM founder_transcription_jobs) AS transcription_jobs,
        (SELECT COUNT(*)::int FROM founder_recording_events) AS events
    `)
    console.log('\nFounder Command Center database support is ready.')
    console.table(summary.rows)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Founder Command Center migration failed:', error)
  process.exitCode = 1
})
