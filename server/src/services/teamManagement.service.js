const { pool } = require('../db/pool')

const ACCESS_LEVELS = ['none', 'view', 'manage']

const PERMISSION_MODULES = [
  'dashboard',
  'clients',
  'sessions',
  'inbox',
  'communications',
  'learning',
  'memberships',
  'circle',
  'encouragements',
  'audit',
]

const DEFAULT_STAFF_PERMISSIONS = {
  dashboard: 'view',
  clients: 'none',
  sessions: 'none',
  inbox: 'none',
  communications: 'none',
  learning: 'none',
  memberships: 'none',
  circle: 'none',
  encouragements: 'none',
  audit: 'none',
}

const FULL_ACCESS = Object.fromEntries(
  PERMISSION_MODULES.map((moduleName) => [moduleName, 'manage']),
)

const TEMPLATE_PERMISSIONS = {
  client_care: {
    ...DEFAULT_STAFF_PERMISSIONS,
    clients: 'manage',
    sessions: 'manage',
    inbox: 'manage',
    encouragements: 'manage',
  },
  operations: {
    ...DEFAULT_STAFF_PERMISSIONS,
    dashboard: 'manage',
    clients: 'manage',
    sessions: 'manage',
    inbox: 'manage',
    communications: 'manage',
    learning: 'view',
    memberships: 'view',
    circle: 'view',
    encouragements: 'view',
  },
  content_community: {
    ...DEFAULT_STAFF_PERMISSIONS,
    communications: 'manage',
    learning: 'manage',
    memberships: 'manage',
    circle: 'manage',
    encouragements: 'manage',
  },
  read_only: Object.fromEntries(
    PERMISSION_MODULES.map((moduleName) => [moduleName, 'view']),
  ),
  restricted: DEFAULT_STAFF_PERMISSIONS,
}

function normalizeAccessLevel(value, fallback = 'none') {
  return ACCESS_LEVELS.includes(value) ? value : fallback
}

function normalizePermissions(input = {}, fallback = DEFAULT_STAFF_PERMISSIONS) {
  return Object.fromEntries(
    PERMISSION_MODULES.map((moduleName) => [
      moduleName,
      normalizeAccessLevel(input[moduleName], fallback[moduleName] || 'none'),
    ]),
  )
}

function permissionsFromRow(row, role = 'staff') {
  if (role === 'admin') return { ...FULL_ACCESS }

  return Object.fromEntries(
    PERMISSION_MODULES.map((moduleName) => [
      moduleName,
      normalizeAccessLevel(row?.[`${moduleName}_access`], DEFAULT_STAFF_PERMISSIONS[moduleName]),
    ]),
  )
}

function routePermissionModule(pathname = '') {
  const path = String(pathname || '').split('?')[0]

  if (path.startsWith('/notifications')) return null
  if (path === '/team/my-access') return null
  if (path.startsWith('/overview')) return 'dashboard'
  if (
    path.startsWith('/clients') ||
    path.startsWith('/follow-ups') ||
    path.startsWith('/service-records') ||
    path.startsWith('/portal-resources') ||
    path.startsWith('/portal-invites') ||
    path.startsWith('/portal-email-logs')
  ) return 'clients'
  if (
    path.startsWith('/bookings') ||
    path.startsWith('/appointment-types') ||
    path.startsWith('/availability-blocks') ||
    path.startsWith('/session-change-requests')
  ) return 'sessions'
  if (path.startsWith('/inbox')) return 'inbox'
  if (path.startsWith('/mail-studio')) return 'communications'
  if (path.startsWith('/learning-library')) return 'learning'
  if (path.startsWith('/memberships')) return 'memberships'
  if (path.startsWith('/circle')) return 'circle'
  if (path.startsWith('/encouragements')) return 'encouragements'
  if (path.startsWith('/audit-logs')) return 'audit'

  return 'unavailable'
}

async function getTeamAccessForUser(user) {
  if (!user) return null

  if (['developer', 'owner', 'admin'].includes(user.role)) {
    return {
      role: user.role,
      profile: null,
      permissions: { ...FULL_ACCESS },
      isFullAccess: true,
    }
  }

  if (user.role !== 'staff' || !pool) {
    return {
      role: user.role,
      profile: null,
      permissions: { ...DEFAULT_STAFF_PERMISSIONS },
      isFullAccess: false,
    }
  }

  const result = await pool.query(
    `
    SELECT
      tmp.display_name,
      tmp.job_title,
      tmp.department,
      tmp.availability_status,
      tmp.capacity_percent,
      tmp.is_assignable,
      tmp.internal_notes,
      tmper.*
    FROM team_member_profiles tmp
    LEFT JOIN team_member_permissions tmper ON tmper.user_id = tmp.user_id
    WHERE tmp.user_id = $1
    LIMIT 1
    `,
    [user.id],
  )

  const row = result.rows[0]

  return {
    role: user.role,
    profile: row
      ? {
          displayName: row.display_name,
          jobTitle: row.job_title,
          department: row.department,
          availabilityStatus: row.availability_status,
          capacityPercent: Number(row.capacity_percent || 0),
          isAssignable: Boolean(row.is_assignable),
        }
      : null,
    permissions: permissionsFromRow(row, user.role),
    isFullAccess: false,
  }
}


async function enforceTeamClientAssignment(req, res, next) {
  if (req.user?.role !== 'staff') return next()

  const clientProfileId = req.params?.clientId
  if (!clientProfileId) return next()

  try {
    const result = await pool.query(
      `
      SELECT 1
      FROM team_client_assignments
      WHERE team_user_id = $1
        AND client_profile_id = $2
      LIMIT 1
      `,
      [req.user.id, clientProfileId],
    )

    if (!result.rows[0]) {
      return res.status(403).json({
        ok: false,
        code: 'TEAM_CLIENT_ASSIGNMENT_REQUIRED',
        clientProfileId,
        error: 'This client is not assigned to your team profile.',
      })
    }

    req.teamClientAssignmentVerified = true
    return next()
  } catch (error) {
    return next(error)
  }
}

async function enforceTeamPermission(req, res, next) {
  if (req.user?.role !== 'staff') return next()

  try {
    const moduleName = routePermissionModule(req.path)

    if (!moduleName) return next()

    if (moduleName === 'unavailable') {
      return res.status(403).json({
        ok: false,
        code: 'TEAM_MODULE_UNAVAILABLE',
        error: 'This Studio area is not available to staff accounts.',
      })
    }

    const access = await getTeamAccessForUser(req.user)
    const level = access?.permissions?.[moduleName] || 'none'
    const requiresManage = !['GET', 'HEAD', 'OPTIONS'].includes(req.method)

    if (level === 'none' || (requiresManage && level !== 'manage')) {
      return res.status(403).json({
        ok: false,
        code: 'TEAM_PERMISSION_REQUIRED',
        permissionModule: moduleName,
        requiredLevel: requiresManage ? 'manage' : 'view',
        currentLevel: level,
        error: requiresManage
          ? 'Your team role is view-only for this Studio area.'
          : 'Your team role does not include access to this Studio area.',
      })
    }

    req.teamAccess = access
    req.teamPermissionModule = moduleName
    return next()
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  ACCESS_LEVELS,
  DEFAULT_STAFF_PERMISSIONS,
  FULL_ACCESS,
  PERMISSION_MODULES,
  TEMPLATE_PERMISSIONS,
  enforceTeamClientAssignment,
  enforceTeamPermission,
  getTeamAccessForUser,
  normalizePermissions,
  permissionsFromRow,
  routePermissionModule,
}
