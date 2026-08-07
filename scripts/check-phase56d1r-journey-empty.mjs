import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const clients = read('src/studio/pages/StudioClients.jsx')
const css = read('src/studio/studio.css')

assert(
  clients.includes('<ol className="studio-client-journey">')
    && clients.includes('<li className="studio-clients-empty">')
    && clients.includes('No journey activity has been recorded yet.'),
  'The verified Journey empty-state markup changed unexpectedly.',
)

assert(
  css.includes('.studio-client-journey li {')
    && css.includes('grid-template-columns: 13px minmax(0, 1fr);'),
  'The populated Journey timeline layout must remain intact.',
)

assert(
  css.includes('PHASE 56D.1R JOURNEY EMPTY START')
    && css.includes(
      '.studio-client-journey li.studio-clients-empty {',
    )
    && css.includes('grid-template-columns: minmax(0, 1fr);')
    && css.includes('place-items: center;')
    && css.includes('text-align: center;')
    && css.includes('PHASE 56D.1R JOURNEY EMPTY END'),
  'The full-width Journey empty-state repair is incomplete.',
)

assert(
  css.includes('PHASE 56D.1 CLIENTS END')
    && css.includes('PHASE 56C.2 ACTIONS END')
    && css.includes('PHASE 56C.1R COMPACT BOARD END'),
  'Verified New Studio styles must remain intact.',
)

console.log(
  'Phase 56D.1R Journey empty-state audit passed '
  + '(full-width centered empty state, populated timeline preserved, '
  + 'Clients and Pipeline styles preserved).',
)