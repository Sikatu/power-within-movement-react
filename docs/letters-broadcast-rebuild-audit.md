# Letters & Broadcast Rebuild Audit

Status: Phase 2 stabilization baseline
Route preserved: `/admin/letters`
Production deployment: not performed
Production migrations: not performed
Production broadcasts: not sent

## Existing architecture

### Frontend

- `src/pages/admin/AdminLetters.jsx`
- `src/components/admin/LetterCanvas.jsx`
- `src/components/admin/LetterBlockSettings.jsx`
- `src/components/admin/AssetVaultPicker.jsx`
- Existing Studio shell and route guard
- Shared Audience Directory at `/admin/audience`
- Unified Inbox at `/admin/inbox`
- Asset Vault at `/admin/assets`

### Backend

- `server/src/routes/letterBuilder.routes.js`
- `server/src/routes/letterPublic.routes.js`
- `server/src/services/letterBuilder.service.js`
- `server/src/services/letterBroadcast.service.js`
- `server/src/services/newsletterAudience.service.js`
- `server/src/services/inboundEmail.service.js`

### Existing data

- `letter_documents`
- `letter_templates`
- `letter_versions`
- `letter_broadcasts`
- `letter_broadcast_recipients`
- `letter_tracking_links`
- `letter_events`
- `letter_test_sends`
- Existing shared subscriber, consent, suppression, segment, inbox, audit, and asset tables

## Stabilization changes in this phase

1. Broadcast content snapshots are created through one detached, normalized compatibility boundary.
2. Mutating a source letter after broadcast preparation cannot mutate the in-memory snapshot object.
3. Broadcast claims remain restricted to draft, scheduled, or failed records.
4. A processing broadcast may be resumed only by the scheduler after its heartbeat has been stale for 30 minutes.
5. Processing heartbeats are refreshed after every recipient batch.
6. The standard Letters UI no longer exposes the technical `Process due now` dispatcher control.
7. The server endpoint remains available for controlled operational use; no API route is removed.
8. Characterization tests protect the existing route, version-1 letter format, snapshot behavior, claim policy, and recovery policy.

## Compatibility boundaries

- No existing table or column is renamed or deleted.
- Existing `design.version = 1` documents remain supported.
- Existing letter, template, broadcast, recipient, tracking, and event IDs remain unchanged.
- Existing Resend, Audience Directory, Asset Vault, audit, consent, suppression, and unified Inbox integrations remain in place.
- No duplicate Letters module, audience system, media library, or reply inbox is introduced.

## Known gaps deferred to later phases

- Letter status is still coupled to broadcast lifecycle status.
- Rich text is still limited.
- Dedicated Logo and Image + Text blocks are missing.
- Reusable blocks are missing.
- Desktop and mobile previews are still editor approximations.
- Personalization fallbacks and token validation are incomplete.
- Preflight does not yet show a complete recipient exclusion breakdown.
- Send, schedule, test, and edit permissions are not yet independently granular.
- Production migrations require separate review and explicit approval.

## Required validation

- Letter builder unit tests
- Phase 2 stability tests
- Existing Phase 28 QA contract
- Repository lint
- Production frontend build

This phase is intentionally reviewable and does not authorize deployment.
