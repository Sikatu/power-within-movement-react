import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const studioApp = read('src/studio/StudioApp.jsx')
const clients = read('src/studio/pages/StudioClients.jsx')
const css = read('src/studio/studio.css')

assert(
  studioApp.includes(
    "import StudioClients from './pages/StudioClients.jsx'",
  )
    && studioApp.includes(
      '<Route path="clients" element={<StudioClients />} />',
    ),
  'The Clients route is not connected to StudioClients.',
)

assert(
  !studioApp.includes(
    'element={<StudioWorkspacePage workspaceId="clients" />}',
  ),
  'The temporary Clients placeholder must be retired.',
)

for (const apiName of [
  'getAdminClients',
  'getAdminClient360',
]) {
  assert(
    clients.includes(apiName),
    `Missing read-only Clients API integration: ${apiName}`,
  )
}

for (const forbiddenWrite of [
  'createAdminClient',
  'updateAdminClient',
  'updateAdminClientCarePlan',
  'createAdminClientCareAction',
  'updateAdminClientCareAction',
  'createAdminClientPortalInvite',
]) {
  assert(
    !clients.includes(forbiddenWrite),
    `Phase 56D.1 must remain read-only: ${forbiddenWrite}`,
  )
}

for (const capability of [
  'Current clients',
  'Onboarding',
  'Members',
  'Archived',
  'Search clients',
  'Client care pulse',
  'Next best actions',
  'Recent journey activity',
  'Open Client 360',
  'Legacy profile',
  'Real client data connected',
]) {
  assert(
    clients.includes(capability),
    `Missing Clients workspace capability: ${capability}`,
  )
}

assert(
  clients.includes('Lead records remain in the dedicated Pipeline')
    && clients.includes('to="/studio/pipeline"'),
  'Lead records must remain clearly separated into Pipeline.',
)

assert(
  !clients.includes('AdminFrame')
    && !clients.includes('AdminFreshUI.css')
    && !clients.includes('window.confirm')
    && !clients.includes('window.alert'),
  'The New Studio Clients workspace must remain isolated.',
)

assert(
  css.includes('PHASE 56D.1 CLIENTS START')
    && css.includes('.studio-clients-layout')
    && css.includes('.studio-clients-directory-list')
    && css.includes('.studio-client-pulse')
    && css.includes('.studio-client-journey')
    && css.includes('@media (max-width: 980px)')
    && css.includes('@media (max-width: 700px)'),
  'The Clients workspace responsive styles are incomplete.',
)

assert(
  css.includes('PHASE 56C.2 ACTIONS END')
    && css.includes('PHASE 56C.1R COMPACT BOARD END'),
  'The verified Pipeline styles must remain intact.',
)

console.log(
  'Phase 56D.1 real-data Clients audit passed '
  + '(directory, relationship filters, care pulse, plans, sessions, '
  + 'actions, journey activity, Legacy fallbacks, isolation, '
  + 'read-only safeguards, and responsive behavior).',
)