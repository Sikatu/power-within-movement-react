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
    await client.query('CREATE EXTENSION IF NOT EXISTS citext')

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email CITEXT UNIQUE NOT NULL,
        first_name TEXT,
        last_name TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        source TEXT,
        consent_at TIMESTAMPTZ,
        unsubscribed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      ALTER TABLE subscribers
        ADD COLUMN IF NOT EXISTS client_profile_id UUID REFERENCES client_profiles(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS consent_status TEXT NOT NULL DEFAULT 'not_recorded',
        ADD COLUMN IF NOT EXISTS consent_source TEXT,
        ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS suppression_reason TEXT,
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL
    `)
    await client.query(`UPDATE subscribers SET consent_status = 'granted' WHERE consent_at IS NOT NULL AND consent_status = 'not_recorded'`)
    await client.query(`UPDATE subscribers SET subscribed_at = COALESCE(consent_at, created_at) WHERE status = 'subscribed' AND subscribed_at IS NULL`)
    await client.query(`ALTER TABLE subscribers DROP CONSTRAINT IF EXISTS subscribers_status_check`)
    await client.query(`
      ALTER TABLE subscribers ADD CONSTRAINT subscribers_status_check
      CHECK (status IN ('subscribed', 'unsubscribed', 'bounced', 'complained', 'suppressed', 'pending'))
    `)
    await client.query(`ALTER TABLE subscribers DROP CONSTRAINT IF EXISTS subscribers_consent_status_check`)
    await client.query(`
      ALTER TABLE subscribers ADD CONSTRAINT subscribers_consent_status_check
      CHECK (consent_status IN ('granted', 'pending', 'withdrawn', 'not_recorded'))
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS email_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriber_tag_links (
        subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
        email_tag_id UUID NOT NULL REFERENCES email_tags(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (subscriber_id, email_tag_id)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_segments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        rules JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_segments_active_name
      ON newsletter_segments (lower(name)) WHERE archived_at IS NULL
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_segment_members (
        subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
        segment_id UUID NOT NULL REFERENCES newsletter_segments(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (subscriber_id, segment_id)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_consent_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        status_before TEXT,
        status_after TEXT,
        consent_before TEXT,
        consent_after TEXT,
        source TEXT NOT NULL DEFAULT 'admin',
        actor_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_suppressions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subscriber_id UUID REFERENCES subscribers(id) ON DELETE SET NULL,
        email CITEXT NOT NULL,
        reason TEXT NOT NULL CHECK (reason IN ('unsubscribed', 'bounced', 'complained', 'manual')),
        active BOOLEAN NOT NULL DEFAULT true,
        actor_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        lifted_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        lifted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_suppressions_active_email
      ON newsletter_suppressions (email) WHERE active = true
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_imports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_name TEXT,
        source TEXT NOT NULL DEFAULT 'csv_import',
        status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'completed_with_errors', 'failed')),
        total_rows INTEGER NOT NULL DEFAULT 0,
        created_count INTEGER NOT NULL DEFAULT 0,
        merged_count INTEGER NOT NULL DEFAULT 0,
        duplicate_count INTEGER NOT NULL DEFAULT 0,
        skipped_count INTEGER NOT NULL DEFAULT 0,
        errors JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_send_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
        campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
        email_to CITEXT NOT NULL,
        subject TEXT,
        delivery_status TEXT NOT NULL DEFAULT 'pending'
          CHECK (delivery_status IN ('pending', 'sent', 'failed', 'skipped', 'bounced', 'complained')),
        provider TEXT,
        provider_message_id TEXT,
        error_message TEXT,
        sent_at TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status ON subscribers(status, updated_at DESC)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_source ON subscribers(source)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_client ON subscribers(client_profile_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletter_consent_events_subscriber ON newsletter_consent_events(subscriber_id, created_at DESC)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletter_segment_members_segment ON newsletter_segment_members(segment_id, subscriber_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_newsletter_send_history_subscriber ON newsletter_send_history(subscriber_id, created_at DESC)`)

    for (const tableName of ['subscribers', 'newsletter_segments', 'newsletter_suppressions']) {
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
        (SELECT COUNT(*)::int FROM subscribers) AS subscribers,
        (SELECT COUNT(*)::int FROM subscribers WHERE status = 'subscribed' AND consent_status = 'granted') AS consented,
        (SELECT COUNT(*)::int FROM newsletter_suppressions WHERE active = true) AS active_suppressions,
        (SELECT COUNT(*)::int FROM newsletter_segments WHERE archived_at IS NULL) AS segments,
        (SELECT COUNT(*)::int FROM newsletter_imports) AS imports
    `)
    console.log('\nNewsletter audience database support is ready.')
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
  console.error('Newsletter audience migration failed:', error)
  process.exitCode = 1
})
