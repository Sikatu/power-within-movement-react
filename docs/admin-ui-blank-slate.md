# Admin UI blank slate

The admin presentation system has been reset so the next interface can be built once, cleanly.

## Removed

- All 20 retired legacy admin stylesheets.
- All 11 newer Phase 1–9 admin presentation stylesheets.
- All imports that referenced either design generation.

## Preserved

- React pages and route structure.
- API requests and backend integrations.
- Authentication and role guards.
- Permissions, forms, workflows, and database behavior.
- Accessibility attributes and functional navigation behavior.
- Public website and client portal presentation.

## Temporary baseline

`src/pages/admin/AdminUIBlankSlate.css` contains only neutral structural and accessibility defaults. It intentionally avoids the Power Within visual language so the fresh admin design can be applied without cascade overlap.

`npm run lint` runs `scripts/check-admin-ui-reset.mjs`, which fails if any deleted UI stylesheet or import returns.
