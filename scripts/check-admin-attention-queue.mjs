import { readFileSync } from 'node:fs'

const appSource = readFileSync('src/App.jsx', 'utf8')
const frameSource = readFileSync('src/components/admin/AdminFrame.jsx', 'utf8')
const queueSource = readFileSync('src/pages/admin/AdminAttentionQueue.jsx', 'utf8')
const preloadSource = readFileSync('src/components/admin/adminRoutePreloaders.js', 'utf8')
const apiSource = readFileSync('src/lib/nativeApi.js', 'utf8')
const routeSource = readFileSync('server/src/routes/admin.routes.js', 'utf8')
const serviceSource = readFileSync('server/src/services/attentionQueue.service.js', 'utf8')
const permissionSource = readFileSync('server/src/services/teamManagement.service.js', 'utf8')
const stylesheet = readFileSync('src/pages/admin/AdminFreshUI.css', 'utf8')
const packageSource = readFileSync('package.json', 'utf8')

const failures = []

const routeTokens = [
  'loadAdminAttentionQueue',
  'const AdminAttentionQueue = lazy(loadAdminAttentionQueue)',
  "'/admin/attention': {",
  '<Route path="/admin/attention"',
]

const queueTokens = [
  'getAdminAttentionQueue()',
  'updateAdminAttentionItem(',
  'getMyTeamAccess()',
  'const canManage =',
  'const filteredTasks = useMemo',
  'const groupedTasks = useMemo',
  'const eligibleOwners = useMemo',
  'timingBucket(task)',
  'completeTask(task)',
  'const confirmAction = useAdminConfirm()',
  'Open client context',
  'aria-live="polite"',
]

const backendTokens = [
  "router.get('/attention-queue'",
  "router.patch('/attention-queue/:sourceType/:clientId/:itemId'",
  'listAttentionQueue(req.user)',
  "'attention_queue_item_updated'",
  "path.startsWith('/attention-queue')",
  "'lead_follow_up'::text AS source_type",
  "'care_action'::text AS source_type",
  'team_client_assignments',
]

const apiTokens = [
  'export async function getAdminAttentionQueue()',
  'export async function updateAdminAttentionItem(',
  '/api/admin/attention-queue/${sourceType}/${clientId}/${itemId}',
]

const navigationTokens = [
  "to: '/admin/attention'",
  "label: 'Attention Queue'",
  "module: 'clients'",
]

const preloadTokens = [
  'export const loadAdminAttentionQueue',
  "path === '/admin/attention'",
]

const stylesheetSelectors = [
  '.pwc-attention14-page',
  '.pwc-attention14-hero',
  '.pwc-attention14-role-card',
  '.pwc-attention14-metrics',
  '.pwc-attention14-controls',
  '.pwc-attention14-layout',
  '.pwc-attention14-item',
  '.pwc-attention14-editor',
  '.pwc-attention14-form',
  '.pwc-attention14-empty',
]

for (const token of routeTokens) {
  if (!appSource.includes(token)) failures.push(`App route wiring is missing: ${token}`)
}

for (const token of queueTokens) {
  if (!queueSource.includes(token)) failures.push(`Attention Queue safeguard is missing: ${token}`)
}

for (const token of backendTokens) {
  if (!(routeSource + serviceSource + permissionSource).includes(token)) {
    failures.push(`Attention Queue backend safeguard is missing: ${token}`)
  }
}

for (const token of apiTokens) {
  if (!apiSource.includes(token)) failures.push(`Attention Queue API helper is missing: ${token}`)
}

for (const token of navigationTokens) {
  if (!frameSource.includes(token)) failures.push(`Studio navigation is missing attention token: ${token}`)
}

for (const token of preloadTokens) {
  if (!preloadSource.includes(token)) failures.push(`Attention route preloading is missing: ${token}`)
}

for (const selector of stylesheetSelectors) {
  if (!stylesheet.includes(selector)) failures.push(`AdminFreshUI.css is missing Attention Queue selector: ${selector}`)
}

if (/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(queueSource)) {
  failures.push('AdminAttentionQueue uses a native browser dialog')
}

if (!packageSource.includes('node scripts/check-admin-attention-queue.mjs')) {
  failures.push('package.json lint command does not run the Attention Queue audit')
}

if (failures.length) {
  console.error('\nAdmin Attention Queue audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Admin Attention Queue audit passed (${routeTokens.length} route safeguards, ${queueTokens.length} queue safeguards, ${backendTokens.length} backend safeguards, ${stylesheetSelectors.length} visual selectors).`,
)
