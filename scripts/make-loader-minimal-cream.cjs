const fs = require('fs')
const path = require('path')

const appPath = path.join(process.cwd(), 'src', 'App.jsx')
const cssPath = path.join(process.cwd(), 'src', 'styles', 'global.css')

let app = fs.readFileSync(appPath, 'utf8')

const simplePageLoading = `function PageLoading() {
  return (
    <div className="page-loading-screen" role="status" aria-live="polite" aria-label="Preparing your experience">
      <div className="page-loading-minimal">
        <img className="page-loading-logo" src={logoImage} alt="Power Within Collective" />
        <p className="page-loading-kicker">Power Within Collective</p>
        <h1>Preparing your experience</h1>
      </div>
    </div>
  )
}
`

app = app.replace(/function PageLoading\(\) \{[\s\S]*?\n\}\n/, `${simplePageLoading}\n`)

fs.writeFileSync(appPath, app, 'utf8')

let css = fs.readFileSync(cssPath, 'utf8')

const minimalCss = `

/* MINIMAL CREAM LOADING SCREEN OVERRIDE */
.initial-brand-loader {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.92), transparent 28rem),
    linear-gradient(180deg, #fffaf6 0%, #f7efe7 100%) !important;
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition: opacity 420ms ease, visibility 420ms ease;
}

.initial-brand-loader.is-leaving {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.initial-brand-loader .page-loading-screen,
.page-loading-screen {
  width: 100%;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: clamp(2rem, 6vw, 5rem) 1.25rem;
  background: transparent !important;
}

.page-loading-minimal {
  text-align: center;
  display: grid;
  justify-items: center;
  gap: 0.85rem;
  animation: minimalLoaderFade 560ms ease both;
}

.page-loading-logo {
  width: clamp(82px, 9vw, 112px);
  height: clamp(82px, 9vw, 112px);
  object-fit: contain;
  display: block;
  margin: 0 auto 0.35rem;
  filter: drop-shadow(0 14px 24px rgba(90, 55, 59, 0.12));
  animation: minimalLogoBreathe 1800ms ease-in-out infinite;
}

.page-loading-kicker {
  color: #c8a96a;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  margin: 0;
  font-size: 0.75rem;
  font-weight: 800;
}

.page-loading-minimal h1 {
  color: #3f2a31;
  margin: 0;
  font-family: "Cormorant Garamond", Georgia, serif;
  font-size: clamp(2.65rem, 5.2vw, 4.9rem);
  font-weight: 500;
  letter-spacing: -0.045em;
  line-height: 0.95;
}

.page-loading-card,
.page-loading-logo-shell,
.page-loading-ornament,
.page-loading-subtext {
  display: none !important;
}

@keyframes minimalLoaderFade {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes minimalLogoBreathe {
  0%, 100% {
    transform: scale(1);
    opacity: 0.98;
  }

  50% {
    transform: scale(1.025);
    opacity: 1;
  }
}

@media (max-width: 700px) {
  .page-loading-minimal {
    gap: 0.75rem;
  }

  .page-loading-minimal h1 {
    font-size: clamp(2.25rem, 10vw, 3.35rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .initial-brand-loader,
  .page-loading-minimal,
  .page-loading-logo {
    transition: none !important;
    animation: none !important;
  }
}
`

if (!css.includes('MINIMAL CREAM LOADING SCREEN OVERRIDE')) {
  css += minimalCss
} else {
  css = css.replace(/\/\* MINIMAL CREAM LOADING SCREEN OVERRIDE \*\/[\s\S]*$/, minimalCss.trimStart())
}

fs.writeFileSync(cssPath, css, 'utf8')

console.log('Minimal cream loading screen applied.')