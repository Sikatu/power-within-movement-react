# Phase 50 — Final Release Candidate

Phase 50 is the feature finish line for the current Power Within Collective build. It does not add another workspace or another layer of administration. It updates the launch gate so the finished system—not the older Phase 30 foundation—is what must pass before production.

## What changed

- The Release Gate is now labeled **Phase 50 · Final Release Candidate**.
- Automated readiness verifies all 76 feature-critical tables used by the completed public site, Studio, Founder workspace, Developer tools, and client portal.
- The gate blocks deployment when the Error Center fingerprint constraint or notification deduplication index is missing.
- Exactly one primary Studio Profile must exist.
- Live read-only checks now include Studio Profile, Notification Center, and Developer incident triage.
- The signed proof ledger now includes notification delivery, private client messaging, Studio identity, and incident triage, for 24 evidence items total.
- The deployment runner executes Phase 50 QA before ordered migrations, build, and PM2 reload.
- The release evidence manifest now requires `"phase": 50` and supports `PWC_RELEASE_EVIDENCE_FILE`.

## What remains after Phase 50

These are release actions, not more feature-development phases:

1. Restart the local frontend and backend and complete visual acceptance with real data.
2. Run **Developer Operations → Release Gate** and retain the four-viewport and role-permission evidence.
3. Open and merge the final pull request into `main` after approval.
4. Rehearse ordered migrations on an isolated production backup.
5. Create and verify the production backup, sign the 24-item evidence manifest, deploy, and complete post-deployment smoke checks.

Any defect found during acceptance should be handled as a focused release-candidate repair, not a new feature phase.

## Local verification

```powershell
npm.cmd run admin:qa:phase50
npm.cmd run admin:qa:phase30
npm.cmd test
```

The historical Phase 30 command and file paths remain available for compatibility, but the current readiness response, proof manifest, UI, and deployment QA are Phase 50.
