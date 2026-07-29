# Phase 0 Repository Stabilization

**Project:** Power Within Movement React
**Completed:** July 29, 2026

## Objective

Stabilize the current in-progress repository before further visual and workflow changes. The pass preserves valid uncommitted work, prevents required modules from being omitted, removes unsafe handoff files, reduces CSS concentration, and makes release checks resilient to harmless formatting changes.

## Completed work

### Working-state protection

- Preserved the required extracted administration routes and founder scheduling modules.
- Removed temporary or unsafe local files from the deliverable, including the credential-bearing database diagnostic, the local environment file, and the empty weather file.
- Removed unused experimental administration components and the unused browser transcription worker.
- Added ignore rules for local database diagnostics and weather inspection output.

### Admin CSS stabilization

- Split the oversized administration stylesheet into an ordered entry module, core stylesheet, and enhancement stylesheet.
- Preserved cascade order so the current interface remains visually consistent.
- Removed the malformed founder-calendar CSS fragment containing literal escaped newline characters.
- Removed duplicate rules and two unnecessary `!important` declarations.
- Added separate size budgets for the core, enhancement, and aggregate administration CSS.

### Release-check hardening

- Added a shared PostCSS-based administration-style inspection utility.
- Reworked brittle checks so multiline formatting no longer produces false failures.
- Updated Studio Profile validation to follow the extracted route module.
- Added a consolidated `npm run qa:checks` command that executes all repository release gates and reports all failures together.

### Dependency cleanup

- Removed the unused browser-side Transformers dependency and transcription worker.
- Added PostCSS as a direct development dependency for deterministic CSS validation.
- Kept server-side transcription behavior intact.

## Validation results

| Validation | Result |
|---|---:|
| ESLint across frontend, backend, tests, and scripts | Passed |
| Custom repository release gates | 63 / 63 passed |
| Backend automated tests | 125 / 125 passed |
| Unreferenced source-file scan | Passed |
| Unused asset scan | Passed |
| PostCSS parsing of both administration stylesheets | Passed |
| Sensitive-file review of deliverable | Passed |

## Production-build limitation in the audit environment

The production Vite bundle could not be executed in the audit container because the uploaded dependency folders contain the Windows-only Rolldown native binary, while the audit container is Linux. A clean dependency installation was also blocked by the container's package mirror. This is an environment limitation, not a successful build result.

Run the following from a clean Windows checkout or CI environment before deployment:

```powershell
npm ci
npm --prefix server ci
npm run lint
npm run qa:checks
npm test
npm run build
```

## Recommended next phase

Proceed with controlled modularization of `server/src/routes/admin.routes.js` and `src/lib/nativeApi.js`, followed by browser-level accessibility and regression testing. Avoid adding another broad override layer to the administration stylesheets before those protections are in place.
