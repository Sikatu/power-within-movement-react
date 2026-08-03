import { readFileSync } from 'node:fs'

const scheduler = readFileSync('src/pages/admin/AdminScheduler.jsx', 'utf8')
const client360 = readFileSync('src/pages/admin/AdminClient360.jsx', 'utf8')
const failures = []

for (const token of [
  'useSearchParams',
  "searchParams.get('booking')",
  "searchParams.get('client')",
  'bookingFilterForStatus',
  'filteredBookings.some((booking) => booking.id === selectedBooking?.id)',
  "next.set('booking', booking.id)",
  "['cancelled', 'no_show'].includes(nextStatus)",
  'Cancel this session request?',
  'Create a client profile for',
]) {
  if (!scheduler.includes(token)) {
    failures.push(`Session Studio handoff safeguard is missing: ${token}`)
  }
}

for (const token of [
  '/admin/scheduler?booking=',
  '&client=',
  '/admin/scheduler?client=',
  '&clientName=',
  'Open this session in Session Studio',
]) {
  if (!client360.includes(token)) {
    failures.push(`Client 360 session handoff is missing: ${token}`)
  }
}

if (failures.length) {
  console.error('\nPhase 4 session-handoff workflow audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Phase 4 session-handoff workflow audit passed (client-aware deep links, visible selection alignment, status-aware queues, and confirmed closure or conversion actions).')
