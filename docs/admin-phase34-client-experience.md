# Admin Phase 34: Client Experience streamlining

Phase 34 simplifies the five Studio Client Experience tools while preserving delivery, publishing, access, and moderation controls.

## Asset Vault

- Separates the daily Library from the Upload workflow.
- Opens each selected asset on Client delivery.
- Moves metadata into Details and relationships/version history into Reuse & versions.
- Returns a newly uploaded asset to Client delivery so it can be assigned immediately.

## Encouragements

- Opens on the message library instead of displaying the library and composer together.
- Uses focused Messages and Compose modes.
- Opens Compose automatically when creating or editing, then returns to Messages after a successful save.

## Programs

- Opens existing programs on Client access.
- Uses Client access, Lessons, and Details task labels.
- Keeps newly created program drafts on Details so setup remains guided.

## Memberships

- Opens existing plans on Members.
- Uses Members, Content, Updates, and Details task labels.
- Keeps newly created plans on Details for initial configuration.

## Circle

- Uses shorter Post and Moderation modes.
- Opens moderation automatically when the selected post has an unresolved report.
- Preserves post publishing, comment moderation, and private report review.

## Verification

```powershell
npm.cmd run admin:qa:phase34
npm.cmd run admin:qa:phase30
npm.cmd test
```
