# Phase 45 — Client Messages

Phase 45 unifies daily encouragements and portal announcements into one calm, native communication workflow.

## Outcomes

- Renames the Studio workspace to **Client Messages** while preserving the existing `/admin/encouragements` route and API contracts.
- Lets the team choose between a warm encouragement and a clear portal announcement before writing.
- Preserves one-client or all-active-client audiences, drafts, immediate publishing, scheduled publishing, archiving, search, and read insights.
- Adds a compact message-type filter to the admin library.
- Gives Kim a direct **Share a message** action from Founder’s View without adding the full Studio interface there.
- Renames the client-facing area to **Notes & Updates** with simple All, Encouragements, and Announcements filters.
- Opens new-message notifications directly in Notes & Updates and formats dates in the client’s device time zone.

## Delivery and privacy

- Adds `message_type` to `encouragement_posts` through an additive, idempotent migration; existing rows become encouragements.
- Validates message types in the API and database.
- Keeps client message reads scoped to the authenticated client profile.
- Repairs the existing publish notification producer so an all-client message reaches every active client, not only pre-existing recipient rows.
- Uses higher notification importance for portal announcements while encouragements remain calm and normal priority.
- Keeps all notification actions inside the private client portal.

## Preserved functionality

- Existing feature flags, admin authentication, client authentication, audit logs, scheduling timezone, read tracking, notification preferences, and email queue.
- Existing drafts and published encouragements, with no data deletion or database reset.
- Existing private inbox, client portal routes, admin workspaces, public website, and public footer.

## Database migration

```powershell
npm.cmd --prefix server run db:migrate-client-messages
```

The migration is also included in `db:migrate:ordered` for normal deployment.

## Verification

```powershell
npm.cmd run portal:qa:phase45
npm.cmd run admin:qa:phase30
npm.cmd test
```
