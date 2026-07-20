import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const adminSource = read('src/pages/admin/AdminEncouragements.jsx')
const clientSource = read('src/pages/ClientPortalMessages.jsx')
const clientStyles = read('src/pages/ClientPortalWorkspace.css')
const adminStyles = read('src/pages/admin/AdminFreshUI.css')
const founderSource = read('src/pages/admin/AdminFoundersView.jsx')
const apiSource = read('src/lib/nativeApi.js')
const adminRoutes = read('server/src/routes/admin.routes.js')
const publicRoutes = read('server/src/routes/public.routes.js')
const migration = read('server/scripts/ensure-client-messages.cjs')
const notificationMigration = read('server/scripts/ensure-notification-center.cjs')
const orderedMigrations = read('server/scripts/run-ordered-migrations.cjs')
const packageSource = read('package.json')
const serverPackageSource = read('server/package.json')
const failures = []

const requiredTokens = [
  [adminSource, '<h1>Client Messages</h1>', 'streamlined admin workspace title'],
  [adminSource, "id: 'encouragement'", 'encouragement message choice'],
  [adminSource, "id: 'announcement'", 'portal announcement choice'],
  [adminSource, 'name="messageType"', 'message type composer control'],
  [adminSource, 'filters.messageType', 'message library type filter'],
  [adminSource, 'Who should receive this?', 'preserved audience choice'],
  [adminSource, 'Schedule for later', 'preserved scheduled delivery'],
  [adminSource, 'Client reads', 'preserved read insight'],
  [adminStyles, 'phase-45-client-messages-start', 'responsive admin message styling'],
  [clientSource, 'Notes &amp; Updates', 'calm client-facing tab label'],
  [clientSource, 'client-message-filter', 'simple client message filters'],
  [clientSource, "searchParams.get('tab') === 'updates'", 'direct notification destination'],
  [clientSource, "message.message_type === 'announcement'", 'distinct announcement reading state'],
  [clientStyles, 'phase-45-client-message-reading-start', 'responsive client reading styling'],
  [founderSource, '/admin/encouragements?view=compose&type=encouragement', 'Founder quick message action'],
  [apiSource, "params.set('messageType', filters.messageType)", 'typed admin API filtering'],
  [adminRoutes, 'messageType: z.enum(CLIENT_MESSAGE_TYPES)', 'server-side message type validation'],
  [adminRoutes, 'ep.message_type = $3', 'server-side typed message filtering'],
  [publicRoutes, 'ep.message_type,', 'client message type delivery'],
  [migration, 'ADD COLUMN IF NOT EXISTS message_type', 'additive message type migration'],
  [migration, "CHECK (message_type IN ('encouragement', 'announcement'))", 'message type database constraint'],
  [migration, "NEW.visibility = 'all_members'", 'all-client notification delivery'],
  [migration, "'/client-portal/messages?tab=updates'", 'notification deep link'],
  [notificationMigration, "WHEN 'announcement' THEN 'high'", 'announcement notification importance'],
  [orderedMigrations, "'db:migrate-client-messages'", 'ordered Phase 45 migration'],
  [serverPackageSource, '"db:migrate-client-messages"', 'Phase 45 database command'],
]

for (const [source, token, label] of requiredTokens) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const safetyTokens = [
  [adminRoutes, "requireAdmin", 'admin authentication'],
  [publicRoutes, "requireClientPortalUser", 'client authentication'],
  [publicRoutes, 'er.client_profile_id = $1', 'client recipient ownership'],
  [migration, 'ADD COLUMN IF NOT EXISTS', 'non-destructive schema upgrade'],
  [migration, 'ON encouragement_posts(message_type, status, published_at DESC)', 'typed message index'],
]

for (const [source, token, label] of safetyTokens) {
  if (!source.includes(token)) failures.push(`Phase 45 no longer preserves ${label}`)
}

if (/DROP\s+TABLE|TRUNCATE\s+/i.test(migration)) {
  failures.push('Phase 45 migration contains a destructive table operation')
}

if (!packageSource.includes('node scripts/check-phase45-client-messages.mjs')) {
  failures.push('package.json does not run the Phase 45 client message audit')
}

if (failures.length) {
  console.error('\nPhase 45 client messages audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Phase 45 client messages audit passed (encouragements, portal announcements, audience privacy, scheduling, read insights, all-client notifications, Founder quick access, and responsive client reading).',
)
