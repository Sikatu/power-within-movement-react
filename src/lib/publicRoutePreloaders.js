const publicRouteLoaders = {
  '/about': () => import('../pages/About.jsx'),
  '/contact': () => import('../pages/Contact.jsx'),
  '/experiences': () => import('../pages/Experiences.jsx'),
  '/color-analysis': () => import('../pages/SignatureExperiencePage.jsx'),
  '/style-analysis': () => import('../pages/SignatureExperiencePage.jsx'),
  '/blend-cosmetics': () => import('../pages/SignatureExperiencePage.jsx'),
  '/radiance-reclaimed': () => import('../pages/RadianceReclaimed.jsx'),
  '/resources': () => import('../pages/Resources.jsx'),
  '/professionals': () => import('../pages/Professionals.jsx'),
  '/power-within-professional': () => import('../pages/Professionals.jsx'),
  '/podcast': () => import('../pages/Podcast.jsx'),
  '/teen-programs': () => import('../pages/TeenPrograms.jsx'),
  '/teens': () => import('../pages/TeenPrograms.jsx'),
  '/privacy-policy': () => import('../pages/PrivacyPolicy.jsx'),
  '/terms-and-conditions': () => import('../pages/TermsAndConditions.jsx'),
  '/client-portal/login': () => import('../pages/ClientPortalLogin.jsx'),
}

const pendingLoads = new Map()

export function loadPublicRoute(path) {
  const loader = publicRouteLoaders[path]
  if (!loader) return Promise.resolve()

  if (!pendingLoads.has(path)) {
    pendingLoads.set(path, loader())
  }

  return pendingLoads.get(path)
}

export function preloadPublicRoute(path) {
  void loadPublicRoute(path).catch(() => {
    pendingLoads.delete(path)
  })
}

export function preloadPrimaryPublicRoutes() {
  const paths = ['/experiences', '/resources', '/professionals', '/podcast', '/teen-programs', '/about', '/contact']
  paths.forEach(preloadPublicRoute)
}
