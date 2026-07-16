import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const navigationSource = readFileSync('src/components/admin/adminNavigation.js', 'utf8')
const preloadersSource = readFileSync('src/components/admin/adminRoutePreloaders.js', 'utf8')
const operationsSource = readFileSync('src/pages/admin/AdminOperationsCenter.jsx', 'utf8')
const toggleSource = readFileSync('src/components/admin/AdminAdvancedFilterToggle.jsx', 'utf8')
const stylesSource = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')
const failures = []

const requiredTokens = [
  [appSource, 'path="/admin/operations"', 'Operations Center route'],
  [appSource, 'lazy(loadAdminOperationsCenter)', 'Operations Center lazy loading'],
  [preloadersSource, "path === '/admin/operations'", 'Operations Center route preloader'],
  [navigationSource, "to: '/admin/operations', label: 'Operations Center'", 'single Operations sidebar entry'],
  [navigationSource, "label: 'Attention Queue', module: 'clients', hiddenInSidebar: true", 'searchable hidden Operations tools'],
  [frameSource, 'filter((item) => !item.hiddenInSidebar)', 'compact sidebar rendering'],
  [operationsSource, "label: 'Plan the work'", 'planning lane'],
  [operationsSource, "label: 'Protect client care'", 'client-care lane'],
  [operationsSource, "label: 'Complete the session loop'", 'session-continuity lane'],
  [operationsSource, "label: 'Review what changed'", 'operational-history lane'],
  [operationsSource, 'getMyTeamAccess()', 'role-aware Operations access'],
  [operationsSource, 'Recommended Path', 'recommended daily path'],
  [toggleSource, "open ? 'Hide filters' : 'More filters'", 'shared advanced-filter disclosure'],
  [toggleSource, 'aria-expanded={open}', 'accessible advanced-filter state'],
  [stylesSource, 'phase-36-operations-streamlining-start', 'Phase 36 responsive styles'],
]

for (const [source, token, label] of requiredTokens) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const streamlinedBoards = [
  ['AdminWeekPlanner', 'updateAdminAttentionItem('],
  ['AdminCapacityCenter', 'updateAdminAttentionItem('],
  ['AdminClientMomentum', 'getAdminClientMomentum('],
  ['AdminClientCoverage', 'getAdminClientCoverage('],
  ['AdminSessionReadiness', 'getAdminSessionReadiness('],
  ['AdminSessionFollowThrough', 'getAdminSessionFollowThrough('],
  ['AdminAttentionQueue', 'updateAdminAttentionItem('],
  ['AdminActivityCenter', 'getAdminNotifications('],
]

for (const [page, preservedAction] of streamlinedBoards) {
  const source = readFileSync(`src/pages/admin/${page}.jsx`, 'utf8')
  if (!source.includes('AdminAdvancedFilterToggle')) {
    failures.push(`${page} does not use the shared advanced-filter disclosure`)
  }
  if (!source.includes('pwc-ops36-filters')) {
    failures.push(`${page} does not expose the compact Phase 36 filter layout`)
  }
  if (!source.includes('const [filtersOpen, setFiltersOpen] = useState(false)')) {
    failures.push(`${page} does not start with advanced filters collapsed`)
  }
  if (!source.includes(preservedAction)) {
    failures.push(`${page} no longer preserves its core backend action: ${preservedAction}`)
  }
}

const activitySource = readFileSync('src/pages/admin/AdminActivityCenter.jsx', 'utf8')
for (const action of [
  'markAdminNotificationRead(',
  'markAllAdminNotificationsRead(',
  'dismissAdminNotification(',
  'clearReadAdminNotifications(',
]) {
  if (!activitySource.includes(action)) failures.push(`Studio Activity no longer preserves ${action}`)
}

if (!packageSource.includes('node scripts/check-admin-phase36-operations-workflows.mjs')) {
  failures.push('package.json does not run the Phase 36 Operations workflow audit')
}

if (failures.length) {
  console.error('\nAdmin Phase 36 Operations workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Admin Phase 36 Operations workflow audit passed (one Operations entry, four outcome lanes, role-aware access, compact filters, and preserved backend actions).',
)
