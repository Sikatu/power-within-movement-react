# Letters & Broadcasts — Phase 5 Editor Foundation

## Scope completed

- Production HTML preview for desktop and mobile, rendered by the delivery renderer.
- Plain-text preview from the same production render response.
- Responsive mobile stacking for two-column email blocks.
- Direct editing for heading, text, and greeting content.
- Plain-text-only paste handling in direct-edit fields.
- Keyboard block movement with `Alt+ArrowUp` and `Alt+ArrowDown`.
- Selected-block toolbar for movement, duplication, and deletion.
- Insert controls between blocks.
- Expanded global settings for content width and muted color.
- Accessible preview labels, focus behavior, and iframe sandboxing.

## Compatibility and safety

- Existing version 1 letter documents remain compatible.
- No schema migration is required.
- Preview rendering does not save, send, schedule, or mutate a Letter.
- Existing autosave, version history, broadcast snapshots, and delivery flows remain unchanged.
- The preview iframe uses a sandbox and receives server-escaped production HTML.

## Validation

- Letter-builder regression suite includes responsive production-render coverage.
- Frontend lint covers all Phase 5 components.
- Full server test and production build must pass before application.
