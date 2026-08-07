import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const clients = read('src/studio/pages/StudioClients.jsx')
const api = read('src/lib/nativeApi.js')
const server = read('server/src/routes/admin.routes.js')
const css = read('src/studio/studio.css')

for (const apiName of [
  'getAdminClient360',
  'getMyTeamAccess',
  'updateAdminClientCarePlan',
  'createAdminClientCareAction',
  'updateAdminClientCareAction',
]) {
  assert(
    clients.includes(apiName),
    `Studio Clients is missing protected API usage: ${apiName}`,
  )
  assert(
    api.includes(`export async function ${apiName}`),
    `nativeApi.js is missing the existing contract: ${apiName}`,
  )
}

for (const serverRoute of [
  "router.patch('/clients/:clientId/care-plan'",
  "router.post('/clients/:clientId/care-actions'",
  "router.patch('/clients/:clientId/care-actions/:actionId'",
]) {
  assert(
    server.includes(serverRoute),
    `Existing Client 360 route contract is missing: ${serverRoute}`,
  )
}

for (const value of [
  "'onboarding'",
  "'clarity'",
  "'active_work'",
  "'integration'",
  "'maintenance'",
  "'complete'",
  "'not_started'",
  "'on_track'",
  "'attention'",
  "'paused'",
  "'completed'",
  "'in_progress'",
  "'cancelled'",
  "'team'",
  "'client'",
]) {
  assert(
    server.includes(value),
    `Expected Client 360 validation value is missing: ${value}`,
  )
}

for (const capability of [
  'Protected client-care actions enabled',
  'Edit care plan',
  'Save care plan',
  'Add next action',
  'Create action',
  'Edit details',
  'Save action',
  'Start',
  'Complete',
  'Reopen',
  'Cancel action',
  'Owners must already be assigned to this client.',
  'Private strategy notes never appear in the Client Portal.',
]) {
  assert(
    clients.includes(capability),
    `Missing protected Clients capability: ${capability}`,
  )
}

assert(
  clients.includes("teamAccess?.permissions?.clients === 'manage'")
    && clients.includes("adminUser?.role !== 'staff'"),
  'Staff Clients permissions must gate write controls.',
)

assert(
  clients.includes("event.key === 'Escape'")
    && clients.includes('aria-modal="true"')
    && clients.includes('role="dialog"')
    && !clients.includes('window.confirm')
    && !clients.includes('window.alert'),
  'Care-action cancellation must use the accessible custom confirmation dialog.',
)

for (const forbiddenMutation of [
  'createAdminClient(',
  'updateAdminClient(',
  'createAdminClientPortalInvite(',
  'revokeAdminClientPortalInvite(',
  'sendAdminPortalInviteEmail(',
]) {
  assert(
    !clients.includes(forbiddenMutation),
    `Phase 56D.2 must not broaden into profile or portal mutations: ${forbiddenMutation}`,
  )
}

assert(
  clients.includes('to="/admin/clients"')
    && clients.includes('/admin/client-360/'),
  'Legacy Clients and Client 360 fallbacks must remain available.',
)

assert(
  clients.includes('Lead records remain in the dedicated Pipeline')
    && clients.includes('to="/studio/pipeline"'),
  'Clients must remain separate from the lead Pipeline.',
)

assert(
  css.includes('PHASE 56D.2 CLIENT CARE ACTIONS START')
    && css.includes('.studio-client-care-form')
    && css.includes('.studio-client-action-form')
    && css.includes('.studio-client-action-buttons')
    && css.includes('.studio-client-dialog-scrim')
    && css.includes('@media (max-width: 760px)')
    && css.includes('PHASE 56D.2 CLIENT CARE ACTIONS END'),
  'Phase 56D.2 protected action styles are incomplete.',
)

assert(
  css.includes('PHASE 56D.1R JOURNEY EMPTY END')
    && css.includes('PHASE 56D.1 CLIENTS END')
    && css.includes('PHASE 56C.2 ACTIONS END'),
  'Previously verified New Studio styles must remain intact.',
)

console.log(
  'Phase 56D.2 protected client-care audit passed '
  + '(care-plan editing, assigned ownership, due dates, action creation/editing, '
  + 'status workflow, permission gating, accessible cancellation, '
  + 'Legacy fallbacks, Pipeline separation, and existing secured APIs).',
)
