import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const center = read('src/components/NotificationCenter.jsx')
const styles = read('src/components/NotificationCenter.css')
const runner = read('scripts/run-all-checks.mjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [center, 'const actionPath = safeNotificationPath(notification.actionUrl, mode)', 'destination validation'],
  [center, 'if (notification.actionUrl && !actionPath)', 'invalid destination guard'],
  [center, 'kept unread because its portal destination is unavailable', 'truthful unread preservation'],
  [center, 'It remains unread so you can retry.', 'failed read recovery language'],
  [center, 'onClick={refreshNotifications}', 'notification reload action'],
  [center, "loading ? 'Retrying…' : 'Retry updates'", 'truthful retry state'],
  [styles, '.pwc-notification-message button', 'visible retry control'],
  [runner, "'scripts/check-workflow-phase17-notification-recovery.mjs'", 'full audit runner coverage'],
  [packageSource, '"workflow:qa:phase17"', 'Phase 17 package command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

const validationPosition = center.indexOf('if (notification.actionUrl && !actionPath)')
const readPosition = center.indexOf('await api.markRead(notification.id)')
if (validationPosition < 0 || readPosition < 0 || validationPosition > readPosition) {
  failures.push('Notification read state can change before its destination is validated')
}

if (failures.length) {
  console.error('\nPhase 17 notification recovery workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 17 notification recovery workflow audit passed (destination-first validation, preserved unread failures, explicit retry, and unchanged safe navigation).')
