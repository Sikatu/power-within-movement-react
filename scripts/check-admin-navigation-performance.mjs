import { existsSync, readFileSync } from 'node:fs'

const apiSource = readFileSync('src/lib/nativeApi.js', 'utf8')
const routeGuardSource = readFileSync('src/components/admin/AdminRouteGuard.jsx', 'utf8')
const ownerGuardSource = readFileSync('src/components/admin/AdminOwnerRouteGuard.jsx', 'utf8')
const developerGuardSource = readFileSync('src/components/admin/AdminDeveloperRouteGuard.jsx', 'utf8')
const accessScreenSource = readFileSync('src/components/admin/AdminAccessScreen.jsx', 'utf8')

const failures = []

for (const safeguard of [
  'const ACCESS_CACHE_TTL = 15_000',
  'function cachedAccessCheck',
  "return cachedAccessCheck('admin'",
  "return cachedAccessCheck('founder'",
  "return cachedAccessCheck('developer'",
  'export function hasFreshAdminAccess',
  'clearAccessChecks()',
]) {
  if (!apiSource.includes(safeguard)) {
    failures.push(`missing access performance safeguard: ${safeguard}`)
  }
}

for (const [name, source] of [
  ['admin', routeGuardSource],
  ['founder', ownerGuardSource],
  ['developer', developerGuardSource],
]) {
  if (!source.includes("import AdminAccessScreen from './AdminAccessScreen.jsx'")) {
    failures.push(`${name} guard does not reuse the shared access screen`)
  }
}

if (!accessScreenSource.includes('aria-live="polite"')) {
  failures.push('shared access screen is missing its accessible status announcement')
}

if (existsSync('src/components/admin/AdminLoadingScreen.jsx')) {
  failures.push('duplicate unused AdminLoadingScreen component still exists')
}

if (failures.length) {
  console.error('\nAdmin navigation performance audit failed:\n')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log('Admin navigation performance audit passed (deduplicated access checks, warm guard transitions, one shared access screen, and retired duplicate loader code).')
