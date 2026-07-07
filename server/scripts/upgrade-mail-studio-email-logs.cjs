const { pool } = require('../src/db/pool')

async function main() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_portal_email_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_profile_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
      invite_id uuid REFERENCES client_portal_invites(id) ON DELETE SET NULL,
      email_type text NOT NULL DEFAULT 'portal_invite',
      email_to text NOT NULL,
      subject text NOT NULL,
      body_text text NOT NULL,
      status text NOT NULL DEFAULT 'drafted',
      sent_at timestamp with time zone,
      provider text,
      provider_message_id text,
      provider_response jsonb NOT NULL DEFAULT '{}'::jsonb,
      error_message text,
      created_by_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    ALTER TABLE client_portal_email_logs
    DROP CONSTRAINT IF EXISTS client_portal_email_logs_type_check
  `)

  await pool.query(`
    ALTER TABLE client_portal_email_logs
    ADD CONSTRAINT client_portal_email_logs_type_check
    CHECK (
      email_type IN (
        'portal_invite',
        'portal_login',
        'resource_notice',
        'welcome',
        'follow_up',
        'session_reminder',
        'broadcast',
        'general'
      )
    )
  `)

  await pool.query(`
    ALTER TABLE client_portal_email_logs
    DROP CONSTRAINT IF EXISTS client_portal_email_logs_status_check
  `)

  await pool.query(`
    ALTER TABLE client_portal_email_logs
    ADD CONSTRAINT client_portal_email_logs_status_check
    CHECK (status IN ('drafted', 'sent_manual', 'sent', 'failed'))
  `)

  console.log('\nMail Studio email log constraints upgraded.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
