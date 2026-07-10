const { pool } = require('../src/db/pool')

async function main() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS founder_availability_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id uuid UNIQUE REFERENCES system_users(id) ON DELETE SET NULL,
      timezone text NOT NULL DEFAULT 'America/New_York',
      schedule_enabled boolean NOT NULL DEFAULT false,
      slot_interval_minutes integer NOT NULL DEFAULT 60,
      minimum_notice_minutes integer NOT NULL DEFAULT 0,
      booking_window_days integer NOT NULL DEFAULT 90,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      CONSTRAINT founder_availability_slot_interval_check
        CHECK (slot_interval_minutes IN (15, 30, 60)),
      CONSTRAINT founder_availability_minimum_notice_check
        CHECK (minimum_notice_minutes BETWEEN 0 AND 10080),
      CONSTRAINT founder_availability_booking_window_check
        CHECK (booking_window_days BETWEEN 7 AND 365)
    )
  `)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_founder_availability_settings_owner
    ON founder_availability_settings(owner_user_id)
    WHERE owner_user_id IS NOT NULL
  `)

  await pool.query(`
    INSERT INTO founder_availability_settings (owner_user_id)
    SELECT id
    FROM system_users
    WHERE role = 'owner'
      AND status = 'active'
    ORDER BY created_at ASC
    LIMIT 1
    ON CONFLICT (owner_user_id) DO NOTHING
  `)

  const result = await pool.query(`
    SELECT
      fas.id,
      su.email,
      fas.timezone,
      fas.schedule_enabled,
      fas.slot_interval_minutes,
      fas.minimum_notice_minutes,
      fas.booking_window_days
    FROM founder_availability_settings fas
    LEFT JOIN system_users su ON su.id = fas.owner_user_id
    ORDER BY fas.created_at ASC
  `)

  console.log('\nFounder availability settings are ready.')
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
