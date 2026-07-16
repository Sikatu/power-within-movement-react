# Power Within Native Platform

This project is moving toward a fully custom backend system.

## Native modules

1. Client CRM
   - Client profiles
   - Notes
   - Tags
   - Service history
   - Portal access

2. Native Scheduler
   - Appointment types
   - Availability
   - Booking requests
   - Intake questions
   - Appointment status management

3. Email Studio
   - Subscribers
   - Tags
   - Segments
   - Broadcasts
   - Encouragement campaigns
   - Lead magnet delivery

4. Courses
   - Courses
   - Modules
   - Lessons
   - Downloads
   - Progress tracking

5. Memberships
   - Membership tiers
   - Access rules
   - Member status

6. Daily Encouragements
   - All-member posts
   - Group messages
   - Private client messages

7. Audit Logs
   - Track admin changes
   - Track important system actions

8. Founder Command Center
   - DST-aware Founder and comparison clocks
   - Scheduling timezone shown separately from clock preferences
   - Private Asset Vault voice recordings
   - Server-only transcription queue and editable transcripts
   - Explicit client sharing and Letter draft reuse
   - Retention, archive, permanent deletion, and recording audit events

## Current phase

Phase 29 adds the Founder Command Center on the protected admin-foundation branch. Phase 30 remains responsible for migration rehearsal, complete release QA, production merge, and deployment.

## Local backend URLs

- http://localhost:8787/api
- http://localhost:8787/api/health
- http://localhost:8787/api/system/blueprint

## Next phase

Phase 30:
- Run the full ordered migration against the intended environment
- Verify storage, email, transcription, consent, privacy, and deletion configuration
- Complete production release QA
- Merge and deploy only after the release decision
