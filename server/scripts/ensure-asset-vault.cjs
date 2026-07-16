const path = require('path')

require(path.resolve(__dirname, '..', 'node_modules', 'dotenv')).config({
  path: path.resolve(__dirname, '..', '.env'),
})

const { Pool } = require(path.resolve(__dirname, '..', 'node_modules', 'pg'))

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

    await client.query(`
      CREATE TABLE IF NOT EXISTS asset_folders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        parent_id UUID REFERENCES asset_folders(id) ON DELETE SET NULL,
        created_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_folders_active_slug
      ON asset_folders (lower(slug))
      WHERE archived_at IS NULL
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        original_filename TEXT NOT NULL,
        file_extension TEXT,
        mime_type TEXT NOT NULL,
        size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
        checksum_sha256 TEXT NOT NULL,
        storage_driver TEXT NOT NULL CHECK (storage_driver IN ('local', 's3')),
        storage_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
        scan_status TEXT NOT NULL DEFAULT 'disabled' CHECK (scan_status IN ('disabled', 'pending', 'clean', 'blocked', 'failed')),
        scan_message TEXT,
        scanned_at TIMESTAMPTZ,
        visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'client_assigned')),
        folder_id UUID REFERENCES asset_folders(id) ON DELETE SET NULL,
        tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
        current_version_number INTEGER NOT NULL DEFAULT 1 CHECK (current_version_number > 0),
        created_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      ALTER TABLE assets
      ADD COLUMN IF NOT EXISTS scan_status TEXT NOT NULL DEFAULT 'disabled',
      ADD COLUMN IF NOT EXISTS scan_message TEXT,
      ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ
    `)
    await client.query(`
      ALTER TABLE assets
      DROP CONSTRAINT IF EXISTS assets_scan_status_check
    `)
    await client.query(`
      ALTER TABLE assets
      ADD CONSTRAINT assets_scan_status_check
      CHECK (scan_status IN ('disabled', 'pending', 'clean', 'blocked', 'failed'))
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS asset_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL CHECK (version_number > 0),
        original_filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
        checksum_sha256 TEXT NOT NULL,
        storage_driver TEXT NOT NULL CHECK (storage_driver IN ('local', 's3')),
        storage_key TEXT NOT NULL UNIQUE,
        notes TEXT,
        created_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (asset_id, version_number)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS asset_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
        assigned_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
        title_override TEXT,
        description_override TEXT,
        portal_resource_id UUID REFERENCES client_portal_resources(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_assignments_active_client
      ON asset_assignments(asset_id, client_profile_id)
      WHERE status = 'active'
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS asset_access_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
        assignment_id UUID REFERENCES asset_assignments(id) ON DELETE SET NULL,
        actor_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        client_profile_id UUID REFERENCES client_profiles(id) ON DELETE SET NULL,
        action TEXT NOT NULL CHECK (
          action IN ('upload', 'download', 'preview', 'metadata_update', 'version_upload', 'assign', 'unassign', 'archive', 'restore', 'folder_create')
        ),
        metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      ALTER TABLE asset_access_logs
      DROP CONSTRAINT IF EXISTS asset_access_logs_action_check
    `)
    await client.query(`
      ALTER TABLE asset_access_logs
      ADD CONSTRAINT asset_access_logs_action_check CHECK (
        action IN (
          'upload', 'download', 'preview', 'metadata_update', 'version_upload',
          'assign', 'assign_bulk', 'unassign', 'archive', 'restore', 'folder_create',
          'grant_create', 'grant_redeem', 'scan_status', 'relationship_create', 'relationship_remove'
        )
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS asset_access_grants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token_hash TEXT NOT NULL UNIQUE,
        asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        assignment_id UUID REFERENCES asset_assignments(id) ON DELETE SET NULL,
        issued_to_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        client_profile_id UUID REFERENCES client_profiles(id) ON DELETE SET NULL,
        purpose TEXT NOT NULL CHECK (purpose IN ('download', 'preview')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'revoked', 'expired')),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS asset_relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        related_asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
        context_type TEXT NOT NULL DEFAULT 'generic' CHECK (context_type IN ('letter', 'circle_post', 'founder_recording', 'transcript', 'generic')),
        context_id TEXT,
        relationship_type TEXT NOT NULL DEFAULT 'attachment' CHECK (relationship_type IN ('attachment', 'source_recording', 'transcript', 'featured')),
        created_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (related_asset_id IS NULL OR related_asset_id <> asset_id),
        CHECK (related_asset_id IS NOT NULL OR context_id IS NOT NULL)
      )
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assets_status_created
      ON assets(status, created_at DESC)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assets_folder_status
      ON assets(folder_id, status)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assets_tags
      ON assets USING GIN(tags)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_asset_versions_asset
      ON asset_versions(asset_id, version_number DESC)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_asset_assignments_client_status
      ON asset_assignments(client_profile_id, status, assigned_at DESC)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_asset_access_logs_asset_created
      ON asset_access_logs(asset_id, created_at DESC)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_asset_access_grants_asset_status
      ON asset_access_grants(asset_id, status, expires_at DESC)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_asset_access_grants_expiry
      ON asset_access_grants(status, expires_at)
    `)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_relationships_active_asset
      ON asset_relationships(asset_id, related_asset_id, relationship_type)
      WHERE archived_at IS NULL AND related_asset_id IS NOT NULL
    `)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_relationships_active_context
      ON asset_relationships(asset_id, context_type, context_id, relationship_type)
      WHERE archived_at IS NULL AND context_id IS NOT NULL
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_asset_relationships_context
      ON asset_relationships(context_type, context_id)
      WHERE archived_at IS NULL
    `)

    for (const tableName of ['asset_folders', 'assets', 'asset_assignments', 'asset_relationships']) {
      await client.query(`DROP TRIGGER IF EXISTS set_${tableName}_updated_at ON ${tableName}`)
      await client.query(`
        CREATE TRIGGER set_${tableName}_updated_at
        BEFORE UPDATE ON ${tableName}
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at()
      `)
    }

    const defaultFolders = [
      ['General', 'general'],
      ['Client Resources', 'client-resources'],
      ['Newsletter Media', 'newsletter-media'],
      ['Founder Recordings', 'founder-recordings'],
      ['Transcripts', 'transcripts'],
    ]

    for (const [name, slug] of defaultFolders) {
      await client.query(
        `
        INSERT INTO asset_folders (name, slug)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [name, slug],
      )
    }

    await client.query('COMMIT')

    const summary = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM asset_folders WHERE archived_at IS NULL) AS folders,
        (SELECT COUNT(*)::int FROM assets WHERE status = 'active') AS assets,
        (SELECT COUNT(*)::int FROM asset_assignments WHERE status = 'active') AS assignments,
        (SELECT COUNT(*)::int FROM asset_relationships WHERE archived_at IS NULL) AS relationships,
        (SELECT COUNT(*)::int FROM asset_access_grants WHERE status = 'active' AND expires_at > now()) AS active_grants
    `)

    console.log('\nAsset Vault database support is ready.')
    console.table(summary.rows)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Asset Vault migration failed:', error)
  process.exitCode = 1
})
