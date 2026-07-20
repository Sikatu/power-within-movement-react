# Phase 41 — Client workflow streamlining

Phase 41 follows the simplified Phase 40 portal shell into the four primary client workspaces.

## Outcomes

- Keeps Journey focused on the current reflection and next step, with totals and full service history behind one optional disclosure.
- Keeps the newest private resource prominent while moving category filters into a compact Library control.
- Separates “Upcoming” and “Book a session” so clients complete one scheduling task at a time.
- Keeps previous sessions available in a native history disclosure.
- Separates open and closed private conversations without mixing them in one long list.
- Retains the dedicated Encouragements view and unread counts.
- Shortens client-facing headings and supporting copy while preserving the established visual language.

## Preserved privacy and functionality

- Cookie-authenticated Journey, resource, booking, change-request, conversation, and Encouragement data.
- Shared reflections, follow-ups, service history, resource search, type filters, and safe links.
- New bookings, live availability, rescheduling, cancellations, and previous sessions.
- New private messages, replies, attachments, close/reopen actions, and read tracking.
- Expired-session recovery and secure client sign out.
- Existing API contracts, routes, database records, public site, admin tools, and footer.

## Verification

```powershell
npm.cmd run portal:qa:phase41
npm.cmd run admin:qa:phase30
npm.cmd test
```
