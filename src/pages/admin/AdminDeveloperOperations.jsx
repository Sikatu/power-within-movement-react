import { useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame'
import AdminDeveloperPanel from './AdminDeveloperPanel.jsx'
import AdminDeveloperErrors from './AdminDeveloperErrors.jsx'
import AdminDeveloperMonitoringConfiguration from './AdminDeveloperMonitoringConfiguration.jsx'
import AdminSecurityIntegrity from './AdminSecurityIntegrity.jsx'
import AdminReleaseQa from './AdminReleaseQa.jsx'

const sections = [
  {
    id: 'overview',
    code: '01',
    icon: '⌂',
    label: 'Overview',
    description: 'Platform totals, live health, previews, and direct paths into critical Studio workspaces.',
  },
  {
    id: 'health',
    code: '02',
    icon: '◌',
    label: 'System Health',
    description: 'Database, application, memory, email, and runtime health in one focused technical view.',
  },
  {
    id: 'errors',
    code: '03',
    icon: '!',
    label: 'Errors',
    description: 'Detected issues, technical context, status decisions, and monitoring policy.',
    legacyPath: '/admin/developer/errors',
  },
  {
    id: 'integrity',
    code: '04',
    icon: '✓',
    label: 'Security & Integrity',
    description: 'Privileged access, permission, request-trust, and operational data checks.',
    legacyPath: '/admin/developer/integrity',
  },
  {
    id: 'qa',
    code: '05',
    icon: '◇',
    label: 'Release Gate',
    description: 'Phase 30 contracts, production-shaped readiness, external evidence, and rollback verification.',
    legacyPath: '/admin/developer/qa',
  },
  {
    id: 'access',
    code: '06',
    icon: '◎',
    label: 'Accounts & Access',
    description: 'Identity governance, client access diagnosis, temporary credentials, and session control.',
  },
  {
    id: 'configuration',
    code: '07',
    icon: '⚙',
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
  if (section === 'configuration') return (
    <>
      <AdminDeveloperPanel embedded mode="configuration" />
      <AdminDeveloperMonitoringConfiguration />
    </>
  )
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
          <div className="developer-operations-hero-copy">
            <div className="developer-operations-kicker">
              <span className="developer-operations-live-dot" aria-hidden="true" />
              Private developer command center
            </div>
            <h1>Developer Operations</h1>
            <p>
              Diagnose platform health, govern access, investigate failures, and prepare releases
              from one technical workspace designed for fast, confident decisions.
              Legacy Developer routes now open their matching section here.
            </p>
            <div className="developer-operations-meta" aria-label="Workspace characteristics">
              <span><strong>7</strong> operational views</span>
              <span><strong>Read-only</strong> audit tools</span>
              <span><strong>Protected</strong> developer access</span>
            </div>
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
              <span className="developer-operations-nav-icon" aria-hidden="true">{section.icon}</span>
              <span className="developer-operations-nav-copy">
                <small>{section.code}</small>
                <strong>{section.label}</strong>
              </span>
            </button>
          ))}
        </nav>

        <section className="developer-operations-section-heading" aria-live="polite">
          <span className="developer-operations-section-index" aria-hidden="true">{activeDefinition.code}</span>
          <div>
            <p className="admin-eyebrow">Current operation</p>
            <h2>{activeDefinition.label}</h2>
            <p>{activeDefinition.description}</p>
          </div>
          {activeDefinition.legacyPath && (
            <code>{activeDefinition.legacyPath}</code>
          )}
        </section>

        <div className={`developer-operations-content is-${activeSection}`}>
          <SectionContent key={activeSection} section={activeSection} />
        </div>
      </div>
    </AdminFrame>
  )
}
