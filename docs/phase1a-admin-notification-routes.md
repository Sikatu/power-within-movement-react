# Phase 1A — Admin Notification Route Extraction

## Scope

This slice extracts the Admin Notification Center HTTP routes from the monolithic
`server/src/routes/admin.routes.js` file into the owned module
`server/src/routes/admin.notifications.routes.js`.

## Preserved contracts

- All eight `/api/admin/notifications*` URLs are unchanged.
- The existing `requireAuth`, role, team-permission, and client-assignment
  middleware chain is unchanged.
- Notification preference validation is unchanged.
- Preference changes continue to write the same audit-log event with IP and
  user-agent context.
- The module remains mounted behind `sensitiveResponseHeaders` and
  `enforceTrustedMutation`.

## Verification

- A backend contract test verifies module registration, route ownership,
  authorization, validation, and audit logging.
- The Security & Data Integrity gate now includes the extracted notification
  module when auditing protected mutation routes.
- No database migration, endpoint rename, frontend change, or visual change is
  included in this slice.
