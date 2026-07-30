# Phase 1D — Admin Team Management Route Extraction

## Scope

Phase 1D extracts the Developer Team Management backend from the legacy Admin router into `server/src/routes/admin.teamManagement.routes.js`:

- `GET /api/admin/developer/team`
- `PATCH /api/admin/developer/team/:userId`
- `PUT /api/admin/developer/team/:userId/client-assignments`

## Preserved contracts

- Endpoint methods, URLs, status codes, response payloads, and messages are unchanged.
- All three endpoints remain developer-only.
- Team profile and permission updates remain transactional.
- Administrator permissions remain locked to the full-access profile.
- Staff permission templates and custom permissions retain their existing normalization rules.
- Client assignments remain deduplicated, validated against existing client profiles, replaced transactionally, and audited.
- Existing audit actions, IP addresses, and user-agent evidence are unchanged.
- No database migration, frontend change, deployment, email send, or production restart is included.

## Verification

- A seven-test route-contract suite verifies route registration, mount order, developer authorization, validation, permission locking, transactional audit behavior, assignment replacement, and removal from the monolithic router.
- The Phase 38 Developer workflow audit follows the owned Team Management module.
- The Security & Data Integrity audit includes the extracted mutation routes and verifies their trusted-mutation mount.
