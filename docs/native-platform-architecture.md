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

## Current phase

Phase 2.0 creates:
- Express backend API
- PostgreSQL schema draft
- Health endpoint
- Platform blueprint endpoint

## Local backend URLs

- http://localhost:8787/api
- http://localhost:8787/api/health
- http://localhost:8787/api/system/blueprint

## Next phase

Phase 2.1:
- Install or connect PostgreSQL
- Create local database
- Apply 001_initial_schema.sql
- Create first owner/admin user
- Add real authentication