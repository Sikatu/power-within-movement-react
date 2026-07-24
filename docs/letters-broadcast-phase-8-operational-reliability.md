# Letters and Broadcasts Phase 8 - Operational Reliability

## Outcome

Phase 8 makes scheduled Letter delivery recoverable and safe to operate after
worker restarts, provider failures, or overlapping dispatcher runs.

## Reliability controls

- Due broadcasts are atomically claimed with `FOR UPDATE SKIP LOCKED`.
- Broadcasts left in `processing` for more than 15 minutes are returned to the
  scheduled queue when unfinished recipients remain.
- Every provider request carries a stable per-recipient idempotency key.
- Provider rate-limit retries remain bounded to three attempts.
- Failed and scheduled broadcasts can be rescheduled without rebuilding the
  immutable Letter snapshot.
- A failed-recipient retry resets only failed recipients. Sent, skipped,
  unsubscribed, suppressed, and successful recipients are never requeued.
- Retry operations and schedule changes are written to the existing audit log.
- The developer recovery check reports processed, recovered, and failed counts.

## Compatibility

- No database migration is required.
- Existing version 1 Letters and prepared broadcast snapshots remain valid.
- Existing consent, suppression, unsubscribe, preflight, tracking, and provider
  protections remain active.
- No delivery is performed by installing or validating this phase.

## Validation

Run focused lint, the complete server test suite, and the production build
before committing or deploying.
