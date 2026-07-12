#!/usr/bin/env node

const path = require('path')

const root = path.resolve(__dirname, '..')
require(path.join(root, 'node_modules', 'dotenv')).config({ path: path.join(root, '.env') })
const { Pool } = require(path.join(root, 'node_modules', 'pg'))

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing.')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query(`
      CREATE TABLE IF NOT EXISTS intake_form_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        form_scope TEXT NOT NULL DEFAULT 'booking'
          CHECK (form_scope IN ('booking', 'onboarding')),
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'active', 'archived')),
        welcome_message TEXT,
        completion_message TEXT,
        created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS intake_form_fields (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL REFERENCES intake_form_templates(id) ON DELETE CASCADE,
        field_key TEXT NOT NULL,
        label TEXT NOT NULL,
        help_text TEXT,
        placeholder TEXT,
        field_type TEXT NOT NULL DEFAULT 'short_text'
          CHECK (field_type IN ('short_text', 'long_text', 'email', 'phone', 'date', 'select', 'multiselect', 'checkbox')),
        required BOOLEAN NOT NULL DEFAULT false,
        options JSONB NOT NULL DEFAULT '[]'::jsonb,
        position INTEGER NOT NULL DEFAULT 1 CHECK (position > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (template_id, field_key)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS client_onboarding_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_profile_id UUID NOT NULL UNIQUE REFERENCES client_profiles(id) ON DELETE CASCADE,
        template_id UUID REFERENCES intake_form_templates(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'not_started'
          CHECK (status IN ('not_started', 'in_progress', 'submitted', 'reviewed', 'completed', 'paused')),
        assigned_to_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        due_at TIMESTAMPTZ,
        answers JSONB NOT NULL DEFAULT '{}'::jsonb,
        consent_accepted_at TIMESTAMPTZ,
        client_welcome_message TEXT,
        private_notes TEXT,
        started_at TIMESTAMPTZ,
        submitted_at TIMESTAMPTZ,
        reviewed_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_communications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        communication_type TEXT NOT NULL
          CHECK (communication_type IN ('request_received', 'booking_confirmed', 'reminder_24h', 'reminder_2h', 'booking_cancelled')),
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'sent', 'failed', 'skipped', 'cancelled')),
        scheduled_at TIMESTAMPTZ NOT NULL,
        sent_at TIMESTAMPTZ,
        email_to TEXT NOT NULL,
        subject TEXT NOT NULL,
        body_text TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        last_error TEXT,
        provider_message_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (booking_id, communication_type)
      )
    `)

    await client.query(`
      ALTER TABLE appointment_types
        ADD COLUMN IF NOT EXISTS booking_intake_template_id UUID REFERENCES intake_form_templates(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS onboarding_template_id UUID REFERENCES intake_form_templates(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS auto_create_client_profile BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS auto_start_onboarding BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS send_confirmation_email BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS reminder_24h_enabled BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS reminder_2h_enabled BOOLEAN NOT NULL DEFAULT false
    `)

    await client.query(`
      ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS reminder_2h_sent_at TIMESTAMPTZ
    `)

    await client.query(`
      DROP TRIGGER IF EXISTS set_intake_form_templates_updated_at ON intake_form_templates;
      CREATE TRIGGER set_intake_form_templates_updated_at
      BEFORE UPDATE ON intake_form_templates
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

      DROP TRIGGER IF EXISTS set_intake_form_fields_updated_at ON intake_form_fields;
      CREATE TRIGGER set_intake_form_fields_updated_at
      BEFORE UPDATE ON intake_form_fields
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

      DROP TRIGGER IF EXISTS set_client_onboarding_records_updated_at ON client_onboarding_records;
      CREATE TRIGGER set_client_onboarding_records_updated_at
      BEFORE UPDATE ON client_onboarding_records
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

      DROP TRIGGER IF EXISTS set_booking_communications_updated_at ON booking_communications;
      CREATE TRIGGER set_booking_communications_updated_at
      BEFORE UPDATE ON booking_communications
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_intake_form_templates_scope_status
        ON intake_form_templates(form_scope, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_intake_form_fields_template_position
        ON intake_form_fields(template_id, position);
      CREATE INDEX IF NOT EXISTS idx_client_onboarding_status_due
        ON client_onboarding_records(status, due_at, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_client_onboarding_assignee_status
        ON client_onboarding_records(assigned_to_user_id, status, due_at);
      CREATE INDEX IF NOT EXISTS idx_booking_communications_due
        ON booking_communications(status, scheduled_at, attempts);
    `)

    const creatorResult = await client.query(`
      SELECT id
      FROM system_users
      WHERE status = 'active'
        AND role IN ('developer', 'owner', 'admin')
      ORDER BY CASE role WHEN 'developer' THEN 0 WHEN 'owner' THEN 1 ELSE 2 END, created_at
      LIMIT 1
    `)
    const creatorUserId = creatorResult.rows[0]?.id || null

    const bookingTemplateResult = await client.query(`
      INSERT INTO intake_form_templates (
        name,
        description,
        form_scope,
        status,
        welcome_message,
        completion_message,
        created_by_user_id,
        updated_by_user_id
      )
      SELECT
        'Private Session Request',
        'A concise pre-session form for public appointment requests.',
        'booking',
        'draft',
        'Share only what feels useful before your session.',
        'Thank you. Your request and intake details were received.',
        $1,
        $1
      WHERE NOT EXISTS (
        SELECT 1 FROM intake_form_templates WHERE name = 'Private Session Request' AND form_scope = 'booking'
      )
      RETURNING id
    `, [creatorUserId])

    let bookingTemplateId = bookingTemplateResult.rows[0]?.id
    if (!bookingTemplateId) {
      const existing = await client.query(`
        SELECT id FROM intake_form_templates
        WHERE name = 'Private Session Request' AND form_scope = 'booking'
        LIMIT 1
      `)
      bookingTemplateId = existing.rows[0]?.id
    }

    if (bookingTemplateId) {
      const bookingFields = [
        ['support_focus', 'What would you like support with?', 'long_text', true, 'Share anything helpful before your appointment.', [], 1],
        ['preferred_focus', 'What would make this session meaningful for you?', 'long_text', false, 'A goal, question, or outcome you would like to explore.', [], 2],
        ['accessibility_needs', 'Accessibility or accommodation needs', 'long_text', false, 'Optional', [], 3],
        ['consent', 'I consent to Power Within using these details to prepare for my appointment.', 'checkbox', true, '', [], 4],
      ]

      for (const field of bookingFields) {
        await client.query(`
          INSERT INTO intake_form_fields (
            template_id, field_key, label, field_type, required, placeholder, options, position
          )
          VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7::jsonb, $8)
          ON CONFLICT (template_id, field_key) DO NOTHING
        `, [bookingTemplateId, field[0], field[1], field[2], field[3], field[4], JSON.stringify(field[5]), field[6]])
      }
    }

    const onboardingTemplateResult = await client.query(`
      INSERT INTO intake_form_templates (
        name,
        description,
        form_scope,
        status,
        welcome_message,
        completion_message,
        created_by_user_id,
        updated_by_user_id
      )
      SELECT
        'Client Welcome & Intake',
        'A private onboarding questionnaire for new Power Within clients.',
        'onboarding',
        'draft',
        'Welcome. This private intake helps the Power Within team prepare thoughtful, personalized support.',
        'Your onboarding is complete. The team will review your responses and prepare your next step.',
        $1,
        $1
      WHERE NOT EXISTS (
        SELECT 1 FROM intake_form_templates WHERE name = 'Client Welcome & Intake' AND form_scope = 'onboarding'
      )
      RETURNING id
    `, [creatorUserId])

    let onboardingTemplateId = onboardingTemplateResult.rows[0]?.id
    if (!onboardingTemplateId) {
      const existing = await client.query(`
        SELECT id FROM intake_form_templates
        WHERE name = 'Client Welcome & Intake' AND form_scope = 'onboarding'
        LIMIT 1
      `)
      onboardingTemplateId = existing.rows[0]?.id
    }

    if (onboardingTemplateId) {
      const onboardingFields = [
        ['primary_goal', 'What is the most important change you want support with?', 'long_text', true, 'Describe the change, clarity, or confidence you want to build.', [], 1],
        ['current_season', 'How would you describe your current season?', 'long_text', true, 'Share the context that feels most relevant.', [], 2],
        ['support_preferences', 'How do you prefer to receive support?', 'multiselect', false, '', ['Clear action steps', 'Reflection prompts', 'Gentle accountability', 'Direct feedback', 'Visual examples'], 3],
        ['emergency_contact_name', 'Emergency contact name', 'short_text', false, 'Optional', [], 4],
        ['emergency_contact_phone', 'Emergency contact phone', 'phone', false, 'Optional', [], 5],
        ['consent', 'I confirm that these responses are accurate and may be used to support my Power Within experience.', 'checkbox', true, '', [], 6],
      ]

      for (const field of onboardingFields) {
        await client.query(`
          INSERT INTO intake_form_fields (
            template_id, field_key, label, field_type, required, placeholder, options, position
          )
          VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7::jsonb, $8)
          ON CONFLICT (template_id, field_key) DO NOTHING
        `, [onboardingTemplateId, field[0], field[1], field[2], field[3], field[4], JSON.stringify(field[5]), field[6]])
      }
    }

    await client.query('COMMIT')

    const summary = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM intake_form_templates) AS templates,
        (SELECT COUNT(*)::int FROM intake_form_fields) AS fields,
        (SELECT COUNT(*)::int FROM client_onboarding_records) AS onboarding_records,
        (SELECT COUNT(*)::int FROM booking_communications WHERE status = 'pending') AS pending_booking_messages
    `)

    console.log('\nBooking, Intake & Onboarding database support is ready.')
    console.table(summary.rows)
    console.log('Both starter intake templates remain in Draft for safe review.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('\nBooking, Intake & Onboarding migration failed:')
  console.error(error.stack || error.message)
  process.exitCode = 1
})
