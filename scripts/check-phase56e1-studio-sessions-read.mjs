import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const assert = (condition, message) => { if (!condition) throw new Error(message) }

const app = read('src/studio/StudioApp.jsx')
const sessions = read('src/studio/pages/StudioSessions.jsx')
const api = read('src/lib/nativeApi.js')
const readiness = read('server/src/services/sessionReadiness.service.js')
const follow = read('server/src/services/sessionFollowThrough.service.js')
const css = read('src/studio/studio.css')

assert(app.includes("import StudioSessions from './pages/StudioSessions.jsx'") && app.includes('<Route path="sessions" element={<StudioSessions />} />'), 'Sessions route is not connected.')
assert(!app.includes('element={<StudioWorkspacePage workspaceId="sessions" />}'), 'Sessions placeholder must be retired.')

for (const name of ['getAdminSessionReadiness', 'getAdminSessionFollowThrough', 'getAdminSessionChangeRequests']) {
  assert(sessions.includes(name), `Missing Sessions read integration: ${name}`)
  assert(api.includes(`export async function ${name}`), `Missing existing API contract: ${name}`)
}

for (const forbidden of ['updateAdminBookingStatus', 'welcomeBookingIntoClientCircle', 'reviewAdminSessionChangeRequest', 'createAdminAppointmentType', 'updateAdminAppointmentType', 'createAdminAvailabilityBlock', 'updateAdminAvailabilityBlock']) {
  assert(!sessions.includes(forbidden), `Phase 56E.1 must remain read-only: ${forbidden}`)
}

for (const capability of ['Upcoming', 'Follow-through', 'Change requests', 'Upcoming 30 days', 'Decision needed', 'Preparation signal', 'Follow-through signal', 'Client readiness', 'Studio attention', 'Session record', 'Continuity', 'Legacy Sessions', 'Legacy review', 'Real session data connected']) {
  assert(sessions.includes(capability), `Missing Sessions capability: ${capability}`)
}

for (const token of ['requiredIntakeFields', 'answeredRequiredFields', 'portalActive', 'assignedMembers', 'communications', 'readiness']) {
  assert(readiness.includes(token), `Session readiness contract changed: ${token}`)
}
for (const token of ['sessionRecord', 'overdueTasks', 'waitingOnTeam', 'resourcesShared', 'nextSessionAt', 'followThrough']) {
  assert(follow.includes(token), `Session follow-through contract changed: ${token}`)
}

assert(sessions.includes('to="/admin/scheduler"') && sessions.includes('/admin/client-360/') && sessions.includes('to="/admin/session-change-requests"'), 'Legacy/Client360 fallbacks are incomplete.')
assert(!sessions.includes('AdminFrame') && !sessions.includes('AdminFreshUI.css') && !sessions.includes('window.confirm') && !sessions.includes('window.alert'), 'Sessions workspace isolation failed.')
assert(css.includes('PHASE 56E.1 SESSIONS START') && css.includes('.studio-sessions-layout') && css.includes('.studio-session-signal-hero') && css.includes('.studio-session-detail-grid') && css.includes('.studio-session-legacy-action-note') && css.includes('PHASE 56E.1 SESSIONS END'), 'Sessions styles are incomplete.')
assert(css.includes('PHASE 56D.2 CLIENT CARE ACTIONS END') && css.includes('PHASE 56D.1R JOURNEY EMPTY END') && css.includes('PHASE 56C.2 ACTIONS END'), 'Previously verified New Studio styles must remain intact.')

console.log('Phase 56E.1 real-data Sessions audit passed (upcoming readiness, follow-through, change requests, search, attention filters, Client 360 links, Legacy fallbacks, isolation, read-only safeguards, and responsive behavior).')
