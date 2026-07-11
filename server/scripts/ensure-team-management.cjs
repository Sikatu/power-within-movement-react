require('dotenv').config()
const { Pool } = require('pg')

const ACCESS_COLUMNS = [
  'dashboard_access',
  'clients_access',
  'sessions_access',
  'inbox_access',
  'communications_access',
  'learning_access',
  'memberships_access',
  'circle_access',
  'encouragements_access',
  'audit_access',
]

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing.')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_member_profiles (
        user_id UUID PRIMARY KEY REFERENCES system_users(id) ON DELETE CASCADE,
        display_name TEXT,
        job_title TEXT,
        department TEXT NOT NULL DEFAULT 'client_care'
          CHECK (department IN ('leadership', 'client_care', 'operations', 'content_community', 'learning', 'administration', 'other')),
        availability_status TEXT NOT NULL DEFAULT 'available'
          CHECK (availability_status IN ('available', 'focused', 'limited', 'away')),
        capacity_percent INTEGER NOT NULL DEFAULT 100
          CHECK (capacity_percent BETWEEN 0 AND 100),
        is_assignable BOOLEAN NOT NULL DEFAULT true,
        internal_notes TEXT,
        created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      DROP TRIGGER IF EXISTS set_team_member_profiles_updated_at ON team_member_profiles;
      CREATE TRIGGER set_team_member_profiles_updated_at
      BEFORE UPDATE ON team_member_profiles
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();

      CREATE TABLE IF NOT EXISTS team_member_permissions (
        user_id UUID PRIMARY KEY REFERENCES system_users(id) ON DELETE CASCADE,
        dashboard_access TEXT NOT NULL DEFAULT 'view'
          CHECK (dashboard_access IN ('none', 'view', 'manage')),
        clients_access TEXT NOT NULL DEFAULT 'none'
          CHECK (clients_access IN ('none', 'view', 'manage')),
        sessions_access TEXT NOT NULL DEFAULT 'none'
          CHECK (sessions_access IN ('none', 'view', 'manage')),
        inbox_access TEXT NOT NULL DEFAULT 'none'
          CHECK (inbox_access IN ('none', 'view', 'manage')),
        communications_access TEXT NOT NULL DEFAULT 'none'
          CHECK (communications_access IN ('none', 'view', 'manage')),
        learning_access TEXT NOT NULL DEFAULT 'none'
          CHECK (learning_access IN ('none', 'view', 'manage')),
        memberships_access TEXT NOT NULL DEFAULT 'none'
          CHECK (memberships_access IN ('none', 'view', 'manage')),
        circle_access TEXT NOT NULL DEFAULT 'none'
          CHECK (circle_access IN ('none', 'view', 'manage')),
        encouragements_access TEXT NOT NULL DEFAULT 'none'
          CHECK (encouragements_access IN ('none', 'view', 'manage')),
        audit_access TEXT NOT NULL DEFAULT 'none'
          CHECK (audit_access IN ('none', 'view', 'manage')),
        updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      DROP TRIGGER IF EXISTS set_team_member_permissions_updated_at ON team_member_permissions;
      CREATE TRIGGER set_team_member_permissions_updated_at
      BEFORE UPDATE ON team_member_permissions
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();

      CREATE TABLE IF NOT EXISTS team_client_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_user_id UUID NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
        client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
        assignment_role TEXT NOT NULL DEFAULT 'support'
          CHECK (assignment_role IN ('primary', 'support', 'specialist', 'observer')),
        assigned_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (team_user_id, client_profile_id)
      );

      DROP TRIGGER IF EXISTS set_team_client_assignments_updated_at ON team_client_assignments;
      CREATE TRIGGER set_team_client_assignments_updated_at
      BEFORE UPDATE ON team_client_assignments
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();

      CREATE INDEX IF NOT EXISTS idx_team_member_profiles_status
        ON team_member_profiles(availability_status, is_assignable);

      CREATE INDEX IF NOT EXISTS idx_team_client_assignments_user
        ON team_client_assignments(team_user_id, assignment_role, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_team_client_assignments_client
        ON team_client_assignments(client_profile_id, assignment_role, created_at DESC);
    `)

    await pool.query(`
      INSERT INTO team_member_profiles (
        user_id,
        display_name,
        job_title,
        department,
        availability_status,
        capacity_percent,
        is_assignable
      )
      SELECT
        su.id,
        split_part(su.email::text, '@', 1),
        CASE WHEN su.role = 'admin' THEN 'Administrator' ELSE 'Team Member' END,
        CASE WHEN su.role = 'admin' THEN 'administration' ELSE 'client_care' END,
        'available',
        100,
        true
      FROM system_users su
      WHERE su.role IN ('admin', 'staff')
      ON CONFLICT (user_id) DO NOTHING;
    `)

    const fullAccessValues = ACCESS_COLUMNS.map(() => `'manage'`).join(', ')

    await pool.query(`
      INSERT INTO team_member_permissions (
        user_id,
        ${ACCESS_COLUMNS.join(', ')}
      )
      SELECT
        su.id,
        ${fullAccessValues}
      FROM system_users su
      WHERE su.role = 'admin'
      ON CONFLICT (user_id) DO UPDATE SET
        ${ACCESS_COLUMNS.map((column) => `${column} = 'manage'`).join(',\n        ')},
        updated_at = now();
    `)

    await pool.query(`
      INSERT INTO team_member_permissions (user_id, dashboard_access)
      SELECT su.id, 'view'
      FROM system_users su
      WHERE su.role = 'staff'
      ON CONFLICT (user_id) DO NOTHING;
    `)

    const summary = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE su.role = 'admin')::int AS admins,
        COUNT(*) FILTER (WHERE su.role = 'staff')::int AS staff,
        COUNT(*) FILTER (WHERE tmp.is_assignable)::int AS assignable,
        (SELECT COUNT(*)::int FROM team_client_assignments) AS client_assignments
      FROM system_users su
      LEFT JOIN team_member_profiles tmp ON tmp.user_id = su.id
      WHERE su.role IN ('admin', 'staff')
    `)

    console.log('\nStaff & Team Management database support is ready.')
    console.table(summary.rows)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Team Management migration failed:', error)
  process.exitCode = 1
})
