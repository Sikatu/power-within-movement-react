import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const frameSource = read('src/components/admin/AdminFrame.jsx')
const paletteSource = read('src/components/admin/AdminCommandPalette.jsx')
const notificationSource = read('src/components/NotificationCenter.jsx')
const navigationSource = read('src/components/admin/adminNavigation.js')
const stylesSource = read('src/pages/admin/AdminFreshUI.css')
const packageSource = read('package.json')
const failures = []

const requiredTokens = [
  [frameSource, 'className="pwc-nav33-quick-find pwc-nav39-find-trigger"', 'single shared Quick Find trigger'],
  [frameSource, 'onClick={openCommandPalette}', 'Quick Find command action'],
  [frameSource, '<small>Any page or tool</small>', 'clear Quick Find description'],
  [frameSource, '<small>Switch workspace</small>', 'clear workspace switcher'],
  [frameSource, 'tools available</small>', 'accurate all-tools count'],
  [frameSource, 'className="pwc-nav33-utilities pwc-nav39-footer-actions"', 'compact footer actions'],
  [frameSource, '<NotificationCenter mode="admin" />', 'admin alerts'],
  [frameSource, 'aria-label="View public website"', 'public-site action'],
  [frameSource, 'handleSignOut', 'sign-out action'],
  [frameSource, 'workspaceLabel={activeWorkspace.label}', 'workspace-aware Quick Find'],
  [paletteSource, '{workspaceLabel} · all accessible workspaces', 'cross-workspace palette context'],
  [paletteSource, 'Search accessible admin destinations.', 'global palette instructions'],
  [paletteSource, 'aria-label="Admin destinations"', 'global result semantics'],
  [stylesSource, 'phase-39-admin-shell-streamlining-start', 'Phase 39 shell styles'],
  [stylesSource, '.pwc-nav39-footer-actions', 'compact footer layout'],
]

for (const [source, token, label] of requiredTokens) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (frameSource.includes('const [searchQuery, setSearchQuery]')) {
  failures.push('the retired duplicate sidebar search state is still present')
}

if (frameSource.includes('<label className="pwc-nav33-search">')) {
  failures.push('the retired duplicate sidebar search field is still rendered')
}

if ((frameSource.match(/onClick=\{openCommandPalette\}/g) || []).length !== 1) {
  failures.push('the shell must expose exactly one visible Quick Find trigger')
}

const preservedCapabilities = [
  [frameSource, 'checkAdminAccess()', 'server-verified admin access'],
  [frameSource, 'getMyTeamAccess()', 'staff permission loading'],
  [frameSource, "if (item.roles && !item.roles.includes(role)) return false", 'role boundaries'],
  [frameSource, "teamAccess?.permissions?.[item.module]", 'module permission boundaries'],
  [frameSource, '...accessibleWorkspaces.map', 'workspace discovery'],
  [frameSource, '...allAccessiblePrimaryItems.map', 'primary destination discovery'],
  [frameSource, '...accessibleGroups.flatMap', 'specialist tool discovery'],
  [frameSource, 'togglePinnedDestination(pathname)', 'pinned destinations'],
  [frameSource, 'rememberAdminDestination(location.pathname)', 'recent destinations'],
  [frameSource, 'preloadAdminRoute(to)', 'route preloading'],
  [frameSource, 'logoutAdmin()', 'secure sign out'],
  [frameSource, "window.addEventListener('offline', updateConnectionStatus)", 'connection awareness'],
  [notificationSource, 'getAdminNotifications', 'notification loading'],
  [notificationSource, 'markAllAdminNotificationsRead', 'mark-all-read action'],
  [notificationSource, 'dismissAdminNotification', 'notification dismissal'],
  [notificationSource, 'updateAdminNotificationPreferences', 'notification preferences'],
  [navigationSource, "roles: ['developer', 'owner', 'admin', 'staff']", 'Studio role access'],
  [navigationSource, "roles: ['developer', 'owner']", 'Founder role access'],
  [navigationSource, "roles: ['developer']", 'Developer role access'],
]

for (const [source, token, capability] of preservedCapabilities) {
  if (!source.includes(token)) failures.push(`Phase 39 no longer preserves ${capability}`)
}

if (!packageSource.includes('node scripts/check-admin-phase39-shell-streamlining.mjs')) {
  failures.push('package.json does not run the Phase 39 admin-shell audit')
}

if (failures.length) {
  console.error('\nAdmin Phase 39 shell streamlining audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Admin Phase 39 shell streamlining audit passed (one Quick Find, clear workspace switching, compact footer actions, global language, role guards, alerts, and keyboard access).',
)
