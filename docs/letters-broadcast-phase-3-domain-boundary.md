# Letters & Broadcasts — Phase 3 Domain Boundary

Date: 2026-07-24

## Outcome

Letters remain editable source documents. Broadcasts retain their own delivery lifecycle and immutable prepared snapshots.

## Compatibility behavior

- Existing letter IDs, versions, design JSON, audience filters, and legacy status values are preserved.
- Existing broadcast IDs, snapshots, recipient rows, analytics, and reply aliases are unchanged.
- Legacy letters marked `scheduled`, `sending`, `sent`, or `cancelled` can be edited and can prepare another broadcast.
- Archived letters remain read-only and cannot prepare broadcasts.
- Scheduling, processing, completion, and cancellation update only `letter_broadcasts`.
- A broadcast continues to render from its stored title, subject, preview-text, design, audience, and recipient snapshots.

## Safety boundaries

- No schema migration.
- No destructive status rewrite.
- No provider configuration change.
- No real email send.
- No deployment.

## Validation

The Phase 3 regression test asserts that the route, delivery service, and editor no longer couple broadcast state to `letter_documents.status`.
