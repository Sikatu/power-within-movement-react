import { readFileSync } from 'node:fs'

const sources = {
  vault: readFileSync('src/pages/admin/AdminAssetVault.jsx', 'utf8'),
  picker: readFileSync('src/components/admin/AssetVaultPicker.jsx', 'utf8'),
  errors: readFileSync('src/pages/admin/AdminDeveloperErrors.jsx', 'utf8'),
  monitoring: readFileSync('src/pages/admin/AdminDeveloperMonitoringConfiguration.jsx', 'utf8'),
  api: readFileSync('src/lib/nativeApi.js', 'utf8'),
  routes: readFileSync('server/src/routes/assetVault.routes.js', 'utf8'),
  migration: readFileSync('server/scripts/ensure-asset-vault.cjs', 'utf8'),
  storage: readFileSync('server/src/services/assetStorage.service.js', 'utf8'),
}

const requirements = [
  ['upload progress UI', sources.vault, 'pwc-assets26-upload-queue'],
  ['multi-client selection UI', sources.vault, 'handleAssignSelected'],
  ['short-lived preview UI', sources.vault, "createAssetVaultAccessGrant(selectedAsset.id, purpose)"],
  ['security scan UI', sources.vault, 'scanLabel(selectedAsset)'],
  ['reusable asset picker', sources.picker, 'getAssetVaultAssets'],
  ['safe technical copy', sources.errors, 'buildDeveloperErrorCopy'],
  ['monitoring configuration home', sources.monitoring, 'saveDeveloperErrorSettings'],
  ['upload progress transport', sources.api, "request.upload.addEventListener('progress'"],
  ['selected assignment API', sources.routes, "assignments/selected"],
  ['access grant redemption', sources.routes, "router.get('/access/:token'"],
  ['streamed asset delivery', sources.storage, 'getObjectStream'],
  ['access grant table', sources.migration, 'asset_access_grants'],
  ['relationship table', sources.migration, 'asset_relationships'],
  ['scan-state columns', sources.migration, 'scan_status'],
]

const failures = requirements.filter(([, source, token]) => !source.includes(token)).map(([label]) => `missing ${label}`)
if (sources.errors.includes('saveDeveloperErrorSettings')) failures.push('Errors still owns monitoring configuration')

if (failures.length) {
  console.error('\nPhase 26R.2 asset hardening audit failed:\n')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`Phase 26R.2 asset hardening audit passed (${requirements.length} protected capabilities).`)
