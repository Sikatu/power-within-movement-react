async function publishDueEncouragements(db) {
  if (!db) return 0

  const result = await db.query(
    `
    UPDATE encouragement_posts
    SET
      status = 'published',
      published_at = COALESCE(published_at, scheduled_at, now()),
      updated_at = now()
    WHERE status = 'scheduled'
      AND scheduled_at IS NOT NULL
      AND scheduled_at <= now()
    RETURNING id
    `,
  )

  return result.rowCount || 0
}

module.exports = {
  publishDueEncouragements,
}
