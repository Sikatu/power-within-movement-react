import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const appPath = path.join(root, 'src', 'App.jsx')
const signaturePagePath = path.join(root, 'src', 'pages', 'SignatureExperiencePage.jsx')

const appSource = fs.readFileSync(appPath, 'utf8')
const signaturePageSource = fs.readFileSync(signaturePagePath, 'utf8')

const deferredRoutes = [
  'About',
  'Contact',
  'ClientPortalInvite',
  'ClientPortalLogin',
  'ClientPortalAccount',
  'ClientPortalDashboard',
  'ClientPortalCircle',
  'ClientPortalJourney',
  'ClientPortalLearning',
  'ClientPortalMembership',
  'ClientPortalMessages',
  'ClientPortalResources',
  'ClientPortalSessions',
  'Experiences',
  'Podcast',
  'PrivacyPolicy',
  'Professionals',
  'RadianceReclaimed',
  'ResourceArticle',
  'Resources',
  'SignatureExperiencePage',
  'TeenPrograms',
  'TermsAndConditions',
]

const failures = []

for (const component of deferredRoutes) {
  const lazyPattern = `const ${component} = lazy(() => import('./pages/${component}.jsx'))`
  const eagerPattern = `import ${component} from './pages/${component}.jsx'`

  if (!appSource.includes(lazyPattern)) {
    failures.push(`${component} must remain route-split through React.lazy.`)
  }

  if (appSource.includes(eagerPattern)) {
    failures.push(`${component} must not return to the initial application bundle.`)
  }
}

const portalDeferredCount = deferredRoutes.filter((component) => component.startsWith('ClientPortal')).length

if (!appSource.includes("import Home from './pages/Home.jsx'")) {
  failures.push('The primary Home route must remain eager for an immediate landing experience.')
}

if (appSource.includes("const Home = lazy(() => import('./pages/Home.jsx'))")) {
  failures.push('The primary Home route must not be deferred.')
}

if (!appSource.includes('<Suspense fallback={<RouteLoadingFallback internal={isInternalRoute} />}>')) {
  failures.push('Deferred routes must retain the accessible branded loading fallback.')
}

for (const experienceKey of ['color', 'style', 'makeup']) {
  if (!appSource.includes(`experienceKey="${experienceKey}"`)) {
    failures.push(`The ${experienceKey} experience route must use its deferred experience key.`)
  }
}

if (!signaturePageSource.includes("import { signatureExperiences } from '../data/signatureExperiences.js'")) {
  failures.push('Signature experience data must load with the deferred experience route.')
}

if (!signaturePageSource.includes('const experience = signatureExperiences[experienceKey]')) {
  failures.push('The deferred signature route must resolve its experience from experienceKey.')
}

if (failures.length) {
  console.error('Phase 54 pre-deployment performance audit failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Phase 54 pre-deployment performance audit passed (${deferredRoutes.length} deferred secondary routes, ${portalDeferredCount} deferred client routes, eager Home, accessible loading fallback, and deferred experience data).`,
)
