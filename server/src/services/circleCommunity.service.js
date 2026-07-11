const { pool } = require('../db/pool')

function displayNameSql(userAlias = 'su', profileAlias = 'cp') {
  return `COALESCE(NULLIF(TRIM(CONCAT(${profileAlias}.first_name, ' ', ${profileAlias}.last_name)), ''), ${userAlias}.email, 'Power Within')`
}

async function getActiveCircleMemberships(clientProfileId, db = pool) {
  const result = await db.query(
    `
    SELECT
      m.id,
      m.name,
      m.slug,
      m.tagline
    FROM membership_enrollments me
    JOIN memberships m ON m.id = me.membership_id
    WHERE me.client_profile_id = $1
      AND me.status = 'active'
      AND m.status = 'active'
      AND (me.started_at IS NULL OR me.started_at <= now())
      AND (me.ends_at IS NULL OR me.ends_at > now())
    ORDER BY m.name
    `,
    [clientProfileId],
  )

  return result.rows
}

async function clientCanAccessCirclePost(postId, clientProfileId, db = pool) {
  const result = await db.query(
    `
    SELECT cp.id
    FROM circle_posts cp
    WHERE cp.id = $1
      AND cp.status = 'published'
      AND cp.published_at <= now()
      AND EXISTS (
        SELECT 1
        FROM membership_enrollments me
        JOIN memberships m ON m.id = me.membership_id
        WHERE me.client_profile_id = $2
          AND me.status = 'active'
          AND m.status = 'active'
          AND (me.started_at IS NULL OR me.started_at <= now())
          AND (me.ends_at IS NULL OR me.ends_at > now())
          AND (cp.membership_id IS NULL OR cp.membership_id = me.membership_id)
      )
    LIMIT 1
    `,
    [postId, clientProfileId],
  )

  return Boolean(result.rows[0])
}

async function listAdminCirclePosts(db = pool) {
  const result = await db.query(`
    SELECT
      cp.*,
      m.name AS membership_name,
      su.email AS author_email,
      ${displayNameSql('su', 'author_profile')} AS author_name,
      COALESCE(comment_stats.comment_count, 0)::int AS comment_count,
      COALESCE(reaction_stats.reaction_count, 0)::int AS reaction_count,
      COALESCE(report_stats.open_report_count, 0)::int AS open_report_count
    FROM circle_posts cp
    LEFT JOIN memberships m ON m.id = cp.membership_id
    LEFT JOIN system_users su ON su.id = cp.author_user_id
    LEFT JOIN client_profiles author_profile ON author_profile.user_id = su.id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS comment_count
      FROM circle_comments cc
      WHERE cc.post_id = cp.id AND cc.status = 'active'
    ) comment_stats ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS reaction_count
      FROM circle_reactions cr
      WHERE cr.post_id = cp.id
    ) reaction_stats ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS open_report_count
      FROM circle_reports report
      WHERE report.post_id = cp.id AND report.status = 'open'
    ) report_stats ON true
    ORDER BY
      CASE cp.status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
      cp.is_pinned DESC,
      COALESCE(cp.published_at, cp.updated_at, cp.created_at) DESC
    LIMIT 250
  `)

  return result.rows
}

async function getAdminCirclePost(postId, db = pool) {
  const postResult = await db.query(
    `
    SELECT
      cp.*,
      m.name AS membership_name,
      su.email AS author_email,
      ${displayNameSql('su', 'author_profile')} AS author_name
    FROM circle_posts cp
    LEFT JOIN memberships m ON m.id = cp.membership_id
    LEFT JOIN system_users su ON su.id = cp.author_user_id
    LEFT JOIN client_profiles author_profile ON author_profile.user_id = su.id
    WHERE cp.id = $1
    LIMIT 1
    `,
    [postId],
  )

  const post = postResult.rows[0]
  if (!post) return null

  const [commentsResult, reactionsResult, reportsResult] = await Promise.all([
    db.query(
      `
      SELECT
        cc.*,
        su.email AS author_email,
        ${displayNameSql('su', 'comment_profile')} AS author_name,
        moderator.email AS hidden_by_email
      FROM circle_comments cc
      LEFT JOIN system_users su ON su.id = cc.author_user_id
      LEFT JOIN client_profiles comment_profile ON comment_profile.user_id = su.id
      LEFT JOIN system_users moderator ON moderator.id = cc.hidden_by_user_id
      WHERE cc.post_id = $1
      ORDER BY cc.created_at ASC
      `,
      [postId],
    ),
    db.query(
      `
      SELECT reaction_type, COUNT(*)::int AS count
      FROM circle_reactions
      WHERE post_id = $1
      GROUP BY reaction_type
      ORDER BY reaction_type
      `,
      [postId],
    ),
    db.query(
      `
      SELECT
        report.*,
        reporter.email AS reporter_email,
        ${displayNameSql('reporter', 'reporter_profile')} AS reporter_name,
        reviewer.email AS reviewer_email
      FROM circle_reports report
      LEFT JOIN system_users reporter ON reporter.id = report.reporter_user_id
      LEFT JOIN client_profiles reporter_profile ON reporter_profile.user_id = reporter.id
      LEFT JOIN system_users reviewer ON reviewer.id = report.reviewed_by_user_id
      WHERE report.post_id = $1
         OR report.comment_id IN (
           SELECT id FROM circle_comments WHERE post_id = $1
         )
      ORDER BY
        CASE report.status WHEN 'open' THEN 0 ELSE 1 END,
        report.created_at DESC
      `,
      [postId],
    ),
  ])

  return {
    ...post,
    comments: commentsResult.rows,
    reactions: reactionsResult.rows,
    reports: reportsResult.rows,
  }
}

async function listClientCircleFeed(clientProfileId, clientUserId, db = pool) {
  const memberships = await getActiveCircleMemberships(clientProfileId, db)
  if (memberships.length === 0) {
    return { memberships: [], posts: [] }
  }

  const postsResult = await db.query(
    `
    SELECT
      cp.*,
      m.name AS membership_name,
      CASE
        WHEN su.role = 'owner' THEN 'Kim · Founder'
        WHEN su.role IN ('developer', 'admin', 'staff') THEN 'Power Within Team'
        ELSE COALESCE(NULLIF(TRIM(CONCAT(author_profile.first_name, ' ', author_profile.last_name)), ''), 'Member')
      END AS author_name,
      COALESCE(comment_stats.comment_count, 0)::int AS comment_count,
      COALESCE(reaction_stats.reaction_count, 0)::int AS reaction_count,
      own_reaction.reaction_type AS my_reaction
    FROM circle_posts cp
    LEFT JOIN memberships m ON m.id = cp.membership_id
    LEFT JOIN system_users su ON su.id = cp.author_user_id
    LEFT JOIN client_profiles author_profile ON author_profile.user_id = su.id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS comment_count
      FROM circle_comments cc
      WHERE cc.post_id = cp.id AND cc.status = 'active'
    ) comment_stats ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS reaction_count
      FROM circle_reactions cr
      WHERE cr.post_id = cp.id
    ) reaction_stats ON true
    LEFT JOIN LATERAL (
      SELECT reaction_type
      FROM circle_reactions cr
      WHERE cr.post_id = cp.id AND cr.user_id = $2
      LIMIT 1
    ) own_reaction ON true
    WHERE cp.status = 'published'
      AND cp.published_at <= now()
      AND (
        cp.membership_id IS NULL
        OR cp.membership_id = ANY($1::uuid[])
      )
    ORDER BY
      cp.is_pinned DESC,
      cp.published_at DESC,
      cp.created_at DESC
    LIMIT 100
    `,
    [memberships.map((membership) => membership.id), clientUserId],
  )

  const postIds = postsResult.rows.map((post) => post.id)
  if (postIds.length === 0) return { memberships, posts: [] }

  const [commentsResult, reactionsResult] = await Promise.all([
    db.query(
      `
      SELECT
        cc.id,
        cc.post_id,
        cc.author_user_id,
        cc.body,
        cc.created_at,
        cc.updated_at,
        COALESCE(NULLIF(TRIM(CONCAT(comment_profile.first_name, ' ', comment_profile.last_name)), ''), 'Member') AS author_name,
        CASE WHEN cc.author_user_id = $2 THEN true ELSE false END AS is_mine
      FROM circle_comments cc
      LEFT JOIN system_users su ON su.id = cc.author_user_id
      LEFT JOIN client_profiles comment_profile ON comment_profile.user_id = su.id
      WHERE cc.post_id = ANY($1::uuid[])
        AND cc.status = 'active'
      ORDER BY cc.created_at ASC
      `,
      [postIds, clientUserId],
    ),
    db.query(
      `
      SELECT post_id, reaction_type, COUNT(*)::int AS count
      FROM circle_reactions
      WHERE post_id = ANY($1::uuid[])
      GROUP BY post_id, reaction_type
      ORDER BY post_id, reaction_type
      `,
      [postIds],
    ),
  ])

  const commentsByPost = new Map()
  for (const comment of commentsResult.rows) {
    if (!commentsByPost.has(comment.post_id)) commentsByPost.set(comment.post_id, [])
    commentsByPost.get(comment.post_id).push(comment)
  }

  const reactionsByPost = new Map()
  for (const reaction of reactionsResult.rows) {
    if (!reactionsByPost.has(reaction.post_id)) reactionsByPost.set(reaction.post_id, [])
    reactionsByPost.get(reaction.post_id).push(reaction)
  }

  return {
    memberships,
    posts: postsResult.rows.map((post) => ({
      ...post,
      comments: commentsByPost.get(post.id) || [],
      reactions: reactionsByPost.get(post.id) || [],
    })),
  }
}

module.exports = {
  clientCanAccessCirclePost,
  getActiveCircleMemberships,
  getAdminCirclePost,
  listAdminCirclePosts,
  listClientCircleFeed,
}
