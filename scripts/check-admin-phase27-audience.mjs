import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const sources = {
  migration: read('server/scripts/ensure-newsletter-audience.cjs'),
  service: read('server/src/services/newsletterAudience.service.js'),
  routes: read('server/src/routes/newsletterAudience.routes.js'),
  publicRoutes: read('server/src/routes/public.routes.js'),
  page: read('src/pages/admin/AdminAudience.jsx'),
  home: read('src/pages/Home.jsx'),
  api: read('src/lib/nativeApi.js'),
  app: read('src/App.jsx'),
  nav: read('src/components/admin/AdminFrame.jsx'),
  tests: read('server/tests/newsletter-audience.test.cjs'),
  package: read('package.json'),
}

const requirements = {
  migration: [
    'newsletter_consent_events',
    'newsletter_suppressions',
    'newsletter_imports',
    'newsletter_segments',
    'newsletter_send_history',
    "'pending'",
    "'suppressed'",
    'ON DELETE SET NULL',
  ],
  service: [
    'normalizeEmail',
    'parseAudienceCsv',
    'mergeDuplicateRecipients',
    'getActiveSuppression',
    'suppressionBlocked',
    "suppression.reason === 'unsubscribed' && explicitConsent",
  ],
  routes: [
    "router.get('/summary'",
    "router.get('/subscribers'",
    "router.get('/preview-count'",
    "router.post('/subscribers/bulk'",
    "router.post('/imports/csv'",
    "router.post('/clients/:clientProfileId'",
    "router.post('/bulk/tags'",
    "router.post('/bulk/segments'",
    'consentConfirmed: z.literal(true)',
    "s.consent_status = 'granted'",
  ],
  publicRoutes: [
    "router.post('/newsletter/subscribe'",
    'publicSubmissionRateLimit',
    'consent: z.literal(true)',
    "source: 'website_home'",
  ],
  page: [
    'Newsletter Audience',
    'Audience Preview',
    'Consent History',
    'Send History',
    'explicit newsletter consent',
    'CSV file',
    'bulkUpdateNewsletterAudienceTags',
    'bulkUpdateNewsletterAudienceSegments',
  ],
  home: ['subscribePublicNewsletter', 'newsletter-consent'],
  api: ['/api/admin/audience', '/api/public/newsletter/subscribe'],
  app: ['/admin/audience', 'AdminAudience'],
  nav: ['/admin/audience', 'Newsletter Audience'],
  tests: ['case-insensitive duplicate recipients', 'delivery eligibility requires'],
  package: ['check-admin-phase27-audience.mjs', 'admin:qa:phase27'],
}

const failures = []
for (const [sourceName, tokens] of Object.entries(requirements)) {
  for (const token of tokens) {
    if (!sources[sourceName].includes(token)) failures.push(`${sourceName} is missing: ${token}`)
  }
}

if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(sources.page)) {
  failures.push('Audience workspace uses a native browser dialog')
}

if (failures.length) {
  console.error('\nAdmin Phase 27 newsletter audience audit failed:\n')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`Admin Phase 27 newsletter audience audit passed (${Object.values(requirements).flat().length} protected capabilities).`)
