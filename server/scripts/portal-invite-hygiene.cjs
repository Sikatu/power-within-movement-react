const { pool } = require('../src/db/pool')

async function main() {
  console.log('Starting portal invite hygiene...')

  const activeCleanup = await pool.query(`
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

  console.log(`Revoked pending invites for already-active portal clients: ${activeCleanup.rowCount}`)

  const expiredCleanup = await pool.query(`
    UPDATE client_portal_invites
    SET
      status = 'expired',
      updated_at = now()
    WHERE status = 'pending'
      AND expires_at IS NOT NULL
      AND expires_at < now()
    RETURNING id, client_profile_id, invite_token_preview
  `)

  console.log(`Marked expired pending invites: ${expiredCleanup.rowCount}`)

  const duplicatePendingCleanup = await pool.query(`
    WITH ranked_pending AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY client_profile_id
          ORDER BY created_at DESC
        ) AS pending_rank
      FROM client_portal_invites
      WHERE status = 'pending'
    )
    UPDATE client_portal_invites invite
    SET
      status = 'revoked',
      revoked_at = COALESCE(invite.revoked_at, now()),
      updated_at = now()
    FROM ranked_pending ranked
    WHERE invite.id = ranked.id
      AND ranked.pending_rank > 1
    RETURNING invite.id, invite.client_profile_id, invite.invite_token_preview
  `)

  console.log(`Revoked duplicate pending invites: ${duplicatePendingCleanup.rowCount}`)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS client_portal_invites_one_pending_per_client_idx
    ON client_portal_invites (client_profile_id)
    WHERE status = 'pending'
  `)

  console.log('Verified database safety rule: one pending invite per client.')

  const summary = await pool.query(`
    SELECT
      status,
      COUNT(*)::int AS count
    FROM client_portal_invites
    GROUP BY status
    ORDER BY status
  `)

  console.table(summary.rows)
  console.log('Portal invite hygiene complete.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
