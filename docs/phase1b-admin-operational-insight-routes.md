# Phase 1B — Admin Operational Insight Routes

## Scope

Phase 1B extracts six read-only operational insight endpoints from the legacy Admin router into `server/src/routes/admin.operationalInsights.routes.js`:

- `GET /api/admin/team/workload`
- `GET /api/admin/client-momentum`
- `GET /api/admin/client-coverage`
- `GET /api/admin/session-readiness`
- `GET /api/admin/session-follow-through`
- `GET /api/admin/team/my-access`

## Preserved contracts

- Endpoint methods and URLs are unchanged.
- The existing developer, owner, admin, and staff role boundary is unchanged.
- Team permission and client-assignment enforcement remain active.
- Session `days` query forwarding is unchanged.
- No database schema, frontend, or response-shape changes are included.

## Verification

The slice adds a source and Express-router contract suite covering route registration, middleware count, mount order, query forwarding, viewer-scoped access, and removal from the monolithic router. Existing feature checks now read the owned route module rather than relying on the former file location.
