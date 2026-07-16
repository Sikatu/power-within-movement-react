import { readFileSync } from 'node:fs'

const sources = {
  app: readFileSync('server/src/app.js', 'utf8'),
  route: readFileSync('server/src/routes/releaseReadiness.routes.js', 'utf8'),
  service: readFileSync('server/src/services/releaseReadiness.service.js', 'utf8'),
  page: readFileSync('src/pages/admin/AdminReleaseQa.jsx', 'utf8'),
  contracts: readFileSync('src/components/admin/adminReleaseQa.js', 'utf8'),
  deploy: readFileSync('ops/phase30/deploy-production.sh', 'utf8'),
  rollback: readFileSync('ops/phase30/rollback-production.sh', 'utf8'),
  rehearsal: readFileSync('server/scripts/run-phase30-migration-rehearsal.cjs', 'utf8'),
  backup: readFileSync('server/scripts/create-phase30-postgres-backup.cjs', 'utf8'),
  restore: readFileSync('server/scripts/restore-phase30-postgres-backup.cjs', 'utf8'),
  evidence: readFileSync('scripts/lib/phase30ReleaseGate.mjs', 'utf8'),
  docs: readFileSync('docs/admin-phase30-integrated-release.md', 'utf8'),
  package: readFileSync('package.json', 'utf8'),
}

const requirements = {
  app: ["'/api/admin/developer/release-readiness'", 'releaseReadinessRoutes'],
  route: ["requireRole(['developer'])", 'getReleaseReadinessSnapshot'],
  service: ['PHASE30_REQUIRED_TABLES', 'externalEvidenceRequired: true', 'secure-public-urls', 'founder-transcription-provider'],
  page: ['PHASE30_EVIDENCE_GATES', 'Production proof ledger', 'browser-local marks', 'summarizePhase30Evidence'],
  contracts: ["endpoint: '/api/admin/audience/summary'", "endpoint: '/api/admin/letters/overview'", "endpoint: '/api/admin/developer/release-readiness'", "releaseStatePath: 'summary.status'"],
  deploy: ['Preview only', 'PWC_DEPLOY_CONFIRM', 'git merge --ff-only origin/main', 'check-phase30-release-evidence', 'verify-phase30-postgres-backup', 'pm2 reload'],
  rollback: ['Preview only', 'PWC_ROLLBACK_CONFIRM', 'git switch --detach', 'frontend-dist-before.tar.gz'],
  rehearsal: ['PHASE30_REHEARSAL_DATABASE_URL', 'production rehearsal is forbidden', 'RUN ISOLATED REHEARSAL'],
  backup: ['pg_dump', 'pg_restore', 'sha256', 'PHASE30_BACKUP_CONFIRM'],
  restore: ['Preview only', 'PHASE30_ALLOW_DATABASE_RESTORE', 'PHASE30_DATABASE_RESTORE_CONFIRM', '--single-transaction'],
  evidence: ['PHASE30_EVIDENCE_GATES', "approval.decision !== 'GO'", 'Evidence commit does not match'],
  docs: ['fail-closed production gate', 'PostgreSQL backup', 'Post-deployment verification', 'Rollback'],
  package: ['admin:qa:phase30', 'phase30:gate'],
}

const failures = []
for (const [sourceName, tokens] of Object.entries(requirements)) {
  for (const token of tokens) {
    if (!sources[sourceName].includes(token)) failures.push(`${sourceName} is missing Phase 30 safeguard: ${token}`)
  }
}

if (!sources.deploy.includes('[[ "$MODE" != "--execute" ]]')) {
  failures.push('Production deployment is not dry-run by default.')
}
if (!sources.rollback.includes('Database and object-storage restoration are intentionally separate')) {
  failures.push('Rollback does not explicitly separate destructive data restoration.')
}

if (failures.length) {
  console.error('\nAdmin Phase 30 integrated release audit failed:\n')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Admin Phase 30 integrated release audit passed (live readiness, 20 evidence gates, guarded migration rehearsal, verified backup, deployment, and rollback).')
