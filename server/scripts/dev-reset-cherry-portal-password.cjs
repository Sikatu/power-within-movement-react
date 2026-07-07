const bcrypt = require('bcryptjs')
const { pool } = require('../src/db/pool')

async function main() {
  const email = 'cherrygrande@gmail.com'
  const password = 'TempPassword123!'

  const passwordHash = await bcrypt.hash(password, 12)

  const result = await pool.query(
    `
    UPDATE system_users
    SET
      password_hash = $1,
      status = 'active',
      updated_at = now()
    WHERE lower(email) = lower($2)
      AND role = 'client'
    RETURNING id, email, role, status, updated_at
    `,
    [passwordHash, email],
  )

  if (result.rowCount === 0) {
    throw new Error('No matching active client portal user found for Cherry.')
  }

  console.table(result.rows)
  console.log('')
  console.log('Cherry portal password reset complete.')
  console.log('Email: cherrygrande@gmail.com')
  console.log('Password: TempPassword123!')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
