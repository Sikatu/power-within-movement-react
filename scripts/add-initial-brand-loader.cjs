const fs = require('fs')
const path = require('path')

const appPath = path.join(process.cwd(), 'src', 'App.jsx')
const cssPath = path.join(process.cwd(), 'src', 'styles', 'global.css')

let app = fs.readFileSync(appPath, 'utf8')

if (app.includes("import { lazy, Suspense, useEffect } from 'react'")) {
  app = app.replace(
    "import { lazy, Suspense, useEffect } from 'react'",
    "import { lazy, Suspense, useEffect, useState } from 'react'"
  )
}

if (!app.includes('function InitialBrandLoader()')) {
  const loaderComponent = `
function InitialBrandLoader() {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.sessionStorage.getItem('pwcInitialLoaderSeen') !== 'true'
  })

  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    if (!isVisible) return undefined

    const leaveTimer = window.setTimeout(() => {
      setIsLeaving(true)
      window.sessionStorage.setItem('pwcInitialLoaderSeen', 'true')
    }, 750)

    const removeTimer = window.setTimeout(() => {
      setIsVisible(false)
    }, 1050)

    return () => {
      window.clearTimeout(leaveTimer)
      window.clearTimeout(removeTimer)
    }
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div className={\`initial-brand-loader\${isLeaving ? ' is-leaving' : ''}\`}>
      <PageLoading />
    </div>
  )
}

`

  app = app.replace(/function PageLoading\(\) \{[\s\S]*?\n\}\n/, (match) => `${match}${loaderComponent}`)
}

if (!app.includes('<InitialBrandLoader />')) {
  app = app.replace('<BrowserRouter>', '<BrowserRouter>\n      <InitialBrandLoader />')
}

fs.writeFileSync(appPath, app, 'utf8')

let css = fs.readFileSync(cssPath, 'utf8')

if (!css.includes('INITIAL BRAND LOADER - first session visit')) {
  css += `

/* INITIAL BRAND LOADER - first session visit */
.initial-brand-loader {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.95), transparent 34rem),
    linear-gradient(135deg, rgba(251, 245, 238, 0.98), rgba(246, 235, 226, 0.96));
  opacity: 1;
  transition: opacity 300ms ease, visibility 300ms ease;
}

.initial-brand-loader.is-leaving {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.initial-brand-loader .page-loading-screen {
  width: 100%;
  min-height: 100vh;
  background: transparent;
}

.initial-brand-loader .page-loading-card {
  transform: translateY(-0.5rem);
}

@media (prefers-reduced-motion: reduce) {
  .initial-brand-loader {
    transition: none;
  }
}
`
}

fs.writeFileSync(cssPath, css, 'utf8')

console.log('Added first-load branded loader.')