import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminFrame from '../../components/admin/AdminFrame'
import {
  getDeveloperTeamManagement,
  updateDeveloperTeamAssignments,
  updateDeveloperTeamMember,
} from '../../lib/nativeApi'

import './Admin.css'
import './TeamManagement.css'
import './AdminOperationsElevation.css'

const moduleLabels = {
  dashboard: ['Overview', 'Studio dashboard and operational summary'],
  clients: ['Clients', 'Profiles, portal access, resources, and care records'],
  sessions: ['Sessions', 'Bookings, appointment types, and change requests'],
  inbox: ['Secure Inbox', 'Private client conversations and internal notes'],
  communications: ['Communications', 'Mail Studio, email drafts, and delivery logs'],
  learning: ['Learning Library', 'Courses, modules, lessons, and access'],
  memberships: ['Memberships', 'Plans, enrollments, resources, and announcements'],
  circle: ['The Circle', 'Community posts, comments, reports, and moderation'],
  encouragements: ['Encouragements', 'Drafting, scheduling, and publishing'],
  audit: ['Activity Journal', 'Sensitive operational and security activity'],
}

const templateLabels = {
  custom: 'Custom access',
  client_care: 'Client Care',
  operations: 'Operations',
  content_community: 'Content & Community',
  read_only: 'Read-only Studio',
  restricted: 'Restricted',
}

function nameForMember(member) {
  return member?.profile?.displayName || member?.email || 'Team member'
}

function nameForClient(client) {
  return [client.firstName, client.lastName].filter(Boolean).join(' ').trim() ||
    client.email ||
    'Client'
}

function formatDate(value) {
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

function initialForm(member) {
  return {
    displayName: member?.profile?.displayName || '',
    jobTitle: member?.profile?.jobTitle || '',
    department: member?.profile?.department || 'client_care',
    availabilityStatus: member?.profile?.availabilityStatus || 'available',
    capacityPercent: member?.profile?.capacityPercent ?? 100,
    isAssignable: member?.profile?.isAssignable !== false,
    internalNotes: member?.profile?.internalNotes || '',
    permissionTemplate: 'custom',
    permissions: { ...(member?.permissions || {}) },
  }
}

export default function AdminTeamManagement() {
  const [snapshot, setSnapshot] = useState(null)
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [form, setForm] = useState(initialForm(null))
  const [assignmentDraft, setAssignmentDraft] = useState([])
  const [memberSearch, setMemberSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingAssignments, setIsSavingAssignments] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadTeam = useCallback(async ({ preserveSelection = true } = {}) => {
    setIsLoading(true)
    setError('')

    try {
      const result = await getDeveloperTeamManagement()
      setSnapshot(result)

      const members = result.members || []
      const nextMemberId = preserveSelection && members.some((member) => member.id === selectedMemberId)
        ? selectedMemberId
        : members.find((member) => member.status === 'active')?.id || members[0]?.id || ''

      setSelectedMemberId(nextMemberId)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load Staff & Team Management.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedMemberId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadTeam({ preserveSelection: false })
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const members = useMemo(() => snapshot?.members || [], [snapshot])
  const clients = useMemo(() => snapshot?.clients || [], [snapshot])
  const modules = snapshot?.modules || []
  const templates = snapshot?.templates || {}
  const selectedMember = members.find((member) => member.id === selectedMemberId) || null

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setForm(initialForm(selectedMember))
      setAssignmentDraft(selectedMember?.clientAssignments || [])
      setClientSearch('')
      setError('')
      setNotice('')
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [selectedMemberId, selectedMember])

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase()

    return members.filter((member) => {
      const haystack = `${nameForMember(member)} ${member.email} ${member.role} ${member.status} ${member.profile?.jobTitle || ''} ${member.profile?.department || ''}`.toLowerCase()
      return !query || haystack.includes(query)
    })
  }, [members, memberSearch])

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase()

    return clients.filter((client) => {
      const haystack = `${nameForClient(client)} ${client.email || ''} ${client.clientStatus || ''}`.toLowerCase()
      return !query || haystack.includes(query)
    })
  }, [clients, clientSearch])

  const assignmentMap = useMemo(
    () => new Map(assignmentDraft.map((assignment) => [assignment.clientProfileId, assignment])),
    [assignmentDraft],
  )

  const applyTemplate = (templateName) => {
    const template = templates[templateName]

    setForm((current) => ({
      ...current,
      permissionTemplate: templateName,
      permissions: template ? { ...template } : current.permissions,
    }))
  }

  const setPermission = (moduleName, level) => {
    setForm((current) => ({
      ...current,
      permissionTemplate: 'custom',
      permissions: {
        ...current.permissions,
        [moduleName]: level,
      },
    }))
  }

  const saveMember = async (event) => {
    event.preventDefault()
    if (!selectedMember) return

    setIsSaving(true)
    setError('')
    setNotice('')

    try {
      const result = await updateDeveloperTeamMember(selectedMember.id, form)
      setSnapshot(result)
      setNotice(result.message || 'Team member settings saved.')
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the team member settings.')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleClientAssignment = (clientId, enabled) => {
    setAssignmentDraft((current) => {
      if (!enabled) return current.filter((assignment) => assignment.clientProfileId !== clientId)
      if (current.some((assignment) => assignment.clientProfileId === clientId)) return current

      return [
        ...current,
        {
          clientProfileId: clientId,
          assignmentRole: 'support',
        },
      ]
    })
  }

  const updateAssignmentRole = (clientId, assignmentRole) => {
    setAssignmentDraft((current) => current.map((assignment) => (
      assignment.clientProfileId === clientId
        ? { ...assignment, assignmentRole }
        : assignment
    )))
  }

  const saveAssignments = async () => {
    if (!selectedMember) return

    setIsSavingAssignments(true)
    setError('')
    setNotice('')

    try {
      const result = await updateDeveloperTeamAssignments(selectedMember.id, assignmentDraft)
      setSnapshot(result)
      setNotice(result.message || 'Client assignments saved.')
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the client assignments.')
    } finally {
      setIsSavingAssignments(false)
    }
  }

  return (
    <AdminFrame>
      <div className="team-management-page">
        <header className="team-management-hero">
          <div>
            <p className="admin-eyebrow">Developer Operations</p>
            <h1>Staff & Team Management</h1>
            <p>
              Give each team member the exact Studio access they need, track workload,
              and connect the right people to the right clients.
            </p>
          </div>

          <div className="team-management-hero-actions">
            <Link className="btn secondary" to="/admin/developer">Create or secure accounts</Link>
            <button className="btn primary" type="button" onClick={() => loadTeam()} disabled={isLoading}>
              {isLoading ? 'Refreshing…' : 'Refresh team'}
            </button>
          </div>
        </header>

        {error && <div className="team-management-alert is-error" role="alert">{error}</div>}
        {notice && <div className="team-management-alert is-success" role="status">{notice}</div>}

        <section className="team-management-stats" aria-label="Team summary">
          <article><span>Total team</span><strong>{snapshot?.summary?.total ?? '—'}</strong><small>Admin and staff accounts</small></article>
          <article><span>Active</span><strong>{snapshot?.summary?.active ?? '—'}</strong><small>Can sign in now</small></article>
          <article><span>Available</span><strong>{snapshot?.summary?.available ?? '—'}</strong><small>Assignable team members</small></article>
          <article><span>Client links</span><strong>{snapshot?.summary?.assignedClients ?? '—'}</strong><small>Active care assignments</small></article>
        </section>

        <div className="team-management-layout">
          <aside className="team-directory-panel">
            <div className="team-panel-heading">
              <div>
                <p className="admin-eyebrow">Directory</p>
                <h2>Operational team</h2>
              </div>
              <span>{members.length}</span>
            </div>

            <label className="team-search-field">
              <span>Search team</span>
              <input
                type="search"
                placeholder="Name, email, role, or department"
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
              />
            </label>

            <div className="team-directory-list">
              {filteredMembers.map((member) => (
                <button
                  className={`team-directory-card${selectedMemberId === member.id ? ' is-selected' : ''}`}
                  type="button"
                  key={member.id}
                  onClick={() => setSelectedMemberId(member.id)}
                >
                  <div>
                    <span className={`team-role-badge is-${member.role}`}>{member.role}</span>
                    <span className={`team-status-dot is-${member.profile.availabilityStatus}`} />
                  </div>
                  <strong>{nameForMember(member)}</strong>
                  <small>{member.profile.jobTitle || member.email}</small>
                  <p>{member.assignedClientCount} client(s) · {member.openConversationCount} open inbox</p>
                </button>
              ))}

              {!filteredMembers.length && (
                <div className="team-empty-state">
                  <strong>No team account found.</strong>
                  <p>Create an Admin or Staff account from the Developer Control Center first.</p>
                </div>
              )}
            </div>
          </aside>

          <section className="team-workspace-panel">
            {!selectedMember ? (
              <div className="team-empty-state is-large">
                <strong>Select a team member</strong>
                <p>Choose an Admin or Staff account to configure its operational profile.</p>
              </div>
            ) : (
              <>
                <div className="team-member-header">
                  <div>
                    <div className="team-member-badges">
                      <span className={`team-role-badge is-${selectedMember.role}`}>{selectedMember.role}</span>
                      <span className={`team-account-status is-${selectedMember.status}`}>{selectedMember.status}</span>
                    </div>
                    <h2>{nameForMember(selectedMember)}</h2>
                    <p>{selectedMember.email}</p>
                  </div>

                  <dl>
                    <div><dt>Last login</dt><dd>{formatDate(selectedMember.lastLoginAt)}</dd></div>
                    <div><dt>Assigned clients</dt><dd>{selectedMember.assignedClientCount}</dd></div>
                    <div><dt>Open inbox</dt><dd>{selectedMember.openConversationCount}</dd></div>
                  </dl>
                </div>

                <form className="team-member-form" onSubmit={saveMember}>
                  <section className="team-form-card">
                    <div className="team-form-card-heading">
                      <div>
                        <p className="admin-eyebrow">Team Profile</p>
                        <h3>Identity and workload</h3>
                      </div>
                    </div>

                    <div className="team-form-grid">
                      <label>
                        <span>Display name</span>
                        <input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} />
                      </label>
                      <label>
                        <span>Job title</span>
                        <input value={form.jobTitle} onChange={(event) => setForm((current) => ({ ...current, jobTitle: event.target.value }))} />
                      </label>
                      <label>
                        <span>Department</span>
                        <select value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}>
                          <option value="leadership">Leadership</option>
                          <option value="client_care">Client Care</option>
                          <option value="operations">Operations</option>
                          <option value="content_community">Content & Community</option>
                          <option value="learning">Learning</option>
                          <option value="administration">Administration</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label>
                        <span>Availability</span>
                        <select value={form.availabilityStatus} onChange={(event) => setForm((current) => ({ ...current, availabilityStatus: event.target.value }))}>
                          <option value="available">Available</option>
                          <option value="focused">Focused work</option>
                          <option value="limited">Limited capacity</option>
                          <option value="away">Away</option>
                        </select>
                      </label>
                      <label>
                        <span>Capacity · {form.capacityPercent}%</span>
                        <input type="range" min="0" max="100" step="5" value={form.capacityPercent} onChange={(event) => setForm((current) => ({ ...current, capacityPercent: Number(event.target.value) }))} />
                      </label>
                      <label className="team-checkbox-field">
                        <input type="checkbox" checked={form.isAssignable} onChange={(event) => setForm((current) => ({ ...current, isAssignable: event.target.checked }))} />
                        <span><strong>Available for assignments</strong><small>Show this person as eligible for new client work.</small></span>
                      </label>
                    </div>

                    <label className="team-notes-field">
                      <span>Developer-only notes</span>
                      <textarea rows="3" value={form.internalNotes} onChange={(event) => setForm((current) => ({ ...current, internalNotes: event.target.value }))} />
                    </label>
                  </section>

                  <section className="team-form-card">
                    <div className="team-form-card-heading">
                      <div>
                        <p className="admin-eyebrow">Role Boundaries</p>
                        <h3>Studio permissions</h3>
                        <p>
                          View allows read-only access. Manage allows actions and changes.
                          Backend enforcement remains active even when someone opens a direct URL.
                        </p>
                      </div>

                      <label>
                        <span>Access template</span>
                        <select
                          value={form.permissionTemplate}
                          disabled={selectedMember.permissionsLocked}
                          onChange={(event) => applyTemplate(event.target.value)}
                        >
                          {Object.keys(templateLabels).map((key) => (
                            <option value={key} key={key}>{templateLabels[key]}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {selectedMember.permissionsLocked && (
                      <div className="team-permission-lock-note">
                        The permanent Admin account retains full operational access. Developer-only controls remain protected separately.
                      </div>
                    )}

                    <div className="team-permission-grid">
                      {modules.map((moduleName) => {
                        const [label, description] = moduleLabels[moduleName] || [moduleName, 'Studio module']
                        const currentLevel = selectedMember.permissionsLocked
                          ? 'manage'
                          : form.permissions[moduleName] || 'none'

                        return (
                          <article className={`team-permission-card is-${currentLevel}`} key={moduleName}>
                            <div>
                              <strong>{label}</strong>
                              <p>{description}</p>
                            </div>
                            <select
                              aria-label={`${label} access`}
                              value={currentLevel}
                              disabled={selectedMember.permissionsLocked}
                              onChange={(event) => setPermission(moduleName, event.target.value)}
                            >
                              <option value="none">No access</option>
                              <option value="view">View only</option>
                              <option value="manage">Manage</option>
                            </select>
                          </article>
                        )
                      })}
                    </div>
                  </section>

                  <div className="team-save-row">
                    <button className="btn primary" type="submit" disabled={isSaving}>
                      {isSaving ? 'Saving…' : 'Save profile & permissions'}
                    </button>
                  </div>
                </form>

                <section className="team-form-card team-assignments-card">
                  <div className="team-form-card-heading">
                    <div>
                      <p className="admin-eyebrow">Client Ownership</p>
                      <h3>Assigned clients</h3>
                      <p>Assignments support workload clarity and future Client 360 routing.</p>
                    </div>
                    <strong>{assignmentDraft.length} selected</strong>
                  </div>

                  <label className="team-search-field">
                    <span>Find clients</span>
                    <input type="search" placeholder="Name, email, or client status" value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} />
                  </label>

                  <div className="team-client-assignment-list">
                    {filteredClients.map((client) => {
                      const assignment = assignmentMap.get(client.id)

                      return (
                        <article className={`team-client-assignment${assignment ? ' is-assigned' : ''}`} key={client.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={Boolean(assignment)}
                              onChange={(event) => toggleClientAssignment(client.id, event.target.checked)}
                            />
                            <span>
                              <strong>{nameForClient(client)}</strong>
                              <small>{client.email || 'No portal email'} · {client.clientStatus?.replaceAll('_', ' ')}</small>
                            </span>
                          </label>

                          {assignment && (
                            <select value={assignment.assignmentRole} onChange={(event) => updateAssignmentRole(client.id, event.target.value)}>
                              <option value="primary">Primary</option>
                              <option value="support">Support</option>
                              <option value="specialist">Specialist</option>
                              <option value="observer">Observer</option>
                            </select>
                          )}
                        </article>
                      )
                    })}

                    {!filteredClients.length && (
                      <div className="team-empty-state">
                        <strong>No client matched this search.</strong>
                      </div>
                    )}
                  </div>

                  <div className="team-save-row">
                    <button className="btn primary" type="button" onClick={saveAssignments} disabled={isSavingAssignments}>
                      {isSavingAssignments ? 'Saving assignments…' : 'Save client assignments'}
                    </button>
                  </div>
                </section>
              </>
            )}
          </section>
        </div>
      </div>
    </AdminFrame>
  )
}
