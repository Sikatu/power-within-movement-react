const { pool } = require('../src/db/pool')

async function main() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      slug text UNIQUE NOT NULL,
      tagline text,
      description text,
      benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
      welcome_message text,
      status text NOT NULL DEFAULT 'draft',
      price_cents integer,
      currency text NOT NULL DEFAULT 'USD',
      billing_interval text,
      created_by uuid REFERENCES system_users(id) ON DELETE SET NULL,
      updated_by uuid REFERENCES system_users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT memberships_status_check
        CHECK (status IN ('draft', 'active', 'archived')),
      CONSTRAINT memberships_billing_interval_check
        CHECK (billing_interval IS NULL OR billing_interval IN ('one_time', 'monthly', 'quarterly', 'yearly'))
    )
  `)

  await pool.query(`
    ALTER TABLE memberships
      ADD COLUMN IF NOT EXISTS tagline text,
      ADD COLUMN IF NOT EXISTS benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS welcome_message text,
      ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES system_users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES system_users(id) ON DELETE SET NULL
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS membership_enrollments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
      client_profile_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'active',
      started_at timestamptz NOT NULL DEFAULT now(),
      renewal_at timestamptz,
      ends_at timestamptz,
      notes text,
      assigned_by uuid REFERENCES system_users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT membership_enrollments_status_check
        CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
      UNIQUE (membership_id, client_profile_id)
    )
  `)

  await pool.query(`
    ALTER TABLE membership_enrollments
      ADD COLUMN IF NOT EXISTS renewal_at timestamptz,
      ADD COLUMN IF NOT EXISTS notes text,
      ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES system_users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS membership_course_links (
      membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      created_by uuid REFERENCES system_users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (membership_id, course_id)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS membership_resources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
      title text NOT NULL,
      resource_type text NOT NULL DEFAULT 'link',
      description text,
      resource_url text,
      status text NOT NULL DEFAULT 'active',
      position integer NOT NULL DEFAULT 0,
      created_by uuid REFERENCES system_users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT membership_resources_type_check
        CHECK (resource_type IN ('guide', 'worksheet', 'link', 'video', 'download', 'note')),
      CONSTRAINT membership_resources_status_check
        CHECK (status IN ('active', 'archived'))
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS membership_announcements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
      title text NOT NULL,
      body text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      published_at timestamptz,
      created_by uuid REFERENCES system_users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT membership_announcements_status_check
        CHECK (status IN ('draft', 'published', 'archived'))
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_memberships_status
      ON memberships(status)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_membership_enrollments_client_status
      ON membership_enrollments(client_profile_id, status)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_membership_enrollments_membership_status
      ON membership_enrollments(membership_id, status)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_membership_resources_membership_status
      ON membership_resources(membership_id, status)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_membership_announcements_membership_status
      ON membership_announcements(membership_id, status)
  `)

  await pool.query(`
    UPDATE platform_settings
    SET
      value = jsonb_set(
        COALESCE(value, '{}'::jsonb),
        '{featureFlags,memberships}',
        'true'::jsonb,
        true
      ),
      updated_at = now()
    WHERE key = 'developer_operations'
  `)

  console.log('\nMembership Circle database support is ready.')
  console.log('The Memberships feature is enabled for client portals.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
