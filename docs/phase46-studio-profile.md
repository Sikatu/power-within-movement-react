# Phase 46 — Studio Profile & Brand Media

Phase 46 turns the reserved Studio Profile roadmap into one simple, owner-friendly workspace.

## Outcomes

- Adds **Studio Profile** under Client Experience for developer, owner, and authorized admin accounts.
- Keeps the daily editor compact: identity, welcome copy, short bio, signature, public contact details, and one profile image.
- Reuses the private Asset Vault instead of creating a second upload system.
- Supports direct image upload, searchable Vault selection, a protected preview, replacement, and removal.
- Shows a live profile preview before anything is saved.
- Records every save in the existing private audit journal.

## Safety

- Accepts only active image assets whose scan state is clean or truthfully disabled.
- Rejects documents, audio, video, archived assets, and pending or blocked scans.
- Keeps the selected asset private; previews use the existing short-lived authenticated grant.
- Adds an idempotent singleton table with foreign keys and no destructive data operation.
- Does not publish contact details or media to the public website in this phase.
- Preserves all existing routes, portal workflows, admin workspaces, records, and the public footer.

## Database migration

```powershell
npm.cmd --prefix server run db:migrate-studio-profile
```

The migration is included in the ordered migration runner.

## Verification

```powershell
npm.cmd run admin:qa:phase46
npm.cmd run admin:qa:phase30
npm.cmd test
```
