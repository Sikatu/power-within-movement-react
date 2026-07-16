# Phase 39 — Admin shell streamlining

Phase 39 completes the shared admin-shell simplification that supports every Studio, Founder, and Developer workflow.

## Outcomes

- Replaces the duplicate sidebar search and footer search button with one Quick Find entry near the workspace switcher.
- Keeps `Ctrl K`, keyboard navigation, recent destinations, pinned destinations, route warming, and cross-workspace discovery.
- Gives Quick Find the correct active-workspace context while clearly searching every accessible admin destination.
- Renames the workspace trigger and tool count with direct, accurate language.
- Compacts connection, account, Alerts, public-site, and sign-out controls without removing them.
- Sends mobile navigation focus to the single Quick Find control when the drawer opens.

## Preserved boundaries

- Server-verified admin sessions and secure sign out.
- Owner-, Developer-, Admin-, and staff-specific workspace access.
- Per-module staff permission checks and view-only messaging.
- Notification loading, filtering, preferences, reading, and dismissal.
- Hidden specialist destinations remain available through Quick Find without returning to the main sidebar.

## Verification

```powershell
npm.cmd run admin:qa:phase39
npm.cmd run admin:qa:phase30
npm.cmd test
```
