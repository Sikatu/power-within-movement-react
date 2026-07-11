require('dotenv').config()

const { Pool } = require('pg')

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing from server/.env')
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)

    await client.query(`
      ALTER TABLE system_users
      ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
    `)

    await client.query(`
      ALTER TABLE client_profiles
      ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
      ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS encouragement_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT,
        body TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'all_members'
          CHECK (visibility IN ('all_members', 'tagged_group', 'single_client', 'admin_only')),
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'published', 'scheduled', 'archived')),
        scheduled_at TIMESTAMPTZ,
        published_at TIMESTAMPTZ,
        created_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    await client.query(`
      DROP TRIGGER IF EXISTS set_encouragement_posts_updated_at
        ON encouragement_posts;

      CREATE TRIGGER set_encouragement_posts_updated_at
      BEFORE UPDATE ON encouragement_posts
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS encouragement_recipients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        encouragement_post_id UUID REFERENCES encouragement_posts(id) ON DELETE CASCADE,
        client_profile_id UUID REFERENCES client_profiles(id) ON DELETE CASCADE,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (encouragement_post_id, client_profile_id)
      );
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_encouragement_posts_status
        ON encouragement_posts(status);

      CREATE INDEX IF NOT EXISTS idx_encouragement_recipients_client
        ON encouragement_recipients(client_profile_id);
    `)

    await client.query('COMMIT')

    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'encouragement_posts',
          'encouragement_recipients'
        )
      ORDER BY table_name;
    `)

    console.log('Client Portal foundation database support is ready.')
    console.table(result.rows)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Client Portal foundation migration failed:', error.message)
  process.exitCode = 1
})
