# Power Within Movement

The frontend is being rebuilt from the approved elevated design handoff. The first implementation slice includes the shared visual foundation and complete responsive Home experience.

- `src/pages/Home.jsx` contains the handoff-driven Home page.
- `src/components/` contains the new shared header and footer.
- `src/styles/` contains the new design tokens and global styles.
- Routes not yet rebuilt display a temporary rebuild notice instead of restoring retired UI.
- `src/lib/nativeApi.js`, `src/lib/errorReporter.js`, and the complete `server/` application remain available for continued frontend integration.

Run `npm run dev` to start the Vite frontend and `npm --prefix server run dev` to start the existing backend.
