import { readFileSync } from 'node:fs'

const clients = readFileSync('src/pages/admin/AdminClients.jsx', 'utf8')
const tabs = readFileSync('src/components/admin/ClientProfileTabs.jsx', 'utf8')
const sections = readFileSync('src/components/admin/clientProfileSections.js', 'utf8')
const css = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')
const compactCss = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
const failures = []

const expectedSections = [
  'overview',
  'care',
  'resources',
  'portal-access',
  'communication',
  'activity',
]

const panelOrder = [
  {
    id: 'communication',
    content: ['client-communication-card-v3'],
  },
  {
    id: 'overview',
    content: [
      'client-detail-grid-v2',
      'client-care-highlights-v2',
      'client-care-summary-v2',
      'client-notes-grid-v2',
    ],
  },
  {
    id: 'portal-access',
    content: [
      'client-portal-invite-v2',
      'client-portal-invite-history-v2',
      'client-portal-email-draft-v2',
    ],
  },
  {
    id: 'resources',
    content: ['client-portal-resources-v2'],
  },
  {
    id: 'care',
    content: ['client-service-records-v2'],
  },
  {
    id: 'activity',
    content: ['client-timeline-v2'],
  },
]

for (const sectionId of expectedSections) {
  for (const token of [
    `{ id: '${sectionId}'`,
    `client-profile-tab-${'${section.id}'}`,
    `client-profile-panel-${'${section.id}'}`,
  ]) {
    const source = token.startsWith('{ id:') ? sections : tabs
    if (!source.includes(token)) {
      failures.push(`Client tab system is missing ${sectionId}: ${token}`)
    }
  }

  for (const token of [
    `clientDetailSection === '${sectionId}'`,
    `id="client-profile-panel-${sectionId}"`,
    `aria-labelledby="client-profile-tab-${sectionId}"`,
  ]) {
    if (!clients.includes(token)) {
      failures.push(`AdminClients.jsx is missing ${sectionId} panel behavior: ${token}`)
    }
  }
}

for (let index = 0; index < panelOrder.length; index += 1) {
  const panel = panelOrder[index]
  const startToken = `id="client-profile-panel-${panel.id}"`
  const nextPanel = panelOrder[index + 1]
  const start = clients.indexOf(startToken)
  const end = nextPanel
    ? clients.indexOf(`id="client-profile-panel-${nextPanel.id}"`)
    : clients.length
  const panelSource = start >= 0 && end > start ? clients.slice(start, end) : ''

  for (const token of panel.content) {
    if (!panelSource.includes(token)) {
      failures.push(`${panel.id} panel does not contain its expected workspace: ${token}`)
    }
  }
}

for (const token of [
  'role="tablist"',
  'role="tab"',
  'aria-selected={isActive}',
  'tabIndex={isActive ? 0 : -1}',
  "['ArrowLeft', 'ArrowRight', 'Home', 'End']",
  'handleTabKeyDown',
]) {
  if (!tabs.includes(token)) failures.push(`ClientProfileTabs.jsx is missing: ${token}`)
}

if ((clients.match(/role="tabpanel"/g) || []).length !== expectedSections.length) {
  failures.push('AdminClients.jsx must render exactly six focused tab panels.')
}

if (!clients.includes("document.querySelector('.client-detail-card-v2')?.scrollTo")) {
  failures.push('Client tab changes do not reset the drawer scroll position.')
}

const panelRule = compactCss.match(/\.client-detail-panel-v3\s*\{([^}]*)\}/)?.[1] || ''
for (const declaration of [
  'display: grid',
  'align-content: start',
  'min-width: 0',
  'width: 100%',
]) {
  if (!panelRule.includes(declaration)) {
    failures.push(`.client-detail-panel-v3 is missing: ${declaration}`)
  }
}

for (const token of [
  'admin:qa:phase30r6',
  'node scripts/check-admin-phase30r6-client-tabs.mjs',
]) {
  if (!packageSource.includes(token)) {
    failures.push(`package.json is missing Phase 30R.6 QA hook: ${token}`)
  }
}

if (failures.length) {
  console.error('\nAdmin Phase 30R.6 client tabs audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Admin Phase 30R.6 client tabs audit passed (six focused panels, correct workspace mapping, accessible tab semantics, keyboard navigation, and scroll reset).')
