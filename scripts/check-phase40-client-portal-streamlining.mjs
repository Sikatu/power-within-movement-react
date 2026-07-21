import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const chromeSource = read('src/components/ClientPortalChrome.jsx')
const chromeStyles = read('src/components/ClientPortalChrome.css')
const dashboardSource = read('src/pages/ClientPortalDashboard.jsx')
const dashboardStyles = read('src/pages/ClientPortalDashboard.css')
const appSource = read('src/App.jsx')
const packageSource = read('package.json')
const failures = []

const requiredTokens = [
  [chromeSource, 'const primaryPortalLinks = [', 'focused primary navigation'],
  [chromeSource, "['/client-portal/home', 'Today']", 'Today-first portal home'],
  [chromeSource, "['/client-portal/resources', 'Library']", 'client-friendly Library label'],
  [chromeSource, 'const explorePortalLinks = [', 'progressive Explore menu'],
  [chromeSource, "['/client-portal/learning', 'Learning']", 'Learning access'],
  [chromeSource, "['/client-portal/membership', 'Membership']", 'Membership access'],
  [chromeSource, "['/client-portal/circle', 'The Circle']", 'Circle access'],
  [chromeSource, 'aria-haspopup="menu"', 'accessible Explore trigger'],
  [chromeSource, 'aria-expanded={exploreOpen}', 'Explore open state'],
  [chromeSource, 'role="menu"', 'Explore menu semantics'],
  [chromeSource, "event.key === 'Escape'", 'Escape dismissal'],
  [chromeSource, "document.addEventListener('pointerdown', closeExplore)", 'outside-click dismissal'],
  [dashboardSource, '<p className="eyebrow">Today in Your Portal</p>', 'Today-first dashboard'],
  [dashboardSource, 'const focusAction = nextBooking', 'contextual primary action'],
  [dashboardSource, 'const shortcuts = [', 'four focused portal shortcuts'],
  [dashboardSource, 'aria-label="Portal shortcuts"', 'accessible shortcuts'],
  [dashboardSource, '<details className="client-dashboard-more">', 'progressive dashboard detail'],
  [dashboardSource, '<strong>More from your portal</strong>', 'clear detail disclosure'],
  [chromeStyles, 'phase-40-client-portal-streamlining-start', 'responsive portal chrome styles'],
  [dashboardStyles, 'phase-40-client-dashboard-streamlining-start', 'responsive dashboard styles'],
]

for (const [source, token, label] of requiredTokens) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const primaryBlock = chromeSource.match(/const primaryPortalLinks = \[([\s\S]*?)\n\]/)?.[1] || ''
const exploreBlock = chromeSource.match(/const explorePortalLinks = \[([\s\S]*?)\n\]/)?.[1] || ''
if ((primaryBlock.match(/\['\/client-portal\//g) || []).length !== 5) {
  failures.push('client portal primary navigation must contain exactly five destinations')
}
if ((exploreBlock.match(/\['\/client-portal\//g) || []).length !== 3) {
  failures.push('client portal Explore menu must contain exactly three destinations')
}

const portalRoutes = [
  '/client-portal/home',
  '/client-portal/journey',
  '/client-portal/resources',
  '/client-portal/learning',
  '/client-portal/membership',
  '/client-portal/circle',
  '/client-portal/sessions',
  '/client-portal/messages',
]

for (const route of portalRoutes) {
  if (!appSource.includes(`<Route path="${route}"`)) {
    failures.push(`authenticated client portal route changed or is missing: ${route}`)
  }
}

const preservedCapabilities = [
  [dashboardSource, 'getClientPortalDashboard()', 'private dashboard loading'],
  [dashboardSource, 'getClientPortalResources()', 'private resource loading'],
  [dashboardSource, 'logoutClientPortal()', 'secure client sign out'],
  [dashboardSource, "navigate('/client-portal/login', { replace: true })", 'expired-session recovery'],
  [dashboardSource, "['http:', 'https:'].includes(url.protocol)", 'safe external resource links'],
  [dashboardSource, 'dashboard?.visibleNotes || []', 'client-visible notes'],
  [dashboardSource, 'dashboard?.followUps || []', 'care follow-ups'],
  [dashboardSource, 'dashboard?.serviceRecords || []', 'service history'],
  [dashboardSource, 'dashboard?.bookings || []', 'session history'],
  [chromeSource, 'messageCount > 0', 'unread message count'],
  [chromeSource, 'disabled={loggingOut}', 'guarded sign out'],
]

for (const [source, token, capability] of preservedCapabilities) {
  if (!source.includes(token)) failures.push(`Phase 40 no longer preserves ${capability}`)
}

if (!packageSource.includes('node scripts/check-phase40-client-portal-streamlining.mjs')) {
  failures.push('package.json does not run the Phase 40 client-portal audit')
}

if (failures.length) {
  console.error('\nPhase 40 client portal streamlining audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Phase 40 client portal streamlining audit passed (five primary destinations, three progressive Explore destinations, Today-first home, contextual actions, preserved private data, and responsive navigation).',
)
