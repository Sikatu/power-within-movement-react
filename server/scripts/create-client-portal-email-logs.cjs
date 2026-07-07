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
      created_by_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      CONSTRAINT client_portal_email_logs_status_check
        CHECK (status IN ('drafted', 'sent_manual', 'failed')),
      CONSTRAINT client_portal_email_logs_type_check
        CHECK (email_type IN ('portal_invite', 'portal_login', 'resource_notice'))
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_client_portal_email_logs_client_profile_id
    ON client_portal_email_logs(client_profile_id)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_client_portal_email_logs_invite_id
    ON client_portal_email_logs(invite_id)
  `)

  console.log('\nclient_portal_email_logs table is ready.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
