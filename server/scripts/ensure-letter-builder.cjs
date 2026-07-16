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
      CREATE TABLE IF NOT EXISTS letter_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL DEFAULT 'newsletter',
        subject TEXT NOT NULL DEFAULT '',
        preview_text TEXT NOT NULL DEFAULT '',
        design JSONB NOT NULL DEFAULT '{"version":1,"settings":{},"blocks":[]}'::jsonb,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
        created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS letter_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        subject TEXT NOT NULL DEFAULT '',
        preview_text TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'archived')),
        design JSONB NOT NULL DEFAULT '{"version":1,"settings":{},"blocks":[]}'::jsonb,
        audience_filter JSONB NOT NULL DEFAULT '{"mode":"all"}'::jsonb,
        autosave_revision INTEGER NOT NULL DEFAULT 0 CHECK (autosave_revision >= 0),
        template_source_id UUID REFERENCES letter_templates(id) ON DELETE SET NULL,
        last_saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        scheduled_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS letter_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        letter_id UUID NOT NULL REFERENCES letter_documents(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL CHECK (revision >= 0),
        snapshot JSONB NOT NULL,
        reason TEXT NOT NULL DEFAULT 'autosave'
          CHECK (reason IN ('autosave', 'manual', 'restored', 'pre_send', 'template')),
        created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (letter_id, revision)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS letter_broadcasts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        letter_id UUID NOT NULL REFERENCES letter_documents(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'scheduled', 'processing', 'sent', 'partial', 'failed', 'cancelled')),
        audience_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        title_snapshot TEXT NOT NULL DEFAULT '',
        subject_snapshot TEXT NOT NULL DEFAULT '',
        preview_text_snapshot TEXT NOT NULL DEFAULT '',
        design_snapshot JSONB NOT NULL DEFAULT '{"version":1,"settings":{},"blocks":[]}'::jsonb,
        provider TEXT NOT NULL DEFAULT 'resend',
        recipient_count INTEGER NOT NULL DEFAULT 0,
        sent_count INTEGER NOT NULL DEFAULT 0,
        delivered_count INTEGER NOT NULL DEFAULT 0,
        opened_count INTEGER NOT NULL DEFAULT 0,
        clicked_count INTEGER NOT NULL DEFAULT 0,
        bounced_count INTEGER NOT NULL DEFAULT 0,
        unsubscribed_count INTEGER NOT NULL DEFAULT 0,
        complained_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        skipped_count INTEGER NOT NULL DEFAULT 0,
        scheduled_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        error_message TEXT,
        created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS letter_broadcast_recipients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        broadcast_id UUID NOT NULL REFERENCES letter_broadcasts(id) ON DELETE CASCADE,
        subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE RESTRICT,
        email CITEXT NOT NULL,
        personalization JSONB NOT NULL DEFAULT '{}'::jsonb,
        delivery_status TEXT NOT NULL DEFAULT 'pending'
          CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'skipped', 'failed')),
        skip_reason TEXT,
        provider TEXT NOT NULL DEFAULT 'resend',
        provider_message_id TEXT,
        provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
        error_message TEXT,
        sent_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        first_opened_at TIMESTAMPTZ,
        last_opened_at TIMESTAMPTZ,
        first_clicked_at TIMESTAMPTZ,
        last_clicked_at TIMESTAMPTZ,
        bounced_at TIMESTAMPTZ,
        complained_at TIMESTAMPTZ,
        unsubscribed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (broadcast_id, subscriber_id)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS letter_tracking_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        broadcast_id UUID NOT NULL REFERENCES letter_broadcasts(id) ON DELETE CASCADE,
        letter_id UUID NOT NULL REFERENCES letter_documents(id) ON DELETE CASCADE,
        block_id TEXT NOT NULL,
        label TEXT,
        destination_url TEXT NOT NULL,
        click_count INTEGER NOT NULL DEFAULT 0,
        unique_click_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (broadcast_id, block_id, destination_url)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS letter_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        broadcast_id UUID NOT NULL REFERENCES letter_broadcasts(id) ON DELETE CASCADE,
        recipient_id UUID REFERENCES letter_broadcast_recipients(id) ON DELETE CASCADE,
        subscriber_id UUID REFERENCES subscribers(id) ON DELETE RESTRICT,
        link_id UUID REFERENCES letter_tracking_links(id) ON DELETE SET NULL,
        event_type TEXT NOT NULL
          CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'skipped', 'failed')),
        provider_event_id TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_letter_events_provider_event
      ON letter_events(provider_event_id) WHERE provider_event_id IS NOT NULL
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS letter_test_sends (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        letter_id UUID NOT NULL REFERENCES letter_documents(id) ON DELETE CASCADE,
        email_to CITEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
        provider TEXT NOT NULL DEFAULT 'resend',
        provider_message_id TEXT,
        provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
        error_message TEXT,
        sent_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`ALTER TABLE newsletter_send_history DROP CONSTRAINT IF EXISTS newsletter_send_history_delivery_status_check`)
    await client.query(`
      ALTER TABLE newsletter_send_history ADD CONSTRAINT newsletter_send_history_delivery_status_check
      CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'skipped', 'bounced', 'complained', 'unsubscribed'))
    `)

    await client.query(`ALTER TABLE letter_broadcasts ADD COLUMN IF NOT EXISTS title_snapshot TEXT NOT NULL DEFAULT ''`)
    await client.query(`ALTER TABLE letter_broadcasts ADD COLUMN IF NOT EXISTS subject_snapshot TEXT NOT NULL DEFAULT ''`)
    await client.query(`ALTER TABLE letter_broadcasts ADD COLUMN IF NOT EXISTS preview_text_snapshot TEXT NOT NULL DEFAULT ''`)
    await client.query(`ALTER TABLE letter_broadcasts ADD COLUMN IF NOT EXISTS design_snapshot JSONB NOT NULL DEFAULT '{"version":1,"settings":{},"blocks":[]}'::jsonb`)
    await client.query(`
      UPDATE letter_broadcasts lb SET
        title_snapshot = CASE WHEN lb.title_snapshot = '' THEN ld.title ELSE lb.title_snapshot END,
        subject_snapshot = CASE WHEN lb.subject_snapshot = '' THEN ld.subject ELSE lb.subject_snapshot END,
        preview_text_snapshot = CASE WHEN lb.preview_text_snapshot = '' THEN ld.preview_text ELSE lb.preview_text_snapshot END,
        design_snapshot = CASE WHEN lb.design_snapshot = '{"version":1,"settings":{},"blocks":[]}'::jsonb THEN ld.design ELSE lb.design_snapshot END
      FROM letter_documents ld WHERE ld.id = lb.letter_id
    `)

    await client.query(`CREATE INDEX IF NOT EXISTS idx_letter_documents_status_updated ON letter_documents(status, updated_at DESC)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_letter_versions_letter_created ON letter_versions(letter_id, created_at DESC)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_letter_broadcasts_status_schedule ON letter_broadcasts(status, scheduled_at)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_letter_recipients_broadcast_status ON letter_broadcast_recipients(broadcast_id, delivery_status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_letter_recipients_provider_message ON letter_broadcast_recipients(provider_message_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_letter_events_broadcast_type ON letter_events(broadcast_id, event_type, occurred_at DESC)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_letter_events_recipient ON letter_events(recipient_id, occurred_at DESC)`)

    for (const tableName of ['letter_templates', 'letter_documents', 'letter_broadcasts', 'letter_broadcast_recipients', 'letter_tracking_links']) {
      await client.query(`DROP TRIGGER IF EXISTS set_${tableName}_updated_at ON ${tableName}`)
      await client.query(`
        CREATE TRIGGER set_${tableName}_updated_at
        BEFORE UPDATE ON ${tableName}
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
      `)
    }

    const existingTemplates = await client.query(`SELECT COUNT(*)::int AS count FROM letter_templates`)
    if ((existingTemplates.rows[0]?.count || 0) === 0) {
      const defaultDesign = {
        version: 1,
        settings: {
          backgroundColor: '#f6eee9',
          contentColor: '#fffdf9',
          textColor: '#4d343c',
          accentColor: '#7a3f50',
          fontFamily: 'Georgia, serif',
          contentWidth: 640,
        },
        blocks: [
          { id: 'welcome-heading', type: 'heading', content: { text: 'A note from Power Within', level: 1 }, settings: { align: 'center', padding: 24 } },
          { id: 'welcome-text', type: 'text', content: { text: 'Write a thoughtful note for the woman in a new season.' }, settings: { align: 'left', padding: 16 } },
          { id: 'welcome-signature', type: 'signature', content: { name: 'Kim Mittelstadt', title: 'Power Within Collective' }, settings: { align: 'left', padding: 18 } },
          { id: 'welcome-unsubscribe', type: 'unsubscribe', content: { text: 'Unsubscribe from these letters' }, settings: { align: 'center', padding: 16 } },
        ],
      }
      await client.query(
        `INSERT INTO letter_templates (name, description, category, subject, preview_text, design) VALUES ($1, $2, 'newsletter', $3, $4, $5::jsonb)`,
        ['Power Within Letter', 'A warm, editorial starting point with the required unsubscribe footer.', 'A note for your new season', 'A thoughtful note from Power Within Collective', JSON.stringify(defaultDesign)],
      )
    }

    await client.query('COMMIT')

    const summary = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM letter_documents) AS letters,
        (SELECT COUNT(*)::int FROM letter_templates WHERE status = 'active') AS templates,
        (SELECT COUNT(*)::int FROM letter_broadcasts) AS broadcasts,
        (SELECT COUNT(*)::int FROM letter_broadcast_recipients) AS recipients,
        (SELECT COUNT(*)::int FROM letter_events) AS events
    `)
    console.log('\nLetters & Broadcast database support is ready.')
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
  console.error('Letters & Broadcast migration failed:', error)
  process.exitCode = 1
})
