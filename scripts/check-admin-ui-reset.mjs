import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const retiredLegacyFiles = [
  'src/components/admin/AdminFrame.css',
  'src/pages/admin/Admin.css',
  'src/pages/admin/AdminClients.rework.css',
  'src/pages/admin/AdminInbox.css',
  'src/pages/admin/AdminScheduler.css',
  'src/pages/admin/AutomationStudio.css',
  'src/pages/admin/CircleCommunity.css',
  'src/pages/admin/Client360.css',
  'src/pages/admin/DeveloperErrorCenter.css',
  'src/pages/admin/DeveloperPanel.css',
  'src/pages/admin/EncouragementStudio.css',
  'src/pages/admin/FounderAvailability.css',
  'src/pages/admin/FounderCalendar.css',
  'src/pages/admin/FounderView.css',
  'src/pages/admin/LeadPipeline.css',
  'src/pages/admin/LearningLibrary.css',
  'src/pages/admin/MembershipCircle.css',
  'src/pages/admin/OnboardingStudio.css',
  'src/pages/admin/SessionChangeRequests.css',
  'src/pages/admin/TeamManagement.css',
]

const retiredPhasedUiFiles = [
  'src/components/admin/AdminCleanSlateFrame.css',
  'src/components/admin/AdminProductionPolishPhase9.css',
  'src/components/admin/FounderDeveloperBanner.css',
  'src/pages/admin/AdminCleanSlate.css',
  'src/pages/admin/AdminCleanSlateFoundation.css',
  'src/pages/admin/AdminModuleElevation.css',
  'src/pages/admin/AdminOperationsElevation.css',
  'src/pages/admin/AdminClientsPhase5.css',
  'src/pages/admin/AdminCommunicationPhase6.css',
  'src/pages/admin/AdminFounderSchedulingPhase7.css',
  'src/pages/admin/AdminDeveloperOperationsPhase8.css',
  'src/pages/admin/AdminUIBlankSlate.css',
]

const authoritativeUiFile = 'src/pages/admin/AdminFreshUI.css'
const sanctionedScopedUiFiles = new Map([
  ['src/pages/admin/AdminInboxComfort.css', 'src/pages/admin/AdminInbox.jsx'],
])
const allowedAdminCssFiles = new Set([
  authoritativeUiFile,
  ...sanctionedScopedUiFiles.keys(),
])
const retiredFiles = [...retiredLegacyFiles, ...retiredPhasedUiFiles]

function normalize(path) {
  return path.replaceAll('\\', '/')
}

function walk(directory) {
  if (!existsSync(directory)) return []

  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const failures = []

for (const file of retiredFiles) {
  if (existsSync(file)) failures.push(`${file}: retired UI stylesheet still exists`)
}

if (!existsSync(authoritativeUiFile)) {
  failures.push(`${authoritativeUiFile}: fresh admin design system is missing`)
}

for (const [stylesheetPath, importerPath] of sanctionedScopedUiFiles) {
  if (!existsSync(stylesheetPath)) {
    failures.push(`${stylesheetPath}: sanctioned scoped stylesheet is missing`)
    continue
  }

  if (!existsSync(importerPath)) {
    failures.push(`${importerPath}: scoped stylesheet importer is missing`)
    continue
  }

  const basename = stylesheetPath.split('/').at(-1)
  const importer = readFileSync(importerPath, 'utf8')
  const scopedStylesheet = readFileSync(stylesheetPath, 'utf8')
  const normalizedScopedStylesheet = scopedStylesheet.replace(/\r\n/g, '\n')
  const scopedBytes = Buffer.byteLength(normalizedScopedStylesheet, 'utf8')
  const scopedImportantCount =
    (scopedStylesheet.match(/!important/g) || []).length

  if (
    !importer.includes(`'./${basename}'`) &&
    !importer.includes(`"./${basename}"`)
  ) {
    failures.push(
      `${importerPath}: does not import sanctioned stylesheet ${basename}`,
    )
  }

  if (scopedBytes > 80 * 1024) {
    failures.push(
      `${stylesheetPath}: exceeds the 80 KiB scoped stylesheet budget`,
    )
  }

  if (scopedImportantCount > 24) {
    failures.push(
      `${stylesheetPath}: uses ${scopedImportantCount} !important declarations; scoped budget is 24`,
    )
  }

  if (!scopedStylesheet.includes('body.admin-app-mode .admin-inbox')) {
    failures.push(
      `${stylesheetPath}: is not visibly scoped to the Admin Inbox`,
    )
  }
}

const sourceFiles = walk('src').filter((file) => /\.(css|jsx|js)$/.test(file))
const retiredBasenames = retiredFiles.map((file) => file.split('/').at(-1))

for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf8')
  const displayPath = normalize(relative('.', file))

  for (const basename of retiredBasenames) {
    if (content.includes(basename)) {
      failures.push(`${displayPath}: still references retired UI stylesheet ${basename}`)
    }
  }

  for (const [stylesheetPath, importerPath] of sanctionedScopedUiFiles) {
    const basename = stylesheetPath.split('/').at(-1)

    if (content.includes(basename) && displayPath !== importerPath) {
      failures.push(
        `${displayPath}: cannot import scoped stylesheet ${basename}`,
      )
    }
  }
}

const adminCssFiles = [
  ...walk('src/components/admin'),
  ...walk('src/pages/admin'),
].filter((file) => file.endsWith('.css'))

for (const file of adminCssFiles) {
  const normalizedFile = normalize(relative('.', file))
  if (!allowedAdminCssFiles.has(normalizedFile)) {
    failures.push(`${normalizedFile}: unexpected admin UI stylesheet remains`)
  }
}

if (failures.length) {
  console.error('\nAdmin fresh UI check failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin fresh UI check passed (one authoritative stylesheet, ${sanctionedScopedUiFiles.size} governed scoped stylesheet; ${retiredFiles.length} retired stylesheets absent).`,
)
