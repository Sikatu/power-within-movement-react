import { readFileSync } from 'node:fs'

import {
  studioGroups,
  workspacePrimaryItems,
} from '../src/components/admin/adminNavigation.js'

const read = (path) =>
  readFileSync(path, 'utf8')
    .replace(/\r\n?/g, '\n')

const appSource = read('src/App.jsx')
const hubSource = read(
  'src/pages/admin/AdminSessionsHub.jsx',
)
const schedulerSource = read(
  'src/pages/admin/AdminScheduler.jsx',
)
const changesSource = read(
  'src/pages/admin/AdminSessionChangeRequests.jsx',
)
const preloadSource = read(
  'src/components/admin/adminRoutePreloaders.js',
)
const stylesheetSource = read(
  'src/pages/admin/AdminFreshUI.css',
)
const packageSource = read('package.json')
const failures = []

const hubTokens = [
  "() => import('./AdminScheduler.jsx')",
  "() => import('./AdminSessionReadiness.jsx')",
  "() => import('./AdminSessionFollowThrough.jsx')",
  "() => import('./AdminSessionChangeRequests.jsx')",
  "id: 'manage'",
  "id: 'readiness'",
  "id: 'follow-through'",
  "id: 'changes'",
  "to: '/admin/scheduler?view=readiness'",
  "to: '/admin/scheduler?view=follow-through'",
  "to: '/admin/scheduler?view=changes'",
  '<AdminScheduler embedded />',
  '<AdminSessionReadiness embedded />',
  '<AdminSessionFollowThrough embedded />',
  '<AdminSessionChanges embedded />',
  'role="tablist"',
  'role="tabpanel"',
]

for (const token of hubTokens) {
  if (!hubSource.includes(token)) {
    failures.push(
      'Sessions Hub is missing: ' + token,
    )
  }
}

const embeddedTokens = [
  [
    schedulerSource,
    'function AdminScheduler({ embedded = false })',
    'Sessions management embedding',
  ],
  [
    schedulerSource,
    'return embedded',
    'Sessions management wrapper',
  ],
  [
    changesSource,
    'AdminSessionChangeRequests({ embedded = false })',
    'Session Changes embedding',
  ],
  [
    changesSource,
    'return embedded',
    'Session Changes wrapper',
  ],
]

for (
  const [
    source,
    token,
    label,
  ] of embeddedTokens
) {
  if (!source.includes(token)) {
    failures.push(
      label + ' is missing: ' + token,
    )
  }
}

const preloaderTokens = [
  "loadAdminScheduler = cached(() => import('../../pages/admin/AdminSessionsHub.jsx'))",
  "loadAdminSessionReadiness = cached(() => import('../../pages/admin/AdminSessionsHub.jsx'))",
  "loadAdminSessionFollowThrough = cached(() => import('../../pages/admin/AdminSessionsHub.jsx'))",
  "loadAdminSessionChangeRequests = cached(() => import('../../pages/admin/AdminSessionsHub.jsx'))",
]

for (const token of preloaderTokens) {
  if (!preloadSource.includes(token)) {
    failures.push(
      'Sessions Hub preloader is missing: ' + token,
    )
  }
}

const discoverablePaths =
  studioGroups.flatMap(
    (group) =>
      group.items.map((item) => item.to),
  )

for (const retiredPath of [
  '/admin/readiness',
  '/admin/follow-through',
  '/admin/session-changes',
]) {
  if (discoverablePaths.includes(retiredPath)) {
    failures.push(
      retiredPath
      + ' remains duplicated in More or Quick Find.',
    )
  }
}

const sessionsPrimary =
  workspacePrimaryItems.studio.find(
    (item) => item.to === '/admin/scheduler',
  )

for (const legacyPath of [
  '/admin/readiness',
  '/admin/follow-through',
  '/admin/session-changes',
]) {
  if (
    !sessionsPrimary?.match?.includes(
      legacyPath,
    )
  ) {
    failures.push(
      'Sessions navigation does not match '
      + legacyPath,
    )
  }
}

const legacyRouteTokens = [
  '<Route path="/admin/readiness"',
  '<Route path="/admin/follow-through"',
  '<Route path="/admin/session-changes"',
  'const AdminSessionReadiness = lazy(loadAdminSessionReadiness)',
  'const AdminSessionFollowThrough = lazy(loadAdminSessionFollowThrough)',
  'const AdminSessionChangeRequests = lazy(loadAdminSessionChangeRequests)',
]

for (const token of legacyRouteTokens) {
  if (!appSource.includes(token)) {
    failures.push(
      'A legacy Sessions route is missing: '
      + token,
    )
  }
}

const styleTokens = [
  'phase-55c2a-sessions-hub-start',
  '.pwc-sessions55-hub',
  '.pwc-sessions55-switcher',
  '.pwc-sessions55-tabs',
  '.pwc-sessions55-panel',
  '.pwc-sessions55-loading',
  'phase-55c2a-sessions-hub-end',
]

for (const token of styleTokens) {
  if (!stylesheetSource.includes(token)) {
    failures.push(
      'Sessions Hub styling is missing: '
      + token,
    )
  }
}

if (
  !packageSource.includes(
    'node scripts/check-admin-phase55c2-sessions-hub.mjs',
  )
) {
  failures.push(
    'package.json does not run the Phase 55C.2 audit.',
  )
}

if (failures.length) {
  console.error(
    '\nAdmin Phase 55C.2 Sessions Hub audit failed:\n',
  )

  for (const failure of failures) {
    console.error('- ' + failure)
  }

  process.exit(1)
}

console.log(
  'Admin Phase 55C.2 Sessions Hub audit passed (four unified session views, embedded management and change review, deferred specialist loading, preserved legacy routes, and Sessions-active route matching).',
)
