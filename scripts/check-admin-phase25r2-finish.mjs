import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const css = read('src/pages/admin/AdminFreshUI.css')
const release = read('src/pages/admin/AdminReleaseQa.jsx')
const integrity = read('src/pages/admin/AdminSecurityIntegrity.jsx')

const safeguards = [
  ['shared three-column action layout', css.includes(':is(.developer-audit-workspace,.developer-release-workspace) .pwc-momentum18-actions') && css.includes('grid-template-columns:repeat(3,minmax(0,1fr))')],
  ['mobile action stack', css.includes('@media(max-width:760px)') && css.includes('grid-template-columns:1fr')],
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
