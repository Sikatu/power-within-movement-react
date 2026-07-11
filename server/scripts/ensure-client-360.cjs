require('dotenv').config()
const { Pool } = require('pg')

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing.')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_care_plans (
        client_profile_id UUID PRIMARY KEY REFERENCES client_profiles(id) ON DELETE CASCADE,
        journey_stage TEXT NOT NULL DEFAULT 'onboarding'
          CHECK (journey_stage IN ('onboarding', 'clarity', 'active_work', 'integration', 'maintenance', 'complete')),
        care_status TEXT NOT NULL DEFAULT 'not_started'
          CHECK (care_status IN ('not_started', 'on_track', 'attention', 'paused', 'completed')),
        primary_goal TEXT,
        transformation_focus TEXT,
        success_definition TEXT,
        client_visible_focus TEXT,
        private_strategy_notes TEXT,
        next_review_at TIMESTAMPTZ,
        updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      DROP TRIGGER IF EXISTS set_client_care_plans_updated_at ON client_care_plans;
      CREATE TRIGGER set_client_care_plans_updated_at
      BEFORE UPDATE ON client_care_plans
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();

      CREATE TABLE IF NOT EXISTS client_care_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        owner_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        due_at TIMESTAMPTZ,
        priority TEXT NOT NULL DEFAULT 'normal'
          CHECK (priority IN ('normal', 'high', 'urgent')),
        status TEXT NOT NULL DEFAULT 'open'
          CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
        visibility TEXT NOT NULL DEFAULT 'team'
          CHECK (visibility IN ('team', 'client')),
        completed_at TIMESTAMPTZ,
        created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      DROP TRIGGER IF EXISTS set_client_care_actions_updated_at ON client_care_actions;
      CREATE TRIGGER set_client_care_actions_updated_at
      BEFORE UPDATE ON client_care_actions
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();

      CREATE INDEX IF NOT EXISTS idx_client_care_actions_client_status
        ON client_care_actions(client_profile_id, status, due_at, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_client_care_actions_owner_status
        ON client_care_actions(owner_user_id, status, due_at);

      CREATE INDEX IF NOT EXISTS idx_client_care_plans_review
        ON client_care_plans(care_status, next_review_at);
    `)

    await pool.query(`
      INSERT INTO client_care_plans (client_profile_id)
      SELECT cp.id
      FROM client_profiles cp
      WHERE cp.client_status <> 'archived'
      ON CONFLICT (client_profile_id) DO NOTHING;
    `)

    const summary = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM client_care_plans) AS care_plans,
        (SELECT COUNT(*)::int FROM client_care_actions) AS care_actions,
        (SELECT COUNT(*)::int FROM client_care_actions WHERE status IN ('open', 'in_progress')) AS open_actions,
        (SELECT COUNT(*)::int FROM client_care_actions WHERE status IN ('open', 'in_progress') AND due_at < now()) AS overdue_actions
    `)

    console.log('\nClient 360 & Care Plan database support is ready.')
    console.table(summary.rows)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Client 360 migration failed:', error)
  process.exitCode = 1
})
