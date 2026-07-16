# Phase 40 — Client portal streamlining

Phase 40 begins the client-facing streamlining pass with the authenticated portal shell and home experience.

## Outcomes

- Reduces eight equal-weight navigation links to five primary destinations: Today, Journey, Library, Sessions, and Messages.
- Keeps Learning, Membership, and The Circle in an accessible Explore menu.
- Supports outside-click and Escape dismissal while retaining active-route and unread-message states.
- Rebuilds portal home around one contextual Today action and four direct shortcuts.
- Moves library totals, shared notes, follow-ups, session history, and service history behind one optional disclosure.
- Keeps the featured resource immediately visible without repeating the full library.

## Preserved privacy and functionality

- Cookie-authenticated dashboard, resource, booking, note, follow-up, and service-record data.
- Safe external-resource URL handling.
- Expired-session redirects and secure client sign out.
- Every authenticated client route remains available.
- Responsive desktop and mobile navigation.

## Verification

```powershell
npm.cmd run portal:qa:phase40
npm.cmd run admin:qa:phase30
npm.cmd test
```
