# Letters & Broadcasts — Phase 4 Frontend Shell

## Scope

Phase 4 refactors the existing `/admin/letters` frontend without changing its
route, API contracts, database model, permissions, delivery behavior, or Studio
navigation.

## Component boundaries

The page controller remains responsible for server calls, autosave sequencing,
undo and redo history, recipient preparation, confirmation, and workflow state.
The render shell is now divided into:

- `LettersWorkspace`
- `LettersLibrary`
- `TemplateLibrary`
- `LetterEditor`
- `BlockLibrary`
- the existing `LetterCanvas`
- `LetterPropertiesPanel`
- `BroadcastWizard`
- `DeliveryQueue`
- `BroadcastAnalytics`

The extracted components live in
`src/components/admin/letters/LettersWorkspace.jsx`. The route controller
remains in `src/pages/admin/AdminLetters.jsx`.

## Compatibility guarantees

- `/admin/letters` is unchanged.
- Existing class names are preserved, so the current visual design remains
  compatible with `AdminFreshUI.css`.
- Existing native API functions and payload shapes are unchanged.
- Autosave, revisions, templates, audience selection, tests, scheduling,
  immediate sending, cancellation, CSV export, and analytics retain their
  existing handlers.
- The Phase 3 rule remains intact: only archived letters are read-only.
- The developer-only `Process due now` control remains developer-gated.

## Validation

- Complete server suite: 96 tests passed.
- Production Vite build passed.
- No schema migration was added.
- No email was sent.
- No deployment or remote push was performed.

## Next phase

Phase 5 may now improve editor behavior behind these boundaries, including
production-render preview, direct text editing, keyboard block movement, insert
controls, accessible preview modes, and sanitized paste handling.
