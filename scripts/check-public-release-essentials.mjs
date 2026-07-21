import { existsSync, readFileSync } from 'node:fs'

const app = readFileSync('src/App.jsx', 'utf8')
const footer = readFileSync('src/components/SiteFooter.jsx', 'utf8')
const privacy = readFileSync('src/pages/PrivacyPolicy.jsx', 'utf8')
const terms = readFileSync('src/pages/TermsAndConditions.jsx', 'utf8')
const styles = readFileSync('src/pages/Legal.css', 'utf8')
const robots = readFileSync('public/robots.txt', 'utf8')
const sitemapXml = readFileSync('public/sitemap.xml', 'utf8')
const sitemapText = readFileSync('public/sitemap.txt', 'utf8')

const failures = []
const requiredFiles = [
  'public/privacy-policy-2026.pdf',
  'public/terms-and-conditions-2026.pdf',
]
const requiredAppTokens = [
  "const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'))",
  "const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions.jsx'))",
  "'/privacy-policy': {",
  "'/terms-and-conditions': {",
  '<Route path="/privacy-policy" element={<PrivacyPolicy />} />',
  '<Route path="/terms-and-conditions" element={<TermsAndConditions />} />',
]
const requiredPublicPaths = [
  '/',
  '/experiences',
  '/radiance-reclaimed',
  '/color-analysis',
  '/style-analysis',
  '/blend-cosmetics',
  '/resources',
  '/resources/what-is-color-analysis',
  '/resources/what-is-personal-style-analysis',
  '/resources/fashion-advice-for-women-over-40',
  '/resources/rebuild-confidence-through-personal-style',
  '/resources/confidence-coaching-for-women',
  '/professionals',
  '/podcast',
  '/teen-programs',
  '/about',
  '/contact',
  '/privacy-policy',
  '/terms-and-conditions',
]

for (const path of requiredFiles) {
  if (!existsSync(path)) failures.push(`Missing approved legal document: ${path}`)
}
for (const token of requiredAppTokens) {
  if (!app.includes(token)) failures.push(`App is missing public legal route safeguard: ${token}`)
}
for (const token of ['to="/privacy-policy"', 'to="/terms-and-conditions"']) {
  if (!footer.includes(token)) failures.push(`Footer is missing legal destination: ${token}`)
}
for (const [name, source, tokens] of [
  ['Privacy Policy', privacy, ['id="main-content"', 'privacy-policy-2026.pdf', 'hello@powerwithinmovement.com']],
  ['Terms & Conditions', terms, ['id="main-content"', 'terms-and-conditions-2026.pdf', 'hello@powerwithinmovement.com']],
]) {
  for (const token of tokens) {
    if (!source.includes(token)) failures.push(`${name} page is missing safeguard: ${token}`)
  }
}
for (const token of ['@media(max-width:800px)', '@media(forced-colors:active)', '.legal-document']) {
  if (!styles.includes(token)) failures.push(`Legal stylesheet is missing responsive/accessibility safeguard: ${token}`)
}
for (const token of ['Disallow: /api/', 'Disallow: /admin/', 'Disallow: /client-portal/', 'https://www.kimmittelstadt.com/sitemap.xml']) {
  if (!robots.includes(token)) failures.push(`robots.txt is missing safeguard: ${token}`)
}

const xmlPaths = new Set([...sitemapXml.matchAll(/<loc>https:\/\/www\.kimmittelstadt\.com([^<]*)<\/loc>/g)].map((match) => match[1] || '/'))
const textPaths = new Set(sitemapText.trim().split(/\r?\n/).map((url) => new URL(url).pathname))
for (const path of requiredPublicPaths) {
  if (!xmlPaths.has(path)) failures.push(`sitemap.xml is missing public route: ${path}`)
  if (!textPaths.has(path)) failures.push(`sitemap.txt is missing public route: ${path}`)
}
for (const forbidden of ['/admin/', '/client-portal/', '/appointments']) {
  if (sitemapXml.includes(forbidden) || sitemapText.includes(forbidden)) {
    failures.push(`Public sitemap includes private or retired route: ${forbidden}`)
  }
}
if (xmlPaths.size !== textPaths.size || [...xmlPaths].some((path) => !textPaths.has(path))) {
  failures.push('XML and text sitemap route sets do not match.')
}

if (failures.length) {
  console.error('\nPublic release essentials audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Public release essentials audit passed (${requiredPublicPaths.length} indexed routes, 2 legal pages, 2 approved PDFs, private-route crawler protections).`)
