const { pool } = require('../db/pool')

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `membership-${Date.now()}`
}

async function createUniqueMembershipSlug(name, excludeMembershipId = null, db = pool) {
  const base = slugify(name)
  let candidate = base
  let suffix = 2

  while (true) {
    const result = await db.query(
      `
      SELECT id
      FROM memberships
      WHERE slug = $1
        AND ($2::uuid IS NULL OR id <> $2::uuid)
      LIMIT 1
      `,
      [candidate, excludeMembershipId],
    )

    if (!result.rows[0]) return candidate

    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

async function listAdminMemberships(db = pool) {
  const result = await db.query(`
    SELECT
      m.*,
      COALESCE(member_counts.active_count, 0)::int AS active_member_count,
      COALESCE(member_counts.paused_count, 0)::int AS paused_member_count,
      COALESCE(member_counts.total_count, 0)::int AS total_member_count,
      COALESCE(content_counts.course_count, 0)::int AS course_count,
      COALESCE(content_counts.resource_count, 0)::int AS resource_count,
      COALESCE(content_counts.announcement_count, 0)::int AS announcement_count
    FROM memberships m
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE me.status = 'active') AS active_count,
        COUNT(*) FILTER (WHERE me.status = 'paused') AS paused_count,
        COUNT(*) AS total_count
      FROM membership_enrollments me
      WHERE me.membership_id = m.id
    ) member_counts ON true
    LEFT JOIN LATERAL (
      SELECT
        (SELECT COUNT(*) FROM membership_course_links mcl WHERE mcl.membership_id = m.id) AS course_count,
        (SELECT COUNT(*) FROM membership_resources mr WHERE mr.membership_id = m.id AND mr.status = 'active') AS resource_count,
        (SELECT COUNT(*) FROM membership_announcements ma WHERE ma.membership_id = m.id AND ma.status = 'published') AS announcement_count
    ) content_counts ON true
    ORDER BY
      CASE m.status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
      m.updated_at DESC,
      m.created_at DESC
  `)

  return result.rows
}

async function getMembershipDetail(membershipId, db = pool) {
  const membershipResult = await db.query(
    `
    SELECT *
    FROM memberships
    WHERE id = $1
    LIMIT 1
    `,
    [membershipId],
  )

  const membership = membershipResult.rows[0]
  if (!membership) return null

  const [enrollmentsResult, courseLinksResult, resourcesResult, announcementsResult] =
    await Promise.all([
      db.query(
        `
        SELECT
          me.*,
          cp.first_name,
          cp.last_name,
          cp.client_status,
          su.email,
          su.status AS account_status
        FROM membership_enrollments me
        JOIN client_profiles cp ON cp.id = me.client_profile_id
        LEFT JOIN system_users su ON su.id = cp.user_id
        WHERE me.membership_id = $1
        ORDER BY
          CASE me.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
          cp.first_name,
          cp.last_name,
          su.email
        `,
        [membershipId],
      ),
      db.query(
        `
        SELECT
          mcl.membership_id,
          mcl.course_id,
          mcl.created_at,
          c.title,
          c.category,
          c.status,
          c.estimated_minutes
        FROM membership_course_links mcl
        JOIN courses c ON c.id = mcl.course_id
        WHERE mcl.membership_id = $1
        ORDER BY c.title
        `,
        [membershipId],
      ),
      db.query(
        `
        SELECT *
        FROM membership_resources
        WHERE membership_id = $1
        ORDER BY position ASC, created_at ASC
        `,
        [membershipId],
      ),
      db.query(
        `
        SELECT *
        FROM membership_announcements
        WHERE membership_id = $1
        ORDER BY
          CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
          COALESCE(published_at, created_at) DESC
        `,
        [membershipId],
      ),
    ])

  return {
    ...membership,
    enrollments: enrollmentsResult.rows,
    courses: courseLinksResult.rows,
    resources: resourcesResult.rows,
    announcements: announcementsResult.rows,
  }
}

async function listClientMemberships(clientProfileId, db = pool) {
  const membershipsResult = await db.query(
    `
    SELECT
      m.*,
      me.id AS enrollment_id,
      me.status AS enrollment_status,
      me.started_at,
      me.renewal_at,
      me.ends_at,
      me.updated_at AS enrollment_updated_at
    FROM membership_enrollments me
    JOIN memberships m ON m.id = me.membership_id
    WHERE me.client_profile_id = $1
      AND me.status = 'active'
      AND m.status = 'active'
      AND (me.started_at IS NULL OR me.started_at <= now())
      AND (me.ends_at IS NULL OR me.ends_at > now())
    ORDER BY me.started_at DESC, m.name
    `,
    [clientProfileId],
  )

  return Promise.all(
    membershipsResult.rows.map(async (membership) => {
      const [coursesResult, resourcesResult, announcementsResult] = await Promise.all([
        db.query(
          `
          SELECT
            c.id,
            c.title,
            c.description,
            c.category,
            c.cover_image_url,
            c.estimated_minutes
          FROM membership_course_links mcl
          JOIN courses c ON c.id = mcl.course_id
          WHERE mcl.membership_id = $1
            AND c.status = 'published'
          ORDER BY c.title
          `,
          [membership.id],
        ),
        db.query(
          `
          SELECT
            id,
            title,
            resource_type,
            description,
            resource_url,
            position
          FROM membership_resources
          WHERE membership_id = $1
            AND status = 'active'
          ORDER BY position ASC, created_at ASC
          `,
          [membership.id],
        ),
        db.query(
          `
          SELECT
            id,
            title,
            body,
            published_at
          FROM membership_announcements
          WHERE membership_id = $1
            AND status = 'published'
          ORDER BY published_at DESC, created_at DESC
          LIMIT 20
          `,
          [membership.id],
        ),
      ])

      return {
        ...membership,
        courses: coursesResult.rows,
        resources: resourcesResult.rows,
        announcements: announcementsResult.rows,
      }
    }),
  )
}

module.exports = {
  createUniqueMembershipSlug,
  getMembershipDetail,
  listAdminMemberships,
  listClientMemberships,
  slugify,
}
