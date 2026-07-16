# Phase 23 real-data QA

Phase 23 adds a Developer-only Production Release QA workspace at `/admin/developer/qa`.

The workspace performs read-only checks against the current environment. It validates response shape, collection density, and response timing for the core Studio, client-care, session, and system endpoints. No mutation request is issued.

## Browser workflow

1. Sign in with the Developer account.
2. Open `/admin/developer/qa`.
3. Select **Run full QA**.
4. Resolve failed contracts before deployment.
5. Review every warning at the four listed viewport sizes.
6. Copy the report and retain it with the deployment record.

## Optional command-line workflow

The CLI requires an authenticated Bearer token or Cookie header.

```powershell
$env:PWC_QA_BASE_URL = "http://localhost:8787"
$env:PWC_QA_BEARER_TOKEN = "<temporary-developer-token>"
npm.cmd run admin:qa:live
```

The script is read-only and exits with code `1` when a release-blocking contract fails. Do not commit credentials or paste them into deployment logs.
