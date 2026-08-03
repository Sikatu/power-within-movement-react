import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const capacity = read('src/pages/admin/AdminCapacityCenter.jsx')
const coverage = read('src/pages/admin/AdminClientCoverage.jsx')
const team = read('src/pages/admin/AdminTeamManagement.jsx')
const runner = read('scripts/run-all-checks.mjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [capacity, "searchParams.get('member') || ''", 'requested Capacity member'],
  [capacity, 'member.id === requestedMemberId', 'exact Capacity member restoration'],
  [capacity, 'source: task.sourceType', 'exact Capacity task source'],
  [capacity, 'item: String(task.id)', 'exact Capacity task item'],
  [capacity, 'booking: String(session.id)', 'exact Capacity booking'],
  [coverage, 'function assignmentUrl(client)', 'Coverage assignment handoff'],
  [coverage, "member.assignmentRole === 'primary'", 'preferred primary owner'],
  [coverage, "mode: 'assignments'", 'assignment workspace mode'],
  [team, "searchParams.get('member') || ''", 'requested Team member'],
  [team, "searchParams.get('client') || ''", 'requested assignment client'],
  [team, "searchParams.get('mode') || ''", 'requested Team mode'],
  [team, 'setClientSearch(requestedClientName)', 'visible assignment client filter'],
  [team, "aria-current={client.id === requestedClientId ? 'true' : undefined}", 'requested client semantics'],
  [runner, "'scripts/check-workflow-phase12-capacity-ownership.mjs'", 'full audit runner coverage'],
  [packageSource, '"workflow:qa:phase12"', 'Phase 12 package command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (failures.length) {
  console.error('\nPhase 12 capacity and ownership workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 12 capacity and ownership workflow audit passed (exact workload restoration, exact task and booking handoffs, primary-owner assignment routing, and filtered client assignment editing).')
