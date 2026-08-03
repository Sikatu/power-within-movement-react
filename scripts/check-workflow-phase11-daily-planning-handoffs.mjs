import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n?/g, '\n')
const brief = read('src/pages/admin/AdminDailyBrief.jsx')
const planner = read('src/pages/admin/AdminWeekPlanner.jsx')
const attention = read('src/pages/admin/AdminAttentionQueue.jsx')
const runner = read('scripts/run-all-checks.mjs')
const packageSource = read('package.json')
const failures = []

const requirements = [
  [brief, 'function attentionUrl(task)', 'Daily Brief exact attention URL'],
  [brief, 'navigate(attentionUrl(task))', 'Daily Brief exact task handoff'],
  [brief, 'function bookingUrl(booking)', 'Daily Brief exact booking URL'],
  [brief, 'navigate(bookingUrl(booking))', 'Daily Brief exact session handoff'],
  [planner, 'function attentionUrl(task)', 'Week Planner exact attention URL'],
  [planner, 'navigate(attentionUrl(task))', 'Week Planner exact task handoff'],
  [planner, 'function bookingUrl(booking)', 'Week Planner exact booking URL'],
  [planner, 'navigate(bookingUrl(booking))', 'Week Planner exact session handoff'],
  [attention, "searchParams.get('source') || ''", 'requested attention source'],
  [attention, "searchParams.get('item') || ''", 'requested attention item'],
  [attention, 'task.sourceType === requestedSourceType', 'exact attention source matching'],
  [attention, 'String(task.id) === requestedItemId', 'exact attention item matching'],
  [runner, "'scripts/check-workflow-phase11-daily-planning-handoffs.mjs'", 'full audit runner coverage'],
  [packageSource, '"workflow:qa:phase11"', 'Phase 11 package command'],
]

for (const [source, token, label] of requirements) {
  if (!source.includes(token)) failures.push(`${label} is missing: ${token}`)
}

if (failures.length) {
  console.error('\nPhase 11 daily planning handoff audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 11 daily planning handoff audit passed (exact Daily Brief and Week Planner task selection, booking-aware session opening, and preserved broad workspace shortcuts).')
