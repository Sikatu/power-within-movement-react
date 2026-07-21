# Admin Phase 33: Growth workflow streamlining

Phase 33 simplifies the Studio Growth tools without removing their operational controls or backend actions.

## Leads

- Opens on the stage containing the first active lead instead of forcing every pipeline column into view.
- Keeps every stage one click away, with live filtered counts and an explicit All view.
- Separates the selected lead workspace into Profile, Follow-ups, and Notes & activity.
- Preserves lead conversion, ownership, follow-up scheduling, task status, notes, and Client 360 links.

## Onboarding

- Opens on Clients, the primary day-to-day onboarding workflow.
- Uses short, task-oriented modes: Clients, Booking Rules, and Forms.
- Keeps appointment automation, intake template editing, onboarding assignments, response review, and due-message processing intact.

## Automations

- Opens on People & activity so active enrollments and exceptions are visible before configuration.
- Moves workflow configuration into a dedicated Builder mode.
- Keeps workflow creation, steps, enrollment, pause/resume/retry/cancel actions, and due processing intact.

## Verification

Run:

```powershell
npm.cmd run admin:qa:phase33
npm.cmd run admin:qa:phase30
npm.cmd test
```
