import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const sessions = read('src/studio/pages/StudioSessions.jsx')
const css = read('src/studio/studio.css')

assert(
  sessions.includes(
    "className={`studio-sessions-layout${!loading && visibleRecords.length === 0 ? ' is-empty' : ''}`}",
  ),
  'Sessions must add is-empty only after loading when the active view has zero records.',
)

assert(
  sessions.includes('visibleRecords.map((session) => <SessionCard')
    && sessions.includes('visibleRecords.map((request) => <ChangeCard')
    && sessions.includes('<UpcomingDetail session={selectedRecord} />')
    && sessions.includes('<FollowThroughDetail session={selectedRecord} />')
    && sessions.includes('<ChangeDetail request={selectedRecord} />'),
  'Populated Sessions rendering must remain intact.',
)

for (const token of [
  'PHASE 56E.1R EMPTY STATE START',
  '.studio-sessions-layout.is-empty .studio-sessions-directory',
  'height: auto;',
  '.studio-sessions-layout.is-empty .studio-sessions-directory-list',
  'min-height: 150px;',
  '.studio-sessions-layout.is-empty .studio-sessions-empty.is-detail',
  'min-height: 215px;',
  'PHASE 56E.1R EMPTY STATE END',
]) {
  assert(css.includes(token), `Missing Sessions empty-state safeguard: ${token}`)
}

assert(
  /\.studio-sessions-directory\s*\{[^}]*height\s*:\s*clamp\(\s*610px\s*,\s*72dvh\s*,\s*820px\s*\)\s*;/.test(css),
  'The populated Sessions directory height must remain unchanged.',
)

assert(
  css.includes('PHASE 56E.1 SESSIONS END')
    && css.includes('PHASE 56D.2 CLIENT CARE ACTIONS END')
    && css.includes('PHASE 56C.2 ACTIONS END'),
  'Previously verified New Studio styles must remain intact.',
)

console.log(
  'Phase 56E.1R Sessions empty-state audit passed '
  + '(zero-record views compact after loading, populated Sessions layout preserved, '
  + 'responsive safeguards preserved).',
)