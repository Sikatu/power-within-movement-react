const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const serverRoot = path.resolve(__dirname, '..')
const routePath = path.join(serverRoot, 'src', 'routes', 'admin.teamManagement.routes.js')
const legacyRoutePath = path.join(serverRoot, 'src', 'routes', 'admin.routes.js')
const appPath = path.join(serverRoot, 'src', 'app.js')

const routeSource = fs.readFileSync(routePath, 'utf8')
const legacyRouteSource = fs.readFileSync(legacyRoutePath, 'utf8')
const appSource = fs.readFileSync(appPath, 'utf8')

const teamManagementRouter = require('../src/routes/admin.teamManagement.routes')

const expectedRoutes = [
  { method: 'get', path: '/developer/team', handlerCount: 3 },
  { method: 'patch', path: '/developer/team/:userId', handlerCount: 3 },
  { method: 'put', path: '/developer/team/:userId/client-assignments', handlerCount: 3 },
]

test('Admin Team Management exposes exactly the preserved HTTP contract', () => {
  const registeredRoutes = teamManagementRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      method: Object.keys(layer.route.methods)[0],
      path: layer.route.path,
      handlerCount: layer.route.stack.length,
    }))

  assert.deepEqual(registeredRoutes, expectedRoutes)
})

test('Admin Team Management is mounted through its owned module', () => {
  assert.match(
    appSource,
    /const adminTeamManagementRoutes = require\('\.\/routes\/admin\.teamManagement\.routes'\)/,
  )
  assert.match(
    appSource,
    /app\.use\('\/api\/admin', sensitiveResponseHeaders, enforceTrustedMutation, adminTeamManagementRoutes\)/,
  )

  const ownedMount = appSource.indexOf('adminTeamManagementRoutes)')
  const legacyMount = appSource.indexOf('adminRoutes)')
  assert.ok(ownedMount > -1 && ownedMount < legacyMount, 'Owned routes must mount before the legacy router.')
})

test('Admin Team Management preserves the developer-only authorization boundary', () => {
  assert.match(routeSource, /requireAuth/)
  assert.match(routeSource, /requireRole\(\['developer'\]\)/)

  for (const route of expectedRoutes) {
    const signature = `router.${route.method}('${route.path}'`
    const routeStart = routeSource.indexOf(signature)
    assert.notEqual(routeStart, -1, `Missing ${route.path} route.`)
    const routeHeader = routeSource.slice(routeStart, routeSource.indexOf('=>', routeStart))
    assert.match(routeHeader, /requireDeveloper/, `${route.path} does not use requireDeveloper.`)
  }
})

test('Team profile validation and administrator permission locking are preserved', () => {
  assert.match(routeSource, /capacityPercent: z\.coerce\.number\(\)\.int\(\)\.min\(0\)\.max\(100\)/)
  assert.match(routeSource, /permissions: z\.record\(z\.enum\(TEAM_ACCESS_LEVELS\)\)/)
  assert.match(routeSource, /parsed\.data\.permissionTemplate !== 'custom'/)
  assert.match(routeSource, /const permissions = user\.role === 'admin'[\s\S]*?\? TEAM_FULL_ACCESS/)
  assert.match(routeSource, /permissionsLocked: role === 'admin'/)
})

test('Team profile mutations retain transactions and audit evidence', () => {
  assert.match(routeSource, /await db\.query\('BEGIN'\)/)
  assert.match(routeSource, /await db\.query\('COMMIT'\)/)
  assert.match(routeSource, /await db\.query\('ROLLBACK'\)/)
  assert.match(routeSource, /'team_member_access_updated'/)
  assert.match(routeSource, /before_data,[\s\S]*?after_data,[\s\S]*?ip_address,[\s\S]*?user_agent/)
  assert.match(routeSource, /req\.ip \|\| null/)
  assert.match(routeSource, /req\.get\('user-agent'\) \|\| null/)
})

test('Client assignments retain deduplication, validation, replacement, and audit logging', () => {
  assert.match(routeSource, /const seenClientIds = new Set\(\)/)
  assert.match(routeSource, /if \(seenClientIds\.has\(assignment\.clientProfileId\)\) continue/)
  assert.match(routeSource, /WHERE id = ANY\(\$1::uuid\[\]\)/)
  assert.match(routeSource, /DELETE FROM team_client_assignments WHERE team_user_id = \$1/)
  assert.match(routeSource, /INSERT INTO team_client_assignments/)
  assert.match(routeSource, /'team_client_assignments_replaced'/)
})

test('Team Management remains absent from the legacy monolithic router', () => {
  assert.doesNotMatch(
    legacyRouteSource,
    /router\.(?:get|patch|put)\('\/developer\/team/,
  )
  assert.doesNotMatch(legacyRouteSource, /teamMemberUpdateSchema|teamAssignmentsSchema|getTeamManagementSnapshot/)
  assert.doesNotMatch(legacyRouteSource, /TEAM_ACCESS_LEVELS|TEAM_FULL_ACCESS|TEAM_PERMISSION_MODULES|TEAM_TEMPLATE_PERMISSIONS/)
  assert.doesNotMatch(legacyRouteSource, /normalizeTeamPermissions|teamPermissionsFromRow/)
})
