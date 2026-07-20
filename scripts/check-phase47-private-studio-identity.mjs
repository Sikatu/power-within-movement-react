import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const adminPage = read('src/pages/admin/AdminStudioProfile.jsx')
const adminStyles = read('src/styles/AdminStudioProfile.css')
const chrome = read('src/components/ClientPortalChrome.jsx')
const dashboard = read('src/pages/ClientPortalDashboard.jsx')
const founder = read('src/pages/admin/AdminFoundersView.jsx')
const api = read('src/lib/nativeApi.js')
const routes = read('server/src/routes/public.routes.js')
const service = read('server/src/services/studioProfile.service.js')
const migration = read('server/scripts/ensure-studio-profile.cjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [adminPage, 'Private portal sharing', 'simple portal visibility controls'],
  [adminPage, 'clientPortalEnabled', 'separate identity approval'],
  [adminPage, 'clientPortalContactEnabled', 'separate contact approval'],
  [adminStyles, 'studio-profile46__visibility', 'compact sharing-control styling'],
  [service, 'buildClientStudioIdentity', 'safe client identity projection'],
  [service, "if (!profile.clientPortalEnabled) return null", 'private-by-default projection'],
  [routes, "router.get('/client-portal/studio-identity', requireClientPortalUser", 'authenticated identity route'],
  [routes, "router.get('/client-portal/studio-identity/image', requireClientPortalUser", 'authenticated image route'],
  [routes, 'profile.client_portal_enabled = true', 'server-side image visibility gate'],
  [routes, 'assertAssetUsable(asset)', 'active and safe image enforcement'],
  [api, 'getClientPortalStudioIdentity', 'native private identity client'],
  [chrome, 'studioIdentity?.displayName', 'portal-wide Studio identity'],
  [chrome, "className={studioIdentity?.profileImageUrl", 'approved profile image treatment'],
  [dashboard, 'studioIdentity?.welcomeMessage', 'personalized private welcome'],
  [dashboard, 'studioIdentity?.publicEmail', 'approved contact rendering'],
  [founder, 'getStudioProfile().catch', 'resilient Founder identity loading'],
  [founder, 'founderFirstName', 'profile-driven Founder greeting'],
  [migration, 'client_portal_enabled BOOLEAN NOT NULL DEFAULT false', 'private-by-default identity migration'],
  [migration, 'client_portal_contact_enabled BOOLEAN NOT NULL DEFAULT false', 'private-by-default contact migration'],
  [packageSource, '"admin:qa:phase47"', 'focused Phase 47 QA command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (/router\.get\('\/client-portal\/studio-identity',\s*async/.test(routes)) {
  failures.push('The private Studio identity route is missing client authentication.')
}

if (/DROP\s+TABLE|TRUNCATE\s+/i.test(migration)) {
  failures.push('The Phase 47 migration path contains a destructive table operation.')
}

if (failures.length) {
  console.error('\nPhase 47 Private Studio Identity audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 47 Private Studio Identity audit passed (opt-in sharing, authenticated identity and image delivery, hidden-by-default contact details, portal-wide branding, and profile-driven Founder greeting).')
