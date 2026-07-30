const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const serverRoot = path.resolve(__dirname, '..')
const routePath = path.join(serverRoot, 'src', 'routes', 'admin.automationStudio.routes.js')
const legacyRoutePath = path.join(serverRoot, 'src', 'routes', 'admin.routes.js')
const appPath = path.join(serverRoot, 'src', 'app.js')

const routeSource = fs.readFileSync(routePath, 'utf8')
const legacyRouteSource = fs.readFileSync(legacyRoutePath, 'utf8')
const appSource = fs.readFileSync(appPath, 'utf8')

const automationStudioRouter = require('../src/routes/admin.automationStudio.routes')

const expectedRoutes = [
  { method: 'get', path: '/automation-studio', handlerCount: 5 },
  { method: 'post', path: '/automation-studio/workflows', handlerCount: 5 },
  { method: 'put', path: '/automation-studio/workflows/:workflowId', handlerCount: 5 },
  { method: 'post', path: '/automation-studio/workflows/:workflowId/enroll', handlerCount: 5 },
  { method: 'post', path: '/automation-studio/enrollments/:enrollmentId/action', handlerCount: 5 },
  { method: 'post', path: '/automation-studio/run-due', handlerCount: 5 },
]

test('Admin Automation Studio exposes exactly the preserved HTTP contract', () => {
  const registeredRoutes = automationStudioRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      method: Object.keys(layer.route.methods)[0],
      path: layer.route.path,
      handlerCount: layer.route.stack.length,
    }))

  assert.deepEqual(registeredRoutes, expectedRoutes)
})

test('Admin Automation Studio is mounted through its owned module', () => {
  assert.match(
    appSource,
    /const adminAutomationStudioRoutes = require\('\.\/routes\/admin\.automationStudio\.routes'\)/,
  )
  assert.match(
    appSource,
    /app\.use\('\/api\/admin', sensitiveResponseHeaders, enforceTrustedMutation, adminAutomationStudioRoutes\)/,
  )

  const ownedMount = appSource.indexOf('adminAutomationStudioRoutes)')
  const legacyMount = appSource.indexOf('adminRoutes)')
  assert.ok(ownedMount > -1 && ownedMount < legacyMount, 'Owned routes must mount before the legacy router.')
})

test('Admin Automation Studio preserves the existing authorization boundary', () => {
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

test('Automation workflow and enrollment inputs retain their validation contracts', () => {
  assert.match(routeSource, /stepType: z\.enum\(\['email', 'follow_up_task', 'internal_notification'\]\)/)
  assert.match(routeSource, /triggerType: z\.enum\(\['manual', 'new_lead', 'pipeline_stage', 'client_converted'\]\)/)
  assert.match(routeSource, /steps: z\.array\(automationStepSchema\)\.max\(30\)/)
  assert.match(routeSource, /clientProfileId: z\.string\(\)\.uuid\(\)/)
  assert.match(routeSource, /action: z\.enum\(\['pause', 'resume', 'cancel', 'retry', 'run_now'\]\)/)
})

test('Staff automation actions retain explicit client-assignment enforcement', () => {
  assert.match(routeSource, /async function verifyAutomationClientAccess/)
  assert.match(routeSource, /FROM team_client_assignments/)
  assert.match(routeSource, /code: 'TEAM_CLIENT_ASSIGNMENT_REQUIRED'/)
  assert.equal((routeSource.match(/const allowed = await verifyAutomationClientAccess\(req,/g) || []).length, 2)
})

test('Run-now and due processing retain their bounded execution contracts', () => {
  assert.match(routeSource, /processDueAutomationEnrollments\(\{ enrollmentId: enrollment\.id \}\)/)
  assert.match(routeSource, /updateAutomationEnrollmentStatus\([\s\S]*?'retry'/)
  assert.match(routeSource, /processDueAutomationEnrollments\(\{ limit: 50 \}\)/)
})

test('Automation Studio remains absent from the legacy monolithic router', () => {
  assert.doesNotMatch(legacyRouteSource, /router\.(?:get|post|put)\('\/automation-studio/)
  assert.doesNotMatch(legacyRouteSource, /automationWorkflowSchema|automationEnrollmentSchema/)
  assert.doesNotMatch(
    legacyRouteSource,
    /createAutomationEnrollment|listAutomationStudio|processDueAutomationEnrollments|saveAutomationWorkflow|updateAutomationEnrollmentStatus/,
  )
})
