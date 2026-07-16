# Admin Phase 35: Communication workflow streamlining

Phase 35 simplifies the three Studio Communication tools while preserving delivery, consent, and session-review controls.

## Letters & Broadcasts

- Replaces seven top-level destinations with three daily modes: Letters, Delivery, and Results.
- Opens on recent letters, with New Letter and reusable Templates available only when needed.
- Combines scheduled and sent broadcasts into one focused Delivery queue.
- Keeps audience readiness close to delivery with a direct handoff to Newsletter Audience.
- Preserves design, autosave, version recovery, templates, recipient selection, tests, scheduling, immediate sending, cancellation, due processing, analytics, and CSV export.

## Newsletter Audience

- Opens on the searchable directory instead of the add-recipient form.
- Separates Directory, Add People, and Import History into clear tasks.
- Opens a selected recipient in a focused record with Profile, Consent & Status, and Delivery History views.
- Keeps bulk labels, one-person entry, multiple pending addresses, CSV import, consenting-client entry, profile updates, status protection, and consent history intact.

## Session Changes

- Keeps Needs Review as the default.
- Replaces a long stack of expanded requests with a compact queue and one focused review surface.
- Keeps Client Record access, private notes, guarded approval, guarded decline, and reviewed history intact.

## Verification

Run:

```powershell
npm.cmd run admin:qa:phase35
npm.cmd run admin:qa:phase30
npm.cmd test
```
