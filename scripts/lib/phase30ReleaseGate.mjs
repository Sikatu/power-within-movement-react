import { PHASE30_EVIDENCE_GATES } from '../../src/components/admin/adminReleaseQa.js'

function validDate(value) {
  return Boolean(value) && Number.isFinite(Date.parse(value))
}

function text(value) {
  return String(value || '').trim()
}

export function validatePhase30Evidence(manifest, { currentCommit = '', expectedTag = '' } = {}) {
  const failures = []
  const release = manifest?.release || {}
  const approval = manifest?.deploymentApproval || {}
  const evidence = manifest?.evidence || {}

  if (manifest?.phase !== 30) failures.push('Manifest phase must be 30.')
  if (release.environment !== 'production') failures.push('Release environment must be production.')
  if (!/^[0-9a-f]{40}$/i.test(text(release.commit))) failures.push('Release commit must be a full 40-character Git SHA.')
  if (currentCommit && text(release.commit) !== text(currentCommit)) failures.push('Evidence commit does not match the checked-out Git commit.')
  if (!text(release.tag)) failures.push('Release tag is required.')
  if (expectedTag && text(release.tag) !== text(expectedTag)) failures.push('Evidence tag does not match the requested release tag.')
  if (!/^https:\/\//i.test(text(release.candidateUrl))) failures.push('Production-shaped candidate URL must use HTTPS.')
  if (!validDate(release.verifiedAt)) failures.push('Release verifiedAt must be an ISO date.')

  for (const gate of PHASE30_EVIDENCE_GATES) {
    const item = evidence[gate.id]
    if (!item || item.status !== 'passed') {
      failures.push(`${gate.id}: status must be passed.`)
      continue
    }
    if (!text(item.checkedBy)) failures.push(`${gate.id}: checkedBy is required.`)
    if (!validDate(item.checkedAt)) failures.push(`${gate.id}: checkedAt must be an ISO date.`)
    if (!text(item.notes)) failures.push(`${gate.id}: concise evidence notes are required.`)
    if (!text(item.artifact)) failures.push(`${gate.id}: an artifact reference is required.`)
  }

  if (approval.decision !== 'GO') failures.push('Deployment approval decision must be GO.')
  if (!text(approval.approvedBy)) failures.push('Deployment approval approvedBy is required.')
  if (!validDate(approval.approvedAt)) failures.push('Deployment approval approvedAt must be an ISO date.')
  if (Array.isArray(manifest?.openBlockers) && manifest.openBlockers.length) {
    failures.push('The evidence manifest still contains open blockers.')
  }

  return {
    ok: failures.length === 0,
    failures,
    totalEvidence: PHASE30_EVIDENCE_GATES.length,
    passedEvidence: PHASE30_EVIDENCE_GATES.filter((gate) => evidence[gate.id]?.status === 'passed').length,
  }
}

export { PHASE30_EVIDENCE_GATES }
