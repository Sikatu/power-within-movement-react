import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame.jsx'
import { getMyTeamAccess } from '../../lib/nativeApi.js'

const operationsLanes = [
  {
    id: 'plan',
    mark: '01',
    label: 'Plan the work',
    description: 'Start with today, balance the week, then check team capacity.',
    tools: [
      { to: '/admin/brief', label: 'Today in The Studio', description: 'Priorities, sessions, and unread activity for today.', module: 'dashboard' },
      { to: '/admin/week', label: 'Studio Week Planner', description: 'Place sessions and accountable work across the week.', module: 'dashboard' },
      { to: '/admin/capacity', label: 'Studio Capacity', description: 'See workload, availability, and work without an owner.', module: 'dashboard' },
    ],
  },
  {
    id: 'care',
    mark: '02',
    label: 'Protect client care',
    description: 'Find stalled journeys, ownership gaps, and follow-up that cannot slip.',
    tools: [
      { to: '/admin/attention', label: 'Attention Queue', description: 'Own, schedule, update, and complete active follow-up.', module: 'clients' },
      { to: '/admin/momentum', label: 'Client Momentum', description: 'Review the next human touch across client journeys.', module: 'clients' },
      { to: '/admin/coverage', label: 'Coverage & Handoffs', description: 'Keep care covered through availability and team changes.', module: 'clients' },
    ],
  },
  {
    id: 'sessions',
    mark: '03',
    label: 'Complete the session loop',
    description: 'Prepare before a session and secure continuity afterward.',
    tools: [
      { to: '/admin/readiness', label: 'Session Readiness', description: 'Resolve decisions, intake, preparation, and confirmation.', module: 'sessions' },
      { to: '/admin/follow-through', label: 'Session Follow-Through', description: 'Close notes, next steps, resources, and care actions.', module: 'sessions' },
    ],
  },
  {
    id: 'history',
    mark: '04',
    label: 'Review what changed',
    description: 'Use the calm activity feed first; open the protected journal for formal history.',
    tools: [
      { to: '/admin/activity', label: 'Studio Activity', description: 'Role-aware updates, priority changes, and recent movement.', module: 'dashboard' },
      { to: '/admin/audit-log', label: 'Activity Journal', description: 'Protected operational history for accountable review.', module: 'audit' },
    ],
  },
]

function readCachedUser() {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(window.sessionStorage.getItem('pwc_admin_user') || 'null')
  } catch {
    return null
  }
}

export default function AdminOperationsCenter() {
  const [adminUser] = useState(readCachedUser)
  const [permissions, setPermissions] = useState(() => (adminUser?.role === 'staff' ? null : {}))
  const [error, setError] = useState('')

  useEffect(() => {
    if (adminUser?.role !== 'staff') return undefined
    let active = true

    getMyTeamAccess()
      .then((response) => {
        if (active) setPermissions(response.access?.permissions || {})
      })
      .catch((loadError) => {
        if (!active) return
        setPermissions({})
        setError(loadError.message || 'Your Operations access could not be confirmed.')
      })

    return () => {
      active = false
    }
  }, [adminUser?.role])

  const visibleLanes = useMemo(() => operationsLanes
    .map((lane) => ({
      ...lane,
      tools: lane.tools.filter((tool) => (
        adminUser?.role !== 'staff'
        || (permissions?.[tool.module] || 'none') !== 'none'
      )),
    }))
    .filter((lane) => lane.tools.length > 0), [adminUser?.role, permissions])

  const availableTools = visibleLanes.reduce((total, lane) => total + lane.tools.length, 0)
  const availablePaths = new Set(visibleLanes.flatMap((lane) => lane.tools.map((tool) => tool.to)))
  const recommendedTools = [
    { to: '/admin/brief', label: 'Orient to today', description: 'See what matters now' },
    { to: '/admin/attention', label: 'Resolve active care', description: 'Own the next action' },
    { to: '/admin/activity', label: 'Confirm movement', description: 'Review what changed' },
  ].filter((tool) => availablePaths.has(tool.to))
  const opening = permissions === null

  return (
    <AdminFrame>
      <section className="pwc-ops36-page">
        <header className="pwc-ops36-hero">
          <div>
            <p className="admin-eyebrow">Studio Operations</p>
            <h1>One clear path through the work.</h1>
            <p>Choose the outcome you need. Every detailed workspace remains available without crowding the Studio navigation.</p>
          </div>
          <aside aria-label="Operations workspace summary">
            <span>Focus lanes</span>
            <strong>{visibleLanes.length || 4}</strong>
            <small>{opening ? 'Confirming access…' : `${availableTools} available tools`}</small>
          </aside>
        </header>

        {error && <div className="pwc-ops36-notice" role="alert">{error}</div>}

        <section className="pwc-ops36-start" aria-label="Recommended Operations path">
          <div><p className="admin-eyebrow">Recommended Path</p><h2>Start broad, then act on the exception.</h2></div>
          <ol>
            {recommendedTools.map((tool, index) => <li key={tool.to}><Link to={tool.to}><span>{index + 1}</span><strong>{tool.label}</strong><small>{tool.description}</small></Link></li>)}
          </ol>
        </section>

        <section className="pwc-ops36-lanes" aria-label="Operations focus lanes">
          {opening ? (
            <div className="pwc-ops36-loading">Opening your Operations tools…</div>
          ) : visibleLanes.map((lane) => (
            <article className="pwc-ops36-lane" key={lane.id}>
              <header><span>{lane.mark}</span><div><h2>{lane.label}</h2><p>{lane.description}</p></div></header>
              <div>
                {lane.tools.map((tool, index) => (
                  <Link to={tool.to} key={tool.to}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div><strong>{tool.label}</strong><small>{tool.description}</small></div>
                    <b aria-hidden="true">→</b>
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </section>
      </section>
    </AdminFrame>
  )
}
