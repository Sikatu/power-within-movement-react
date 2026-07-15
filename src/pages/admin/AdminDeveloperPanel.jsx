import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame'
import { acquireAdminScrollLock } from '../../components/admin/adminScrollLock.js'
import { useAdminConfirm } from '../../components/admin/AdminConfirmContext'
import {
  applyDeveloperAccountCleanup,
  createDeveloperManagedUser,
  getDeveloperAccountGovernance,
  getDeveloperClientAccess,
  getDeveloperClientPreview,
  getDeveloperFounderPreview,
  getDeveloperOverview,
  getDeveloperSettings,
  getDeveloperSystemHealth,
  getDeveloperUsers,
  issueDeveloperTemporaryPassword,
  logoutAdmin,
  previewDeveloperAccountCleanup,
  reconcileDeveloperAccountGovernance,
  revokeDeveloperUserSessions,
  saveDeveloperPermanentAdmin,
  updateDeveloperSettings,
  updateDeveloperUserRole,
  updateDeveloperUserStatus,
} from '../../lib/nativeApi'


const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'clients', label: 'Client Access' },
  { id: 'controls', label: 'Controls' },
  { id: 'security', label: 'Security' },
]

const roleOptions = ['developer', 'owner', 'admin', 'staff']
const createRoleOptions = ['admin', 'staff']

const featureFlagLabels = {
  clientMessages: 'Client Messages',
  secureClientInbox: 'Secure Client Inbox',
  courses: 'Learning Library',
  memberships: 'Memberships',
  circleCommunity: 'The Circle Community',
  founderReports: 'Founder Reports',
  adminBroadcasts: 'Admin Broadcasts',
  newClientDashboard: 'New Client Dashboard',
  experimentalScheduler: 'Experimental Scheduler',
}

function formatDateTime(value) {
  if (!value) return 'Never'

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return 'Unknown'
  }
}

function formatDuration(totalSeconds) {
  const seconds = Number(totalSeconds || 0)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatBytes(value) {
  const bytes = Number(value || 0)
  if (!bytes) return '0 MB'
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function readable(value) {
  return String(value || 'unknown')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function displayName(user) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  return fullName || user.email
}

function clientName(client) {
  return [client.first_name, client.last_name].filter(Boolean).join(' ').trim() ||
    client.email ||
    client.public_contact_email ||
    'Client'
}

function HealthBadge({ state, children }) {
  return (
    <span className={`developer-health-badge is-${state}`}>
      {children}
    </span>
  )
}

export default function AdminDeveloperPanel() {
  const confirmAction = useAdminConfirm()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [users, setUsers] = useState([])
  const [clients, setClients] = useState([])
  const [health, setHealth] = useState(null)
  const [settings, setSettings] = useState(null)
  const [governance, setGovernance] = useState(null)
  const [selectedAdminId, setSelectedAdminId] = useState('')
  const [cleanupPreview, setCleanupPreview] = useState(null)
  const [cleanupConfirmation, setCleanupConfirmation] = useState('')
  const [isGovernanceBusy, setIsGovernanceBusy] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [busyUserId, setBusyUserId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [credential, setCredential] = useState(null)
  const [accountSearch, setAccountSearch] = useState('')
  const [accountRoleFilter, setAccountRoleFilter] = useState('all')
  const [clientSearch, setClientSearch] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewLoadingKey, setPreviewLoadingKey] = useState('')
  const [isClientPreviewPickerOpen, setIsClientPreviewPickerOpen] = useState(false)
  const [previewClientSearch, setPreviewClientSearch] = useState('')
  const [createForm, setCreateForm] = useState({
    email: '',
    role: 'admin',
    expirationHours: 48,
  })

  const loadPanel = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const [
        overviewResult,
        usersResult,
        clientsResult,
        healthResult,
        settingsResult,
        governanceResult,
      ] = await Promise.all([
        getDeveloperOverview(),
        getDeveloperUsers(),
        getDeveloperClientAccess(),
        getDeveloperSystemHealth(),
        getDeveloperSettings(),
        getDeveloperAccountGovernance(),
      ])

      const nextGovernance = governanceResult.governance || null
      const adminCandidates = nextGovernance?.adminCandidates || []
      const savedAdminId = nextGovernance?.permanentAdmin?.id || ''

      setOverview(overviewResult)
      setUsers(usersResult.users || [])
      setClients(clientsResult.clients || [])
      setHealth(healthResult)
      setSettings(settingsResult.settings || null)
      setGovernance(nextGovernance)
      setSelectedAdminId((current) =>
        adminCandidates.some((candidate) => candidate.id === current)
          ? current
          : savedAdminId,
      )
    } catch (loadError) {
      setError(loadError.message || 'Unable to load the Developer Control Center.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(loadPanel, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadPanel])

  const currentDeveloperId = overview?.developer?.id
  const totals = overview?.totals || {}

  const roleCounts = useMemo(() => {
    const counts = {}
    for (const item of overview?.roleCounts || []) counts[item.role] = Number(item.count || 0)
    return counts
  }, [overview])

  const filteredUsers = useMemo(() => {
    const query = accountSearch.trim().toLowerCase()

    return users.filter((user) => {
      const matchesRole = accountRoleFilter === 'all' || user.role === accountRoleFilter
      const haystack = `${displayName(user)} ${user.email} ${user.role} ${user.status}`.toLowerCase()
      return matchesRole && (!query || haystack.includes(query))
    })
  }, [users, accountSearch, accountRoleFilter])

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase()

    return clients.filter((client) => {
      const haystack = `${clientName(client)} ${client.email || ''} ${client.account_status || ''} ${(client.issues || []).join(' ')}`.toLowerCase()
      return !query || haystack.includes(query)
    })
  }, [clients, clientSearch])

  const filteredPreviewClients = useMemo(() => {
    const query = previewClientSearch.trim().toLowerCase()

    return clients.filter((client) => {
      const haystack = `${clientName(client)} ${client.email || client.public_contact_email || ''} ${client.account_status || ''} ${(client.issues || []).join(' ')}`.toLowerCase()
      return !query || haystack.includes(query)
    })
  }, [clients, previewClientSearch])

  const clientAttentionCount = clients.filter((client) => client.readiness !== 'ready').length

  const refreshAfterAction = async (message) => {
    setNotice(message || '')
    await loadPanel()
  }

  const handleCreateAccount = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setCredential(null)

    try {
      const result = await createDeveloperManagedUser(createForm)
      setCredential({
        email: result.user?.email,
        role: result.user?.role,
        password: result.temporaryPassword,
        expiresAt: result.user?.temporary_password_expires_at,
      })
      setCreateForm({ email: '', role: 'admin', expirationHours: 48 })
      if (result.user?.role === 'admin') setSelectedAdminId(result.user.id)
      await refreshAfterAction('Account created. Copy the temporary password now.')
    } catch (actionError) {
      setError(actionError.message || 'Unable to create the account.')
    }
  }

  const handleReconcileGovernance = async () => {
    if (!(await confirmAction({
      title: 'Repair account governance?',
      message: 'Repair the canonical Developer and Owner roles and transfer Founder availability to the Owner account?',
      confirmLabel: 'Repair governance',
      tone: 'warning',
    }))) return

    setIsGovernanceBusy(true)
    setError('')
    setNotice('')
    setCleanupPreview(null)

    try {
      const result = await reconcileDeveloperAccountGovernance()
      setGovernance(result.governance)
      await refreshAfterAction(result.message)
    } catch (actionError) {
      setError(actionError.message || 'Unable to reconcile production identities.')
    } finally {
      setIsGovernanceBusy(false)
    }
  }

  const handleSavePermanentAdmin = async () => {
    setIsGovernanceBusy(true)
    setError('')
    setNotice('')
    setCleanupPreview(null)
    setCleanupConfirmation('')

    try {
      const result = await saveDeveloperPermanentAdmin(selectedAdminId)
      setGovernance(result.governance)
      setNotice(result.message)
    } catch (actionError) {
      setError(actionError.message || 'Unable to save the permanent Admin account.')
    } finally {
      setIsGovernanceBusy(false)
    }
  }

  const handlePreviewCleanup = async () => {
    setIsGovernanceBusy(true)
    setError('')
    setNotice('')
    setCleanupConfirmation('')

    try {
      const result = await previewDeveloperAccountCleanup(selectedAdminId)
      setCleanupPreview(result.preview)
      setNotice('Cleanup preview is ready. Nothing has been changed yet.')
    } catch (actionError) {
      setCleanupPreview(null)
      setError(actionError.message || 'Unable to preview account cleanup.')
    } finally {
      setIsGovernanceBusy(false)
    }
  }

  const handleApplyCleanup = async () => {
    if (cleanupConfirmation !== 'ARCHIVE') {
      setError('Type ARCHIVE exactly before applying the cleanup.')
      return
    }

    if (!(await confirmAction({
      title: 'Archive duplicate system accounts?',
      message: 'Every listed duplicate or test system account will be archived and its sessions revoked.',
      detail: 'Client and member accounts will remain untouched.',
      confirmLabel: 'Archive accounts',
      tone: 'danger',
    }))) return

    setIsGovernanceBusy(true)
    setError('')
    setNotice('')

    try {
      const result = await applyDeveloperAccountCleanup(
        selectedAdminId,
        cleanupConfirmation,
      )
      setGovernance(result.governance)
      setCleanupPreview(null)
      setCleanupConfirmation('')
      await refreshAfterAction(result.message)
    } catch (actionError) {
      setError(actionError.message || 'Unable to apply the account cleanup.')
    } finally {
      setIsGovernanceBusy(false)
    }
  }

  const handleTemporaryPassword = async (user) => {
    if (!(await confirmAction({
      title: 'Issue temporary access?',
      message: `Create a new 48-hour temporary password for ${user.email}?`,
      detail: 'Their current sessions will stop working.',
      confirmLabel: 'Create temporary password',
      tone: 'warning',
    }))) return

    setBusyUserId(user.id)
    setError('')
    setNotice('')
    setCredential(null)

    try {
      const result = await issueDeveloperTemporaryPassword(user.id, 48)
      setCredential({
        email: result.user?.email || user.email,
        role: result.user?.role || user.role,
        password: result.temporaryPassword,
        expiresAt: result.user?.temporary_password_expires_at,
      })
      await refreshAfterAction('Temporary access created. Copy it now; it will not be shown again.')
    } catch (actionError) {
      setError(actionError.message || 'Unable to create temporary access.')
    } finally {
      setBusyUserId('')
    }
  }

  const handleStatus = async (user, nextStatus) => {
    if (!(await confirmAction({
      title: 'Change account status?',
      message: `Change ${user.email} from ${user.status} to ${nextStatus}?`,
      detail: 'Existing sessions will be revoked.',
      confirmLabel: `Change to ${nextStatus}`,
      tone: nextStatus === 'archived' ? 'danger' : 'warning',
    }))) return

    setBusyUserId(user.id)
    setError('')

    try {
      const result = await updateDeveloperUserStatus(user.id, nextStatus)
      await refreshAfterAction(result.message || `Account changed to ${nextStatus}.`)
    } catch (actionError) {
      setError(actionError.message || 'Unable to update the account status.')
    } finally {
      setBusyUserId('')
    }
  }

  const handleRole = async (user, role) => {
    if (role === user.role) return
    if (!(await confirmAction({
      title: 'Change account role?',
      message: `Change ${user.email} from ${readable(user.role)} to ${readable(role)}?`,
      detail: 'Existing sessions will be revoked.',
      confirmLabel: 'Change role',
      tone: 'warning',
    }))) return

    setBusyUserId(user.id)
    setError('')

    try {
      const result = await updateDeveloperUserRole(user.id, role)
      await refreshAfterAction(result.message)
    } catch (actionError) {
      setError(actionError.message || 'Unable to change the account role.')
    } finally {
      setBusyUserId('')
    }
  }

  const handleRevokeSessions = async (user) => {
    if (!(await confirmAction({
      title: 'Revoke every active session?',
      message: `Sign ${user.email} out everywhere?`,
      detail: 'They will need to log in again.',
      confirmLabel: 'Sign out everywhere',
      tone: 'danger',
    }))) return

    setBusyUserId(user.id)
    setError('')

    try {
      const result = await revokeDeveloperUserSessions(user.id)
      await refreshAfterAction(result.message)
    } catch (actionError) {
      setError(actionError.message || 'Unable to revoke sessions.')
    } finally {
      setBusyUserId('')
    }
  }

  const copyTemporaryPassword = async () => {
    if (!credential?.password) return

    try {
      await navigator.clipboard.writeText(credential.password)
      setNotice('Temporary password copied to the clipboard.')
    } catch {
      setError('The browser could not copy automatically. Select and copy the password manually.')
    }
  }

  const handleSettingsField = (field, value) => {
    setSettings((current) => ({ ...current, [field]: value }))
  }

  const handleFeatureFlag = (flag, value) => {
    setSettings((current) => ({
      ...current,
      featureFlags: {
        ...(current?.featureFlags || {}),
        [flag]: value,
      },
    }))
  }

  const saveSettings = async () => {
    setIsSavingSettings(true)
    setError('')
    setNotice('')

    try {
      const result = await updateDeveloperSettings(settings)
      setSettings(result.settings)
      setNotice(result.message || 'Platform controls saved.')
      const healthResult = await getDeveloperSystemHealth()
      setHealth(healthResult)
    } catch (actionError) {
      setError(actionError.message || 'Unable to save platform controls.')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const openFullFounderWorkspace = () => {
    navigate('/admin/founders-view')
  }

  const openFounderPreview = async () => {
    setPreviewLoadingKey('founder')
    setError('')
    setNotice('')

    try {
      const result = await getDeveloperFounderPreview()
      setPreview(result.preview)
    } catch (previewError) {
      setError(previewError.message || 'Unable to open the Founder preview.')
    } finally {
      setPreviewLoadingKey('')
    }
  }

  const openClientPreviewPicker = () => {
    setPreviewClientSearch('')
    setError('')
    setNotice('')
    setIsClientPreviewPickerOpen(true)
  }

  const openClientPreview = async (client) => {
    const loadingKey = `client:${client.client_profile_id}`
    setPreviewLoadingKey(loadingKey)
    setError('')
    setNotice('')

    try {
      const result = await getDeveloperClientPreview(client.client_profile_id)
      setPreview(result.preview)
      setIsClientPreviewPickerOpen(false)
    } catch (previewError) {
      setError(previewError.message || 'Unable to open the client preview.')
    } finally {
      setPreviewLoadingKey('')
    }
  }

  const handleSignOut = async () => {
    try {
      await logoutAdmin()
    } catch {
      // Clear the browser state even if the cookie is already gone.
    }

    sessionStorage.removeItem('pwc_admin_user')
    navigate('/admin/login', { replace: true })
  }

  useEffect(() => {
    if (!preview && !isClientPreviewPickerOpen) return undefined

    const releaseScrollLock = acquireAdminScrollLock()

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return

      if (preview) {
        setPreview(null)
      } else {
        setIsClientPreviewPickerOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      releaseScrollLock()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [preview, isClientPreviewPickerOpen])

  const closeOverlayFromBackdrop = (event, close) => {
    if (event.target === event.currentTarget) close()
  }

  return (
    <AdminFrame>
      <div className="developer-control-center">
        <header className="developer-control-hero">
          <div>
            <p className="admin-eyebrow">Developer Operations</p>
            <h1>Platform Control Center</h1>
            <p>
              Manage access, diagnose client logins, monitor platform health, and control releases without using an owner or client identity.
            </p>
          </div>

          <div className="developer-control-hero-actions">
            <Link className="btn primary" to="/admin/dashboard">Open The Studio</Link>
            <button className="btn secondary" type="button" onClick={handleSignOut}>Sign Out</button>
          </div>
        </header>

        <nav className="developer-tab-bar" aria-label="Developer Control Center sections" role="tablist">
          {tabs.map((tab) => (
            <button
              className={activeTab === tab.id ? 'is-active' : ''}
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === 'clients' && clientAttentionCount > 0 && <span>{clientAttentionCount}</span>}
            </button>
          ))}
        </nav>

        {error && <div className="developer-alert is-error" role="alert">{error}</div>}
        {notice && <div className="developer-alert is-success" role="status">{notice}</div>}

        {credential && (
          <section className="developer-credential-card" aria-live="polite">
            <div>
              <p className="admin-eyebrow">Shown Once</p>
              <h2>Temporary access for {credential.email}</h2>
              <p>Role: {readable(credential.role)} · Expires {formatDateTime(credential.expiresAt)}</p>
            </div>
            <code>{credential.password}</code>
            <div className="developer-credential-actions">
              <button className="btn primary" type="button" onClick={copyTemporaryPassword}>Copy Password</button>
              <button className="btn secondary" type="button" onClick={() => setCredential(null)}>Hide It</button>
            </div>
          </section>
        )}

        {activeTab === 'overview' && (
          <>
            <section className="developer-metrics-grid" aria-label="Platform totals">
              <article><span>System Accounts</span><strong>{totals.users ?? '—'}</strong><small>{roleCounts.developer || 0} developer(s)</small></article>
              <article><span>Client Profiles</span><strong>{totals.client_profiles ?? '—'}</strong><small>{totals.active_client_logins || 0} active login(s)</small></article>
              <article><span>Bookings</span><strong>{totals.bookings ?? '—'}</strong><small>Requests and sessions</small></article>
              <article><span>Needs Attention</span><strong>{clientAttentionCount}</strong><small>Client access diagnostics</small></article>
            </section>

            <section className="developer-overview-grid">
              <article className="developer-panel-card">
                <div className="developer-section-heading compact">
                  <div>
                    <p className="admin-eyebrow">System Health</p>
                    <h2>{health?.status === 'healthy' ? 'Platform is healthy' : 'Review required'}</h2>
                  </div>
                  <HealthBadge state={health?.status === 'healthy' ? 'healthy' : 'warning'}>
                    {health?.status === 'healthy' ? 'Healthy' : 'Needs attention'}
                  </HealthBadge>
                </div>

                <dl className="developer-health-list">
                  <div><dt>Database</dt><dd>{health?.database?.connected ? `${health.database.latencyMs} ms` : 'Unavailable'}</dd></div>
                  <div><dt>Backend uptime</dt><dd>{formatDuration(health?.application?.uptimeSeconds)}</dd></div>
                  <div><dt>Memory</dt><dd>{formatBytes(health?.application?.memoryRssBytes)}</dd></div>
                  <div><dt>Email provider</dt><dd>{health?.configuration?.emailProviderConfigured ? 'Configured' : 'Not configured'}</dd></div>
                </dl>

                <button className="btn secondary" type="button" onClick={loadPanel} disabled={isLoading}>
                  {isLoading ? 'Checking…' : 'Run Health Check'}
                </button>
              </article>

              <article className="developer-panel-card">
                <p className="admin-eyebrow">Founder Workspace</p>
                <h2>Open the real Founder’s View</h2>
                <p>Enter Kim’s live Founder workspace with developer access. Any availability or calendar changes are live and recorded under your developer account.</p>
                <div className="developer-stack-actions">
                  <button className="btn primary" type="button" onClick={openFullFounderWorkspace}>
                    Open Full Founder’s View
                  </button>
                  <button className="btn secondary" type="button" onClick={openFounderPreview} disabled={previewLoadingKey === 'founder'}>
                    {previewLoadingKey === 'founder' ? 'Opening preview…' : 'Open Read-only Preview'}
                  </button>
                  <button className="btn secondary" type="button" onClick={openClientPreviewPicker}>
                    Choose a Client Preview
                  </button>
                </div>
              </article>
            </section>

            <section className="developer-quick-links">
              <div><p className="admin-eyebrow">Quick Access</p><h2>Platform workspaces</h2></div>
              <div className="developer-quick-link-grid">
                <Link to="/admin/founders-view"><strong>Full Founder’s View</strong><span>Live owner dashboard, calendar, and availability controls.</span></Link>
                <Link to="/admin/clients"><strong>Client Circle</strong><span>Profiles, invitations, resources, and care records.</span></Link>
                <Link to="/admin/scheduler"><strong>Sessions</strong><span>Booking requests, sessions, and availability.</span></Link>
                <Link to="/admin/audit-log"><strong>Activity Journal</strong><span>Recorded platform and security actions.</span></Link>
                <Link to="/client-portal/login"><strong>Client Portal Login</strong><span>Test using an active client account only.</span></Link>
              </div>
            </section>
          </>
        )}

        {activeTab === 'accounts' && (
          <>
            <section className="developer-governance-card">
              <div className="developer-section-heading">
                <div>
                  <p className="admin-eyebrow">Production Identity Governance</p>
                  <h2>Protected Owner, Developer, and Admin access</h2>
                  <p>The backend protects the canonical Developer and Owner emails. Choose one separate Admin before archiving duplicate or test system accounts.</p>
                </div>
                <HealthBadge state={governance?.healthy ? 'healthy' : 'warning'}>
                  {governance?.healthy ? 'Identity map healthy' : `${governance?.issues?.length || 0} issue${governance?.issues?.length === 1 ? '' : 's'}`}
                </HealthBadge>
              </div>

              <div className="developer-governance-identities">
                <article>
                  <span>Canonical Developer</span>
                  <strong>{governance?.canonical?.developerEmail || 'Loading…'}</strong>
                  <small>{governance?.developer ? `${readable(governance.developer.role)} · ${readable(governance.developer.status)}` : 'Account missing'}</small>
                </article>
                <article>
                  <span>Canonical Owner</span>
                  <strong>{governance?.canonical?.ownerEmail || 'Loading…'}</strong>
                  <small>{governance?.owner ? `${readable(governance.owner.role)} · ${readable(governance.owner.status)}` : 'Account missing'}</small>
                </article>
                <article>
                  <span>Founder availability owner</span>
                  <strong>{governance?.founderAvailability?.owner_email || 'Unassigned'}</strong>
                  <small>{governance?.founderAvailability ? `${governance.founderAvailability.schedule_enabled ? 'Schedule enabled' : 'Schedule disabled'} · ${governance.founderAvailability.timezone}` : 'Needs reconciliation'}</small>
                </article>
              </div>

              {governance?.issues?.length > 0 && (
                <div className="developer-governance-issues">
                  {governance.issues.map((issue) => <span key={issue}>{issue}</span>)}
                </div>
              )}

              <div className="developer-governance-admin-row">
                <label>
                  <span>Permanent Admin account</span>
                  <select
                    value={selectedAdminId}
                    onChange={(event) => {
                      setSelectedAdminId(event.target.value)
                      setCleanupPreview(null)
                      setCleanupConfirmation('')
                    }}
                  >
                    <option value="">Choose an active Admin</option>
                    {(governance?.adminCandidates || []).map((admin) => (
                      <option value={admin.id} key={admin.id} disabled={admin.status !== 'active'}>
                        {admin.email} · {readable(admin.status)}
                      </option>
                    ))}
                  </select>
                  <small>Create an Admin account below first when this list is empty.</small>
                </label>

                <div className="developer-governance-actions">
                  <button className="btn secondary" type="button" onClick={handleReconcileGovernance} disabled={isGovernanceBusy}>
                    {isGovernanceBusy ? 'Working…' : 'Repair Identity Mapping'}
                  </button>
                  <button className="btn secondary" type="button" onClick={handleSavePermanentAdmin} disabled={isGovernanceBusy || !selectedAdminId}>
                    Save Permanent Admin
                  </button>
                  <button className="btn primary" type="button" onClick={handlePreviewCleanup} disabled={isGovernanceBusy || !selectedAdminId}>
                    Preview Backend Cleanup
                  </button>
                </div>
              </div>

              {cleanupPreview && (
                <div className="developer-cleanup-preview">
                  <div>
                    <p className="admin-eyebrow">Safe Cleanup Preview</p>
                    <h3>{cleanupPreview.count} system account{cleanupPreview.count === 1 ? '' : 's'} will be archived</h3>
                    <p>Preserved: canonical Developer, canonical Owner, {cleanupPreview.permanentAdmin?.email}. Client and member accounts are excluded.</p>
                  </div>

                  {cleanupPreview.candidates?.length > 0 ? (
                    <div className="developer-cleanup-list">
                      {cleanupPreview.candidates.map((candidate) => (
                        <article key={candidate.id}>
                          <strong>{candidate.email}</strong>
                          <span>{readable(candidate.role)} · {readable(candidate.status)}</span>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="developer-preview-empty">No duplicate or test system accounts are eligible for cleanup.</p>
                  )}

                  {cleanupPreview.candidates?.length > 0 && (
                    <div className="developer-cleanup-confirmation">
                      <label>
                        <span>Type ARCHIVE to confirm</span>
                        <input value={cleanupConfirmation} onChange={(event) => setCleanupConfirmation(event.target.value)} placeholder="ARCHIVE" />
                      </label>
                      <button className="btn secondary developer-danger-button" type="button" onClick={handleApplyCleanup} disabled={isGovernanceBusy || cleanupConfirmation !== 'ARCHIVE'}>
                        Archive Listed Accounts
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="developer-panel-card">
              <div className="developer-section-heading">
                <div><p className="admin-eyebrow">Create Access</p><h2>New Admin or team account</h2><p>Admin is selected by default. Canonical Developer and Owner emails are protected by the backend.</p></div>
              </div>

              <form className="developer-create-form" onSubmit={handleCreateAccount}>
                <label>Email<input type="email" required value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} /></label>
                <label>Role<select value={createForm.role} onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value }))}>{createRoleOptions.map((role) => <option value={role} key={role}>{readable(role)}</option>)}</select></label>
                <label>Temporary access<select value={createForm.expirationHours} onChange={(event) => setCreateForm((current) => ({ ...current, expirationHours: Number(event.target.value) }))}><option value={24}>24 hours</option><option value={48}>48 hours</option><option value={72}>72 hours</option><option value={168}>7 days</option></select></label>
                <button className="btn primary" type="submit">Create Account</button>
              </form>
            </section>

            <section className="developer-account-section">
              <div className="developer-section-heading">
                <div><p className="admin-eyebrow">Access Directory</p><h2>System accounts</h2><p>Passwords and password hashes are never displayed.</p></div>
                <button className="btn secondary" type="button" onClick={loadPanel} disabled={isLoading}>{isLoading ? 'Refreshing…' : 'Refresh'}</button>
              </div>

              <div className="developer-filter-row">
                <label><span>Search</span><input type="search" placeholder="Name, email, role, or status" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} /></label>
                <label><span>Role</span><select value={accountRoleFilter} onChange={(event) => setAccountRoleFilter(event.target.value)}><option value="all">All roles</option>{['developer', 'owner', 'admin', 'staff', 'client', 'member'].map((role) => <option value={role} key={role}>{readable(role)}</option>)}</select></label>
              </div>

              <div className="developer-account-list">
                {filteredUsers.map((user) => {
                  const isCurrentDeveloper = user.id === currentDeveloperId
                  const isSystemRole = !['client', 'member'].includes(user.role)
                  const isProtectedIdentity = Boolean(user.protected_identity)

                  return (
                    <article className="developer-account-card" key={user.id}>
                      <div className="developer-account-primary">
                        <div><span className={`developer-role-badge role-${user.role}`}>{readable(user.role)}</span>{isCurrentDeveloper && <span className="developer-you-badge">You</span>}{isProtectedIdentity && <span className="developer-protected-badge">Protected {readable(user.protected_identity)}</span>}</div>
                        <h3>{displayName(user)}</h3><p>{user.email}</p>
                      </div>

                      <dl className="developer-account-details">
                        <div><dt>Status</dt><dd>{readable(user.status)}</dd></div>
                        <div><dt>Last login</dt><dd>{formatDateTime(user.last_login_at)}</dd></div>
                        <div><dt>Password</dt><dd>{user.must_change_password ? `Change required · expires ${formatDateTime(user.temporary_password_expires_at)}` : user.password_changed_at ? `Changed ${formatDateTime(user.password_changed_at)}` : 'No change recorded'}</dd></div>
                      </dl>

                      <div className="developer-account-actions">
                        {user.client_profile_id && <Link className="btn secondary" to={`/admin/clients/${user.client_profile_id}/portal-access`}>Client Access</Link>}
                        {isSystemRole && !isCurrentDeveloper && !isProtectedIdentity && <select aria-label={`Change role for ${user.email}`} disabled={busyUserId === user.id} value={user.role} onChange={(event) => handleRole(user, event.target.value)}>{roleOptions.map((role) => <option value={role} key={role}>{readable(role)}</option>)}</select>}
                        {isSystemRole && !isCurrentDeveloper && <button className="btn secondary" type="button" disabled={busyUserId === user.id} onClick={() => handleTemporaryPassword(user)}>Temporary Password</button>}
                        {!isCurrentDeveloper && <button className="btn secondary" type="button" disabled={busyUserId === user.id} onClick={() => handleRevokeSessions(user)}>Sign Out Everywhere</button>}
                        {!isCurrentDeveloper && !isProtectedIdentity && user.status !== 'active' && <button className="btn secondary" type="button" disabled={busyUserId === user.id} onClick={() => handleStatus(user, 'active')}>Activate</button>}
                        {!isCurrentDeveloper && !isProtectedIdentity && user.status === 'active' && <button className="btn secondary developer-danger-button" type="button" disabled={busyUserId === user.id} onClick={() => handleStatus(user, 'suspended')}>Suspend</button>}
                        {!isCurrentDeveloper && !isProtectedIdentity && user.status !== 'archived' && <button className="btn secondary developer-danger-button" type="button" disabled={busyUserId === user.id} onClick={() => handleStatus(user, 'archived')}>Archive</button>}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {activeTab === 'clients' && (
          <section className="developer-account-section">
            <div className="developer-section-heading">
              <div><p className="admin-eyebrow">Portal Diagnostics</p><h2>Client access</h2><p>See exactly why a client can or cannot enter the portal.</p></div>
              <button className="btn secondary" type="button" onClick={loadPanel}>Refresh</button>
            </div>

            <div className="developer-filter-row single">
              <label><span>Search clients</span><input type="search" placeholder="Name, email, or access issue" value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} /></label>
            </div>

            <div className="developer-client-grid">
              {filteredClients.map((client) => (
                <article className="developer-client-card" key={client.client_profile_id}>
                  <div className="developer-client-card-top">
                    <div><h3>{clientName(client)}</h3><p>{client.email || client.public_contact_email || 'No email connected'}</p></div>
                    <HealthBadge state={client.readiness === 'ready' ? 'healthy' : 'warning'}>{client.readiness === 'ready' ? 'Ready' : 'Needs attention'}</HealthBadge>
                  </div>

                  <dl className="developer-client-facts">
                    <div><dt>Portal account</dt><dd>{client.user_id ? readable(client.account_status) : 'Not created'}</dd></div>
                    <div><dt>Last login</dt><dd>{formatDateTime(client.last_login_at)}</dd></div>
                    <div><dt>Latest invite</dt><dd>{client.latest_invite_status ? `${readable(client.latest_invite_status)} · ${formatDateTime(client.latest_invite_expires_at)}` : 'None'}</dd></div>
                    <div><dt>Portal content</dt><dd>{client.active_resources} resources · {client.published_messages} messages</dd></div>
                  </dl>

                  {client.issues?.length > 0 && <div className="developer-issue-list">{client.issues.map((issue) => <span key={issue}>{issue}</span>)}</div>}

                  <div className="developer-account-actions">
                    <Link className="btn primary" to={`/admin/clients/${client.client_profile_id}/portal-access`}>Manage Access</Link>
                    <button className="btn secondary" type="button" onClick={() => openClientPreview(client)} disabled={previewLoadingKey === `client:${client.client_profile_id}`}>{previewLoadingKey === `client:${client.client_profile_id}` ? 'Opening…' : 'Preview Portal'}</button>
                    {client.user_id && <button className="btn secondary" type="button" onClick={() => handleRevokeSessions({ id: client.user_id, email: client.email })}>Sign Out Everywhere</button>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'controls' && settings && (
          <section className="developer-controls-layout">
            <article className="developer-panel-card developer-emergency-card">
              <p className="admin-eyebrow">Emergency Controls</p>
              <h2>Platform availability</h2>
              <p>These switches take effect immediately after you save. Admin and developer login remains available.</p>

              <div className="developer-toggle-list">
                {[
                  ['maintenanceMode', 'Maintenance mode', 'Pauses client login, invitation setup, booking requests, and outgoing email.'],
                  ['bookingsPaused', 'Pause new bookings', 'Keeps the website online but prevents new booking requests.'],
                  ['clientLoginsPaused', 'Pause client sign-in', 'Existing pages stay online while new client sessions are blocked.'],
                  ['outgoingEmailPaused', 'Pause outgoing email', 'Prevents Portal Invite and Mail Studio email delivery.'],
                ].map(([key, label, description]) => (
                  <label className="developer-toggle-row" key={key}>
                    <span><strong>{label}</strong><small>{description}</small></span>
                    <input type="checkbox" checked={Boolean(settings[key])} onChange={(event) => handleSettingsField(key, event.target.checked)} />
                  </label>
                ))}
              </div>

              <label className="developer-message-field">Maintenance message<textarea rows="3" value={settings.maintenanceMessage || ''} onChange={(event) => handleSettingsField('maintenanceMessage', event.target.value)} /></label>
            </article>

            <article className="developer-panel-card">
              <p className="admin-eyebrow">Feature Flags</p>
              <h2>Release visibility</h2>
              <p>Enable platform capabilities deliberately. Flags are saved centrally for future module gating.</p>

              <div className="developer-toggle-list compact">
                {Object.entries(featureFlagLabels).map(([flag, label]) => (
                  <label className="developer-toggle-row" key={flag}>
                    <span><strong>{label}</strong><small>{settings.featureFlags?.[flag] ? 'Enabled' : 'Developer-controlled release'}</small></span>
                    <input type="checkbox" checked={Boolean(settings.featureFlags?.[flag])} onChange={(event) => handleFeatureFlag(flag, event.target.checked)} />
                  </label>
                ))}
              </div>
            </article>

            <div className="developer-control-save-bar">
              <div><strong>Review before saving</strong><span>Emergency controls affect real user access.</span></div>
              <button className="btn primary" type="button" onClick={saveSettings} disabled={isSavingSettings}>{isSavingSettings ? 'Saving…' : 'Save Platform Controls'}</button>
            </div>
          </section>
        )}

        {activeTab === 'security' && (
          <section className="developer-panel-card">
            <div className="developer-section-heading">
              <div><p className="admin-eyebrow">Security Activity</p><h2>Recent sensitive actions</h2><p>Password, session, status, role, and denied-access events.</p></div>
              <Link className="btn secondary" to="/admin/audit-log">Open Full Journal</Link>
            </div>

            <div className="developer-security-list">
              {(health?.securityEvents || []).map((event) => (
                <article key={event.id}>
                  <div><strong>{readable(event.action)}</strong><span>{event.actor_email || 'System'} · {readable(event.actor_role || 'system')}</span></div>
                  <time>{formatDateTime(event.created_at)}</time>
                </article>
              ))}
              {!health?.securityEvents?.length && <div className="developer-empty-state"><h3>No recent security events.</h3><p>Sensitive actions will appear here when recorded.</p></div>}
            </div>
          </section>
        )}

        {isClientPreviewPickerOpen && (
          <div
            className="developer-preview-overlay"
            role="presentation"
            onMouseDown={(event) => closeOverlayFromBackdrop(event, () => setIsClientPreviewPickerOpen(false))}
          >
            <section
              className="developer-preview-panel developer-client-picker-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="developer-client-picker-title"
            >
              <header>
                <div>
                  <p className="admin-eyebrow">Read-only Client Preview</p>
                  <h2 id="developer-client-picker-title">Choose a client</h2>
                  <p>Select a client to inspect the portal experience without signing in as them.</p>
                </div>
                <button className="btn secondary" type="button" onClick={() => setIsClientPreviewPickerOpen(false)}>
                  Close
                </button>
              </header>

              <div className="developer-client-picker-content">
                <label className="developer-preview-search">
                  <span>Search clients</span>
                  <input
                    autoFocus
                    type="search"
                    placeholder="Name, email, or access issue"
                    value={previewClientSearch}
                    onChange={(event) => setPreviewClientSearch(event.target.value)}
                  />
                </label>

                <div className="developer-client-picker-list">
                  {filteredPreviewClients.map((client) => {
                    const loadingKey = `client:${client.client_profile_id}`

                    return (
                      <article key={client.client_profile_id}>
                        <div>
                          <strong>{clientName(client)}</strong>
                          <span>{client.email || client.public_contact_email || 'No email connected'}</span>
                          <small>{client.readiness === 'ready' ? 'Portal ready' : (client.issues || []).join(' · ') || 'Needs attention'}</small>
                        </div>
                        <div className="developer-client-picker-actions">
                          <Link className="btn secondary" to={`/admin/clients/${client.client_profile_id}/portal-access`} onClick={() => setIsClientPreviewPickerOpen(false)}>
                            Manage Access
                          </Link>
                          <button className="btn primary" type="button" onClick={() => openClientPreview(client)} disabled={previewLoadingKey === loadingKey}>
                            {previewLoadingKey === loadingKey ? 'Opening…' : 'Open Preview'}
                          </button>
                        </div>
                      </article>
                    )
                  })}

                  {filteredPreviewClients.length === 0 && (
                    <div className="developer-empty-state">
                      <h3>No clients match that search.</h3>
                      <p>Try another name or email address.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {preview && (
          <div
            className="developer-preview-overlay"
            role="presentation"
            onMouseDown={(event) => closeOverlayFromBackdrop(event, () => setPreview(null))}
          >
            <section
              className="developer-preview-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="developer-preview-title"
            >
              <header>
                <div>
                  <p className="admin-eyebrow">Read-only View As</p>
                  <h2 id="developer-preview-title">
                    {preview.type === 'founder'
                      ? 'Founder’s View Preview'
                      : `${[preview.profile?.first_name, preview.profile?.last_name].filter(Boolean).join(' ') || 'Client'} Portal Preview`}
                  </h2>
                  <p>{preview.banner}</p>
                </div>
                <div className="developer-preview-header-actions">
                  {preview.type === 'founder' ? (
                    <button className="btn primary" type="button" onClick={() => { setPreview(null); openFullFounderWorkspace() }}>
                      Open Full Founder’s View
                    </button>
                  ) : (
                    <Link className="btn primary" to={`/admin/clients/${preview.profile?.id}/portal-access`} onClick={() => setPreview(null)}>
                      Manage Client Access
                    </Link>
                  )}
                  <button className="btn secondary" type="button" onClick={() => setPreview(null)}>Close Preview</button>
                </div>
              </header>

              {preview.type === 'founder' ? (
                <div className="developer-preview-content">
                  <div className="developer-preview-mode-note">
                    <strong>Preview only</strong>
                    <span>No calendar, availability, booking, or client-care action can be changed here.</span>
                  </div>

                  <div className="developer-preview-metrics">
                    <article><span>Active Clients</span><strong>{preview.totals?.active_clients || 0}</strong></article>
                    <article><span>Booking Decisions</span><strong>{preview.totals?.booking_decisions || 0}</strong></article>
                    <article><span>Follow-ups</span><strong>{preview.totals?.follow_ups || 0}</strong></article>
                  </div>

                  <div className="developer-preview-columns">
                    <section>
                      <h3>Upcoming Sessions</h3>
                      {preview.sessions?.map((session) => (
                        <p key={session.id}><strong>{session.client_name}</strong><span>{formatDateTime(session.starts_at)} · {session.appointment_type_name || 'Session'}</span></p>
                      ))}
                      {!preview.sessions?.length && <div className="developer-preview-empty">No upcoming sessions.</div>}
                    </section>
                    <section>
                      <h3>Follow-ups</h3>
                      {preview.followUps?.map((item) => (
                        <p key={item.id}><strong>{item.client_name}</strong><span>{item.title || item.service_name} · {formatDateTime(item.follow_up_at)}</span></p>
                      ))}
                      {!preview.followUps?.length && <div className="developer-preview-empty">No follow-ups need attention.</div>}
                    </section>
                  </div>
                </div>
              ) : (
                <div className="developer-preview-content">
                  <div className="developer-preview-mode-note">
                    <strong>Preview only</strong>
                    <span>You are not signed in as this client. Read status, progress, comments, and account activity will not change.</span>
                  </div>

                  <div className="developer-preview-profile">
                    <strong>{preview.profile?.email || 'No connected email'}</strong>
                    <span>Portal: {readable(preview.profile?.portal_status || 'not connected')} · Last login {formatDateTime(preview.profile?.last_login_at)}</span>
                    <span>Memberships: {preview.summary?.membershipCount || 0} · Learning programs: {preview.summary?.courseCount || 0} · Private conversations: {preview.summary?.conversationCount || 0}</span>
                  </div>

                  <div className="developer-preview-columns">
                    <section>
                      <h3>Resources</h3>
                      {preview.resources?.map((item) => <p key={item.id}><strong>{item.title}</strong><span>{readable(item.resource_type)}</span></p>)}
                      {!preview.resources?.length && <div className="developer-preview-empty">No assigned resources.</div>}
                    </section>
                    <section>
                      <h3>Sessions</h3>
                      {preview.sessions?.map((item) => <p key={item.id}><strong>{item.appointment_type_name || 'Session'}</strong><span>{formatDateTime(item.starts_at)} · {readable(item.status)}</span></p>)}
                      {!preview.sessions?.length && <div className="developer-preview-empty">No sessions recorded.</div>}
                    </section>
                    <section>
                      <h3>Messages</h3>
                      {preview.messages?.map((item) => <p key={item.id}><strong>{item.title || 'A note for you'}</strong><span>{String(item.body || '').slice(0, 120)}</span></p>)}
                      {!preview.messages?.length && <div className="developer-preview-empty">No published encouragements.</div>}
                    </section>
                    <section>
                      <h3>My Journey</h3>
                      {preview.journey?.map((item) => <p key={item.id}><strong>{item.title || item.service_name}</strong><span>{item.client_visible_notes || readable(item.status)}</span></p>)}
                      {!preview.journey?.length && <div className="developer-preview-empty">No client-visible journey entries.</div>}
                    </section>
                    <section>
                      <h3>Memberships</h3>
                      {preview.memberships?.map((item) => <p key={item.id}><strong>{item.name}</strong><span>{readable(item.enrollment_status)} · Renewal {formatDateTime(item.renewal_at)}</span></p>)}
                      {!preview.memberships?.length && <div className="developer-preview-empty">No active memberships.</div>}
                    </section>
                    <section>
                      <h3>Learning Library</h3>
                      {preview.courses?.map((item) => <p key={item.id}><strong>{item.title}</strong><span>{item.progressPercent || 0}% complete · {item.lessonCount || 0} lessons</span></p>)}
                      {!preview.courses?.length && <div className="developer-preview-empty">No assigned learning programs.</div>}
                    </section>
                    <section>
                      <h3>Secure Inbox</h3>
                      {preview.conversations?.map((item) => <p key={item.id}><strong>{item.subject}</strong><span>{readable(item.status)} · Updated {formatDateTime(item.last_message_at || item.updated_at)}</span></p>)}
                      {!preview.conversations?.length && <div className="developer-preview-empty">No private conversations.</div>}
                    </section>
                    <section>
                      <h3>The Circle</h3>
                      {preview.circleMemberships?.map((item) => <p key={item.id}><strong>{item.name}</strong><span>{item.tagline || 'Active community access'}</span></p>)}
                      {!preview.circleMemberships?.length && <div className="developer-preview-empty">No active Circle membership.</div>}
                    </section>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </AdminFrame>
  )
}
