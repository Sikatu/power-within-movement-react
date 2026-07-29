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

const authoritativeUiEntry = 'src/pages/admin/AdminFreshUI.entry.css'
const authoritativeUiModules = new Set([
  authoritativeUiEntry,
  'src/pages/admin/AdminFreshUI.css',
  'src/pages/admin/AdminFreshUI.enhancements.css',
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

for (const file of authoritativeUiModules) {
  if (!existsSync(file)) failures.push(`${file}: admin design-system module is missing`)
}

if (existsSync(authoritativeUiEntry)) {
  const entrySource = readFileSync(authoritativeUiEntry, 'utf8').replace(/\r\n?/g, '\n')
  const expectedEntry = "@import './AdminFreshUI.css';\n@import './AdminFreshUI.enhancements.css';\n"
  if (entrySource !== expectedEntry) {
    failures.push(`${authoritativeUiEntry}: ordered core and enhancement imports changed`)
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

  if (/\.(jsx|js)$/.test(file) && content.includes('AdminFreshUI.css')) {
    failures.push(`${displayPath}: imports the core module directly instead of ${authoritativeUiEntry}`)
  }
  if (/\.(jsx|js)$/.test(file) && content.includes('AdminFreshUI.enhancements.css')) {
    failures.push(`${displayPath}: imports the enhancement module directly instead of ${authoritativeUiEntry}`)
  }
}

const adminCssFiles = [
  ...walk('src/components/admin'),
  ...walk('src/pages/admin'),
].filter((file) => file.endsWith('.css'))

for (const file of adminCssFiles) {
  const normalizedFile = normalize(relative('.', file))
  if (!authoritativeUiModules.has(normalizedFile)) {
    failures.push(`${normalizedFile}: unexpected admin UI stylesheet remains`)
  }
}

if (failures.length) {
  console.error('\nAdmin fresh UI check failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin fresh UI check passed (one ordered entry, ${authoritativeUiModules.size - 1} owned modules, and ${retiredFiles.length} retired stylesheets absent).`,
)
