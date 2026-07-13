# Power Within Movement

The frontend is intentionally at a clean-slate checkpoint.

- `src/App.jsx` renders no interface.
- The previous pages, components, styles, visual assets, public site files, and UI helper scripts have been removed.
- `src/lib/nativeApi.js`, `src/lib/errorReporter.js`, and the complete `server/` application remain available for the new frontend integration.

Run `npm run dev` to start the blank Vite frontend and `npm --prefix server run dev` to start the existing backend.
