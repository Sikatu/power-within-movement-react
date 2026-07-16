# Admin Phase 37: Founder workflow streamlining

Phase 37 gives Kim a calmer Founder experience without weakening private recording, scheduling, availability, or access controls.

## Founder’s View

- Opens on Today, showing only the schedule, booking decisions, and client-care follow-up that matter now.
- Separates Protect My Time, Voice Notes, and World Clocks into focused task views.
- Keeps the selected task in the URL so browser history and direct links remain useful.
- Retains Calendar, Availability, The Studio, and Sign Out in the existing responsive navigation.
- Loads the private command-center data once and reveals advanced tools only when selected.

## Availability

- Replaces the long two-column editor with two clear choices: Usual Week and Change One Date.
- Shows only the editor needed for the selected task.
- Opens one-date mode automatically when arriving from a calendar date or Founder quick action.
- Keeps special dates beside the one-date editor for quick review and correction.
- Preserves copy-from-Monday, per-day time windows, booking preferences, validation, publishing, private notes, and date overrides.

## Preserved privacy and efficiency

- Private recordings retain recording consent, Asset Vault storage, playback, metadata, transcription, Letter reuse, explicit client sharing, archival, restoration, retention, and title-confirmed deletion.
- World Clocks retain timezone validation and never alter scheduling timezone or existing bookings.
- Calendar retains month navigation, day details, session visibility, date protection, reopening, and direct availability customization.
- Owner/developer route guards and server-side Founder authorization remain unchanged.

## Verification

Run:

```powershell
npm.cmd run admin:qa:phase37
npm.cmd run admin:qa:phase30
npm.cmd test
```
