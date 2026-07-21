import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const chromeSource = read('src/components/ClientPortalChrome.jsx')
const chromeStyles = read('src/components/ClientPortalChrome.css')
const centerSource = read('src/components/NotificationCenter.jsx')
const centerStyles = read('src/components/NotificationCenter.css')
const apiSource = read('src/lib/nativeApi.js')
const publicRoutes = read('server/src/routes/public.routes.js')
const serviceSource = read('server/src/services/notificationCenter.service.js')
const notificationMigration = read('server/scripts/ensure-notification-center.cjs')
const adminFrame = read('src/components/admin/AdminFrame.jsx')
const packageSource = read('package.json')
const failures = []

const requiredTokens = [
  [chromeSource, "import NotificationCenter from './NotificationCenter'", 'shared Notification Center import'],
  [chromeSource, '<NotificationCenter mode="client" />', 'global client Updates access'],
  [chromeSource, 'portal-chrome-website-link', 'compact mobile website access'],
  [centerSource, "const isClient = mode === 'client'", 'client-aware center mode'],
  [centerSource, "isClient ? 'Updates' : 'Alerts'", 'client-friendly trigger language'],
  [centerSource, "isClient ? 'Your Updates' : 'Notification Center'", 'client-friendly drawer title'],
  [centerSource, 'aria-haspopup="dialog"', 'accessible dialog trigger'],
  [centerSource, 'aria-modal="true"', 'modal drawer semantics'],
  [centerSource, 'role="tab"', 'accessible update tabs'],
  [centerSource, 'aria-selected={view ===', 'selected tab state'],
  [centerSource, "event.key === 'Escape'", 'Escape dismissal'],
  [centerSource, "event.key !== 'Tab'", 'keyboard focus containment'],
  [centerSource, "['ArrowLeft', 'ArrowRight', 'Home', 'End']", 'keyboard tab navigation'],
  [centerSource, "document.body.style.overflow = 'hidden'", 'background scroll lock'],
  [centerSource, 'triggerRef.current?.focus()', 'focus restoration'],
  [centerSource, "const allowedRoot = mode === 'client' ? '/client-portal' : '/admin'", 'role-safe action roots'],
  [centerSource, 'safeNotificationPath(notification.actionUrl, mode)', 'safe notification navigation'],
  [centerSource, 'className="pwc-notification-open"', 'keyboard-native notification action'],
  [centerStyles, 'phase-44-client-notification-center-start', 'responsive Notification Center styles'],
  [centerStyles, '@media (forced-colors: active)', 'high-contrast support'],
  [centerStyles, '@media (prefers-reduced-motion: reduce)', 'reduced-motion support'],
  [chromeStyles, 'phase-44-client-notification-link-start', 'compact mobile portal header'],
]

for (const [source, token, label] of requiredTokens) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const preservedCapabilities = [
  [apiSource, "apiRequest('/api/public/client-portal/notifications/summary')", 'client unread summary'],
  [apiSource, 'getClientNotifications(filters = {})', 'filtered client notifications'],
  [apiSource, 'markClientNotificationRead(id)', 'single-notification read state'],
  [apiSource, 'markAllClientNotificationsRead()', 'bulk read state'],
  [apiSource, 'dismissClientNotification(id)', 'single-notification dismissal'],
  [apiSource, 'clearReadClientNotifications()', 'read-notification cleanup'],
  [apiSource, 'getClientNotificationPreferences()', 'client preference loading'],
  [apiSource, 'updateClientNotificationPreferences(payload)', 'client preference saving'],
  [publicRoutes, "get('/client-portal/notifications/summary', requireClientPortalUser", 'authenticated client summary route'],
  [publicRoutes, "patch('/client-portal/notifications/preferences', requireClientPortalUser", 'authenticated preference route'],
  [publicRoutes, "'notification_preferences_updated'", 'preference audit logging'],
  [serviceSource, 'WHERE recipient_user_id = $1', 'recipient ownership scoping'],
  [serviceSource, 'AND dismissed_at IS NULL', 'dismissal privacy state'],
  [serviceSource, 'AND expires_at > now()', 'notification expiry'],
  [notificationMigration, 'pwc_notify_conversation_message', 'private-message notification producer'],
  [notificationMigration, 'pwc_notify_booking_status', 'session notification producer'],
  [notificationMigration, 'pwc_notify_client_resource', 'resource notification producer'],
  [notificationMigration, 'pwc_notify_course_access', 'learning notification producer'],
  [notificationMigration, 'pwc_notify_membership_enrollment', 'membership notification producer'],
  [notificationMigration, 'pwc_notify_encouragement_publish', 'encouragement notification producer'],
  [notificationMigration, 'pwc_notify_circle_report', 'community notification producer'],
  [adminFrame, '<NotificationCenter mode="admin" />', 'existing admin Notification Center'],
]

for (const [source, token, capability] of preservedCapabilities) {
  if (!source.includes(token)) failures.push(`Phase 44 no longer preserves ${capability}`)
}

if (centerSource.includes('window.location.assign(notification.actionUrl)')) {
  failures.push('Notification actions still permit an untrusted external redirect')
}

if (!packageSource.includes('node scripts/check-phase44-client-notification-center.mjs')) {
  failures.push('package.json does not run the Phase 44 Notification Center audit')
}

if (failures.length) {
  console.error('\nPhase 44 client Notification Center audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  'Phase 44 client Notification Center audit passed (global Updates access, recipient-scoped APIs, real activity producers, safe internal actions, simple preferences, keyboard focus, and responsive accessibility).',
)
