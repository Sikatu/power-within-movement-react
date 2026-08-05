import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
  .replace(/\r\n?/g, '\n')

const appSource = read('src/App.jsx')
const hubSource = read(
  'src/pages/admin/AdminClientsHub.jsx',
)
const contextSource = read(
  'src/pages/admin/AdminClient360.jsx',
)
const momentumSource = read(
  'src/pages/admin/AdminClientMomentum.jsx',
)
const coverageSource = read(
  'src/pages/admin/AdminClientCoverage.jsx',
)
const preloaderSource = read(
  'src/components/admin/adminRoutePreloaders.js',
)
const stylesheetSource = read(
  'src/pages/admin/AdminFreshUI.css',
)
const packageSource = read('package.json')
const failures = []

const hubTokens = [
  'useLocation',
  "section === 'context'",
  "location.pathname.startsWith('/admin/client-360/')",
  "activeView === 'context'",
  'selectedTabView =',
  "() => import('./AdminClient360.jsx')",
  '<AdminClientContext embedded />',
  'pwc-clients55-context-bar',
  "navigate('/admin/clients')",
  'Back to Directory',
]

for (const token of hubTokens) {
  if (!hubSource.includes(token)) {
    failures.push(
      'Clients Hub is missing context safeguard: '
      + token,
    )
  }
}

const contextTokens = [
  'function Client360Container({',
  'function AdminClient360({ embedded = false })',
  '<Client360Container embedded={embedded}>',
  'return embedded',
  ': <AdminFrame>{children}</AdminFrame>',
]

for (const token of contextTokens) {
  if (!contextSource.includes(token)) {
    failures.push(
      'Client 360 is missing embedded safeguard: '
      + token,
    )
  }
}

const unifiedContextPattern =
  /\/admin\/clients\/\$\{[^}]+\}\/context/

if (!unifiedContextPattern.test(momentumSource)) {
  failures.push(
    'Momentum does not open unified Client Context.',
  )
}

if (!unifiedContextPattern.test(coverageSource)) {
  failures.push(
    'Coverage does not open unified Client Context.',
  )
}

if (
  momentumSource.includes('/admin/client-360/')
  || coverageSource.includes('/admin/client-360/')
) {
  failures.push(
    'A client-care action still opens the legacy standalone context.',
  )
}

if (
  !preloaderSource.includes(
    "loadAdminClient360 = cached(() => import('../../pages/admin/AdminClientsHub.jsx'))",
  )
) {
  failures.push(
    'The legacy Client 360 route does not load the Clients Hub.',
  )
}

const preservedRouteTokens = [
  '<Route path="/admin/client-360/:clientId"',
  '<Route path="/admin/clients/:clientId/:section"',
]

for (const token of preservedRouteTokens) {
  if (!appSource.includes(token)) {
    failures.push(
      'A required client route is missing: ' + token,
    )
  }
}

const styleTokens = [
  'phase-55c1b-client-context-start',
  '.pwc-clients55-context-bar',
  'phase-55c1b-client-context-end',
]

for (const token of styleTokens) {
  if (!stylesheetSource.includes(token)) {
    failures.push(
      'Client Context styling is missing: ' + token,
    )
  }
}

if (
  !packageSource.includes(
    'node scripts/check-admin-phase55c1b-client-context.mjs',
  )
) {
  failures.push(
    'package.json does not run the Phase 55C.1B audit.',
  )
}

if (failures.length) {
  console.error(
    '\nAdmin Phase 55C.1B Client Context audit failed:\n',
  )

  for (const failure of failures) {
    console.error('- ' + failure)
  }

  process.exit(1)
}

console.log(
  'Admin Phase 55C.1B Client Context audit passed (embedded Client 360, unified Momentum and Coverage entry points, Directory-selected context, preserved legacy routing, and responsive return navigation).',
)
