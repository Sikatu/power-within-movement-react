const { pool } = require('../src/db/pool')

async function main() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mail_templates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      template_key text NOT NULL UNIQUE,
      name text NOT NULL,
      category text NOT NULL DEFAULT 'general',
      subject text NOT NULL,
      body_text text NOT NULL,
      body_html text,
      status text NOT NULL DEFAULT 'active',
      created_by_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_portal_email_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_profile_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
      invite_id uuid REFERENCES client_portal_invites(id) ON DELETE SET NULL,
      email_type text NOT NULL DEFAULT 'general',
      email_to text NOT NULL,
      subject text NOT NULL,
      body_text text NOT NULL,
      status text NOT NULL DEFAULT 'drafted',
      sent_at timestamptz,
      provider text,
      provider_message_id text,
      provider_response jsonb NOT NULL DEFAULT '{}'::jsonb,
      error_message text,
      created_by_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    ALTER TABLE client_portal_email_logs
    DROP CONSTRAINT IF EXISTS client_portal_email_logs_type_check
  `)

  await pool.query(`
    ALTER TABLE client_portal_email_logs
    ADD CONSTRAINT client_portal_email_logs_type_check
    CHECK (
      email_type IN (
        'portal_invite',
        'portal_login',
        'resource_notice',
        'welcome',
        'follow_up',
        'session_reminder',
        'broadcast',
        'general'
      )
    )
  `)

  await pool.query(`
    ALTER TABLE client_portal_email_logs
    DROP CONSTRAINT IF EXISTS client_portal_email_logs_status_check
  `)

  await pool.query(`
    ALTER TABLE client_portal_email_logs
    ADD CONSTRAINT client_portal_email_logs_status_check
    CHECK (status IN ('drafted', 'sent_manual', 'sent', 'failed'))
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS automation_workflows (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_key text NOT NULL UNIQUE,
      name text NOT NULL,
      description text,
      trigger_type text NOT NULL DEFAULT 'manual'
        CHECK (trigger_type IN ('manual', 'new_lead', 'pipeline_stage', 'client_converted')),
      trigger_stage text,
      status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'paused', 'archived')),
      default_assignee_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      created_by_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      updated_by_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS automation_steps (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id uuid NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
      position integer NOT NULL CHECK (position > 0),
      step_type text NOT NULL
        CHECK (step_type IN ('email', 'follow_up_task', 'internal_notification')),
      delay_minutes integer NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
      template_id uuid REFERENCES mail_templates(id) ON DELETE SET NULL,
      subject text,
      body_text text,
      task_title text,
      task_notes text,
      task_priority text NOT NULL DEFAULT 'normal'
        CHECK (task_priority IN ('low', 'normal', 'high', 'urgent')),
      notification_title text,
      notification_body text,
      notification_importance text NOT NULL DEFAULT 'normal'
        CHECK (notification_importance IN ('normal', 'high', 'urgent')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (workflow_id, position)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS automation_enrollments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id uuid NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
      client_profile_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
      trigger_source text NOT NULL DEFAULT 'manual',
      trigger_key text NOT NULL,
      status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'completed', 'cancelled', 'failed')),
      current_step_position integer NOT NULL DEFAULT 1,
      next_run_at timestamptz,
      failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
      last_error text,
      created_by_user_id uuid REFERENCES system_users(id) ON DELETE SET NULL,
      completed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (workflow_id, client_profile_id, trigger_key)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS automation_step_runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      enrollment_id uuid NOT NULL REFERENCES automation_enrollments(id) ON DELETE CASCADE,
      step_id uuid REFERENCES automation_steps(id) ON DELETE SET NULL,
      step_position integer NOT NULL,
      step_type text NOT NULL,
      status text NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'completed', 'skipped', 'failed')),
      attempts integer NOT NULL DEFAULT 1,
      scheduled_for timestamptz,
      completed_at timestamptz,
      error_message text,
      result jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_automation_workflows_status_trigger
    ON automation_workflows(status, trigger_type, trigger_stage)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_automation_steps_workflow_position
    ON automation_steps(workflow_id, position)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_automation_enrollments_status_next_run
    ON automation_enrollments(status, next_run_at)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_automation_enrollments_client
    ON automation_enrollments(client_profile_id, created_at DESC)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_automation_step_runs_enrollment_created
    ON automation_step_runs(enrollment_id, created_at DESC)
  `)

  const starterResult = await pool.query(`
    INSERT INTO automation_workflows (
      workflow_key,
      name,
      description,
      trigger_type,
      status
    )
    VALUES (
      'starter-new-inquiry-care',
      'New Inquiry Care Sequence',
      'A safe starter workflow for acknowledging a new inquiry and scheduling a thoughtful follow-up. Review every step before activating.',
      'new_lead',
      'draft'
    )
    ON CONFLICT (workflow_key) DO UPDATE
      SET updated_at = automation_workflows.updated_at
    RETURNING id
  `)

  const starterWorkflowId = starterResult.rows[0]?.id

  if (starterWorkflowId) {
    const templateResult = await pool.query(`
      SELECT id
      FROM mail_templates
      WHERE template_key = 'client_welcome_default'
      LIMIT 1
    `)

    await pool.query(
      `
      INSERT INTO automation_steps (
        workflow_id,
        position,
        step_type,
        delay_minutes,
        template_id,
        subject,
        body_text
      )
      VALUES (
        $1,
        1,
        'email',
        0,
        $2,
        'Thank you for reaching out to Power Within',
        'Hi {{clientName}},\n\nThank you for reaching out to Power Within Collective. We received your inquiry and will respond with care.\n\nWith care,\nPower Within Collective'
      )
      ON CONFLICT (workflow_id, position) DO NOTHING
      `,
      [starterWorkflowId, templateResult.rows[0]?.id || null],
    )

    await pool.query(
      `
      INSERT INTO automation_steps (
        workflow_id,
        position,
        step_type,
        delay_minutes,
        task_title,
        task_notes,
        task_priority
      )
      VALUES (
        $1,
        2,
        'follow_up_task',
        1440,
        'Personally follow up with {{clientName}}',
        'Review the inquiry, respond personally, and update the lead stage.',
        'normal'
      )
      ON CONFLICT (workflow_id, position) DO NOTHING
      `,
      [starterWorkflowId],
    )
  }

  const summary = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM automation_workflows) AS workflows,
      (SELECT COUNT(*)::int FROM automation_workflows WHERE status = 'active') AS active_workflows,
      (SELECT COUNT(*)::int FROM automation_steps) AS steps,
      (SELECT COUNT(*)::int FROM automation_enrollments WHERE status = 'active') AS active_enrollments,
      (SELECT COUNT(*)::int FROM automation_step_runs WHERE status = 'failed') AS failed_runs
  `)

  console.log('\nAutomation Studio database support is ready.')
  console.table(summary.rows)
  console.log('The starter workflow remains in Draft until reviewed and activated.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
