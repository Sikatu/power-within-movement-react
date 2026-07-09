const fs = require('fs')
const path = require('path')

const appPath = path.join(process.cwd(), 'src', 'App.jsx')
const cssPath = path.join(process.cwd(), 'src', 'styles', 'global.css')

let app = fs.readFileSync(appPath, 'utf8')

// Make sure useState/useEffect exist in React import
app = app.replace(/import\s+\{([^}]+)\}\s+from\s+'react'/, (match, imports) => {
  const parts = imports.split(',').map((part) => part.trim()).filter(Boolean)
  for (const hook of ['useEffect', 'useState']) {
    if (!parts.includes(hook)) parts.push(hook)
  }
  return `import { ${parts.join(', ')} } from 'react'`
})

if (!app.includes('function BackToTopButton()')) {
  const component = `
function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 520)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  return (
    <button
      className={\`back-to-top-button\${isVisible ? ' is-visible' : ''}\`}
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
    >
      <span aria-hidden="true">↑</span>
      <strong>Top</strong>
    </button>
  )
}

`

  app = app.replace(/function App\(\) \{/, `${component}function App() {`)
}

if (!app.includes('<BackToTopButton />')) {
  app = app.replace('<InitialBrandLoader />', '<InitialBrandLoader />\n      <BackToTopButton />')
}

fs.writeFileSync(appPath, app, 'utf8')

let css = fs.readFileSync(cssPath, 'utf8')

const cssBlock = `

/* BACK TO TOP BUTTON */
.back-to-top-button {
  position: fixed;
  right: clamp(1rem, 2.4vw, 1.75rem);
  bottom: clamp(1rem, 2.4vw, 1.75rem);
  z-index: 9000;
  width: 62px;
  height: 62px;
  display: grid;
  place-items: center;
  gap: 0;
  border: 1px solid rgba(200, 169, 106, 0.46);
  border-radius: 999px;
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 250, 246, 0.96), rgba(255, 250, 246, 0.82)),
    linear-gradient(145deg, rgba(255, 250, 246, 0.96), rgba(247, 239, 231, 0.92));
  color: #4a2831;
  box-shadow:
    0 20px 50px rgba(63, 42, 49, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.75);
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(14px) scale(0.96);
  transition:
    opacity 220ms ease,
    visibility 220ms ease,
    transform 220ms ease,
    box-shadow 220ms ease,
    border-color 220ms ease;
}

.back-to-top-button.is-visible {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateY(0) scale(1);
}

.back-to-top-button span {
  color: #c8a96a;
  font-size: 1.25rem;
  line-height: 1;
  margin-top: 0.15rem;
}

.back-to-top-button strong {
  color: #4a2831;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.56rem;
  font-weight: 900;
  line-height: 1;
  margin-top: -0.12rem;
}

.back-to-top-button:hover {
  border-color: rgba(200, 169, 106, 0.78);
  box-shadow:
    0 24px 62px rgba(63, 42, 49, 0.24),
    0 0 0 6px rgba(200, 169, 106, 0.1);
  transform: translateY(-3px) scale(1.02);
}

.back-to-top-button:active {
  transform: translateY(0) scale(0.98);
}

@media (max-width: 700px) {
  .back-to-top-button {
    width: 54px;
    height: 54px;
    right: 1rem;
    bottom: 1rem;
  }

  .back-to-top-button span {
    font-size: 1.1rem;
  }

  .back-to-top-button strong {
    font-size: 0.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .back-to-top-button {
    transition: none !important;
  }
}
`

if (!css.includes('/* BACK TO TOP BUTTON */')) {
  css += cssBlock
}

fs.writeFileSync(cssPath, css, 'utf8')

console.log('Back to top button added.')