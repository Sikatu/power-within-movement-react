require('dotenv').config()

const { Pool } = require('pg')

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing.')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id UUID PRIMARY KEY REFERENCES system_users(id) ON DELETE CASCADE,
        email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        email_categories JSONB NOT NULL DEFAULT '{
          "inbox": true,
          "sessions": true,
          "resources": true,
          "learning": true,
          "memberships": true,
          "encouragements": true,
          "community": true,
          "system": true
        }'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      DROP TRIGGER IF EXISTS set_notification_preferences_updated_at
        ON notification_preferences;
      CREATE TRIGGER set_notification_preferences_updated_at
      BEFORE UPDATE ON notification_preferences
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();

      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_user_id UUID NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
        actor_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        category TEXT NOT NULL CHECK (
          category IN (
            'inbox',
            'sessions',
            'resources',
            'learning',
            'memberships',
            'encouragements',
            'community',
            'system'
          )
        ),
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        action_url TEXT,
        action_label TEXT,
        entity_type TEXT,
        entity_id UUID,
        importance TEXT NOT NULL DEFAULT 'normal'
          CHECK (importance IN ('normal', 'high', 'urgent')),
        dedupe_key TEXT,
        read_at TIMESTAMPTZ,
        dismissed_at TIMESTAMPTZ,
        email_status TEXT NOT NULL DEFAULT 'not_requested'
          CHECK (email_status IN ('not_requested', 'pending', 'sent', 'skipped', 'failed')),
        email_attempts INTEGER NOT NULL DEFAULT 0,
        email_error TEXT,
        email_sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '180 days')
      );

      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;
      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
      UPDATE notifications
      SET expires_at = created_at + interval '180 days'
      WHERE expires_at IS NULL;
      ALTER TABLE notifications
        ALTER COLUMN expires_at SET DEFAULT (now() + interval '180 days');
      ALTER TABLE notifications
        ALTER COLUMN expires_at SET NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_key
        ON notifications(dedupe_key)
        WHERE dedupe_key IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
        ON notifications(recipient_user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
        ON notifications(recipient_user_id, read_at, created_at DESC)
        WHERE dismissed_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_notifications_email_queue
        ON notifications(email_status, created_at)
        WHERE email_status = 'pending';
      CREATE INDEX IF NOT EXISTS idx_notifications_expiration
        ON notifications(expires_at);

      INSERT INTO notification_preferences (user_id)
      SELECT id
      FROM system_users
      WHERE status = 'active'
      ON CONFLICT (user_id) DO NOTHING;
    `)

    await client.query(`
      CREATE OR REPLACE FUNCTION pwc_insert_notification(
        p_recipient_user_id UUID,
        p_actor_user_id UUID,
        p_category TEXT,
        p_title TEXT,
        p_body TEXT,
        p_action_url TEXT,
        p_action_label TEXT,
        p_entity_type TEXT,
        p_entity_id UUID,
        p_importance TEXT,
        p_dedupe_key TEXT
      )
      RETURNS VOID AS $$
      BEGIN
        IF p_recipient_user_id IS NULL THEN
          RETURN;
        END IF;

        INSERT INTO notifications (
          recipient_user_id,
          actor_user_id,
          category,
          title,
          body,
          action_url,
          action_label,
          entity_type,
          entity_id,
          importance,
          dedupe_key,
          email_status
        )
        SELECT
          u.id,
          p_actor_user_id,
          p_category,
          left(COALESCE(p_title, 'Power Within update'), 180),
          left(COALESCE(p_body, 'A new update is ready.'), 600),
          left(p_action_url, 400),
          left(p_action_label, 80),
          left(p_entity_type, 80),
          p_entity_id,
          CASE
            WHEN p_importance IN ('normal', 'high', 'urgent') THEN p_importance
            ELSE 'normal'
          END,
          p_dedupe_key,
          CASE
            WHEN COALESCE(pref.email_enabled, FALSE)
              AND COALESCE((pref.email_categories ->> p_category)::boolean, TRUE)
            THEN 'pending'
            ELSE 'not_requested'
          END
        FROM system_users u
        LEFT JOIN notification_preferences pref
          ON pref.user_id = u.id
        WHERE u.id = p_recipient_user_id
          AND u.status = 'active'
        ON CONFLICT (dedupe_key)
          WHERE dedupe_key IS NOT NULL
        DO NOTHING;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION pwc_notify_active_team(
        p_actor_user_id UUID,
        p_category TEXT,
        p_title TEXT,
        p_body TEXT,
        p_action_url TEXT,
        p_action_label TEXT,
        p_entity_type TEXT,
        p_entity_id UUID,
        p_importance TEXT,
        p_dedupe_prefix TEXT
      )
      RETURNS VOID AS $$
      DECLARE
        recipient RECORD;
      BEGIN
        FOR recipient IN
          SELECT id
          FROM system_users
          WHERE status = 'active'
            AND role IN ('developer', 'owner', 'admin', 'staff')
            AND (p_actor_user_id IS NULL OR id <> p_actor_user_id)
        LOOP
          PERFORM pwc_insert_notification(
            recipient.id,
            p_actor_user_id,
            p_category,
            p_title,
            p_body,
            p_action_url,
            p_action_label,
            p_entity_type,
            p_entity_id,
            p_importance,
            p_dedupe_prefix || ':' || recipient.id::text
          );
        END LOOP;
      END;
      $$ LANGUAGE plpgsql;

      CREATE OR REPLACE FUNCTION pwc_notify_client_profile(
        p_client_profile_id UUID,
        p_actor_user_id UUID,
        p_category TEXT,
        p_title TEXT,
        p_body TEXT,
        p_action_url TEXT,
        p_action_label TEXT,
        p_entity_type TEXT,
        p_entity_id UUID,
        p_importance TEXT,
        p_dedupe_prefix TEXT
      )
      RETURNS VOID AS $$
      DECLARE
        recipient_user_id UUID;
      BEGIN
        SELECT user_id
        INTO recipient_user_id
        FROM client_profiles
        WHERE id = p_client_profile_id
        LIMIT 1;

        IF recipient_user_id IS NULL THEN
          RETURN;
        END IF;

        PERFORM pwc_insert_notification(
          recipient_user_id,
          p_actor_user_id,
          p_category,
          p_title,
          p_body,
          p_action_url,
          p_action_label,
          p_entity_type,
          p_entity_id,
          p_importance,
          p_dedupe_prefix || ':' || recipient_user_id::text
        );
      END;
      $$ LANGUAGE plpgsql;
    `)

    await client.query(`
      CREATE OR REPLACE FUNCTION pwc_notify_conversation_message()
      RETURNS TRIGGER AS $$
      DECLARE
        conversation_record RECORD;
        client_name TEXT;
      BEGIN
        IF NEW.is_internal_note THEN
          RETURN NEW;
        END IF;

        SELECT
          c.client_profile_id,
          c.subject,
          cp.first_name,
          cp.last_name
        INTO conversation_record
        FROM client_conversations c
        JOIN client_profiles cp ON cp.id = c.client_profile_id
        WHERE c.id = NEW.conversation_id;

        client_name := COALESCE(
          NULLIF(trim(concat_ws(' ', conversation_record.first_name, conversation_record.last_name)), ''),
          'A client'
        );

        IF NEW.sender_role = 'client' THEN
          PERFORM pwc_notify_active_team(
            NEW.sender_user_id,
            'inbox',
            'New client message',
            client_name || ' replied to “' || conversation_record.subject || '”.',
            '/admin/inbox?conversation=' || NEW.conversation_id::text,
            'Open Secure Inbox',
            'client_conversation_messages',
            NEW.id,
            'high',
            'conversation-message-team:' || NEW.id::text
          );
        ELSE
          PERFORM pwc_notify_client_profile(
            conversation_record.client_profile_id,
            NEW.sender_user_id,
            'inbox',
            'New message from Power Within',
            'There is a new reply in “' || conversation_record.subject || '”.',
            '/client-portal/messages/' || NEW.conversation_id::text,
            'Open Message',
            'client_conversation_messages',
            NEW.id,
            CASE WHEN NEW.sender_role IN ('developer', 'owner') THEN 'high' ELSE 'normal' END,
            'conversation-message-client:' || NEW.id::text
          );
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS notify_conversation_message
        ON client_conversation_messages;
      CREATE TRIGGER notify_conversation_message
      AFTER INSERT ON client_conversation_messages
      FOR EACH ROW
      EXECUTE FUNCTION pwc_notify_conversation_message();
    `)

    await client.query(`
      CREATE OR REPLACE FUNCTION pwc_notify_booking_insert()
      RETURNS TRIGGER AS $$
      DECLARE
        appointment_name TEXT;
        client_name TEXT;
      BEGIN
        IF NEW.status <> 'requested' THEN
          RETURN NEW;
        END IF;

        SELECT name INTO appointment_name
        FROM appointment_types
        WHERE id = NEW.appointment_type_id;

        IF NEW.client_profile_id IS NOT NULL THEN
          SELECT NULLIF(trim(concat_ws(' ', first_name, last_name)), '')
          INTO client_name
          FROM client_profiles
          WHERE id = NEW.client_profile_id;
        END IF;

        client_name := COALESCE(client_name, NEW.guest_name, NEW.guest_email::text, 'A client');

        PERFORM pwc_notify_active_team(
          NULL,
          'sessions',
          'New session request',
          client_name || ' requested ' || COALESCE(appointment_name, 'a private session') || '.',
          '/admin/scheduler',
          'Open Sessions',
          'bookings',
          NEW.id,
          'high',
          'booking-request:' || NEW.id::text
        );

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS notify_booking_insert ON bookings;
      CREATE TRIGGER notify_booking_insert
      AFTER INSERT ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION pwc_notify_booking_insert();

      CREATE OR REPLACE FUNCTION pwc_notify_booking_status()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = OLD.status
          OR NEW.client_profile_id IS NULL
          OR NEW.status NOT IN ('approved', 'confirmed', 'cancelled', 'completed') THEN
          RETURN NEW;
        END IF;

        PERFORM pwc_notify_client_profile(
          NEW.client_profile_id,
          NULL,
          'sessions',
          CASE NEW.status
            WHEN 'approved' THEN 'Your session request was approved'
            WHEN 'confirmed' THEN 'Your session is confirmed'
            WHEN 'cancelled' THEN 'Your session was cancelled'
            ELSE 'Your session is complete'
          END,
          CASE NEW.status
            WHEN 'cancelled' THEN COALESCE(NULLIF(NEW.cancellation_reason, ''), 'Open Sessions to review the update.')
            ELSE 'Open Sessions to review the latest details.'
          END,
          '/client-portal/sessions',
          'View Sessions',
          'bookings',
          NEW.id,
          CASE WHEN NEW.status = 'cancelled' THEN 'high' ELSE 'normal' END,
          'booking-status:' || NEW.id::text || ':' || NEW.status
        );

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS notify_booking_status ON bookings;
      CREATE TRIGGER notify_booking_status
      AFTER UPDATE OF status ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION pwc_notify_booking_status();
    `)

    await client.query(`
      CREATE OR REPLACE FUNCTION pwc_notify_booking_change_request()
      RETURNS TRIGGER AS $$
      DECLARE
        client_name TEXT;
      BEGIN
        SELECT COALESCE(
          NULLIF(trim(concat_ws(' ', first_name, last_name)), ''),
          'A client'
        )
        INTO client_name
        FROM client_profiles
        WHERE id = NEW.client_profile_id;

        PERFORM pwc_notify_active_team(
          NULL,
          'sessions',
          CASE NEW.request_type
            WHEN 'cancel' THEN 'Session cancellation requested'
            ELSE 'Session reschedule requested'
          END,
          client_name || ' submitted a session change request.',
          '/admin/session-changes',
          'Review Request',
          'booking_change_requests',
          NEW.id,
          'high',
          'booking-change-request:' || NEW.id::text
        );

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS notify_booking_change_request
        ON booking_change_requests;
      CREATE TRIGGER notify_booking_change_request
      AFTER INSERT ON booking_change_requests
      FOR EACH ROW
      EXECUTE FUNCTION pwc_notify_booking_change_request();

      CREATE OR REPLACE FUNCTION pwc_notify_booking_change_status()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = OLD.status OR NEW.status NOT IN ('approved', 'declined') THEN
          RETURN NEW;
        END IF;

        PERFORM pwc_notify_client_profile(
          NEW.client_profile_id,
          NEW.reviewer_user_id,
          'sessions',
          CASE NEW.status
            WHEN 'approved' THEN 'Your session change was approved'
            ELSE 'Your session change was reviewed'
          END,
          COALESCE(NULLIF(NEW.reviewer_notes, ''), 'Open Sessions to review the decision and next steps.'),
          '/client-portal/sessions',
          'View Sessions',
          'booking_change_requests',
          NEW.id,
          'high',
          'booking-change-status:' || NEW.id::text || ':' || NEW.status
        );

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS notify_booking_change_status
        ON booking_change_requests;
      CREATE TRIGGER notify_booking_change_status
      AFTER UPDATE OF status ON booking_change_requests
      FOR EACH ROW
      EXECUTE FUNCTION pwc_notify_booking_change_status();
    `)

    await client.query(`
      CREATE OR REPLACE FUNCTION pwc_notify_course_access()
      RETURNS TRIGGER AS $$
      DECLARE
        course_title TEXT;
      BEGIN
        IF NEW.access_status <> 'active' THEN
          RETURN NEW;
        END IF;

        IF TG_OP = 'UPDATE' AND OLD.access_status = NEW.access_status THEN
          RETURN NEW;
        END IF;

        SELECT title INTO course_title
        FROM courses
        WHERE id = NEW.course_id;

        PERFORM pwc_notify_client_profile(
          NEW.client_profile_id,
          NEW.granted_by,
          'learning',
          'New learning experience available',
          '“' || COALESCE(course_title, 'A new course') || '” is ready in your Learning Library.',
          '/client-portal/learning',
          'Open Learning',
          'course_access',
          NEW.id,
          'normal',
          'course-access:' || NEW.id::text || ':active'
        );

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS notify_course_access ON course_access;
      CREATE TRIGGER notify_course_access
      AFTER INSERT OR UPDATE OF access_status ON course_access
      FOR EACH ROW
      EXECUTE FUNCTION pwc_notify_course_access();

      CREATE OR REPLACE FUNCTION pwc_notify_lesson_completion()
      RETURNS TRIGGER AS $$
      DECLARE
        client_name TEXT;
        lesson_title TEXT;
      BEGIN
        IF NEW.completed_at IS NULL
          OR (TG_OP = 'UPDATE' AND OLD.completed_at IS NOT NULL) THEN
          RETURN NEW;
        END IF;

        SELECT COALESCE(NULLIF(trim(concat_ws(' ', first_name, last_name)), ''), 'A client')
        INTO client_name
        FROM client_profiles
        WHERE id = NEW.client_profile_id;

        SELECT title INTO lesson_title
        FROM course_lessons
        WHERE id = NEW.lesson_id;

        PERFORM pwc_notify_active_team(
          NULL,
          'learning',
          'Learning progress completed',
          client_name || ' completed “' || COALESCE(lesson_title, 'a lesson') || '”.',
          '/admin/courses',
          'Open Learning Library',
          'lesson_progress',
          NEW.id,
          'normal',
          'lesson-completed:' || NEW.id::text
        );

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS notify_lesson_completion ON lesson_progress;
      CREATE TRIGGER notify_lesson_completion
      AFTER INSERT OR UPDATE OF completed_at ON lesson_progress
      FOR EACH ROW
      EXECUTE FUNCTION pwc_notify_lesson_completion();
    `)

    await client.query(`
      CREATE OR REPLACE FUNCTION pwc_notify_membership_enrollment()
      RETURNS TRIGGER AS $$
      DECLARE
        membership_name TEXT;
      BEGIN
        IF TG_OP = 'UPDATE'
          AND OLD.status = NEW.status
          AND OLD.renewal_at IS NOT DISTINCT FROM NEW.renewal_at THEN
          RETURN NEW;
        END IF;

        SELECT name INTO membership_name
        FROM memberships
        WHERE id = NEW.membership_id;

        PERFORM pwc_notify_client_profile(
          NEW.client_profile_id,
          NEW.assigned_by,
          'memberships',
          CASE NEW.status
            WHEN 'active' THEN 'Your membership is active'
            WHEN 'paused' THEN 'Your membership was paused'
            WHEN 'cancelled' THEN 'Your membership was cancelled'
            WHEN 'expired' THEN 'Your membership has ended'
            ELSE 'Your membership was updated'
          END,
          'Review “' || COALESCE(membership_name, 'your membership') || '” in your private portal.',
          '/client-portal/membership',
          'View Membership',
          'membership_enrollments',
          NEW.id,
          CASE WHEN NEW.status IN ('cancelled', 'expired') THEN 'high' ELSE 'normal' END,
          'membership-enrollment:' || NEW.id::text || ':' || NEW.status || ':' || COALESCE(NEW.renewal_at::text, 'none')
        );

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS notify_membership_enrollment
        ON membership_enrollments;
      CREATE TRIGGER notify_membership_enrollment
      AFTER INSERT OR UPDATE OF status, renewal_at ON membership_enrollments
      FOR EACH ROW
      EXECUTE FUNCTION pwc_notify_membership_enrollment();
    `)

    await client.query(`
      CREATE OR REPLACE FUNCTION pwc_notify_encouragement_publish()
      RETURNS TRIGGER AS $$
      DECLARE
        recipient RECORD;
      BEGIN
        IF NEW.status <> 'published'
          OR (TG_OP = 'UPDATE' AND OLD.status = 'published') THEN
          RETURN NEW;
        END IF;

        FOR recipient IN
          SELECT er.client_profile_id
          FROM encouragement_recipients er
          WHERE er.encouragement_post_id = NEW.id
        LOOP
          PERFORM pwc_notify_client_profile(
            recipient.client_profile_id,
            NEW.created_by,
            'encouragements',
            COALESCE(NULLIF(NEW.title, ''), 'A new encouragement is waiting'),
            left(NEW.body, 240),
            '/client-portal/messages',
            'Read Encouragement',
            'encouragement_posts',
            NEW.id,
            'normal',
            'encouragement-published:' || NEW.id::text
          );
        END LOOP;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS notify_encouragement_publish
        ON encouragement_posts;
      CREATE TRIGGER notify_encouragement_publish
      AFTER INSERT OR UPDATE OF status ON encouragement_posts
      FOR EACH ROW
      EXECUTE FUNCTION pwc_notify_encouragement_publish();

      CREATE OR REPLACE FUNCTION pwc_notify_membership_announcement()
      RETURNS TRIGGER AS $$
      DECLARE
        recipient RECORD;
      BEGIN
        IF NEW.status <> 'published'
          OR (TG_OP = 'UPDATE' AND OLD.status = 'published') THEN
          RETURN NEW;
        END IF;

        FOR recipient IN
          SELECT client_profile_id
          FROM membership_enrollments
          WHERE membership_id = NEW.membership_id
            AND status = 'active'
        LOOP
          PERFORM pwc_notify_client_profile(
            recipient.client_profile_id,
            NEW.created_by,
            'memberships',
            NEW.title,
            left(NEW.body, 240),
            '/client-portal/membership',
            'View Membership',
            'membership_announcements',
            NEW.id,
            'normal',
            'membership-announcement:' || NEW.id::text
          );
        END LOOP;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS notify_membership_announcement
        ON membership_announcements;
      CREATE TRIGGER notify_membership_announcement
      AFTER INSERT OR UPDATE OF status ON membership_announcements
      FOR EACH ROW
      EXECUTE FUNCTION pwc_notify_membership_announcement();
    `)

    await client.query(`
      CREATE OR REPLACE FUNCTION pwc_notify_circle_report()
      RETURNS TRIGGER AS $$
      BEGIN
        PERFORM pwc_notify_active_team(
          NEW.reporter_user_id,
          'community',
          'The Circle needs review',
          'A member submitted a new community report.',
          '/admin/circle',
          'Review The Circle',
          'circle_reports',
          NEW.id,
          'high',
          'circle-report:' || NEW.id::text
        );

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS notify_circle_report ON circle_reports;
      CREATE TRIGGER notify_circle_report
      AFTER INSERT ON circle_reports
      FOR EACH ROW
      EXECUTE FUNCTION pwc_notify_circle_report();

      CREATE OR REPLACE FUNCTION pwc_notify_client_profile_created()
      RETURNS TRIGGER AS $$
      DECLARE
        client_name TEXT;
      BEGIN
        client_name := COALESCE(
          NULLIF(trim(concat_ws(' ', NEW.first_name, NEW.last_name)), ''),
          'A new client'
        );

        PERFORM pwc_notify_active_team(
          NULL,
          'system',
          'New client profile added',
          client_name || ' was added to the client workspace.',
          '/admin/clients/' || NEW.id::text,
          'Open Client Profile',
          'client_profiles',
          NEW.id,
          'normal',
          'client-profile-created:' || NEW.id::text
        );

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS notify_client_profile_created ON client_profiles;
      CREATE TRIGGER notify_client_profile_created
      AFTER INSERT ON client_profiles
      FOR EACH ROW
      EXECUTE FUNCTION pwc_notify_client_profile_created();
    `)

    await client.query(`
      DO $$
      BEGIN
        IF to_regclass('public.client_portal_resources') IS NOT NULL THEN
          EXECUTE $trigger$
            CREATE OR REPLACE FUNCTION pwc_notify_client_resource()
            RETURNS TRIGGER AS $fn$
            BEGIN
              IF NEW.status <> 'active' THEN
                RETURN NEW;
              END IF;

              IF TG_OP = 'UPDATE'
                AND OLD.status = NEW.status
                AND OLD.title IS NOT DISTINCT FROM NEW.title
                AND OLD.resource_url IS NOT DISTINCT FROM NEW.resource_url THEN
                RETURN NEW;
              END IF;

              PERFORM pwc_notify_client_profile(
                NEW.client_profile_id,
                NEW.created_by_user_id,
                'resources',
                'A new resource is ready',
                '“' || COALESCE(NEW.title, 'A private resource') || '” was added to your library.',
                '/client-portal/resources',
                'Open Resources',
                'client_portal_resources',
                NEW.id,
                'normal',
                'client-resource:' || NEW.id::text || ':' || NEW.updated_at::text
              );

              RETURN NEW;
            END;
            $fn$ LANGUAGE plpgsql;
          $trigger$;

          DROP TRIGGER IF EXISTS notify_client_resource
            ON client_portal_resources;
          CREATE TRIGGER notify_client_resource
          AFTER INSERT OR UPDATE OF status, title, resource_url
          ON client_portal_resources
          FOR EACH ROW
          EXECUTE FUNCTION pwc_notify_client_resource();
        END IF;
      END;
      $$;
    `)

    await client.query(`
      INSERT INTO notifications (
        recipient_user_id,
        category,
        title,
        body,
        action_url,
        action_label,
        importance,
        dedupe_key
      )
      SELECT
        id,
        'system',
        'Notification Center is ready',
        'Important messages, session updates, learning activity, memberships, and community alerts now appear in one place.',
        CASE
          WHEN role = 'client' THEN '/client-portal/home'
          ELSE '/admin/dashboard'
        END,
        'Open Workspace',
        'normal',
        'notification-center-ready:' || id::text
      FROM system_users
      WHERE status = 'active'
        AND role IN ('developer', 'owner', 'admin', 'client')
      ON CONFLICT (dedupe_key)
        WHERE dedupe_key IS NOT NULL
      DO NOTHING;
    `)

    await client.query('COMMIT')

    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM notifications) AS notifications,
        (SELECT COUNT(*)::int FROM notification_preferences) AS preferences,
        EXISTS (
          SELECT 1
          FROM pg_trigger
          WHERE tgname = 'notify_conversation_message'
            AND NOT tgisinternal
        ) AS inbox_trigger_ready,
        EXISTS (
          SELECT 1
          FROM pg_trigger
          WHERE tgname = 'notify_booking_change_request'
            AND NOT tgisinternal
        ) AS session_trigger_ready,
        EXISTS (
          SELECT 1
          FROM pg_trigger
          WHERE tgname = 'notify_circle_report'
            AND NOT tgisinternal
        ) AS community_trigger_ready
    `)

    console.log('\nUnified Notification Center database support is ready.')
    console.table(result.rows)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
