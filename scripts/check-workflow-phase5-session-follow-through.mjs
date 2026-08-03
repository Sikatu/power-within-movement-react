import { readFileSync } from 'node:fs'

const scheduler = readFileSync('src/pages/admin/AdminScheduler.jsx', 'utf8')
const followThrough = readFileSync('src/pages/admin/AdminSessionFollowThrough.jsx', 'utf8')
const failures = []

for (const token of [
  'availableFrom',
  'bookingStatusRank',
  'Move this session backward?',
  'action.availableFrom.includes(selectedBooking.status)',
  '/admin/follow-through?session=',
  'Review follow-through',
]) {
  if (!scheduler.includes(token)) {
    failures.push(`Session completion safeguard is missing: ${token}`)
  }
}

for (const token of [
  'useSearchParams',
  "searchParams.get('session')",
  'selectSession(session)',
  '/admin/scheduler?booking=',
  '/care`',
  '/admin/attention?client=',
  'Record session notes',
  'Open exact session',
]) {
  if (!followThrough.includes(token)) {
    failures.push(`Follow-through handoff safeguard is missing: ${token}`)
  }
}

const duplicateBandBadge = /<em>\{bandLabel\(session\.followThrough\?\.band\)\}<\/em>\s*<em>\{bandLabel\(session\.followThrough\?\.band\)\}<\/em>/
if (duplicateBandBadge.test(followThrough)) {
  failures.push('Follow-through cards render the continuity badge twice.')
}

if (failures.length) {
  console.error('\nPhase 5 session follow-through workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 5 session follow-through workflow audit passed (forward-only quick actions, exact session/client handoffs, direct care recording, and synchronized follow-through selection).')
