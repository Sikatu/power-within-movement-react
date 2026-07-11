const { pool } = require('../src/db/pool')

async function main() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS circle_posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      membership_id uuid REFERENCES memberships(id) ON DELETE SET NULL,
      author_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      post_type text NOT NULL DEFAULT 'post',
      title text NOT NULL,
      body text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      is_pinned boolean NOT NULL DEFAULT false,
      comments_enabled boolean NOT NULL DEFAULT true,
      reactions_enabled boolean NOT NULL DEFAULT true,
      event_starts_at timestamptz,
      event_ends_at timestamptz,
      published_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT circle_posts_type_check
        CHECK (post_type IN ('post', 'announcement', 'event', 'challenge')),
      CONSTRAINT circle_posts_status_check
        CHECK (status IN ('draft', 'published', 'archived')),
      CONSTRAINT circle_posts_event_range_check
        CHECK (event_ends_at IS NULL OR event_starts_at IS NULL OR event_ends_at > event_starts_at)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS circle_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
      author_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      body text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      hidden_by_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      hidden_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT circle_comments_status_check
        CHECK (status IN ('active', 'hidden', 'deleted'))
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS circle_reactions (
      post_id uuid NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
      reaction_type text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT circle_reactions_type_check
        CHECK (reaction_type IN ('heart', 'celebrate', 'support')),
      PRIMARY KEY (post_id, user_id)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS circle_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid REFERENCES circle_posts(id) ON DELETE CASCADE,
      comment_id uuid REFERENCES circle_comments(id) ON DELETE CASCADE,
      reporter_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      reason text NOT NULL,
      details text,
      status text NOT NULL DEFAULT 'open',
      reviewed_by_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      reviewed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT circle_reports_target_check
        CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL),
      CONSTRAINT circle_reports_status_check
        CHECK (status IN ('open', 'resolved', 'dismissed'))
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_circle_posts_status_published
      ON circle_posts(status, published_at DESC)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_circle_posts_membership_status
      ON circle_posts(membership_id, status)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_circle_comments_post_status
      ON circle_comments(post_id, status, created_at)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_circle_reports_status_created
      ON circle_reports(status, created_at DESC)
  `)

  await pool.query(`
    UPDATE platform_settings
    SET
      value = jsonb_set(
        COALESCE(value, '{}'::jsonb),
        '{featureFlags,circleCommunity}',
        'true'::jsonb,
        true
      ),
      updated_at = now()
    WHERE key = 'developer_operations'
  `)

  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM circle_posts) AS posts,
      (SELECT COUNT(*)::int FROM circle_comments) AS comments,
      (SELECT COUNT(*)::int FROM circle_reports) AS reports
  `)

  console.log('\nThe Circle Community database support is ready.')
  console.log('The Circle feature is enabled for active members.')
  console.table(result.rows)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
