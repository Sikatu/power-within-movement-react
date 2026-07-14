# Admin UI style cascade

The private Studio UI uses two presentation tiers:

1. `pwc-admin-legacy` contains the older structural styles that the React workspaces still need.
2. The modern foundation and Phase 3–9 refinement files remain unlayered, so they always take precedence over the legacy tier.

## Rules

- Legacy files must remain inside `@layer pwc-admin-legacy`.
- Legacy files must not use `!important`.
- New visual work belongs in the modern/refinement files, not in a legacy file.
- Shared modern admin rules belong in `AdminFoundationModern.css`.
- Shared modern shell rules belong in `AdminFrameModern.css`.
- Run `npm run lint` after UI changes. The lint command includes `scripts/check-admin-css.mjs`, which rejects legacy cascade regressions.

This arrangement preserves the existing forms, grids, and workflow structure while preventing retired UI passes from overriding the current design system.
