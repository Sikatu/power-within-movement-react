# Phase 49 — Developer Incident Triage

Phase 49 turns the reliable Developer Error Center into a smaller, decision-ready incident workspace. It keeps capture, monitoring, history, and technical evidence intact while reducing the effort required to decide what should happen next.

## What changed

- The default view is now **Needs attention**, excluding safe test events and closed history.
- Meaningful queues replace the raw status-first workflow: Needs attention, Urgent, Recurring, Safe tests, History, and All records.
- High and critical active incidents are counted together as urgent.
- Active incidents seen more than once are surfaced as recurring.
- Every incident receives a plain-language recommended next step and one primary status action.
- Active safe tests can be moved out of the attention queue together. Their records remain in history and the action is audited.
- Existing search, severity, source, redacted copy, technical details, status controls, and deletion remain available.

## Safety and compatibility

- All Error Center routes remain developer-only.
- Phase 49 does not change the database schema or delete incident history.
- The bulk safe-test action marks only records whose protected metadata explicitly identifies them as safe tests.
- No new admin CSS was added; the established compact Developer Operations system is reused.

## Verification

Run:

```powershell
npm.cmd run admin:qa:phase49
npm.cmd run admin:qa:phase30
npm.cmd test
```

Then open **Developer Operations → Error Center** and confirm the Needs attention queue loads first, queue counts are clear, and a selected incident shows one recommended next step.
