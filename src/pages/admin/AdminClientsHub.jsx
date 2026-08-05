import {
  lazy,
  Suspense,
} from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame.jsx'

const AdminClientsDirectory = lazy(
  () => import('./AdminClients.jsx'),
)

const AdminClientMomentum = lazy(
  () => import('./AdminClientMomentum.jsx'),
)

const AdminClientCoverage = lazy(
  () => import('./AdminClientCoverage.jsx'),
)

const AdminClientContext = lazy(
  () => import('./AdminClient360.jsx'),
)

const clientViews = [
  {
    id: 'directory',
    label: 'Directory',
    description: 'Records and client profiles',
    to: '/admin/clients',
  },
  {
    id: 'momentum',
    label: 'Momentum',
    description: 'Care signals and next touches',
    to: '/admin/clients?view=momentum',
  },
  {
    id: 'coverage',
    label: 'Coverage',
    description: 'Ownership and handoffs',
    to: '/admin/clients?view=coverage',
  },
]

const clientViewIds = new Set(
  clientViews.map((view) => view.id),
)

function ClientsHubLoading() {
  return (
    <div
      className="pwc-clients55-loading"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" />
      <strong>Opening the client workspace…</strong>
    </div>
  )
}

export default function AdminClientsHub() {
  const location = useLocation()
  const navigate = useNavigate()
  const { clientId, section } = useParams()
  const [searchParams] = useSearchParams()

  const requestedView = searchParams.get('view')
  const isLegacyContext =
    location.pathname.startsWith('/admin/client-360/')
  const isContextView =
    Boolean(clientId)
    && (isLegacyContext || section === 'context')

  const activeView = isContextView
    ? 'context'
    : clientId
      ? 'directory'
      : clientViewIds.has(requestedView)
        ? requestedView
        : 'directory'

  const selectedTabView =
    activeView === 'context'
      ? 'directory'
      : activeView

  const activeDefinition = clientViews.find(
    (view) => view.id === selectedTabView,
  ) || clientViews[0]

  function selectView(view) {
    if (view.id === activeView && !clientId) return
    navigate(view.to)
  }

  let viewContent = <AdminClientsDirectory embedded />

  if (activeView === 'momentum') {
    viewContent = <AdminClientMomentum embedded />
  }

  if (activeView === 'coverage') {
    viewContent = <AdminClientCoverage embedded />
  }

  if (activeView === 'context') {
    viewContent = <AdminClientContext embedded />
  }

  return (
    <AdminFrame>
      <div className="pwc-clients55-hub">
        <section
          className="pwc-clients55-switcher"
          aria-label="Clients workspace"
        >
          <div className="pwc-clients55-switcher-copy">
            <p className="admin-eyebrow">Clients</p>
            <strong>Records and care signals in one place</strong>
            <span>
              Move between client profiles, momentum, and team
              coverage without searching through separate tools.
            </span>
          </div>

          <div
            className="pwc-clients55-tabs"
            role="tablist"
            aria-label="Client workspace views"
          >
            {clientViews.map((view) => {
              const selected = selectedTabView === view.id

              return (
                <button
                  key={view.id}
                  id={`clients-hub-tab-${view.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="clients-hub-panel"
                  tabIndex={selected ? 0 : -1}
                  className={selected ? 'is-active' : ''}
                  onClick={() => selectView(view)}
                >
                  <strong>{view.label}</strong>
                  <small>{view.description}</small>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            className="pwc-clients55-priorities"
            onClick={() => navigate('/admin/attention')}
          >
            Client priorities
          </button>
        </section>

        {isContextView && (
          <section
            className="pwc-clients55-context-bar"
            aria-label="Client context navigation"
          >
            <button
              type="button"
              onClick={() => navigate('/admin/clients')}
            >
              <span aria-hidden="true">←</span>
              Back to Directory
            </button>

            <div>
              <p className="admin-eyebrow">
                Client Context
              </p>
              <strong>
                Complete care plan and operational history
              </strong>
            </div>
          </section>
        )}

        <section
          id="clients-hub-panel"
          className={`pwc-clients55-panel is-${activeView}`}
          role="tabpanel"
          aria-labelledby={`clients-hub-tab-${activeDefinition.id}`}
        >
          <Suspense fallback={<ClientsHubLoading />}>
            {viewContent}
          </Suspense>
        </section>
      </div>
    </AdminFrame>
  )
}
