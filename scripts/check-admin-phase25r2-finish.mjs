import fs from 'node:fs'
import path from 'node:path'

import {
  normalizeCssValue,
  parseAdminStylesheet,
  ruleHasDeclarations,
} from './lib/adminStyles.mjs'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const stylesRoot = parseAdminStylesheet()
const release = read('src/pages/admin/AdminReleaseQa.jsx')
const integrity = read('src/pages/admin/AdminSecurityIntegrity.jsx')

const actionSelector = ':is(.developer-audit-workspace,.developer-release-workspace) .pwc-momentum18-actions'
const hasDesktopActions = ruleHasDeclarations(
  stylesRoot,
  actionSelector,
  [['grid-template-columns', 'repeat(3, minmax(0, 1fr))']],
)

let hasMobileActions = false
stylesRoot.walkAtRules('media', (atRule) => {
  if (normalizeCssValue(atRule.params) !== '(max-width: 760px)') return
  if (ruleHasDeclarations(atRule, actionSelector, [['grid-template-columns', '1fr']])) {
    hasMobileActions = true
  }
})

const safeguards = [
  ['shared three-column action layout', hasDesktopActions],
  ['mobile action stack', hasMobileActions],
  ['release primary action remains first', release.indexOf('Run this check') < release.indexOf('Open workspace')],
  ['release has three shortcut actions', ['Open workspace', 'Security audit', 'Error Center'].every((label) => release.includes(label))],
  ['integrity primary action remains first', integrity.indexOf('Account governance') < integrity.indexOf('Staff permissions')],
  ['integrity has three shortcut actions', ['Staff permissions', 'Activity journal', 'Error Center'].every((label) => integrity.includes(label))],
]

const failures = safeguards.filter(([, passed]) => !passed)
if (failures.length) {
  console.error(`Admin Phase 25R.2 finishing audit failed: ${failures.map(([name]) => name).join(', ')}`)
  process.exit(1)
}

console.log(`Admin Phase 25R.2 finishing audit passed (${safeguards.length} action-layout safeguards).`)
