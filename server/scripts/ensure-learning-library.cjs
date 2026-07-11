const { pool } = require('../src/db/pool')

async function main() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      slug text UNIQUE NOT NULL,
      description text,
      status text NOT NULL DEFAULT 'draft',
      cover_file_id uuid,
      created_by uuid REFERENCES system_users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_modules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text,
      position integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'draft',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_lessons (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      module_id uuid NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
      title text NOT NULL,
      lesson_type text NOT NULL DEFAULT 'text',
      content_html text,
      video_url text,
      download_file_id uuid,
      position integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'draft',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_access (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      client_profile_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
      access_status text NOT NULL DEFAULT 'active',
      granted_by uuid REFERENCES system_users(id) ON DELETE SET NULL,
      granted_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz,
      UNIQUE (course_id, client_profile_id)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lesson_progress (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lesson_id uuid NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
      client_profile_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
      completed_at timestamptz,
      last_viewed_at timestamptz,
      notes text,
      UNIQUE (lesson_id, client_profile_id)
    )
  `)

  await pool.query(`
    ALTER TABLE courses
      ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Personal Growth',
      ADD COLUMN IF NOT EXISTS cover_image_url text,
      ADD COLUMN IF NOT EXISTS estimated_minutes integer NOT NULL DEFAULT 30,
      ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'assigned_clients'
  `)

  await pool.query(`
    ALTER TABLE course_lessons
      ADD COLUMN IF NOT EXISTS external_url text,
      ADD COLUMN IF NOT EXISTS estimated_minutes integer NOT NULL DEFAULT 5,
      ADD COLUMN IF NOT EXISTS is_preview boolean NOT NULL DEFAULT false
  `)

  await pool.query(`
    ALTER TABLE lesson_progress
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_courses_status
      ON courses(status)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_course_modules_course_position
      ON course_modules(course_id, position)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_course_lessons_module_position
      ON course_lessons(module_id, position)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_course_access_client_status
      ON course_access(client_profile_id, access_status)
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_lesson_progress_client
      ON lesson_progress(client_profile_id)
  `)

  const settingsResult = await pool.query(`
    SELECT value
    FROM platform_settings
    WHERE key = 'developer_operations'
    LIMIT 1
  `)

  if (settingsResult.rows[0]) {
    await pool.query(`
      UPDATE platform_settings
      SET
        value = jsonb_set(
          COALESCE(value, '{}'::jsonb),
          '{featureFlags,courses}',
          'true'::jsonb,
          true
        ),
        updated_at = now()
      WHERE key = 'developer_operations'
    `)
  }

  const columns = await pool.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'courses',
        'course_modules',
        'course_lessons',
        'course_access',
        'lesson_progress'
      )
    ORDER BY table_name, ordinal_position
  `)

  console.log('\nLearning Library database support is ready.')
  console.table(columns.rows)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
