require('dotenv').config()

const { Pool } = require('pg')

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing from server/.env')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query(`
      ALTER TABLE encouragement_posts
        ADD COLUMN IF NOT EXISTS message_type TEXT;

      UPDATE encouragement_posts
      SET message_type = 'encouragement'
      WHERE message_type IS NULL
        OR message_type NOT IN ('encouragement', 'announcement');

      ALTER TABLE encouragement_posts
        ALTER COLUMN message_type SET DEFAULT 'encouragement',
        ALTER COLUMN message_type SET NOT NULL;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'encouragement_posts_message_type_check'
            AND conrelid = 'encouragement_posts'::regclass
        ) THEN
          ALTER TABLE encouragement_posts
            ADD CONSTRAINT encouragement_posts_message_type_check
            CHECK (message_type IN ('encouragement', 'announcement'));
        END IF;
      END;
      $$;

      CREATE INDEX IF NOT EXISTS idx_encouragement_posts_type_status
        ON encouragement_posts(message_type, status, published_at DESC);
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
          SELECT cp.id AS client_profile_id
          FROM client_profiles cp
          JOIN system_users su ON su.id = cp.user_id
          WHERE NEW.visibility = 'all_members'
            AND su.role = 'client'
            AND su.status = 'active'
          UNION
          SELECT er.client_profile_id
          FROM encouragement_recipients er
          WHERE NEW.visibility = 'single_client'
            AND er.encouragement_post_id = NEW.id
        LOOP
          PERFORM pwc_notify_client_profile(
            recipient.client_profile_id,
            NEW.created_by,
            'encouragements',
            COALESCE(
              NULLIF(NEW.title, ''),
              CASE NEW.message_type
                WHEN 'announcement' THEN 'A new portal announcement is ready'
                ELSE 'A new encouragement is waiting'
              END
            ),
            left(NEW.body, 240),
            '/client-portal/messages?tab=updates',
            CASE NEW.message_type
              WHEN 'announcement' THEN 'Read Announcement'
              ELSE 'Read Encouragement'
            END,
            'encouragement_posts',
            NEW.id,
            CASE NEW.message_type
              WHEN 'announcement' THEN 'high'
              ELSE 'normal'
            END,
            'client-message-published:' || NEW.id::text
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
    `)

    await client.query('COMMIT')
    console.log('Phase 45 client messages database support is ready.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Client messages migration failed:', error.message)
  process.exitCode = 1
})
