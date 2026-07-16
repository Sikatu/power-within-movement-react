# Admin Phase 38: Developer workflow streamlining

Phase 38 simplifies the protected Developer workspace without weakening platform health, security, access, release, or team-management controls.

## Developer navigation

- Replaces five visible Developer destinations with Command Center and Staff & Team.
- Keeps Error Center, Security & Integrity, and Release QA available through Quick Find, direct links, and legacy URLs.
- Keeps matching legacy routes inside the correct Command Center view.
- Preserves route preloading and developer-only authorization.

## Command Center

- Reorganizes seven technical views into four outcomes: Monitor, Protect, Release, and Configure.
- Shows only the secondary views belonging to the selected outcome.
- Keeps Overview, System Health, Errors, Integrity, Accounts & Access, Release Gate, and Configuration intact.
- Preserves embedded error triage, integrity checks, Phase 30 evidence, feature flags, maintenance controls, monitoring policy, and account actions.

## Staff & Team

- Opens each selected member on Profile instead of one long form.
- Separates Profile, Permissions, and Client Assignments into focused views.
- Keeps unsaved draft values while switching between views.
- Preserves access templates, module-level None/View/Manage permissions, permanent-account locks, developer-only notes, workload settings, assignment roles, and client search.

## Verification

Run:

```powershell
npm.cmd run admin:qa:phase38
npm.cmd run admin:qa:phase30
npm.cmd test
```
