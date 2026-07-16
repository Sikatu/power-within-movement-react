# Phase 28 — Letters & Broadcasts Visual Email Builder

Phase 28 adds the consent-aware visual email workspace at `/admin/letters`. It builds on the Phase 27 newsletter directory and the Phase 26 Asset Vault. It does not merge to production or deploy the application; production release remains reserved for Phase 30.

## What is included

- Letters, Templates, Audience, Segments, Scheduled, Sent, and Analytics sections.
- A three-panel builder with 15 content blocks, drag-and-drop ordering, duplication, deletion, global colors and typography, section styling, and desktop/mobile previews.
- Heading, text, image, button, divider, spacer, two-column, quote, signature, social, video-preview, resource/download, personalized greeting, footer, and mandatory unsubscribe blocks.
- Asset Vault selection for newsletter images, video previews, and private downloadable resources.
- Debounced autosave with optimistic revision checks, draft recovery, up to 100 stored versions, undo/redo, and reusable templates.
- Consent-aware audience preview, immutable recipient snapshots, review, test delivery, scheduling, immediate send confirmation, and CSV results export.
- Delivered, opened, clicked, bounced, complained, unsubscribed, per-link, and per-recipient activity.

The existing `/admin/email-studio` route remains available for compatibility. New broadcast work belongs in `/admin/letters`.

## Delivery protections

Only subscribers with `status = subscribed`, `consent_status = granted`, and no active suppression can enter a broadcast snapshot. Eligibility is checked again immediately before each recipient is sent. A recipient who unsubscribed, bounced, complained, or became suppressed after review is skipped and recorded instead of being delivered.

Every normalized design contains exactly one unsubscribe block at the end. Sent messages also include `List-Unsubscribe` and `List-Unsubscribe-Post` headers. The visible unsubscribe page uses a confirmation step for ordinary links and supports provider one-click POST requests. Unsubscribing writes Phase 27 consent and suppression history without changing client services or portal access.

The reviewed title, subject, preview text, and design are frozen on the broadcast record. Scheduled letters are read-only until the schedule is cancelled, so later draft edits cannot silently change reviewed mail.

## Provider and public-link configuration

Set these values in `server/.env`; never commit real keys:

```dotenv
PUBLIC_SITE_URL=https://www.example.com
PUBLIC_API_URL=https://api.example.com
RESEND_API_KEY=
NEWSLETTER_EMAIL_FROM="Power Within Collective <letters@example.com>"
NEWSLETTER_REPLY_TO=hello@example.com
RESEND_WEBHOOK_SECRET=
LETTER_SIGNING_SECRET=
LETTER_SEND_CONCURRENCY=1
LETTER_SEND_BATCH_DELAY_MS=550
```

`PUBLIC_API_URL` must be the browser-accessible backend origin because unsubscribe, tracking, and Asset Vault URLs are generated from it. `LETTER_SIGNING_SECRET` should be a separate high-entropy production secret. The concurrency and delay defaults deliberately pace provider requests; change them only to match the provider account's documented limits.

Register the verified Resend webhook endpoint as:

```text
POST /api/public/letters/webhooks/resend
```

The endpoint verifies the raw Svix-signed payload within a five-minute timestamp window and makes repeated provider event IDs idempotent. Bounce and complaint events update the Phase 27 subscriber and suppression records.

## Scheduled delivery and protected assets

The backend starts the due-broadcast dispatcher with the native server and checks due work every minute under a PostgreSQL advisory lock. The server must remain running for scheduled delivery. Operators may also use “Process due now” from the Scheduled section.

Open and click tokens expire after one year. Signed inline Asset Vault and resource links expire after 180 days and still pass Asset Vault active/scan-state checks before streaming. The unsubscribe token intentionally remains valid so recipients can withdraw consent from an older message.

Open tracking depends on a one-pixel image and may be affected by image blocking or privacy proxies. Click and provider webhook activity remain separate evidence. Analytics should be interpreted as operational delivery signals, not exact human-attention measurements.

## Database migration

Run the focused migration:

```powershell
npm --prefix server run db:migrate-letter-builder
```

The ordered migration runner also includes Phase 28 after the Phase 27 audience migration. The migration creates letter, version, template, broadcast, recipient, tracking, event, and test-send tables and extends newsletter send-history delivery statuses.

## Verification

Focused Phase 28 verification:

```powershell
npm run admin:qa:phase28
```

Full verification before handoff:

```powershell
npm run admin:qa
npm --prefix server test
```

Automated tests do not call the external email provider. A real test email should only be sent manually after the provider, sender domain, public API URL, signing secret, and webhook secret are configured in the intended non-production environment.
