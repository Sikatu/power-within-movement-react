import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import SiteFooter from './components/SiteFooter.jsx'
import SiteHeader from './components/SiteHeader.jsx'
import { signatureExperiences } from './data/signatureExperiences.js'
import Experiences from './pages/Experiences.jsx'
import Home from './pages/Home.jsx'
import RadianceReclaimed from './pages/RadianceReclaimed.jsx'
import SignatureExperiencePage from './pages/SignatureExperiencePage.jsx'

const routeMetadata = {
  '/': {
    title: 'Power Within Collective | Confidence, Style & Personal Presence',
    description: 'Power Within Collective helps women in a new season align confidence, color, style, and personal presence with who they are now.',
  },
  '/experiences': {
    title: 'Confidence, Style & Image Experiences | Power Within Collective',
    description: 'Explore private confidence coaching, personal style guidance, color analysis, beauty direction, Radiance Reclaimed, and whole-person transformation experiences.',
  },
  '/color-analysis': {
    title: 'Color Analysis Consultation for Women | Power Within Collective',
    description: 'A refined color analysis consultation for women seeking clearer clothing, makeup, accessories, hair direction, and a more confident personal presence.',
  },
  '/style-analysis': {
    title: 'Personal Style Analysis & Wardrobe Guidance | Power Within Collective',
    description: 'Personal style analysis and wardrobe guidance for women seeking body shape clarity, proportion, outfit direction, and style confidence.',
  },
  '/blend-cosmetics': {
    title: 'Makeup & Beauty Direction Consultation | Power Within Collective',
    description: 'A personalized makeup and beauty direction consultation designed around undertones, product choices, application, natural confidence, and everyday polish.',
  },
  '/radiance-reclaimed': {
    title: 'Women’s Confidence & Presence Coaching | Radiance Reclaimed',
    description: 'A private confidence and presence coaching experience for women ready for whole-person transformation, self-trust, image alignment, and renewed identity.',
  },
}

function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const metadata = routeMetadata[pathname] || {
      title: 'Power Within Collective',
      description: 'A thoughtful whole-person experience for confidence, style, personal presence, and self-recognition.',
    }

    document.title = metadata.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', metadata.description)
    document.body.dataset.pwcRoute = pathname
  }, [pathname])

  return null
}

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
    <main id="main-content" className="build-notice">
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
      <RouteMetadata />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <SiteHeader />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/experiences" element={<Experiences />} />
        <Route path="/color-analysis" element={<SignatureExperiencePage experience={signatureExperiences.color} activePath="/color-analysis" />} />
        <Route path="/style-analysis" element={<SignatureExperiencePage experience={signatureExperiences.style} activePath="/style-analysis" />} />
        <Route path="/blend-cosmetics" element={<SignatureExperiencePage experience={signatureExperiences.makeup} activePath="/blend-cosmetics" />} />
        <Route path="/radiance-reclaimed" element={<RadianceReclaimed />} />
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
