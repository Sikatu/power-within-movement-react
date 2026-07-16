function cached(importer) {
  let promise

  return () => {
    if (!promise) {
      promise = importer().catch((error) => {
        promise = undefined
        throw error
      })
    }

    return promise
  }
}

export const loadAdminAssetVault = cached(() => import('../../pages/admin/AdminAssetVault.jsx'))
export const loadAdminAudience = cached(() => import('../../pages/admin/AdminAudience.jsx'))
export const loadAdminActivityCenter = cached(() => import('../../pages/admin/AdminActivityCenter.jsx'))
export const loadAdminAttentionQueue = cached(() => import('../../pages/admin/AdminAttentionQueue.jsx'))
export const loadAdminCapacityCenter = cached(() => import('../../pages/admin/AdminCapacityCenter.jsx'))
export const loadAdminClientMomentum = cached(() => import('../../pages/admin/AdminClientMomentum.jsx'))
export const loadAdminClientCoverage = cached(() => import('../../pages/admin/AdminClientCoverage.jsx'))
export const loadAdminSessionReadiness = cached(() => import('../../pages/admin/AdminSessionReadiness.jsx'))
export const loadAdminSessionFollowThrough = cached(() => import('../../pages/admin/AdminSessionFollowThrough.jsx'))
export const loadAdminDailyBrief = cached(() => import('../../pages/admin/AdminDailyBrief.jsx'))
export const loadAdminWeekPlanner = cached(() => import('../../pages/admin/AdminWeekPlanner.jsx'))
export const loadAdminAuditLog = cached(() => import('../../pages/admin/AdminAuditLog.jsx'))
export const loadAdminAutomationStudio = cached(() => import('../../pages/admin/AdminAutomationStudio.jsx'))
export const loadAdminChangePassword = cached(() => import('../../pages/admin/AdminChangePassword.jsx'))
export const loadAdminCircleCommunity = cached(() => import('../../pages/admin/AdminCircleCommunity.jsx'))
export const loadAdminClient360 = cached(() => import('../../pages/admin/AdminClient360.jsx'))
export const loadAdminClients = cached(() => import('../../pages/admin/AdminClients.jsx'))
export const loadAdminDashboard = cached(() => import('../../pages/admin/AdminDashboard.jsx'))
export const loadAdminDeveloperOperations = cached(() => import('../../pages/admin/AdminDeveloperOperations.jsx'))
export const loadAdminDeveloperErrors = cached(() => import('../../pages/admin/AdminDeveloperErrors.jsx'))
export const loadAdminDeveloperPanel = cached(() => import('../../pages/admin/AdminDeveloperPanel.jsx'))
export const loadAdminSecurityIntegrity = cached(() => import('../../pages/admin/AdminSecurityIntegrity.jsx'))
export const loadAdminReleaseQa = cached(() => import('../../pages/admin/AdminReleaseQa.jsx'))
export const loadAdminEncouragements = cached(() => import('../../pages/admin/AdminEncouragements.jsx'))
export const loadAdminFounderAvailability = cached(() => import('../../pages/admin/AdminFounderAvailability.jsx'))
export const loadAdminFounderCalendar = cached(() => import('../../pages/admin/AdminFounderCalendar.jsx'))
export const loadAdminFoundersView = cached(() => import('../../pages/admin/AdminFoundersView.jsx'))
export const loadAdminInbox = cached(() => import('../../pages/admin/AdminInbox.jsx'))
export const loadAdminLeadPipeline = cached(() => import('../../pages/admin/AdminLeadPipeline.jsx'))
export const loadAdminLearningLibrary = cached(() => import('../../pages/admin/AdminLearningLibrary.jsx'))
export const loadAdminLogin = cached(() => import('../../pages/admin/AdminLogin.jsx'))
export const loadAdminMailStudio = cached(() => import('../../pages/admin/AdminMailStudio.jsx'))
export const loadAdminLetters = cached(() => import('../../pages/admin/AdminLetters.jsx'))
export const loadAdminMembershipCircle = cached(() => import('../../pages/admin/AdminMembershipCircle.jsx'))
export const loadAdminOnboardingStudio = cached(() => import('../../pages/admin/AdminOnboardingStudio.jsx'))
export const loadAdminOperationsCenter = cached(() => import('../../pages/admin/AdminOperationsCenter.jsx'))
export const loadAdminScheduler = cached(() => import('../../pages/admin/AdminScheduler.jsx'))
export const loadAdminSessionChangeRequests = cached(() => import('../../pages/admin/AdminSessionChangeRequests.jsx'))
export const loadAdminTeamManagement = cached(() => import('../../pages/admin/AdminTeamManagement.jsx'))

const routePreloaders = [
  { match: (path) => path === '/admin/login', load: loadAdminLogin },
  { match: (path) => path === '/admin/change-password', load: loadAdminChangePassword },
  { match: (path) => path === '/admin/dashboard', load: loadAdminDashboard },
  { match: (path) => path === '/admin/assets', load: loadAdminAssetVault },
  { match: (path) => path === '/admin/audience', load: loadAdminAudience },
  { match: (path) => path === '/admin/developer' || path.startsWith('/admin/developer?'), load: loadAdminDeveloperOperations },
  { match: (path) => path.startsWith('/admin/developer/errors'), load: loadAdminDeveloperOperations },
  { match: (path) => path === '/admin/developer/integrity', load: loadAdminDeveloperOperations },
  { match: (path) => path === '/admin/developer/qa', load: loadAdminDeveloperOperations },
  { match: (path) => path === '/admin/team', load: loadAdminTeamManagement },
  { match: (path) => path === '/admin/founders-view', load: loadAdminFoundersView },
  { match: (path) => path === '/admin/founders-calendar', load: loadAdminFounderCalendar },
  { match: (path) => path === '/admin/founders-availability', load: loadAdminFounderAvailability },
  { match: (path) => path === '/admin/leads', load: loadAdminLeadPipeline },
  { match: (path) => path.startsWith('/admin/client-360/'), load: loadAdminClient360 },
  { match: (path) => path === '/admin/clients' || path.startsWith('/admin/clients/'), load: loadAdminClients },
  { match: (path) => path === '/admin/scheduler', load: loadAdminScheduler },
  { match: (path) => path === '/admin/session-changes', load: loadAdminSessionChangeRequests },
  { match: (path) => path === '/admin/inbox', load: loadAdminInbox },
  { match: (path) => path === '/admin/email-studio', load: loadAdminMailStudio },
  { match: (path) => path === '/admin/letters', load: loadAdminLetters },
  { match: (path) => path === '/admin/automations', load: loadAdminAutomationStudio },
  { match: (path) => path === '/admin/onboarding', load: loadAdminOnboardingStudio },
  { match: (path) => path === '/admin/courses', load: loadAdminLearningLibrary },
  { match: (path) => path === '/admin/memberships', load: loadAdminMembershipCircle },
  { match: (path) => path === '/admin/circle', load: loadAdminCircleCommunity },
  { match: (path) => path === '/admin/encouragements', load: loadAdminEncouragements },
  { match: (path) => path === '/admin/operations', load: loadAdminOperationsCenter },
  { match: (path) => path === '/admin/brief', load: loadAdminDailyBrief },
  { match: (path) => path === '/admin/week', load: loadAdminWeekPlanner },
  { match: (path) => path === '/admin/activity', load: loadAdminActivityCenter },
  { match: (path) => path === '/admin/attention', load: loadAdminAttentionQueue },
  { match: (path) => path === '/admin/capacity', load: loadAdminCapacityCenter },
  { match: (path) => path === '/admin/momentum', load: loadAdminClientMomentum },
  { match: (path) => path === '/admin/coverage', load: loadAdminClientCoverage },
  { match: (path) => path === '/admin/readiness', load: loadAdminSessionReadiness },
  { match: (path) => path === '/admin/follow-through', load: loadAdminSessionFollowThrough },
  { match: (path) => path === '/admin/audit-log', load: loadAdminAuditLog },
]

export function preloadAdminRoute(pathname) {
  const route = routePreloaders.find((entry) => entry.match(pathname))
  return route?.load()
}

export function preloadAdminRoutes(pathnames) {
  return Promise.allSettled(pathnames.map((pathname) => preloadAdminRoute(pathname)))
}
