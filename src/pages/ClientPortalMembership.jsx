import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ClientPortalChrome from '../components/ClientPortalChrome.jsx'
import { getClientMemberships, getClientPortalDashboard, logoutClientPortal } from '../lib/nativeApi.js'
import './ClientPortalWorkspace.css'
import './ClientPortalLearningMembership.css'

function readable(value) {
  const text = String(value || '').replaceAll('_', ' ').trim().toLowerCase()
  return text ? text.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Active'
}

function formatDate(value, empty = 'Not scheduled') {
  if (!value) return empty
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long',
      timeZone: 'America/New_York',
    }).format(new Date(value))
  } catch {
    return empty
  }
}

function formatPrice(cents, currency = 'USD', interval = null) {
  if (cents === null || cents === undefined) return 'Included in your care plan'
  try {
    const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(Number(cents) / 100)
    const intervals = { one_time: 'one time', monthly: 'per month', quarterly: 'per quarter', yearly: 'per year' }
    return interval ? `${amount} ${intervals[interval] || ''}`.trim() : amount
  } catch {
    return `${Number(cents) / 100} ${currency}`
  }
}

function safeUrl(value) {
  if (!value) return ''
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
  if (/failed to fetch|network|load failed/i.test(message)) return 'We could not reach your membership space. Please check the backend connection and try again.'
  return message || 'Your membership could not open yet.'
}

function ClientPortalMembership() {
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [activeMembershipId, setActiveMembershipId] = useState('')
  const [featureEnabled, setFeatureEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.body.classList.add('client-workspace-mode')
    return () => document.body.classList.remove('client-workspace-mode')
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([getClientPortalDashboard(), getClientMemberships()])
      .then(([dashboardResponse, membershipResponse]) => {
        if (!active) return
        setClient(dashboardResponse.client || null)
        const loadedMemberships = membershipResponse.memberships || []
        setMemberships(loadedMemberships)
        setActiveMembershipId(loadedMemberships[0]?.id || '')
        setFeatureEnabled(membershipResponse.featureEnabled !== false)
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

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logoutClientPortal()
    } finally {
      navigate('/client-portal/login', { replace: true })
    }
  }

  const activeMembership = useMemo(
    () => memberships.find((membership) => membership.id === activeMembershipId) || memberships[0] || null,
    [activeMembershipId, memberships],
  )

  return (
    <main id="main-content" className="portal-workspace portal-membership-page">
      <ClientPortalChrome client={client} loggingOut={loggingOut} onLogout={handleLogout} />

      <div className="portal-workspace-inner">
        <header className="portal-page-intro membership-page-intro">
          <p className="eyebrow">Membership</p>
          <h1>Everything included with your membership.</h1>
          <p>Check access, open a benefit, or continue into Learning and The Circle.</p>
        </header>

        {error && <div className="portal-notice is-error" role="alert">{error}</div>}

        {loading ? (
          <div className="portal-loading" role="status">Preparing your membership space…</div>
        ) : !featureEnabled ? (
          <section className="membership-empty-state"><p className="eyebrow">Membership Circle</p><h2>Memberships are taking a quiet pause.</h2><p>Power Within will make your membership experience available again when it is ready.</p></section>
        ) : memberships.length === 0 ? (
          <section className="membership-empty-state"><p className="eyebrow">Your Membership</p><h2>No active membership is connected yet.</h2><p>When Power Within adds you to an active membership, your benefits, resources, learning, renewal details, and private updates will appear here.</p></section>
        ) : (
          <div className="membership-list">
            {memberships.length > 1 && (
              <nav className="membership-switcher" aria-label="Your memberships">
                {memberships.map((membership) => (
                  <button key={membership.id} type="button" className={membership.id === activeMembership?.id ? 'is-active' : ''} aria-pressed={membership.id === activeMembership?.id} onClick={() => setActiveMembershipId(membership.id)}>
                    <span>{readable(membership.enrollment_status)}</span><strong>{membership.name}</strong>
                  </button>
                ))}
              </nav>
            )}

            {memberships.filter((membership) => membership.id === activeMembership?.id).map((membership) => (
              <article className="membership-experience" key={membership.id}>
                <header className="membership-hero">
                  <div><p className="eyebrow">Active Membership</p><span>{membership.tagline || 'A private space for continued growth and belonging.'}</span><h2>{membership.name}</h2><p>{membership.description || membership.welcome_message || 'Your continuing Power Within experience.'}</p></div>
                  <div className="membership-hero-status"><span>{readable(membership.enrollment_status)}</span><strong>{formatPrice(membership.price_cents, membership.currency, membership.billing_interval)}</strong><small>Membership access is active</small></div>
                </header>

                {membership.welcome_message && (
                  <section className="membership-welcome"><p className="eyebrow">A Note For You</p><h3>Welcome to your circle.</h3><p>{membership.welcome_message}</p></section>
                )}

                <section className="membership-dates" aria-label="Membership dates">
                  <article><span>Member Since</span><strong>{formatDate(membership.started_at, 'Membership start not recorded')}</strong></article>
                  <article><span>Next Renewal</span><strong>{formatDate(membership.renewal_at)}</strong></article>
                  <article><span>Access Through</span><strong>{formatDate(membership.ends_at, 'Ongoing')}</strong></article>
                </section>

                {Array.isArray(membership.benefits) && membership.benefits.length > 0 && (
                  <details className="membership-section membership-disclosure" open>
                    <summary><div><p className="eyebrow">Your Benefits</p><h3>What is included</h3></div><span>{membership.benefits.length} benefit{membership.benefits.length === 1 ? '' : 's'}</span></summary>
                    <div className="membership-disclosure-body"><ul className="membership-benefits">{membership.benefits.map((benefit, index) => <li key={benefit}><span>{String(index + 1).padStart(2, '0')}</span><p>{benefit}</p></li>)}</ul></div>
                  </details>
                )}

                {(membership.resources || []).length > 0 && (
                  <details className="membership-section membership-disclosure">
                    <summary><div><p className="eyebrow">Member Resources</p><h3>Private resources</h3></div><span>{membership.resources.length} saved</span></summary>
                    <div className="membership-disclosure-body membership-resource-grid">
                      {membership.resources.map((resource) => {
                        const url = safeUrl(resource.resource_url)
                        return <article key={resource.id}><span>{readable(resource.resource_type)}</span><h4>{resource.title}</h4><p>{resource.description || 'A private resource selected for members.'}</p>{url ? <a href={url} target="_blank" rel="noreferrer">Open Resource <span aria-hidden="true">↗</span></a> : <em>Private member note</em>}</article>
                      })}
                    </div>
                  </details>
                )}

                {(membership.courses || []).length > 0 && (
                  <details className="membership-section membership-disclosure">
                    <summary><div><p className="eyebrow">Member Learning</p><h3>Included programs</h3></div><span>{membership.courses.length} program{membership.courses.length === 1 ? '' : 's'}</span></summary>
                    <div className="membership-disclosure-body"><Link className="membership-disclosure-link" to="/client-portal/learning">Open Learning Library</Link><div className="membership-course-grid">
                      {membership.courses.map((course) => <article key={course.id}><span>{course.category || 'Personal Growth'}</span><h4>{course.title}</h4><p>{course.description || 'A guided member learning experience.'}</p><small>{course.estimated_minutes || 30} minutes</small></article>)}
                    </div></div>
                  </details>
                )}

                {(membership.announcements || []).length > 0 && (
                  <details className="membership-section membership-disclosure membership-updates-section">
                    <summary><div><p className="eyebrow">Circle Updates</p><h3>Membership notes</h3></div><span>{membership.announcements.length} update{membership.announcements.length === 1 ? '' : 's'}</span></summary>
                    <div className="membership-disclosure-body"><Link className="membership-disclosure-link" to="/client-portal/circle">Enter The Circle</Link><div className="membership-updates">
                      {membership.announcements.map((announcement) => <article key={announcement.id}><time>{formatDate(announcement.published_at, 'Recent update')}</time><h4>{announcement.title}</h4><p>{announcement.body}</p></article>)}
                    </div></div>
                  </details>
                )}

                <footer className="membership-community-cta"><div><p className="eyebrow">Your Community</p><h3>Continue the conversation in The Circle.</h3><p>Return to private reflections, encouragement, and honest conversation with fellow members.</p></div><Link to="/client-portal/circle">Enter The Circle</Link></footer>
              </article>
            ))}
            <p className="portal-private-footnote">Membership details are private to your client portal.</p>
          </div>
        )}
      </div>
    </main>
  )
}

export default ClientPortalMembership
