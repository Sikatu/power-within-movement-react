#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="${1:-preview}"
RELEASE_TAG="${PWC_RELEASE_TAG:-}"
PM2_APP="${PWC_PM2_APP:-}"
EVIDENCE_FILE="${PWC_PHASE30_EVIDENCE_FILE:-}"
BACKUP_MANIFEST="${PHASE30_BACKUP_MANIFEST:-}"
HEALTH_URL="${PWC_API_HEALTH_URL:-}"
CONFIG_SNAPSHOT_REF="${PWC_SECURE_CONFIG_SNAPSHOT_REF:-}"
STORAGE_SNAPSHOT_REF="${PWC_STORAGE_ROLLBACK_REF:-}"

cd "$ROOT"

echo "Phase 30 production deployment"
echo "Mode: $MODE"
echo "Release tag: ${RELEASE_TAG:-not set}"
echo "PM2 app: ${PM2_APP:-not set}"
echo "Health URL: ${HEALTH_URL:-not set}"

if [[ "$MODE" != "--execute" ]]; then
  echo "Preview only. Re-run with --execute after every required variable and signed artifact is ready."
  exit 0
fi

required=(RELEASE_TAG PM2_APP EVIDENCE_FILE BACKUP_MANIFEST HEALTH_URL CONFIG_SNAPSHOT_REF STORAGE_SNAPSHOT_REF)
for name in "${required[@]}"; do
  if [[ -z "${!name}" ]]; then
    echo "Missing required deployment value: $name" >&2
    exit 2
  fi
done

if [[ "${PWC_DEPLOY_CONFIRM:-}" != "DEPLOY $RELEASE_TAG" ]]; then
  echo "Set PWC_DEPLOY_CONFIRM to DEPLOY $RELEASE_TAG" >&2
  exit 2
fi
if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "Production deployment must start from the main branch." >&2
  exit 2
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Production worktree must be clean." >&2
  exit 2
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
CHECKPOINT="$ROOT/release-artifacts/checkpoints/$STAMP"
mkdir -p "$CHECKPOINT"
git rev-parse HEAD > "$CHECKPOINT/previous-commit.txt"
printf '%s\n' "$CONFIG_SNAPSHOT_REF" > "$CHECKPOINT/secure-config-snapshot-ref.txt"
printf '%s\n' "$STORAGE_SNAPSHOT_REF" > "$CHECKPOINT/storage-rollback-ref.txt"
pm2 jlist > "$CHECKPOINT/pm2-before.json"
if [[ -d dist ]]; then tar -czf "$CHECKPOINT/frontend-dist-before.tar.gz" dist; fi
for file in server/.env ecosystem.config.cjs ecosystem.config.js; do
  if [[ -f "$file" ]]; then sha256sum "$file" >> "$CHECKPOINT/config-checksums-before.txt"; fi
done

git fetch origin main --tags
git merge --ff-only origin/main
TAG_COMMIT="$(git rev-list -n 1 "$RELEASE_TAG")"
HEAD_COMMIT="$(git rev-parse HEAD)"
if [[ "$TAG_COMMIT" != "$HEAD_COMMIT" ]]; then
  echo "Release tag $RELEASE_TAG does not point to checked-out commit $HEAD_COMMIT." >&2
  exit 2
fi

PWC_RELEASE_TAG="$RELEASE_TAG" node scripts/check-phase30-release-evidence.mjs "$EVIDENCE_FILE"
node server/scripts/verify-phase30-postgres-backup.cjs "$BACKUP_MANIFEST"

npm ci
npm --prefix server ci
npm run admin:qa:phase30
npm --prefix server run db:migrate:ordered
npm run build
pm2 reload "$PM2_APP" --update-env

if [[ "${PWC_NGINX_CONFIG_CHANGED:-false}" == "true" ]]; then
  if [[ "${PWC_NGINX_RELOAD_CONFIRM:-}" != "RELOAD NGINX" ]]; then
    echo "Nginx changed; set PWC_NGINX_RELOAD_CONFIRM to RELOAD NGINX." >&2
    exit 2
  fi
  sudo nginx -t
  sudo systemctl reload nginx
fi

curl --fail --show-error --silent "$HEALTH_URL" > "$CHECKPOINT/health-after.json"
git rev-parse HEAD > "$CHECKPOINT/deployed-commit.txt"
pm2 jlist > "$CHECKPOINT/pm2-after.json"
echo "Phase 30 deployment completed. Checkpoint: $CHECKPOINT"
