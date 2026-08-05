import {
  lazy,
  Suspense,
} from 'react'
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame.jsx'

const AdminScheduler = lazy(
  () => import('./AdminScheduler.jsx'),
)

const AdminSessionReadiness = lazy(
  () => import('./AdminSessionReadiness.jsx'),
)

const AdminSessionFollowThrough = lazy(
  () => import('./AdminSessionFollowThrough.jsx'),
)

const AdminSessionChanges = lazy(
  () => import('./AdminSessionChangeRequests.jsx'),
)

const sessionViews = [
  {
    id: 'manage',
    label: 'Manage',
    description: 'Requests, types, and availability',
    to: '/admin/scheduler',
  },
  {
    id: 'readiness',
    label: 'Prepare',
    description: 'Get upcoming sessions ready',
    to: '/admin/scheduler?view=readiness',
  },
  {
    id: 'follow-through',
    label: 'Follow-Through',
    description: 'Complete care after sessions',
    to: '/admin/scheduler?view=follow-through',
  },
  {
    id: 'changes',
    label: 'Changes',
    description: 'Reschedules and cancellations',
    to: '/admin/scheduler?view=changes',
  },
]

const sessionViewIds = new Set(
  sessionViews.map((view) => view.id),
)

const legacyViewByPath = {
  '/admin/readiness': 'readiness',
  '/admin/follow-through': 'follow-through',
  '/admin/session-changes': 'changes',
}

function SessionsHubLoading() {
  return (
    <div
      className="pwc-sessions55-loading"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" />
      <strong>Opening the Sessions workspace…</strong>
    </div>
  )
}

export default function AdminSessionsHub() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const requestedView =
    searchParams.get('view')

  const activeView =
    legacyViewByPath[location.pathname]
    || (
      sessionViewIds.has(requestedView)
        ? requestedView
        : 'manage'
    )

  const activeDefinition =
    sessionViews.find(
      (view) => view.id === activeView,
    ) || sessionViews[0]

  function selectView(view) {
    if (
      view.id === activeView
      && location.pathname === '/admin/scheduler'
    ) {
      return
    }

    navigate(view.to)
  }

  let viewContent =
    <AdminScheduler embedded />

  if (activeView === 'readiness') {
    viewContent =
      <AdminSessionReadiness embedded />
  }

  if (activeView === 'follow-through') {
    viewContent =
      <AdminSessionFollowThrough embedded />
  }

  if (activeView === 'changes') {
    viewContent =
      <AdminSessionChanges embedded />
  }

  return (
    <AdminFrame>
      <div className="pwc-sessions55-hub">
        <section
          className="pwc-sessions55-switcher"
          aria-label="Sessions workspace"
        >
          <div className="pwc-sessions55-switcher-copy">
            <p className="admin-eyebrow">
              Sessions
            </p>
            <strong>
              Plan, prepare, and follow through
            </strong>
            <span>
              Review requests, protect availability,
              prepare upcoming sessions, and complete
              the care that follows.
            </span>
          </div>

          <div
            className="pwc-sessions55-tabs"
            role="tablist"
            aria-label="Session workspace views"
          >
            {sessionViews.map((view) => {
              const selected =
                activeView === view.id

              return (
                <button
                  key={view.id}
                  id={'sessions-hub-tab-' + view.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="sessions-hub-panel"
                  tabIndex={selected ? 0 : -1}
                  className={
                    selected ? 'is-active' : ''
                  }
                  onClick={() => selectView(view)}
                >
                  <strong>{view.label}</strong>
                  <small>{view.description}</small>
                </button>
              )
            })}
          </div>
        </section>

        <section
          id="sessions-hub-panel"
          className={
            'pwc-sessions55-panel is-'
            + activeView
          }
          role="tabpanel"
          aria-labelledby={
            'sessions-hub-tab-'
            + activeDefinition.id
          }
        >
          <Suspense
            fallback={<SessionsHubLoading />}
          >
            {viewContent}
          </Suspense>
        </section>
      </div>
    </AdminFrame>
  )
}
