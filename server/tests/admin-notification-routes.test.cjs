const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const serverRoot = path.resolve(__dirname, '..')
const routePath = path.join(serverRoot, 'src', 'routes', 'admin.notifications.routes.js')
const legacyRoutePath = path.join(serverRoot, 'src', 'routes', 'admin.routes.js')
const appPath = path.join(serverRoot, 'src', 'app.js')

const routeSource = fs.readFileSync(routePath, 'utf8')
const legacyRouteSource = fs.readFileSync(legacyRoutePath, 'utf8')
const appSource = fs.readFileSync(appPath, 'utf8')

const notificationRouter = require('../src/routes/admin.notifications.routes')

const expectedRoutes = [
  ["router.get('/notifications/summary'", 'notification summary'],
  ["router.get('/notifications'", 'notification list'],
  ["router.patch('/notifications/:notificationId/read'", 'single read action'],
  ["router.post('/notifications/mark-all-read'", 'mark-all-read action'],
  ["router.delete('/notifications/:notificationId'", 'dismiss action'],
  ["router.post('/notifications/clear-read'", 'clear-read action'],
  ["router.get('/notifications/preferences'", 'preference read'],
  ["router.patch('/notifications/preferences'", 'preference update'],
]

test('Admin Notification Center exposes exactly the preserved HTTP contract', () => {
  const registeredRoutes = notificationRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      method: Object.keys(layer.route.methods)[0],
      path: layer.route.path,
      handlerCount: layer.route.stack.length,
    }))

  assert.deepEqual(registeredRoutes, [
    { method: 'get', path: '/notifications/summary', handlerCount: 5 },
    { method: 'get', path: '/notifications', handlerCount: 5 },
    { method: 'patch', path: '/notifications/:notificationId/read', handlerCount: 5 },
    { method: 'post', path: '/notifications/mark-all-read', handlerCount: 5 },
    { method: 'delete', path: '/notifications/:notificationId', handlerCount: 5 },
    { method: 'post', path: '/notifications/clear-read', handlerCount: 5 },
    { method: 'get', path: '/notifications/preferences', handlerCount: 5 },
    { method: 'patch', path: '/notifications/preferences', handlerCount: 5 },
  ])
})

test('Admin Notification Center routes are registered through their owned module', () => {
  assert.match(appSource, /const adminNotificationRoutes = require\('\.\/routes\/admin\.notifications\.routes'\)/)
  assert.match(
    appSource,
    /app\.use\('\/api\/admin', sensitiveResponseHeaders, enforceTrustedMutation, adminNotificationRoutes\)/,
  )

  for (const [signature, label] of expectedRoutes) {
    assert.ok(routeSource.includes(signature), `Missing ${label} route.`)
  }
})

test('Admin Notification Center preserves the existing authorization boundary', () => {
  assert.match(routeSource, /requireAuth/)
  assert.match(routeSource, /requireRole\(\['developer', 'owner', 'admin', 'staff'\]\)/)
  assert.match(routeSource, /enforceTeamPermission/)
  assert.match(routeSource, /enforceTeamClientAssignment/)

  for (const [signature, label] of expectedRoutes) {
    const routeStart = routeSource.indexOf(signature)
    assert.notEqual(routeStart, -1, `Missing ${label} route.`)
    const routeHeader = routeSource.slice(routeStart, routeSource.indexOf('=>', routeStart))
    assert.match(routeHeader, /requireAdmin/, `${label} does not use requireAdmin.`)
  }
})

test('Admin Notification Center remains absent from the legacy monolithic router', () => {
  assert.doesNotMatch(legacyRouteSource, /notificationCenter\.service/)
  assert.doesNotMatch(legacyRouteSource, /router\.(?:get|post|patch|delete)\('\/notifications/)
})

test('Notification preference updates retain validation and audit logging', () => {
  assert.match(routeSource, /notificationPreferencesSchema\.safeParse\(req\.body\)/)
  assert.match(routeSource, /notification_preferences_updated/)
  assert.match(routeSource, /req\.ip \|\| null/)
  assert.match(routeSource, /req\.get\('user-agent'\) \|\| null/)
})
