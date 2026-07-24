# Letters & Broadcasts Phase 10 - Analytics, replies, and final refinement

Phase 10 completes the in-place Letters & Broadcasts rebuild at `/admin/letters`.

## Delivered

- Engagement rates use delivered recipients when provider delivery evidence exists, with a safe sent-recipient fallback.
- Open activity is explicitly labeled as an estimate because privacy proxies and image blocking limit its accuracy.
- Results include delivery, open estimate, click, click-to-open, bounce, and unsubscribe rates.
- Authors can compare a selected broadcast with another completed broadcast.
- Results link directly to the existing unified Inbox with the broadcast subject as search context.
- Result actions, comparison controls, mobile layout, keyboard focus, forced-color behavior, and reduced-motion behavior received a final accessibility pass.
- Existing routes, Letter records, broadcast snapshots, consent rules, delivery permissions, recovery controls, and audit behavior remain unchanged.

## Production readiness

No migration is required. Before release, back up the current production revision and database, run focused lint, the full server suite, and the production build, then verify `/admin/letters`, `/admin/inbox`, audience consent, provider configuration, and outgoing-email pause state. Deployment and real email delivery require separate approval.

Rollback is source-only: restore the prior application revision and restart the existing frontend/API processes. No Phase 10 data rollback is needed because this phase does not change the schema or production records.
