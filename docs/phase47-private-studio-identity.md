# Phase 47 — Private Studio Identity Integration

Phase 47 turns the saved Studio Profile into a useful private identity layer without publishing anything to the public website.

## Outcomes

- Adds two plain visibility controls to Studio Profile:
  - share the approved identity with authenticated clients;
  - separately share the saved email and phone.
- Keeps both options off by default.
- Carries the approved profile name and image through every authenticated Client Portal workspace.
- Uses the saved welcome message and signature on the client dashboard.
- Shows saved contact details only when the separate contact option is enabled.
- Uses the saved display name for the Founder greeting instead of hard-coded copy.

## Safety

- The identity JSON and image endpoints require an active client session.
- The profile image remains in the private Asset Vault.
- Image delivery verifies active status, scan readiness, and image MIME type.
- Public contact details remain hidden unless both private portal sharing and contact sharing are enabled.
- No public website route, header, footer, metadata, or unauthenticated login screen is changed.
- The migration only adds private-by-default Boolean columns and is safe to rerun.

## Database migration

```powershell
npm.cmd --prefix server run db:migrate-studio-profile
```

## Verification

```powershell
npm.cmd run admin:qa:phase47
npm.cmd run admin:qa:phase30
npm.cmd test
```

## Owner workflow

1. Open `/admin/studio-profile`.
2. Review the saved name, welcome message, signature, and image.
3. Turn on **Use this identity in the Client Portal**.
4. Leave contact sharing off unless clients should see the saved email and phone.
5. Save, then sign in to the Client Portal to review the result.
