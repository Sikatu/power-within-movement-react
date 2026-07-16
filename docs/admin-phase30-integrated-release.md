# Phase 30 — Integrated QA, Migration, and Production Deployment

Phase 30 is a fail-closed production gate. A passing build is necessary but is not permission to deploy. Production remains unchanged until the exact release commit, release tag, verified backup, external evidence, and GO approval all agree.

## 1. Prepare the candidate

Merge the approved review branch to `main` only after local QA is green. Create an annotated release tag on that exact merge commit. Keep the pre-Phase-30 branch and the production commit available until post-deployment verification is complete.

```powershell
git status --short --branch
npm.cmd run admin:qa:phase30
npm.cmd test
git rev-parse HEAD
```

Start the candidate backend and frontend, sign in with the Developer account, and open `/admin/developer/qa`. The integrated readiness contract must pass in the production-shaped environment. Copy its report.

## 2. Rehearse migrations on an isolated restore

Restore a recent production backup into a separate database. Never point the rehearsal command at production.

```powershell
$env:PHASE30_REHEARSAL_DATABASE_URL = "postgresql://USER:PASSWORD@HOST:5432/power_within_phase30_rehearsal"
$env:PHASE30_REHEARSAL_CONFIRM = "RUN ISOLATED REHEARSAL power_within_phase30_rehearsal"
npm.cmd --prefix server run db:rehearse:phase30
```

The runner compares the host, port, and database name with `DATABASE_URL` and refuses an identical target. Retain the complete migration output in the release evidence.

## 3. Complete external evidence

Copy `ops/phase30/release-evidence.example.json` outside the repository's tracked files. Fill every item with `status: "passed"`, the checker, an ISO timestamp, concise notes, and an artifact reference. Required evidence covers:

- storage upload/download/checksum/cleanup, scoped link denial and expiry, and client assignment;
- audience import, duplicate merge, unsubscribe, suppression, and newsletter test delivery;
- private Founder recording, playback, retention, transcription, and Chicago timezone behavior;
- all routes; 1440 × 900, 1280 × 800, 768 × 1024, and 390 × 844 screenshots;
- mouse wheel, keyboard, touch, focus, labels, contrast, zoom, and reduced motion;
- owner/developer/admin/staff/client/public permission boundaries and security-integrity scan;
- build, lint, all backend tests, app QA, and complete rollback references.

Validate the signed evidence against the checked-out commit:

```powershell
$env:PWC_RELEASE_TAG = "phase30-production-YYYYMMDD"
$env:PWC_PHASE30_EVIDENCE_FILE = "C:\secure\phase30-release-evidence.json"
npm.cmd run phase30:gate
```

## 4. Create and verify the production backup

Run this PostgreSQL backup on the production VPS immediately before deployment. `pg_dump` and `pg_restore` must be installed. The script creates a custom-format dump, verifies its catalog, calculates SHA-256, and writes a secret-free manifest.

```bash
export PHASE30_BACKUP_DIR=/secure/backups/power-within
export PHASE30_BACKUP_CONFIRM="BACK UP power_within_production"
npm --prefix server run db:backup:phase30
export PHASE30_BACKUP_MANIFEST=/secure/backups/power-within/FILE.dump.manifest.json
npm --prefix server run db:backup:verify:phase30
```

Also retain a secure environment/email configuration snapshot reference and an object-storage versioning or snapshot reference. Do not copy plaintext secrets into the repository or deployment checkpoint.

## 5. Preview and execute deployment

`deploy-production.sh` previews by default. Execution requires `main`, a clean worktree, an exact tag-to-HEAD match, the signed evidence, the verified backup manifest, rollback references, and a typed confirmation. It installs locked dependencies, runs ordered migrations, reruns Phase 30 QA, builds, reloads PM2, conditionally reloads Nginx, and captures API health.

```bash
export PWC_RELEASE_TAG=phase30-production-YYYYMMDD
export PWC_PM2_APP=power-within-native-backend
export PWC_PHASE30_EVIDENCE_FILE=/secure/releases/phase30-release-evidence.json
export PHASE30_BACKUP_MANIFEST=/secure/backups/FILE.dump.manifest.json
export PWC_API_HEALTH_URL=https://api.example.com/api/health
export PWC_SECURE_CONFIG_SNAPSHOT_REF=vault-snapshot-or-backup-id
export PWC_STORAGE_ROLLBACK_REF=object-storage-versioning-or-snapshot-id
bash ops/phase30/deploy-production.sh

export PWC_DEPLOY_CONFIRM="DEPLOY $PWC_RELEASE_TAG"
bash ops/phase30/deploy-production.sh --execute
```

Set `PWC_NGINX_CONFIG_CHANGED=true` only when Nginx was actually changed. That path additionally requires `PWC_NGINX_RELOAD_CONFIRM="RELOAD NGINX"` and a successful `nginx -t`.

## 6. Post-deployment verification

Verify API health, every authentication role, private uploads/downloads, client assignments, newsletter test delivery, unsubscribe/suppression, Founder recording/transcription, Founder and Developer workspaces, the client portal, and the public site. Any security, privacy, data-integrity, or authentication failure is an immediate rollback decision.

## 7. Rollback

The application rollback script previews by default and restores the prior Git revision/frontend build before reloading PM2. Database restore and object-storage recovery stay separate because they can discard valid post-deployment data. Use the checkpoint's secure config and storage references, assess data written after deployment, then make an explicit restore decision.

```bash
export PWC_ROLLBACK_COMMIT=FULL_PREVIOUS_COMMIT_SHA
export PWC_ROLLBACK_CHECKPOINT=/path/to/release-artifacts/checkpoints/TIMESTAMP
export PWC_PM2_APP=power-within-native-backend
export PWC_API_HEALTH_URL=https://api.example.com/api/health
bash ops/phase30/rollback-production.sh

export PWC_ROLLBACK_CONFIRM="ROLL BACK TO $PWC_ROLLBACK_COMMIT"
bash ops/phase30/rollback-production.sh --execute
```

If the migration/data decision explicitly requires restoring PostgreSQL, preview the independently gated restore first. It verifies the backup checksum, database name, and custom-format catalog. Execution uses a single transaction with `--clean`, so it is destructive and must happen only in an approved recovery window after evaluating post-deployment writes.

```bash
export PHASE30_BACKUP_MANIFEST=/secure/backups/FILE.dump.manifest.json
npm --prefix server run db:restore:phase30

export PHASE30_ALLOW_DATABASE_RESTORE=true
export PHASE30_DATABASE_RESTORE_CONFIRM="RESTORE power_within_production FROM FIRST_12_SHA256_CHARACTERS"
npm --prefix server run db:restore:phase30 -- --execute
```

Before declaring recovery complete, verify the Git revision, frontend build, PM2 state, database schema/data decision, object storage, email provider configuration, environment configuration, API health, authentication, portal delivery, Founder tools, Developer tools, and public site.
