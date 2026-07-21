import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ClientPortalChrome from '../components/ClientPortalChrome.jsx'
import { getClientPortalDashboard, getClientPortalResources, logoutClientPortal } from '../lib/nativeApi.js'
import './ClientPortalWorkspace.css'
import './ClientPortalJourneyResources.css'

const resourceTypes = [
  { id: 'all', label: 'All Resources', short: 'All' },
  { id: 'guide', label: 'Guides', short: 'Guides' },
  { id: 'worksheet', label: 'Worksheets', short: 'Worksheets' },
  { id: 'video', label: 'Videos', short: 'Videos' },
  { id: 'link', label: 'Links', short: 'Links' },
  { id: 'reminder', label: 'Reminders', short: 'Reminders' },
  { id: 'note', label: 'Private Notes', short: 'Notes' },
]

const resourceTypeCopy = {
  guide: 'Curated direction',
  worksheet: 'Guided reflection',
  video: 'Watch and return',
  link: 'Selected reference',
  reminder: 'Gentle next step',
  note: 'Private care note',
}

function formatDate(value) {
  if (!value) return 'Recently shared'
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeZone: 'America/New_York',
    }).format(new Date(value))
  } catch {
    return 'Recently shared'
  }
}

function safeUrl(value) {
  if (!value) return ''

  if (String(value).startsWith('/api/')) {
    const apiOrigin = import.meta.env.VITE_API_BASE_URL
      || (import.meta.env.PROD ? window.location.origin : 'http://localhost:8787')
    return `${String(apiOrigin).replace(/\/$/, '')}${value}`
  }

  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

function isAuthError(error) {
  return /login required|unauthorized|401/i.test(String(error?.message || error || ''))
}

function friendlyError(error) {
  const message = String(error?.message || error || '')
  if (/failed to fetch|network|load failed/i.test(message)) return 'We could not reach your private resource library. Please check the backend connection and try again.'
  return message || 'Your resource library could not open yet.'
}

function ClientPortalResources() {
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [resources, setResources] = useState([])
  const [activeType, setActiveType] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.body.classList.add('client-workspace-mode')
    return () => document.body.classList.remove('client-workspace-mode')
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([getClientPortalDashboard(), getClientPortalResources()])
      .then(([dashboardResponse, resourcesResponse]) => {
        if (!active) return
        setClient(dashboardResponse.client || null)
        setResources(resourcesResponse.resources || [])
        setLoading(false)
      })
      .catch((loadError) => {
        if (!active) return
        if (isAuthError(loadError)) {
          navigate('/client-portal/login', { replace: true })
          return
        }
        setError(friendlyError(loadError))
        setLoading(false)
      })
    return () => { active = false }
  }, [navigate])

  const resourceCounts = useMemo(() => resources.reduce((counts, resource) => {
    const type = resource.resource_type || 'note'
    counts[type] = (counts[type] || 0) + 1
    return counts
  }, {}), [resources])

  const filteredResources = useMemo(() => {
    const query = search.trim().toLowerCase()
    return resources.filter((resource) => {
      const matchesType = activeType === 'all' || (resource.resource_type || 'note') === activeType
      const matchesQuery = !query || [resource.title, resource.description, resource.resource_type]
        .some((value) => String(value || '').toLowerCase().includes(query))
      return matchesType && matchesQuery
    })
  }, [activeType, resources, search])

  const featuredResource = resources[0] || null
  const activeTypeLabel = resourceTypes.find((type) => type.id === activeType)?.label || 'All Resources'

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logoutClientPortal()
    } finally {
      navigate('/client-portal/login', { replace: true })
    }
  }

  return (
    <main id="main-content" className="portal-workspace portal-resources-page">
      <ClientPortalChrome client={client} loggingOut={loggingOut} onLogout={handleLogout} />

      <div className="portal-workspace-inner">
        <header className="portal-page-intro resource-page-intro">
          <p className="eyebrow">My Library</p>
          <h1>Everything shared for you.</h1>
          <p>Open your newest resource first, or search the full private library when you need something specific.</p>
        </header>

        {error && <div className="portal-notice is-error" role="alert">{error}</div>}

        {loading ? (
          <div className="portal-loading" role="status">Gathering your private resources…</div>
        ) : resources.length === 0 ? (
          <section className="resource-empty-library">
            <p className="eyebrow">Your Library</p>
            <h2>Your first resource will appear here.</h2>
            <p>When Power Within shares a guide, worksheet, video, link, reminder, or note for your journey, it will be waiting in this private space.</p>
          </section>
        ) : (
          <>
            {featuredResource && (
              <section className="resource-feature">
                <div>
                  <p className="eyebrow">Begin Here</p>
                  <span>{resourceTypeCopy[featuredResource.resource_type] || 'Selected for your care'}</span>
                  <h2>{featuredResource.title}</h2>
                  <p>{featuredResource.description || 'A resource selected for your current care journey.'}</p>
                </div>
                <div className="resource-feature-action">
                  <span>{(featuredResource.resource_type || 'note').toUpperCase()}</span>
                  <time>{formatDate(featuredResource.created_at)}</time>
                  {safeUrl(featuredResource.resource_url) ? <a href={safeUrl(featuredResource.resource_url)} target="_blank" rel="noreferrer">Open Resource <span aria-hidden="true">↗</span></a> : <em>Saved as a private note</em>}
                </div>
              </section>
            )}

            <section className="resource-library-section">
              <header className="resource-library-heading">
                <div><p className="eyebrow">Your Library</p><h2>{resources.length} Saved Resource{resources.length === 1 ? '' : 's'}</h2></div>
                <label className="resource-search"><span className="sr-only">Search your resources</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your library" /></label>
              </header>

              <details className="resource-filter-disclosure">
                <summary><span>Filter library</span><strong>{activeTypeLabel}</strong></summary>
                <div className="resource-filter-row" aria-label="Filter resources">
                  {resourceTypes.map((type) => {
                    const count = type.id === 'all' ? resources.length : Number(resourceCounts[type.id] || 0)
                    if (type.id !== 'all' && count === 0) return null
                    return <button type="button" key={type.id} className={activeType === type.id ? 'is-active' : ''} onClick={() => setActiveType(type.id)} aria-pressed={activeType === type.id}>{type.short}<span>{count}</span></button>
                  })}
                </div>
              </details>

              {filteredResources.length === 0 ? (
                <div className="resource-no-results"><strong>No resources match this view.</strong><p>Try another category or clear your search.</p><button type="button" onClick={() => { setActiveType('all'); setSearch('') }}>Show All Resources</button></div>
              ) : (
                <div className="resource-card-grid">
                  {filteredResources.map((resource, index) => {
                    const type = resource.resource_type || 'note'
                    const url = safeUrl(resource.resource_url)
                    return (
                      <article className={`resource-card is-${type}`} key={resource.id}>
                        <div className="resource-card-top"><span>{String(index + 1).padStart(2, '0')}</span><em>{resourceTypes.find((item) => item.id === type)?.short || 'Resource'}</em></div>
                        <div><p>{resourceTypeCopy[type] || 'Selected for your care'}</p><h3>{resource.title}</h3>{resource.description && <span>{resource.description}</span>}</div>
                        <footer><time>{formatDate(resource.created_at)}</time>{url ? <a href={url} target="_blank" rel="noreferrer">Open <span aria-hidden="true">↗</span></a> : <em>Private note</em>}</footer>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <p className="portal-private-footnote">Resources in this library are private to your client portal.</p>
          </>
        )}
      </div>
    </main>
  )
}

export default ClientPortalResources
