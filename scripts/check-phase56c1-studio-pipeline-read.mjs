import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const app = read('src/studio/StudioApp.jsx')
const pipeline = read('src/studio/pages/StudioPipeline.jsx')
const css = read('src/studio/studio.css')

assert(
  app.includes("import StudioPipeline from './pages/StudioPipeline.jsx'"),
  'StudioApp must import StudioPipeline.',
)

assert(
  app.includes('path="pipeline" element={<StudioPipeline />}'),
  'The Pipeline route must render StudioPipeline.',
)

for (const apiName of [
  'getAdminLeadPipeline',
  'getAdminLeadDetail',
]) {
  assert(
    pipeline.includes(apiName),
    `Missing real-data API integration: ${apiName}`,
  )
}

for (const capability of [
  'Search leads',
  'All priorities',
  'All owners',
  'All stages',
  'Follow-ups',
  'Activity',
  'Relationship summary',
]) {
  assert(
    pipeline.includes(capability),
    `Missing read-only Pipeline capability: ${capability}`,
  )
}

for (const state of [
  'Unable to load',
  'No lead selected',
  'No matching leads',
  'Loading the Pipeline',
]) {
  assert(
    pipeline.includes(state),
    `Missing Pipeline state: ${state}`,
  )
}

assert(
  pipeline.includes('This first pass is intentionally read-only'),
  'The read-only migration state must be transparent.',
)

assert(
  !pipeline.includes('updateAdminLead')
    && !pipeline.includes('createAdminLeadFollowUp')
    && !pipeline.includes('addAdminLeadNote')
    && !pipeline.includes('AdminFrame')
    && !pipeline.includes('AdminFreshUI.css'),
  'Phase 56C.1 must stay read-only and isolated from Legacy Studio.',
)

assert(
  css.includes('PHASE 56C.1 PIPELINE START')
    && css.includes('.studio-pipeline-layout')
    && css.includes('.studio-pipeline-board')
    && css.includes('.studio-pipeline-detail')
    && css.includes('@media (max-width: 620px)'),
  'Responsive Pipeline styles are incomplete.',
)

console.log(
  'Phase 56C.1 real-data Pipeline audit passed '
  + '(protected reads, search, filters, stages, detail, follow-ups, '
  + 'activity, isolation, and responsive behavior).',
)