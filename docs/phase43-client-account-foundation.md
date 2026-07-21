# Phase 43 — Client Account foundation

Phase 43 turns existing profile, onboarding, and password APIs into one simple client Account workspace.

## Outcomes

- Adds a clear Account destination to every authenticated client portal page.
- Separates Profile, Onboarding, and Security so clients complete one task at a time.
- Lets clients update their name, phone, and emergency contact details.
- Renders the Studio’s active onboarding template dynamically, including text, date, choice, multiple-choice, and consent fields.
- Supports saving onboarding for later and final submission with required-field validation.
- Shows submitted onboarding responses without reopening a completed intake for editing.
- Gives password requirements immediate, plain-language feedback before submission.
- Keeps the layout calm and responsive on desktop and mobile.

## Preserved privacy and functionality

- Cookie-authenticated profile, onboarding, password, and sign-out requests.
- Existing profile validation, dynamic onboarding templates, required-answer enforcement, drafts, submission, and consent timestamps.
- Current-password verification, dedicated rate limiting, 12-character password policy, bcrypt hashing, secure cookie renewal, and session-version rotation.
- Private audit events for profile changes, onboarding drafts, onboarding submission, and password changes.
- Existing routes, API contracts, database records, public website, admin workspaces, and footer.

## Verification

```powershell
npm.cmd run portal:qa:phase43
npm.cmd run admin:qa:phase30
npm.cmd test
```
