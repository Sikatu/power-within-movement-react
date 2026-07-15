import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const boundarySource = readFileSync('src/components/admin/AdminErrorBoundary.jsx', 'utf8')
const preloadSource = readFileSync('src/components/admin/adminRoutePreloaders.js', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const expectedLoaders = [
  'loadAdminActivityCenter',
  'loadAdminAttentionQueue',
  'loadAdminCapacityCenter',
  'loadAdminClientMomentum',
  'loadAdminClientCoverage',
  'loadAdminSessionReadiness',
  'loadAdminSessionFollowThrough',
  'loadAdminDailyBrief',
  'loadAdminWeekPlanner',
  'loadAdminAuditLog',
  'loadAdminAutomationStudio',
  'loadAdminChangePassword',
  'loadAdminCircleCommunity',
  'loadAdminClient360',
  'loadAdminClients',
  'loadAdminDashboard',
  'loadAdminDeveloperErrors',
  'loadAdminDeveloperPanel',
  'loadAdminSecurityIntegrity',
  'loadAdminReleaseQa',
  'loadAdminEncouragements',
  'loadAdminFounderAvailability',
  'loadAdminFounderCalendar',
  'loadAdminFoundersView',
  'loadAdminInbox',
  'loadAdminLeadPipeline',
  'loadAdminLearningLibrary',
  'loadAdminLogin',
  'loadAdminMailStudio',
  'loadAdminMembershipCircle',
  'loadAdminOnboardingStudio',
  'loadAdminScheduler',
  'loadAdminSessionChangeRequests',
  'loadAdminTeamManagement',
]

const expectedPreloadRoutes = [
  '/admin/login',
  '/admin/change-password',
  '/admin/dashboard',
  '/admin/developer',
  '/admin/developer/errors',
  '/admin/developer/integrity',
  '/admin/developer/qa',
  '/admin/team',
  '/admin/founders-view',
  '/admin/founders-calendar',
  '/admin/founders-availability',
  '/admin/leads',
  '/admin/client-360/',
  '/admin/clients',
  '/admin/scheduler',
  '/admin/session-changes',
  '/admin/inbox',
  '/admin/email-studio',
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

const failures = []

for (const loader of expectedLoaders) {
  if (!preloadSource.includes(`export const ${loader}`)) {
    failures.push(`missing cached admin loader: ${loader}`)
  }

  if (!appSource.includes(`lazy(${loader})`)) {
    failures.push(`src/App.jsx does not use cached loader: ${loader}`)
  }
}

for (const route of expectedPreloadRoutes) {
  if (!preloadSource.includes(route)) {
    failures.push(`missing admin preload route: ${route}`)
  }
}

for (const safeguard of [
  '<AdminErrorBoundary resetKey={pathname} internal={isInternalRoute}>',
  "type: 'react'",
  "severity: 'high'",
  'window.location.reload()',
  'Copy diagnostic',
]) {
  if (!(appSource + boundarySource).includes(safeguard)) {
    failures.push(`missing admin recovery safeguard: ${safeguard}`)
  }
}

for (const preloadInteraction of [
  "preloadAdminRoutes(paths)",
  "onFocus: () => warmRoute(to)",
  "onMouseEnter: () => warmRoute(to)",
  "onPointerDown: () => warmRoute(to)",
]) {
  if (!frameSource.includes(preloadInteraction)) {
    failures.push(`missing navigation preload interaction: ${preloadInteraction}`)
  }
}

if (!packageSource.includes('node scripts/check-admin-resilience.mjs')) {
  failures.push('package.json lint command does not run the admin resilience audit')
}

if (/lazy\(\(\)\s*=>\s*import\(['"]\.\/pages\/admin\//.test(appSource)) {
  failures.push('src/App.jsx contains an uncached direct admin lazy import')
}

if (failures.length) {
  console.error('\nAdmin resilience audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin resilience audit passed (${expectedLoaders.length} cached route loaders, ${expectedPreloadRoutes.length} preload destinations, runtime recovery active).`,
)
