import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const page = read('src/pages/admin/AdminStudioProfile.jsx')
const styles = read('src/styles/AdminStudioProfile.css')
const app = read('src/App.jsx')
const navigation = read('src/components/admin/adminNavigation.js')
const preloaders = read('src/components/admin/adminRoutePreloaders.js')
const api = read('src/lib/nativeApi.js')
const routes = read('server/src/routes/admin.routes.js')
const migration = read('server/scripts/ensure-studio-profile.cjs')
const ordered = read('server/scripts/run-ordered-migrations.cjs')
const packageSource = read('package.json')
const serverPackage = read('server/package.json')
const failures = []

const requirements = [
  [page, '<h1>Studio Profile</h1>', 'owner-friendly Studio Profile workspace'],
  [page, 'Upload image', 'direct image upload'],
  [page, 'type="image/"', 'image-only private Vault selection'],
  [page, 'Live preview', 'review-before-save preview'],
  [page, 'nothing is published by this screen', 'truthful publishing boundary'],
  [styles, 'phase-46-studio-profile-start', 'responsive Studio Profile styling'],
  [styles, '@media(max-width:680px)', 'compact mobile layout'],
  [app, 'path="/admin/studio-profile"', 'protected Studio Profile route'],
  [navigation, "to: '/admin/studio-profile'", 'Client Experience navigation'],
  [preloaders, 'loadAdminStudioProfile', 'route preloading'],
  [api, "apiRequest('/api/admin/studio-profile'", 'native Studio Profile API client'],
  [routes, "router.get('/studio-profile', requireAdmin", 'authenticated profile reading'],
  [routes, "router.patch('/studio-profile', requireAdmin", 'authenticated profile saving'],
  [routes, 'isUsableProfileImage', 'image safety enforcement'],
  [routes, "'studio_profile_updated'", 'private audit journal entry'],
  [migration, 'CREATE TABLE IF NOT EXISTS studio_profiles', 'idempotent singleton profile storage'],
  [migration, 'profile_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL', 'safe Asset Vault relationship'],
  [ordered, "'db:migrate-studio-profile'", 'ordered Phase 46 migration'],
  [serverPackage, '"db:migrate-studio-profile"', 'Phase 46 migration command'],
  [packageSource, '"admin:qa:phase46"', 'Phase 46 QA command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (/DROP\s+TABLE|TRUNCATE\s+/i.test(migration)) failures.push('Phase 46 migration contains a destructive table operation')
if (page.includes('SiteFooter') || styles.includes('phase-46-public-footer')) failures.push('Phase 46 changed the public footer boundary')

if (failures.length) {
  console.error('\nPhase 46 Studio Profile audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 46 Studio Profile audit passed (compact owner editor, protected image upload and Vault reuse, live preview, audit history, responsive layout, and no public publishing).')
