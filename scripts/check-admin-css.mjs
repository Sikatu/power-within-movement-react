import { readFileSync } from 'node:fs'

const legacyFiles = [
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

const modernFiles = [
  'src/components/admin/AdminFrameModern.css',
  'src/components/admin/AdminProductionPolishPhase9.css',
  'src/pages/admin/AdminFoundationModern.css',
  'src/pages/admin/AdminModuleElevation.css',
  'src/pages/admin/AdminOperationsElevation.css',
  'src/pages/admin/AdminClientsPhase5.css',
  'src/pages/admin/AdminCommunicationPhase6.css',
  'src/pages/admin/AdminFounderSchedulingPhase7.css',
  'src/pages/admin/AdminDeveloperOperationsPhase8.css',
]

const failures = []

for (const file of legacyFiles) {
  const css = readFileSync(file, 'utf8')

  if (!css.includes('@layer pwc-admin-legacy {')) {
    failures.push(`${file}: legacy stylesheet is not quarantined in pwc-admin-legacy`)
  }

  if (css.includes('!important')) {
    failures.push(`${file}: legacy stylesheet must not contain !important`)
  }
}

for (const file of modernFiles) {
  const css = readFileSync(file, 'utf8')

  if (css.includes('@layer pwc-admin-legacy {')) {
    failures.push(`${file}: modern stylesheet was accidentally placed in the legacy layer`)
  }
}

if (failures.length > 0) {
  console.error('\nAdmin CSS cascade check failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Admin CSS cascade check passed (${legacyFiles.length} legacy files quarantined).`)
