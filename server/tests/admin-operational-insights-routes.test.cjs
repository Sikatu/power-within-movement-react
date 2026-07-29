const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const serverRoot = path.resolve(__dirname, '..')
const routePath = path.join(serverRoot, 'src', 'routes', 'admin.operationalInsights.routes.js')
const legacyRoutePath = path.join(serverRoot, 'src', 'routes', 'admin.routes.js')
const appPath = path.join(serverRoot, 'src', 'app.js')

const routeSource = fs.readFileSync(routePath, 'utf8')
const legacyRouteSource = fs.readFileSync(legacyRoutePath, 'utf8')
const appSource = fs.readFileSync(appPath, 'utf8')

const operationalInsightsRouter = require('../src/routes/admin.operationalInsights.routes')

const expectedRoutes = [
  { method: 'get', path: '/team/workload', handlerCount: 5 },
  { method: 'get', path: '/client-momentum', handlerCount: 5 },
  { method: 'get', path: '/client-coverage', handlerCount: 5 },
  { method: 'get', path: '/session-readiness', handlerCount: 5 },
  { method: 'get', path: '/session-follow-through', handlerCount: 5 },
  { method: 'get', path: '/team/my-access', handlerCount: 5 },
]

test('Admin operational insights expose exactly the preserved HTTP contract', () => {
  const registeredRoutes = operationalInsightsRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      method: Object.keys(layer.route.methods)[0],
      path: layer.route.path,
      handlerCount: layer.route.stack.length,
    }))

  assert.deepEqual(registeredRoutes, expectedRoutes)
})

test('Admin operational insight routes are mounted through their owned module', () => {
  assert.match(
    appSource,
    /const adminOperationalInsightsRoutes = require\('\.\/routes\/admin\.operationalInsights\.routes'\)/,
  )
  assert.match(
    appSource,
    /app\.use\('\/api\/admin', sensitiveResponseHeaders, enforceTrustedMutation, adminOperationalInsightsRoutes\)/,
  )

  const ownedMount = appSource.indexOf('adminOperationalInsightsRoutes)')
  const legacyMount = appSource.indexOf('adminRoutes)')
  assert.ok(ownedMount > -1 && ownedMount < legacyMount, 'Owned routes must mount before the legacy router.')
})

test('Admin operational insights preserve the existing authorization boundary', () => {
  assert.match(routeSource, /requireAuth/)
  assert.match(routeSource, /requireRole\(\['developer', 'owner', 'admin', 'staff'\]\)/)
  assert.match(routeSource, /enforceTeamPermission/)
  assert.match(routeSource, /enforceTeamClientAssignment/)

  for (const route of expectedRoutes) {
    const signature = `router.${route.method}('${route.path}'`
    const routeStart = routeSource.indexOf(signature)
    assert.notEqual(routeStart, -1, `Missing ${route.path} route.`)
    const routeHeader = routeSource.slice(routeStart, routeSource.indexOf('=>', routeStart))
    assert.match(routeHeader, /requireAdmin/, `${route.path} does not use requireAdmin.`)
  }
})

test('Session insight routes preserve their query-day forwarding contract', () => {
  assert.match(routeSource, /listSessionReadiness\(req\.user, \{ days: req\.query\.days \}\)/)
  assert.match(routeSource, /listSessionFollowThrough\(req\.user, \{ days: req\.query\.days \}\)/)
})

test('Team access remains scoped to the authenticated admin viewer', () => {
  assert.match(routeSource, /access: await getTeamAccessForUser\(req\.user\)/)
})

test('Operational insights remain absent from the legacy monolithic router', () => {
  assert.doesNotMatch(
    legacyRouteSource,
    /router\.get\('\/(?:team\/workload|client-momentum|client-coverage|session-readiness|session-follow-through|team\/my-access)'/,
  )
  assert.doesNotMatch(legacyRouteSource, /listTeamWorkload|listClientMomentum|listClientCoverage/)
  assert.doesNotMatch(legacyRouteSource, /listSessionReadiness|listSessionFollowThrough|getTeamAccessForUser/)
})
