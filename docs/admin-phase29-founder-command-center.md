# Phase 29 — Founder Command Center

Phase 29 upgrades `/admin/founders-view` with a DST-aware live clock and a private voice-recording workflow. It does not merge to production or deploy the application. Production release remains reserved for Phase 30.

## Live clocks without scheduling side effects

The Founder clock defaults to `America/Chicago`, updates every second without a page refresh, and shows the current date plus the timezone name and abbreviation. The saved comparison view supports Eastern, Central, Mountain, Pacific, Philippines, UK, and a validated custom IANA timezone.

Clock preferences live in `founder_tool_preferences`. Booking and availability behavior continues to use `founder_availability_settings.timezone`. Saving or removing a comparison clock never updates a booking, stored availability window, scheduling timezone, or session timestamp. The interface identifies both timezones separately.

## Private voice workflow

The browser recorder supports Start, Pause, Resume, Stop, a live duration, an audio-level meter, and playback before saving. Microphone access is requested only after the Founder acknowledges the recording-consent reminder.

Audio saves through the backend into private Asset Vault storage. The server creates the Asset, version, Founder recording, and source relationship in one database transaction. New recordings are private to the owner and developer. The general Asset Vault hides Founder recording assets from the admin role, and every Founder recording route independently enforces owner/developer access.

Saved recordings support:

- Rename, private notes, tags, folders, search, playback, and download.
- Server transcription requests, transcript editing, transcript search, and copy.
- Explicit client assignment and revocation through the existing private client portal resource flow.
- Creating a new visual Letter draft from a stored transcript.
- Archive, restore, a saved retention-review date, and exact-title permanent deletion.

Permanent deletion revokes active grants, revokes client assignments, archives connected client portal resources, deletes the transcript and database records, and then deletes the private storage object. The result reports storage-cleanup failure truthfully instead of claiming the object was removed.

Founder recording events and the platform audit log cover creation, metadata edits, listening, downloads, transcription request/completion/edit, client share/unshare, Letter reuse, archive/restore, and permanent deletion.

## Transcription provider boundary

Transcription is disabled by default. Provider credentials remain server-only and must never use a `VITE_` browser variable.

```dotenv
FOUNDER_TRANSCRIPTION_PROVIDER=disabled
FOUNDER_TRANSCRIPTION_API_URL=
FOUNDER_TRANSCRIPTION_API_KEY=
FOUNDER_TRANSCRIPTION_MODEL=
FOUNDER_TRANSCRIPTION_TIMEOUT_MS=120000
```

The current `generic` adapter posts the private audio as multipart form data to an intentionally configured server endpoint with a bearer credential. It accepts a plain response or JSON `text`, `transcript`, or `result.text`. Failed work retries at a bounded interval and stops after three attempts. A PostgreSQL advisory lock prevents overlapping dispatcher runs.

When the provider is disabled or incomplete, the interface says so, a request may be safely queued for later processing, and the dispatcher does not call an external service. No automated test calls a transcription provider.

## Migration and verification

Run the focused migration:

```powershell
npm --prefix server run db:migrate-founder-command-center
```

The ordered migration runner includes Phase 29 after Letters & Broadcasts. It creates Founder preferences, recordings, transcription jobs, and recording events.

Focused verification:

```powershell
npm run admin:qa:phase29
```

Full handoff verification:

```powershell
npm run admin:qa
npm --prefix server test
```

Before enabling real transcription, configure and validate a non-production provider endpoint, credential, storage policy, consent policy, and deletion process. Phase 30 owns migration rehearsal, production configuration, final QA, merge, and deployment.
