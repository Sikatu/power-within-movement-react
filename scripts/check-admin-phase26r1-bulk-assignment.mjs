import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const page = read('src/pages/admin/AdminAssetVault.jsx')
const api = read('src/lib/nativeApi.js')
const routes = read('server/src/routes/assetVault.routes.js')
const service = read('server/src/services/assetAssignment.service.js')
const tests = read('server/tests/asset-vault.test.cjs')
const css = read('src/pages/admin/AdminFreshUI.css')
const packageSource = read('package.json')

const safeguards = {
  workspace: [
    'Assign to all clients',
    'Share with every client',
    'Archived profiles and non-client system accounts are excluded.',
    'bulkAssignableCount',
    'requestConfirm',
  ],
  api: [
    'assignAssetVaultAssetToAllClients',
    '/assignments/all',
  ],
  backend: [
    "router.post('/:assetId/assignments/all'",
    "COALESCE(cp.client_status, 'lead') <> 'archived'",
    "user_record.role = 'client'",
    'buildBulkAssignmentPlan',
    "asset_assigned_to_all_clients",
    'alreadyAssigned',
  ],
  idempotency: [
    "existing?.status === 'active' && existing?.portal_resource_id",
    'new Set(clientIds',
    'FOR UPDATE',
    'no duplicate resources are created',
  ],
  visual: [
    '.pwc-assets26-assignment-bulk',
    '.pwc-assets26-assignment-bulk button:disabled',
  ],
  tests: [
    'skips active client resources',
    'repairs active rows that lost their portal resource',
  ],
}

const sources = { workspace: page, api, backend: routes + service, idempotency: page + routes + service, visual: css, tests }
const failures = []
for (const [group, tokens] of Object.entries(safeguards)) {
  for (const token of tokens) {
    if (!sources[group].includes(token)) failures.push(`${group} safeguard missing: ${token}`)
  }
}

if (!packageSource.includes('node scripts/check-admin-phase26r1-bulk-assignment.mjs')) failures.push('admin lint does not run the Phase 26R.1 audit')
if (!packageSource.includes('admin:qa:phase26r1')) failures.push('package scripts do not expose the Phase 26R.1 focused audit')
if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(page)) failures.push('bulk assignment uses a native browser dialog')

if (failures.length) {
  console.error('\nAdmin Phase 26R.1 bulk assignment audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Admin Phase 26R.1 bulk assignment audit passed (${safeguards.workspace.length} workspace safeguards, ${safeguards.api.length} API safeguards, ${safeguards.backend.length} backend safeguards, ${safeguards.idempotency.length} idempotency safeguards, ${safeguards.visual.length} visual safeguards, ${safeguards.tests.length} test safeguards).`)
