# Letters & Broadcasts — Phase 2 Stabilization

Date: 2026-07-24

## Scope

This phase establishes a safety net around the existing `/admin/letters` implementation. It intentionally makes no database schema change, sends no email, changes no provider configuration, and performs no deployment.

## Compatibility baseline

- Existing letter documents use structured JSON with `version: 1`, settings, and blocks.
- Normalization preserves the version 1 format and guarantees one final unsubscribe block.
- Autosave uses `autosave_revision` and rejects stale writes with `LETTER_REVISION_CONFLICT`.
- Prepared broadcasts persist title, subject, preview text, design, audience, and recipient snapshots.
- Recipient eligibility requires subscribed status, granted consent, and no active suppression.
- Provider events are deduplicated through persisted event identity.
- Replies continue to use the unified inbox and recipient reply aliases.

## Stabilization changes

- Added a representative version 1 compatibility fixture.
- Added deterministic normalization coverage for existing documents.
- Added characterization coverage proving a prepared snapshot does not follow later source edits.
- Added source-level guards for revision conflicts and persisted broadcast snapshots.
- Restricted the technical **Process due now** control to developer accounts in both the UI and API.

## Known risk retained for the next delivery phase

The dispatcher currently selects only due broadcasts whose status is `scheduled`. A process interruption after a record changes to `processing` can strand that broadcast. This phase records the behavior in a characterization test; it does not introduce recovery or lease semantics without a separately reviewed delivery change.

## Required checks

Run:

```text
npm run admin:qa:phase28
npm run build
npm run lint
npm test
```

Database-dependent tests may require the configured local PostgreSQL test environment. No migration command is part of this phase.
