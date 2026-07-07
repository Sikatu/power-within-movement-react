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
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      CONSTRAINT mail_templates_status_check
        CHECK (status IN ('active', 'archived')),
      CONSTRAINT mail_templates_category_check
        CHECK (
          category IN (
            'portal_invite',
            'welcome',
            'follow_up',
            'resource_notice',
            'session_reminder',
            'broadcast',
            'general'
          )
        )
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mail_templates_category
    ON mail_templates(category)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mail_templates_status
    ON mail_templates(status)
  `)

  await pool.query(`
    INSERT INTO mail_templates (
      template_key,
      name,
      category,
      subject,
      body_text,
      status
    )
    VALUES
      (
        'portal_invite_default',
        'Portal Invitation',
        'portal_invite',
        'Your Power Within Client Portal is ready',
        'Hi {{clientName}},

Your private Power Within Client Portal is ready.

Please use the secure link below to create your portal access:

{{portalLink}}

This link is private and expires on {{expiresAt}}.

Inside your portal, you will be able to access shared notes, resources, reminders, and session-related care prepared for you.

With care,
Power Within Collective?',
        'active'
      ),
      (
        'client_welcome_default',
        'Client Welcome',
        'welcome',
        'Welcome to Power Within Collective',
        'Hi {{clientName}},

Welcome to Power Within Collective.

We are honored to support your next season of confidence, presence, and transformation.

Your next steps and resources will be shared with you soon.

With care,
Power Within Collective?',
        'active'
      ),
      (
        'follow_up_default',
        'Session Follow-Up',
        'follow_up',
        'A note following your Power Within session',
        'Hi {{clientName}},

Thank you for spending time with us.

Here are your follow-up notes:

{{followUpNotes}}

With care,
Power Within Collective?',
        'active'
      ),
      (
        'resource_notice_default',
        'New Portal Resource',
        'resource_notice',
        'A new resource has been added to your portal',
        'Hi {{clientName}},

A new resource has been added to your private client portal:

{{resourceTitle}}

You may access it inside your portal.

With care,
Power Within Collective?',
        'active'
      )
    ON CONFLICT (template_key) DO NOTHING
  `)

  console.log('\nmail_templates table is ready with default Power Within templates.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
