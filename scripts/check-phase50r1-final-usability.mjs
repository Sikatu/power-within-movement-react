import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const styles = read('src/pages/admin/AdminFreshUI.css')
const circle = read('src/pages/admin/AdminCircleCommunity.jsx')
const assets = read('src/pages/admin/AdminAssetVault.jsx')
const onboarding = read('src/pages/admin/AdminOnboardingStudio.jsx')
const leads = read('src/pages/admin/AdminLeadPipeline.jsx')
const packageSource = read('package.json')
const visualAudit = read('scripts/check-admin-visual-coverage.mjs')
const docs = read('docs/phase50r1-final-usability-repair.md')
const failures = []

const requirements = [
  [styles, 'phase-50r1-final-usability-repair-start', 'scoped final usability layer'],
  [styles, ') :where(h1, h2)', 'readable descendant headings on dark workspace heroes'],
  [styles, '.learning-library-header', 'Programs workspace hierarchy'],
  [styles, '.membership-circle-header', 'Memberships workspace hierarchy'],
  [styles, '.circle-admin-header', 'Circle workspace hierarchy'],
  [styles, '.pwc-assets26-hero', 'Asset Vault hierarchy'],
  [styles, '.automation-studio-header', 'Automation workspace hierarchy'],
  [styles, '.onboarding-studio-header', 'Onboarding workspace hierarchy'],
  [styles, '.lead-pipeline-workbench', 'Lead master-detail workbench'],
  [styles, '.admin-inbox__workspace', 'compact Inbox workspace'],
  [styles, '.pwc-scheduler-inbox-layout', 'Session master-detail workbench'],
  [styles, '.pwc-phase35-create-panel', 'Letters creation alignment'],
  [styles, '.team-management-layout', 'Team master-detail layout'],
  [styles, '.founder-home__shell', 'compact Founder workspace'],
  [circle, 'const [isComposerOpen, setIsComposerOpen] = useState(false)', 'intentional Circle composer disclosure'],
  [circle, 'className="circle-composer-welcome"', 'Circle creation welcome state'],
  [assets, 'const [showBulkAssignment, setShowBulkAssignment] = useState(false)', 'collapsed bulk asset assignment'],
  [assets, 'aria-expanded={showBulkAssignment}', 'accessible bulk assignment disclosure'],
  [assets, 'className="pwc-assets26-bulk-workspace"', 'on-demand bulk assignment workspace'],
  [onboarding, 'const [isOnboardingEditorOpen, setIsOnboardingEditorOpen] = useState(false)', 'intentional onboarding disclosure'],
  [onboarding, 'className="onboarding-start-card"', 'onboarding welcome state'],
  [leads, 'className="lead-pipeline-workbench"', 'Lead list and details grouped together'],
  [packageSource, '"admin:qa:phase50r1"', 'focused final usability QA command'],
  [visualAudit, 'const stylesheetBudget = 568 * 1024', 'bounded stylesheet source budget'],
  [docs, 'progressive disclosure', 'usability design boundary documentation'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const preservedCapabilities = [
  [circle, 'createAdminCirclePost(', 'Circle post creation'],
  [circle, 'updateAdminCirclePost(', 'Circle post editing'],
  [circle, 'moderateAdminCircleComment(', 'Circle moderation'],
  [assets, 'assignAssetVaultAsset(', 'single-client asset delivery'],
  [assets, 'assignAssetVaultAssetToClients(', 'selected-client asset delivery'],
  [assets, 'assignAssetVaultAssetToAllClients(', 'all-client asset delivery'],
  [onboarding, 'startAdminClientOnboarding(', 'client onboarding creation'],
  [onboarding, 'updateAdminClientOnboarding(', 'client onboarding editing'],
  [leads, 'updateAdminLead(', 'lead editing'],
  [leads, 'createAdminLeadFollowUp(', 'lead follow-up creation'],
]

for (const [source, token, label] of preservedCapabilities) {
  if (!source.includes(token)) failures.push(`${label} is no longer preserved`)
}

if (!styles.includes('@media (max-width: 820px)') || !styles.includes('@media (max-width: 560px)')) {
  failures.push('responsive tablet and mobile safeguards are missing')
}

if (failures.length) {
  console.error('\nPhase 50R1 final usability audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Phase 50R1 final usability audit passed (12 streamlined workspaces, 4 progressive-disclosure safeguards, responsive master-detail layouts, and preserved operational capabilities).',
)
