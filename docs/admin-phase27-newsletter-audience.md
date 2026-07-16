# Phase 27 — Newsletter Audience and Stored Email Directory

Phase 27 adds the consent-aware recipient foundation at `/admin/audience`. It does not send broadcasts and it does not deploy the application.

## What is included

- One-at-a-time, manual bulk, CSV, approved website form, and explicitly consented client entry.
- Case-insensitive email identity with duplicate merging.
- Subscriber status, consent status and timestamp, source, notes, custom fields, tags, and segments.
- Immutable consent events, import audit records, suppression records, and per-recipient send-history storage.
- Search, status/source/tag/segment filters, bulk tag and segment actions, and eligibility preview.
- Unsubscribe, bounce, complaint, manual suppression, and pending-consent enforcement.
- A nullable client link. The newsletter record and its history survive client-profile removal.

## Consent and suppression rules

New manual bulk and CSV rows default to `pending` unless explicit consent evidence is supplied. Existing clients may only be added through an action that confirms newsletter-specific consent. Service or intake consent is not reused as marketing consent.

Only a record with `status = subscribed`, `consent_status = granted`, and no active suppression is eligible. A fresh explicit opt-in can lift an unsubscribe suppression. Bounce, complaint, and manual suppressions cannot be silently cleared by an import or public form.

## CSV columns

Supported headers are `email`, `first_name`, `last_name`, `tags`, `segments`, `source`, `consent`, `consent_at`, and `notes`. Tags and segments use semicolon or pipe separators. Invalid rows are isolated in the import result instead of invalidating valid rows.

## Database migration

Run `npm --prefix server run db:migrate-newsletter-audience`, or use the ordered migration runner. The migration extends the existing `subscribers` table and creates the Phase 27 consent, suppression, segment, import, and send-history tables.

## Verification

Run `npm run admin:qa:phase27`, `npm run admin:qa`, and `npm --prefix server test`. The phase-specific command performs the static capability audit plus focused audience tests.
