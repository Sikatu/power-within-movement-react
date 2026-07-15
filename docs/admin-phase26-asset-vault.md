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

## Database entities

- `asset_folders`
- `assets`
- `asset_versions`
- `asset_assignments`
- `asset_access_logs`

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
