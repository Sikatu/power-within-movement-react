import { readFileSync } from 'node:fs'

import {
  readAdminStyleModules,
  readAdminStylesheet,
} from './lib/adminStyles.mjs'

const stylesheet = readAdminStylesheet()
const styleModules = readAdminStyleModules()
const packageSource = readFileSync('package.json', 'utf8')
const viteSource = readFileSync('vite.config.js', 'utf8')

const requiredSelectors = [
  '.founder-developer-banner',
  '.pwc-admin-back-link',
  '.pwc-studio-placeholder',
  '.client-circle-card-v2',
  '.client-action-menu-v1',
  '.client-portal-resource-form-v2',
  '.client-service-form-v2',
  '.pwc-scheduler-form-row',
  '.learning-checkbox-label',
  '.developer-role-badge',
  '.developer-cleanup-confirmation',
  '.developer-preview-columns',
  '.developer-client-picker-list',
  '.error-center-health-strip',
  '.error-center-severity',
  '.error-center-row-copy',
  '.error-center-state-icon',
  '.error-center-field-grid',
  '.error-center-input-with-suffix',
  '.pwc-assets26-page',
  '.pwc-assets26-workspace',
  '.pwc-assets26-detail',
  '.pwc-audience27-page',
  '.pwc-audience27-directory',
  '.pwc-letters28-page',
  '.pwc-letters28-builder-grid',
  '.pwc-letters28-canvas',
  '.pwc-letters28-results',
  '.pwc-founder29-clocks',
  '.pwc-founder29-recorder',
  '.pwc-founder29-detail',
]

const failures = []

for (const selector of requiredSelectors) {
  if (!stylesheet.includes(selector)) {
    failures.push(`missing visual coverage selector: ${selector}`)
  }
}

// Keep the historical core budget while allowing later layers to live in a
// separately owned enhancement module. The aggregate budget prevents a split
// from hiding uncontrolled CSS growth.
const stylesheetBudget = 600 * 1024
const enhancementBudget = 100 * 1024
const aggregateBudget = 700 * 1024
const moduleBudgets = new Map([
  ['src/pages/admin/AdminFreshUI.css', stylesheetBudget],
  ['src/pages/admin/AdminFreshUI.enhancements.css', enhancementBudget],
])

let aggregateBytes = 0
for (const module of styleModules) {
  const moduleBytes = Buffer.byteLength(module.source, 'utf8')
  aggregateBytes += moduleBytes
  const budget = moduleBudgets.get(module.path)
  if (budget && moduleBytes > budget) {
    failures.push(`${module.path} exceeds its ${budget / 1024} KiB source budget (${Math.ceil(moduleBytes / 1024)} KiB)`)
  }
}
if (aggregateBytes > aggregateBudget) {
  failures.push(`Admin styles exceed the ${aggregateBudget / 1024} KiB aggregate source budget (${Math.ceil(aggregateBytes / 1024)} KiB)`)
}

const importantCount = (stylesheet.match(/!important/g) || []).length
if (importantCount > 74) {
  failures.push(`Admin styles use ${importantCount} !important declarations; budget is 74`)
}

if (/\bPass\s+\d+(?:\.\d+)?\b/i.test(stylesheet)) {
  failures.push('Admin styles still expose internal pass-number labels')
}

for (const vendorToken of ["return 'react-vendor'", '/node_modules/react/', '/node_modules/react-dom/', '/node_modules/react-router']) {
  if (!viteSource.includes(vendorToken)) {
    failures.push(`vite.config.js is missing React vendor chunk token: ${vendorToken}`)
  }
}

if (!packageSource.includes('node scripts/check-admin-visual-coverage.mjs')) {
  failures.push('package.json lint command does not run the admin visual coverage audit')
}

if (failures.length) {
  console.error('\nAdmin visual coverage audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin visual coverage audit passed (${requiredSelectors.length} structural selectors, ${Math.ceil(aggregateBytes / 1024)} KiB across ${styleModules.length} source modules, ${importantCount} !important declarations).`,
)
