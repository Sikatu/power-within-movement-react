import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

function normalize(path) {
  return path.replaceAll('\\', '/')
}

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const sourceFiles = [
  ...walk('src/pages/admin'),
  ...walk('src/components/admin'),
].filter((file) => /\.(jsx|js)$/.test(file))

const failures = []

for (const file of sourceFiles) {
  const source = readFileSync(file, 'utf8')
  const displayPath = normalize(relative('.', file))

  for (const nativeDialog of ['window.confirm(', 'window.alert(', 'window.prompt(']) {
    if (source.includes(nativeDialog)) {
      failures.push(`${displayPath}: native browser dialog remains (${nativeDialog.slice(7, -1)})`)
    }
  }
}

const appSource = readFileSync('src/App.jsx', 'utf8')
const providerSource = readFileSync('src/components/admin/AdminConfirmProvider.jsx', 'utf8')

if (!appSource.includes('<AdminConfirmProvider>')) {
  failures.push('src/App.jsx: AdminConfirmProvider is not mounted around application routes')
}

for (const requirement of [
  'role="alertdialog"',
  'aria-modal="true"',
  "event.key === 'Escape'",
  "event.key !== 'Tab'",
  'openerRef.current.focus()',
]) {
  if (!providerSource.includes(requirement)) {
    failures.push(`src/components/admin/AdminConfirmProvider.jsx: missing dialog safeguard ${requirement}`)
  }
}

if (failures.length) {
  console.error('\nAdmin action-dialog audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin action-dialog audit passed (${sourceFiles.length} admin source files; no native browser dialogs).`,
)
