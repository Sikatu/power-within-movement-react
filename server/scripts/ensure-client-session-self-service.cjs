require('dotenv').config()
const { Pool } = require('pg')

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing from server/.env')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_change_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
        request_type TEXT NOT NULL CHECK (request_type IN ('reschedule', 'cancel')),
        requested_starts_at TIMESTAMPTZ,
        requested_ends_at TIMESTAMPTZ,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'declined', 'withdrawn')),
        reviewer_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
        reviewer_notes TEXT,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (
          (request_type = 'cancel' AND requested_starts_at IS NULL AND requested_ends_at IS NULL)
          OR
          (request_type = 'reschedule' AND requested_starts_at IS NOT NULL AND requested_ends_at IS NOT NULL)
        )
      );

      DROP TRIGGER IF EXISTS set_booking_change_requests_updated_at
        ON booking_change_requests;
      CREATE TRIGGER set_booking_change_requests_updated_at
      BEFORE UPDATE ON booking_change_requests
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();

      CREATE INDEX IF NOT EXISTS idx_booking_change_requests_booking
        ON booking_change_requests(booking_id);
      CREATE INDEX IF NOT EXISTS idx_booking_change_requests_client
        ON booking_change_requests(client_profile_id);
      CREATE INDEX IF NOT EXISTS idx_booking_change_requests_status
        ON booking_change_requests(status, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_change_requests_one_pending
        ON booking_change_requests(booking_id)
        WHERE status = 'pending';
    `)

    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'booking_change_requests'
      ORDER BY ordinal_position
    `)

    console.log('Client session self-service database support is ready.')
    console.table(result.rows)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Client session migration failed:', error.message)
  process.exitCode = 1
})
