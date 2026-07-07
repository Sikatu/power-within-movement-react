const { pool } = require('../src/db/pool')

async function main() {
  const result = await pool.query(`
    UPDATE client_portal_invites pending
    SET
      status = 'revoked',
      revoked_at = COALESCE(revoked_at, now()),
      updated_at = now()
    WHERE pending.status = 'pending'
      AND EXISTS (
        SELECT 1
        FROM client_portal_invites accepted
        WHERE accepted.client_profile_id = pending.client_profile_id
          AND accepted.status = 'accepted'
      )
    RETURNING pending.id, pending.client_profile_id, pending.invite_token_preview
  `)

  console.log(`Revoked duplicate pending invites: ${result.rowCount}`)

  if (result.rows.length > 0) {
    console.table(result.rows)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
