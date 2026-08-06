import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const app = read('src/App.jsx')
const studioApp = read('src/studio/StudioApp.jsx')
const shell = read('src/studio/StudioShell.jsx')
const navigation = read('src/studio/studioNavigation.js')
const css = read('src/studio/studio.css')

assert(
  app.includes("const StudioApp = lazy(() => import('./studio/StudioApp.jsx'))"),
  'App.jsx must lazy-load the isolated New Studio application.',
)

assert(
  app.includes('path="/studio/*"')
    && app.includes('<AdminRouteGuard><StudioApp /></AdminRouteGuard>'),
  'The /studio route must remain protected by AdminRouteGuard.',
)

assert(
  app.includes("pathname.startsWith('/studio')"),
  'Public navigation and footer must remain hidden on New Studio routes.',
)

for (const route of [
  '/studio/today',
  '/studio/pipeline',
  '/studio/clients',
  '/studio/sessions',
  '/studio/inbox',
  '/studio/more',
]) {
  assert(
    app.includes(`'${route}'`) || studioApp.includes(route.replace('/studio/', 'path="')),
    `Missing New Studio route contract: ${route}`,
  )
}

for (const label of [
  'Today',
  'Pipeline',
  'Clients',
  'Sessions',
  'Inbox',
  'More',
]) {
  assert(
    navigation.includes(`label: '${label}'`),
    `Missing primary New Studio navigation item: ${label}`,
  )
}

assert(
  !shell.includes('AdminFrame')
    && !shell.includes('AdminFreshUI.css')
    && !css.includes('.admin-'),
  'The New Studio must remain isolated from AdminFrame and AdminFreshUI.css.',
)

for (const legacyRoute of [
  '/admin/dashboard',
  '/admin/leads',
  '/admin/clients',
  '/admin/scheduler',
  '/admin/inbox',
]) {
  assert(
    app.includes(legacyRoute) || navigation.includes(legacyRoute),
    `Legacy Studio compatibility route was lost: ${legacyRoute}`,
  )
}

assert(
  navigation.includes('New Inquiry')
    && navigation.includes('Consultation Completed')
    && navigation.includes('Service Recommended')
    && navigation.includes('Decision Pending')
    && navigation.includes('Converted'),
  'The approved lead pipeline contract is incomplete.',
)

assert(
  navigation.includes('Onboarding')
    && navigation.includes('Active Service')
    && navigation.includes('Ongoing Care')
    && navigation.includes('Alumni / Referral'),
  'The approved client lifecycle contract is incomplete.',
)

assert(
  css.includes('@media (max-width: 820px)')
    && css.includes('@media (prefers-reduced-motion: reduce)'),
  'The Studio foundation must include mobile and reduced-motion safeguards.',
)

console.log(
  'Phase 56B Studio foundation audit passed '
  + '(protected route, isolated shell, six destinations, approved workflows, '
  + 'Legacy Studio compatibility, mobile behavior, and reduced motion).',
)