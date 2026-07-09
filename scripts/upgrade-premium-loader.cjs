const fs = require('fs')
const path = require('path')

const appPath = path.join(process.cwd(), 'src', 'App.jsx')
const cssPath = path.join(process.cwd(), 'src', 'styles', 'global.css')

let app = fs.readFileSync(appPath, 'utf8')

if (!app.includes("import logoImage from './assets/images/logo.webp'")) {
  app = app.replace(
    "import { lazy, Suspense, useEffect",
    "import logoImage from './assets/images/logo.webp'\nimport { lazy, Suspense, useEffect"
  )
}

const newPageLoading = `function PageLoading() {
  return (
    <div className="page-loading-screen" role="status" aria-live="polite" aria-label="Preparing your experience">
      <div className="page-loading-card">
        <div className="page-loading-logo-shell">
          <img className="page-loading-logo" src={logoImage} alt="Power Within Collective" />
        </div>

        <div className="page-loading-ornament" aria-hidden="true">
          <span></span>
          <strong></strong>
          <span></span>
        </div>

        <p className="page-loading-kicker">Power Within Collective</p>
        <h1>Preparing your experience</h1>
        <p className="page-loading-subtext">A premium space for confidence, color, style, and presence.</p>
      </div>
    </div>
  )
}
`

app = app.replace(/function PageLoading\(\) \{[\s\S]*?\n\}\n/, `${newPageLoading}\n`)

fs.writeFileSync(appPath, app, 'utf8')

let css = fs.readFileSync(cssPath, 'utf8')

const premiumCss = `

/* PREMIUM LOADING SCREEN OVERRIDE */
.initial-brand-loader {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 50% 18%, rgba(200, 169, 106, 0.2), transparent 30rem),
    radial-gradient(circle at 15% 85%, rgba(90, 55, 59, 0.16), transparent 28rem),
    linear-gradient(135deg, #3d252d 0%, #5a373b 46%, #ead3cb 130%);
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition: opacity 360ms ease, visibility 360ms ease;
}

.initial-brand-loader.is-leaving {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.initial-brand-loader .page-loading-screen {
  width: 100%;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: clamp(2rem, 6vw, 5rem) 1.25rem;
  background: transparent;
}

.page-loading-screen {
  min-height: 72vh;
  display: grid;
  place-items: center;
  padding: clamp(4rem, 8vw, 7rem) 1.5rem;
  background:
    radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.9), transparent 34rem),
    linear-gradient(135deg, rgba(251, 245, 238, 0.96), rgba(246, 235, 226, 0.92));
}

.page-loading-card {
  position: relative;
  isolation: isolate;
  width: min(92vw, 520px);
  text-align: center;
  display: grid;
  justify-items: center;
  padding: clamp(2.1rem, 5vw, 3.6rem);
  border: 1px solid rgba(255, 250, 246, 0.34);
  border-radius: clamp(28px, 4vw, 44px);
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 250, 246, 0.2), transparent 18rem),
    linear-gradient(145deg, rgba(255, 250, 246, 0.18), rgba(255, 250, 246, 0.08));
  box-shadow:
    0 34px 90px rgba(28, 14, 19, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  animation: premiumLoaderRise 520ms ease both;
}

.page-loading-card::before {
  content: "";
  position: absolute;
  inset: 14px;
  z-index: -1;
  border: 1px solid rgba(200, 169, 106, 0.28);
  border-radius: inherit;
  pointer-events: none;
}

.page-loading-logo-shell {
  width: clamp(92px, 12vw, 126px);
  height: clamp(92px, 12vw, 126px);
  display: grid;
  place-items: center;
  margin-bottom: 1.45rem;
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(255, 250, 246, 0.98), rgba(255, 250, 246, 0.82));
  border: 1px solid rgba(200, 169, 106, 0.44);
  box-shadow:
    0 18px 44px rgba(28, 14, 19, 0.22),
    0 0 0 10px rgba(255, 250, 246, 0.06);
}

.page-loading-logo {
  width: 72%;
  height: 72%;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 8px 14px rgba(90, 55, 59, 0.22));
  animation: premiumLoaderPulse 1800ms ease-in-out infinite;
}

.page-loading-ornament {
  display: grid;
  grid-template-columns: 52px 7px 52px;
  align-items: center;
  gap: 12px;
  margin-bottom: 1.1rem;
}

.page-loading-ornament span {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(200, 169, 106, 0.9), transparent);
}

.page-loading-ornament strong {
  width: 7px;
  height: 7px;
  display: block;
  transform: rotate(45deg);
  background: #c8a96a;
  box-shadow: 0 0 18px rgba(200, 169, 106, 0.58);
}

.page-loading-kicker {
  color: #c8a96a;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  margin: 0 0 0.75rem;
  font-size: 0.72rem;
  font-weight: 800;
}

.page-loading-card h1 {
  color: #fffaf6;
  margin: 0;
  max-width: 430px;
  font-family: "Cormorant Garamond", Georgia, serif;
  font-size: clamp(2.5rem, 5vw, 4.35rem);
  font-weight: 500;
  letter-spacing: -0.045em;
  line-height: 0.95;
  text-shadow: 0 16px 34px rgba(28, 14, 19, 0.24);
}

.page-loading-subtext {
  max-width: 360px;
  color: rgba(255, 250, 246, 0.78);
  margin: 1rem 0 0;
  font-size: 0.96rem;
  line-height: 1.65;
}

@keyframes premiumLoaderRise {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.985);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes premiumLoaderPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.96;
  }

  50% {
    transform: scale(1.035);
    opacity: 1;
  }
}

@media (max-width: 700px) {
  .page-loading-card {
    width: min(92vw, 420px);
    padding: 2rem 1.4rem;
  }

  .page-loading-card h1 {
    font-size: clamp(2.25rem, 12vw, 3.15rem);
  }

  .page-loading-subtext {
    font-size: 0.9rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .initial-brand-loader,
  .page-loading-card,
  .page-loading-logo {
    transition: none !important;
    animation: none !important;
  }
}
`

if (css.includes('/* PREMIUM LOADING SCREEN OVERRIDE */')) {
  css = css.replace(/\/\* PREMIUM LOADING SCREEN OVERRIDE \*\/[\s\S]*$/, premiumCss.trimStart())
} else {
  css += premiumCss
}

fs.writeFileSync(cssPath, css, 'utf8')

console.log('Premium loading screen upgraded.')