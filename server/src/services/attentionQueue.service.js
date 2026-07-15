const { pool } = require('../db/pool')
const { dueBucket } = require('./attentionQueueTiming')

function clientName(row) {
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
    || row.client_email
    || 'Unnamed client'
}

function serializeTask(row) {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceLabel: row.source_label,
    clientProfileId: row.client_profile_id,
    clientName: clientName(row),
    clientEmail: row.client_email || null,
    title: row.title,
    description: row.description || '',
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name || row.owner_email || null,
    ownerEmail: row.owner_email || null,
    dueAt: row.due_at,
    priority: row.priority,
    status: row.status,
    visibility: row.visibility || 'team',
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    actionUrl: row.source_type === 'care_action'
      ? `/admin/client-360/${row.client_profile_id}`
      : '/admin/leads',
  }
}

async function listAttentionQueue(user, db = pool) {
  if (!db) throw new Error('Database is not configured.')

  const teamUserId = user?.role === 'staff' ? user.id : null

  const [tasksResult, teamResult] = await Promise.all([
    db.query(
      `
      WITH attention_items AS (
        SELECT
          lfu.id,
          'lead_follow_up'::text AS source_type,
          'Lead follow-up'::text AS source_label,
          lfu.client_profile_id,
          cp.first_name,
          cp.last_name,
          COALESCE(portal_user.email, cp.public_contact_email) AS client_email,
          lfu.title,
          lfu.notes AS description,
          lfu.assigned_to_user_id AS owner_user_id,
          owner.email AS owner_email,
          COALESCE(owner_profile.display_name, owner.email::text) AS owner_name,
          lfu.due_at,
          lfu.priority,
          lfu.status,
          'team'::text AS visibility,
          lfu.completed_at,
          lfu.created_at,
          lfu.updated_at
        FROM lead_follow_ups lfu
        JOIN client_profiles cp ON cp.id = lfu.client_profile_id
        LEFT JOIN system_users portal_user ON portal_user.id = cp.user_id
        LEFT JOIN system_users owner ON owner.id = lfu.assigned_to_user_id
        LEFT JOIN team_member_profiles owner_profile ON owner_profile.user_id = owner.id
        WHERE lfu.status = 'open'
          AND (
            $1::uuid IS NULL
            OR EXISTS (
              SELECT 1
              FROM team_client_assignments tca
              WHERE tca.team_user_id = $1
                AND tca.client_profile_id = lfu.client_profile_id
            )
          )

        UNION ALL

        SELECT
          cca.id,
          'care_action'::text AS source_type,
          'Client care action'::text AS source_label,
          cca.client_profile_id,
          cp.first_name,
          cp.last_name,
          COALESCE(portal_user.email, cp.public_contact_email) AS client_email,
          cca.title,
          cca.description,
          cca.owner_user_id,
          owner.email AS owner_email,
          COALESCE(owner_profile.display_name, owner.email::text) AS owner_name,
          cca.due_at,
          cca.priority,
          cca.status,
          cca.visibility,
          cca.completed_at,
          cca.created_at,
          cca.updated_at
        FROM client_care_actions cca
        JOIN client_profiles cp ON cp.id = cca.client_profile_id
        LEFT JOIN system_users portal_user ON portal_user.id = cp.user_id
        LEFT JOIN system_users owner ON owner.id = cca.owner_user_id
        LEFT JOIN team_member_profiles owner_profile ON owner_profile.user_id = owner.id
        WHERE cca.status IN ('open', 'in_progress')
          AND (
            $1::uuid IS NULL
            OR EXISTS (
              SELECT 1
              FROM team_client_assignments tca
              WHERE tca.team_user_id = $1
                AND tca.client_profile_id = cca.client_profile_id
            )
          )
      )
      SELECT *
      FROM attention_items
      ORDER BY
        CASE priority
          WHEN 'urgent' THEN 0
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          ELSE 3
        END,
        due_at ASC NULLS LAST,
        updated_at DESC
      LIMIT 500
      `,
      [teamUserId],
    ),
    db.query(
      `
      SELECT
        su.id,
        su.email,
        su.role,
        COALESCE(tmp.display_name, su.email::text) AS display_name,
        COALESCE(
          array_agg(tca.client_profile_id) FILTER (WHERE tca.client_profile_id IS NOT NULL),
          ARRAY[]::uuid[]
        ) AS client_profile_ids
      FROM system_users su
      LEFT JOIN team_member_profiles tmp ON tmp.user_id = su.id
      LEFT JOIN team_client_assignments tca ON tca.team_user_id = su.id
      WHERE su.role IN ('admin', 'staff')
        AND su.status = 'active'
        AND COALESCE(tmp.is_assignable, true) = true
      GROUP BY su.id, tmp.display_name
      ORDER BY
        CASE su.role WHEN 'admin' THEN 0 ELSE 1 END,
        COALESCE(tmp.display_name, su.email::text)
      `,
    ),
  ])

  const tasks = tasksResult.rows.map(serializeTask)
  const now = Date.now()
  const metrics = {
    total: tasks.length,
    overdue: tasks.filter((task) => dueBucket(task, now) === 'overdue').length,
    dueToday: tasks.filter((task) => dueBucket(task, now) === 'today').length,
    urgent: tasks.filter((task) => task.priority === 'urgent').length,
    unassigned: tasks.filter((task) => !task.ownerUserId).length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
  }

  return {
    tasks,
    metrics,
    teamUsers: teamResult.rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      displayName: row.display_name,
      clientProfileIds: row.client_profile_ids || [],
    })),
  }
}

module.exports = {
  listAttentionQueue,
}
