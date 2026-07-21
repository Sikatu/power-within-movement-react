# Phase 45R2R1 — Studio authentication UI repair

## Outcome

The Studio login presents one centered premium card instead of an offset duplicate frame.

## Repair

- Removed the decorative card copy that appeared broken at compact desktop and tablet widths.
- Consolidated the surface into one softly bordered, elevated card.
- Preserved the existing mobile simplification, labels, autocomplete, loading feedback, authentication, and role-aware destination routing.
- Added an audit that rejects the duplicate pseudo-element frame if it returns.

## Verification

```powershell
npm.cmd run admin:qa:phase45r2r1
npm.cmd run admin:qa:phase30
npm.cmd test
```
