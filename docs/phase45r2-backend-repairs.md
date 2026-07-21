# Phase 45R2 — Backend repairs

## Outcome

Founder recording previews and downloads can redeem their private Asset Vault grants, and the Developer Error Center can persist repeated reports on legacy databases.

## Repair

- Replaced the PostgreSQL-reserved `grant` SQL alias with the explicit `access_grant` alias.
- Preserved transaction locking, single-use download behavior, signed-token verification, and private asset delivery.
- Reused the existing idempotent Developer Error Center migration to merge legacy duplicate fingerprints before restoring the required unique constraint.
- Added regression coverage for the Asset Vault query and a Phase 45R2 backend audit.

## Local database step

Run the idempotent Error Center repair against the configured local database:

```powershell
npm.cmd --prefix server run db:migrate-developer-error-center
```

## Verification

```powershell
npm.cmd run admin:qa:phase45r2
npm.cmd run admin:qa:phase30
npm.cmd test
```
