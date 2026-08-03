import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const client360 = read('src/pages/admin/AdminClient360.jsx')
const learning = read('src/pages/admin/AdminLearningLibrary.jsx')
const memberships = read('src/pages/admin/AdminMembershipCircle.jsx')
const runner = read('scripts/run-all-checks.mjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [client360, 'course=${course.course_id}&client=${client.id}&mode=access', 'exact learning access handoff'],
  [client360, 'membership=${membership.membership_id}&client=${client.id}&mode=members', 'exact membership handoff'],
  [client360, '/admin/courses?client=${client.id}&mode=access', 'client-scoped Learning shortcut'],
  [client360, '/admin/memberships?client=${client.id}&mode=members', 'client-scoped Membership shortcut'],
  [learning, "searchParams.get('course') || ''", 'requested learning program'],
  [learning, "searchParams.get('client') || ''", 'requested learning client'],
  [learning, 'await loadLibrary(requestedCourseId)', 'exact learning program restoration'],
  [learning, 'orderedAccessClients.map((client)', 'requested learning client ordering'],
  [learning, "aria-current={client.id === requestedClientId ? 'true' : undefined}", 'requested learning client semantics'],
  [memberships, "searchParams.get('membership') || ''", 'requested membership plan'],
  [memberships, "searchParams.get('client') || ''", 'requested membership client'],
  [memberships, 'await loadCircle(requestedMembershipId)', 'exact membership restoration'],
  [memberships, 'clientAvailable && !alreadyEnrolled ? requestedClientId', 'safe membership client prefill'],
  [memberships, 'isRequested={enrollment.client_profile_id === requestedClientId}', 'requested member restoration'],
  [runner, "'scripts/check-workflow-phase14-program-access-continuity.mjs'", 'full audit runner coverage'],
  [packageSource, '"workflow:qa:phase14"', 'Phase 14 package command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (failures.length) {
  console.error('\nPhase 14 program access continuity workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 14 program access continuity workflow audit passed (exact client, learning program, membership plan, and access workspace restoration without silently changing access).')
