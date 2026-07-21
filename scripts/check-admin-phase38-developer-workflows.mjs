import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const navigationSource = read('src/components/admin/adminNavigation.js')
const frameSource = read('src/components/admin/AdminFrame.jsx')
const operationsSource = read('src/pages/admin/AdminDeveloperOperations.jsx')
const panelSource = read('src/pages/admin/AdminDeveloperPanel.jsx')
const errorsSource = read('src/pages/admin/AdminDeveloperErrors.jsx')
const integritySource = read('src/pages/admin/AdminSecurityIntegrity.jsx')
const releaseSource = read('src/pages/admin/AdminReleaseQa.jsx')
const teamSource = read('src/pages/admin/AdminTeamManagement.jsx')
const stylesSource = read('src/pages/admin/AdminFreshUI.css')
const packageSource = read('package.json')
const failures = []

const requiredTokens = [
  [navigationSource, "label: 'Command Center'", 'single Developer command-center entry'],
  [navigationSource, "label: 'Error Center'", 'searchable Error Center destination'],
  [navigationSource, "icon: 'errors',\n      hiddenInSidebar: true", 'hidden Error Center sidebar entry'],
  [navigationSource, "icon: 'security',\n      hiddenInSidebar: true", 'hidden Integrity sidebar entry'],
  [navigationSource, "icon: 'release',\n      hiddenInSidebar: true", 'hidden Release sidebar entry'],
  [frameSource, 'accessiblePrimaryItems.filter((item) => !item.hiddenInSidebar)', 'compact primary navigation'],
  [operationsSource, 'const workflows = [', 'Developer workflow model'],
  [operationsSource, "label: 'Monitor'", 'Monitor mode'],
  [operationsSource, "sections: ['overview', 'health', 'errors']", 'Monitor views'],
  [operationsSource, "label: 'Protect'", 'Protect mode'],
  [operationsSource, "sections: ['integrity', 'access']", 'Protect views'],
  [operationsSource, "label: 'Release'", 'Release mode'],
  [operationsSource, "label: 'Configure'", 'Configure mode'],
  [operationsSource, 'aria-label="Developer Operations sections"', 'accessible Developer mode switch'],
  [operationsSource, 'aria-label={`${activeWorkflow.label} views`}', 'focused secondary views'],
  [operationsSource, "if (pathname.endsWith('/errors')) return 'errors'", 'legacy Error Center routing'],
  [operationsSource, "if (pathname.endsWith('/integrity')) return 'integrity'", 'legacy Integrity routing'],
  [operationsSource, "if (pathname.endsWith('/qa')) return 'qa'", 'legacy Release routing'],
  [teamSource, "const [workspaceMode, setWorkspaceMode] = useState('profile')", 'profile-first team editing'],
  [teamSource, 'aria-label="Team member sections"', 'accessible team section switch'],
  [teamSource, "['permissions', 'Permissions', 'Studio role boundaries']", 'focused permissions editor'],
  [teamSource, "['assignments', 'Client assignments'", 'focused client assignments'],
  [teamSource, "hidden={workspaceMode !== 'profile'}", 'focused profile surface'],
  [teamSource, "hidden={workspaceMode !== 'permissions'}", 'focused permission surface'],
  [teamSource, "hidden={workspaceMode !== 'assignments'}", 'focused assignment surface'],
  [stylesSource, 'phase-38-developer-workflow-streamlining-start', 'Phase 38 responsive styles'],
]

for (const [source, token, label] of requiredTokens) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const preservedCapabilities = [
  [operationsSource, '<AdminDeveloperPanel embedded mode="health" />', 'system health'],
  [operationsSource, '<AdminDeveloperErrors embedded />', 'error triage'],
  [operationsSource, '<AdminSecurityIntegrity embedded />', 'security integrity'],
  [operationsSource, '<AdminReleaseQa embedded />', 'release readiness'],
  [operationsSource, '<AdminDeveloperPanel embedded mode="access" />', 'accounts and access'],
  [operationsSource, '<AdminDeveloperMonitoringConfiguration />', 'monitoring configuration'],
  [panelSource, 'getDeveloperOverview(', 'Developer overview loading'],
  [errorsSource, 'updateDeveloperErrorStatus(', 'error status updates'],
  [integritySource, 'getDeveloperSecurityIntegrity(', 'integrity checks'],
  [releaseSource, 'apiRequest(check.endpoint)', 'release QA checks'],
  [teamSource, 'getDeveloperTeamManagement(', 'team directory loading'],
  [teamSource, 'updateDeveloperTeamMember(', 'team profile and permission updates'],
  [teamSource, 'updateDeveloperTeamAssignments(', 'client assignment updates'],
  [teamSource, 'selectedMember.permissionsLocked', 'permanent account permission lock'],
]

for (const [source, token, capability] of preservedCapabilities) {
  if (!source.includes(token)) failures.push(`Phase 38 no longer preserves ${capability}`)
}

if (!packageSource.includes('node scripts/check-admin-phase38-developer-workflows.mjs')) {
  failures.push('package.json does not run the Phase 38 Developer workflow audit')
}

if (failures.length) {
  console.error('\nAdmin Phase 38 Developer workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Admin Phase 38 Developer workflow audit passed (two sidebar entries, four technical modes, focused team editing, legacy routes, permission locks, and preserved protected actions).',
)
