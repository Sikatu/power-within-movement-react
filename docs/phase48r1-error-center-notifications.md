# Phase 48R1 — Error Center Notification Repair

Phase 48R1 closes the final warning revealed after Phase 48 succeeded against the live local PostgreSQL database.

## Root cause

Error records were being stored correctly through the repaired fingerprint constraint. High- and critical-severity records then attempted to notify developers with `ON CONFLICT (dedupe_key)` while the notification system uses a partial unique index limited to non-null deduplication keys. PostgreSQL requires the same predicate in the insert conflict clause.

## Repair

- Adds `WHERE dedupe_key IS NOT NULL` to the Error Center notification conflict clause.
- Keeps hourly developer-notification deduplication intact.
- Separates notification delivery failure from error persistence, so a stored incident is never incorrectly returned as failed.
- Reuses the existing notification-center migration to guarantee the partial unique index.
- Adds focused regression tests for the PostgreSQL clause and persistence isolation.

## Verification

```powershell
npm.cmd --prefix server run db:migrate-notification-center
npm.cmd run admin:qa:phase48r1
npm.cmd run admin:qa:phase30
npm.cmd test
```

The final backend test run should no longer print the previous `no unique or exclusion constraint matching the ON CONFLICT specification` warning from the Developer Error Center.
