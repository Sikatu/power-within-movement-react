import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const assert = (condition, message) => { if (!condition) throw new Error(message) }

const sessions = read('src/studio/pages/StudioSessions.jsx')
const api = read('src/lib/nativeApi.js')
const routes = read('server/src/routes/admin.routes.js')
const team = read('server/src/services/teamManagement.service.js')
const readiness = read('server/src/services/sessionReadiness.service.js')
const follow = read('server/src/services/sessionFollowThrough.service.js')
const css = read('src/studio/studio.css')

for (const name of [
  'getMyTeamAccess',
  'updateAdminBookingStatus',
  'reviewAdminSessionChangeRequest',
]) {
  assert(sessions.includes(name), `Missing protected Sessions API usage: ${name}`)
  assert(api.includes(`export async function ${name}`), `Missing existing API contract: ${name}`)
}

for (const status of [
  "'requested'",
  "'approved'",
  "'confirmed'",
  "'completed'",
  "'cancelled'",
  "'no_show'",
]) {
  assert(routes.includes(status), `Booking status contract is missing: ${status}`)
}

assert(
  routes.includes("decision: z.enum(['approved', 'declined'])")
    && routes.includes('reviewerNotes: z.string().trim().max(2000)'),
  'Change-request decision contract changed.',
)

assert(
  routes.includes("SET status = 'cancelled'")
    && routes.includes('SET starts_at = $1'),
  'Approved cancellation/reschedule side effects must remain explicit.',
)

assert(
  team.includes("path.startsWith('/bookings')")
    && team.includes("path.startsWith('/session-change-requests')")
    && team.includes("return 'sessions'")
    && team.includes("requiresManage = !['GET', 'HEAD', 'OPTIONS'].includes(req.method)"),
  'Sessions permission gating changed.',
)

assert(
  routes.includes("router.get('/team/my-access', requireAdmin")
    && routes.includes('access: await getTeamAccessForUser(req.user)')
    && sessions.includes('setTeamAccess(accessResult.access || null)')
    && sessions.includes("teamAccess?.permissions?.sessions === 'manage'"),
  'New Studio must unwrap /team/my-access and gate protected Sessions controls by sessions:manage.',
)

for (const item of [
  'Approve request',
  'Mark confirmed',
  'Complete session',
  'Mark no-show',
  'Cancel session',
  'Private reviewer note',
  'Decline request',
  'Protected session actions enabled',
]) {
  assert(sessions.includes(item), `Missing protected Sessions capability: ${item}`)
}

assert(
  sessions.includes("adminNotes: session.adminNotes || ''"),
  'Booking status mutations must preserve existing private admin notes.',
)

assert(
  sessions.includes("const isPast = mode === 'follow-through'")
    && sessions.includes('<SessionStatusActions mode="upcoming" session={session} />')
    && sessions.includes('<SessionStatusActions mode="follow-through" session={session} />')
    && !sessions.includes('Date.now()'),
  'Protected Sessions render-time status logic must remain pure and mode-derived.',
)

assert(
  readiness.includes("adminNotes: row.admin_notes || ''")
    && follow.includes("adminNotes: row.admin_notes || ''"),
  'Read models must continue to expose the existing private booking note.',
)

for (const forbidden of [
  'welcomeBookingIntoClientCircle',
  'createAdminAppointmentType',
  'updateAdminAppointmentType',
  'createAdminAvailabilityBlock',
  'updateAdminAvailabilityBlock',
]) {
  assert(!sessions.includes(forbidden), `Phase 56E.2 scope expanded unexpectedly: ${forbidden}`)
}

assert(
  sessions.includes("event.key === 'Escape'")
    && sessions.includes('aria-modal="true"')
    && sessions.includes('role="dialog"')
    && !sessions.includes('window.confirm')
    && !sessions.includes('window.alert'),
  'Protected Sessions confirmations must use the accessible custom dialog.',
)

assert(
  sessions.includes('The secured booking workflow will re-evaluate booking communications')
    && sessions.includes('Approval will cancel the connected booking.')
    && sessions.includes('Approval will move the booking to'),
  'Side effects must be explained before protected writes.',
)

assert(
  sessions.includes("className={`studio-sessions-layout${!loading && visibleRecords.length === 0 ? ' is-empty' : ''}`}"),
  'Phase 56E.1R empty-state behavior must remain intact.',
)

assert(
  sessions.includes('to="/admin/scheduler"')
    && sessions.includes('to="/admin/session-change-requests"')
    && sessions.includes('/admin/client-360/'),
  'Legacy Sessions and Client 360 fallbacks must remain available.',
)

assert(
  css.includes('PHASE 56E.2 PROTECTED SESSION ACTIONS START')
    && css.includes('.studio-session-action-panel')
    && css.includes('.studio-session-change-actions')
    && css.includes('.studio-session-dialog-scrim')
    && css.includes('PHASE 56E.2 PROTECTED SESSION ACTIONS END')
    && css.includes('PHASE 56E.1R EMPTY STATE END'),
  'Protected Sessions styles or prior empty-state safeguards are incomplete.',
)

console.log(
  'Phase 56E.2 protected Sessions audit passed '
  + '(forward booking lifecycle, closure confirmation, change-request review, '
  + 'private-note preservation, sessions:manage gating, explicit side effects, '
  + 'Legacy fallbacks, accessible dialogs, and Phase 56E.1R preservation).',
)
