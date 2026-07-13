# Power Within Movement

The frontend is being rebuilt from the approved elevated design handoff. The current implementation includes the shared visual foundation, Home, Experiences, the four Signature Experience routes, and The Vault resource environment.

- `src/pages/Home.jsx` contains the handoff-driven Home page.
- `src/pages/Experiences.jsx` contains the complete service overview, appointment options, and decision guidance.
- `src/pages/SignatureExperiencePage.jsx` powers the Color Analysis, Style & Body Analysis, and Makeup Direction routes from shared handoff content.
- `src/pages/RadianceReclaimed.jsx` contains the full private, application-only Radiance Reclaimed experience.
- `src/pages/Resources.jsx` contains The Vault, the 100 Conversation Starters preview, and the resource guide directory.
- `src/pages/ResourceArticle.jsx` renders the five complete confidence, color, and style guides.
- `src/components/` contains the new shared header and footer.
- `src/styles/` contains the new design tokens and global styles.
- Routes not yet rebuilt display a temporary rebuild notice instead of restoring retired UI.
- `src/lib/nativeApi.js`, `src/lib/errorReporter.js`, and the complete `server/` application remain available for continued frontend integration.

Run `npm run dev` to start the Vite frontend and `npm --prefix server run dev` to start the existing backend.
