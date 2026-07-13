import { useEffect, useMemo, useState } from 'react'
import AdminFrame from '../../components/admin/AdminFrame'
import {
  activateAdminMembership,
  archiveAdminMembership,
  archiveAdminMembershipAnnouncement,
  createAdminMembership,
  createAdminMembershipAnnouncement,
  createAdminMembershipResource,
  deleteAdminMembership,
  deleteAdminMembershipAnnouncement,
  deleteAdminMembershipEnrollment,
  deleteAdminMembershipResource,
  getAdminMembership,
  getAdminMembershipCircle,
  publishAdminMembershipAnnouncement,
  updateAdminMembership,
  updateAdminMembershipAnnouncement,
  updateAdminMembershipCourses,
  updateAdminMembershipEnrollment,
  updateAdminMembershipResource,
  upsertAdminMembershipEnrollment,
} from '../../lib/nativeApi'

import './Admin.css'
import './MembershipCircle.css'

const emptyPlanForm = {
  name: '',
  tagline: '',
  description: '',
  benefitsText: '',
  welcomeMessage: '',
  price: '',
  currency: 'USD',
  billingInterval: 'monthly',
}

const emptyMemberForm = {
  clientProfileId: '',
  status: 'active',
  startedAt: new Date().toISOString().slice(0, 10),
  renewalAt: '',
  endsAt: '',
  notes: '',
}

const emptyResourceForm = {
  title: '',
  resourceType: 'link',
  description: '',
  resourceUrl: '',
  position: 0,
}

const emptyAnnouncementForm = {
  title: '',
  body: '',
  status: 'draft',
}

function clientName(client) {
  return (
    [client?.first_name, client?.last_name].filter(Boolean).join(' ').trim() ||
    client?.email ||
    'Client'
  )
}

function formatStatus(value) {
  return String(value || 'draft')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value) {
  if (!value) return 'Not set'

  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeZone: 'America/New_York',
    }).format(new Date(value))
  } catch {
    return 'Date unavailable'
  }
}

function dateInputValue(value) {
  if (!value) return ''

  try {
    return new Date(value).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

function toStoredDate(value) {
  return value ? `${value}T12:00:00.000Z` : null
}

function formatMoney(cents, currency = 'USD', interval = null) {
  if (cents === null || cents === undefined || cents === '') return 'Price not set'

  try {
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(Number(cents) / 100)

    const intervalLabels = {
      one_time: 'one time',
      monthly: 'per month',
      quarterly: 'per quarter',
      yearly: 'per year',
    }

    return interval ? `${amount} ${intervalLabels[interval] || ''}`.trim() : amount
  } catch {
    return `${Number(cents) / 100} ${currency}`
  }
}

function MemberRow({ enrollment, onSave, onRemove, isBusy }) {
  const [draft, setDraft] = useState({
    status: enrollment.status || 'active',
    startedAt: dateInputValue(enrollment.started_at),
    renewalAt: dateInputValue(enrollment.renewal_at),
    endsAt: dateInputValue(enrollment.ends_at),
    notes: enrollment.notes || '',
  })

  async function handleSave() {
    await onSave(enrollment.id, {
      status: draft.status,
      startedAt: toStoredDate(draft.startedAt),
      renewalAt: toStoredDate(draft.renewalAt),
      endsAt: toStoredDate(draft.endsAt),
      notes: draft.notes,
    })
  }

  return (
    <article className="membership-member-row">
      <div className="membership-member-identity">
        <strong>{clientName(enrollment)}</strong>
        <span>{enrollment.email || 'No portal email'}</span>
        <small>{formatStatus(enrollment.account_status || 'profile only')}</small>
      </div>

      <label>
        <span>Member status</span>
        <select
          value={draft.status}
          onChange={(event) =>
            setDraft((current) => ({ ...current, status: event.target.value }))
          }
        >
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
      </label>

      <label>
        <span>Started</span>
        <input
          type="date"
          value={draft.startedAt}
          onChange={(event) =>
            setDraft((current) => ({ ...current, startedAt: event.target.value }))
          }
        />
      </label>

      <label>
        <span>Next renewal</span>
        <input
          type="date"
          value={draft.renewalAt}
          onChange={(event) =>
            setDraft((current) => ({ ...current, renewalAt: event.target.value }))
          }
        />
      </label>

      <label>
        <span>Access ends</span>
        <input
          type="date"
          value={draft.endsAt}
          onChange={(event) =>
            setDraft((current) => ({ ...current, endsAt: event.target.value }))
          }
        />
      </label>

      <label className="membership-member-notes">
        <span>Private admin note</span>
        <input
          value={draft.notes}
          onChange={(event) =>
            setDraft((current) => ({ ...current, notes: event.target.value }))
          }
          placeholder="Payment, renewal, or care note"
        />
      </label>

      <div className="membership-member-actions">
        <button type="button" onClick={handleSave} disabled={isBusy}>
          Save
        </button>
        <button
          className="is-danger"
          type="button"
          onClick={() => onRemove(enrollment.id)}
          disabled={isBusy}
        >
          Remove
        </button>
      </div>
    </article>
  )
}

export default function AdminMembershipCircle() {
  const [memberships, setMemberships] = useState([])
  const [clients, setClients] = useState([])
  const [courses, setCourses] = useState([])
  const [featureEnabled, setFeatureEnabled] = useState(true)
  const [selectedMembershipId, setSelectedMembershipId] = useState('')
  const [selectedMembership, setSelectedMembership] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [planForm, setPlanForm] = useState(emptyPlanForm)
  const [newPlanName, setNewPlanName] = useState('')
  const [memberForm, setMemberForm] = useState(emptyMemberForm)
  const [selectedCourseIds, setSelectedCourseIds] = useState([])
  const [resourceForm, setResourceForm] = useState(emptyResourceForm)
  const [announcementForm, setAnnouncementForm] = useState(emptyAnnouncementForm)
  const [editingAnnouncementId, setEditingAnnouncementId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const filteredMemberships = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return memberships.filter((membership) => {
      if (statusFilter !== 'all' && membership.status !== statusFilter) return false
      if (!normalizedSearch) return true

      return [membership.name, membership.tagline, membership.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    })
  }, [memberships, search, statusFilter])

  const metrics = useMemo(
    () => ({
      activePlans: memberships.filter((membership) => membership.status === 'active').length,
      activeMembers: memberships.reduce(
        (total, membership) => total + Number(membership.active_member_count || 0),
        0,
      ),
      pausedMembers: memberships.reduce(
        (total, membership) => total + Number(membership.paused_member_count || 0),
        0,
      ),
      resources: memberships.reduce(
        (total, membership) => total + Number(membership.resource_count || 0),
        0,
      ),
    }),
    [memberships],
  )

  async function loadMembership(membershipId) {
    const response = await getAdminMembership(membershipId)
    const membership = response.membership

    setSelectedMembership(membership)
    setPlanForm({
      name: membership.name || '',
      tagline: membership.tagline || '',
      description: membership.description || '',
      benefitsText: Array.isArray(membership.benefits)
        ? membership.benefits.join('\n')
        : '',
      welcomeMessage: membership.welcome_message || '',
      price:
        membership.price_cents === null || membership.price_cents === undefined
          ? ''
          : String(Number(membership.price_cents) / 100),
      currency: membership.currency || 'USD',
      billingInterval: membership.billing_interval || 'monthly',
    })
    setSelectedCourseIds((membership.courses || []).map((course) => course.course_id))
  }

  async function loadCircle(preferredMembershipId = selectedMembershipId) {
    const response = await getAdminMembershipCircle()
    const nextMemberships = response.memberships || []

    setMemberships(nextMemberships)
    setClients(response.clients || [])
    setCourses(response.courses || [])
    setFeatureEnabled(response.featureEnabled !== false)

    const nextSelectedId =
      preferredMembershipId &&
      nextMemberships.some((membership) => membership.id === preferredMembershipId)
        ? preferredMembershipId
        : nextMemberships[0]?.id || ''

    setSelectedMembershipId(nextSelectedId)

    if (nextSelectedId) {
      await loadMembership(nextSelectedId)
    } else {
      setSelectedMembership(null)
      setPlanForm(emptyPlanForm)
    }
  }

  useEffect(() => {
    let mounted = true

    async function start() {
      try {
        setIsLoading(true)
        await loadCircle('')
      } catch (loadError) {
        if (mounted) setError(loadError.message || 'Memberships could not load.')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    start()

    return () => {
      mounted = false
    }
    // Load once for the mounted admin workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runAction(action, successMessage, preferredMembershipId = selectedMembershipId) {
    setIsSaving(true)
    setError('')
    setNotice('')

    try {
      const response = await action()
      setNotice(response?.message || successMessage)
      await loadCircle(preferredMembershipId)
      return response
    } catch (actionError) {
      setError(actionError.message || 'Memberships could not save this change.')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSelectMembership(membershipId) {
    setSelectedMembershipId(membershipId)
    setActiveTab('overview')
    setError('')
    setNotice('')

    try {
      await loadMembership(membershipId)
    } catch (loadError) {
      setError(loadError.message || 'This membership could not load.')
    }
  }

  async function handleCreatePlan(event) {
    event.preventDefault()
    if (!newPlanName.trim()) return

    const response = await runAction(
      () =>
        createAdminMembership({
          name: newPlanName.trim(),
          status: 'draft',
          benefits: [],
          currency: 'USD',
          billingInterval: 'monthly',
        }),
      'Membership plan created.',
      '',
    )

    if (response?.membership?.id) {
      setNewPlanName('')
      setSelectedMembershipId(response.membership.id)
      await loadCircle(response.membership.id)
    }
  }

  async function handleSavePlan(event) {
    event.preventDefault()
    if (!selectedMembership) return

    const benefits = planForm.benefitsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)

    await runAction(
      () =>
        updateAdminMembership(selectedMembership.id, {
          name: planForm.name,
          tagline: planForm.tagline,
          description: planForm.description,
          benefits,
          welcomeMessage: planForm.welcomeMessage,
          priceCents:
            planForm.price === '' ? null : Math.round(Number(planForm.price) * 100),
          currency: planForm.currency,
          billingInterval: planForm.billingInterval,
        }),
      'Membership plan saved.',
    )
  }

  async function handleDeletePlan() {
    if (!selectedMembership) return

    const confirmed = window.confirm(
      `Delete “${selectedMembership.name}”? Only plans without member history can be deleted.`,
    )

    if (!confirmed) return

    const response = await runAction(
      () => deleteAdminMembership(selectedMembership.id),
      'Membership plan deleted.',
      '',
    )

    if (response) await loadCircle('')
  }

  async function handleAddMember(event) {
    event.preventDefault()
    if (!selectedMembership || !memberForm.clientProfileId) return

    const response = await runAction(
      () =>
        upsertAdminMembershipEnrollment(selectedMembership.id, {
          clientProfileId: memberForm.clientProfileId,
          status: memberForm.status,
          startedAt: toStoredDate(memberForm.startedAt),
          renewalAt: toStoredDate(memberForm.renewalAt),
          endsAt: toStoredDate(memberForm.endsAt),
          notes: memberForm.notes,
        }),
      'Client added to this membership.',
    )

    if (response) setMemberForm(emptyMemberForm)
  }

  async function handleUpdateEnrollment(enrollmentId, payload) {
    setBusyId(enrollmentId)

    try {
      await runAction(
        () => updateAdminMembershipEnrollment(enrollmentId, payload),
        'Member access updated.',
      )
    } finally {
      setBusyId('')
    }
  }

  async function handleRemoveEnrollment(enrollmentId) {
    const confirmed = window.confirm(
      'Remove this client from the membership? Their historical client profile will remain.',
    )
    if (!confirmed) return

    setBusyId(enrollmentId)

    try {
      await runAction(
        () => deleteAdminMembershipEnrollment(enrollmentId),
        'Client removed from this membership.',
      )
    } finally {
      setBusyId('')
    }
  }

  async function handleSaveCourses() {
    if (!selectedMembership) return

    await runAction(
      () => updateAdminMembershipCourses(selectedMembership.id, selectedCourseIds),
      'Member Learning Library access updated.',
    )
  }

  async function handleCreateResource(event) {
    event.preventDefault()
    if (!selectedMembership || !resourceForm.title.trim()) return

    const response = await runAction(
      () => createAdminMembershipResource(selectedMembership.id, resourceForm),
      'Member resource added.',
    )

    if (response) setResourceForm(emptyResourceForm)
  }

  async function handleToggleResource(resource) {
    await runAction(
      () =>
        updateAdminMembershipResource(resource.id, {
          status: resource.status === 'active' ? 'archived' : 'active',
        }),
      resource.status === 'active' ? 'Resource archived.' : 'Resource restored.',
    )
  }

  async function handleDeleteResource(resourceId) {
    if (!window.confirm('Delete this member resource?')) return

    await runAction(
      () => deleteAdminMembershipResource(resourceId),
      'Member resource deleted.',
    )
  }

  async function handleCreateAnnouncement(event) {
    event.preventDefault()
    if (!selectedMembership) return

    const response = await runAction(
      () =>
        editingAnnouncementId
          ? updateAdminMembershipAnnouncement(editingAnnouncementId, announcementForm)
          : createAdminMembershipAnnouncement(selectedMembership.id, announcementForm),
      editingAnnouncementId
        ? 'Member update saved.'
        : announcementForm.status === 'published'
          ? 'Member update published.'
          : 'Member update saved as a draft.',
    )

    if (response) {
      setAnnouncementForm(emptyAnnouncementForm)
      setEditingAnnouncementId('')
    }
  }

  async function handlePublishAnnouncement(announcementId) {
    await runAction(
      () => publishAdminMembershipAnnouncement(announcementId),
      'Member update published.',
    )
  }

  async function handleArchiveAnnouncement(announcementId) {
    await runAction(
      () => archiveAdminMembershipAnnouncement(announcementId),
      'Member update archived.',
    )
  }

  async function handleDeleteAnnouncement(announcementId) {
    if (!window.confirm('Delete this member update?')) return

    await runAction(
      () => deleteAdminMembershipAnnouncement(announcementId),
      'Member update deleted.',
    )
  }

  function handleEditAnnouncement(announcement) {
    setEditingAnnouncementId(announcement.id)
    setAnnouncementForm({
      title: announcement.title || '',
      body: announcement.body || '',
      status: announcement.status === 'archived' ? 'draft' : announcement.status,
    })
    setActiveTab('updates')
    setNotice('Editing the selected member update. Save when the message is ready.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function renderOverview() {
    return (
      <form className="membership-plan-form" onSubmit={handleSavePlan}>
        <div className="membership-form-grid">
          <label>
            <span>Membership name</span>
            <input
              value={planForm.name}
              onChange={(event) =>
                setPlanForm((current) => ({ ...current, name: event.target.value }))
              }
              required
            />
          </label>

          <label>
            <span>Short promise</span>
            <input
              value={planForm.tagline}
              onChange={(event) =>
                setPlanForm((current) => ({ ...current, tagline: event.target.value }))
              }
              placeholder="Ongoing care, community, and guided growth"
            />
          </label>
        </div>

        <label>
          <span>Description</span>
          <textarea
            rows="5"
            value={planForm.description}
            onChange={(event) =>
              setPlanForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Explain who this membership supports and what the experience includes."
          />
        </label>

        <label>
          <span>Member benefits</span>
          <textarea
            rows="6"
            value={planForm.benefitsText}
            onChange={(event) =>
              setPlanForm((current) => ({
                ...current,
                benefitsText: event.target.value,
              }))
            }
            placeholder={'One benefit per line\nMonthly private check-in\nMember-only learning experiences'}
          />
          <small>Enter one clear benefit per line.</small>
        </label>

        <label>
          <span>Welcome message</span>
          <textarea
            rows="5"
            value={planForm.welcomeMessage}
            onChange={(event) =>
              setPlanForm((current) => ({
                ...current,
                welcomeMessage: event.target.value,
              }))
            }
            placeholder="A calm welcome the member will see inside her portal."
          />
        </label>

        <div className="membership-form-grid is-three">
          <label>
            <span>Price</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={planForm.price}
              onChange={(event) =>
                setPlanForm((current) => ({ ...current, price: event.target.value }))
              }
              placeholder="99.00"
            />
          </label>

          <label>
            <span>Currency</span>
            <select
              value={planForm.currency}
              onChange={(event) =>
                setPlanForm((current) => ({ ...current, currency: event.target.value }))
              }
            >
              <option value="USD">USD</option>
              <option value="PHP">PHP</option>
              <option value="CAD">CAD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>

          <label>
            <span>Billing rhythm</span>
            <select
              value={planForm.billingInterval}
              onChange={(event) =>
                setPlanForm((current) => ({
                  ...current,
                  billingInterval: event.target.value,
                }))
              }
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="one_time">One-time</option>
            </select>
          </label>
        </div>

        <div className="membership-form-actions">
          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Membership'}
          </button>
          {selectedMembership?.status !== 'active' && (
            <button
              type="button"
              onClick={() =>
                runAction(
                  () => activateAdminMembership(selectedMembership.id),
                  'Membership activated.',
                )
              }
              disabled={isSaving}
            >
              Activate Membership
            </button>
          )}
          {selectedMembership?.status !== 'archived' && (
            <button
              className="is-secondary"
              type="button"
              onClick={() =>
                runAction(
                  () => archiveAdminMembership(selectedMembership.id),
                  'Membership archived.',
                )
              }
              disabled={isSaving}
            >
              Archive
            </button>
          )}
          {selectedMembership?.status !== 'active' && (
            <button
              className="is-danger"
              type="button"
              onClick={handleDeletePlan}
              disabled={isSaving}
            >
              Delete Plan
            </button>
          )}
        </div>
      </form>
    )
  }

  function renderMembers() {
    const enrolledClientIds = new Set(
      (selectedMembership?.enrollments || []).map((item) => item.client_profile_id),
    )
    const availableClients = clients.filter((client) => !enrolledClientIds.has(client.id))

    return (
      <div className="membership-members-panel">
        <form className="membership-add-member" onSubmit={handleAddMember}>
          <div>
            <p className="eyebrow">Add a Member</p>
            <h3>Give a client membership access</h3>
            <p>Choose the client, access status, and important renewal dates.</p>
          </div>

          <label>
            <span>Client</span>
            <select
              value={memberForm.clientProfileId}
              onChange={(event) =>
                setMemberForm((current) => ({
                  ...current,
                  clientProfileId: event.target.value,
                }))
              }
              required
            >
              <option value="">Choose a client</option>
              {availableClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {clientName(client)}{client.email ? ` · ${client.email}` : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="membership-form-grid is-three">
            <label>
              <span>Status</span>
              <select
                value={memberForm.status}
                onChange={(event) =>
                  setMemberForm((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </label>
            <label>
              <span>Start date</span>
              <input
                type="date"
                value={memberForm.startedAt}
                onChange={(event) =>
                  setMemberForm((current) => ({
                    ...current,
                    startedAt: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Next renewal</span>
              <input
                type="date"
                value={memberForm.renewalAt}
                onChange={(event) =>
                  setMemberForm((current) => ({
                    ...current,
                    renewalAt: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="membership-form-grid">
            <label>
              <span>Access ends</span>
              <input
                type="date"
                value={memberForm.endsAt}
                onChange={(event) =>
                  setMemberForm((current) => ({ ...current, endsAt: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Private admin note</span>
              <input
                value={memberForm.notes}
                onChange={(event) =>
                  setMemberForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Optional renewal or care note"
              />
            </label>
          </div>

          <button type="submit" disabled={isSaving || availableClients.length === 0}>
            Add to Membership
          </button>
        </form>

        <div className="membership-member-list">
          {(selectedMembership?.enrollments || []).length === 0 ? (
            <div className="membership-empty-state">
              <strong>No members have been added yet.</strong>
              <p>Choose a client above to give her access to this membership.</p>
            </div>
          ) : (
            selectedMembership.enrollments.map((enrollment) => (
              <MemberRow
                key={enrollment.id}
                enrollment={enrollment}
                onSave={handleUpdateEnrollment}
                onRemove={handleRemoveEnrollment}
                isBusy={busyId === enrollment.id || isSaving}
              />
            ))
          )}
        </div>
      </div>
    )
  }

  function renderContent() {
    return (
      <div className="membership-content-grid">
        <section className="membership-content-card">
          <div className="membership-card-heading">
            <div>
              <p className="eyebrow">Learning Access</p>
              <h3>Member Learning Library</h3>
            </div>
            <button type="button" onClick={handleSaveCourses} disabled={isSaving}>
              Save Learning Access
            </button>
          </div>

          {courses.length === 0 ? (
            <div className="membership-empty-state is-small">
              <strong>No Learning Library programs exist yet.</strong>
              <p>Create a program first, then connect it to this membership.</p>
            </div>
          ) : (
            <div className="membership-course-options">
              {courses.map((course) => (
                <label key={course.id}>
                  <input
                    type="checkbox"
                    checked={selectedCourseIds.includes(course.id)}
                    onChange={(event) =>
                      setSelectedCourseIds((current) =>
                        event.target.checked
                          ? [...current, course.id]
                          : current.filter((id) => id !== course.id),
                      )
                    }
                  />
                  <span>
                    <strong>{course.title}</strong>
                    <small>
                      {course.category || 'Personal Growth'} · {formatStatus(course.status)}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="membership-content-card">
          <div className="membership-card-heading">
            <div>
              <p className="eyebrow">Member Resources</p>
              <h3>Private links and downloads</h3>
            </div>
          </div>

          <form className="membership-resource-form" onSubmit={handleCreateResource}>
            <div className="membership-form-grid">
              <label>
                <span>Title</span>
                <input
                  value={resourceForm.title}
                  onChange={(event) =>
                    setResourceForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span>Type</span>
                <select
                  value={resourceForm.resourceType}
                  onChange={(event) =>
                    setResourceForm((current) => ({
                      ...current,
                      resourceType: event.target.value,
                    }))
                  }
                >
                  <option value="link">Link</option>
                  <option value="guide">Guide</option>
                  <option value="worksheet">Worksheet</option>
                  <option value="video">Video</option>
                  <option value="download">Download</option>
                  <option value="note">Note</option>
                </select>
              </label>
            </div>
            <label>
              <span>Description</span>
              <textarea
                rows="3"
                value={resourceForm.description}
                onChange={(event) =>
                  setResourceForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Link or file URL</span>
              <input
                type="url"
                value={resourceForm.resourceUrl}
                onChange={(event) =>
                  setResourceForm((current) => ({
                    ...current,
                    resourceUrl: event.target.value,
                  }))
                }
                placeholder="https://"
              />
            </label>
            <button type="submit" disabled={isSaving}>
              Add Member Resource
            </button>
          </form>

          <div className="membership-resource-list">
            {(selectedMembership?.resources || []).length === 0 ? (
              <p>No private member resources have been added.</p>
            ) : (
              selectedMembership.resources.map((resource) => (
                <article key={resource.id} className={resource.status === 'archived' ? 'is-archived' : ''}>
                  <div>
                    <span>{formatStatus(resource.resource_type)}</span>
                    <strong>{resource.title}</strong>
                    <p>{resource.description || 'No description added.'}</p>
                  </div>
                  <div>
                    <button type="button" onClick={() => handleToggleResource(resource)}>
                      {resource.status === 'active' ? 'Archive' : 'Restore'}
                    </button>
                    <button
                      className="is-danger"
                      type="button"
                      onClick={() => handleDeleteResource(resource.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    )
  }

  function renderUpdates() {
    return (
      <div className="membership-updates-layout">
        <form className="membership-update-composer" onSubmit={handleCreateAnnouncement}>
          <p className="eyebrow">{editingAnnouncementId ? 'Edit Member Update' : 'Member Update'}</p>
          <h3>{editingAnnouncementId ? 'Refine this private update' : 'Share a private membership announcement'}</h3>
          <label>
            <span>Title</span>
            <input
              value={announcementForm.title}
              onChange={(event) =>
                setAnnouncementForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            <span>Message</span>
            <textarea
              rows="7"
              value={announcementForm.body}
              onChange={(event) =>
                setAnnouncementForm((current) => ({
                  ...current,
                  body: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            <span>Save as</span>
            <select
              value={announcementForm.status}
              onChange={(event) =>
                setAnnouncementForm((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
            >
              <option value="draft">Draft</option>
              <option value="published">Publish now</option>
            </select>
          </label>
          <div className="membership-form-actions">
            <button type="submit" disabled={isSaving}>
              {editingAnnouncementId
                ? 'Save Update'
                : announcementForm.status === 'published'
                  ? 'Publish Update'
                  : 'Save Draft'}
            </button>
            {editingAnnouncementId && (
              <button
                className="is-secondary"
                type="button"
                onClick={() => {
                  setEditingAnnouncementId('')
                  setAnnouncementForm(emptyAnnouncementForm)
                  setNotice('')
                }}
              >
                Cancel Editing
              </button>
            )}
          </div>
        </form>

        <section className="membership-update-list">
          <div className="membership-card-heading">
            <div>
              <p className="eyebrow">History</p>
              <h3>Membership updates</h3>
            </div>
          </div>

          {(selectedMembership?.announcements || []).length === 0 ? (
            <div className="membership-empty-state">
              <strong>No membership updates yet.</strong>
              <p>Draft or publish the first update using the composer.</p>
            </div>
          ) : (
            selectedMembership.announcements.map((announcement) => (
              <article key={announcement.id}>
                <div className="membership-update-meta">
                  <span className={`is-${announcement.status}`}>
                    {formatStatus(announcement.status)}
                  </span>
                  <time>
                    {formatDate(announcement.published_at || announcement.created_at)}
                  </time>
                </div>
                <h4>{announcement.title}</h4>
                <p>{announcement.body}</p>
                <div className="membership-update-actions">
                  <button type="button" onClick={() => handleEditAnnouncement(announcement)}>
                    Edit
                  </button>
                  {announcement.status !== 'published' && (
                    <button
                      type="button"
                      onClick={() => handlePublishAnnouncement(announcement.id)}
                    >
                      Publish
                    </button>
                  )}
                  {announcement.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() => handleArchiveAnnouncement(announcement.id)}
                    >
                      Archive
                    </button>
                  )}
                  {announcement.status !== 'published' && (
                    <button
                      className="is-danger"
                      type="button"
                      onClick={() => handleDeleteAnnouncement(announcement.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    )
  }

  return (
    <AdminFrame>
      <main className="membership-circle-admin">
        <header className="membership-circle-header">
          <div>
            <p className="eyebrow">Programs</p>
            <h1>Memberships</h1>
            <p>
              Manage ongoing client access, renewal dates, private resources, learning,
              and member communication from one calm workspace.
            </p>
          </div>
          <div className="membership-circle-header__status">
            <span>{featureEnabled ? 'Client Memberships On' : 'Client Memberships Paused'}</span>
            <small>Controlled from Developer → Controls</small>
          </div>
        </header>

        {error && <div className="membership-alert is-error">{error}</div>}
        {notice && <div className="membership-alert is-success">{notice}</div>}
        {!featureEnabled && (
          <div className="membership-alert is-warning">
            Memberships are hidden from client portals until the Developer feature flag is enabled.
          </div>
        )}

        <section className="membership-metrics">
          <article>
            <span>Active plans</span>
            <strong>{metrics.activePlans}</strong>
          </article>
          <article>
            <span>Active members</span>
            <strong>{metrics.activeMembers}</strong>
          </article>
          <article>
            <span>Paused members</span>
            <strong>{metrics.pausedMembers}</strong>
          </article>
          <article>
            <span>Member resources</span>
            <strong>{metrics.resources}</strong>
          </article>
        </section>

        <section className="membership-circle-layout">
          <aside className="membership-sidebar">
            <form className="membership-create-plan" onSubmit={handleCreatePlan}>
              <label>
                <span>New membership</span>
                <input
                  value={newPlanName}
                  onChange={(event) => setNewPlanName(event.target.value)}
                  placeholder="Membership name"
                />
              </label>
              <button type="submit" disabled={isSaving || !newPlanName.trim()}>
                Create Draft
              </button>
            </form>

            <div className="membership-filters">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search memberships"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="membership-plan-list">
              {isLoading ? (
                <p>Loading memberships...</p>
              ) : filteredMemberships.length === 0 ? (
                <p>No memberships match this view.</p>
              ) : (
                filteredMemberships.map((membership) => (
                  <button
                    key={membership.id}
                    type="button"
                    className={
                      membership.id === selectedMembershipId ? 'is-active' : ''
                    }
                    onClick={() => handleSelectMembership(membership.id)}
                  >
                    <div>
                      <strong>{membership.name}</strong>
                      <span>{formatStatus(membership.status)}</span>
                    </div>
                    <small>
                      {membership.active_member_count || 0} active ·{' '}
                      {formatMoney(
                        membership.price_cents,
                        membership.currency,
                        membership.billing_interval,
                      )}
                    </small>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="membership-workspace">
            {!selectedMembership ? (
              <div className="membership-empty-state is-large">
                <strong>Create the first membership plan.</strong>
                <p>
                  Start with a name, then add benefits, members, learning access, and private updates.
                </p>
              </div>
            ) : (
              <>
                <div className="membership-workspace-heading">
                  <div>
                    <span className={`membership-status is-${selectedMembership.status}`}>
                      {formatStatus(selectedMembership.status)}
                    </span>
                    <h2>{selectedMembership.name}</h2>
                    <p>
                      {selectedMembership.tagline ||
                        'Ongoing care, access, and connection for active members.'}
                    </p>
                  </div>
                  <div>
                    <strong>
                      {formatMoney(
                        selectedMembership.price_cents,
                        selectedMembership.currency,
                        selectedMembership.billing_interval,
                      )}
                    </strong>
                    <span>{selectedMembership.enrollments?.length || 0} members total</span>
                  </div>
                </div>

                <nav className="membership-tabs" aria-label="Membership workspace">
                  {[
                    ['overview', 'Overview'],
                    ['members', 'Members'],
                    ['content', 'Benefits & Content'],
                    ['updates', 'Member Updates'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={activeTab === id ? 'is-active' : ''}
                      onClick={() => setActiveTab(id)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>

                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'members' && renderMembers()}
                {activeTab === 'content' && renderContent()}
                {activeTab === 'updates' && renderUpdates()}
              </>
            )}
          </section>
        </section>
      </main>
    </AdminFrame>
  )
}
