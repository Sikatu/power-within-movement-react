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
}

const adminCssFiles = [
  ...walk('src/components/admin'),
  ...walk('src/pages/admin'),
].filter((file) => file.endsWith('.css'))

for (const file of adminCssFiles) {
  const normalizedFile = normalize(relative('.', file))
  if (normalizedFile !== authoritativeUiFile) {
    failures.push(`${normalizedFile}: unexpected admin UI stylesheet remains`)
  }
}

if (failures.length) {
  console.error('\nAdmin fresh UI check failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin fresh UI check passed (one authoritative stylesheet; ${retiredFiles.length} retired stylesheets absent).`,
)
