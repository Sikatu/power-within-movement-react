import { useEffect } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import SiteFooter from './components/SiteFooter.jsx'
import SiteHeader from './components/SiteHeader.jsx'
import { signatureExperiences } from './data/signatureExperiences.js'
import About from './pages/About.jsx'
import Contact from './pages/Contact.jsx'
import ClientPortalInvite from './pages/ClientPortalInvite.jsx'
import ClientPortalLogin from './pages/ClientPortalLogin.jsx'
import ClientPortalDashboard from './pages/ClientPortalDashboard.jsx'
import ClientPortalMessages from './pages/ClientPortalMessages.jsx'
import ClientPortalSessions from './pages/ClientPortalSessions.jsx'
import Experiences from './pages/Experiences.jsx'
import Home from './pages/Home.jsx'
import Podcast from './pages/Podcast.jsx'
import Professionals from './pages/Professionals.jsx'
import RadianceReclaimed from './pages/RadianceReclaimed.jsx'
import ResourceArticle from './pages/ResourceArticle.jsx'
import Resources from './pages/Resources.jsx'
import SignatureExperiencePage from './pages/SignatureExperiencePage.jsx'
import TeenPrograms from './pages/TeenPrograms.jsx'

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
  '/resources': {
    title: 'Confidence, Style & Self-Reflection Resources | Power Within Collective',
    description: 'Curated confidence, personal presence, style, wellness, self-reflection, and self-leadership resources for women returning to themselves.',
  },
  '/resources/what-is-color-analysis': {
    title: 'What Is Color Analysis? | Power Within Collective',
    description: 'Learn what color analysis is and how it supports clothing, makeup, accessories, hair direction, personal presence, and confidence.',
  },
  '/resources/what-is-personal-style-analysis': {
    title: 'What Is Personal Style Analysis? | Power Within Collective',
    description: 'Learn how personal style analysis supports wardrobe clarity, body shape, proportion, outfit direction, and confidence for women.',
  },
  '/resources/fashion-advice-for-women-over-40': {
    title: 'Fashion Advice for Women Over 40 | Power Within Collective',
    description: 'Fashion advice for women over 40 focused on identity, body confidence, wardrobe clarity, color, proportion, and personal presence.',
  },
  '/resources/rebuild-confidence-through-personal-style': {
    title: 'How to Rebuild Confidence Through Personal Style | Power Within Collective',
    description: 'Learn how personal style, color, wardrobe direction, and image alignment can help women rebuild confidence and self-trust.',
  },
  '/resources/confidence-coaching-for-women': {
    title: 'Confidence Coaching for Women | Power Within Collective',
    description: 'Confidence coaching for women in a new season of life, with support for identity, presence, image alignment, self-trust, and transformation.',
  },
  '/professionals': {
    title: 'Image Consultant & Beauty Professional Training | Power Within Professional',
    description: 'Professional education for beauty, image, style, and wellness professionals who want to turn their expertise into a premium transformation-centered client experience.',
  },
  '/power-within-professional': {
    title: 'Image Consultant & Beauty Professional Training | Power Within Professional',
    description: 'Professional education for beauty, image, style, and wellness professionals who want to turn their expertise into a premium transformation-centered client experience.',
  },
  '/podcast': {
    title: 'Raising Her Confidence Podcast | Teen Confidence & Mother-Daughter Conversations',
    description: 'A podcast for mothers, mentors, and adults supporting girls through confidence, identity, emotional wellness, self-expression, and presence.',
  },
  '/teen-programs': {
    title: 'Teen Confidence Programs for Girls | Power Within Collective',
    description: 'Supportive teen confidence programs for girls and young women building identity, emotional awareness, self-expression, and grounded self-trust.',
  },
  '/teens': {
    title: 'Teen Confidence Programs for Girls | Power Within Collective',
    description: 'Supportive teen confidence programs for girls and young women building identity, emotional awareness, self-expression, and grounded self-trust.',
  },
  '/about': {
    title: 'About Kim Mittelstadt | Power Within Collective',
    description: 'Learn about Kim Mittelstadt, founder of Power Within Collective, and the whole-person foundation behind her confidence, style, beauty, and transformation work.',
  },
  '/contact': {
    title: 'Contact Power Within Collective | Private Consultations & Speaking',
    description: 'Contact Power Within Collective about private consultations, color analysis, personal style guidance, Radiance Reclaimed, professional education, speaking, podcast, or collaboration.',
  },
  '/client-portal/login': {
    title: 'Client Portal Login | Power Within Collective',
    description: 'Secure client portal access for Power Within Collective clients.',
  },
  '/client-portal/invite': {
    title: 'Set Up Your Client Portal | Power Within Collective',
    description: 'Accept your private Power Within Collective client portal invitation and create secure access.',
  },
  '/client-portal/home': {
    title: 'My Client Portal | Power Within Collective',
    description: 'Private client notes, resources, reminders, session history, and care records from Power Within Collective.',
  },
  '/client-portal/sessions': {
    title: 'My Sessions | Power Within Collective',
    description: 'Book and manage private Power Within Collective client sessions.',
  },
  '/client-portal/messages': {
    title: 'Private Messages | Power Within Collective',
    description: 'Secure private client communication with the Power Within Collective team.',
  },
}

function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const metadata = routeMetadata[pathname]
      || (pathname.startsWith('/client-portal/invite/') ? routeMetadata['/client-portal/invite'] : null)
      || (pathname.startsWith('/client-portal/messages/') ? routeMetadata['/client-portal/messages'] : null)
      || {
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
      <p>This route is queued for an upcoming focused slice. The completed public experiences remain available through the main navigation.</p>
      <Link className="button button-primary" to="/">Return Home</Link>
    </main>
  )
}

function ContactRoute() {
  const { search } = useLocation()
  return <Contact key={search || 'general-contact'} />
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
        <Route path="/resources" element={<Resources />} />
        <Route path="/resources/:slug" element={<ResourceArticle />} />
        <Route path="/professionals" element={<Professionals />} />
        <Route path="/power-within-professional" element={<Professionals />} />
        <Route path="/podcast" element={<Podcast />} />
        <Route path="/teen-programs" element={<TeenPrograms />} />
        <Route path="/teens" element={<TeenPrograms />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<ContactRoute />} />
        <Route path="/client-portal" element={<Navigate to="/client-portal/login" replace />} />
        <Route path="/client-portal/login" element={<ClientPortalLogin />} />
        <Route path="/client-portal/invite/:token" element={<ClientPortalInvite />} />
        <Route path="/client-portal/dashboard" element={<Navigate to="/client-portal/home" replace />} />
        <Route path="/client-portal/home" element={<ClientPortalDashboard />} />
        <Route path="/client-portal/sessions" element={<ClientPortalSessions />} />
        <Route path="/client-portal/messages" element={<ClientPortalMessages />} />
        <Route path="/client-portal/messages/:conversationId" element={<ClientPortalMessages />} />
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
