const path = require('path')

require(path.resolve(__dirname, '..', 'node_modules', 'dotenv')).config({
  path: path.resolve(__dirname, '..', '.env'),
})

const { Pool } = require(path.resolve(__dirname, '..', 'node_modules', 'pg'))

async function requireTable(client, tableName) {
  const result = await client.query('SELECT to_regclass($1) AS table_name', [`public.${tableName}`])
  if (!result.rows[0]?.table_name) {
    throw new Error(
      `Required table ${tableName} is missing. Run the ordered migrations before the unified email inbox migration.`,
    )
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured in server/.env.')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
    await client.query('CREATE EXTENSION IF NOT EXISTS citext')

    for (const tableName of [
      'client_profiles',
      'subscribers',
      'letter_broadcast_recipients',
      'client_conversations',
      'client_conversation_messages',
    ]) {
      await requireTable(client, tableName)
    }

    await client.query(`
      ALTER TABLE client_conversations
        ALTER COLUMN client_profile_id DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS subscriber_id UUID
          REFERENCES subscribers(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS external_email CITEXT,
        ADD COLUMN IF NOT EXISTS external_name TEXT,
        ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'portal',
        ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'client_portal',
        ADD COLUMN IF NOT EXISTS provider_thread_key TEXT,
        ADD COLUMN IF NOT EXISTS reply_alias TEXT
    `)

    await client.query(`
      ALTER TABLE client_conversations
        DROP CONSTRAINT IF EXISTS client_conversations_channel_check,
        DROP CONSTRAINT IF EXISTS client_conversations_source_type_check,
        DROP CONSTRAINT IF EXISTS client_conversations_identity_check
    `)

    await client.query(`
      ALTER TABLE client_conversations
        ADD CONSTRAINT client_conversations_channel_check
          CHECK (channel IN ('portal', 'email')),
        ADD CONSTRAINT client_conversations_source_type_check
          CHECK (source_type IN ('client_portal', 'broadcast_reply', 'direct_email')),
        ADD CONSTRAINT client_conversations_identity_check
          CHECK (
            client_profile_id IS NOT NULL
            OR subscriber_id IS NOT NULL
            OR external_email IS NOT NULL
          ) NOT VALID
    `)

    await client.query(`
      ALTER TABLE client_conversations
        VALIDATE CONSTRAINT client_conversations_identity_check
    `)

    await client.query(`
      ALTER TABLE letter_broadcast_recipients
        ADD COLUMN IF NOT EXISTS reply_alias TEXT
    `)

    await client.query(`
      ALTER TABLE client_conversation_messages
        ADD COLUMN IF NOT EXISTS provider_email_id TEXT,
        ADD COLUMN IF NOT EXISTS internet_message_id TEXT,
        ADD COLUMN IF NOT EXISTS in_reply_to TEXT,
        ADD COLUMN IF NOT EXISTS reference_ids TEXT[] NOT NULL DEFAULT '{}'::text[],
        ADD COLUMN IF NOT EXISTS provider_event_id TEXT,
        ADD COLUMN IF NOT EXISTS email_from CITEXT,
        ADD COLUMN IF NOT EXISTS email_to CITEXT,
        ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'portal',
        ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'delivered',
        ADD COLUMN IF NOT EXISTS provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    `)

    await client.query(`
      ALTER TABLE client_conversation_messages
        DROP CONSTRAINT IF EXISTS client_conversation_messages_channel_check,
        DROP CONSTRAINT IF EXISTS client_conversation_messages_delivery_status_check
    `)

    await client.query(`
      ALTER TABLE client_conversation_messages
        ADD CONSTRAINT client_conversation_messages_channel_check
          CHECK (channel IN ('portal', 'email')),
        ADD CONSTRAINT client_conversation_messages_delivery_status_check
          CHECK (delivery_status IN ('pending', 'sent', 'received', 'delivered', 'failed'))
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS inbound_email_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_event_id TEXT NOT NULL UNIQUE,
        provider_email_id TEXT,
        event_type TEXT NOT NULL DEFAULT 'email.received',
        processing_status TEXT NOT NULL DEFAULT 'received'
          CHECK (processing_status IN ('received', 'processing', 'processed', 'ignored', 'failed')),
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        failure_reason TEXT,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_attempt_at TIMESTAMPTZ,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_client_conversations_reply_alias
        ON client_conversations (lower(reply_alias))
        WHERE reply_alias IS NOT NULL
    `)

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_letter_recipients_reply_alias
        ON letter_broadcast_recipients (lower(reply_alias))
        WHERE reply_alias IS NOT NULL
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_client_conversations_subscriber
        ON client_conversations (subscriber_id, last_message_at DESC)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_client_conversations_external_email
        ON client_conversations (external_email, last_message_at DESC)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_client_conversations_channel_status
        ON client_conversations (channel, status, last_message_at DESC)
    `)

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_client_conversation_messages_provider_email
        ON client_conversation_messages (provider_email_id)
        WHERE provider_email_id IS NOT NULL
    `)

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_client_conversation_messages_provider_event
        ON client_conversation_messages (provider_event_id)
        WHERE provider_event_id IS NOT NULL
    `)

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_client_conversation_messages_internet_message
        ON client_conversation_messages (internet_message_id)
        WHERE internet_message_id IS NOT NULL
    `)

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_email_events_provider_email
        ON inbound_email_events (provider_email_id)
        WHERE provider_email_id IS NOT NULL
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_inbound_email_events_processing
        ON inbound_email_events (processing_status, received_at)
    `)

    await client.query(`
      DROP TRIGGER IF EXISTS set_inbound_email_events_updated_at
        ON inbound_email_events
    `)

    await client.query(`
      CREATE TRIGGER set_inbound_email_events_updated_at
      BEFORE UPDATE ON inbound_email_events
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at()
    `)

    await client.query('COMMIT')

    const summary = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM client_conversations) AS conversations,
        (SELECT COUNT(*)::int FROM client_conversations WHERE channel = 'email') AS email_conversations,
        (SELECT COUNT(*)::int FROM client_conversation_messages) AS messages,
        (SELECT COUNT(*)::int FROM inbound_email_events) AS inbound_events,
        (SELECT COUNT(*)::int FROM letter_broadcast_recipients WHERE reply_alias IS NOT NULL) AS reply_aliases
    `)

    console.log('\nUnified Email Inbox schema foundation is ready.')
    console.table(summary.rows)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Unified Email Inbox migration failed:', error)
  process.exitCode = 1
})
