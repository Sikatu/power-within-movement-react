import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const assetRoutes = read('server/src/routes/assetVault.routes.js')
const assetTests = read('server/tests/asset-vault.test.cjs')
const errorMigration = read('server/scripts/ensure-developer-error-center.cjs')
const orderedMigrations = read('server/scripts/run-ordered-migrations.cjs')
const serverPackage = read('server/package.json')
const packageSource = read('package.json')
const failures = []

const requiredTokens = [
  [assetRoutes, 'FROM asset_access_grants AS access_grant', 'safe Asset Vault grant alias'],
  [assetRoutes, 'JOIN assets AS stored_asset ON stored_asset.id = access_grant.asset_id', 'explicit stored asset join'],
  [assetRoutes, 'FOR UPDATE OF access_grant', 'grant row lock'],
  [assetTests, 'asset grant redemption query avoids PostgreSQL reserved aliases', 'Asset Vault SQL regression test'],
  [errorMigration, 'pwc_application_error_fingerprint_repair', 'legacy Error Center fingerprint repair'],
  [errorMigration, 'ADD CONSTRAINT application_errors_fingerprint_unique', 'Error Center unique constraint repair'],
  [orderedMigrations, "'db:migrate-developer-error-center'", 'ordered Error Center migration'],
  [serverPackage, '"db:migrate-developer-error-center"', 'Error Center migration command'],
]

for (const [source, token, label] of requiredTokens) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const forbiddenPatterns = [
  [/asset_access_grants\s+grant\b/, 'reserved grant table alias'],
  [/\bgrant\.\*/, 'reserved grant wildcard reference'],
  [/FOR UPDATE OF grant\b/, 'reserved grant row-lock reference'],
]

for (const [pattern, label] of forbiddenPatterns) {
  if (pattern.test(assetRoutes)) failures.push(`Asset Vault still contains the ${label}`)
}

if (!packageSource.includes('node scripts/check-phase45r2-backend-repairs.mjs')) {
  failures.push('package.json does not run the Phase 45R2 backend repair audit')
}

if (failures.length) {
  console.error('\nPhase 45R2 backend repair audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Phase 45R2 backend repair audit passed (PostgreSQL-safe Asset Vault grants, locked redemption, Error Center fingerprint repair, and regression coverage).',
)
