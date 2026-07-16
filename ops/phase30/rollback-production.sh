#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="${1:-preview}"
TARGET_COMMIT="${PWC_ROLLBACK_COMMIT:-}"
CHECKPOINT="${PWC_ROLLBACK_CHECKPOINT:-}"
PM2_APP="${PWC_PM2_APP:-}"
HEALTH_URL="${PWC_API_HEALTH_URL:-}"

cd "$ROOT"
echo "Phase 30 application rollback"
echo "Mode: $MODE"
echo "Target commit: ${TARGET_COMMIT:-not set}"
echo "Checkpoint: ${CHECKPOINT:-not set}"
echo "Database and object-storage restoration are intentionally separate operator decisions."

if [[ "$MODE" != "--execute" ]]; then
  echo "Preview only. Re-run with --execute after reviewing docs/admin-phase30-integrated-release.md."
  exit 0
fi
if [[ -z "$TARGET_COMMIT" || -z "$CHECKPOINT" || -z "$PM2_APP" || -z "$HEALTH_URL" ]]; then
  echo "PWC_ROLLBACK_COMMIT, PWC_ROLLBACK_CHECKPOINT, PWC_PM2_APP, and PWC_API_HEALTH_URL are required." >&2
  exit 2
fi
if [[ "${PWC_ROLLBACK_CONFIRM:-}" != "ROLL BACK TO $TARGET_COMMIT" ]]; then
  echo "Set PWC_ROLLBACK_CONFIRM to ROLL BACK TO $TARGET_COMMIT" >&2
  exit 2
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Rollback worktree must be clean." >&2
  exit 2
fi
if ! git cat-file -e "$TARGET_COMMIT^{commit}"; then
  echo "Rollback commit is not available locally." >&2
  exit 2
fi

git switch --detach "$TARGET_COMMIT"
npm ci
npm --prefix server ci
if [[ -f "$CHECKPOINT/frontend-dist-before.tar.gz" ]]; then
  if [[ -d dist ]]; then mv dist "dist.failed.$(date -u +%Y%m%dT%H%M%SZ)"; fi
  tar -xzf "$CHECKPOINT/frontend-dist-before.tar.gz"
else
  npm run build
fi
pm2 reload "$PM2_APP" --update-env
curl --fail --show-error --silent "$HEALTH_URL"
echo "Application rollback completed. Verify config/storage references in $CHECKPOINT before declaring recovery complete."
