# Phase 24 — visual stability and real-data review

Phase 24 repairs the Studio document scroll model and standardizes the highest-risk real-data layouts before further feature work.

## Required viewport matrix

- 1440 × 900 — desktop
- 1280 × 800 — laptop
- 768 × 1024 — tablet
- 390 × 844 — mobile

## Global interaction checks

1. Use the mouse wheel over the page background, forms, cards, and empty states.
2. Confirm the document scrolls naturally and the browser scrollbar remains available.
3. Open and close Quick Find, a confirmation dialog, mobile navigation, and Developer preview overlays.
4. Confirm closing an overlay always restores document scrolling.
5. Navigate to another Studio route and confirm the new page starts at the top.
6. Confirm keyboard Page Up, Page Down, Home, End, and Space scrolling work when focus is not inside a control.
7. Confirm there is no horizontal document overflow.

## The Circle

- Post library and composer are proportionate at desktop and laptop widths.
- An empty post library remains compact and includes a clear create action.
- Post type and audience controls remain on one row when space permits.
- Checkbox titles and descriptions render on separate lines.
- The message editor is usable without dominating the full page.
- Draft and publish actions stay connected to the composer.
- Mobile layouts stack controls and actions without clipping.
- Moderation lists use normal document scrolling.

## Client Momentum

- The client list and selected-client panel remain balanced.
- Client cards use one readable list column instead of dense narrow tiles.
- Long names, email addresses, goals, and team-member lists wrap or truncate safely.
- The selected-client detail panel does not create an additional trapped scrollbar.
- Metrics and filters remain aligned at every required viewport.
- Action buttons remain visible and reachable.

## Release gate

Phase 24 passes when all checks above succeed with realistic local data and the complete `npm run admin:qa` suite remains green.
