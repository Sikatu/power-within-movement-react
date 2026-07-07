require('dotenv').config()

const bcrypt = require('bcryptjs')
const { Pool } = require('pg')

const databaseUrl = process.env.DATABASE_URL

const owner = {
  email: process.env.SEED_OWNER_EMAIL,
  password: process.env.SEED_OWNER_PASSWORD,
  firstName: process.env.SEED_OWNER_FIRST_NAME || 'Owner',
  lastName: process.env.SEED_OWNER_LAST_NAME || '',
}

function validateOwner() {
  const missing = []

  if (!databaseUrl) missing.push('DATABASE_URL')
  if (!owner.email) missing.push('SEED_OWNER_EMAIL')
  if (!owner.password) missing.push('SEED_OWNER_PASSWORD')

  if (owner.password && owner.password.length < 10) {
    throw new Error('SEED_OWNER_PASSWORD must be at least 10 characters for development safety.')
  }

  if (missing.length > 0) {
    throw new Error(`Missing required env value(s): ${missing.join(', ')}`)
  }
}

async function main() {
  validateOwner()

  const pool = new Pool({
    connectionString: databaseUrl,
  })

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const existing = await client.query(
      'SELECT id, email, role FROM system_users WHERE email = $1',
      [owner.email],
    )

    if (existing.rows.length > 0) {
      const user = existing.rows[0]

      await client.query(
        `
        UPDATE system_users
        SET role = 'owner',
            status = 'active',
            updated_at = now()
        WHERE id = $1
        `,
        [user.id],
      )

      await client.query('COMMIT')

      console.log('Owner user already existed. Role/status confirmed.')
      console.table([{ id: user.id, email: user.email, role: 'owner' }])
      return
    }

    const passwordHash = await bcrypt.hash(owner.password, 12)

    const insertedUser = await client.query(
      `
      INSERT INTO system_users (email, password_hash, role, status)
      VALUES ($1, $2, 'owner', 'active')
      RETURNING id, email, role, status
      `,
      [owner.email, passwordHash],
    )

    const user = insertedUser.rows[0]

    await client.query(
      `
      INSERT INTO client_profiles (
        user_id,
        first_name,
        last_name,
        client_status,
        private_admin_notes
      )
      VALUES ($1, $2, $3, 'active_client', 'Initial owner/admin account.')
      ON CONFLICT (user_id) DO NOTHING
      `,
      [user.id, owner.firstName, owner.lastName],
    )

    await client.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_data
      )
      VALUES ($1, 'seed_owner_created', 'system_users', $1, $2::jsonb)
      `,
      [
        user.id,
        JSON.stringify({
          email: user.email,
          role: user.role,
          status: user.status,
        }),
      ],
    )

    await client.query('COMMIT')

    console.log('Owner user created successfully.')
    console.table([user])
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Owner seed failed.')
    console.error(error.message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})