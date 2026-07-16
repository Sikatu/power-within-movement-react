import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const developerOperationsSource = readFileSync('src/pages/admin/AdminDeveloperOperations.jsx', 'utf8')

const expectedRoutes = [
  '/admin',
  '/admin/login',
  '/admin/change-password',
  '/admin/dashboard',
  '/admin/assets',
  '/admin/developer',
  '/admin/developer/errors',
  '/admin/developer/integrity',
  '/admin/developer/qa',
  '/admin/team',
  '/admin/founders-view',
  '/admin/founders-calendar',
  '/admin/founders-availability',
  '/admin/leads',
  '/admin/client-360/:clientId',
  '/admin/clients',
  '/admin/clients/:clientId',
  '/admin/clients/:clientId/:section',
  '/admin/scheduler',
  '/admin/session-changes',
  '/admin/inbox',
  '/admin/email-studio',
  '/admin/letters',
  '/admin/audience',
  '/admin/automations',
  '/admin/onboarding',
  '/admin/courses',
  '/admin/memberships',
  '/admin/circle',
  '/admin/encouragements',
  '/admin/brief',
  '/admin/week',
  '/admin/capacity',
  '/admin/momentum',
  '/admin/coverage',
  '/admin/readiness',
  '/admin/follow-through',
  '/admin/activity',
  '/admin/attention',
  '/admin/audit-log',
]

const expectedMetadata = [
  '/admin/login',
  '/admin/change-password',
  '/admin/dashboard',
  '/admin/assets',
  '/admin/developer',
  '/admin/developer/errors',
  '/admin/developer/integrity',
  '/admin/developer/qa',
  '/admin/team',
  '/admin/founders-view',
  '/admin/founders-calendar',
  '/admin/founders-availability',
  '/admin/leads',
  '/admin/client-360',
  '/admin/clients',
  '/admin/scheduler',
  '/admin/session-changes',
  '/admin/inbox',
  '/admin/email-studio',
  '/admin/letters',
  '/admin/audience',
  '/admin/automations',
  '/admin/onboarding',
  '/admin/courses',
  '/admin/memberships',
  '/admin/circle',
  '/admin/encouragements',
  '/admin/brief',
  '/admin/week',
  '/admin/capacity',
  '/admin/momentum',
  '/admin/coverage',
  '/admin/readiness',
  '/admin/follow-through',
  '/admin/activity',
  '/admin/attention',
  '/admin/audit-log',
]

const expectedNavigation = [
  '/admin/dashboard',
  '/admin/assets',
  '/admin/clients',
  '/admin/scheduler',
  '/admin/inbox',
  '/admin/leads',
  '/admin/onboarding',
  '/admin/automations',
  '/admin/encouragements',
  '/admin/courses',
  '/admin/memberships',
  '/admin/circle',
  '/admin/letters',
  '/admin/audience',
  '/admin/session-changes',
  '/admin/brief',
  '/admin/week',
  '/admin/capacity',
  '/admin/momentum',
  '/admin/coverage',
  '/admin/readiness',
  '/admin/follow-through',
  '/admin/activity',
  '/admin/attention',
  '/admin/audit-log',
  '/admin/team',
  '/admin/developer',
  '/admin/developer/errors',
  '/admin/developer/integrity',
  '/admin/developer/qa',
  '/admin/founders-view',
]

const routePaths = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1])
const metadataStart = appSource.indexOf('const routeMetadata = {')
const metadataEnd = appSource.indexOf('function resolveRouteMetadata')
const metadataSource = appSource.slice(metadataStart, metadataEnd)
const failures = []

for (const route of expectedRoutes) {
  if (!routePaths.includes(route)) failures.push(`missing admin route: ${route}`)
}

for (const route of expectedMetadata) {
  if (!metadataSource.includes(`'${route}'`)) failures.push(`missing route metadata: ${route}`)
}

for (const route of expectedNavigation) {
  if (!(frameSource + developerOperationsSource).includes(route)) failures.push(`missing Studio navigation destination: ${route}`)
}

const duplicateRoutes = routePaths.filter((route, index) => routePaths.indexOf(route) !== index)
for (const route of new Set(duplicateRoutes)) failures.push(`duplicate router path: ${route}`)

if (!appSource.includes('<RouteAnnouncer />')) {
  failures.push('route announcer is not mounted')
}

if (!appSource.includes('meta[name="theme-color"]')) {
  failures.push('route-aware browser theme color is missing')
}

if (!frameSource.includes('id="main-content"')) {
  failures.push('admin frame main-content target is missing')
}

if (failures.length) {
  console.error('\nAdmin route audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin route audit passed (${expectedRoutes.length} routes, ${expectedMetadata.length} metadata entries, ${expectedNavigation.length} navigation destinations).`,
)
