const { pool } = require('../src/db/pool')

async function main() {
  console.log('\n=== client_profiles columns ===')
  const clientColumns = await pool.query(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_profiles' ORDER BY ordinal_position"
  )
  console.table(clientColumns.rows)

  console.log('\n=== required client_profiles columns with no default ===')
  const requiredClientColumns = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_profiles' AND is_nullable = 'NO' AND column_default IS NULL ORDER BY ordinal_position"
  )
  console.table(requiredClientColumns.rows)

  console.log('\n=== bookings columns ===')
  const bookingColumns = await pool.query(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' ORDER BY ordinal_position"
  )
  console.table(bookingColumns.rows)

  console.log('\n=== test booking row ===')
  const booking = await pool.query(
    "SELECT * FROM bookings WHERE id = $1 LIMIT 1",
    ['c724ef7c-3bc4-4ba0-8b04-c89df3859daa']
  )
  console.dir(booking.rows[0] || null, { depth: null })
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
