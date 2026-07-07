const { pool } = require('../src/db/pool')

async function columnExists(tableName, columnName) {
  const result = await pool.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS exists
    `,
    [tableName, columnName],
  )

  return Boolean(result.rows[0]?.exists)
}

async function addColumnIfMissing(columnName, definition) {
  const exists = await columnExists('client_portal_email_logs', columnName)

  if (!exists) {
    console.log(`Adding client_portal_email_logs.${columnName}`)
    await pool.query(
      `ALTER TABLE client_portal_email_logs ADD COLUMN ${columnName} ${definition}`,
    )
  } else {
    console.log(`client_portal_email_logs.${columnName} already exists`)
  }
}

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
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `)

  await addColumnIfMissing('provider', 'text')
  await addColumnIfMissing('provider_message_id', 'text')
  await addColumnIfMissing('provider_response', "jsonb NOT NULL DEFAULT '{}'::jsonb")
  await addColumnIfMissing('error_message', 'text')

  await pool.query(`
    ALTER TABLE client_portal_email_logs
    DROP CONSTRAINT IF EXISTS client_portal_email_logs_status_check
  `)

  await pool.query(`
    ALTER TABLE client_portal_email_logs
    ADD CONSTRAINT client_portal_email_logs_status_check
    CHECK (status IN ('drafted', 'sent_manual', 'sent', 'failed'))
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_client_portal_email_logs_provider_message_id
    ON client_portal_email_logs(provider_message_id)
  `)

  console.log('\nclient_portal_email_logs table upgraded for real sending.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
