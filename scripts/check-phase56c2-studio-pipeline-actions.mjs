import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const pipeline = read('src/studio/pages/StudioPipeline.jsx')
const css = read('src/studio/studio.css')

assert(
  !fs.existsSync(
    path.join(
      root,
      'scripts/check-phase56c1-studio-pipeline-read.mjs',
    ),
  ),
  'The obsolete read-only Pipeline audit must be retired.',
)

for (const apiName of [
  'getAdminLeadPipeline',
  'getAdminLeadDetail',
  'updateAdminLead',
  'createAdminLeadFollowUp',
  'updateAdminLeadFollowUp',
  'addAdminLeadNote',
]) {
  assert(
    pipeline.includes(apiName),
    `Missing protected Pipeline API integration: ${apiName}`,
  )
}

for (const capability of [
  'Pipeline stage',
  'Relationship owner',
  'Next action due',
  'Consultation and recommendation summary',
  'Schedule follow-up',
  'Complete',
  'Cancel',
  'Reopen',
  'Add private team note',
  'Convert to client',
  'Mark as not a fit',
]) {
  assert(
    pipeline.includes(capability),
    `Missing protected Pipeline capability: ${capability}`,
  )
}

assert(
  pipeline.includes('aria-modal="true"')
    && pipeline.includes('role="dialog"')
    && pipeline.includes("event.key === 'Escape'"),
  'Conversion and closure confirmation must be accessible.',
)

assert(
  pipeline.includes("pipelineStage === 'not_a_fit'")
    && pipeline.includes('Closure reason')
    && pipeline.includes('required'),
  'Not-a-fit closure must require a reason.',
)

assert(
  pipeline.includes('Protected actions enabled')
    && !pipeline.includes(
      'This first pass is intentionally read-only',
    ),
  'The Pipeline action state must be truthful.',
)

assert(
  !pipeline.includes('window.confirm')
    && !pipeline.includes('window.alert')
    && !pipeline.includes('AdminFrame')
    && !pipeline.includes('AdminFreshUI.css'),
  'The New Studio Pipeline must remain isolated from Legacy Studio.',
)

assert(
  css.includes('PHASE 56C.2 ACTIONS START')
    && css.includes('.studio-pipeline-action-form')
    && css.includes('.studio-pipeline-dialog-scrim')
    && css.includes('.studio-pipeline-record-actions')
    && css.includes('@media (max-width: 620px)'),
  'Protected Pipeline action styles are incomplete.',
)

assert(
  css.includes('PHASE 56C.1R COMPACT BOARD START')
    && css.includes('height: clamp(480px, 64dvh, 720px)')
    && css.includes('overflow-y: auto'),
  'The approved compact Pipeline board must remain intact.',
)

console.log(
  'Phase 56C.2 protected Pipeline action audit passed '
  + '(lead updates, ownership, next actions, follow-ups, notes, '
  + 'conversion, closure confirmation, isolation, and responsive UI).',
)