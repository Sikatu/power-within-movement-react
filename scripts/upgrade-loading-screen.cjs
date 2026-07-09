const fs = require('fs')
const path = require('path')

const appPath = path.join(process.cwd(), 'src', 'App.jsx')
const cssPath = path.join(process.cwd(), 'src', 'styles', 'global.css')

let app = fs.readFileSync(appPath, 'utf8')

if (!app.includes("import logoImage from './assets/images/logo.webp'")) {
  app = app.replace(
    "import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'",
    "import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'\nimport logoImage from './assets/images/logo.webp'"
  )
}

const newPageLoading = `function PageLoading() {
  return (
    <div className="page-loading-screen" role="status" aria-live="polite" aria-label="Preparing your experience">
      <div className="page-loading-card">
        <img className="page-loading-logo" src={logoImage} alt="Power Within Collective" />
        <div className="page-loading-line" aria-hidden="true"></div>
        <p className="eyebrow">Power Within Collective</p>
        <p className="page-loading-text">Preparing your experience...</p>
      </div>
    </div>
  )
}`

app = app.replace(
  /function PageLoading\(\) \{[\s\S]*?\n\}\n\nfunction /,
  `${newPageLoading}\n\nfunction `
)

fs.writeFileSync(appPath, app, 'utf8')

let css = fs.readFileSync(cssPath, 'utf8')

if (!css.includes('PAGE LOADING SCREEN - branded route transition')) {
  css += `

/* PAGE LOADING SCREEN - branded route transition */
.page-loading-screen {
  min-height: 72vh;
  display: grid;
  place-items: center;
  padding: clamp(4rem, 8vw, 7rem) 1.5rem;
  background:
    radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.92), transparent 34rem),
    linear-gradient(135deg, rgba(251, 245, 238, 0.96), rgba(246, 235, 226, 0.92));
}

.page-loading-card {
  display: grid;
  justify-items: center;
  gap: 0.8rem;
  max-width: 24rem;
  text-align: center;
  animation: pageLoadingFade 520ms ease both;
}

.page-loading-logo {
  width: clamp(5rem, 13vw, 7.5rem);
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 1rem 2rem rgba(68, 39, 31, 0.12));
  animation: pageLoadingPulse 1.8s ease-in-out infinite;
}

.page-loading-line {
  width: 4.5rem;
  height: 1px;
  margin-top: 0.35rem;
  background: linear-gradient(90deg, transparent, rgba(112, 74, 57, 0.45), transparent);
}

.page-loading-screen .eyebrow {
  margin: 0.2rem 0 0;
  letter-spacing: 0.18em;
}

.page-loading-text {
  margin: 0;
  color: rgba(66, 46, 39, 0.72);
  font-size: 0.96rem;
}

@keyframes pageLoadingFade {
  from {
    opacity: 0;
    transform: translateY(0.6rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pageLoadingPulse {
  0%, 100% {
    opacity: 0.78;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.025);
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-loading-card,
  .page-loading-logo {
    animation: none;
  }
}
`
}

fs.writeFileSync(cssPath, css, 'utf8')

console.log('Upgraded branded loading screen.')