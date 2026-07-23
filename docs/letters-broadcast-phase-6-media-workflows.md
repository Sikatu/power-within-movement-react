# Letters & Broadcasts — Phase 6 Media Workflows

Phase 6 upgrades media authoring without changing the version 1 Letter schema,
broadcast snapshots, delivery contracts, or Asset Vault security model.

## Delivered

- Image-only filtering for image and video-preview blocks.
- Searchable visual asset cards with persistent selected-asset context.
- Private image previews in the picker and editing canvas.
- In-editor Asset Vault uploads with progress and automatic selection.
- Image input validation before upload.
- Accessibility readiness warnings when selected images lack alternative text.
- Resource uploads remain available for supported non-image files.

## Safety boundaries

- Letter documents continue to store only Asset Vault IDs.
- Production delivery continues to resolve short-lived signed asset URLs.
- Existing version 1 Letters normalize without migration.
- Upload scanning and Asset Vault permissions remain authoritative.
- No broadcast, email, deployment, or production data operation is performed by
  this phase.
