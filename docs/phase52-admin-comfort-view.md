# Phase 52 — Admin Comfort View

Phase 52 gives each authorized admin user a personal readability choice without replacing the streamlined interface. Compact view remains the default, while Comfort View increases the legibility and touch size of the same controls and content.

## What changed

- Added an accessible Comfort View switch inside the shared page guide.
- Increased body copy, helper text, labels, table content, form controls, and action text when Comfort View is active.
- Increased key navigation and control targets without hiding any tool or changing a workflow.
- Kept the preference synchronized across open tabs.
- Stored the choice as a browser-local preference; it does not enter the database, audit log, client portal, or another user’s account.
- Preserved the existing compact view as the default for experienced operators and smaller workstations.
- Added responsive, reduced-motion, and forced-color safeguards for the new control.

## How to use it

1. Open any framed admin workspace.
2. Select **Help** in the sidebar or press `?`.
3. Turn **Comfort View** on or off.

The preference applies immediately throughout The Studio, Founder’s View, and Developer Operations. The browser remembers the choice on the same device.

## Safety boundaries

Comfort View changes presentation only. It does not change permissions, data, confirmations, delivery eligibility, publishing state, session status, or protected backend behavior.

## Verification

```powershell
npm.cmd run admin:qa:phase52
npm.cmd run admin:qa:phase30
npm.cmd test
```

Visually verify both modes at desktop, tablet, and mobile widths. Confirm that the switch state is announced, text and controls become more readable, the layout remains usable, and a refresh preserves the selected mode.
