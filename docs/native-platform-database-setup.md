# Native Platform Database Setup

The backend is custom. PostgreSQL is the database.

## Current status

Phase 2.1 adds:

- Database connection check script
- Schema migration script
- First owner seed script

## Required local environment

Create or update:

server/.env

Required values:

DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/power_within_native
JWT_SECRET=local-dev-secret-change-this
SEED_OWNER_EMAIL=your@email.com
SEED_OWNER_PASSWORD=your-secure-password
SEED_OWNER_FIRST_NAME=YourFirstName
SEED_OWNER_LAST_NAME=YourLastName

## Commands

From the server folder:

npm run db:check
npm run db:migrate
npm run db:seed-owner
npm run dev

## Local backend URLs

http://localhost:8787/api
http://localhost:8787/api/health
http://localhost:8787/api/system/blueprint