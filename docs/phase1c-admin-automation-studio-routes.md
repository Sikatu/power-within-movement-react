# Phase 1C — Admin Automation Studio Route Extraction

## Scope

Phase 1C extracts all six Automation Studio HTTP endpoints from the legacy Admin router into `server/src/routes/admin.automationStudio.routes.js`:

- `GET /api/admin/automation-studio`
- `POST /api/admin/automation-studio/workflows`
- `PUT /api/admin/automation-studio/workflows/:workflowId`
- `POST /api/admin/automation-studio/workflows/:workflowId/enroll`
- `POST /api/admin/automation-studio/enrollments/:enrollmentId/action`
- `POST /api/admin/automation-studio/run-due`

## Preserved contracts

- Endpoint methods, URLs, status codes, response payloads, and messages are unchanged.
- Developer, owner, admin, and staff authorization remains unchanged.
- Team permission and client-assignment middleware remain active.
- Staff enrollment and enrollment-action access still receives a second assignment check against `team_client_assignments`.
- Workflow, step, enrollment, and action validation schemas are unchanged.
- Run-now execution and the 50-step due-processing bound are unchanged.
- The `enrollMatchingAutomations` helper remains in the legacy router because lead creation still calls it outside the Automation Studio endpoint block.
- No database migration, frontend change, email send, deployment, or production restart is included.

## Verification

- A seven-test route-contract suite verifies route registration, middleware, validation, staff assignment checks, bounded processing, mount order, and removal from the monolithic router.
- The Phase 33 Growth workflow audit follows the owned route module and confirms all six backend actions remain present.
- The Security & Data Integrity audit includes the extracted mutation routes and verifies the trusted-mutation mount.
