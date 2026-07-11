const { pool } = require('../db/pool')

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `learning-${Date.now()}`
}

async function createUniqueCourseSlug(title, excludeCourseId = null, db = pool) {
  const base = slugify(title)
  let candidate = base
  let suffix = 2

  while (true) {
    const result = await db.query(
      `
      SELECT id
      FROM courses
      WHERE slug = $1
        AND ($2::uuid IS NULL OR id <> $2::uuid)
      LIMIT 1
      `,
      [candidate, excludeCourseId],
    )

    if (!result.rows[0]) return candidate

    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

async function listAdminCourses(db = pool) {
  const result = await db.query(`
    SELECT
      c.*,
      COALESCE(module_counts.module_count, 0)::int AS module_count,
      COALESCE(lesson_counts.lesson_count, 0)::int AS lesson_count,
      COALESCE(access_counts.access_count, 0)::int AS access_count,
      COALESCE(progress_counts.started_count, 0)::int AS started_count,
      COALESCE(progress_counts.completed_count, 0)::int AS completed_count
    FROM courses c
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS module_count
      FROM course_modules cm
      WHERE cm.course_id = c.id
        AND cm.status <> 'archived'
    ) module_counts ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS lesson_count
      FROM course_lessons cl
      JOIN course_modules cm ON cm.id = cl.module_id
      WHERE cm.course_id = c.id
        AND cm.status <> 'archived'
        AND cl.status <> 'archived'
    ) lesson_counts ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS access_count
      FROM course_access ca
      WHERE ca.course_id = c.id
        AND ca.access_status = 'active'
    ) access_counts ON true
    LEFT JOIN LATERAL (
      SELECT
        COUNT(DISTINCT lp.client_profile_id) FILTER (WHERE lp.last_viewed_at IS NOT NULL) AS started_count,
        COUNT(DISTINCT lp.client_profile_id) FILTER (WHERE lp.completed_at IS NOT NULL) AS completed_count
      FROM lesson_progress lp
      JOIN course_lessons cl ON cl.id = lp.lesson_id
      JOIN course_modules cm ON cm.id = cl.module_id
      WHERE cm.course_id = c.id
    ) progress_counts ON true
    ORDER BY
      CASE c.status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
      c.updated_at DESC,
      c.created_at DESC
  `)

  return result.rows
}

async function getCourseTree(courseId, options = {}, db = pool) {
  const publishedOnly = Boolean(options.publishedOnly)
  const clientProfileId = options.clientProfileId || null

  const courseResult = await db.query(
    `
    SELECT *
    FROM courses
    WHERE id = $1
      ${publishedOnly ? "AND status = 'published'" : ''}
    LIMIT 1
    `,
    [courseId],
  )

  const course = courseResult.rows[0]
  if (!course) return null

  const modulesResult = await db.query(
    `
    SELECT *
    FROM course_modules
    WHERE course_id = $1
      ${publishedOnly ? "AND status = 'published'" : "AND status <> 'archived'"}
    ORDER BY position ASC, created_at ASC
    `,
    [courseId],
  )

  const moduleIds = modulesResult.rows.map((module) => module.id)
  let lessons = []

  if (moduleIds.length > 0) {
    const lessonsResult = await db.query(
      `
      SELECT
        cl.*,
        ${clientProfileId ? 'lp.last_viewed_at, lp.completed_at, lp.notes AS progress_notes' : 'NULL::timestamptz AS last_viewed_at, NULL::timestamptz AS completed_at, NULL::text AS progress_notes'}
      FROM course_lessons cl
      ${clientProfileId ? 'LEFT JOIN lesson_progress lp ON lp.lesson_id = cl.id AND lp.client_profile_id = $2' : ''}
      WHERE cl.module_id = ANY($1::uuid[])
        ${publishedOnly ? "AND cl.status = 'published'" : "AND cl.status <> 'archived'"}
      ORDER BY cl.position ASC, cl.created_at ASC
      `,
      clientProfileId ? [moduleIds, clientProfileId] : [moduleIds],
    )

    lessons = lessonsResult.rows
  }

  const modules = modulesResult.rows.map((module) => ({
    ...module,
    lessons: lessons.filter((lesson) => lesson.module_id === module.id),
  }))

  let access = []

  if (!publishedOnly) {
    const accessResult = await db.query(
      `
      SELECT
        ca.*,
        cp.first_name,
        cp.last_name,
        su.email,
        su.status AS account_status
      FROM course_access ca
      JOIN client_profiles cp ON cp.id = ca.client_profile_id
      LEFT JOIN system_users su ON su.id = cp.user_id
      WHERE ca.course_id = $1
      ORDER BY cp.first_name, cp.last_name, su.email
      `,
      [courseId],
    )

    access = accessResult.rows
  }

  const lessonCount = modules.reduce((count, module) => count + module.lessons.length, 0)
  const completedCount = clientProfileId
    ? modules.reduce(
        (count, module) =>
          count + module.lessons.filter((lesson) => lesson.completed_at).length,
        0,
      )
    : 0

  return {
    ...course,
    modules,
    access,
    lessonCount,
    completedCount,
    progressPercent:
      clientProfileId && lessonCount > 0
        ? Math.round((completedCount / lessonCount) * 100)
        : 0,
  }
}

async function clientCanAccessCourse(courseId, clientProfileId, db = pool) {
  const result = await db.query(
    `
    SELECT c.id
    FROM courses c
    WHERE c.id = $1
      AND c.status = 'published'
      AND (
        c.access_mode = 'all_clients'
        OR EXISTS (
          SELECT 1
          FROM course_access ca
          WHERE ca.course_id = c.id
            AND ca.client_profile_id = $2
            AND ca.access_status = 'active'
            AND (ca.expires_at IS NULL OR ca.expires_at > now())
        )
        OR EXISTS (
          SELECT 1
          FROM membership_course_links mcl
          JOIN memberships m ON m.id = mcl.membership_id
          JOIN membership_enrollments me ON me.membership_id = m.id
          WHERE mcl.course_id = c.id
            AND me.client_profile_id = $2
            AND m.status = 'active'
            AND me.status = 'active'
            AND (me.started_at IS NULL OR me.started_at <= now())
            AND (me.ends_at IS NULL OR me.ends_at > now())
        )
      )
    LIMIT 1
    `,
    [courseId, clientProfileId],
  )

  return Boolean(result.rows[0])
}

async function listClientCourses(clientProfileId, db = pool) {
  const result = await db.query(
    `
    SELECT DISTINCT c.id
    FROM courses c
    WHERE c.status = 'published'
      AND (
        c.access_mode = 'all_clients'
        OR EXISTS (
          SELECT 1
          FROM course_access ca
          WHERE ca.course_id = c.id
            AND ca.client_profile_id = $1
            AND ca.access_status = 'active'
            AND (ca.expires_at IS NULL OR ca.expires_at > now())
        )
        OR EXISTS (
          SELECT 1
          FROM membership_course_links mcl
          JOIN memberships m ON m.id = mcl.membership_id
          JOIN membership_enrollments me ON me.membership_id = m.id
          WHERE mcl.course_id = c.id
            AND me.client_profile_id = $1
            AND m.status = 'active'
            AND me.status = 'active'
            AND (me.started_at IS NULL OR me.started_at <= now())
            AND (me.ends_at IS NULL OR me.ends_at > now())
        )
      )
    ORDER BY c.id
    `,
    [clientProfileId],
  )

  return Promise.all(
    result.rows.map((row) =>
      getCourseTree(
        row.id,
        {
          publishedOnly: true,
          clientProfileId,
        },
        db,
      ),
    ),
  )
}

module.exports = {
  clientCanAccessCourse,
  createUniqueCourseSlug,
  getCourseTree,
  listAdminCourses,
  listClientCourses,
  slugify,
}
