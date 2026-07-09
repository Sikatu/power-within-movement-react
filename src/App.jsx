import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import ScrollToHash from './components/ScrollToHash.jsx'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import AdminRouteGuard from './components/admin/AdminRouteGuard'
import AdminOwnerRouteGuard from './components/admin/AdminOwnerRouteGuard'

const Home = lazy(() => import('./pages/Home'))
const Experiences = lazy(() => import('./pages/Experiences'))
const Appointments = lazy(() => import('./pages/Appointments'))
const ColorAnalysis = lazy(() => import('./pages/ColorAnalysis'))
const StyleAnalysis = lazy(() => import('./pages/StyleAnalysis'))
const BlendCosmetics = lazy(() => import('./pages/BlendCosmetics'))
const RadianceReclaimed = lazy(() => import('./pages/RadianceReclaimed'))
const Resources = lazy(() => import('./pages/Resources'))
const ResourceArticle = lazy(() => import('./pages/ResourceArticle'))
const Professionals = lazy(() => import('./pages/Professionals'))
const TeenPrograms = lazy(() => import('./pages/TeenPrograms'))
const Podcast = lazy(() => import('./pages/Podcast'))
const About = lazy(() => import('./pages/About'))
const Contact = lazy(() => import('./pages/Contact'))
const ClientPortalInvite = lazy(() => import('./pages/ClientPortalInvite'))
const ClientPortalLogin = lazy(() => import('./pages/ClientPortalLogin'))
const ClientPortalDashboard = lazy(() => import('./pages/ClientPortalDashboard'))
const NotFound = lazy(() => import('./pages/NotFound'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'))
const SessionRequest = lazy(() => import('./pages/SessionRequest'))
const AdminScheduler = lazy(() => import('./pages/admin/AdminScheduler'))
const AdminAuditLog = lazy(() => import('./pages/admin/AdminAuditLog'))
const AdminPlaceholder = lazy(() => import('./pages/admin/AdminPlaceholder'))
const AdminMailStudio = lazy(() => import('./pages/admin/AdminMailStudio'))
const AdminClients = lazy(() => import('./pages/admin/AdminClients'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminFoundersView = lazy(() => import('./pages/admin/AdminFoundersView'))
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))
const SITE_URL = 'https://www.kimmittelstadt.com'

const routeMetadata = {
  '/': {
    title: 'Power Within Collective | Confidence Coaching, Color Analysis & Personal Style',
    description:
      'Confidence coaching, color analysis, personal style guidance, beauty direction, and whole-person transformation experiences for women ready to reconnect with presence and self-trust.',
  },
  '/experiences': {
    title: 'Confidence, Style & Image Experiences | Power Within Collective',
    description:
      'Explore private confidence coaching, personal style guidance, color analysis, beauty direction, Radiance Reclaimed, and whole-person transformation experiences.',
  },
  '/appointments': {
    title: 'Personal Image, Color & Style Appointments | Power Within Collective',
    description:
      'Book personalized color analysis, style analysis, makeup direction, beauty guidance, and personal presence appointments for women in a new season of life.',
  },
  '/color-analysis': {
    title: 'Color Analysis Consultation for Women | Power Within Collective',
    description:
      'A refined color analysis consultation for women seeking clearer clothing, makeup, accessories, hair direction, and a more confident personal presence.',
  },
  '/style-analysis': {
    title: 'Personal Style Analysis & Wardrobe Guidance | Power Within Collective',
    description:
      'Personal style analysis and wardrobe guidance for women seeking body shape clarity, proportion, outfit direction, and style confidence.',
  },
  '/blend-cosmetics': {
    title: 'Makeup & Beauty Direction Consultation | Power Within Collective',
    description:
      'A personalized makeup and beauty direction consultation designed around undertones, product choices, application, natural confidence, and everyday polish.',
  },
  '/radiance-reclaimed': {
    title: 'Women’s Confidence & Presence Coaching | Radiance Reclaimed',
    description:
      'A private confidence and presence coaching experience for women ready for whole-person transformation, self-trust, image alignment, and renewed identity.',
  },
  '/resources': {
    title: 'Confidence, Style & Self-Reflection Resources | Power Within Collective',
    description:
      'Curated confidence, personal presence, style, wellness, self-reflection, and self-leadership resources for women returning to themselves.',
  },
  '/professionals': {
    title: 'Image Consultant & Beauty Professional Training | Power Within Professional',
    description:
      'Professional education for beauty, image, style, and wellness professionals who want to turn their expertise into a premium transformation-centered client experience.',
  },
  '/power-within-professional': {
    title: 'Image Consultant & Beauty Professional Training | Power Within Professional',
    description:
      'Professional education for beauty, image, style, and wellness professionals who want to turn their expertise into a premium transformation-centered client experience.',
  },
  '/teen-programs': {
    title: 'Teen Confidence Programs for Girls | Power Within Collective',
    description:
      'Supportive teen confidence programs for girls and young women building identity, emotional awareness, self-expression, and grounded self-trust.',
  },
  '/teens': {
    title: 'Teen Confidence Programs for Girls | Power Within Collective',
    description:
      'Supportive teen confidence programs for girls and young women building identity, emotional awareness, self-expression, and grounded self-trust.',
  },
  '/podcast': {
    title: 'Raising Her Confidence Podcast | Teen Confidence & Mother-Daughter Conversations',
    description:
      'A podcast for mothers, mentors, and adults supporting girls through confidence, identity, emotional wellness, self-expression, and presence.',
  },
  '/about': {
    title: 'About Kim Mittelstadt | Power Within Collective',
    description:
      'Learn about Kim Mittelstadt, founder of Power Within Collective, and the whole-person foundation behind her confidence, style, beauty, and transformation work.',
  },
  '/contact': {
    title: 'Contact Power Within Collective | Private Consultations & Speaking',
    description:
      'Contact Power Within Collective about private consultations, color analysis, personal style guidance, Radiance Reclaimed, professional education, speaking, podcast, or collaboration.',
  },
  '/resources/what-is-color-analysis': {
    title: 'What Is Color Analysis? | Power Within Collective',
    description:
      'Learn what color analysis is and how it supports clothing, makeup, accessories, hair direction, personal presence, and confidence.',
  },
  '/resources/what-is-personal-style-analysis': {
    title: 'What Is Personal Style Analysis? | Power Within Collective',
    description:
      'Learn how personal style analysis supports wardrobe clarity, body shape, proportion, outfit direction, and confidence for women.',
  },
  '/resources/fashion-advice-for-women-over-40': {
    title: 'Fashion Advice for Women Over 40 | Power Within Collective',
    description:
      'Fashion advice for women over 40 focused on identity, body confidence, wardrobe clarity, color, proportion, and personal presence.',
  },
  '/resources/rebuild-confidence-through-personal-style': {
    title: 'How to Rebuild Confidence Through Personal Style | Power Within Collective',
    description:
      'Learn how personal style, color, wardrobe direction, and image alignment can help women rebuild confidence and self-trust.',
  },
  '/resources/confidence-coaching-for-women': {
    title: 'Confidence Coaching for Women | Power Within Collective',
    description:
      'Confidence coaching for women in a new season of life, with support for identity, presence, image alignment, self-trust, and transformation.',
  },
  '/privacy-policy': {
    title: 'Privacy Policy | Power Within Movement, LLC',
    description:
      'Read how Power Within Movement, LLC collects, uses, and protects information submitted through this website.',
  },
  '/terms-and-conditions': {
    title: 'Terms & Conditions | Power Within Movement, LLC',
    description:
      'Review the terms and conditions for using the Power Within Movement, LLC website and content.',
  },
}

function setMeta(selector, attribute, value) {
  let element = document.head.querySelector(selector)

  if (!element) {
    element = document.createElement('meta')
    const match = selector.match(/\[(name|property)="([^"]+)"\]/)
    if (match) element.setAttribute(match[1], match[2])
    document.head.appendChild(element)
  }

  element.setAttribute(attribute, value)
}

function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const metadata = routeMetadata[pathname] || routeMetadata['/']
    const canonicalUrl = `${SITE_URL}${pathname === '/' ? '/' : pathname}`

    document.title = metadata.title
    setMeta('meta[name="description"]', 'content', metadata.description)
    setMeta('meta[property="og:title"]', 'content', metadata.title)
    setMeta('meta[property="og:description"]', 'content', metadata.description)
    setMeta('meta[property="og:url"]', 'content', canonicalUrl)
    setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image')

    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', canonicalUrl)
  }, [pathname])

  return null
}

function PageLoading() {
  return (
    <main className="page-shell" aria-live="polite">
      <section className="section-block">
        <p className="eyebrow">Loading</p>
        <h1>Preparing your experience...</h1>
      </section>
    </main>
  )
}
function App() {
  return (
    <BrowserRouter>
      <ScrollToHash />
      <RouteMetadata />
      <Navbar />
      <ScrollToTop />

      <Suspense fallback={<PageLoading />}>
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/experiences" element={<Experiences />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/color-analysis" element={<ColorAnalysis />} />
        <Route path="/style-analysis" element={<StyleAnalysis />} />
        <Route path="/blend-cosmetics" element={<BlendCosmetics />} />
        <Route path="/radiance-reclaimed" element={<RadianceReclaimed />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/professionals" element={<Professionals />} />
        <Route path="/power-within-professional" element={<Professionals />} />
        <Route path="/teen-programs" element={<TeenPrograms />} />
        <Route path="/podcast" element={<Podcast />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/client-portal" element={<Navigate to="/client-portal/login" replace />} />
        <Route path="/client-portal/invite/:token" element={<ClientPortalInvite />} />
        <Route path="/client-portal/login" element={<ClientPortalLogin />} />
        <Route path="/client-portal/dashboard" element={<ClientPortalDashboard />} />
        <Route path="/teens" element={<TeenPrograms />} />

        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        <Route
          path="/admin/dashboard"
          element={
            <AdminRouteGuard>
              <AdminDashboard />
            </AdminRouteGuard>
          }
        />

        <Route
          path="/admin/founders-view"
          element={
            <AdminOwnerRouteGuard>
              <AdminFoundersView />
            </AdminOwnerRouteGuard>
          }
        />

        <Route
          path="/admin/clients"
          element={
            <AdminRouteGuard>
              <AdminClients />
            </AdminRouteGuard>
          }
        />

        <Route
          path="/admin/scheduler"
          element={
            <AdminRouteGuard>
              <AdminScheduler />
            </AdminRouteGuard>
          }
        />

        <Route
          path="/admin/email-studio"
          element={
            <AdminRouteGuard>
              <AdminMailStudio />
            </AdminRouteGuard>
          }
        />

        <Route
          path="/admin/courses"
          element={
            <AdminRouteGuard>
              <AdminPlaceholder
                eyebrow="Learning Library"
                title="Learning Library"
                description="Manage lessons, downloads, reflections, and guided learning experiences for clients and members."
              />
            </AdminRouteGuard>
          }
        />

        <Route
          path="/admin/memberships"
          element={
            <AdminRouteGuard>
              <AdminPlaceholder
                eyebrow="Membership Circle"
                title="Membership Circle"
                description="Care for active members, private access, community spaces, and ongoing transformation."
              />
            </AdminRouteGuard>
          }
        />

        <Route
          path="/admin/encouragements"
          element={
            <AdminRouteGuard>
              <AdminPlaceholder
                eyebrow="Daily Encouragements"
                title="Daily Encouragements"
                description="Share words that steady, uplift, and reconnect your community to confidence and presence."
              />
            </AdminRouteGuard>
          }
        />

        <Route
          path="/admin/audit-log"
          element={
            <AdminRouteGuard>
              <AdminAuditLog />
            </AdminRouteGuard>
          }
        />

        <Route path="/session-request" element={<SessionRequest />} />
        <Route path="/clarity-session" element={<SessionRequest />} />
        <Route path="/book-clarity-session" element={<SessionRequest />} />
        <Route path="/personal-presence-consultation" element={<SessionRequest />} />
        <Route path="/consultation" element={<SessionRequest />} />
        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      <Footer />
    </BrowserRouter>
  )
}

export default App






