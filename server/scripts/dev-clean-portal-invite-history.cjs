const { pool } = require('../src/db/pool')

async function main() {
  console.log('Cleaning duplicate portal invite history for development...')

  const before = await pool.query(`
    SELECT status, COUNT(*)::int AS count
    FROM client_portal_invites
    GROUP BY status
    ORDER BY status
  `)

  console.log('Before cleanup:')
  console.table(before.rows)

  const deletedOldActiveClientInvites = await pool.query(`
    WITH latest_accepted AS (
      SELECT DISTINCT ON (client_profile_id)
        id,
        client_profile_id
      FROM client_portal_invites
      WHERE status = 'accepted'
      ORDER BY client_profile_id, accepted_at DESC NULLS LAST, created_at DESC
    ),
    active_clients AS (
      SELECT client_profile_id
      FROM latest_accepted
    )
    DELETE FROM client_portal_invites invite
    USING active_clients active
    WHERE invite.client_profile_id = active.client_profile_id
      AND invite.id NOT IN (
        SELECT id
        FROM latest_accepted
      )
    RETURNING invite.id, invite.client_profile_id, invite.status, invite.invite_token_preview
  `)

  console.log(
    `Deleted old invite rows for clients with active portal access: ${deletedOldActiveClientInvites.rowCount}`,
  )

  const deletedDuplicateAccepted = await pool.query(`
    WITH ranked_accepted AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY client_profile_id
          ORDER BY accepted_at DESC NULLS LAST, created_at DESC
        ) AS accepted_rank
      FROM client_portal_invites
      WHERE status = 'accepted'
    )
    DELETE FROM client_portal_invites invite
    USING ranked_accepted ranked
    WHERE invite.id = ranked.id
      AND ranked.accepted_rank > 1
    RETURNING invite.id, invite.client_profile_id, invite.status, invite.invite_token_preview
  `)

  console.log(
    `Deleted duplicate accepted invite rows: ${deletedDuplicateAccepted.rowCount}`,
  )

  const after = await pool.query(`
    SELECT status, COUNT(*)::int AS count
    FROM client_portal_invites
    GROUP BY status
    ORDER BY status
  `)

  console.log('After cleanup:')
  console.table(after.rows)

  console.log('Portal invite history cleanup complete.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
