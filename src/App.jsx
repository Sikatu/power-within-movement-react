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
    title: 'Power Within Collective | Confidence, Presence & Transformation',
    description:
      'Transformational experiences for women ready to reconnect with confidence, presence, style, and the power within.',
  },
  '/experiences': {
    title: 'Experiences | Power Within Collective',
    description:
      'Explore clarity sessions, personalized appointments, Radiance Reclaimed, and whole-person experiences for confidence, presence, wellness, and style.',
  },
  '/appointments': {
    title: 'Personalized Appointments | Power Within Collective',
    description:
      'Explore personalized beauty, color, style, makeup, and personal presence appointments for women in a new season of life.',
  },
  '/color-analysis': {
    title: 'Personal Color Alignment | Power Within Collective',
    description:
      'Discover personal color direction for clothing, makeup, accessories, hair direction, and a more confident presence.',
  },
  '/style-analysis': {
    title: 'Personal Style Alignment | Power Within Collective',
    description:
      'Refine personal style with body shape, proportion, wardrobe structure, and style direction for this season of life.',
  },
  '/blend-cosmetics': {
    title: 'Personalized Beauty Experience | Power Within Collective',
    description:
      'Makeup lesson and beauty direction designed around undertones, product choices, application, and natural confidence.',
  },
  '/radiance-reclaimed': {
    title: 'Radiance Reclaimed | Power Within Collective',
    description:
      'A private, whole-person transformation experience for the woman ready to inhabit the life that fits who she has become.',
  },
  '/resources': {
    title: 'The Vault Resources | Power Within Collective',
    description:
      'Curated resources for women seeking reflection, confidence, personal presence, style, wellness, and self-leadership.',
  },
  '/professionals': {
    title: 'Power Within Professional | Signature Experience Method for Beauty & Image Professionals',
    description:
      'A professional development experience helping beauty and image professionals turn their expertise into a premium, transformation-centered client experience.',
  },
  '/power-within-professional': {
    title: 'Power Within Professional | Signature Experience Method for Beauty & Image Professionals',
    description:
      'A professional development experience helping beauty and image professionals turn their expertise into a premium, transformation-centered client experience.',
  },
  '/teen-programs': {
    title: 'Teen Programs | Power Within Collective',
    description:
      'Supportive experiences for young women building confidence, identity, emotional awareness, and grounded self-expression.',
  },
  '/teens': {
    title: 'Teen Programs | Power Within Collective',
    description:
      'Supportive experiences for young women building confidence, identity, emotional awareness, and grounded self-expression.',
  },
  '/podcast': {
    title: 'Raising Her Confidence Podcast | Power Within Collective',
    description:
      'Thoughtful conversations with Kim Mittelstadt where identity meets confidence, wellness, style, and presence.',
  },
  '/about': {
    title: 'About | Power Within Collective',
    description:
      'Learn about Kim Mittelstadt and the whole-person foundation behind Power Within Collective.',
  },
  '/contact': {
    title: 'Contact | Power Within Collective',
    description:
      'Begin a conversation about clarity sessions, Radiance Reclaimed, professional education, speaking, podcast, or collaboration.',
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



