import { useEffect, useMemo, useState } from 'react'
import AdminFrame from '../../components/admin/AdminFrame'
import {
  createAdminClient,
  createAdminClientPortalInvite,
  createAdminPortalInviteEmailDraft,
  getAdminClientPortalEmailLogs,
  markAdminPortalEmailLogSent,
  getAdminClientPortalInvites,
  revokeAdminClientPortalInvite,
  sendAdminPortalInviteEmail,
  createAdminClientPortalResource,
  getAdminClientPortalResources,
  updateAdminClientPortalResource,
  createAdminClientServiceRecord,
  getAdminClientCareTimeline,
  getAdminClients,
  updateAdminClient,
  updateAdminServiceRecord,
} from '../../lib/nativeApi'
import './AdminClients.rework.css'

import './Admin.css'
const emptyClientForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  clientStatus: 'lead',
  privateAdminNotes: '',
  clientVisibleNotes: '',
}

const clientStatusOptions = [
  { value: 'lead', label: 'Lead' },
  { value: 'active', label: 'Active Client' },
  { value: 'member', label: 'Member' },
  { value: 'archived', label: 'Archived' },
]

const emptyPortalResourceForm = {
  title: '',
  resourceType: 'guide',
  description: '',
  resourceUrl: '',
  status: 'active',
}

function portalResourceToForm(resource) {
  if (!resource) return emptyPortalResourceForm

  return {
    title: resource.title || '',
    resourceType: resource.resource_type || resource.resourceType || 'guide',
    description: resource.description || '',
    resourceUrl: resource.resource_url || resource.resourceUrl || '',
    status: resource.status || 'active',
  }
}

function filterPortalResources(resources, filter) {
  const currentFilter = String(filter || 'active').toLowerCase()

  return resources.filter((resource) => {
    const status = String(resource.status || 'active').toLowerCase()

    if (currentFilter === 'all') return true

    return status === currentFilter
  })
}

function formatPortalResourceType(type) {
  return String(type || 'resource')
    .replaceAll('_', ' ')
    .trim()
    .toLowerCase()
}

function formatPortalInviteStatus(status) {
  return String(status || 'unknown')
    .replaceAll('_', ' ')
    .trim()
    .toLowerCase()
}

function getPortalInviteStatusTone(status) {
  const value = String(status || '').toLowerCase()

  if (value === 'accepted') return 'is-accepted'
  if (value === 'pending') return 'is-pending'
  if (value === 'revoked') return 'is-revoked'
  if (value === 'expired') return 'is-expired'

  return ''
}

function getPortalAccessLinkFromResponse(response) {
  return (
    response?.loginLink ||
    response?.login_link ||
    response?.inviteLink ||
    response?.invite_link ||
    response?.invite?.loginLink ||
    response?.invite?.login_link ||
    response?.invite?.inviteLink ||
    response?.invite?.invite_link ||
    ''
  )
}

function isPortalAccessActive(invite, client) {
  const inviteStatus = String(invite?.status || '').toLowerCase()
  const clientPortalStatus = String(client?.portalStatus || '').toLowerCase()

  return (
    inviteStatus === 'accepted' ||
    clientPortalStatus === 'accepted' ||
    clientPortalStatus === 'active'
  )
}

const emptyServiceRecordForm = {
  title: '',
  serviceType: 'session_note',
  serviceDate: '',
  status: 'completed',
  summary: '',
  privateNotes: '',
  clientVisibleNotes: '',
  followUpAt: '',
}

const serviceTypeOptions = [
  { value: 'session_note', label: 'Session Note' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'color_analysis', label: 'Color Analysis' },
  { value: 'style_body_analysis', label: 'Style / Body Analysis' },
  { value: 'makeup_lesson', label: 'Makeup Lesson' },
  { value: 'resource_assigned', label: 'Resource Assigned' },
  { value: 'follow_up', label: 'Follow-Up' },
]

const serviceStatusOptions = [
  { value: 'completed', label: 'Completed' },
  { value: 'planned', label: 'Planned' },
  { value: 'follow_up', label: 'Needs Follow-Up' },
  { value: 'archived', label: 'Archived' },
]

// phase-3-7-service-record-constants-start
// phase-3-7-service-record-constants-end

function getClientList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.clients)) return response.clients
  if (Array.isArray(response?.clientProfiles)) return response.clientProfiles
  if (Array.isArray(response?.records)) return response.records
  return []
}

function normalizeStatusValue(status) {
  const value = String(status || 'lead').trim().toLowerCase()

  if (value === 'active client') return 'active'
  if (value === 'active_client') return 'active'
  if (value === 'new inquiry') return 'lead'

  return value || 'lead'
}

function formatStatus(status) {
  const value = String(status || 'lead')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()
    .toLowerCase()

  if (!value) return 'Lead'

  return value.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatPortalStatus(status) {
  const value = String(status || 'invited')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()
    .toLowerCase()

  if (!value) return 'Invited'

  return value.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getPortalStatusTone(status) {
  const value = String(status || '').toLowerCase()

  if (value === 'active' || value === 'accepted') return 'is-active'
  if (value === 'pending' || value === 'invited') return 'is-pending'
  if (value === 'revoked' || value === 'expired' || value === 'inactive') {
    return 'is-muted'
  }

  return 'is-neutral'
}

function getClientSearchText(client) {
  return [
    client?.name,
    client?.email,
    client?.phone,
    client?.clientStatus,
    client?.portalStatus,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}


function extractEmailFromClientNotes(client) {
  const notes = [
    client?.privateAdminNotes,
    client?.private_admin_notes,
    client?.admin_notes,
    client?.notes,
  ]
    .filter(Boolean)
    .join('\n')

  const match = notes.match(/(?:^|\n)Email:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)

  return match?.[1]?.trim() || ''
}

function getClientEmailDisplay(client) {
  return (
    client?.email ||
    client?.primary_email ||
    client?.user_email ||
    client?.contact_email ||
    client?.email_address ||
    client?.primaryEmail ||
    client?.userEmail ||
    client?.contactEmail ||
    client?.emailAddress ||
    extractEmailFromClientNotes(client) ||
    ''
  )
}


function getLeadInterestLabel(client) {
  const notes = [
    client?.privateAdminNotes,
    client?.private_admin_notes,
    client?.admin_notes,
    client?.notes,
  ]
    .filter(Boolean)
    .join('\n')

  const noteMatch = notes.match(/(?:^|\n)Interest:\s*([^\n]+)/i)
  const value =
    client?.leadInterest ||
    client?.lead_interest ||
    client?.interest ||
    client?.leadCategory ||
    client?.lead_category ||
    noteMatch?.[1] ||
    ''

  return String(value || 'General Message').trim()
}

function normalizeClient(client) {
  const firstName = client.firstName || client.first_name || ''
  const lastName = client.lastName || client.last_name || ''
  const fullName =
    client.name || [firstName, lastName].filter(Boolean).join(' ') || 'Unnamed Client'

  return {
    ...client,
    id: client.id || client.client_profile_id || client.clientProfileId,
    firstName,
    lastName,
    name: fullName,
    email: getClientEmailDisplay(client),
    phone: client.phone || client.primary_phone || '',
    clientStatus: normalizeStatusValue(client.clientStatus || client.client_status),
    leadInterest: getLeadInterestLabel(client),
    portalStatus: formatPortalStatus(
      client.portalStatus ||
        client.portal_status ||
        client.userStatus ||
        client.user_status ||
        client.status ||
        'invited',
    ),
    privateAdminNotes:
      client.privateAdminNotes ||
      client.private_admin_notes ||
      client.adminNotes ||
      client.admin_notes ||
      '',
    clientVisibleNotes:
      client.clientVisibleNotes ||
      client.client_visible_notes ||
      client.clientNotes ||
      client.client_notes ||
      '',
  }
}

function clientToForm(client) {
  if (!client) return emptyClientForm

  return {
    firstName: client.firstName || '',
    lastName: client.lastName || '',
    email: getClientEmailDisplay(client),
    clientStatus: normalizeStatusValue(client.clientStatus),
    leadInterest: getLeadInterestLabel(client),
    privateAdminNotes: client.privateAdminNotes || client.private_admin_notes || client.admin_notes || client.notes || '',
    clientVisibleNotes: client.clientVisibleNotes || '',
  }
}

function formatDateTime(value) {
  if (!value) return 'No date saved'

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return 'Invalid date'
  }
}

function formatTimelineType(type) {
  return String(type || 'activity')
    .replaceAll('_', ' ')
    .trim()
}

function getTimelineItems(response) {
  if (Array.isArray(response?.timeline)) return response.timeline
  return []
}

function getBookings(response) {
  if (Array.isArray(response?.bookings)) return response.bookings
  return []
}

function getAuditLogs(response) {
  if (Array.isArray(response?.auditLogs)) return response.auditLogs
  return []
}

function getServiceRecords(response) {
  if (Array.isArray(response?.serviceRecords)) return response.serviceRecords
  return []
}

function formatServiceType(type) {
  return String(type || 'service')
    .replaceAll('_', ' ')
    .trim()
}

function normalizeServiceStatus(status) {
  return String(status || 'completed').trim().toLowerCase() || 'completed'
}

function formatServiceStatus(status) {
  const value = normalizeServiceStatus(status)

  if (value === 'follow_up') return 'needs follow-up'
  if (value === 'in_progress') return 'in progress'

  return value.replaceAll('_', ' ')
}

function getFilteredServiceRecords(records, filter) {
  const currentFilter = String(filter || 'active').toLowerCase()

  return records.filter((record) => {
    const status = normalizeServiceStatus(record.status)

    if (currentFilter === 'all') return true
    if (currentFilter === 'active') return status !== 'archived'

    return status === currentFilter
  })
}

function toDateTimeLocalValue(value) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)

  return localDate.toISOString().slice(0, 16)
}

function serviceRecordToForm(record) {
  if (!record) return emptyServiceRecordForm

  return {
    title: record.title || record.service_name || '',
    serviceType: record.service_type || 'session_note',
    serviceDate: toDateTimeLocalValue(
      record.service_date || record.occurred_at || record.created_at,
    ),
    status: record.status || 'completed',
    summary: record.summary || record.notes || record.description || '',
    privateNotes: record.private_notes || '',
    clientVisibleNotes: record.client_visible_notes || '',
    followUpAt: toDateTimeLocalValue(record.follow_up_at),
  }
}

export default function AdminClients() {
  const [clients, setClients] = useState([])
  const [clientSearchTerm, setClientSearchTerm] = useState('')
  const [clientStatusFilter, setClientStatusFilter] = useState('all')
  const [clientInterestFilter, setClientInterestFilter] = useState('all')
  const [portalStatusFilter, setPortalStatusFilter] = useState('all')
  const [selectedClient, setSelectedClient] = useState(null)
  const [editingClient, setEditingClient] = useState(null)
  const [isClientFormOpen, setIsClientFormOpen] = useState(false)
  const [clientDetailSection, setClientDetailSection] = useState('overview')
  const [careTimeline, setCareTimeline] = useState(null)
  const [portalInvite, setPortalInvite] = useState(null)
  const [portalInvites, setPortalInvites] = useState([])
  const [portalEmailDraft, setPortalEmailDraft] = useState(null)
  const [portalEmailLogs, setPortalEmailLogs] = useState([])
  const [isLoadingPortalInvites, setIsLoadingPortalInvites] = useState(false)
  const [isRevokingPortalInvite, setIsRevokingPortalInvite] = useState(false)
  const [isPreparingPortalEmail, setIsPreparingPortalEmail] = useState(false)
  const [isMarkingPortalEmailSent, setIsMarkingPortalEmailSent] = useState(false)
  const [isSendingPortalEmailNow, setIsSendingPortalEmailNow] = useState(false)
  const [portalResources, setPortalResources] = useState([])
  const [portalResourceForm, setPortalResourceForm] = useState(emptyPortalResourceForm)
  const [editingPortalResource, setEditingPortalResource] = useState(null)
  const [portalResourceFilter, setPortalResourceFilter] = useState('active')
  const [serviceForm, setServiceForm] = useState(emptyServiceRecordForm)
  const [editingServiceRecord, setEditingServiceRecord] = useState(null)
  const [serviceRecordFilter, setServiceRecordFilter] = useState('active')
  const [form, setForm] = useState(emptyClientForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isTimelineLoading, setIsTimelineLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingService, setIsSavingService] = useState(false)
  const [isCreatingPortalInvite, setIsCreatingPortalInvite] = useState(false)
  const [isSavingPortalResource, setIsSavingPortalResource] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    function handleDocumentClientActionMenuClose(event) {
      if (event.target.closest?.('.client-action-menu-v1')) return

      document
        .querySelectorAll('.client-action-menu-v1[open]')
        .forEach((menu) => {
          menu.removeAttribute('open')
        })
    }

    document.addEventListener('mousedown', handleDocumentClientActionMenuClose)

    return () => {
      document.removeEventListener('mousedown', handleDocumentClientActionMenuClose)
    }
  }, [])

  async function loadClients() {
    const response = await getAdminClients()
    const normalizedClients = getClientList(response).map(normalizeClient)

    setClients(normalizedClients)

    setSelectedClient((currentClient) => {
      if (!currentClient) return null

      return normalizedClients.find((client) => client.id === currentClient.id) || null
    })

    setEditingClient((currentClient) => {
      if (!currentClient) return null

      return normalizedClients.find((client) => client.id === currentClient.id) || null
    })
  }

  async function loadPortalEmailLogs(client) {
    if (!client?.id) {
      setPortalEmailLogs([])
      return
    }

    try {
      const response = await getAdminClientPortalEmailLogs(client.id)
      setPortalEmailLogs(response.emailLogs || [])
    } catch {
      setPortalEmailLogs([])
    }
  }

  async function loadPortalInvites(client) {
    if (!client?.id) {
      setPortalInvites([])
      return
    }

    setIsLoadingPortalInvites(true)

    try {
      const response = await getAdminClientPortalInvites(client.id)
      setPortalInvites(response.invites || [])
    } catch {
      setPortalInvites([])
    } finally {
      setIsLoadingPortalInvites(false)
    }
  }

  async function loadPortalResources(client) {
    if (!client?.id) {
      setPortalResources([])
      return
    }

    try {
      const response = await getAdminClientPortalResources(client.id)
      setPortalResources(response.resources || [])
    } catch {
      setPortalResources([])
    }
  }

  async function loadCareTimeline(client) {
    if (!client?.id) {
      setCareTimeline(null)
      return
    }

    setIsTimelineLoading(true)

    try {
      const response = await getAdminClientCareTimeline(client.id)
      setCareTimeline(response)
    } catch (timelineError) {
      setCareTimeline({
        timeline: [],
        bookings: [],
        auditLogs: [],
        error:
          timelineError.message ||
          'Unable to load the care timeline for this client.',
      })
    } finally {
      setIsTimelineLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function loadPage() {
      try {
        setIsLoading(true)
        const response = await getAdminClients()
        const normalizedClients = getClientList(response).map(normalizeClient)

        if (!isMounted) return

        setClients(normalizedClients)
      } catch (loadError) {
        if (!isMounted) return

        setError(loadError.message || 'Unable to load Client Circle records.')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadPage()

  return () => {
      isMounted = false
    }
  }, [])

  const selectedName = selectedClient?.name || 'None'
  const timelineItems = getTimelineItems(careTimeline)
  const connectedBookings = getBookings(careTimeline)
  const bookingCount = connectedBookings.length
  const auditCount = getAuditLogs(careTimeline).length
  const latestBooking = connectedBookings[0] || null
  const lastTimelineItem = timelineItems[0] || null
  const serviceRecords = getServiceRecords(careTimeline)
  const visibleServiceRecords = getFilteredServiceRecords(
    serviceRecords,
    serviceRecordFilter,
  )
  const visiblePortalResources = filterPortalResources(
    portalResources,
    portalResourceFilter,
  )
  const latestPortalInvite = portalInvites[0] || null

  const portalStatusOptions = useMemo(() => {
    const statuses = clients
      .map((client) => formatPortalStatus(client.portalStatus))
      .filter(Boolean)

    return ['all', ...Array.from(new Set(statuses)).sort()]
  }, [clients])

  const clientInterestOptions = useMemo(() => {
    const interests = clients
      .map((client) => getLeadInterestLabel(client))
      .filter(Boolean)
      .filter((interest) => interest !== 'No interest saved')

    return ['all', ...Array.from(new Set(interests)).sort((a, b) => a.localeCompare(b))]
  }, [clients])

  const filteredClients = useMemo(() => {
    const searchValue = clientSearchTerm.trim().toLowerCase()

    return clients.filter((client) => {
      const clientStatus = normalizeStatusValue(client.clientStatus)
      const portalStatus = formatPortalStatus(client.portalStatus)
      const leadInterest = getLeadInterestLabel(client)

      const matchesSearch =
        !searchValue || getClientSearchText(client).includes(searchValue)

      const matchesInterest =
        clientInterestFilter === 'all' || leadInterest === clientInterestFilter

      const matchesClientStatus =
        clientStatusFilter === 'all' || clientStatus === clientStatusFilter

      const matchesPortalStatus =
        portalStatusFilter === 'all' || portalStatus === portalStatusFilter

      return (
        matchesSearch &&
        matchesInterest &&
        matchesClientStatus &&
        matchesPortalStatus
      )
    })
  }, [clients, clientSearchTerm, clientInterestFilter, clientStatusFilter, portalStatusFilter])

  const hasClientFilters =
    clientSearchTerm.trim() ||
    clientInterestFilter !== 'all' ||
    clientStatusFilter !== 'all' ||
    portalStatusFilter !== 'all'

  const selectedClientIsHiddenByFilters =
    selectedClient &&
    filteredClients.length > 0 &&
    !filteredClients.some((client) => client.id === selectedClient.id)
  const portalAccessIsActive = isPortalAccessActive(
    latestPortalInvite,
    selectedClient,
  )
  const portalAccessLinkLabel = portalAccessIsActive ? 'Login Link' : 'Setup Link'

  const metrics = useMemo(
    () => [
      {
        label: 'Total Clients',
        value: clients.length,
      },
      {
        label: 'Shown',
        value: filteredClients.length,
      },
      {
        label: 'Selected',
        value: selectedName,
      },
    ],
    [clients.length, filteredClients.length, selectedName],
  )

  const quickClientFilterStats = useMemo(() => {
    const getPortalStatusValue = (client) =>
      String(client.portalStatus || '').toLowerCase()

    return {
      all: clients.length,
      leads: clients.filter(
        (client) => normalizeStatusValue(client.clientStatus) === 'lead',
      ).length,
      active: clients.filter(
        (client) => normalizeStatusValue(client.clientStatus) === 'active',
      ).length,
      invited: clients.filter(
        (client) => getPortalStatusValue(client) === 'invited',
      ).length,
      portalActive: clients.filter(
        (client) => getPortalStatusValue(client) === 'active',
      ).length,
    }
  }, [clients])
  function updateForm(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function updateServiceForm(field, value) {
    setServiceForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  async function handleViewClient(client) {
    setSelectedClient(client)
    setIsClientFormOpen(false)
    setClientDetailSection('overview')
    setEditingClient(null)
    setForm(emptyClientForm)
    setNotice('')
    setError('')
    await loadCareTimeline(client)
    await loadPortalInvites(client)
  }

  async function handleEditClient(client) {
    setSelectedClient(client)
    setIsClientFormOpen(true)
    setClientDetailSection('overview')
    setEditingClient(client)
    setForm(clientToForm(client))
    setNotice('')
    setError('')
    await loadCareTimeline(client)
    await loadPortalInvites(client)
  }

  function handleClientActionMenuToggle(event) {
    const currentMenu = event.currentTarget

    if (!currentMenu.open) return

    document
      .querySelectorAll('.client-action-menu-v1[open]')
      .forEach((menu) => {
        if (menu !== currentMenu) {
          menu.removeAttribute('open')
        }
      })
  }

  function handleBackToClientRecords() {
    document
      .querySelector('.client-records-card-v2')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleCopySelectedClientEmail() {
    const email = getClientEmailDisplay(selectedClient)

    if (!email) {
      setNotice('No email is saved for this client yet.')
      return
    }

    try {
      await navigator.clipboard.writeText(email)
      setNotice('Client email copied.')
    } catch {
      setNotice('Copy the client email manually from the profile.')
    }
  }

  function handleEmailSelectedClient() {
    const email = getClientEmailDisplay(selectedClient)

    if (!email) {
      setNotice('No email is saved for this client yet.')
      return
    }

    window.location.href = `mailto:${encodeURIComponent(email)}`
  }

  async function handleCopySelectedClientPhone() {
    const phone = selectedClient?.phone || ''

    if (!phone) {
      setNotice('No phone number is saved for this client yet.')
      return
    }

    try {
      await navigator.clipboard.writeText(phone)
      setNotice('Client phone number copied.')
    } catch {
      setNotice('Copy the client phone manually from the profile.')
    }
  }

  function handleOpenNewClientForm() {
    setSelectedClient(null)
    setEditingClient(null)
    setIsClientFormOpen(true)
    setForm(emptyClientForm)
    setNotice('')
    setError('')
  }

  function handleCloseClientForm() {
    setEditingClient(null)
    setIsClientFormOpen(false)
    setForm(emptyClientForm)
    setNotice('')
    setError('')
  }

  function handleClearClientFilters() {
    setClientSearchTerm('')
    setClientInterestFilter('all')
    setClientStatusFilter('all')
    setPortalStatusFilter('all')
  }

  function handleQuickClientStatusFilter(status) {
    setClientSearchTerm('')
    setClientInterestFilter('all')
    setClientStatusFilter(status)
    setPortalStatusFilter('all')
  }

  function handleQuickPortalStatusFilter(status) {
    setClientSearchTerm('')
    setClientInterestFilter('all')
    setClientStatusFilter('all')
    setPortalStatusFilter(status)
  }
  function handleNewProfile() {
    setSelectedClient(null)
    setClientDetailSection('overview')
    setEditingClient(null)
    setIsClientFormOpen(false)
    setCareTimeline(null)
    setForm(emptyClientForm)
    setServiceForm(emptyServiceRecordForm)
    setEditingServiceRecord(null)
    setPortalInvite(null)
    setPortalInvites([])
    setPortalEmailDraft(null)
    setPortalEmailLogs([])
    setPortalResources([])
    setPortalResourceForm(emptyPortalResourceForm)
    setEditingPortalResource(null)
    setPortalResourceFilter('active')
    setNotice('')
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setIsSaving(true)
    setNotice('')
    setError('')

    try {
      if (editingClient) {
        await updateAdminClient(editingClient.id, {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          clientStatus: normalizeStatusValue(form.clientStatus),
          privateAdminNotes: form.privateAdminNotes,
          clientVisibleNotes: form.clientVisibleNotes,
        })

        setNotice('Client profile updated.')
        setIsClientFormOpen(false)
        setEditingClient(null)
      } else {
        await createAdminClient({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          clientStatus: normalizeStatusValue(form.clientStatus),
          privateAdminNotes: form.privateAdminNotes,
          clientVisibleNotes: form.clientVisibleNotes,
        })

        setNotice('New client profile created.')
        setForm(emptyClientForm)
      }

      await loadClients()

      if (editingClient) {
        await loadCareTimeline(selectedClient)
      }
    } catch (saveError) {
      setError(saveError.message || 'Unable to save this client profile.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleEditServiceRecord(record) {
    setEditingServiceRecord(record)
    setServiceForm(serviceRecordToForm(record))
    setNotice('')
    setError('')

    window.requestAnimationFrame(() => {
      document
        .querySelector('.client-service-records-v2')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function handleCancelServiceEdit() {
    setEditingServiceRecord(null)
    setServiceForm(emptyServiceRecordForm)
    setNotice('')
    setError('')
  }

  async function handleQuickServiceStatus(record, nextStatus) {
    if (!selectedClient?.id || !record?.id) return

    setIsSavingService(true)
    setNotice('')
    setError('')

    try {
      await updateAdminServiceRecord(record.id, {
        status: nextStatus,
      })

      const freshTimeline = await getAdminClientCareTimeline(selectedClient.id)
      setCareTimeline(freshTimeline)

      setNotice(`Service record marked as ${formatServiceStatus(nextStatus)}.`)
    } catch (serviceError) {
      setError(serviceError.message || 'Unable to update this service record.')
    } finally {
      setIsSavingService(false)
    }
  }

  async function handleCreateServiceRecord(event) {
    event.preventDefault()

    if (!selectedClient?.id) {
      setError('Select a client before adding a service record.')
      return
    }

    setIsSavingService(true)
    setNotice('')
    setError('')

    try {
      if (editingServiceRecord?.id) {
        await updateAdminServiceRecord(editingServiceRecord.id, serviceForm)
        setNotice('Service record updated. The Care Timeline has been refreshed.')
      } else {
        await createAdminClientServiceRecord(selectedClient.id, serviceForm)
        setNotice('Service record added. Scroll to Service Records and History to see it.')
      }

      setServiceForm(emptyServiceRecordForm)
      setEditingServiceRecord(null)

      const freshTimeline = await getAdminClientCareTimeline(selectedClient.id)
      setCareTimeline(freshTimeline)
    } catch (serviceError) {
      setError(serviceError.message || 'Unable to save this service record.')
    } finally {
      setIsSavingService(false)
    }
  }

  async function handleCreatePortalInvite() {
    if (!selectedClient?.id) {
      setError('Select a client before creating portal access.')
      return
    }

    setIsCreatingPortalInvite(true)
    setNotice('')
    setError('')

    try {
      const response = await createAdminClientPortalInvite(selectedClient.id)
      setPortalInvite(response)
      await loadPortalInvites(selectedClient)

      const isAlreadyActive =
        response?.alreadyActive || response?.portalAlreadyActive

      if (isAlreadyActive) {
        const loginLink = getPortalAccessLinkFromResponse(response)

        if (loginLink) {
          try {
            await navigator.clipboard.writeText(loginLink)
            setNotice('Portal already active. Login link copied.')
          } catch {
            setNotice('Portal already active. Login link ready to copy.')
          }
        } else {
          setNotice('Portal already active. Login link ready.')
        }

        return
      }

      setNotice('Portal setup link ready. Copy it and send it to the client.')
    } catch (inviteError) {
      setError(inviteError.message || 'Unable to prepare portal access.')
    } finally {
      setIsCreatingPortalInvite(false)
    }
  }

  async function handleCopyPortalInvite() {
    const inviteLink = getPortalAccessLinkFromResponse(portalInvite)

    if (!inviteLink) return

    try {
      await navigator.clipboard.writeText(inviteLink)
      setNotice(
        portalInvite?.alreadyActive || portalInvite?.portalAlreadyActive
          ? 'Portal already active. Login link copied.'
          : 'Portal setup link copied.',
      )
    } catch {
      setNotice('Copy the portal access link manually from the field.')
    }
  }


  async function handleCopyActivePortalLoginLink() {
    if (!selectedClient?.id) return

    setIsCreatingPortalInvite(true)
    setNotice('')
    setError('')

    try {
      const response = await createAdminClientPortalInvite(selectedClient.id)
      setPortalInvite(response)
      await loadPortalInvites(selectedClient)

      const loginLink = getPortalAccessLinkFromResponse(response)

      if (!loginLink) {
        setNotice('Portal is active, but no login link was returned.')
        return
      }

      await navigator.clipboard.writeText(loginLink)
      setNotice('Portal already active. Login link copied.')
    } catch (inviteError) {
      setError(inviteError.message || 'Unable to copy the portal login link.')
    } finally {
      setIsCreatingPortalInvite(false)
    }
  }

  async function handleTogglePortalResource(resource) {
    if (!resource?.id) return

    setIsSavingPortalResource(true)
    setNotice('')
    setError('')

    try {
      const nextStatus = resource.status === 'archived' ? 'active' : 'archived'

      await updateAdminClientPortalResource(resource.id, {
        title: resource.title,
        resourceType: resource.resource_type,
        description: resource.description || '',
        resourceUrl: resource.resource_url || '',
        status: nextStatus,
      })

      await loadPortalResources(selectedClient)
      setNotice(
        nextStatus === 'archived'
          ? 'Portal resource archived.'
          : 'Portal resource restored.',
      )
    } catch (resourceError) {
      setError(resourceError.message || 'Unable to update this portal resource.')
    } finally {
      setIsSavingPortalResource(false)
    }
  }

  function handleEditPortalResource(resource) {
    setEditingPortalResource(resource)
    setPortalResourceForm(portalResourceToForm(resource))
    setPortalResourceFilter('all')
    setNotice('')
    setError('')

    window.requestAnimationFrame(() => {
      document
        .querySelector('.client-portal-resources-v2')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function handleCancelPortalResourceEdit() {
    setEditingPortalResource(null)
    setPortalResourceForm(emptyPortalResourceForm)
    setNotice('')
    setError('')
  }

  async function handleCreatePortalResource(event) {
    event.preventDefault()

    if (!selectedClient?.id) {
      setError('Select a client before adding a portal resource.')
      return
    }

    setIsSavingPortalResource(true)
    setNotice('')
    setError('')

    try {
      if (editingPortalResource?.id) {
        await updateAdminClientPortalResource(
          editingPortalResource.id,
          portalResourceForm,
        )

        setNotice('Portal resource updated.')
      } else {
        await createAdminClientPortalResource(selectedClient.id, portalResourceForm)
        setNotice('Portal resource assigned to this client.')
      }

      setEditingPortalResource(null)
      setPortalResourceForm(emptyPortalResourceForm)

      await loadPortalResources(selectedClient)
    } catch (resourceError) {
      setError(resourceError.message || 'Unable to save this portal resource.')
    } finally {
      setIsSavingPortalResource(false)
    }
  }

  async function handleCopyPortalInviteLink(inviteLink) {
    if (!inviteLink) return

    try {
      await navigator.clipboard.writeText(inviteLink)
      setNotice('Portal access link copied.')
    } catch {
      setNotice('Copy the portal access link manually from the field.')
    }
  }

  async function handleRevokePortalInvite(invite) {
    if (!invite?.id) return

    setIsRevokingPortalInvite(true)
    setNotice('')
    setError('')

    try {
      await revokeAdminClientPortalInvite(invite.id)
      await loadPortalInvites(selectedClient)
      setNotice('Portal invite revoked.')
    } catch (inviteError) {
      setError(inviteError.message || 'Unable to revoke this portal invite.')
    } finally {
      setIsRevokingPortalInvite(false)
    }
  }

  async function handlePreparePortalInviteEmail(invite) {
    if (!invite?.id) return

    setIsPreparingPortalEmail(true)
    setNotice('')
    setError('')

    try {
      const response = await createAdminPortalInviteEmailDraft(invite.id)
      setPortalEmailDraft(response)
      await loadPortalEmailLogs(selectedClient)
      setNotice('Portal invite email prepared. Copy it or open your email app.')
    } catch (emailError) {
      setError(emailError.message || 'Unable to prepare this portal invite email.')
    } finally {
      setIsPreparingPortalEmail(false)
    }
  }

  async function handleCopyPortalInviteEmail() {
    const draft = portalEmailDraft?.draft

    if (!draft) return

    const text = `To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.bodyText}`

    try {
      await navigator.clipboard.writeText(text)
      setNotice('Portal invite email copied.')
    } catch {
      setNotice('Copy the email manually from the draft box.')
    }
  }

  function handleOpenPortalInviteEmail() {
    const draft = portalEmailDraft?.draft

    if (!draft) return

    const mailto = `mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(
      draft.subject,
    )}&body=${encodeURIComponent(draft.bodyText)}`

    window.location.href = mailto
  }

  async function handleMarkPortalEmailSent() {
    const emailLogId = portalEmailDraft?.emailLog?.id

    if (!emailLogId) return

    setIsMarkingPortalEmailSent(true)
    setNotice('')
    setError('')

    try {
      await markAdminPortalEmailLogSent(emailLogId)
      await loadPortalEmailLogs(selectedClient)
      setNotice('Portal invite email marked as sent.')
    } catch (emailError) {
      setError(emailError.message || 'Unable to mark this email as sent.')
    } finally {
      setIsMarkingPortalEmailSent(false)
    }
  }

  async function handleSendPortalInviteEmailNow(invite) {
    if (!invite?.id) return

    setIsSendingPortalEmailNow(true)
    setNotice('')
    setError('')

    try {
      await sendAdminPortalInviteEmail(invite.id)
      await Promise.all([
        loadPortalEmailLogs(selectedClient),
        loadPortalInvites(selectedClient),
      ])

      setNotice('Portal invite email sent to the client.')
    } catch (emailError) {
      setError(emailError.message || 'Unable to send the portal invite email.')
    } finally {
      setIsSendingPortalEmailNow(false)
    }
  }

  const clientCirclePageClassName = [
    'client-circle-page-v2',
    'admin-clients-rework-v1',
    isClientFormOpen ? 'is-client-form-open-v2' : '',
    selectedClient ? 'is-client-detail-open-v2' : '',
    selectedClient ? `is-client-detail-${clientDetailSection}-v2` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <AdminFrame>
      <div className={clientCirclePageClassName}>
        <header className="client-circle-hero-v2">
          <div>
            <p className="admin-eyebrow">Client Circle</p>
            <h1>Client Circle</h1>
            <p>
              Care for private client records, notes, and access with clarity.
              This is the foundation for portal access, service history, notes,
              tags, and future course assignments.
            </p>
          </div>

          <div className="client-circle-metrics-v2">
            {metrics.map((metric) => (
              <article key={metric.label} className="client-circle-metric-v2">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </div>
        </header>

        {(notice || error) && (
          <div
            className={
              error
                ? 'client-circle-message-v2 is-error'
                : 'client-circle-message-v2'
            }
          >
            {error || notice}
          </div>
        )}

        <section className="client-circle-workspace-v2">
          {isClientFormOpen && (
          <article className="client-circle-card-v2 client-form-card-v2 client-form-drawer-v2">
            <div className="client-card-header-v2 is-horizontal client-form-drawer-header-v2">
              <div>
                <p className="admin-eyebrow">Welcome someone in</p>
                <h2>{editingClient ? 'Edit Client Profile' : 'New Client Profile'}</h2>
              </div>

              <button
                type="button"
                className="client-form-close-v2"
                onClick={handleCloseClientForm}
              >
                Close
              </button>
            </div>

            <form className="client-circle-form-v2" onSubmit={handleSubmit}>
              <div className="client-form-grid-v2">
                <label>
                  <span>First Name</span>
                  <input
                    value={form.firstName}
                    onChange={(event) => updateForm('firstName', event.target.value)}
                    placeholder="First name"
                  />
                </label>

                <label>
                  <span>Last Name</span>
                  <input
                    value={form.lastName}
                    onChange={(event) => updateForm('lastName', event.target.value)}
                    placeholder="Last name"
                  />
                </label>
              </div>

              <div className="client-form-grid-v2">
                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm('email', event.target.value)}
                    placeholder="client@email.com"
                    disabled={Boolean(editingClient)}
                    required={!editingClient}
                  />
                </label>

                <label>
                  <span>Phone</span>
                  <input
                    value={form.phone}
                    onChange={(event) => updateForm('phone', event.target.value)}
                    placeholder="Phone number"
                  />
                </label>
              </div>

              <label>
                <span>Client Status</span>
                <select
                  value={normalizeStatusValue(form.clientStatus)}
                  onChange={(event) => updateForm('clientStatus', event.target.value)}
                >
                  {clientStatusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Private Admin Notes</span>
                <textarea
                  value={form.privateAdminNotes}
                  onChange={(event) =>
                    updateForm('privateAdminNotes', event.target.value)
                  }
                  placeholder="Internal notes only visible to admin."
                  rows={5}
                />
              </label>

              <label>
                <span>Client Visible Notes</span>
                <textarea
                  value={form.clientVisibleNotes}
                  onChange={(event) =>
                    updateForm('clientVisibleNotes', event.target.value)
                  }
                  placeholder="Notes that may later appear inside the client portal."
                  rows={4}
                />
              </label>

              <div className="client-form-actions-v2">
                <button type="button" onClick={handleCloseClientForm}>
                  {editingClient ? 'Cancel Edit' : 'Close Form'}
                </button>

                <button type="submit" disabled={isSaving}>
                  {isSaving
                    ? 'Saving...'
                    : selectedClient
                      ? 'Save Client Profile'
                      : 'Welcome Someone Into Profile'}
                </button>
              </div>
            </form>
          </article>
          )}

          <article className="client-circle-card-v2 client-records-card-v2">
            <div className="client-card-header-v2 is-horizontal">
              <div>
                <p className="admin-eyebrow">Client Records</p>
                <h2>Private Client Records</h2>
              </div>

              <div className="client-record-header-actions-v2">
                <span>
                  {hasClientFilters
                    ? `${filteredClients.length} of ${clients.length} shown`
                    : `${clients.length} record(s)`}
                </span>

                <button type="button" onClick={handleOpenNewClientForm}>
                  + New Client
                </button>
              </div>
            </div>

            <div className="client-circle-filter-bar-v2">
              <label className="client-circle-search-v2">
                <span>Search Client Circle</span>
                <input
                  type="search"
                  value={clientSearchTerm}
                  onChange={(event) => setClientSearchTerm(event.target.value)}
                  placeholder="Search name, email, phone, or status..."
                />
              </label>

              <label>
                <span>Interest</span>
                <select
                  value={clientInterestFilter}
                  onChange={(event) => setClientInterestFilter(event.target.value)}
                >
                  <option value="all">All interests</option>
                  {clientInterestOptions
                    .filter((interest) => interest !== 'all')
                    .map((interest) => (
                      <option key={interest} value={interest}>
                        {interest}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <span>Client Status</span>
                <select
                  value={clientStatusFilter}
                  onChange={(event) => setClientStatusFilter(event.target.value)}
                >
                  <option value="all">All client statuses</option>
                  {clientStatusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Portal Status</span>
                <select
                  value={portalStatusFilter}
                  onChange={(event) => setPortalStatusFilter(event.target.value)}
                >
                  {portalStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status === 'all'
                        ? 'All portal statuses'
                        : formatPortalStatus(status)}
                    </option>
                  ))}
                </select>
              </label>

              {hasClientFilters && (
                                <button type="button" onClick={handleClearClientFilters}>
                  Clear Filters
                </button>
              )}
            </div>

            <div className="client-quick-filter-strip-v2" aria-label="Quick client filters">
              <button
                type="button"
                className={(!hasClientFilters ? 'is-active ' : '') + 'client-quick-filter-chip-v2'}
                onClick={handleClearClientFilters}
              >
                <span>All</span>
                <strong>{quickClientFilterStats.all}</strong>
              </button>

              <button
                type="button"
                className={(clientStatusFilter === 'lead' && portalStatusFilter === 'all' && clientInterestFilter === 'all' ? 'is-active ' : '') + 'client-quick-filter-chip-v2'}
                onClick={() => handleQuickClientStatusFilter('lead')}
              >
                <span>Leads</span>
                <strong>{quickClientFilterStats.leads}</strong>
              </button>

              <button
                type="button"
                className={(clientStatusFilter === 'active' && portalStatusFilter === 'all' && clientInterestFilter === 'all' ? 'is-active ' : '') + 'client-quick-filter-chip-v2'}
                onClick={() => handleQuickClientStatusFilter('active')}
              >
                <span>Active</span>
                <strong>{quickClientFilterStats.active}</strong>
              </button>

              <button
                type="button"
                className={(clientStatusFilter === 'all' && portalStatusFilter === 'invited' && clientInterestFilter === 'all' ? 'is-active ' : '') + 'client-quick-filter-chip-v2'}
                onClick={() => handleQuickPortalStatusFilter('invited')}
              >
                <span>Invited</span>
                <strong>{quickClientFilterStats.invited}</strong>
              </button>

              <button
                type="button"
                className={(clientStatusFilter === 'all' && portalStatusFilter === 'active' && clientInterestFilter === 'all' ? 'is-active ' : '') + 'client-quick-filter-chip-v2'}
                onClick={() => handleQuickPortalStatusFilter('active')}
              >
                <span>Portal Active</span>
                <strong>{quickClientFilterStats.portalActive}</strong>
              </button>
            </div>
            {selectedClientIsHiddenByFilters && (
              <p className="client-circle-filter-note-v2">
                {selectedClient.name} is still open below, but hidden from this
                filtered table view.
              </p>
            )}

            {isLoading ? (
              <p className="client-empty-v2">Loading private client records...</p>
            ) : clients.length === 0 ? (
              <p className="client-empty-v2">
                No client records yet. Welcome someone into the Client Circle to
                begin.
              </p>
            ) : filteredClients.length === 0 ? (
              <p className="client-empty-v2">
                No clients match the current filters. Clear the filters or try a
                different search.
              </p>
            ) : (
              <div className="client-record-table-wrap-v2">
                <table className="client-record-table-v2">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Interest</th>
                      <th>Client Status</th>
                      <th>Portal Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredClients.map((client) => (
                      <tr
                        key={client.id}
                        className={
                          selectedClient?.id === client.id ? 'is-selected' : ''
                        }
                        onClick={(event) => {
                          if (event.target.closest('.client-action-menu-v1')) return
                          handleViewClient(client)
                        }}
                      >
                        <td data-label="Name">
                          <strong>{client.name}</strong>
                        </td>
                        <td data-label="Email">{getClientEmailDisplay(client) || 'No email'}</td>
                        <td data-label="Interest">
                          <span className="client-interest-pill-v1">
                            {getLeadInterestLabel(client)}
                          </span>
                        </td>
                        <td data-label="Client Status">
                          {formatStatus(client.clientStatus)}
                        </td>
                        <td data-label="Portal Status">
                          <span
                            className={
                              'client-portal-status-pill-v2 ' +
                              getPortalStatusTone(client.portalStatus)
                            }
                          >
                            {client.portalStatus}
                          </span>
                        </td>
                        <td data-label="Action" className="client-action-cell-v1">
                          <details className="client-action-menu-v1" onToggle={handleClientActionMenuToggle}>
                            <summary className="client-action-menu-button-v1" aria-label="Open client menu">
                              <span aria-hidden="true">⋯</span>
                            </summary>

                            <div className="client-action-menu-panel-v1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.currentTarget.closest('details')?.removeAttribute('open')
                                  handleViewClient(client)
                                }}
                              >
                                View Profile
                              </button>

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.currentTarget.closest('details')?.removeAttribute('open')
                                  handleEditClient(client)
                                }}
                              >
                                Edit Profile
                              </button>
                            </div>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>

        <section className="client-circle-detail-v2" aria-hidden={!selectedClient}>
          {selectedClient ? (
            <article className="client-circle-card-v2 client-detail-card-v2">
              <div className="client-card-header-v2 is-horizontal">
                <div>
                  <p className="admin-eyebrow">Care Timeline</p>
                  <h2>{selectedClient.name}</h2>
                </div>

                <div className="client-detail-header-actions-v2">
                  <button
                    type="button"
                    className="client-detail-edit-shortcut-v2"
                    onClick={() => handleEditClient(selectedClient)}
                  >
                    Edit Profile
                  </button>

                  <button type="button" onClick={handleBackToClientRecords}>
                    Back to Records
                  </button>

                  <button type="button" onClick={handleNewProfile}>
                    Close
                  </button>
                </div>
              </div>

                            <nav className="client-detail-jump-nav-v2" aria-label="Client profile sections">
                <button
                  type="button"
                  className={clientDetailSection === 'overview' ? 'is-active' : ''}
                  onClick={() => setClientDetailSection('overview')}
                >
                  Overview
                </button>

                <button
                  type="button"
                  className={clientDetailSection === 'notes' ? 'is-active' : ''}
                  onClick={() => setClientDetailSection('notes')}
                >
                  Notes
                </button>

                <button
                  type="button"
                  className={clientDetailSection === 'portal' ? 'is-active' : ''}
                  onClick={() => setClientDetailSection('portal')}
                >
                  Portal
                </button>

                <button
                  type="button"
                  className={clientDetailSection === 'activity' ? 'is-active' : ''}
                  onClick={() => setClientDetailSection('activity')}
                >
                  Activity
                </button>
              </nav>

              <div className="client-profile-quick-actions-v2" aria-label="Client quick actions">
                <button type="button" onClick={handleCopySelectedClientEmail}>
                  Copy Email
                </button>

                <button type="button" onClick={handleEmailSelectedClient}>
                  Email Client
                </button>

                <button type="button" onClick={handleCopySelectedClientPhone}>
                  Copy Phone
                </button>
              </div>

              <div className="client-detail-grid-v2">
                <div>
                  <span>Email</span>
                  <strong>{selectedClient.email || 'No email saved'}</strong>
                </div>

                <div>
                  <span>Phone</span>
                  <strong>{selectedClient.phone || 'No phone saved'}</strong>
                </div>

                <div>
                  <span>Client Status</span>
                  <strong>{formatStatus(selectedClient.clientStatus)}</strong>
                </div>

                <div>
                  <span>Portal Status</span>
                  <strong>{selectedClient.portalStatus}</strong>
                </div>
              </div>

              {/* phase-3-6b-care-highlights-start */}
              <div className="client-care-highlights-v2">
                <article className="is-featured">
                  <span>Next / Latest Session</span>
                  <strong>
                    {latestBooking?.appointment_type_name || 'No session yet'}
                  </strong>
                  <p>
                    {latestBooking
                      ? formatDateTime(
                          latestBooking.starts_at || latestBooking.created_at,
                        )
                      : 'Connected sessions will appear here as this client grows.'}
                  </p>
                </article>

                <article>
                  <span>Last Activity</span>
                  <strong>{lastTimelineItem?.title || 'No activity yet'}</strong>
                  <p>
                    {lastTimelineItem
                      ? formatDateTime(lastTimelineItem.timestamp)
                      : 'Recent profile, booking, and journal activity will appear here.'}
                  </p>
                </article>

                <article>
                  <span>Profile Stage</span>
                  <strong>{formatStatus(selectedClient.clientStatus)}</strong>
                  <p>
                    Portal status: {selectedClient.portalStatus || 'invited'}
                  </p>
                </article>
              </div>
              {/* phase-3-6b-care-highlights-end */}

              <div className="client-care-summary-v2">
                <article>
                  <span>Sessions</span>
                  <strong>{bookingCount}</strong>
                  <p>Connected session requests and bookings.</p>
                </article>

                <article>
                  <span>Journal Events</span>
                  <strong>{auditCount}</strong>
                  <p>Recent Studio activity connected to this profile.</p>
                </article>

                <article>
                  <span>Timeline Items</span>
                  <strong>{timelineItems.length}</strong>
                  <p>Profile, booking, service, and activity history.</p>
                </article>
              </div>

              <div className="client-notes-grid-v2">
                <section>
                  <h3>Private Admin Notes</h3>
                  <p>
                    {selectedClient.privateAdminNotes ||
                      'No private admin notes yet.'}
                  </p>
                </section>

                <section>
                  <h3>Client Visible Notes</h3>
                  <p>
                    {selectedClient.clientVisibleNotes ||
                      'No client-visible notes yet.'}
                  </p>
                </section>

                <section>
                  <h3>Portal Readiness</h3>
                  <p>
                    This profile is prepared for future portal access, course
                    assignments, service history, and client-facing notes.
                  </p>
                </section>
              </div>



              {/* phase-3-7-service-records-ui-start */}
              {/* phase-3-9a-portal-invite-ui-start */}
              <div className="client-portal-invite-v2">
                <div>
                  <p className="admin-eyebrow">Client Portal</p>
                  <h3>{portalAccessIsActive ? 'Portal Access' : 'Portal Invitation'}</h3>
                  <p>
                    {portalAccessIsActive
                      ? 'This client already has active portal access. Share the login link when they need to return to their Client Circle.'
                      : 'Create a secure one-time setup link for this client. After they accept and create a password, future links should send them to login.'}
                  </p>
                </div>

                <div className="client-portal-invite-actions-v2">
                  <button
                    type="button"
                    onClick={handleCreatePortalInvite}
                    disabled={isCreatingPortalInvite}
                  >
                    {isCreatingPortalInvite
                      ? 'Preparing Link...'
                      : portalAccessIsActive
                        ? 'Get Login Link'
                        : 'Create Portal Invite'}
                  </button>
                </div>

                {portalInvite?.inviteLink && (
                  <div className="client-portal-link-box-v2">
                    <label>
                      <span>{portalAccessLinkLabel}</span>
                      <input value={getPortalAccessLinkFromResponse(portalInvite)} readOnly />
                    </label>

                    <button type="button" onClick={handleCopyPortalInvite}>
                      {portalAccessIsActive ? 'Copy Login Link' : 'Copy Setup Link'}
                    </button>
                  </div>
                )}
              </div>
              {/* phase-3-9a-portal-invite-ui-end */}

              {/* phase-3-9h-portal-invite-management-ui-start */}
              <div className="client-portal-invite-history-v2">
                <div className="client-timeline-header-v2">
                  <div>
                    <p className="admin-eyebrow">Client Portal</p>
                    <h3>{portalAccessIsActive ? 'Portal Access History' : 'Invite History'}</h3>
                  </div>

                  <span>{portalInvites.length} invite(s)</span>
                </div>

                {isLoadingPortalInvites ? (
                  <p className="client-portal-invite-empty-v2">
                    Loading invite history...
                  </p>
                ) : portalInvites.length === 0 ? (
                  <p className="client-portal-invite-empty-v2">
                    No portal invites have been created for this client yet.
                  </p>
                ) : (
                  <>
                    <div
                      className={
                        'client-portal-latest-invite-v2 ' +
                        getPortalInviteStatusTone(latestPortalInvite?.status)
                      }
                    >
                      <div>
                        <span>Latest Invite</span>
                        <strong>
                          {formatPortalInviteStatus(latestPortalInvite?.status)}
                        </strong>
                        <p>
                          Created {formatDateTime(latestPortalInvite?.created_at)}
                          {latestPortalInvite?.created_by_email
                            ? ` by ${latestPortalInvite.created_by_email}`
                            : ''}
                        </p>

                        <p>
                          Expires {formatDateTime(latestPortalInvite?.expires_at)}
                        </p>

                        {latestPortalInvite?.accepted_at && (
                          <p>
                            Accepted {formatDateTime(latestPortalInvite.accepted_at)}
                          </p>
                        )}

                        {latestPortalInvite?.revoked_at && (
                          <p>
                            Revoked {formatDateTime(latestPortalInvite.revoked_at)}
                          </p>
                        )}
                      </div>

                      <div className="client-portal-invite-actions-v2">
                        {latestPortalInvite?.status === 'accepted' ? (
                          <button
                            type="button"
                            onClick={handleCopyActivePortalLoginLink}
                            disabled={isCreatingPortalInvite}
                          >
                            {isCreatingPortalInvite
                              ? 'Preparing...'
                              : 'Copy Login Link'}
                          </button>
                        ) : (
                          latestPortalInvite?.invite_link && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyPortalInviteLink(
                                  latestPortalInvite.invite_link,
                                )
                              }
                            >
                              Copy Setup Link
                            </button>
                          )
                        )}

                        {latestPortalInvite?.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                handleSendPortalInviteEmailNow(latestPortalInvite)
                              }
                              disabled={isSendingPortalEmailNow}
                            >
                              {isSendingPortalEmailNow
                                ? 'Sending...'
                                : 'Send Email Now'}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handlePreparePortalInviteEmail(latestPortalInvite)
                              }
                              disabled={isPreparingPortalEmail}
                            >
                              {isPreparingPortalEmail
                                ? 'Preparing...'
                                : 'Email Invite'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRevokePortalInvite(latestPortalInvite)}
                              disabled={isRevokingPortalInvite}
                            >
                              {isRevokingPortalInvite ? 'Revoking...' : 'Revoke Invite'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="client-portal-invite-list-v2">
                      {portalInvites.map((invite) => (
                        <article
                          key={invite.id}
                          className={getPortalInviteStatusTone(invite.status)}
                        >
                          <div>
                            <span>{formatPortalInviteStatus(invite.status)}</span>
                            <strong>
                              {invite.invite_token_preview || 'Portal Invite'}
                            </strong>
                            <p>Created {formatDateTime(invite.created_at)}</p>
                            <p>Expires {formatDateTime(invite.expires_at)}</p>
                          </div>

                          <div className="client-portal-invite-row-actions-v2">
                            {invite.invite_link && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyPortalInviteLink(invite.invite_link)
                                }
                              >
                                {String(invite.status || '').toLowerCase() === 'accepted'
                                  ? 'Copy Login Link'
                                  : 'Copy Setup Link'}
                              </button>
                            )}

                            {invite.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => handleRevokePortalInvite(invite)}
                                disabled={isRevokingPortalInvite}
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {/* phase-3-9h-portal-invite-management-ui-end */}

              {/* phase-3-9i-portal-invite-email-ui-start */}
              <div className="client-portal-email-draft-v2">
                <div className="client-timeline-header-v2">
                  <div>
                    <p className="admin-eyebrow">Client Portal</p>
                    <h3>Invite Email Composer</h3>
                  </div>

                  <span>{portalEmailLogs.length} email log(s)</span>
                </div>

                {!portalEmailDraft ? (
                  <p className="client-portal-email-empty-v2">
                    Choose a pending invite above and click Email Invite to
                    prepare a branded setup message.
                  </p>
                ) : (
                  <div className="client-portal-email-compose-fields-v2">
                    <label>
                      <span>To</span>
                      <input value={portalEmailDraft.draft.to} readOnly />
                    </label>

                    <label>
                      <span>Subject</span>
                      <input value={portalEmailDraft.draft.subject} readOnly />
                    </label>

                    <label className="is-wide">
                      <span>Email Body</span>
                      <textarea
                        value={portalEmailDraft.draft.bodyText}
                        readOnly
                        rows={10}
                      />
                    </label>

                    <div className="client-portal-email-actions-v2">
                      <button type="button" onClick={handleCopyPortalInviteEmail}>
                        Copy Email
                      </button>

                      <button type="button" onClick={handleOpenPortalInviteEmail}>
                        Open Email App
                      </button>

                      <button
                        type="button"
                        onClick={handleMarkPortalEmailSent}
                        disabled={isMarkingPortalEmailSent}
                      >
                        {isMarkingPortalEmailSent
                          ? 'Marking...'
                          : 'Mark as Sent'}
                      </button>
                    </div>
                  </div>
                )}

                {portalEmailLogs.length > 0 && (
                  <div className="client-portal-email-log-list-v2">
                    {portalEmailLogs.slice(0, 5).map((log) => (
                      <article key={log.id}>
                        <div>
                          <span>{log.status}</span>
                          <strong>{log.subject}</strong>
                          <p>{log.email_to}</p>
                        </div>

                        <time>{formatDateTime(log.sent_at || log.created_at)}</time>
                      </article>
                    ))}
                  </div>
                )}
              </div>
              {/* phase-3-9i-portal-invite-email-ui-end */}

              {/* phase-3-9d-client-portal-resources-ui-start */}
              <div className="client-portal-resources-v2">
                <div className="client-timeline-header-v2">
                  <div>
                    <p className="admin-eyebrow">Client Portal</p>
                    <h3>{editingPortalResource ? 'Edit Assigned Resource' : 'Assigned Resources'}</h3>
                  </div>

                  <span>{portalResources.length} saved</span>
                </div>

                <div className="client-portal-resource-filters-v2">
                  {[
                    ['active', 'Active'],
                    ['archived', 'Archived'],
                    ['all', 'All'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={portalResourceFilter === value ? 'is-active' : ''}
                      onClick={() => setPortalResourceFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {editingPortalResource && (
                  <div className="client-portal-resource-editing-notice-v2">
                    <div>
                      <span>Editing Resource</span>
                      <strong>{editingPortalResource.title}</strong>
                    </div>

                    <button type="button" onClick={handleCancelPortalResourceEdit}>
                      Cancel Edit
                    </button>
                  </div>
                )}

                <form
                  className="client-portal-resource-form-v2"
                  onSubmit={handleCreatePortalResource}
                >
                  <label>
                    <span>Resource Title</span>
                    <input
                      value={portalResourceForm.title}
                      onChange={(event) =>
                        setPortalResourceForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Example: Personal presence worksheet"
                      required
                    />
                  </label>

                  <label>
                    <span>Resource Type</span>
                    <select
                      value={portalResourceForm.resourceType}
                      onChange={(event) =>
                        setPortalResourceForm((current) => ({
                          ...current,
                          resourceType: event.target.value,
                        }))
                      }
                    >
                      <option value="guide">Guide</option>
                      <option value="worksheet">Worksheet</option>
                      <option value="link">Link</option>
                      <option value="video">Video</option>
                      <option value="reminder">Reminder</option>
                      <option value="note">Note</option>
                    </select>
                  </label>

                  <label>
                    <span>Resource Link</span>
                    <input
                      value={portalResourceForm.resourceUrl}
                      onChange={(event) =>
                        setPortalResourceForm((current) => ({
                          ...current,
                          resourceUrl: event.target.value,
                        }))
                      }
                      placeholder="https://..."
                    />
                  </label>

                  <label className="is-wide">
                    <span>Description</span>
                    <textarea
                      value={portalResourceForm.description}
                      onChange={(event) =>
                        setPortalResourceForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Short client-facing explanation."
                      rows={3}
                    />
                  </label>

                  <button type="submit" disabled={isSavingPortalResource}>
                    {isSavingPortalResource
                      ? 'Saving Resource...'
                      : editingPortalResource
                        ? 'Save Resource'
                        : 'Assign Resource'}
                  </button>
                </form>

                <div className="client-portal-resource-list-v2">
                  {portalResources.length === 0 ? (
                    <p>No portal resources assigned yet.</p>
                  ) : visiblePortalResources.length === 0 ? (
                    <p>No resources match this filter yet.</p>
                  ) : (
                    visiblePortalResources.map((resource) => (
                      <article
                        key={resource.id}
                        className={resource.status === 'archived' ? 'is-archived' : ''}
                      >
                        <div>
                          <span>{formatPortalResourceType(resource.resource_type)}</span>
                          <h4>{resource.title}</h4>
                          <p>{resource.description || 'No description saved.'}</p>
                          {resource.resource_url && (
                            <a
                              href={resource.resource_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open Resource
                            </a>
                          )}
                        </div>

                        <div className="client-portal-resource-actions-v2">
                          <button
                            type="button"
                            onClick={() => handleEditPortalResource(resource)}
                            disabled={isSavingPortalResource}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleTogglePortalResource(resource)}
                            disabled={isSavingPortalResource}
                          >
                            {resource.status === 'archived' ? 'Restore' : 'Archive'}
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
              {/* phase-3-9d-client-portal-resources-ui-end */}

              <div className="client-service-records-v2">
                <div className="client-timeline-header-v2">
                  <div>
                    <p className="admin-eyebrow">Service Records</p>
                    <h3>{editingServiceRecord ? 'Edit Client History' : 'Add Client History'}</h3>
                  </div>

                  <span>{serviceRecords.length} saved</span>
                </div>

                <div className="client-service-filters-v2">
                  {[
                    ['active', 'Active'],
                    ['all', 'All'],
                    ['completed', 'Completed'],
                    ['planned', 'Planned'],
                    ['follow_up', 'Follow-Up'],
                    ['archived', 'Archived'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={serviceRecordFilter === value ? 'is-active' : ''}
                      onClick={() => setServiceRecordFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {editingServiceRecord && (
                  <div className="client-service-editing-notice-v2">
                    <div>
                      <span>Editing Service Record</span>
                      <strong>
                        {editingServiceRecord.title ||
                          editingServiceRecord.service_name ||
                          'Saved Service Record'}
                      </strong>
                    </div>

                    <button type="button" onClick={handleCancelServiceEdit}>
                      Cancel Edit
                    </button>
                  </div>
                )}

                <form
                  className="client-service-form-v2"
                  onSubmit={handleCreateServiceRecord}
                >
                  <div className="client-service-grid-v2">
                    <label>
                      <span>Record Title</span>
                      <input
                        value={serviceForm.title}
                        onChange={(event) =>
                          updateServiceForm('title', event.target.value)
                        }
                        placeholder="Color analysis recap"
                        required
                      />
                    </label>

                    <label>
                      <span>Service Type</span>
                      <select
                        value={serviceForm.serviceType}
                        onChange={(event) =>
                          updateServiceForm('serviceType', event.target.value)
                        }
                      >
                        {serviceTypeOptions.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Service Date</span>
                      <input
                        type="datetime-local"
                        value={serviceForm.serviceDate}
                        onChange={(event) =>
                          updateServiceForm('serviceDate', event.target.value)
                        }
                      />
                    </label>

                    <label>
                      <span>Status</span>
                      <select
                        value={serviceForm.status}
                        onChange={(event) =>
                          updateServiceForm('status', event.target.value)
                        }
                      >
                        {serviceStatusOptions.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label>
                    <span>Summary</span>
                    <textarea
                      value={serviceForm.summary}
                      onChange={(event) =>
                        updateServiceForm('summary', event.target.value)
                      }
                      placeholder="What happened in this session, appointment, or follow-up?"
                      rows={3}
                    />
                  </label>

                  <div className="client-service-grid-v2">
                    <label>
                      <span>Private Staff Notes</span>
                      <textarea
                        value={serviceForm.privateNotes}
                        onChange={(event) =>
                          updateServiceForm('privateNotes', event.target.value)
                        }
                        placeholder="Internal notes for the studio only."
                        rows={3}
                      />
                    </label>

                    <label>
                      <span>Client Visible Notes</span>
                      <textarea
                        value={serviceForm.clientVisibleNotes}
                        onChange={(event) =>
                          updateServiceForm(
                            'clientVisibleNotes',
                            event.target.value,
                          )
                        }
                        placeholder="Future client-portal-facing notes."
                        rows={3}
                      />
                    </label>
                  </div>

                  <div className="client-service-footer-v2">
                    <label>
                      <span>Follow-Up Reminder</span>
                      <input
                        type="datetime-local"
                        value={serviceForm.followUpAt}
                        onChange={(event) =>
                          updateServiceForm('followUpAt', event.target.value)
                        }
                      />
                    </label>

                    <button type="submit" disabled={isSavingService}>
                      {isSavingService
                        ? 'Saving Record...'
                        : editingServiceRecord
                          ? 'Save Service Record'
                          : 'Add Service Record'}
                    </button>
                  </div>
                </form>

                <div className="client-service-list-v2">
                  {serviceRecords.length === 0 ? (
                    <p>
                      No service records yet. Add consultation notes, appointment
                      outcomes, resources assigned, or follow-up reminders here.
                    </p>
                  ) : visibleServiceRecords.length === 0 ? (
                    <p>
                      No service records match this filter yet.
                    </p>
                  ) : (
                    visibleServiceRecords.map((record) => (
                      <article
                        key={record.id}
                        className={
                          editingServiceRecord?.id === record.id
                            ? 'is-editing'
                            : ''
                        }
                      >
                        <div>
                          <span>{formatServiceType(record.service_type)}</span>
                          <h4>{record.title || record.service_name || 'Service Record'}</h4>

                          <div className="client-service-record-meta-v2">
                            <em>{formatServiceStatus(record.status)}</em>
                            {record.follow_up_at && (
                              <em>Follow-up: {formatDateTime(record.follow_up_at)}</em>
                            )}
                          </div>

                          <p>
                            {record.summary ||
                              record.notes ||
                              record.private_notes ||
                              'No summary saved for this record yet.'}
                          </p>
                        </div>

                        <div className="client-service-record-actions-v2">
                          <time>
                            {formatDateTime(
                              record.service_date ||
                                record.occurred_at ||
                                record.created_at,
                            )}
                          </time>

                          <button
                            type="button"
                            onClick={() => handleEditServiceRecord(record)}
                          >
                            Edit Record
                          </button>

                          {normalizeServiceStatus(record.status) !== 'follow_up' &&
                            normalizeServiceStatus(record.status) !== 'archived' && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickServiceStatus(record, 'follow_up')
                                }
                              >
                                Mark Follow-Up
                              </button>
                            )}

                          {normalizeServiceStatus(record.status) === 'archived' ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickServiceStatus(record, 'completed')
                              }
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickServiceStatus(record, 'archived')
                              }
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
              {/* phase-3-7-service-records-ui-end */}

              <div className="client-timeline-v2">
                <div className="client-timeline-header-v2">
                  <div>
                    <p className="admin-eyebrow">History</p>
                    <h3>Care Timeline</h3>
                  </div>

                  {isTimelineLoading && <span>Loading timeline...</span>}
                </div>

                {careTimeline?.error ? (
                  <p className="client-empty-v2">{careTimeline.error}</p>
                ) : timelineItems.length === 0 ? (
                  <p className="client-empty-v2">
                    No timeline entries yet. Session history and activity will
                    appear here as this profile grows.
                  </p>
                ) : (
                  <ol>
                    {timelineItems.map((item) => (
                      <li key={item.id}>
                        <div>
                          <span>{formatTimelineType(item.type)}</span>
                          <strong>{item.title}</strong>
                          <p>{item.description}</p>
                          {item.status && <em>{String(item.status)}</em>}
                        </div>

                        <time>{formatDateTime(item.timestamp)}</time>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </article>
          ) : (
            <article className="client-circle-card-v2 client-detail-card-v2">
              <p className="admin-eyebrow">Care Notes</p>
              <h2>Select someone from the Client Circle to view and care for their profile.</h2>
              <p>
                Private notes, portal-facing notes, profile details, booking
                history, and activity timeline will appear here.
              </p>
            </article>
          )}
        </section>
      </div>
    </AdminFrame>
  )
}
























