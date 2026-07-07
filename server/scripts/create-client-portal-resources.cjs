const { pool } = require('../src/db/pool')

async function main() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_portal_resources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_profile_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
      title text NOT NULL,
      resource_type text NOT NULL DEFAULT 'note',
      description text,
      resource_url text,
      status text NOT NULL DEFAULT 'active',
      created_by_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      CONSTRAINT client_portal_resources_status_check
        CHECK (status IN ('active', 'archived')),
      CONSTRAINT client_portal_resources_type_check
        CHECK (resource_type IN ('worksheet', 'guide', 'link', 'video', 'reminder', 'note'))
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_client_portal_resources_client_profile_id
    ON client_portal_resources(client_profile_id)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_client_portal_resources_status
    ON client_portal_resources(status)
  `)

  console.log('\n=== client_portal_resources columns ===')

  const columns = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_portal_resources'
    ORDER BY ordinal_position
  `)

  console.table(columns.rows)
  console.log('\nclient_portal_resources table is ready.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
