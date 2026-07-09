const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:8787')

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const data = isJson ? await response.json() : null

  if (!response.ok) {
    const message = data?.error || data?.message || `Request failed with status ${response.status}`
    throw new Error(message)
  }

  return data
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  return parseResponse(response)
}

export async function loginAdmin({ email, password }) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
    }),
  })
}

export async function getCurrentUser() {
  return apiRequest('/api/auth/me')
}

export async function checkAdminAccess() {
  return apiRequest('/api/auth/admin-check')
}

export async function checkFounderAccess() {
  return apiRequest('/api/auth/founder-check')
}

export async function logoutAdmin() {
  return apiRequest('/api/auth/logout', {
    method: 'POST',
  })
}

export async function getAdminOverview() {
  return apiRequest('/api/admin/overview')
}

export async function getAdminClients() {
  return apiRequest('/api/admin/clients')
}

export async function getAdminClient(clientId) {
  return apiRequest(`/api/admin/clients/${clientId}`)
}

export async function createAdminClient(client) {
  return apiRequest('/api/admin/clients', {
    method: 'POST',
    body: JSON.stringify(client),
  })
}

export async function updateAdminClient(clientId, client) {
  return apiRequest(`/api/admin/clients/${clientId}`, {
    method: 'PATCH',
    body: JSON.stringify(client),
  })
}

export async function getAdminAuditLogs() {
  return apiRequest('/api/admin/audit-logs')
}

export async function getAdminAppointmentTypes() {
  return apiRequest('/api/admin/appointment-types')
}

export async function createAdminAppointmentType(appointmentType) {
  return apiRequest('/api/admin/appointment-types', {
    method: 'POST',
    body: JSON.stringify(appointmentType),
  })
}

export async function updateAdminAppointmentType(appointmentTypeId, appointmentType) {
  return apiRequest(`/api/admin/appointment-types/${appointmentTypeId}`, {
    method: 'PATCH',
    body: JSON.stringify(appointmentType),
  })
}

export async function getAdminAvailabilityBlocks() {
  return apiRequest('/api/admin/availability-blocks')
}

export async function createAdminAvailabilityBlock(availabilityBlock) {
  return apiRequest('/api/admin/availability-blocks', {
    method: 'POST',
    body: JSON.stringify(availabilityBlock),
  })
}

export async function updateAdminAvailabilityBlock(availabilityBlockId, availabilityBlock) {
  return apiRequest(`/api/admin/availability-blocks/${availabilityBlockId}`, {
    method: 'PATCH',
    body: JSON.stringify(availabilityBlock),
  })
}

export async function getPublicAppointmentTypes() {
  return apiRequest('/api/public/appointment-types')
}

export async function createPublicBookingRequest(bookingRequest) {
  return apiRequest('/api/public/booking-requests', {
    method: 'POST',
    body: JSON.stringify(bookingRequest),
  })
}

export async function getAdminBookings() {
  return apiRequest('/api/admin/bookings')
}

export async function updateAdminBookingStatus(bookingId, bookingStatus) {
  return apiRequest(`/api/admin/bookings/${bookingId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(bookingStatus),
  })
}

export async function welcomeBookingIntoClientCircle(bookingId) {
  return apiRequest(`/api/admin/bookings/${bookingId}/welcome-client-profile`, {
    method: 'POST',
  })
}

export async function getAdminClientCareTimeline(clientId) {
  return apiRequest(`/api/admin/clients/${clientId}/care-timeline`)
}

export async function getAdminClientServiceRecords(clientId) {
  return apiRequest(`/api/admin/clients/${clientId}/service-records`)
}

export async function createAdminClientServiceRecord(clientId, payload) {
  return apiRequest(`/api/admin/clients/${clientId}/service-records`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminServiceRecord(serviceRecordId, payload) {
  return apiRequest(`/api/admin/service-records/${serviceRecordId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function getAdminFollowUps() {
  return apiRequest('/api/admin/follow-ups')
}

export async function createAdminClientPortalInvite(clientId, payload = {}) {
  return apiRequest(`/api/admin/clients/${clientId}/portal-invite`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getPublicClientPortalInvite(token) {
  return apiRequest(`/api/public/client-portal/invites/${token}`)
}

export async function acceptPublicClientPortalInvite(token, payload) {
  return apiRequest(`/api/public/client-portal/invites/${token}/accept`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// phase-3-9c-client-portal-api-start
export async function loginClientPortal(payload) {
  return apiRequest('/api/public/client-portal/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logoutClientPortal() {
  return apiRequest('/api/public/client-portal/logout', {
    method: 'POST',
  })
}

export async function getClientPortalMe() {
  return apiRequest('/api/public/client-portal/me')
}

export async function getClientPortalDashboard() {
  return apiRequest('/api/public/client-portal/dashboard')
}
// phase-3-9c-client-portal-api-end

// phase-3-9d-client-portal-resource-api-start
export async function getAdminClientPortalResources(clientId) {
  return apiRequest(`/api/admin/clients/${clientId}/portal-resources`)
}

export async function createAdminClientPortalResource(clientId, payload) {
  return apiRequest(`/api/admin/clients/${clientId}/portal-resources`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminClientPortalResource(resourceId, payload) {
  return apiRequest(`/api/admin/portal-resources/${resourceId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function getClientPortalResources() {
  return apiRequest('/api/public/client-portal/resources')
}
// phase-3-9d-client-portal-resource-api-end

// phase-3-9h-portal-invite-management-api-start
export async function getAdminClientPortalInvites(clientId) {
  return apiRequest(`/api/admin/clients/${clientId}/portal-invites`)
}

export async function revokeAdminClientPortalInvite(inviteId) {
  return apiRequest(`/api/admin/portal-invites/${inviteId}/revoke`, {
    method: 'PATCH',
  })
}
// phase-3-9h-portal-invite-management-api-end

// phase-3-9i-portal-invite-email-api-start
export async function getAdminClientPortalEmailLogs(clientId) {
  return apiRequest(`/api/admin/clients/${clientId}/portal-email-logs`)
}

export async function createAdminPortalInviteEmailDraft(inviteId) {
  return apiRequest(`/api/admin/portal-invites/${inviteId}/email-draft`, {
    method: 'POST',
  })
}

export async function markAdminPortalEmailLogSent(emailLogId) {
  return apiRequest(`/api/admin/portal-email-logs/${emailLogId}/mark-sent`, {
    method: 'PATCH',
  })
}
// phase-3-9i-portal-invite-email-api-end

// phase-3-9j-real-email-api-start
export async function sendAdminPortalInviteEmail(inviteId) {
  return apiRequest(`/api/admin/portal-invites/${inviteId}/send-email`, {
    method: 'POST',
  })
}
// phase-3-9j-real-email-api-end

// phase-3-10a-mail-studio-api-start
export async function getAdminMailStudioOverview() {
  return apiRequest('/api/admin/mail-studio/overview')
}

export async function getAdminMailStudioTemplates(status = 'active') {
  return apiRequest(`/api/admin/mail-studio/templates?status=${encodeURIComponent(status)}`)
}

export async function createAdminMailStudioTemplate(payload) {
  return apiRequest('/api/admin/mail-studio/templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminMailStudioTemplate(templateId, payload) {
  return apiRequest(`/api/admin/mail-studio/templates/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function getAdminMailStudioEmailLogs() {
  return apiRequest('/api/admin/mail-studio/email-logs')
}
// phase-3-10a-mail-studio-api-end

// phase-3-10b-mail-studio-composer-api-start
export async function previewAdminMailStudioEmail(payload) {
  return apiRequest('/api/admin/mail-studio/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createAdminMailStudioEmailDraft(payload) {
  return apiRequest('/api/admin/mail-studio/draft', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function sendAdminMailStudioEmail(payload) {
  return apiRequest('/api/admin/mail-studio/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
// phase-3-10b-mail-studio-composer-api-end

// phase-3-12a-founders-view-api-start
export async function getAdminFoundersViewOverview() {
  return apiRequest('/api/admin/founders-view/overview')
}

export async function createAdminFounderAvailabilityException(payload) {
  return apiRequest('/api/admin/founders-view/availability-exceptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminFounderAvailabilityException(exceptionId, payload) {
  return apiRequest(`/api/admin/founders-view/availability-exceptions/${exceptionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
// phase-3-12a-founders-view-api-end

// phase-3-12b-public-availability-api-start
export async function getPublicAvailabilityExceptions(start, end) {
  const params = new URLSearchParams()

  if (start) params.set('start', start)
  if (end) params.set('end', end)

  const query = params.toString()

  return apiRequest(
    `/api/public/availability-exceptions${query ? `?${query}` : ''}`,
  )
}
// phase-3-12b-public-availability-api-end


export async function getPublicBookedTimes(start, end) {
  const params = new URLSearchParams()

  if (start) params.set('start', start)
  if (end) params.set('end', end)

  const query = params.toString()

  return apiRequest(
    `/api/public/booked-times${query ? `?${query}` : ''}`,
  )
}

export async function submitPublicContactInquiry(payload) {
  return apiRequest('/api/public/contact-inquiries', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

