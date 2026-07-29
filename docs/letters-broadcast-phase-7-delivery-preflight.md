# Letters & Broadcasts — Phase 7 delivery preflight

Phase 7 adds one authoritative final-readiness contract before scheduling or immediate delivery.

The preflight checks the immutable broadcast snapshot, production letter validation, current consent-aware audience count, audience snapshot freshness, delivery-provider configuration, and the global outgoing-email safety switch. Blocking issues prevent progression while non-blocking accessibility and content warnings remain visible to the author.

Scheduling now also honors the global outgoing-email pause. Immediate delivery already performs its own server-side consent, suppression, provider, and platform checks; the new preflight gives authors the same information before confirmation.

No database migration is required. Existing version 1 Letters and previously prepared broadcasts remain compatible.
