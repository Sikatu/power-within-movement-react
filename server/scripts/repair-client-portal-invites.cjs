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
  const exists = await columnExists('client_portal_invites', columnName)

  if (!exists) {
    console.log(`Adding client_portal_invites.${columnName}`)
    await pool.query(`ALTER TABLE client_portal_invites ADD COLUMN ${columnName} ${definition}`)
  } else {
    console.log(`client_portal_invites.${columnName} already exists`)
  }
}

async function main() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_portal_invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_profile_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
      user_id uuid REFERENCES system_users(id) ON DELETE CASCADE,
      invite_token_hash text NOT NULL,
      invite_token_preview text,
      invite_link text,
      status text NOT NULL DEFAULT 'pending',
      expires_at timestamp with time zone NOT NULL DEFAULT now() + interval '14 days',
      accepted_at timestamp with time zone,
      revoked_at timestamp with time zone,
      created_by_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `)

  await addColumnIfMissing('client_profile_id', 'uuid REFERENCES client_profiles(id) ON DELETE CASCADE')
  await addColumnIfMissing('user_id', 'uuid REFERENCES system_users(id) ON DELETE CASCADE')
  await addColumnIfMissing('invite_token_hash', 'text')
  await addColumnIfMissing('invite_token_preview', 'text')
  await addColumnIfMissing('invite_link', 'text')
  await addColumnIfMissing('status', "text NOT NULL DEFAULT 'pending'")
  await addColumnIfMissing('expires_at', "timestamp with time zone NOT NULL DEFAULT now() + interval '14 days'")
  await addColumnIfMissing('accepted_at', 'timestamp with time zone')
  await addColumnIfMissing('revoked_at', 'timestamp with time zone')
  await addColumnIfMissing('created_by_user_id', 'uuid REFERENCES system_users(id) ON DELETE SET NULL')
  await addColumnIfMissing('created_at', 'timestamp with time zone NOT NULL DEFAULT now()')
  await addColumnIfMissing('updated_at', 'timestamp with time zone NOT NULL DEFAULT now()')

  await pool.query(`
    ALTER TABLE client_portal_invites
    DROP CONSTRAINT IF EXISTS client_portal_invites_status_check
  `)

  await pool.query(`
    ALTER TABLE client_portal_invites
    ADD CONSTRAINT client_portal_invites_status_check
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'))
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_client_portal_invites_client_profile_id
    ON client_portal_invites(client_profile_id)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_client_portal_invites_user_id
    ON client_portal_invites(user_id)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_client_portal_invites_token_hash
    ON client_portal_invites(invite_token_hash)
  `)

  console.log('\n=== client_portal_invites columns ===')

  const columns = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_portal_invites'
    ORDER BY ordinal_position
  `)

  console.table(columns.rows)

  console.log('\nclient_portal_invites table is ready.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
