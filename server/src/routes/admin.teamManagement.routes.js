const express = require('express')
const { z } = require('zod')

const { pool } = require('../db/pool')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const {
  ACCESS_LEVELS: TEAM_ACCESS_LEVELS,
  FULL_ACCESS: TEAM_FULL_ACCESS,
  PERMISSION_MODULES: TEAM_PERMISSION_MODULES,
  TEMPLATE_PERMISSIONS: TEAM_TEMPLATE_PERMISSIONS,
  normalizePermissions: normalizeTeamPermissions,
  permissionsFromRow: teamPermissionsFromRow,
} = require('../services/teamManagement.service')

const router = express.Router()

const requireDeveloper = [
  requireAuth,
  requireRole(['developer']),
]

const teamDepartmentValues = [
  'leadership',
  'client_care',
  'operations',
  'content_community',
  'learning',
  'administration',
  'other',
]

const teamAvailabilityValues = ['available', 'focused', 'limited', 'away']
const teamAssignmentRoles = ['primary', 'support', 'specialist', 'observer']

const teamMemberUpdateSchema = z.object({
  displayName: z.string().trim().max(120).optional().default(''),
  jobTitle: z.string().trim().max(120).optional().default(''),
  department: z.enum(teamDepartmentValues),
  availabilityStatus: z.enum(teamAvailabilityValues),
  capacityPercent: z.coerce.number().int().min(0).max(100),
  isAssignable: z.boolean(),
  internalNotes: z.string().trim().max(4000).optional().default(''),
  permissionTemplate: z.enum([
    'custom',
    'client_care',
    'operations',
    'content_community',
    'read_only',
    'restricted',
  ]).optional().default('custom'),
  permissions: z.record(z.enum(TEAM_ACCESS_LEVELS)).optional().default({}),
})

const teamAssignmentsSchema = z.object({
  assignments: z.array(z.object({
    clientProfileId: z.string().uuid(),
    assignmentRole: z.enum(teamAssignmentRoles).optional().default('support'),
  })).max(500),
})

function serializeTeamMember(row) {
  const role = row.role || 'staff'

  return {
    id: row.id,
    email: row.email,
    role,
    status: row.status,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    profile: {
      displayName: row.display_name || '',
      jobTitle: row.job_title || '',
      department: row.department || (role === 'admin' ? 'administration' : 'client_care'),
      availabilityStatus: row.availability_status || 'available',
      capacityPercent: Number(row.capacity_percent ?? 100),
      isAssignable: row.is_assignable !== false,
      internalNotes: row.internal_notes || '',
    },
    permissions: teamPermissionsFromRow(row, role),
    permissionsLocked: role === 'admin',
    assignedClientCount: Number(row.assigned_client_count || 0),
    openConversationCount: Number(row.open_conversation_count || 0),
  }
}

async function getTeamManagementSnapshot() {
  const [membersResult, clientsResult, assignmentsResult] = await Promise.all([
    pool.query(`
      SELECT
        su.id,
        su.email,
        su.role,
        su.status,
        su.last_login_at,
        su.created_at,
        tmp.display_name,
        tmp.job_title,
        tmp.department,
        tmp.availability_status,
        tmp.capacity_percent,
        tmp.is_assignable,
        tmp.internal_notes,
        tmper.dashboard_access,
        tmper.clients_access,
        tmper.sessions_access,
        tmper.inbox_access,
        tmper.communications_access,
        tmper.learning_access,
        tmper.memberships_access,
        tmper.circle_access,
        tmper.encouragements_access,
        tmper.audit_access,
        (
          SELECT COUNT(*)::int
          FROM team_client_assignments tca
          WHERE tca.team_user_id = su.id
        ) AS assigned_client_count,
        (
          SELECT COUNT(*)::int
          FROM client_conversations cc
          WHERE cc.assigned_user_id = su.id
            AND cc.status <> 'closed'
        ) AS open_conversation_count
      FROM system_users su
      LEFT JOIN team_member_profiles tmp ON tmp.user_id = su.id
      LEFT JOIN team_member_permissions tmper ON tmper.user_id = su.id
      WHERE su.role IN ('admin', 'staff')
      ORDER BY
        CASE su.role WHEN 'admin' THEN 0 ELSE 1 END,
        CASE su.status WHEN 'active' THEN 0 ELSE 1 END,
        COALESCE(tmp.display_name, su.email::text)
    `),
    pool.query(`
      SELECT
        cp.id,
        cp.first_name,
        cp.last_name,
        cp.client_status,
        su.email,
        cp.updated_at
      FROM client_profiles cp
      LEFT JOIN system_users su ON su.id = cp.user_id
      WHERE cp.client_status <> 'archived'
      ORDER BY cp.first_name NULLS LAST, cp.last_name NULLS LAST, cp.created_at DESC
    `),
    pool.query(`
      SELECT
        tca.team_user_id,
        tca.client_profile_id,
        tca.assignment_role
      FROM team_client_assignments tca
      ORDER BY tca.created_at ASC
    `),
  ])

  const assignmentsByUser = new Map()

  for (const assignment of assignmentsResult.rows) {
    if (!assignmentsByUser.has(assignment.team_user_id)) {
      assignmentsByUser.set(assignment.team_user_id, [])
    }

    assignmentsByUser.get(assignment.team_user_id).push({
      clientProfileId: assignment.client_profile_id,
      assignmentRole: assignment.assignment_role,
    })
  }

  const members = membersResult.rows.map((row) => ({
    ...serializeTeamMember(row),
    clientAssignments: assignmentsByUser.get(row.id) || [],
  }))

  return {
    summary: {
      total: members.length,
      active: members.filter((member) => member.status === 'active').length,
      admins: members.filter((member) => member.role === 'admin').length,
      staff: members.filter((member) => member.role === 'staff').length,
      available: members.filter(
        (member) => member.profile.isAssignable && member.profile.availabilityStatus === 'available',
      ).length,
      assignedClients: assignmentsResult.rows.length,
    },
    members,
    clients: clientsResult.rows.map((client) => ({
      id: client.id,
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email,
      clientStatus: client.client_status,
      updatedAt: client.updated_at,
    })),
    templates: TEAM_TEMPLATE_PERMISSIONS,
    modules: TEAM_PERMISSION_MODULES,
  }
}

router.get('/developer/team', requireDeveloper, async (req, res, next) => {
  try {
    return res.json({
      ok: true,
      ...(await getTeamManagementSnapshot()),
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/developer/team/:userId', requireDeveloper, async (req, res, next) => {
  const parsed = teamMemberUpdateSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the team member settings.',
    })
  }

  const db = await pool.connect()

  try {
    await db.query('BEGIN')

    const userResult = await db.query(
      `
      SELECT id, email, role, status
      FROM system_users
      WHERE id = $1
        AND role IN ('admin', 'staff')
      LIMIT 1
      FOR UPDATE
      `,
      [req.params.userId],
    )

    const user = userResult.rows[0]

    if (!user) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Team member account not found.' })
    }

    const beforeResult = await db.query(
      `
      SELECT
        tmp.*,
        to_jsonb(tmper) AS permission_record
      FROM team_member_profiles tmp
      LEFT JOIN team_member_permissions tmper ON tmper.user_id = tmp.user_id
      WHERE tmp.user_id = $1
      LIMIT 1
      `,
      [user.id],
    )

    await db.query(
      `
      INSERT INTO team_member_profiles (
        user_id,
        display_name,
        job_title,
        department,
        availability_status,
        capacity_percent,
        is_assignable,
        internal_notes,
        created_by_user_id,
        updated_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
      ON CONFLICT (user_id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        job_title = EXCLUDED.job_title,
        department = EXCLUDED.department,
        availability_status = EXCLUDED.availability_status,
        capacity_percent = EXCLUDED.capacity_percent,
        is_assignable = EXCLUDED.is_assignable,
        internal_notes = EXCLUDED.internal_notes,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = now()
      `,
      [
        user.id,
        parsed.data.displayName || null,
        parsed.data.jobTitle || null,
        parsed.data.department,
        parsed.data.availabilityStatus,
        parsed.data.capacityPercent,
        parsed.data.isAssignable,
        parsed.data.internalNotes || null,
        req.user.id,
      ],
    )

    const requestedPermissions = parsed.data.permissionTemplate !== 'custom'
      ? TEAM_TEMPLATE_PERMISSIONS[parsed.data.permissionTemplate]
      : normalizeTeamPermissions(parsed.data.permissions)

    const permissions = user.role === 'admin'
      ? TEAM_FULL_ACCESS
      : normalizeTeamPermissions(requestedPermissions)

    await db.query(
      `
      INSERT INTO team_member_permissions (
        user_id,
        dashboard_access,
        clients_access,
        sessions_access,
        inbox_access,
        communications_access,
        learning_access,
        memberships_access,
        circle_access,
        encouragements_access,
        audit_access,
        updated_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_id)
      DO UPDATE SET
        dashboard_access = EXCLUDED.dashboard_access,
        clients_access = EXCLUDED.clients_access,
        sessions_access = EXCLUDED.sessions_access,
        inbox_access = EXCLUDED.inbox_access,
        communications_access = EXCLUDED.communications_access,
        learning_access = EXCLUDED.learning_access,
        memberships_access = EXCLUDED.memberships_access,
        circle_access = EXCLUDED.circle_access,
        encouragements_access = EXCLUDED.encouragements_access,
        audit_access = EXCLUDED.audit_access,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = now()
      `,
      [
        user.id,
        permissions.dashboard,
        permissions.clients,
        permissions.sessions,
        permissions.inbox,
        permissions.communications,
        permissions.learning,
        permissions.memberships,
        permissions.circle,
        permissions.encouragements,
        permissions.audit,
        req.user.id,
      ],
    )

    const afterResult = await db.query(
      `
      SELECT
        tmp.*,
        to_jsonb(tmper) AS permission_record
      FROM team_member_profiles tmp
      LEFT JOIN team_member_permissions tmper ON tmper.user_id = tmp.user_id
      WHERE tmp.user_id = $1
      LIMIT 1
      `,
      [user.id],
    )

    await db.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data,
        ip_address,
        user_agent
      )
      VALUES ($1, 'team_member_access_updated', 'system_users', $2, $3::jsonb, $4::jsonb, $5, $6)
      `,
      [
        req.user.id,
        user.id,
        JSON.stringify(beforeResult.rows[0] || null),
        JSON.stringify(afterResult.rows[0] || null),
        req.ip || null,
        req.get('user-agent') || null,
      ],
    )

    await db.query('COMMIT')

    return res.json({
      ok: true,
      message: user.role === 'admin'
        ? 'Admin profile saved. Admin operational access remains fully enabled.'
        : 'Team profile and permissions saved.',
      ...(await getTeamManagementSnapshot()),
    })
  } catch (error) {
    await db.query('ROLLBACK')
    return next(error)
  } finally {
    db.release()
  }
})

router.put('/developer/team/:userId/client-assignments', requireDeveloper, async (req, res, next) => {
  const parsed = teamAssignmentsSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: parsed.error.issues[0]?.message || 'Please check the client assignments.',
    })
  }

  const uniqueAssignments = []
  const seenClientIds = new Set()

  for (const assignment of parsed.data.assignments) {
    if (seenClientIds.has(assignment.clientProfileId)) continue
    seenClientIds.add(assignment.clientProfileId)
    uniqueAssignments.push(assignment)
  }

  const db = await pool.connect()

  try {
    await db.query('BEGIN')

    const userResult = await db.query(
      `
      SELECT id, email, role, status
      FROM system_users
      WHERE id = $1
        AND role IN ('admin', 'staff')
      LIMIT 1
      FOR UPDATE
      `,
      [req.params.userId],
    )

    const user = userResult.rows[0]

    if (!user) {
      await db.query('ROLLBACK')
      return res.status(404).json({ ok: false, error: 'Team member account not found.' })
    }

    if (uniqueAssignments.length) {
      const clientResult = await db.query(
        `SELECT id FROM client_profiles WHERE id = ANY($1::uuid[])`,
        [uniqueAssignments.map((assignment) => assignment.clientProfileId)],
      )

      if (clientResult.rows.length !== uniqueAssignments.length) {
        await db.query('ROLLBACK')
        return res.status(400).json({
          ok: false,
          error: 'One or more selected client profiles no longer exist.',
        })
      }
    }

    const beforeResult = await db.query(
      `
      SELECT client_profile_id, assignment_role
      FROM team_client_assignments
      WHERE team_user_id = $1
      ORDER BY created_at ASC
      `,
      [user.id],
    )

    await db.query('DELETE FROM team_client_assignments WHERE team_user_id = $1', [user.id])

    for (const assignment of uniqueAssignments) {
      await db.query(
        `
        INSERT INTO team_client_assignments (
          team_user_id,
          client_profile_id,
          assignment_role,
          assigned_by_user_id
        )
        VALUES ($1, $2, $3, $4)
        `,
        [user.id, assignment.clientProfileId, assignment.assignmentRole, req.user.id],
      )
    }

    await db.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        before_data,
        after_data,
        ip_address,
        user_agent
      )
      VALUES ($1, 'team_client_assignments_replaced', 'system_users', $2, $3::jsonb, $4::jsonb, $5, $6)
      `,
      [
        req.user.id,
        user.id,
        JSON.stringify(beforeResult.rows),
        JSON.stringify(uniqueAssignments),
        req.ip || null,
        req.get('user-agent') || null,
      ],
    )

    await db.query('COMMIT')

    return res.json({
      ok: true,
      message: uniqueAssignments.length
        ? `${uniqueAssignments.length} client assignment(s) saved.`
        : 'All client assignments were removed.',
      ...(await getTeamManagementSnapshot()),
    })
  } catch (error) {
    await db.query('ROLLBACK')
    return next(error)
  } finally {
    db.release()
  }
})

module.exports = router
