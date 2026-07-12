const { pool } = require('../src/db/pool')

async function main() {
  if (!pool) throw new Error('Database is not configured.')

  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

  await pool.query(`
    ALTER TABLE client_profiles
      ADD COLUMN IF NOT EXISTS pipeline_stage TEXT NOT NULL DEFAULT 'new_inquiry',
      ADD COLUMN IF NOT EXISTS lead_priority TEXT NOT NULL DEFAULT 'normal',
      ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS lead_owner_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS lead_summary TEXT,
      ADD COLUMN IF NOT EXISTS lost_reason TEXT,
      ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ
  `)

  await pool.query(`
    ALTER TABLE client_profiles
      DROP CONSTRAINT IF EXISTS client_profiles_pipeline_stage_check,
      DROP CONSTRAINT IF EXISTS client_profiles_lead_priority_check
  `)

  await pool.query(`
    ALTER TABLE client_profiles
      ADD CONSTRAINT client_profiles_pipeline_stage_check
        CHECK (pipeline_stage IN (
          'new_inquiry',
          'contacted',
          'consultation_booked',
          'qualified',
          'nurturing',
          'converted',
          'not_a_fit'
        )),
      ADD CONSTRAINT client_profiles_lead_priority_check
        CHECK (lead_priority IN ('low', 'normal', 'high', 'urgent'))
  `)

  await pool.query(`
    UPDATE client_profiles
    SET pipeline_stage = CASE
      WHEN client_status IN ('active_client', 'member') THEN 'converted'
      WHEN client_status IN ('inactive', 'archived') THEN 'not_a_fit'
      ELSE COALESCE(NULLIF(pipeline_stage, ''), 'new_inquiry')
    END,
    converted_at = CASE
      WHEN client_status IN ('active_client', 'member')
        THEN COALESCE(converted_at, intake_completed_at, updated_at, created_at, now())
      ELSE converted_at
    END
    WHERE pipeline_stage IS NULL
       OR pipeline_stage = ''
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead_follow_ups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
      assigned_to_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
      created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'completed', 'cancelled')),
      priority TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      due_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead_pipeline_activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
      actor_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
      activity_type TEXT NOT NULL
        CHECK (activity_type IN (
          'created',
          'stage_change',
          'priority_change',
          'owner_change',
          'note',
          'follow_up_scheduled',
          'follow_up_updated',
          'follow_up_completed',
          'converted'
        )),
      title TEXT NOT NULL,
      details TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE OR REPLACE FUNCTION set_lead_follow_ups_updated_at()
    RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `)

  await pool.query(`
    DROP TRIGGER IF EXISTS set_lead_follow_ups_updated_at ON lead_follow_ups
  `)

  await pool.query(`
    CREATE TRIGGER set_lead_follow_ups_updated_at
    BEFORE UPDATE ON lead_follow_ups
    FOR EACH ROW
    EXECUTE FUNCTION set_lead_follow_ups_updated_at()
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_client_profiles_pipeline_stage
      ON client_profiles(pipeline_stage)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_client_profiles_next_follow_up_at
      ON client_profiles(next_follow_up_at)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_client_profiles_lead_owner_user_id
      ON client_profiles(lead_owner_user_id)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_client_status_due
      ON lead_follow_ups(client_profile_id, status, due_at)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_assignee_status_due
      ON lead_follow_ups(assigned_to_user_id, status, due_at)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_pipeline_activities_client_created
      ON lead_pipeline_activities(client_profile_id, created_at DESC)
  `)

  const summary = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE client_status = 'lead')::int AS active_leads,
      COUNT(*) FILTER (
        WHERE pipeline_stage = 'converted'
          AND converted_at >= now() - interval '30 days'
      )::int AS converted_last_30_days,
      COUNT(*) FILTER (
        WHERE client_status = 'lead'
          AND next_follow_up_at IS NOT NULL
          AND next_follow_up_at < now()
      )::int AS overdue_follow_ups,
      (SELECT COUNT(*)::int FROM lead_follow_ups WHERE status = 'open') AS open_follow_ups
    FROM client_profiles
  `)

  console.log('\nLeads & Intake Pipeline database support is ready.')
  console.table(summary.rows)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
