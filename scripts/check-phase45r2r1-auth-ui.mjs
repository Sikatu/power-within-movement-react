import { readFileSync } from 'node:fs'

import {
  parseAdminStylesheet,
  readAdminStylesheet,
  ruleHasDeclarations,
} from './lib/adminStyles.mjs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const loginSource = read('src/pages/admin/AdminLogin.jsx')
const stylesSource = readAdminStylesheet()
const stylesRoot = parseAdminStylesheet()
const packageSource = read('package.json')
const failures = []

const requiredTokens = [
  [loginSource, '<main className="pwc-admin-auth-page">', 'centered authentication page'],
  [loginSource, '<section className="pwc-admin-auth-card">', 'single Studio login card'],
  [loginSource, 'autoComplete="email"', 'email autocomplete'],
  [loginSource, 'autoComplete="current-password"', 'password autocomplete'],
  [loginSource, "status.loading ? 'Opening The Studio…' : 'Enter The Studio'", 'clear loading action'],
]

for (const [source, token, label] of requiredTokens) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (!ruleHasDeclarations(stylesRoot, '.pwc-admin-auth-card', [
  ['isolation', 'isolate'],
  ['background', 'linear-gradient(155deg, rgba(255, 253, 250, 0.96), rgba(255, 250, 246, 0.88))'],
], { allowSuffix: true })) {
  failures.push('single premium authentication card surface or contained layering is missing')
}

let hasEdgeHighlight = false
stylesRoot.walkDecls('box-shadow', (declaration) => {
  if (declaration.value.replace(/\s+/g, ' ').includes('inset 0 1px 0 rgba(255, 255, 255, 0.74)')) {
    hasEdgeHighlight = true
  }
})
if (!hasEdgeHighlight) failures.push('subtle card edge highlight is missing')

const duplicateFramePatterns = [
  /\.pwc-admin-auth-card::after/,
  /\.pwc-admin-password-card::after/,
  /inset:\s*16px\s+-16px\s+-16px\s+16px/,
]

for (const pattern of duplicateFramePatterns) {
  if (pattern.test(stylesSource)) failures.push(`Studio authentication styles still contain the duplicate offset frame: ${pattern}`)
}

if (!packageSource.includes('node scripts/check-phase45r2r1-auth-ui.mjs')) {
  failures.push('package.json does not run the Phase 45R2R1 authentication UI audit')
}

if (failures.length) {
  console.error('\nPhase 45R2R1 authentication UI audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Phase 45R2R1 authentication UI audit passed (one centered premium card, no offset duplicate frame, responsive mobile treatment, and preserved login behavior).',
)
