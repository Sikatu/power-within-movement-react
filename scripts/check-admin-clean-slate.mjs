import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const retiredFiles = [
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

const requiredFiles = [
  'src/pages/admin/AdminCleanSlate.css',
  'src/pages/admin/AdminCleanSlateFoundation.css',
  'src/components/admin/AdminCleanSlateFrame.css',
]

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const failures = []

for (const file of retiredFiles) {
  if (existsSync(file)) failures.push(`${file}: retired stylesheet still exists`)
}

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`${file}: clean-slate stylesheet is missing`)
}

const retiredBasenames = retiredFiles.map((file) => file.split('/').at(-1))
const sourceFiles = walk('src').filter((file) => /\.(css|jsx|js)$/.test(file))

for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf8')
  const displayPath = relative('.', file)

  for (const basename of retiredBasenames) {
    if (content.includes(basename)) {
      failures.push(`${displayPath}: still references retired stylesheet ${basename}`)
    }
  }

  if (content.includes('@layer pwc-admin-legacy')) {
    failures.push(`${displayPath}: legacy admin cascade layer is still present`)
  }
}

if (failures.length) {
  console.error('\nAdmin true clean-slate check failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Admin true clean-slate check passed (${retiredFiles.length} retired stylesheets deleted).`)
