import { readFileSync } from 'node:fs'

import {
  studioGroups,
  workspaceDefinitions,
  workspaceForPath,
  workspacePrimaryItems,
} from '../src/components/admin/adminNavigation.js'

const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const appSource = readFileSync('src/App.jsx', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')
const failures = []

const expectedWorkspaces = ['studio', 'founder', 'developer']
const workspaceIds = workspaceDefinitions.map((workspace) => workspace.id)

for (const workspaceId of expectedWorkspaces) {
  if (!workspaceIds.includes(workspaceId)) {
    failures.push(`missing workspace definition: ${workspaceId}`)
  }
  if (!Array.isArray(workspacePrimaryItems[workspaceId])) {
    failures.push(`missing primary navigation for workspace: ${workspaceId}`)
  }
}

if (workspaceForPath('/admin/dashboard') !== 'studio') {
  failures.push('dashboard is not mapped to The Studio')
}
if (workspaceForPath('/admin/founders-calendar') !== 'founder') {
  failures.push('Founder calendar is not mapped to Founder’s View')
}
if (workspaceForPath('/admin/developer/errors') !== 'developer') {
  failures.push('Error Center is not mapped to Developer Operations')
}
if (workspaceForPath('/admin/team') !== 'developer') {
  failures.push('Staff & Team is not mapped to Developer Operations')
}

const studioPrimaryPaths = workspacePrimaryItems.studio.map((item) => item.to)
const expectedDailyPaths = [
  '/admin/dashboard',
  '/admin/clients',
  '/admin/scheduler',
  '/admin/inbox',
]

if (JSON.stringify(studioPrimaryPaths) !== JSON.stringify(expectedDailyPaths)) {
  failures.push('The Studio daily navigation is not limited to Overview, Clients, Sessions, and Inbox')
}

const founderPaths = workspacePrimaryItems.founder.map((item) => item.to)
for (const path of ['/admin/founders-view', '/admin/founders-calendar', '/admin/founders-availability']) {
  if (!founderPaths.includes(path)) failures.push(`Founder navigation is missing: ${path}`)
}
if (workspacePrimaryItems.founder.some((item) => !item.roles?.includes('owner') || item.roles.includes('admin'))) {
  failures.push('Founder navigation role boundaries are not owner/developer only')
}

const developerPaths = workspacePrimaryItems.developer.map((item) => item.to)
for (const path of ['/admin/developer', '/admin/developer/errors', '/admin/developer/integrity', '/admin/developer/qa', '/admin/team']) {
  if (!developerPaths.includes(path)) failures.push(`Developer navigation is missing: ${path}`)
}
if (workspacePrimaryItems.developer.some((item) => !item.developerOnly || item.roles?.some((role) => role !== 'developer'))) {
  failures.push('Developer navigation contains a non-developer destination')
}

const studioToolPaths = studioGroups.flatMap((group) => group.items.map((item) => item.to))
if (studioToolPaths.some((path) => path.startsWith('/admin/developer') || path.startsWith('/admin/founders') || path === '/admin/team')) {
  failures.push('The Studio all-tools directory leaks Founder or Developer destinations')
}

const frameTokens = [
  'const [allToolsOpen, setAllToolsOpen] = useState(false)',
  'const currentStudioTool = useMemo',
  'activeWorkspace.id === \'studio\'',
  'aria-controls="pwc-stream31-all-tools"',
  'hidden={!allToolsOpen}',
  "setAllToolsOpen(false)",
  'to={activeWorkspace.to}',
  '<strong>{activeWorkspace.label}</strong>',
  '...allAccessiblePrimaryItems.map',
]

for (const token of frameTokens) {
  if (!frameSource.includes(token)) failures.push(`AdminFrame is missing streamlining safeguard: ${token}`)
}

const stylesheetSelectors = [
  '.pwc-stream31-nav-heading',
  '.pwc-stream31-current',
  '.pwc-stream31-tools-toggle',
  '.pwc-stream31-all-tools[hidden]',
]

for (const selector of stylesheetSelectors) {
  if (!stylesheet.includes(selector)) failures.push(`AdminFreshUI.css is missing: ${selector}`)
}

const guardTokens = [
  '<AdminRouteGuard><AdminDashboard /></AdminRouteGuard>',
  '<AdminOwnerRouteGuard><AdminFoundersView /></AdminOwnerRouteGuard>',
  '<AdminOwnerRouteGuard><AdminFounderCalendar /></AdminOwnerRouteGuard>',
  '<AdminOwnerRouteGuard><AdminFounderAvailability /></AdminOwnerRouteGuard>',
  '<AdminDeveloperRouteGuard><AdminDeveloperOperations /></AdminDeveloperRouteGuard>',
  '<AdminDeveloperRouteGuard><AdminTeamManagement /></AdminDeveloperRouteGuard>',
]

for (const token of guardTokens) {
  if (!appSource.includes(token)) failures.push(`App route guard changed or is missing: ${token}`)
}

if (!packageSource.includes('node scripts/check-admin-phase31-streamlining.mjs')) {
  failures.push('package.json does not run the Phase 31 streamlining audit')
}

if (failures.length) {
  console.error('\nAdmin Phase 31 streamlining audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Phase 31 streamlining audit passed (${workspaceDefinitions.length} contextual workspaces, ${expectedDailyPaths.length} daily destinations, ${studioToolPaths.length} on-demand Studio tools, and preserved role guards).`,
)
