import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import SiteFooter from './components/SiteFooter.jsx'
import SiteHeader from './components/SiteHeader.jsx'
import AdminDeveloperRouteGuard from './components/admin/AdminDeveloperRouteGuard.jsx'
import AdminConfirmProvider from './components/admin/AdminConfirmProvider.jsx'
import AdminErrorBoundary from './components/admin/AdminErrorBoundary.jsx'
import AdminOwnerRouteGuard from './components/admin/AdminOwnerRouteGuard.jsx'
import AdminRouteGuard from './components/admin/AdminRouteGuard.jsx'
import {
  loadAdminActivityCenter,
  loadAdminAttentionQueue,
  loadAdminCapacityCenter,
  loadAdminClientMomentum,
  loadAdminClientCoverage,
  loadAdminSessionReadiness,
  loadAdminSessionFollowThrough,
  loadAdminDailyBrief,
  loadAdminWeekPlanner,
  loadAdminAuditLog,
  loadAdminAutomationStudio,
  loadAdminChangePassword,
  loadAdminCircleCommunity,
  loadAdminClient360,
  loadAdminClients,
  loadAdminDashboard,
  loadAdminDeveloperErrors,
  loadAdminDeveloperPanel,
  loadAdminSecurityIntegrity,
  loadAdminEncouragements,
  loadAdminFounderAvailability,
  loadAdminFounderCalendar,
  loadAdminFoundersView,
  loadAdminInbox,
  loadAdminLeadPipeline,
  loadAdminLearningLibrary,
  loadAdminLogin,
  loadAdminMailStudio,
  loadAdminMembershipCircle,
  loadAdminOnboardingStudio,
  loadAdminScheduler,
  loadAdminSessionChangeRequests,
  loadAdminTeamManagement,
} from './components/admin/adminRoutePreloaders.js'
import { signatureExperiences } from './data/signatureExperiences.js'
import About from './pages/About.jsx'
import Contact from './pages/Contact.jsx'
import ClientPortalInvite from './pages/ClientPortalInvite.jsx'
import ClientPortalLogin from './pages/ClientPortalLogin.jsx'
import ClientPortalDashboard from './pages/ClientPortalDashboard.jsx'
import ClientPortalCircle from './pages/ClientPortalCircle.jsx'
import ClientPortalJourney from './pages/ClientPortalJourney.jsx'
import ClientPortalLearning from './pages/ClientPortalLearning.jsx'
import ClientPortalMembership from './pages/ClientPortalMembership.jsx'
import ClientPortalMessages from './pages/ClientPortalMessages.jsx'
import ClientPortalResources from './pages/ClientPortalResources.jsx'
import ClientPortalSessions from './pages/ClientPortalSessions.jsx'
import Experiences from './pages/Experiences.jsx'
import Home from './pages/Home.jsx'
import NotFound from './pages/NotFound.jsx'
import Podcast from './pages/Podcast.jsx'
import Professionals from './pages/Professionals.jsx'
import RadianceReclaimed from './pages/RadianceReclaimed.jsx'
import ResourceArticle from './pages/ResourceArticle.jsx'
import Resources from './pages/Resources.jsx'
import SignatureExperiencePage from './pages/SignatureExperiencePage.jsx'
import TeenPrograms from './pages/TeenPrograms.jsx'

const AdminActivityCenter = lazy(loadAdminActivityCenter)
const AdminAttentionQueue = lazy(loadAdminAttentionQueue)
const AdminCapacityCenter = lazy(loadAdminCapacityCenter)
const AdminClientMomentum = lazy(loadAdminClientMomentum)
const AdminClientCoverage = lazy(loadAdminClientCoverage)
const AdminSessionReadiness = lazy(loadAdminSessionReadiness)
const AdminSessionFollowThrough = lazy(loadAdminSessionFollowThrough)
const AdminDailyBrief = lazy(loadAdminDailyBrief)
const AdminWeekPlanner = lazy(loadAdminWeekPlanner)
const AdminAuditLog = lazy(loadAdminAuditLog)
const AdminAutomationStudio = lazy(loadAdminAutomationStudio)
const AdminChangePassword = lazy(loadAdminChangePassword)
const AdminCircleCommunity = lazy(loadAdminCircleCommunity)
const AdminClient360 = lazy(loadAdminClient360)
const AdminClients = lazy(loadAdminClients)
const AdminDashboard = lazy(loadAdminDashboard)
const AdminDeveloperErrors = lazy(loadAdminDeveloperErrors)
const AdminDeveloperPanel = lazy(loadAdminDeveloperPanel)
const AdminSecurityIntegrity = lazy(loadAdminSecurityIntegrity)
const AdminEncouragements = lazy(loadAdminEncouragements)
const AdminFounderAvailability = lazy(loadAdminFounderAvailability)
const AdminFounderCalendar = lazy(loadAdminFounderCalendar)
const AdminFoundersView = lazy(loadAdminFoundersView)
const AdminInbox = lazy(loadAdminInbox)
const AdminLeadPipeline = lazy(loadAdminLeadPipeline)
const AdminLearningLibrary = lazy(loadAdminLearningLibrary)
const AdminLogin = lazy(loadAdminLogin)
const AdminMailStudio = lazy(loadAdminMailStudio)
const AdminMembershipCircle = lazy(loadAdminMembershipCircle)
const AdminOnboardingStudio = lazy(loadAdminOnboardingStudio)
const AdminScheduler = lazy(loadAdminScheduler)
const AdminSessionChangeRequests = lazy(loadAdminSessionChangeRequests)
const AdminTeamManagement = lazy(loadAdminTeamManagement)

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
  '/client-portal/journey': {
    title: 'My Journey | Power Within Collective',
    description: 'Private shared reflections, follow-ups, and care history from Power Within Collective.',
  },
  '/client-portal/resources': {
    title: 'My Resources | Power Within Collective',
    description: 'A private library of guides, worksheets, videos, links, reminders, and notes selected for your care.',
  },
  '/client-portal/learning': {
    title: 'Learning Library | Power Within Collective',
    description: 'Private guided courses, lessons, reflections, and learning progress selected for your Power Within journey.',
  },
  '/client-portal/membership': {
    title: 'My Membership | Power Within Collective',
    description: 'Active membership benefits, resources, learning, announcements, and renewal information.',
  },
  '/client-portal/sessions': {
    title: 'My Sessions | Power Within Collective',
    description: 'Book and manage private Power Within Collective client sessions.',
  },
  '/client-portal/circle': {
    title: 'The Circle | Power Within Collective',
    description: 'A private Power Within Collective community for member reflection, encouragement, and conversation.',
  },
  '/client-portal/messages': {
    title: 'Private Messages | Power Within Collective',
    description: 'Secure private client communication with the Power Within Collective team.',
  },
  '/admin/login': {
    title: 'The Studio Login | Power Within Collective',
    description: 'Private access to The Studio, Founder’s View, and Developer Operations.',
  },
  '/admin/dashboard': {
    title: 'The Studio | Power Within Collective',
    description: 'Private studio operations for client care, sessions, and communications.',
  },
  '/admin/change-password': {
    title: 'Secure Account Setup | Power Within Collective',
    description: 'Create a permanent password for private Power Within Collective workspace access.',
  },
  '/admin/clients': {
    title: 'Client Circle | The Studio',
    description: 'Manage client profiles, care records, portal access, and private resources.',
  },
  '/admin/client-360': {
    title: 'Client 360 | The Studio',
    description: 'A complete operational view of a Power Within Collective client journey.',
  },
  '/admin/scheduler': {
    title: 'Sessions & Calendar | The Studio',
    description: 'Manage appointments, availability, and private client sessions.',
  },
  '/admin/session-changes': {
    title: 'Session Changes | The Studio',
    description: 'Review client cancellation and rescheduling requests.',
  },
  '/admin/inbox': {
    title: 'Secure Inbox | The Studio',
    description: 'Manage private Power Within Collective client conversations.',
  },
  '/admin/email-studio': {
    title: 'Mail Studio | The Studio',
    description: 'Prepare and deliver thoughtful client communications.',
  },
  '/admin/leads': {
    title: 'Leads & Intake | The Studio',
    description: 'Manage inquiries, follow-ups, consultations, and client intake.',
  },
  '/admin/automations': {
    title: 'Automation Studio | The Studio',
    description: 'Manage client communication and care workflow automations.',
  },
  '/admin/onboarding': {
    title: 'Booking & Onboarding | The Studio',
    description: 'Manage booking flows, intake forms, and client onboarding.',
  },
  '/admin/courses': {
    title: 'Learning Library | The Studio',
    description: 'Manage private courses, lessons, resources, and client learning access.',
  },
  '/admin/memberships': {
    title: 'Membership Circle | The Studio',
    description: 'Manage membership plans, enrollments, resources, and announcements.',
  },
  '/admin/circle': {
    title: 'The Circle Community | The Studio',
    description: 'Create and moderate the private Power Within Collective community.',
  },
  '/admin/encouragements': {
    title: 'Encouragement Studio | The Studio',
    description: 'Draft, schedule, and publish thoughtful client encouragements.',
  },
  '/admin/brief': {
    title: 'Today in The Studio | Power Within Collective',
    description: 'Begin the day with a role-aware summary of priority attention, upcoming sessions, and unread Studio activity.',
  },
  '/admin/week': {
    title: 'Studio Week Planner | Power Within Collective',
    description: 'Balance scheduled sessions and accountable client-care work across a clear role-aware seven-day Studio plan.',
  },
  '/admin/capacity': {
    title: 'Studio Capacity | Power Within Collective',
    description: 'Balance role-aware team workload, accountable client care, upcoming sessions, and configured Studio capacity.',
  },
  '/admin/momentum': {
    title: 'Client Momentum | Power Within Collective',
    description: 'Review role-aware care momentum across active clients, recent touchpoints, accountable actions, sessions, and conversations.',
  },
  '/admin/coverage': {
    title: 'Studio Coverage & Handoffs | Power Within Collective',
    description: 'Review role-aware client ownership, team availability, backup coverage, active care pressure, and approaching sessions.',
  },
  '/admin/readiness': {
    title: 'Session Readiness | Power Within Collective',
    description: 'Prepare role-aware upcoming sessions with booking decisions, intake, onboarding, care actions, conversations, ownership, and confirmations in one view.',
  },
  '/admin/follow-through': {
    title: 'Session Follow-Through | Power Within Collective',
    description: 'Review role-aware recently completed and missed sessions, documentation, care actions, messages, resources, and next-session continuity.',
  },
  '/admin/activity': {
    title: 'Studio Activity Center | The Studio',
    description: 'Review role-aware notifications, priority updates, and recent operational activity across The Studio.',
  },
  '/admin/attention': {
    title: 'Studio Attention Queue | The Studio',
    description: 'Coordinate lead follow-ups and client care actions with clear ownership, priority, due dates, and completion tracking.',
  },
  '/admin/audit-log': {
    title: 'Activity Journal | The Studio',
    description: 'Review protected operational activity across The Studio.',
  },
  '/admin/team': {
    title: 'Staff & Team Management | Power Within Collective',
    description: 'Manage team roles, permissions, assignments, and operational access.',
  },
  '/admin/founders-view': {
    title: 'Founder’s View | Power Within Collective',
    description: 'Private founder overview for priorities, schedule, and availability.',
  },
  '/admin/founders-calendar': {
    title: 'Founder Calendar | Power Within Collective',
    description: 'A simplified private calendar for founder sessions and protected time.',
  },
  '/admin/founders-availability': {
    title: 'Protect Your Time | Power Within Collective',
    description: 'Manage founder availability, weekly hours, and custom date protection.',
  },
  '/admin/developer': {
    title: 'Developer Control Center | Power Within Collective',
    description: 'Private platform operations, access governance, and release visibility.',
  },
  '/admin/developer/errors': {
    title: 'Developer Error Center | Power Within Collective',
    description: 'Private platform monitoring and error review.',
  },
  '/admin/developer/integrity': {
    title: 'Security & Data Integrity | Power Within Collective',
    description: 'Developer-only audit of privileged access, staff permissions, request trust, and operational data integrity.',
  },
}

function resolveRouteMetadata(pathname) {
  return routeMetadata[pathname]
    || (pathname.startsWith('/client-portal/invite/') ? routeMetadata['/client-portal/invite'] : null)
    || (pathname.startsWith('/client-portal/messages/') ? routeMetadata['/client-portal/messages'] : null)
    || (pathname.startsWith('/admin/clients/') ? routeMetadata['/admin/clients'] : null)
    || (pathname.startsWith('/admin/client-360/') ? routeMetadata['/admin/client-360'] : null)
    || {
      title: 'Power Within Collective',
      description: 'A thoughtful whole-person experience for confidence, style, personal presence, and self-recognition.',
    }
}

function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const metadata = resolveRouteMetadata(pathname)
    const themeColor = pathname.startsWith('/admin') ? '#2f2024' : '#faf3ec'
    let themeColorMeta = document.querySelector('meta[name="theme-color"]')

    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta')
      themeColorMeta.setAttribute('name', 'theme-color')
      document.head.append(themeColorMeta)
    }

    document.title = metadata.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', metadata.description)
    themeColorMeta.setAttribute('content', themeColor)
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
    const framedAdminRoute = pathname.startsWith('/admin/')
      && !['/admin/login', '/admin/change-password'].includes(pathname)

    if (framedAdminRoute) return

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


function RouteLoadingFallback({ internal }) {
  return (
    <main
      id="main-content"
      className={`route-loading${internal ? ' is-admin' : ''}`}
      tabIndex={-1}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="route-loading__card">
        <span className="route-loading__mark" aria-hidden="true">PW</span>
        <p>{internal ? 'Power Within · The Studio' : 'Power Within Collective'}</p>
        <h1>{internal ? 'Opening your private workspace…' : 'Opening this experience…'}</h1>
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
  const { pathname } = useLocation()
  const isInternalRoute = pathname.startsWith('/admin')

  return (
    <>
      <ScrollManager />
      <RouteMetadata />
      <RouteAnnouncer />
      <a className="skip-link" href="#main-content">Skip to content</a>
      {!isInternalRoute && <SiteHeader />}
      <AdminErrorBoundary resetKey={pathname} internal={isInternalRoute}>
        <Suspense fallback={<RouteLoadingFallback internal={isInternalRoute} />}>
          <AdminConfirmProvider>
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
        <Route path="/client-portal/journey" element={<ClientPortalJourney />} />
        <Route path="/client-portal/resources" element={<ClientPortalResources />} />
        <Route path="/client-portal/learning" element={<ClientPortalLearning />} />
        <Route path="/client-portal/membership" element={<ClientPortalMembership />} />
        <Route path="/client-portal/circle" element={<ClientPortalCircle />} />
        <Route path="/client-portal/sessions" element={<ClientPortalSessions />} />
        <Route path="/client-portal/messages" element={<ClientPortalMessages />} />
        <Route path="/client-portal/messages/:conversationId" element={<ClientPortalMessages />} />
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/change-password" element={<AdminChangePassword />} />
        <Route path="/admin/dashboard" element={<AdminRouteGuard><AdminDashboard /></AdminRouteGuard>} />
        <Route path="/admin/developer" element={<AdminDeveloperRouteGuard><AdminDeveloperPanel /></AdminDeveloperRouteGuard>} />
        <Route path="/admin/developer/errors" element={<AdminDeveloperRouteGuard><AdminDeveloperErrors /></AdminDeveloperRouteGuard>} />
        <Route path="/admin/developer/integrity" element={<AdminDeveloperRouteGuard><AdminSecurityIntegrity /></AdminDeveloperRouteGuard>} />
        <Route path="/admin/team" element={<AdminDeveloperRouteGuard><AdminTeamManagement /></AdminDeveloperRouteGuard>} />
        <Route path="/admin/founders-view" element={<AdminOwnerRouteGuard><AdminFoundersView /></AdminOwnerRouteGuard>} />
        <Route path="/admin/founders-calendar" element={<AdminOwnerRouteGuard><AdminFounderCalendar /></AdminOwnerRouteGuard>} />
        <Route path="/admin/founders-availability" element={<AdminOwnerRouteGuard><AdminFounderAvailability /></AdminOwnerRouteGuard>} />
        <Route path="/admin/leads" element={<AdminRouteGuard><AdminLeadPipeline /></AdminRouteGuard>} />
        <Route path="/admin/client-360/:clientId" element={<AdminRouteGuard><AdminClient360 /></AdminRouteGuard>} />
        <Route path="/admin/clients" element={<AdminRouteGuard><AdminClients /></AdminRouteGuard>} />
        <Route path="/admin/clients/:clientId" element={<AdminRouteGuard><AdminClients /></AdminRouteGuard>} />
        <Route path="/admin/clients/:clientId/:section" element={<AdminRouteGuard><AdminClients /></AdminRouteGuard>} />
        <Route path="/admin/scheduler" element={<AdminRouteGuard><AdminScheduler /></AdminRouteGuard>} />
        <Route path="/admin/session-changes" element={<AdminRouteGuard><AdminSessionChangeRequests /></AdminRouteGuard>} />
        <Route path="/admin/inbox" element={<AdminRouteGuard><AdminInbox /></AdminRouteGuard>} />
        <Route path="/admin/email-studio" element={<AdminRouteGuard><AdminMailStudio /></AdminRouteGuard>} />
        <Route path="/admin/automations" element={<AdminRouteGuard><AdminAutomationStudio /></AdminRouteGuard>} />
        <Route path="/admin/onboarding" element={<AdminRouteGuard><AdminOnboardingStudio /></AdminRouteGuard>} />
        <Route path="/admin/courses" element={<AdminRouteGuard><AdminLearningLibrary /></AdminRouteGuard>} />
        <Route path="/admin/memberships" element={<AdminRouteGuard><AdminMembershipCircle /></AdminRouteGuard>} />
        <Route path="/admin/circle" element={<AdminRouteGuard><AdminCircleCommunity /></AdminRouteGuard>} />
        <Route path="/admin/encouragements" element={<AdminRouteGuard><AdminEncouragements /></AdminRouteGuard>} />
        <Route path="/admin/brief" element={<AdminRouteGuard><AdminDailyBrief /></AdminRouteGuard>} />
        <Route path="/admin/week" element={<AdminRouteGuard><AdminWeekPlanner /></AdminRouteGuard>} />
        <Route path="/admin/capacity" element={<AdminRouteGuard><AdminCapacityCenter /></AdminRouteGuard>} />
        <Route path="/admin/momentum" element={<AdminRouteGuard><AdminClientMomentum /></AdminRouteGuard>} />
        <Route path="/admin/coverage" element={<AdminRouteGuard><AdminClientCoverage /></AdminRouteGuard>} />
        <Route path="/admin/readiness" element={<AdminRouteGuard><AdminSessionReadiness /></AdminRouteGuard>} />
        <Route path="/admin/follow-through" element={<AdminRouteGuard><AdminSessionFollowThrough /></AdminRouteGuard>} />
        <Route path="/admin/activity" element={<AdminRouteGuard><AdminActivityCenter /></AdminRouteGuard>} />
        <Route path="/admin/attention" element={<AdminRouteGuard><AdminAttentionQueue /></AdminRouteGuard>} />
        <Route path="/admin/audit-log" element={<AdminRouteGuard><AdminAuditLog /></AdminRouteGuard>} />
        <Route path="*" element={<NotFound />} />
          </Routes>
          </AdminConfirmProvider>
        </Suspense>
      </AdminErrorBoundary>
      {!isInternalRoute && <SiteFooter />}
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
