import { useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame'
import AdminDeveloperPanel from './AdminDeveloperPanel.jsx'
import AdminDeveloperErrors from './AdminDeveloperErrors.jsx'
import AdminSecurityIntegrity from './AdminSecurityIntegrity.jsx'
import AdminReleaseQa from './AdminReleaseQa.jsx'

const sections = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Platform totals, previews, and the fastest paths into active Studio workspaces.',
  },
  {
    id: 'health',
    label: 'System Health',
    description: 'Database, application, memory, email, and runtime health in one focused view.',
  },
  {
    id: 'errors',
    label: 'Errors',
    description: 'Detected issues, technical context, status decisions, and monitoring policy.',
    legacyPath: '/admin/developer/errors',
  },
  {
    id: 'integrity',
    label: 'Security & Integrity',
    description: 'Privileged access, permission, request-trust, and operational data checks.',
    legacyPath: '/admin/developer/integrity',
  },
  {
    id: 'qa',
    label: 'Release QA',
    description: 'Read-only contract, latency, density, and responsive release verification.',
    legacyPath: '/admin/developer/qa',
  },
  {
    id: 'access',
    label: 'Accounts & Access',
    description: 'Account governance, client access diagnosis, temporary credentials, and session control.',
  },
  {
    id: 'configuration',
    label: 'Configuration',
    description: 'Feature flags, maintenance controls, monitoring behavior, and platform settings.',
  },
]

const sectionIds = new Set(sections.map((section) => section.id))

function resolveSection(pathname, search) {
  if (pathname.endsWith('/errors')) return 'errors'
  if (pathname.endsWith('/integrity')) return 'integrity'
  if (pathname.endsWith('/qa')) return 'qa'

  const requested = new URLSearchParams(search).get('section')
  return sectionIds.has(requested) ? requested : 'overview'
}

function SectionContent({ section }) {
  if (section === 'health') return <AdminDeveloperPanel embedded mode="health" />
  if (section === 'errors') return <AdminDeveloperErrors embedded />
  if (section === 'integrity') return <AdminSecurityIntegrity embedded />
  if (section === 'qa') return <AdminReleaseQa embedded />
  if (section === 'access') return <AdminDeveloperPanel embedded mode="access" />
  if (section === 'configuration') return <AdminDeveloperPanel embedded mode="configuration" />
  return <AdminDeveloperPanel embedded mode="overview" />
}

export default function AdminDeveloperOperations() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeSection = resolveSection(location.pathname, location.search)
  const activeDefinition = useMemo(
    () => sections.find((section) => section.id === activeSection) || sections[0],
    [activeSection],
  )

  function openSection(section) {
    navigate(`/admin/developer?section=${section.id}`)
  }

  return (
    <AdminFrame>
      <div className="developer-operations-page">
        <header className="developer-operations-hero">
          <div>
            <p className="admin-eyebrow">Developer-only workspace</p>
            <h1>Developer Operations</h1>
            <p>
              Operate, diagnose, secure, and release the platform from one focused technical workspace.
              Each section keeps the important data visible without overwhelming the screen.
            </p>
          </div>
          <div className="developer-operations-hero-actions">
            <Link className="btn secondary" to="/admin/audit-log">Activity Journal</Link>
            <Link className="btn primary" to="/admin/dashboard">Open The Studio</Link>
          </div>
        </header>

        <nav className="developer-operations-nav" aria-label="Developer Operations sections" role="tablist">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={activeSection === section.id}
              className={activeSection === section.id ? 'is-active' : ''}
              onClick={() => openSection(section)}
            >
              <span>{section.label}</span>
              <small>{section.description}</small>
            </button>
          ))}
        </nav>

        <section className="developer-operations-section-heading" aria-live="polite">
          <div>
            <p className="admin-eyebrow">Current section</p>
            <h2>{activeDefinition.label}</h2>
            <p>{activeDefinition.description}</p>
          </div>
          {activeDefinition.legacyPath && (
            <span>Deep link: {activeDefinition.legacyPath}</span>
          )}
        </section>

        <div className={`developer-operations-content is-${activeSection}`}>
          <SectionContent key={activeSection} section={activeSection} />
        </div>
      </div>
    </AdminFrame>
  )
}
