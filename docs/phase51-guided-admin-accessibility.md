# Phase 51 — Guided Admin Accessibility

Phase 51 adds a calm, contextual help layer to the completed admin system. It helps owners, Studio staff, and developers understand the page they are already using without adding permanent dashboard clutter or removing advanced capability.

## What changed

- Added a shared **Help** control to every framed admin workspace.
- Added the `?` shortcut to open help without leaving the current page.
- Added three-step contextual help for the 14 launch-critical Studio, Founder, and Developer routes.
- Added a safe fallback guide so every other authorized admin route remains supported.
- Added page-specific reminders before sensitive saves, publishing, delivery, access, and status changes.
- Connected the guide directly to Quick Find while preserving the existing `Ctrl K` shortcut.
- Added focus containment, Escape dismissal, focus restoration, modal semantics, and scroll locking.
- Improved mobile touch targets and delivered a bottom-sheet guide on narrow screens.
- Added reduced-motion and forced-color safeguards without changing role checks, private data boundaries, or backend actions.

## Operating model

The guide follows one pattern everywhere:

1. Understand the current situation.
2. Select one record or task.
3. Complete and verify one clear next action.

The guide is intentionally on demand. It does not compete with normal work, and experienced users can continue using the interface exactly as before.

## Keyboard access

- `?` opens the guide unless focus is inside a form field.
- `Ctrl K` or `Command K` opens Quick Find.
- `Tab` and `Shift Tab` remain contained within the open guide.
- `Escape` closes the guide and restores focus to the control that opened it.

## Verification

```powershell
npm.cmd run admin:qa:phase51
npm.cmd run admin:qa:phase30
npm.cmd test
```

Visually verify the Help control and page guide on desktop, tablet, and mobile. Confirm that the guide matches the current page, keyboard focus stays inside the open dialog, Quick Find opens from the guide, and closing returns focus to Help.
