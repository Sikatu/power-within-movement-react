# Phase 48 — Developer Error Center Reliability

Phase 48 closes the remaining PostgreSQL persistence warning in the Developer Error Center without discarding existing incident history.

## What changed

- Legacy duplicate fingerprints are consolidated while preserving their accumulated occurrence count and first/last-seen history.
- The migration now enforces the named, validated, non-deferrable `application_errors_fingerprint_unique` constraint required by production writes.
- A temporary two-write probe verifies that PostgreSQL actually deduplicates through that constraint before the migration commits.
- Runtime capture uses the named constraint instead of relying on PostgreSQL to infer a compatible index.
- The Developer Error Center shows a compact “Capture storage ready” or “Capture storage needs repair” status.

## Apply and verify

The guarded Phase 48 installer runs:

1. `npm.cmd --prefix server run db:migrate-developer-error-center`
2. `npm.cmd run admin:qa:phase48`
3. `npm.cmd run admin:qa:phase30`
4. `npm.cmd test`

The migration and application tests must all pass before the installer pushes the branch.

## Safety

- The repair is transactional.
- Duplicate records are consolidated into the newest record rather than blindly discarded.
- The persistence probe removes its temporary event before commit.
- The installer verifies the expected commit and project tree before applying the patch.
