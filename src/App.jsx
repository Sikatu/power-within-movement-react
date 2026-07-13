import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import SiteFooter from './components/SiteFooter.jsx'
import SiteHeader from './components/SiteHeader.jsx'
import Home from './pages/Home.jsx'

function ScrollManager() {
  const { hash, pathname } = useLocation()

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1))
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }

    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [hash, pathname])

  return null
}

function BuildNotice() {
  return (
    <main className="build-notice">
      <p className="eyebrow">New experience in progress</p>
      <h1>This page is the next part of the rebuild.</h1>
      <p>The new Home experience is live. The remaining handoff pages will be added in the next focused slices.</p>
      <Link className="button button-primary" to="/">Return Home</Link>
    </main>
  )
}

function AppShell() {
  return (
    <>
      <ScrollManager />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <SiteHeader />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<BuildNotice />} />
      </Routes>
      <SiteFooter />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

export default App
