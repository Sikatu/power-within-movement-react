require('dotenv').config()
const { Pool } = require('pg')

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing from server/.env')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open'
          CHECK (status IN ('open', 'waiting_on_client', 'waiting_on_team', 'closed')),
        priority TEXT NOT NULL DEFAULT 'normal'
          CHECK (priority IN ('normal', 'high', 'urgent')),
        assigned_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        closed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      DROP TRIGGER IF EXISTS set_client_conversations_updated_at
        ON client_conversations;
      CREATE TRIGGER set_client_conversations_updated_at
      BEFORE UPDATE ON client_conversations
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();

      CREATE TABLE IF NOT EXISTS client_conversation_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES client_conversations(id) ON DELETE CASCADE,
        sender_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        sender_role TEXT NOT NULL,
        body TEXT NOT NULL,
        attachment_url TEXT,
        attachment_label TEXT,
        is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
        read_by_client_at TIMESTAMPTZ,
        read_by_team_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT client_conversation_messages_role_check
          CHECK (sender_role IN ('developer', 'owner', 'admin', 'staff', 'client')),
        CONSTRAINT client_conversation_messages_attachment_pair_check
          CHECK (
            (attachment_url IS NULL AND attachment_label IS NULL)
            OR attachment_url IS NOT NULL
          )
      );

      CREATE INDEX IF NOT EXISTS idx_client_conversations_client
        ON client_conversations(client_profile_id, last_message_at DESC);
      CREATE INDEX IF NOT EXISTS idx_client_conversations_status_priority
        ON client_conversations(status, priority, last_message_at DESC);
      CREATE INDEX IF NOT EXISTS idx_client_conversations_assignee
        ON client_conversations(assigned_user_id, status, last_message_at DESC);
      CREATE INDEX IF NOT EXISTS idx_client_conversation_messages_conversation
        ON client_conversation_messages(conversation_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_client_conversation_messages_unread_client
        ON client_conversation_messages(conversation_id, read_by_client_at)
        WHERE sender_role <> 'client' AND is_internal_note = FALSE;
      CREATE INDEX IF NOT EXISTS idx_client_conversation_messages_unread_team
        ON client_conversation_messages(conversation_id, read_by_team_at)
        WHERE sender_role = 'client';
    `)

    await pool.query(`
      UPDATE platform_settings
      SET
        value = jsonb_set(
          COALESCE(value, '{}'::jsonb),
          '{featureFlags,secureClientInbox}',
          'true'::jsonb,
          true
        ),
        updated_at = now()
      WHERE key = 'developer_operations'
    `)

    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM client_conversations) AS conversations,
        (SELECT COUNT(*)::int FROM client_conversation_messages) AS messages
    `)

    console.log('Secure Client Inbox database support is ready.')
    console.log('The Secure Client Inbox feature is enabled.')
    console.table(result.rows)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Secure Client Inbox migration failed:', error.message)
  process.exitCode = 1
})
