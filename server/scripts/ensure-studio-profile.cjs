require('dotenv').config()

const { Pool } = require('pg')

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing from server/.env')

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`
      CREATE TABLE IF NOT EXISTS studio_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_key TEXT NOT NULL DEFAULT 'primary' UNIQUE,
        display_name TEXT NOT NULL DEFAULT 'Kim Mittelstadt',
        welcome_message TEXT NOT NULL DEFAULT 'A private space for meaningful transformation.',
        bio TEXT NOT NULL DEFAULT '',
        signature_line TEXT NOT NULL DEFAULT 'With care, Kim',
        public_email TEXT NOT NULL DEFAULT '',
        public_phone TEXT NOT NULL DEFAULT '',
        profile_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
        client_portal_enabled BOOLEAN NOT NULL DEFAULT false,
        client_portal_contact_enabled BOOLEAN NOT NULL DEFAULT false,
        created_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (profile_key = 'primary')
      );

      INSERT INTO studio_profiles (profile_key)
      VALUES ('primary')
      ON CONFLICT (profile_key) DO NOTHING;

      ALTER TABLE studio_profiles
        ADD COLUMN IF NOT EXISTS client_portal_enabled BOOLEAN NOT NULL DEFAULT false;

      ALTER TABLE studio_profiles
        ADD COLUMN IF NOT EXISTS client_portal_contact_enabled BOOLEAN NOT NULL DEFAULT false;

      CREATE INDEX IF NOT EXISTS idx_studio_profiles_profile_asset
        ON studio_profiles(profile_asset_id);

      DROP TRIGGER IF EXISTS set_studio_profiles_updated_at ON studio_profiles;
      CREATE TRIGGER set_studio_profiles_updated_at
      BEFORE UPDATE ON studio_profiles
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
    `)
    await client.query('COMMIT')
    console.log('Phase 46 Studio Profile database support is ready.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Studio Profile migration failed:', error.message)
  process.exitCode = 1
})
