import { readFileSync } from 'node:fs'

import {
  studioGroups,
  workspacePrimaryItems,
} from '../src/components/admin/adminNavigation.js'

const read = (path) =>
  readFileSync(path, 'utf8')
    .replace(/\r\n?/g, '\n')

const appSource = read('src/App.jsx')
const frameSource = read('src/components/admin/AdminFrame.jsx')
const navigationSource = read('src/components/admin/adminNavigation.js')
const switcherSource = read('src/components/admin/AdminMessagesSwitcher.jsx')
const stylesSource = read('src/pages/admin/AdminFreshUI.css')
const packageSource = read('package.json')

const pages = [
  read('src/pages/admin/AdminInbox.jsx'),
  read('src/pages/admin/AdminEncouragements.jsx'),
  read('src/pages/admin/AdminMailStudio.jsx'),
  read('src/pages/admin/AdminLetters.jsx'),
  read('src/pages/admin/AdminAudience.jsx'),
]

const failures = []

const switcherTokens = [
  "to: '/admin/inbox'",
  "to: '/admin/encouragements'",
  "to: '/admin/email-studio'",
  "to: '/admin/letters'",
  "to: '/admin/audience'",
  "label: 'Conversations'",
  "label: 'Encouragements'",
  "label: 'Email Studio'",
  "label: 'Letters'",
  "label: 'Audience'",
  'getMyTeamAccess',
  'accessibleViews',
  'role="tablist"',
  'role="tab"',
]

for (const token of switcherTokens) {
  if (!switcherSource.includes(token)) {
    failures.push('Messages switcher is missing: ' + token)
  }
}

for (const [index, pageSource] of pages.entries()) {
  if (
    !pageSource.includes(
      "import AdminMessagesSwitcher from '../../components/admin/AdminMessagesSwitcher.jsx'",
    )
    || !pageSource.includes('<AdminMessagesSwitcher />')
  ) {
    failures.push(
      'Messages workspace page '
      + (index + 1)
      + ' does not mount the shared switcher.',
    )
  }
}

const messageGroup = studioGroups.find(
  (group) => group.id === 'messages',
)

if (messageGroup) {
  failures.push(
    'The retired Message Tools group remains in More.',
  )
}

const messagesPrimary = workspacePrimaryItems.studio.find(
  (item) => item.to === '/admin/inbox',
)

for (const path of [
  '/admin/encouragements',
  '/admin/email-studio',
  '/admin/letters',
  '/admin/audience',
]) {
  if (!messagesPrimary?.match?.includes(path)) {
    failures.push(
      'Messages primary navigation does not match ' + path,
    )
  }
}

for (const module of [
  'inbox',
  'encouragements',
  'communications',
]) {
  if (!messagesPrimary?.modules?.includes(module)) {
    failures.push(
      'Messages primary navigation lost the '
      + module
      + ' permission.',
    )
  }
}

if (
  !frameSource.includes('if (item.modules?.length)')
  || !frameSource.includes('item.modules.some((module)')
) {
  failures.push(
    'AdminFrame does not support multi-module Messages access.',
  )
}

for (const route of [
  '/admin/inbox',
  '/admin/encouragements',
  '/admin/email-studio',
  '/admin/letters',
  '/admin/audience',
]) {
  if (!appSource.includes('<Route path="' + route + '"')) {
    failures.push('Legacy Messages route is missing: ' + route)
  }
}

for (const token of [
  'phase-55c3a-messages-hub-start',
  '.pwc-messages55-switcher',
  '.pwc-messages55-tabs',
  '.pwc-messages55-access',
  'phase-55c3a-messages-hub-end',
]) {
  if (!stylesSource.includes(token)) {
    failures.push('Messages styling is missing: ' + token)
  }
}

if (navigationSource.includes("id: 'messages'")) {
  failures.push(
    'adminNavigation still exposes a duplicate Message Tools group.',
  )
}

if (
  !packageSource.includes(
    'node scripts/check-admin-phase55c3-messages-hub.mjs',
  )
) {
  failures.push(
    'package.json does not run the Phase 55C.3 audit.',
  )
}

if (failures.length) {
  console.error(
    '\nAdmin Phase 55C.3 Messages Hub audit failed:\n',
  )

  for (const failure of failures) {
    console.error('- ' + failure)
  }

  process.exit(1)
}

console.log(
  'Admin Phase 55C.3 Messages Hub audit passed (five unified communication views, one shared switcher, role-aware module access, preserved legacy routes, and no duplicate Message Tools navigation).',
)
