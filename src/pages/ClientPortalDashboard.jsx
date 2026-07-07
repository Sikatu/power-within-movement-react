import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  getClientPortalDashboard,
  getClientPortalResources,
  logoutClientPortal,
} from '../lib/nativeApi'

const resourceTypeLabels = {
  guide: 'Guides',
  worksheet: 'Worksheets',
  link: 'Links',
  video: 'Videos',
  reminder: 'Reminders',
  note: 'Notes',
}

const resourceTypeDescriptions = {
  guide: 'Curated direction and supportive references.',
  worksheet: 'Reflective exercises and guided prompts.',
  link: 'Helpful links selected for your journey.',
  video: 'Watchable resources and visual guidance.',
  reminder: 'Gentle reminders and next-step cues.',
  note: 'Personal notes and care-based references.',
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled'

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return 'Invalid date'
  }
}

function formatDate(value) {
  if (!value) return 'No date'

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
    }).format(new Date(value))
  } catch {
    return 'Invalid date'
  }
}

function formatLabel(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .trim()
    .toLowerCase()
}

function getResourceTypeLabel(type) {
  return resourceTypeLabels[type] || 'Resources'
}

function getResourceDescription(type) {
  return resourceTypeDescriptions[type] || 'Resources selected for your care.'
}

function groupResourcesByType(resources) {
  return resources.reduce((groups, resource) => {
    const type = resource.resource_type || 'note'

    if (!groups[type]) groups[type] = []

    groups[type].push(resource)

    return groups
  }, {})
}

export default function ClientPortalDashboard() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [resources, setResources] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.body.classList.add('client-portal-mode')

    return () => {
      document.body.classList.remove('client-portal-mode')
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      try {
        setIsLoading(true)
        setError('')

        const [dashboardResponse, resourcesResponse] = await Promise.all([
          getClientPortalDashboard(),
          getClientPortalResources().catch(() => ({ resources: [] })),
        ])

        if (!isMounted) return

        setDashboard(dashboardResponse)
        setResources(resourcesResponse.resources || [])
      } catch (loadError) {
        if (!isMounted) return

        setError(loadError.message || 'Unable to load your client portal.')

        const lowerMessage = String(loadError.message || '').toLowerCase()

        if (
          lowerMessage.includes('login required') ||
          lowerMessage.includes('unauthorized') ||
          lowerMessage.includes('401')
        ) {
          navigate('/client-portal/login', { replace: true })
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [navigate])

  const client = dashboard?.client

  const visibleNotes = useMemo(
    () => dashboard?.visibleNotes || [],
    [dashboard],
  )

  const serviceRecords = useMemo(
    () => dashboard?.serviceRecords || [],
    [dashboard],
  )

  const followUps = useMemo(
    () => dashboard?.followUps || [],
    [dashboard],
  )

  const bookings = useMemo(
    () => dashboard?.bookings || [],
    [dashboard],
  )

  const stats = useMemo(
    () => dashboard?.stats || {},
    [dashboard],
  )

  const nextFollowUps = useMemo(
    () =>
      [...followUps]
        .sort(
          (a, b) =>
            new Date(a.follow_up_at || a.updated_at || a.created_at) -
            new Date(b.follow_up_at || b.updated_at || b.created_at),
        )
        .slice(0, 4),
    [followUps],
  )

  const latestVisibleNotes = useMemo(
    () => visibleNotes.slice(0, 3),
    [visibleNotes],
  )

  const latestBookings = useMemo(
    () => bookings.slice(0, 5),
    [bookings],
  )

  const resourceGroups = useMemo(
    () => groupResourcesByType(resources),
    [resources],
  )

  const resourceCategories = useMemo(
    () =>
      Object.entries(resourceGroups)
        .map(([type, items]) => ({
          type,
          label: getResourceTypeLabel(type),
          description: getResourceDescription(type),
          items,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [resourceGroups],
  )

  const featuredResource = resources[0] || null

  async function handleLogout() {
    setIsLoggingOut(true)

    try {
      await logoutClientPortal()
      navigate('/client-portal/login')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <main className="client-portal-dashboard-page-v1">
      <section className="client-portal-dashboard-shell-v1">
        <header className="client-portal-dashboard-hero-v2">
          <div>
            <p className="eyebrow">Power Within Client Portal</p>
            <h1>Welcome, {client?.firstName || 'there'}.</h1>
            <p>
              Your private care space for shared notes, resources, reminders,
              and session history.
            </p>
          </div>

          <div className="client-portal-dashboard-actions-v1">
            <Link to="/">Power Within Website</Link>
            <button type="button" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="client-portal-dashboard-message-v1">
            Loading your private portal...
          </div>
        ) : error ? (
          <div className="client-portal-dashboard-message-v1 is-error">
            {error}
          </div>
        ) : (
          <>
            <section className="client-portal-overview-v2">
              <article className="client-portal-focus-v2">
                <p className="eyebrow">Today Portal Focus</p>
                <h2>
                  {resources.length > 0
                    ? 'Begin with your resource library.'
                    : 'Your care space is ready.'}
                </h2>
                <p>
                  {resources.length > 0
                    ? 'Review your assigned guides, notes, and next steps whenever you need a grounded reset.'
                    : 'Your shared notes, resources, and reminders will appear here as they are prepared.'}
                </p>
              </article>

              <div className="client-portal-metrics-v2">
                <article>
                  <span>Visible Notes</span>
                  <strong>{stats.visibleNotes || 0}</strong>
                  <p>Shared from your care record.</p>
                </article>

                <article>
                  <span>Resources</span>
                  <strong>{resources.length}</strong>
                  <p>Guides, links, notes, and reminders.</p>
                </article>

                <article>
                  <span>Sessions</span>
                  <strong>{stats.bookings || 0}</strong>
                  <p>Connected session history.</p>
                </article>

                <article>
                  <span>Follow-Ups</span>
                  <strong>{stats.followUps || 0}</strong>
                  <p>Gentle next-step reminders.</p>
                </article>
              </div>
            </section>

            {featuredResource && (
              <section className="client-portal-featured-resource-v2">
                <div>
                  <p className="eyebrow">Featured Resource</p>
                  <h2>{featuredResource.title}</h2>
                  <p>
                    {featuredResource.description ||
                      'A resource selected for your current client care journey.'}
                  </p>
                </div>

                <div className="client-portal-featured-resource-meta-v2">
                  <span>{formatLabel(featuredResource.resource_type)}</span>
                  <time>{formatDate(featuredResource.created_at)}</time>

                  {featuredResource.resource_url ? (
                    <a
                      href={featuredResource.resource_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Resource
                    </a>
                  ) : (
                    <em>No link attached</em>
                  )}
                </div>
              </section>
            )}

            <section className="client-portal-panel-v1 client-portal-resource-panel-v2">
              <div className="client-portal-panel-heading-v1">
                <p className="eyebrow">Resources</p>
                <h2>Your Library</h2>
              </div>

              {resources.length === 0 ? (
                <p className="client-portal-empty-v1">
                  No resources have been assigned yet. When Power Within shares a guide, worksheet, link, or note, it will appear here.
                </p>
              ) : (
                <div className="client-portal-resource-categories-v2">
                  {resourceCategories.map((category) => (
                    <article key={category.type}>
                      <div className="client-portal-resource-category-heading-v2">
                        <div>
                          <span>{category.items.length} saved</span>
                          <h3>{category.label}</h3>
                          <p>{category.description}</p>
                        </div>
                      </div>

                      <div className="client-portal-resource-stack-v2">
                        {category.items.map((resource) => (
                          <div key={resource.id}>
                            <strong>{resource.title}</strong>
                            <p>
                              {resource.description ||
                                'Resource saved for your portal.'}
                            </p>

                            <div>
                              <time>{formatDate(resource.created_at)}</time>

                              {resource.resource_url ? (
                                <a
                                  href={resource.resource_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open
                                </a>
                              ) : (
                                <em>No link</em>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="client-portal-dashboard-grid-v1">
              <article className="client-portal-panel-v1 is-large">
                <div className="client-portal-panel-heading-v1">
                  <p className="eyebrow">Client Notes</p>
                  <h2>Shared With You</h2>
                </div>

                {latestVisibleNotes.length === 0 ? (
                  <p className="client-portal-empty-v1">
                    No client-visible notes have been shared yet. Shared reflections and care notes will appear here after they are prepared.
                  </p>
                ) : (
                  <div className="client-portal-note-list-v1">
                    {latestVisibleNotes.map((record) => (
                      <article key={record.id}>
                        <span>{formatLabel(record.service_type)}</span>
                        <h3>{record.title || record.service_name}</h3>
                        <p>{record.client_visible_notes}</p>
                        <time>{formatDateTime(record.service_date)}</time>
                      </article>
                    ))}
                  </div>
                )}
              </article>

              <aside className="client-portal-side-stack-v1">
                <article className="client-portal-panel-v1">
                  <div className="client-portal-panel-heading-v1">
                    <p className="eyebrow">Follow-Up</p>
                    <h2>Next Steps</h2>
                  </div>

                  {nextFollowUps.length === 0 ? (
                    <p className="client-portal-empty-v1">
                      No follow-up reminders are active right now. Any next steps shared by Power Within will appear here.
                    </p>
                  ) : (
                    <div className="client-portal-mini-list-v1">
                      {nextFollowUps.map((record) => (
                        <article key={record.id}>
                          <strong>{record.title || record.service_name}</strong>
                          <span>{formatDateTime(record.follow_up_at)}</span>
                        </article>
                      ))}
                    </div>
                  )}
                </article>

                <article className="client-portal-panel-v1">
                  <div className="client-portal-panel-heading-v1">
                    <p className="eyebrow">Sessions</p>
                    <h2>History</h2>
                  </div>

                  {latestBookings.length === 0 ? (
                    <p className="client-portal-empty-v1">
                      No sessions are connected to your portal yet. Once a session is connected to your profile, it will appear here.
                    </p>
                  ) : (
                    <div className="client-portal-mini-list-v1">
                      {latestBookings.map((booking) => (
                        <article key={booking.id}>
                          <strong>
                            {booking.appointment_type_name || 'Session'}
                          </strong>
                          <span>
                            {formatDateTime(booking.starts_at)} - {' '}
                            {formatLabel(booking.status)}
                          </span>
                        </article>
                      ))}
                    </div>
                  )}
                </article>
              </aside>
            </section>

            <section className="client-portal-panel-v1">
              <div className="client-portal-panel-heading-v1">
                <p className="eyebrow">Care Record</p>
                <h2>Recent Service History</h2>
              </div>

              {serviceRecords.length === 0 ? (
                <p className="client-portal-empty-v1">
                  No service records are connected yet. Your care history will begin appearing here as your client record grows.
                </p>
              ) : (
                <div className="client-portal-record-table-v1">
                  {serviceRecords.slice(0, 8).map((record) => (
                    <article key={record.id}>
                      <span>{formatLabel(record.service_type)}</span>
                      <strong>{record.title || record.service_name}</strong>
                      <em>{formatLabel(record.status)}</em>
                      <time>{formatDateTime(record.service_date)}</time>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  )
}