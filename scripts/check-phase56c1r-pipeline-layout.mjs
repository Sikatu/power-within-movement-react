import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const css = fs.readFileSync(
  path.join(root, 'src/studio/studio.css'),
  'utf8',
)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(
  css.includes('PHASE 56C.1R COMPACT BOARD START')
    && css.includes('PHASE 56C.1R COMPACT BOARD END'),
  'The compact Pipeline board markers are missing.',
)

assert(
  css.includes('height: clamp(480px, 64dvh, 720px)')
    && css.includes('overflow-y: auto')
    && css.includes('align-items: start')
    && css.includes('overscroll-behavior: contain'),
  'The compact Pipeline board behavior is incomplete.',
)

assert(
  css.includes('@media (max-width: 620px)')
    && css.includes('max-height: 60dvh'),
  'The compact Pipeline board mobile safeguard is incomplete.',
)

console.log(
  'Phase 56C.1R compact Pipeline layout audit passed '
  + '(bounded lanes, internal lead scrolling, accessible board overflow, '
  + 'and mobile safeguards).',
)