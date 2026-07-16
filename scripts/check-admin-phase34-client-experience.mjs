import { readFileSync } from 'node:fs'

const assetsSource = readFileSync('src/pages/admin/AdminAssetVault.jsx', 'utf8')
const encouragementsSource = readFileSync('src/pages/admin/AdminEncouragements.jsx', 'utf8')
const programsSource = readFileSync('src/pages/admin/AdminLearningLibrary.jsx', 'utf8')
const membershipsSource = readFileSync('src/pages/admin/AdminMembershipCircle.jsx', 'utf8')
const circleSource = readFileSync('src/pages/admin/AdminCircleCommunity.jsx', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')
const failures = []

const requiredTokens = [
  [assetsSource, "const [workspaceView, setWorkspaceView] = useState('library')", 'Asset Vault library-first mode'],
  [assetsSource, "const [assetDetailView, setAssetDetailView] = useState('clients')", 'Asset Vault client-first detail'],
  [assetsSource, 'aria-label="Asset Vault workspace"', 'Asset Vault primary tabs'],
  [assetsSource, 'aria-label="Selected asset workspace"', 'Asset Vault detail tabs'],
  [assetsSource, "assetDetailView === 'details'", 'Asset Vault details mode'],
  [assetsSource, "assetDetailView === 'clients'", 'Asset Vault delivery mode'],
  [assetsSource, "assetDetailView === 'reuse'", 'Asset Vault reuse mode'],
  [encouragementsSource, "const [workspaceView, setWorkspaceView] = useState('library')", 'Encouragement library-first mode'],
  [encouragementsSource, 'aria-label="Encouragement workspace"', 'Encouragement workspace tabs'],
  [encouragementsSource, "workspaceView === 'compose'", 'Encouragement compose mode'],
  [encouragementsSource, "workspaceView === 'library'", 'Encouragement message mode'],
  [programsSource, "const [activeTab, setActiveTab] = useState('access')", 'Programs client-access default'],
  [programsSource, "['access', 'Client access']", 'Programs task labels'],
  [membershipsSource, "const [activeTab, setActiveTab] = useState('members')", 'Membership member-first default'],
  [membershipsSource, "['members', 'Members']", 'Membership task labels'],
  [circleSource, "report.status === 'open'", 'Circle report-first selection'],
  [circleSource, 'Publish member posts and handle conversations that need care.', 'Circle focused guidance'],
]

for (const [source, token, label] of requiredTokens) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const preservedActions = [
  [assetsSource, 'uploadAssetVaultFile(', 'upload a private asset'],
  [assetsSource, 'assignAssetVaultAsset(', 'assign one client'],
  [assetsSource, 'assignAssetVaultAssetToClients(', 'assign selected clients'],
  [assetsSource, 'assignAssetVaultAssetToAllClients(', 'assign all clients'],
  [assetsSource, 'uploadAssetVaultVersion(', 'upload an asset version'],
  [encouragementsSource, 'createAdminEncouragement(', 'create an encouragement'],
  [encouragementsSource, 'publishAdminEncouragement(', 'publish an encouragement'],
  [programsSource, 'updateAdminLearningAccess(', 'save program access'],
  [membershipsSource, 'upsertAdminMembershipEnrollment(', 'enroll a member'],
  [circleSource, 'moderateAdminCircleComment(', 'moderate a Circle comment'],
  [circleSource, 'reviewAdminCircleReport(', 'review a Circle report'],
]

for (const [source, token, action] of preservedActions) {
  if (!source.includes(token)) failures.push(`Phase 34 no longer exposes the action to ${action}`)
}

if (!packageSource.includes('node scripts/check-admin-phase34-client-experience.mjs')) {
  failures.push('package.json does not run the Phase 34 Client Experience audit')
}

if (failures.length) {
  console.error('\nAdmin Phase 34 Client Experience audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Admin Phase 34 Client Experience audit passed (library-first resources, focused asset delivery, focused encouragements, client-first Programs and Memberships, report-aware Circle, and preserved backend actions).',
)
