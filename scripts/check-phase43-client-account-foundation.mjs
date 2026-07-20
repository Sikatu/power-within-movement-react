import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const appSource = read('src/App.jsx')
const chromeSource = read('src/components/ClientPortalChrome.jsx')
const chromeStyles = read('src/components/ClientPortalChrome.css')
const accountSource = read('src/pages/ClientPortalAccount.jsx')
const accountStyles = read('src/pages/ClientPortalAccount.css')
const apiSource = read('src/lib/nativeApi.js')
const publicRoutes = read('server/src/routes/public.routes.js')
const packageSource = read('package.json')
const failures = []

const requiredTokens = [
  [appSource, "import ClientPortalAccount from './pages/ClientPortalAccount.jsx'", 'Account page import'],
  [appSource, "'/client-portal/account': {", 'private Account metadata'],
  [appSource, '<Route path="/client-portal/account" element={<ClientPortalAccount />} />', 'private Account route'],
  [chromeSource, '<NavLink to="/client-portal/account">Account</NavLink>', 'global Account access'],
  [accountSource, "const [accountView, setAccountView] = useState('profile')", 'single-task Account state'],
  [accountSource, 'aria-label="Account tasks"', 'accessible Account task switcher'],
  [accountSource, "accountView === 'profile'", 'focused Profile task'],
  [accountSource, "accountView === 'onboarding'", 'focused Onboarding task'],
  [accountSource, "accountView === 'security'", 'focused Security task'],
  [accountSource, 'onboardingFields.map((field)', 'dynamic onboarding fields'],
  [accountSource, "field.fieldType === 'multiselect'", 'multiple-choice onboarding'],
  [accountSource, "field.fieldType === 'checkbox'", 'consent onboarding'],
  [accountSource, 'Save for Later', 'onboarding draft action'],
  [accountSource, 'Submit Onboarding', 'onboarding submission action'],
  [accountSource, 'aria-label="Password requirements"', 'visible password requirements'],
  [chromeStyles, 'phase-43-client-account-link-start', 'responsive Account access styles'],
  [accountStyles, 'phase-43-client-account-foundation-start', 'responsive Account workspace styles'],
]

for (const [source, token, label] of requiredTokens) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const preservedCapabilities = [
  [accountSource, 'getClientPortalMe()', 'private profile loading'],
  [accountSource, 'getClientPortalOnboarding()', 'private onboarding loading'],
  [accountSource, 'updateClientPortalProfile(profileForm)', 'profile updates'],
  [accountSource, 'saveClientPortalOnboarding(answers)', 'onboarding drafts'],
  [accountSource, 'submitClientPortalOnboarding(answers)', 'onboarding submission'],
  [accountSource, 'changeClientPortalPassword(passwordForm)', 'password changes'],
  [accountSource, 'logoutClientPortal()', 'secure client sign out'],
  [accountSource, "navigate('/client-portal/login', { replace: true })", 'expired-session recovery'],
  [apiSource, "apiRequest('/api/public/client-portal/profile'", 'profile API contract'],
  [apiSource, "apiRequest('/api/public/client-portal/change-password'", 'password API contract'],
  [apiSource, "apiRequest('/api/public/client-portal/onboarding'", 'onboarding API contract'],
  [publicRoutes, "'client_portal_profile_updated'", 'profile audit logging'],
  [publicRoutes, "'client_portal_password_changed'", 'security audit logging'],
  [publicRoutes, "'/client-portal/change-password',\n  passwordChangeRateLimit,", 'client password-change rate limiting'],
  [publicRoutes, "'client_onboarding_draft_saved'", 'onboarding draft audit logging'],
  [publicRoutes, "'client_onboarding_submitted'", 'onboarding submission audit logging'],
  [publicRoutes, 'session_version = COALESCE(session_version, 1) + 1', 'password session rotation'],
]

for (const [source, token, capability] of preservedCapabilities) {
  if (!source.includes(token)) failures.push(`Phase 43 no longer preserves ${capability}`)
}

if (!packageSource.includes('node scripts/check-phase43-client-account-foundation.mjs')) {
  failures.push('package.json does not run the Phase 43 Account audit')
}

if (failures.length) {
  console.error('\nPhase 43 client Account foundation audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Phase 43 client Account foundation audit passed (focused Profile, dynamic Onboarding, clear Security, secure APIs, private audit logs, session rotation, and responsive access).',
)
