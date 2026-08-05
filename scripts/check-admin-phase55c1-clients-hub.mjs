import { readFileSync } from 'node:fs'

import {
  studioGroups,
  workspacePrimaryItems,
} from '../src/components/admin/adminNavigation.js'

const read = (path) => readFileSync(path, 'utf8')
  .replace(/\r\n?/g, '\n')

const appSource = read('src/App.jsx')
const hubSource = read(
  'src/pages/admin/AdminClientsHub.jsx',
)
const directorySource = read(
  'src/pages/admin/AdminClients.jsx',
)
const preloaderSource = read(
  'src/components/admin/adminRoutePreloaders.js',
)
const stylesheetSource = read(
  'src/pages/admin/AdminFreshUI.css',
)
const packageSource = read('package.json')
const failures = []

const hubTokens = [
  "const AdminClientsDirectory = lazy(",
  "() => import('./AdminClients.jsx')",
  "() => import('./AdminClientMomentum.jsx')",
  "() => import('./AdminClientCoverage.jsx')",
  "id: 'directory'",
  "id: 'momentum'",
  "id: 'coverage'",
  "to: '/admin/clients?view=momentum'",
  "to: '/admin/clients?view=coverage'",
  '<AdminClientsDirectory embedded />',
  '<AdminClientMomentum embedded />',
  '<AdminClientCoverage embedded />',
  'role="tablist"',
  'role="tabpanel"',
  "navigate('/admin/attention')",
]

for (const token of hubTokens) {
  if (!hubSource.includes(token)) {
    failures.push(
      `Clients Hub is missing: ${token}`,
    )
  }
}

const directoryTokens = [
  'export default function AdminClients({ embedded = false })',
  'const content = (',
  'return embedded ? content : <AdminFrame>{content}</AdminFrame>',
  '<p className="admin-eyebrow">Clients</p>',
  '<h1>Clients</h1>',
]

for (const token of directoryTokens) {
  if (!directorySource.includes(token)) {
    failures.push(
      `Clients directory is missing: ${token}`,
    )
  }
}

if (
  !preloaderSource.includes(
    "loadAdminClients = cached(() => import('../../pages/admin/AdminClientsHub.jsx'))",
  )
) {
  failures.push(
    'The Clients route does not load AdminClientsHub.',
  )
}

const discoverablePaths = studioGroups.flatMap(
  (group) => group.items.map((item) => item.to),
)

for (const retiredPath of [
  '/admin/momentum',
  '/admin/coverage',
]) {
  if (discoverablePaths.includes(retiredPath)) {
    failures.push(
      `${retiredPath} remains duplicated in More or Quick Find.`,
    )
  }
}

const clientsPrimary = workspacePrimaryItems.studio.find(
  (item) => item.to === '/admin/clients',
)

for (const legacyPath of [
  '/admin/momentum',
  '/admin/coverage',
]) {
  if (!clientsPrimary?.match?.includes(legacyPath)) {
    failures.push(
      `Clients primary navigation does not match legacy route: ${legacyPath}`,
    )
  }
}

const legacyRouteTokens = [
  '<Route path="/admin/momentum"',
  '<Route path="/admin/coverage"',
  'const AdminClientMomentum = lazy(loadAdminClientMomentum)',
  'const AdminClientCoverage = lazy(loadAdminClientCoverage)',
]

for (const token of legacyRouteTokens) {
  if (!appSource.includes(token)) {
    failures.push(
      `A legacy client-care route was not preserved: ${token}`,
    )
  }
}

const styleTokens = [
  'phase-55c1a-clients-hub-start',
  '.pwc-clients55-hub',
  '.pwc-clients55-switcher',
  '.pwc-clients55-tabs',
  '.pwc-clients55-priorities',
  '.pwc-clients55-panel',
  '.pwc-clients55-loading',
  'phase-55c1a-clients-hub-end',
]

for (const token of styleTokens) {
  if (!stylesheetSource.includes(token)) {
    failures.push(
      `Clients Hub styling is missing: ${token}`,
    )
  }
}

if (
  !packageSource.includes(
    'node scripts/check-admin-phase55c1-clients-hub.mjs',
  )
) {
  failures.push(
    'package.json does not run the Phase 55C.1A audit.',
  )
}

if (failures.length) {
  console.error(
    '\nAdmin Phase 55C.1A Clients Hub audit failed:\n',
  )

  for (const failure of failures) {
    console.error(`- ${failure}`)
  }

  process.exit(1)
}

console.log(
  `Admin Phase 55C.1A Clients Hub audit passed (three unified client views, ${discoverablePaths.length} remaining specialist destinations, deferred view loading, embedded directory support, preserved legacy routes, and Clients-active route matching).`,
)
