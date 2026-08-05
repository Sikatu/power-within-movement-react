import { readFileSync } from 'node:fs'

import {
  studioGroups,
  workspacePrimaryItems,
} from '../src/components/admin/adminNavigation.js'

const read = (path) => readFileSync(path, 'utf8')
  .replace(/\r\n?/g, '\n')

const frameSource = read(
  'src/components/admin/AdminFrame.jsx',
)

const paletteSource = read(
  'src/components/admin/AdminCommandPalette.jsx',
)

const appSource = read('src/App.jsx')

const guidanceSource = read(
  'src/components/admin/adminPageGuidance.js',
)

const packageSource = read('package.json')
const failures = []

const expectedPrimary = [
  {
    to: '/admin/dashboard',
    label: 'Today',
  },
  {
    to: '/admin/clients',
    label: 'Clients',
  },
  {
    to: '/admin/scheduler',
    label: 'Sessions',
  },
  {
    to: '/admin/inbox',
    label: 'Messages',
  },
]

const actualPrimary = workspacePrimaryItems.studio.map(
  ({ to, label }) => ({ to, label }),
)

if (
  JSON.stringify(actualPrimary)
  !== JSON.stringify(expectedPrimary)
) {
  failures.push(
    'The Studio primary navigation is not Today, Clients, Sessions, and Messages.',
  )
}

const expectedGroups = [
  'growth',
  'programs',
  'messages',
  'operations',
  'settings',
]

const actualGroups = studioGroups.map((group) => group.id)

if (
  JSON.stringify(actualGroups)
  !== JSON.stringify(expectedGroups)
) {
  failures.push(
    'The More directory is not grouped into Growth, Programs, Messages, Operations, and Settings.',
  )
}

const expectedToolPaths = [
  '/admin/leads',
  '/admin/onboarding',
  '/admin/automations',
  '/admin/courses',
  '/admin/assets',
  '/admin/memberships',
  '/admin/circle',
  '/admin/encouragements',
  '/admin/letters',
  '/admin/audience',
  '/admin/operations',
  '/admin/week',
  '/admin/capacity',
  '/admin/attention',
  '/admin/readiness',
  '/admin/follow-through',
  '/admin/session-changes',
  '/admin/activity',
  '/admin/audit-log',
  '/admin/studio-profile',
]

const actualToolPaths = studioGroups.flatMap(
  (group) => group.items.map((item) => item.to),
)

const uniqueToolPaths = new Set(actualToolPaths)

if (uniqueToolPaths.size !== actualToolPaths.length) {
  failures.push(
    'The More directory contains duplicate destinations.',
  )
}

for (const path of expectedToolPaths) {
  if (!uniqueToolPaths.has(path)) {
    failures.push(
      `The More directory lost an existing destination: ${path}`,
    )
  }
}

if (actualToolPaths.length !== expectedToolPaths.length) {
  failures.push(
    `Expected ${expectedToolPaths.length} specialist destinations but found ${actualToolPaths.length}.`,
  )
}

const frameTokens = [
  "{activeWorkspace.id === 'studio' ? 'Main' : 'Workspace tools'}",
  "<strong>{allToolsOpen ? 'Hide More' : 'More'}</strong>",
  'specialized tools available</small>',
  'aria-controls="pwc-stream31-all-tools"',
  'hidden={!allToolsOpen}',
  'const currentStudioTool = useMemo',
  'pinnedPaths={pinnedPaths}',
  'onTogglePinned={handleTogglePinned}',
]

for (const token of frameTokens) {
  if (!frameSource.includes(token)) {
    failures.push(
      `AdminFrame is missing Phase 55B.1 token: ${token}`,
    )
  }
}

const retiredFrameTokens = [
  'className="pwc-nav33-pinned"',
  'className="pwc-stream31-current"',
  'Browse all tools',
  'Daily work',
]

for (const token of retiredFrameTokens) {
  if (frameSource.includes(token)) {
    failures.push(
      `Retired sidebar complexity remains visible: ${token}`,
    )
  }
}

const paletteTokens = [
  'const pinnedItems = pinnedPaths',
  'onTogglePinned,',
  "event.altKey && event.key.toLowerCase() === 'p'",
]

for (const token of paletteTokens) {
  if (!paletteSource.includes(token)) {
    failures.push(
      `Quick Find lost preserved pinning capability: ${token}`,
    )
  }
}

const metadataTokens = [
  "title: 'Today | The Studio'",
  "title: 'Messages | The Studio'",
]

for (const token of metadataTokens) {
  if (!appSource.includes(token)) {
    failures.push(
      `Admin route metadata is missing: ${token}`,
    )
  }
}

const guidanceTokens = [
  'Start with Today instead of opening every tool.',
  'Return to Today after the task',
  'Open Messages and use the attention filters',
]

for (const token of guidanceTokens) {
  if (!guidanceSource.includes(token)) {
    failures.push(
      `Admin guidance is missing: ${token}`,
    )
  }
}

if (
  !packageSource.includes(
    'node scripts/check-admin-phase55b1-navigation.mjs',
  )
) {
  failures.push(
    'package.json does not run the Phase 55B.1 navigation audit.',
  )
}

if (failures.length) {
  console.error(
    '\nAdmin Phase 55B.1 navigation audit failed:\n',
  )

  for (const failure of failures) {
    console.error(`- ${failure}`)
  }

  process.exit(1)
}

console.log(
  `Admin Phase 55B.1 navigation audit passed (4 primary destinations, one progressive More directory, ${actualToolPaths.length} discoverable specialist tools, command-only pinning, unchanged paths, and simplified user language).`,
)
