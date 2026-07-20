# Phase 45R1 — Founder workspace shell hotfix

## Outcome

The live Founder workspace keeps its calm, premium standalone layout while preserving every Phase 45 action.

## Repair

- Restored the grouped admin descendant selectors used by the Founder home, calendar, and availability pages.
- Restored the branded top bar, navigation spacing, centered content shell, and responsive actions.
- Applied the same selector correction to the shared streamlined admin styles so other grouped page components do not lose their intended presentation.
- Preserved Founder messaging, calendar, availability, voice, clock, and sign-out behavior.

## Verification

Run:

```powershell
npm.cmd run admin:qa:phase45r1
npm.cmd run admin:qa:phase30
npm.cmd test
```

The Phase 45R1 audit rejects the malformed `body.admin-app-mode:where(...)` pattern that caused the regression.
