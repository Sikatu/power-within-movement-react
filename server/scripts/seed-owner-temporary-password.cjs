require('dotenv').config()

const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')

const databaseUrl = process.env.DATABASE_URL
const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase()
const suppliedPassword = process.env.SEED_OWNER_PASSWORD
const expirationHours = Number(process.env.SEED_OWNER_TEMP_HOURS || 48)

function generateTemporaryPassword() {
  return `Pw!${crypto.randomBytes(12).toString('base64url')}`
}

function validatePassword(password) {
  return (
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

async function main() {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing in server/.env')
  }

  if (!ownerEmail) {
    throw new Error('SEED_OWNER_EMAIL is required.')
  }

  if (!Number.isFinite(expirationHours) || expirationHours < 1 || expirationHours > 168) {
    throw new Error('SEED_OWNER_TEMP_HOURS must be between 1 and 168.')
  }

  const temporaryPassword = suppliedPassword || generateTemporaryPassword()

  if (!validatePassword(temporaryPassword)) {
    throw new Error(
      'SEED_OWNER_PASSWORD must be at least 12 characters and include uppercase, lowercase, number, and symbol.',
    )
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query(`
      ALTER TABLE system_users
      ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ
    `)

    const passwordHash = await bcrypt.hash(temporaryPassword, 12)

    const result = await client.query(
      `
      INSERT INTO system_users (
        email,
        password_hash,
        role,
        status,
        must_change_password,
        temporary_password_expires_at,
        password_changed_at
      )
      VALUES (
        $1,
        $2,
        'owner',
        'active',
        true,
        now() + ($3::text || ' hours')::interval,
        NULL
      )
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role = 'owner',
        status = 'active',
        must_change_password = true,
        temporary_password_expires_at = EXCLUDED.temporary_password_expires_at,
        password_changed_at = NULL,
        updated_at = now()
      RETURNING
        id,
        email,
        role,
        status,
        must_change_password,
        temporary_password_expires_at
      `,
      [ownerEmail, passwordHash, expirationHours],
    )

    const user = result.rows[0]

    try {
      await client.query(
        `
        INSERT INTO audit_logs (
          actor_user_id,
          action,
          entity_type,
          entity_id,
          after_data
        )
        VALUES ($1, 'owner_temporary_password_issued', 'system_users', $1, $2::jsonb)
        `,
        [
          user.id,
          JSON.stringify({
            email: user.email,
            role: user.role,
            expiresAt: user.temporary_password_expires_at,
          }),
        ],
      )
    } catch {
      // Account creation should not fail only because audit_logs is unavailable.
    }

    await client.query('COMMIT')

    console.log('\nOwner temporary login is ready.')
    console.table([
      {
        email: user.email,
        role: user.role,
        expiresAt: user.temporary_password_expires_at,
      },
    ])
    console.log('\nTEMPORARY PASSWORD — copy it now and send it securely:')
    console.log(temporaryPassword)
    console.log('\nThis password is not stored in readable form and will not be shown again.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('\nOwner temporary-login setup failed.')
  console.error(error.message)
  process.exitCode = 1
})
