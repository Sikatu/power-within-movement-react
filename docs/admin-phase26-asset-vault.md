# Phase 26 — Asset Vault

Phase 26 establishes private reusable asset storage for the Studio.

## Local development

The default storage driver is `local`. Files are written below `server/storage/assets`, which is ignored by Git.

Run the database migration before opening the workspace:

```bash
npm --prefix server run db:migrate-asset-vault
```

Then open `/admin/assets` as a Developer, Owner, or Admin.

## Production object storage

Set the following backend environment variables to use private S3-compatible storage:

```text
ASSET_STORAGE_DRIVER=s3
ASSET_MAX_UPLOAD_BYTES=52428800
ASSET_S3_ENDPOINT=https://your-object-storage-endpoint
ASSET_S3_REGION=us-east-1
ASSET_S3_BUCKET=your-private-bucket
ASSET_S3_ACCESS_KEY_ID=...
ASSET_S3_SECRET_ACCESS_KEY=...
ASSET_S3_FORCE_PATH_STYLE=true
```

Objects remain private. Admin and client downloads are delivered through authenticated backend routes rather than permanent public URLs.

Admin previews and downloads use signed, purpose-scoped access grants. Grant tokens expire after 30–900 seconds (300 by default), and only their SHA-256 hashes are stored. Downloads are single-use; previews remain usable only until their short expiry so browser media and PDF range requests can complete.

## Database entities

- `asset_folders`
- `assets`
- `asset_versions`
- `asset_assignments`
- `asset_access_logs`
- `asset_access_grants`
- `asset_relationships`

Client assignment creates a compatible `client_portal_resources` record. Revocation removes that resource from the active client library while preserving assignment history.

## Supported file families

- PDF
- Word, Excel, and PowerPoint
- Plain text, CSV, and JSON
- JPEG, PNG, WebP, and GIF
- MP3, M4A, WAV, and WebM audio
- MP4 and WebM video

The default upload limit is 50 MB per file.

## Phase 26R.1 — Assign to all clients

A selected active asset can be assigned to every eligible client portal in one confirmed action.

- Includes non-archived client profiles.
- Excludes archived profiles and profiles attached to privileged non-client system accounts.
- Skips existing active assignments instead of creating duplicates.
- Reactivates revoked assignments and repairs assignments missing a portal resource.
- Uses one database transaction and locks the selected asset during the bulk operation.
- Records a bulk access event and audit summary with assigned and skipped counts.

## Phase 26R.2 — Secure reuse and delivery

Phase 26R.2 closes the production-hardening gaps without changing the production deployment schedule.

- Browser upload progress is shown for original assets and new versions.
- Previewable images, PDFs, text, audio, and video open through short-lived grants.
- Direct authenticated delivery remains available as a safe backend fallback and streams objects instead of buffering full downloads in application memory.
- Files carry an explicit scan state: `disabled`, `pending`, `clean`, `blocked`, or `failed`. Pending, blocked, and failed assets cannot be assigned, previewed, or downloaded.
- `ASSET_MALWARE_SCANNER=disabled` is truthful: it reports that no scan occurred. A non-disabled adapter begins uploads in `pending` and must be connected to a real provider before use.
- Admins can assign one asset to a searched multi-selection of eligible clients, with the same idempotent repair behavior as assign-all.
- Asset relationships provide reusable attachment, source-recording, transcript, and featured mappings for letters, Circle posts, founder recordings, transcripts, and later integrations.
- Developer Error Center copy actions redact credentials, emails, and identifiers. Monitoring policy editing now lives only in Developer Operations → Configuration.

Additional backend settings:

```text
ASSET_ACCESS_GRANT_SECRET=use-a-dedicated-production-secret
ASSET_ACCESS_GRANT_TTL_SECONDS=300
ASSET_MALWARE_SCANNER=disabled
```

Run the phase verification with:

```bash
npm run admin:qa:phase26r2
```
