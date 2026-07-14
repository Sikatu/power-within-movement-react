# Admin Fresh UI

The private Power Within admin experience now uses one authoritative stylesheet:

`src/pages/admin/AdminFreshUI.css`

This file contains the shared design tokens, authentication presentation, Studio shell, navigation, dashboard, responsive behavior, controls, accessibility states, and neutral foundations used by remaining admin routes.

## Guardrail

`scripts/check-admin-ui-reset.mjs` runs with lint and fails when:

- a retired legacy or phased stylesheet returns;
- an admin component imports a retired stylesheet;
- more than one admin stylesheet exists under `src/components/admin` or `src/pages/admin`.

Future route refinements should be added to `AdminFreshUI.css` or migrated into a deliberately planned replacement—not added as new phase stylesheets.
