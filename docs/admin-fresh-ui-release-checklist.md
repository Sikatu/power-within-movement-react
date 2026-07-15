# Admin Fresh UI Release Checklist

Use this checklist before merging or deploying the Fresh UI branch.

## Automated gates

Run from the repository root:

```powershell
npm.cmd run admin:qa
```

This must pass the Fresh UI stylesheet guard, route audit, safe-dialog audit, resilience audit, Production Release QA audit, visual-coverage audit, ESLint, and the Vite production build.

## Local runtime review

Start the backend and frontend in separate PowerShell windows:

```powershell
npm.cmd --prefix server run dev
npm.cmd run dev
```

Review at desktop, tablet, and mobile widths:

- `/admin/login`
- `/admin/dashboard`
- `/admin/clients`
- `/admin/scheduler`
- `/admin/inbox`
- `/admin/email-studio`
- `/admin/founders-view`
- `/admin/founders-calendar`
- `/admin/founders-availability`
- `/admin/developer`
- `/admin/developer/errors`
- `/admin/developer/integrity`
- `/admin/developer/qa`

Confirm that navigation, dialogs, drawers, tables, empty states, and long records remain usable without horizontal page overflow.

## Real-data gate

Open `/admin/developer/qa`, run the complete read-only QA matrix, and retain a copied report. Resolve all failed contracts. Review warning routes at 1440 × 900, 1280 × 800, 768 × 1024, and 390 × 844.

## Production checks

- Confirm the production API health endpoint responds.
- Confirm the authenticated owner, developer, admin, and staff roles open only their permitted workspaces.
- Verify destructive actions show the Studio confirmation dialog.
- Verify route recovery appears instead of a blank screen when a lazy chunk fails.
- Confirm browser console has no uncaught errors during representative navigation.
- Keep the rollback branch until production verification is complete.
