import { readFileSync } from 'node:fs'

const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const paletteSource = readFileSync('src/components/admin/AdminCommandPalette.jsx', 'utf8')
const recentSource = readFileSync('src/components/admin/adminRecentDestinations.js', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const failures = []

const frameTokens = [
  "import AdminCommandPalette",
  'rememberAdminDestination(location.pathname)',
  '{commandOpen && (',
  'const [commandOpen, setCommandOpen] = useState(false)',
  "event.ctrlKey || event.metaKey",
  "event.key.toLowerCase() === 'k'",
  'const commandItems = useMemo',
  '...accessibleWorkspaces.map',
  '...allAccessiblePrimaryItems.map',
  '...accessibleGroups.flatMap',
  '<AdminCommandPalette',
  'onWarmRoute={warmRoute}',
]

const paletteTokens = [
  'role="dialog"',
  'aria-modal="true"',
  'role="combobox"',
  'role="listbox"',
  'role="option"',
  "event.key === 'ArrowDown'",
  "event.key === 'ArrowUp'",
  "event.key === 'Enter'",
  "event.key === 'Escape'",
  'onWarmRoute(activeItem.to)',
]


const recentTokens = [
  "const RECENT_STORAGE_KEY = 'pwc_admin_recent_destinations'",
  'export function readRecentDestinations',
  'export function rememberAdminDestination',
  'window.localStorage.setItem',
]

const stylesheetSelectors = [
  '.pwc-nav33-quick-find',
  '.pwc-command11-layer',
  '.pwc-command11-backdrop',
  '.pwc-command11-dialog',
  '.pwc-command11-search',
  '.pwc-command11-results',
  '.pwc-command11-option',
  '.pwc-command11-empty',
  '.pwc-command11-footer',
]

for (const token of frameTokens) {
  if (!frameSource.includes(token)) failures.push(`AdminFrame is missing command-center token: ${token}`)
}

for (const token of paletteTokens) {
  if (!paletteSource.includes(token)) failures.push(`AdminCommandPalette is missing token: ${token}`)
}

for (const token of recentTokens) {
  if (!recentSource.includes(token)) failures.push(`Recent destination storage is missing token: ${token}`)
}

for (const selector of stylesheetSelectors) {
  if (!stylesheet.includes(selector)) failures.push(`AdminFreshUI.css is missing command-center selector: ${selector}`)
}

if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(paletteSource)) {
  failures.push('AdminCommandPalette uses a native browser dialog')
}

if (!packageSource.includes('node scripts/check-admin-command-center.mjs')) {
  failures.push('package.json lint command does not run the admin command-center audit')
}

if (failures.length) {
  console.error('\nAdmin command-center audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin command-center audit passed (${frameTokens.length} frame safeguards, ${paletteTokens.length} interaction safeguards, ${recentTokens.length} recent-history safeguards, ${stylesheetSelectors.length} visual selectors).`,
)
