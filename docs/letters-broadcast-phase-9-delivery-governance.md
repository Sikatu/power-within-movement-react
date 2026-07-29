# Letters & Broadcast - Phase 9 Delivery Governance

## Scope

Phase 9 completes the remaining scheduling-and-delivery governance gap after
Phase 8 operational reliability.

## Delivered

- Separate server-authoritative capabilities for edit, test, schedule, send,
  cancel, retry, and recovery actions.
- Communications staff with manage access can author and test Letters without
  automatically gaining live-broadcast authority.
- Owner and Administrator accounts can schedule, send, cancel, and retry.
- The Developer account additionally retains the guarded worker recovery check.
- The workspace receives the same capability contract used by the API and
  disables or omits unavailable controls with a plain-language explanation.
- Scheduled broadcasts must be at least five minutes in the future.
- Rescheduling and cancellation close five minutes before dispatch to prevent a
  race with the delivery worker.
- Schedule and cancellation audits record explicit source and destination
  statuses.

## Safety boundaries

- No schema migration.
- No broadcast or test email sent.
- No production data changed.
- No deployment or GitHub push.
- Existing Phase 8 claiming, stale-worker recovery, recipient idempotency, and
  failed-recipient retry behavior remain unchanged.
