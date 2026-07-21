import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const app = read('src/App.jsx')
const frame = read('src/components/admin/AdminFrame.jsx')
  + read('src/components/admin/adminNavigation.js')
const preload = read('src/components/admin/adminRoutePreloaders.js')
const page = read('src/pages/admin/AdminAssetVault.jsx')
const api = read('src/lib/nativeApi.js')
const serverApp = read('server/src/app.js')
const routes = read('server/src/routes/assetVault.routes.js')
const publicRoutes = read('server/src/routes/public.routes.js')
const storage = read('server/src/services/assetStorage.service.js')
const envSource = read('server/src/config/env.js')
const migration = read('server/scripts/ensure-asset-vault.cjs')
const ordered = read('server/scripts/run-ordered-migrations.cjs')
const serverPackage = read('server/package.json')
const releaseQa = read('src/components/admin/adminReleaseQa.js')
const portalResources = read('src/pages/ClientPortalResources.jsx')
const css = read('src/pages/admin/AdminFreshUI.css')
const packageSource = read('package.json')

const groups = {
  route: [
    "loadAdminAssetVault",
    "const AdminAssetVault = lazy(loadAdminAssetVault)",
    "'/admin/assets': {",
    '<Route path="/admin/assets"',
    "to: '/admin/assets'",
  ],
  workspace: [
    'Asset Vault',
    'Drop files into the vault',
    'Reusable asset details',
    'Client delivery',
    'Version history',
    'Assign to portal',
    'View archive',
    'New folder',
  ],
  backend: [
    "app.use('/api/admin/assets'",
    "router.post('/upload'",
    "router.post('/:assetId/versions'",
    "router.post('/:assetId/assignments'",
    "router.get('/:assetId/download'",
    "requireRole(['developer', 'owner', 'admin'])",
    'collectRequestBuffer',
    'authenticated_proxy',
  ],
  storage: [
    'ASSET_STORAGE_DRIVER',
    'ASSET_S3_ENDPOINT',
    'AWS4-HMAC-SHA256',
    'checksumSha256',
    'allowedMimeTypes',
    'ASSET_MAX_UPLOAD_BYTES',
  ],
  database: [
    'CREATE TABLE IF NOT EXISTS assets',
    'CREATE TABLE IF NOT EXISTS asset_versions',
    'CREATE TABLE IF NOT EXISTS asset_folders',
    'CREATE TABLE IF NOT EXISTS asset_assignments',
    'CREATE TABLE IF NOT EXISTS asset_access_logs',
    'idx_asset_assignments_active_client',
  ],
  delivery: [
    "router.get('/client-portal/assets/:assetId/download'",
    "assignment.status = 'active'",
    "portal_resource_id",
    "String(value).startsWith('/api/')",
  ],
  visual: [
    '.pwc-assets26-page',
    '.pwc-assets26-hero',
    '.pwc-assets26-dropzone',
    '.pwc-assets26-workspace',
    '.pwc-assets26-asset-list',
    '.pwc-assets26-detail',
    '.pwc-assets26-assignment-form',
    '.pwc-assets26-version-list',
  ],
}

const sources = {
  route: app + frame + preload,
  workspace: page + api,
  backend: serverApp + routes + storage,
  storage: storage + envSource,
  database: migration,
  delivery: routes + publicRoutes + portalResources,
  visual: css,
}

const failures = []
for (const [group, tokens] of Object.entries(groups)) {
  for (const token of tokens) {
    if (!sources[group].includes(token)) failures.push(`${group} safeguard missing: ${token}`)
  }
}

for (const mutation of [...routes.matchAll(/router\.(post|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g)]) {
  if (!routes.slice(Math.max(0, mutation.index - 200), mutation.index + 400).includes('requireAssetManager') && !routes.includes('router.use(requireAssetManager)')) {
    failures.push(`unprotected Asset Vault mutation: ${mutation[1].toUpperCase()} ${mutation[2]}`)
  }
}

if (!serverPackage.includes('db:migrate-asset-vault')) failures.push('server package is missing the Asset Vault migration script')
if (!ordered.includes("'db:migrate-asset-vault'")) failures.push('ordered migrations do not include Asset Vault')
if (!releaseQa.includes("id: 'asset-vault'")) failures.push('release QA does not include the Asset Vault contract')
if (!packageSource.includes('node scripts/check-admin-phase26-asset-vault.mjs')) failures.push('admin lint does not run the Phase 26 audit')
if (!packageSource.includes('server/tests/asset-vault.test.cjs')) failures.push('Phase 26 focused tests are not wired')
if (!css.includes(".developer-audit-workspace .pwc-momentum18-actions button:first-child") || !css.includes('background:var(--admin-burgundy)')) failures.push('non-status Developer primary actions are not returned to burgundy')
if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(page)) failures.push('Asset Vault uses a native browser dialog')

if (failures.length) {
  console.error('\nAdmin Phase 26 Asset Vault audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Admin Phase 26 Asset Vault audit passed (${groups.route.length} route safeguards, ${groups.workspace.length} workspace safeguards, ${groups.backend.length} backend safeguards, ${groups.storage.length} storage safeguards, ${groups.database.length} database safeguards, ${groups.delivery.length} client-delivery safeguards, ${groups.visual.length} visual safeguards).`)
