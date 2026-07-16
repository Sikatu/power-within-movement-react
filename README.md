# Power Within Movement

The frontend is being rebuilt from the approved elevated design handoff. The current implementation includes the shared visual foundation, Home, Experiences, the four Signature Experience routes, The Vault resource environment, Power Within Professional, the Raising Her Confidence Podcast, Teen Programs, About, Contact, and the secure client portal entry and home dashboard flows.

- `src/pages/Home.jsx` contains the handoff-driven Home page.
- `src/pages/Experiences.jsx` contains the complete service overview, appointment options, and decision guidance.
- `src/pages/SignatureExperiencePage.jsx` powers the Color Analysis, Style & Body Analysis, and Makeup Direction routes from shared handoff content.
- `src/pages/RadianceReclaimed.jsx` contains the full private, application-only Radiance Reclaimed experience.
- `src/pages/Resources.jsx` contains The Vault, the 100 Conversation Starters preview, and the resource guide directory.
- `src/pages/ResourceArticle.jsx` renders the five complete confidence, color, and style guides.
- `src/pages/Professionals.jsx` contains the complete professional development journey and Signature Experience Method.
- `src/pages/Podcast.jsx` contains the listening destinations, Spotify trailer, audience pathways, and conversation themes.
- `src/pages/TeenPrograms.jsx` contains the complete confidence-support journey for teen girls, mothers, mentors, and families.
- `src/pages/About.jsx` contains Kim Mittelstadt's founder story, earned wisdom, and the Collective Team.
- `src/pages/Contact.jsx` contains the guided inquiry form and routes public submissions into the existing admin lead system.
- `src/pages/ClientPortalLogin.jsx` and `src/pages/ClientPortalInvite.jsx` provide secure login and invitation acceptance through the existing backend.
- `src/pages/ClientPortalDashboard.jsx` renders real private notes, resources, sessions, follow-ups, and service history for the signed-in client.
- `src/components/` contains the new shared header and footer.
- `src/styles/` contains the new design tokens and global styles.
- Routes not yet rebuilt display a temporary rebuild notice instead of restoring retired UI.
- `src/lib/nativeApi.js`, `src/lib/errorReporter.js`, and the complete `server/` application remain available for continued frontend integration.

Run `npm run dev` to start the Vite frontend and `npm --prefix server run dev` to start the existing backend.
