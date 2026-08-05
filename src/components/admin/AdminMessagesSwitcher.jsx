import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  getMyTeamAccess,
} from '../../lib/nativeApi.js'

const messageViews = [
  {
    id: 'conversations',
    label: 'Conversations',
    description: 'Private threads and replies',
    to: '/admin/inbox',
    module: 'inbox',
  },
  {
    id: 'encouragements',
    label: 'Encouragements',
    description: 'Portal notes and announcements',
    to: '/admin/encouragements',
    module: 'encouragements',
  },
  {
    id: 'email',
    label: 'Email Studio',
    description: 'One-to-one email and templates',
    to: '/admin/email-studio',
    module: 'communications',
  },
  {
    id: 'letters',
    label: 'Letters',
    description: 'Broadcasts, delivery, and results',
    to: '/admin/letters',
    module: 'communications',
  },
  {
    id: 'audience',
    label: 'Audience',
    description: 'Consent and delivery eligibility',
    to: '/admin/audience',
    module: 'communications',
  },
]

const viewByPath = Object.fromEntries(
  messageViews.map((view) => [view.to, view.id]),
)

function readCachedAdminUser() {
  try {
    return JSON.parse(
      window.sessionStorage.getItem('pwc_admin_user') || 'null',
    )
  } catch {
    return null
  }
}

export default function AdminMessagesSwitcher() {
  const location = useLocation()
  const navigate = useNavigate()
  const [adminUser] = useState(readCachedAdminUser)
  const [teamAccess, setTeamAccess] = useState(null)

  const isStaff = adminUser?.role === 'staff'

  useEffect(() => {
    let active = true

    if (!isStaff) {
      return () => {
        active = false
      }
    }

    getMyTeamAccess()
      .then((result) => {
        if (active) {
          setTeamAccess(
            result.access || {
              permissions: {},
            },
          )
        }
      })
      .catch(() => {
        if (active) {
          setTeamAccess({
            permissions: {},
          })
        }
      })

    return () => {
      active = false
    }
  }, [isStaff])

  const permissionsReady = !isStaff || teamAccess !== null

  const accessibleViews = useMemo(
    () => (
      isStaff
        ? messageViews.filter(
            (view) => (
              (
                teamAccess?.permissions?.[view.module]
                || 'none'
              ) !== 'none'
            ),
          )
        : messageViews
    ),
    [isStaff, teamAccess],
  )

  const requestedView = viewByPath[location.pathname] || 'conversations'

  const activeView = accessibleViews.some(
    (view) => view.id === requestedView,
  )
    ? requestedView
    : accessibleViews[0]?.id || ''

  useEffect(() => {
    if (
      !permissionsReady
      || !accessibleViews.length
      || activeView === requestedView
    ) {
      return
    }

    const safeView = accessibleViews.find(
      (view) => view.id === activeView,
    )

    if (safeView) {
      navigate(safeView.to, { replace: true })
    }
  }, [
    accessibleViews,
    activeView,
    navigate,
    permissionsReady,
    requestedView,
  ])

  function openView(view) {
    if (
      location.pathname === view.to
      && view.id === activeView
    ) {
      return
    }

    navigate(view.to)
  }

  return (
    <section
      className="pwc-messages55-switcher"
      aria-label="Messages workspace"
    >
      <div className="pwc-messages55-switcher-copy">
        <p className="admin-eyebrow">Messages</p>
        <strong>Every conversation in one place</strong>
        <span>
          Reply privately, encourage clients, prepare email,
          publish Letters, and protect audience consent
          without searching through separate tools.
        </span>
      </div>

      {!permissionsReady ? (
        <div
          className="pwc-messages55-access"
          role="status"
        >
          Checking message access...
        </div>
      ) : accessibleViews.length === 0 ? (
        <div
          className="pwc-messages55-access"
          role="status"
        >
          No Messages tools are assigned to this account.
        </div>
      ) : (
        <div
          className="pwc-messages55-tabs"
          role="tablist"
          aria-label="Message workspace views"
        >
          {accessibleViews.map((view) => {
            const selected = view.id === activeView

            return (
              <button
                key={view.id}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                className={selected ? 'is-active' : ''}
                onClick={() => openView(view)}
              >
                <strong>{view.label}</strong>
                <small>{view.description}</small>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
