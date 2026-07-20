# Phase 44 — Client Notification Center

Phase 44 brings the existing private notification system into the client portal as one calm, global Updates drawer.

## Outcomes

- Adds a compact Updates control to every authenticated client portal page.
- Shows an unread count without interrupting the client’s current task.
- Brings messages, sessions, resources, learning, memberships, encouragements, community, and system updates into one filtered list.
- Keeps read, mark-all-read, remove, and clear-read actions available without adding another portal page.
- Gives clients simple email preferences by update category while in-app updates remain available.
- Uses the client’s device time zone when displaying update dates.
- Keeps the mobile header compact by moving the less-used Website link out of the narrowest layout.

## Safety and accessibility

- Every notification query and mutation remains scoped to the authenticated recipient.
- Client actions can navigate only to `/client-portal` destinations; admin actions can navigate only to `/admin` destinations.
- External and cross-workspace redirects are rejected.
- The drawer locks background scrolling, closes with Escape or backdrop selection, contains keyboard focus, and returns focus to the trigger.
- Native buttons, tab semantics, visible focus, reduced-motion support, and forced-colors support remain available.
- Existing database producers continue to generate updates for private messages, session changes, resources, learning access, memberships, encouragements, and community moderation.

## Preserved functionality

- Existing Notification Center database schema, delivery queue, Resend adapter, expiry, de-duplication, read state, dismissal, and email preferences.
- Existing client authentication, private audit logs, API contracts, and feature flags.
- Existing admin Notification Center and Activity Center access.
- Existing client portal routes, public website, admin workspaces, database records, and public footer.

## Verification

```powershell
npm.cmd run portal:qa:phase44
npm.cmd run admin:qa:phase30
npm.cmd test
```
