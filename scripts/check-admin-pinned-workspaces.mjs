import { readFileSync } from 'node:fs'

const frameSource = readFileSync(
  'src/components/admin/AdminFrame.jsx',
  'utf8',
)

const paletteSource = readFileSync(
  'src/components/admin/AdminCommandPalette.jsx',
  'utf8',
)

const pinnedSource = readFileSync(
  'src/components/admin/adminPinnedDestinations.js',
  'utf8',
)

const stylesheet = readFileSync(
  'src/pages/admin/AdminFreshUI.css',
  'utf8',
)

const packageSource = readFileSync('package.json', 'utf8')
const failures = []

const frameTokens = [
  'PINNED_STORAGE_KEY,',
  'const [pinnedPaths, setPinnedPaths] = useState(readPinnedDestinations)',
  'setPinnedPaths(togglePinnedDestination(pathname))',
  "window.addEventListener('storage', syncPinnedDestinations)",
  'pinnedPaths={pinnedPaths}',
  'onTogglePinned={handleTogglePinned}',
]

const retiredSidebarTokens = [
  'const pinnedItems = useMemo',
  'className="pwc-nav33-pinned"',
  'className="pwc-nav33-pinned-row"',
]

const paletteTokens = [
  'pinnedPaths,',
  'onTogglePinned,',
  'const pinnedItems = pinnedPaths',
  "event.altKey && event.key.toLowerCase() === 'p'",
  'className={`pwc-command12-toggle',
  'className={`pwc-command11-option',
  'aria-pressed={selectedPinned}',
  '<kbd>Alt P</kbd> Pin',
]

const storageTokens = [
  "export const PINNED_STORAGE_KEY = 'pwc_admin_pinned_destinations'",
  'const MAX_PINNED_DESTINATIONS = 6',
  'export function readPinnedDestinations',
  'export function writePinnedDestinations',
  'export function togglePinnedDestination',
  'window.localStorage.setItem',
]

const stylesheetSelectors = [
  '.pwc-command12-toggle',
  '.pwc-command11-option.is-pinned',
]

for (const token of frameTokens) {
  if (!frameSource.includes(token)) {
    failures.push(
      `AdminFrame is missing command-palette pinning token: ${token}`,
    )
  }
}

for (const token of retiredSidebarTokens) {
  if (frameSource.includes(token)) {
    failures.push(
      `Retired visible pinned sidebar UI is still present: ${token}`,
    )
  }
}

for (const token of paletteTokens) {
  if (!paletteSource.includes(token)) {
    failures.push(
      `AdminCommandPalette is missing pinning token: ${token}`,
    )
  }
}

for (const token of storageTokens) {
  if (!pinnedSource.includes(token)) {
    failures.push(
      `Pinned destination storage is missing token: ${token}`,
    )
  }
}

for (const selector of stylesheetSelectors) {
  if (!stylesheet.includes(selector)) {
    failures.push(
      `AdminFreshUI.css is missing command-palette selector: ${selector}`,
    )
  }
}

if (
  /\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(
    `${frameSource}\n${paletteSource}`,
  )
) {
  failures.push(
    'Pinned destination UI uses a native browser dialog',
  )
}

if (
  !packageSource.includes(
    'node scripts/check-admin-pinned-workspaces.mjs',
  )
) {
  failures.push(
    'package.json lint command does not run the pinned-destination audit',
  )
}

if (failures.length) {
  console.error(
    '\nAdmin pinned-destination audit failed:\n',
  )

  for (const failure of failures) {
    console.error(`- ${failure}`)
  }

  process.exit(1)
}

console.log(
  `Admin pinned-destination audit passed (${frameTokens.length} frame safeguards, ${paletteTokens.length} command safeguards, ${storageTokens.length} storage safeguards, command-only pinning, and no visible pinned sidebar section).`,
)
