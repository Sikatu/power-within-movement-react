import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import SiteFooter from './components/SiteFooter.jsx'
import SiteHeader from './components/SiteHeader.jsx'
import Home from './pages/Home.jsx'
import NotFound from './pages/NotFound.jsx'

// Keep the home route instant, while loading secondary public and authenticated
// portal experiences only when someone visits them. The shared Suspense boundary
// already provides a branded, accessible loading state during route transitions.
const About = lazy(() => import('./pages/About.jsx'))
const FAQ = lazy(() => import('./pages/FAQ.jsx'))
const Contact = lazy(() => import('./pages/Contact.jsx'))
const Experiences = lazy(() => import('./pages/Experiences.jsx'))
const Podcast = lazy(() => import('./pages/Podcast.jsx'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'))
const Professionals = lazy(() => import('./pages/Professionals.jsx'))
const RadianceReclaimed = lazy(() => import('./pages/RadianceReclaimed.jsx'))
const ResourceArticle = lazy(() => import('./pages/ResourceArticle.jsx'))
const Resources = lazy(() => import('./pages/Resources.jsx'))
const SignatureExperiencePage = lazy(() => import('./pages/SignatureExperiencePage.jsx'))
const TeenPrograms = lazy(() => import('./pages/TeenPrograms.jsx'))
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions.jsx'))

const siteOrigin = 'https://www.powerwithinmovement.com'
const siteName = 'Power Within Collective'
const themeColor = '#fbf8f3'

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
    canonicalPath: '/professionals',
  },
  '/podcast': {
    title: 'Raising Her Confidence Podcast | Confidence, Wellness & Personal Presence',
    description: 'Raising Her Confidence explores confidence, wellness, identity, motherhood, color, style, beauty, and personal presence for women navigating new seasons of life.',
  },
  '/teen-programs': {
    title: 'Teen Confidence Programs for Girls | Power Within Collective',
    description: 'Supportive teen confidence programs for girls and young women building identity, emotional awareness, self-expression, and grounded self-trust.',
  },
  '/teens': {
    title: 'Teen Confidence Programs for Girls | Power Within Collective',
    description: 'Supportive teen confidence programs for girls and young women building identity, emotional awareness, self-expression, and grounded self-trust.',
    canonicalPath: '/teen-programs',
  },
  '/about': {
    title: 'About Kim Mittelstadt | Power Within Collective',
    description: 'Learn about Kim Mittelstadt, founder of Power Within Collective, and the whole-person foundation behind her confidence, style, beauty, and transformation work.',
  },
  '/faq': {
    title: 'Frequently Asked Questions | Power Within Collective',
    description: 'Answers to common questions about Power Within Collective experiences, confidence and personal presence work, professional education, and getting started.',
  },
  '/contact': {
    title: 'Contact Power Within Collective | Private Consultations & Speaking',
    description: 'Contact Power Within Collective about private consultations, color analysis, personal style guidance, Radiance Reclaimed, professional education, speaking, podcast, or collaboration.',
  },
  '/privacy-policy': {
    title: 'Privacy Policy | Power Within Collective',
    description: 'Read how Power Within Collective collects, uses, protects, and responds to requests about personal information.',
  },
  '/terms-and-conditions': {
    title: 'Terms & Conditions | Power Within Collective',
    description: 'Review the terms governing use of the Power Within Collective website, content, resources, and brand materials.',
  },
}

function resolveRouteMetadata(pathname) {
  const metadata = routeMetadata[pathname]

  if (metadata) {
    return {
      ...metadata,
      canonicalPath: metadata.canonicalPath || pathname,
      robots: 'index,follow',
    }
  }

  return {
    title: 'Page Not Found | Power Within Collective',
    description: 'The page you requested could not be found. Explore Power Within Collective experiences, resources, programs, and ways to connect.',
    canonicalPath: null,
    robots: 'noindex,follow',
  }
}

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector)

  if (!element) {
    element = document.createElement('meta')
    document.head.append(element)
  }

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value)
  })

  return element
}

function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const metadata = resolveRouteMetadata(pathname)
    const canonicalUrl = metadata.canonicalPath
      ? `${siteOrigin}${metadata.canonicalPath}`
      : null

    document.title = metadata.title

    upsertMeta('meta[name="description"]', {
      name: 'description',
      content: metadata.description,
    })

    upsertMeta('meta[name="theme-color"]', {
      name: 'theme-color',
      content: themeColor,
    })

    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: metadata.robots,
    })

    upsertMeta('meta[property="og:type"]', {
      property: 'og:type',
      content: 'website',
    })

    upsertMeta('meta[property="og:site_name"]', {
      property: 'og:site_name',
      content: siteName,
    })

    upsertMeta('meta[property="og:title"]', {
      property: 'og:title',
      content: metadata.title,
    })

    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: metadata.description,
    })

    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: 'summary',
    })

    upsertMeta('meta[name="twitter:title"]', {
      name: 'twitter:title',
      content: metadata.title,
    })

    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: metadata.description,
    })

    let canonicalLink = document.head.querySelector('link[rel="canonical"]')

    if (canonicalUrl) {
      if (!canonicalLink) {
        canonicalLink = document.createElement('link')
        canonicalLink.setAttribute('rel', 'canonical')
        document.head.append(canonicalLink)
      }

      canonicalLink.setAttribute('href', canonicalUrl)

      upsertMeta('meta[property="og:url"]', {
        property: 'og:url',
        content: canonicalUrl,
      })
    } else {
      canonicalLink?.remove()
      document.head.querySelector('meta[property="og:url"]')?.remove()
    }

    document.body.dataset.pwcRoute = pathname
  }, [pathname])

  return null
}
function RouteAnnouncer() {
  const { pathname } = useLocation()
  const metadata = resolveRouteMetadata(pathname)

  return (
    <div className="sr-only route-announcer" role="status" aria-live="polite" aria-atomic="true">
      {metadata.title}
    </div>
  )
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


function ContactRoute() {
  const { search } = useLocation()
  return <Contact key={search || 'general-contact'} />
}


function RouteLoadingFallback() {
  return (
    <main
      id="main-content"
      className="route-loading"
      tabIndex={-1}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="route-loading__card">
        <span className="route-loading__mark" aria-hidden="true">PW</span>
        <p>Power Within Collective</p>
        <h1>Opening this experience…</h1>
        <div className="route-loading__lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </main>
  )
}

function AppShell() {
  return (
    <>
      <ScrollManager />
      <RouteMetadata />
      <RouteAnnouncer />

      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <SiteHeader />

      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/experiences" element={<Experiences />} />

          <Route
            path="/color-analysis"
            element={
              <SignatureExperiencePage
                experienceKey="color"
                activePath="/color-analysis"
              />
            }
          />

          <Route
            path="/style-analysis"
            element={
              <SignatureExperiencePage
                experienceKey="style"
                activePath="/style-analysis"
              />
            }
          />

          <Route
            path="/blend-cosmetics"
            element={
              <SignatureExperiencePage
                experienceKey="makeup"
                activePath="/blend-cosmetics"
              />
            }
          />

          <Route
            path="/radiance-reclaimed"
            element={<RadianceReclaimed />}
          />

          <Route path="/resources" element={<Resources />} />
          <Route path="/resources/:slug" element={<ResourceArticle />} />

          <Route path="/professionals" element={<Professionals />} />
          <Route
            path="/power-within-professional"
            element={<Navigate to="/professionals" replace />}
          />

          <Route path="/podcast" element={<Podcast />} />

          <Route
            path="/teen-programs"
            element={<TeenPrograms />}
          />

          <Route path="/teens" element={<Navigate to="/teen-programs" replace />} />

          <Route path="/about" element={<About />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/contact" element={<ContactRoute />} />

          <Route
            path="/privacy-policy"
            element={<PrivacyPolicy />}
          />

          <Route
            path="/terms-and-conditions"
            element={<TermsAndConditions />}
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

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
