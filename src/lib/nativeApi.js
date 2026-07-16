import { reportClientError } from './errorReporter'

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
  const method = options.method || 'GET'
  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    })
  } catch (networkError) {
    if (!path.startsWith('/api/public/error-reports')) {
      reportClientError({
        type: 'network',
        severity: 'high',
        title: 'Frontend API network failure',
        message: networkError.message || `Unable to reach ${path}.`,
        route: path,
        method,
        metadata: { apiPath: path.split('?')[0] },
      })
    }
    throw networkError
  }

  try {
    return await parseResponse(response)
  } catch (responseError) {
    if (response.status >= 500 && !path.startsWith('/api/public/error-reports')) {
      reportClientError({
        type: 'api',
        severity: response.status >= 503 ? 'critical' : 'high',
        title: `API request returned HTTP ${response.status}`,
        message: responseError.message,
        route: path,
        method,
        httpStatus: response.status,
        metadata: {
          apiPath: path.split('?')[0],
          requestId: response.headers.get('x-request-id'),
        },
      })
    }
    throw responseError
  }
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

export async function getPasswordChangeStatus() {
  return apiRequest('/api/auth/password-change-status')
}

export async function changeRequiredPassword({ newPassword, confirmPassword }) {
  return apiRequest('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      newPassword,
      confirmPassword,
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

export async function checkDeveloperAccess() {
  return apiRequest('/api/auth/developer-check')
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

// client-portal-foundation-pass-13-start
export async function getClientPortalMessages() {
  return apiRequest('/api/public/client-portal/messages')
}

export async function markClientPortalMessageRead(messageId) {
  return apiRequest(`/api/public/client-portal/messages/${messageId}/read`, {
    method: 'PATCH',
  })
}

export async function updateClientPortalProfile(payload) {
  return apiRequest('/api/public/client-portal/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function changeClientPortalPassword(payload) {
  return apiRequest('/api/public/client-portal/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
// client-portal-foundation-pass-13-end


// client-session-self-service-pass-21-start
export async function createClientPortalBooking(payload) {
  return apiRequest('/api/public/client-portal/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createClientPortalBookingChangeRequest(bookingId, payload) {
  return apiRequest(`/api/public/client-portal/bookings/${bookingId}/change-requests`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getAdminSessionChangeRequests() {
  return apiRequest('/api/admin/session-change-requests')
}

export async function reviewAdminSessionChangeRequest(requestId, payload) {
  return apiRequest(`/api/admin/session-change-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
// client-session-self-service-pass-21-end

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


// encouragement-studio-pass-17-start
export async function getAdminEncouragements(filters = {}) {
  const params = new URLSearchParams()

  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters.visibility && filters.visibility !== 'all') {
    params.set('visibility', filters.visibility)
  }
  if (filters.search) params.set('search', filters.search)

  const query = params.toString()
  return apiRequest(`/api/admin/encouragements${query ? `?${query}` : ''}`)
}

export async function createAdminEncouragement(payload) {
  return apiRequest('/api/admin/encouragements', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminEncouragement(encouragementId, payload) {
  return apiRequest(`/api/admin/encouragements/${encouragementId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function publishAdminEncouragement(encouragementId) {
  return apiRequest(`/api/admin/encouragements/${encouragementId}/publish`, {
    method: 'POST',
  })
}

export async function archiveAdminEncouragement(encouragementId) {
  return apiRequest(`/api/admin/encouragements/${encouragementId}/archive`, {
    method: 'POST',
  })
}

export async function deleteAdminEncouragement(encouragementId) {
  return apiRequest(`/api/admin/encouragements/${encouragementId}`, {
    method: 'DELETE',
  })
}
// encouragement-studio-pass-17-end

// phase-3-12a-founders-view-api-start
export async function getAdminFoundersViewOverview() {
  return apiRequest('/api/admin/founders-view/overview')
}

export async function getAdminFounderCalendar(month) {
  const params = new URLSearchParams()
  if (month) params.set('month', month)
  const query = params.toString()

  return apiRequest(`/api/admin/founders-view/calendar${query ? `?${query}` : ''}`)
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


export async function getAdminFounderAvailability() {
  return apiRequest('/api/admin/founders-view/availability')
}

export async function updateAdminFounderWeeklyAvailability(payload) {
  return apiRequest('/api/admin/founders-view/availability/weekly', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminFounderDateAvailability(dateValue, payload) {
  return apiRequest(
    `/api/admin/founders-view/availability/dates/${encodeURIComponent(dateValue)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )
}
// phase-3-12a-founders-view-api-end

// phase-3-12b-public-availability-api-start
export async function getPublicAvailabilitySlots(appointmentTypeId, start, end) {
  const params = new URLSearchParams()

  if (appointmentTypeId) params.set('appointmentTypeId', appointmentTypeId)
  if (start) params.set('start', start)
  if (end) params.set('end', end)

  return apiRequest(`/api/public/availability-slots?${params.toString()}`)
}

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

// developer-control-center-api-start
export async function getDeveloperOverview() {
  return apiRequest('/api/admin/developer/overview')
}

export async function getDeveloperUsers() {
  return apiRequest('/api/admin/developer/users')
}

export async function getDeveloperAccountGovernance() {
  return apiRequest('/api/admin/developer/account-governance')
}

export async function reconcileDeveloperAccountGovernance() {
  return apiRequest('/api/admin/developer/account-governance/reconcile', {
    method: 'POST',
  })
}

export async function saveDeveloperPermanentAdmin(adminUserId) {
  return apiRequest('/api/admin/developer/account-governance/admin', {
    method: 'PATCH',
    body: JSON.stringify({ adminUserId }),
  })
}

export async function previewDeveloperAccountCleanup(adminUserId) {
  return apiRequest('/api/admin/developer/account-governance/cleanup-preview', {
    method: 'POST',
    body: JSON.stringify({ adminUserId }),
  })
}

export async function applyDeveloperAccountCleanup(adminUserId, confirmation) {
  return apiRequest('/api/admin/developer/account-governance/cleanup', {
    method: 'POST',
    body: JSON.stringify({ adminUserId, confirmation }),
  })
}

export async function issueDeveloperTemporaryPassword(userId, expirationHours = 48) {
  return apiRequest(`/api/admin/developer/users/${userId}/temporary-password`, {
    method: 'POST',
    body: JSON.stringify({ expirationHours }),
  })
}

export async function updateDeveloperUserStatus(userId, status) {
  return apiRequest(`/api/admin/developer/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
// developer-control-center-api-end

// developer-operations-phase-2-api-start
export async function createDeveloperManagedUser(payload) {
  return apiRequest('/api/admin/developer/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateDeveloperUserRole(userId, role) {
  return apiRequest(`/api/admin/developer/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export async function revokeDeveloperUserSessions(userId) {
  return apiRequest(`/api/admin/developer/users/${userId}/revoke-sessions`, {
    method: 'POST',
  })
}

export async function getDeveloperClientAccess() {
  return apiRequest('/api/admin/developer/client-access')
}

export async function getDeveloperSystemHealth() {
  return apiRequest('/api/admin/developer/system-health')
}

export async function getDeveloperSecurityIntegrity() {
  return apiRequest('/api/admin/developer/security-integrity')
}

export async function getDeveloperSettings() {
  return apiRequest('/api/admin/developer/settings')
}

export async function updateDeveloperSettings(settings) {
  return apiRequest('/api/admin/developer/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings),
  })
}

export async function getDeveloperFounderPreview() {
  return apiRequest('/api/admin/developer/preview/founder')
}

export async function getDeveloperClientPreview(clientProfileId) {
  return apiRequest(`/api/admin/developer/preview/client/${clientProfileId}`)
}
// developer-operations-phase-2-api-end

// staff-team-management-pass-26-api-start
export async function getAdminTeamWorkload() {
  return apiRequest('/api/admin/team/workload')
}

export async function getAdminClientMomentum() {
  return apiRequest('/api/admin/client-momentum')
}

export async function getAdminClientCoverage() {
  return apiRequest('/api/admin/client-coverage')
}

export async function getAdminSessionReadiness(days = 14) {
  return apiRequest(`/api/admin/session-readiness?days=${encodeURIComponent(days)}`)
}

export async function getAdminSessionFollowThrough(days = 30) {
  return apiRequest(`/api/admin/session-follow-through?days=${encodeURIComponent(days)}`)
}

export async function getMyTeamAccess() {
  return apiRequest('/api/admin/team/my-access')
}

export async function getDeveloperTeamManagement() {
  return apiRequest('/api/admin/developer/team')
}

export async function updateDeveloperTeamMember(userId, payload) {
  return apiRequest(`/api/admin/developer/team/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function updateDeveloperTeamAssignments(userId, assignments) {
  return apiRequest(`/api/admin/developer/team/${userId}/client-assignments`, {
    method: 'PUT',
    body: JSON.stringify({ assignments }),
  })
}
// staff-team-management-pass-26-api-end

// client-360-pass-27-api-start
export async function getAdminClient360(clientId) {
  return apiRequest(`/api/admin/clients/${clientId}/360`)
}

export async function updateAdminClientCarePlan(clientId, payload) {
  return apiRequest(`/api/admin/clients/${clientId}/care-plan`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function createAdminClientCareAction(clientId, payload) {
  return apiRequest(`/api/admin/clients/${clientId}/care-actions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminClientCareAction(clientId, actionId, payload) {
  return apiRequest(`/api/admin/clients/${clientId}/care-actions/${actionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
// client-360-pass-27-api-end

// studio-attention-queue-phase-14-api-start
export async function getAdminAttentionQueue() {
  return apiRequest('/api/admin/attention-queue')
}

export async function updateAdminAttentionItem(sourceType, clientId, itemId, payload) {
  return apiRequest(`/api/admin/attention-queue/${sourceType}/${clientId}/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
// studio-attention-queue-phase-14-api-end

// learning-library-pass-18-api-start
export async function getAdminLearningLibrary() {
  return apiRequest('/api/admin/learning-library')
}

export async function getAdminLearningCourse(courseId) {
  return apiRequest(`/api/admin/learning-library/${courseId}`)
}

export async function createAdminLearningCourse(payload) {
  return apiRequest('/api/admin/learning-library', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminLearningCourse(courseId, payload) {
  return apiRequest(`/api/admin/learning-library/${courseId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function publishAdminLearningCourse(courseId) {
  return apiRequest(`/api/admin/learning-library/${courseId}/publish`, {
    method: 'POST',
  })
}

export async function archiveAdminLearningCourse(courseId) {
  return apiRequest(`/api/admin/learning-library/${courseId}/archive`, {
    method: 'POST',
  })
}

export async function deleteAdminLearningCourse(courseId) {
  return apiRequest(`/api/admin/learning-library/${courseId}`, {
    method: 'DELETE',
  })
}

export async function createAdminLearningModule(courseId, payload) {
  return apiRequest(`/api/admin/learning-library/${courseId}/modules`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminLearningModule(moduleId, payload) {
  return apiRequest(`/api/admin/learning-library/modules/${moduleId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteAdminLearningModule(moduleId) {
  return apiRequest(`/api/admin/learning-library/modules/${moduleId}`, {
    method: 'DELETE',
  })
}

export async function createAdminLearningLesson(moduleId, payload) {
  return apiRequest(`/api/admin/learning-library/modules/${moduleId}/lessons`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminLearningLesson(lessonId, payload) {
  return apiRequest(`/api/admin/learning-library/lessons/${lessonId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteAdminLearningLesson(lessonId) {
  return apiRequest(`/api/admin/learning-library/lessons/${lessonId}`, {
    method: 'DELETE',
  })
}

export async function updateAdminLearningAccess(courseId, payload) {
  return apiRequest(`/api/admin/learning-library/${courseId}/access`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function getClientLearningLibrary() {
  return apiRequest('/api/public/client-portal/learning')
}

export async function getClientLearningCourse(courseId) {
  return apiRequest(`/api/public/client-portal/learning/${courseId}`)
}

export async function updateClientLearningProgress(lessonId, payload) {
  return apiRequest(`/api/public/client-portal/learning/lessons/${lessonId}/progress`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
// learning-library-pass-18-api-end

// membership-circle-pass-19-api-start
export async function getAdminMembershipCircle() {
  return apiRequest('/api/admin/memberships')
}

export async function getAdminMembership(membershipId) {
  return apiRequest(`/api/admin/memberships/${membershipId}`)
}

export async function createAdminMembership(payload) {
  return apiRequest('/api/admin/memberships', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminMembership(membershipId, payload) {
  return apiRequest(`/api/admin/memberships/${membershipId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function activateAdminMembership(membershipId) {
  return apiRequest(`/api/admin/memberships/${membershipId}/activate`, {
    method: 'POST',
  })
}

export async function archiveAdminMembership(membershipId) {
  return apiRequest(`/api/admin/memberships/${membershipId}/archive`, {
    method: 'POST',
  })
}

export async function deleteAdminMembership(membershipId) {
  return apiRequest(`/api/admin/memberships/${membershipId}`, {
    method: 'DELETE',
  })
}

export async function upsertAdminMembershipEnrollment(membershipId, payload) {
  return apiRequest(`/api/admin/memberships/${membershipId}/enrollments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminMembershipEnrollment(enrollmentId, payload) {
  return apiRequest(`/api/admin/memberships/enrollments/${enrollmentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteAdminMembershipEnrollment(enrollmentId) {
  return apiRequest(`/api/admin/memberships/enrollments/${enrollmentId}`, {
    method: 'DELETE',
  })
}

export async function updateAdminMembershipCourses(membershipId, courseIds) {
  return apiRequest(`/api/admin/memberships/${membershipId}/courses`, {
    method: 'PUT',
    body: JSON.stringify({ courseIds }),
  })
}

export async function createAdminMembershipResource(membershipId, payload) {
  return apiRequest(`/api/admin/memberships/${membershipId}/resources`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminMembershipResource(resourceId, payload) {
  return apiRequest(`/api/admin/memberships/resources/${resourceId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteAdminMembershipResource(resourceId) {
  return apiRequest(`/api/admin/memberships/resources/${resourceId}`, {
    method: 'DELETE',
  })
}

export async function createAdminMembershipAnnouncement(membershipId, payload) {
  return apiRequest(`/api/admin/memberships/${membershipId}/announcements`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminMembershipAnnouncement(announcementId, payload) {
  return apiRequest(`/api/admin/memberships/announcements/${announcementId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function publishAdminMembershipAnnouncement(announcementId) {
  return apiRequest(`/api/admin/memberships/announcements/${announcementId}/publish`, {
    method: 'POST',
  })
}

export async function archiveAdminMembershipAnnouncement(announcementId) {
  return apiRequest(`/api/admin/memberships/announcements/${announcementId}/archive`, {
    method: 'POST',
  })
}

export async function deleteAdminMembershipAnnouncement(announcementId) {
  return apiRequest(`/api/admin/memberships/announcements/${announcementId}`, {
    method: 'DELETE',
  })
}

export async function getClientMemberships() {
  return apiRequest('/api/public/client-portal/memberships')
}
// membership-circle-pass-19-api-end

// the-circle-community-pass-20-api-start
export async function getAdminCircleCommunity() {
  return apiRequest('/api/admin/circle')
}

export async function getAdminCirclePost(postId) {
  return apiRequest(`/api/admin/circle/posts/${postId}`)
}

export async function createAdminCirclePost(payload) {
  return apiRequest('/api/admin/circle/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminCirclePost(postId, payload) {
  return apiRequest(`/api/admin/circle/posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function publishAdminCirclePost(postId) {
  return apiRequest(`/api/admin/circle/posts/${postId}/publish`, {
    method: 'POST',
  })
}

export async function archiveAdminCirclePost(postId) {
  return apiRequest(`/api/admin/circle/posts/${postId}/archive`, {
    method: 'POST',
  })
}

export async function pinAdminCirclePost(postId, isPinned) {
  return apiRequest(`/api/admin/circle/posts/${postId}/pin`, {
    method: 'POST',
    body: JSON.stringify({ isPinned }),
  })
}

export async function deleteAdminCirclePost(postId) {
  return apiRequest(`/api/admin/circle/posts/${postId}`, {
    method: 'DELETE',
  })
}

export async function moderateAdminCircleComment(commentId, status) {
  return apiRequest(`/api/admin/circle/comments/${commentId}/moderation`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function reviewAdminCircleReport(reportId, status) {
  return apiRequest(`/api/admin/circle/reports/${reportId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function getClientCircleCommunity() {
  return apiRequest('/api/public/client-portal/circle')
}

export async function createClientCircleComment(postId, body) {
  return apiRequest(`/api/public/client-portal/circle/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
}

export async function deleteClientCircleComment(commentId) {
  return apiRequest(`/api/public/client-portal/circle/comments/${commentId}`, {
    method: 'DELETE',
  })
}

export async function setClientCircleReaction(postId, reactionType) {
  return apiRequest(`/api/public/client-portal/circle/posts/${postId}/reaction`, {
    method: 'POST',
    body: JSON.stringify({ reactionType }),
  })
}

export async function reportClientCircleContent(payload) {
  return apiRequest('/api/public/client-portal/circle/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
// the-circle-community-pass-20-api-end

// secure-client-inbox-pass-22-api-start
export async function getAdminInbox(filters = {}) {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.priority) params.set('priority', filters.priority)
  if (filters.search) params.set('search', filters.search)
  const query = params.toString()
  return apiRequest(`/api/admin/inbox${query ? `?${query}` : ''}`)
}

export async function getAdminInboxConversation(conversationId) {
  return apiRequest(`/api/admin/inbox/${conversationId}`)
}

export async function createAdminInboxConversation(payload) {
  return apiRequest('/api/admin/inbox', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function sendAdminInboxMessage(conversationId, payload) {
  return apiRequest(`/api/admin/inbox/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminInboxConversation(conversationId, payload) {
  return apiRequest(`/api/admin/inbox/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function getClientPortalInbox() {
  return apiRequest('/api/public/client-portal/inbox')
}

export async function getClientPortalInboxConversation(conversationId) {
  return apiRequest(`/api/public/client-portal/inbox/${conversationId}`)
}

export async function createClientPortalInboxConversation(payload) {
  return apiRequest('/api/public/client-portal/inbox', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function sendClientPortalInboxMessage(conversationId, payload) {
  return apiRequest(`/api/public/client-portal/inbox/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateClientPortalInboxConversation(conversationId, status) {
  return apiRequest(`/api/public/client-portal/inbox/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
// secure-client-inbox-pass-22-api-end


// leads-intake-pipeline-pass-28-api-start
export async function getAdminLeadPipeline() {
  return apiRequest('/api/admin/lead-pipeline')
}

export async function getAdminLeadDetail(clientId) {
  return apiRequest(`/api/admin/lead-pipeline/${clientId}`)
}

export async function updateAdminLead(clientId, payload) {
  return apiRequest(`/api/admin/lead-pipeline/${clientId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function createAdminLeadFollowUp(clientId, payload) {
  return apiRequest(`/api/admin/lead-pipeline/${clientId}/follow-ups`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminLeadFollowUp(clientId, followUpId, payload) {
  return apiRequest(`/api/admin/lead-pipeline/${clientId}/follow-ups/${followUpId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function addAdminLeadNote(clientId, note) {
  return apiRequest(`/api/admin/lead-pipeline/${clientId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
}
// leads-intake-pipeline-pass-28-api-end

// automation-studio-pass-29-api-start
export async function getAdminAutomationStudio() {
  return apiRequest('/api/admin/automation-studio')
}

export async function createAdminAutomationWorkflow(payload) {
  return apiRequest('/api/admin/automation-studio/workflows', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminAutomationWorkflow(workflowId, payload) {
  return apiRequest(`/api/admin/automation-studio/workflows/${workflowId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function enrollAdminAutomationClient(workflowId, payload) {
  return apiRequest(`/api/admin/automation-studio/workflows/${workflowId}/enroll`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminAutomationEnrollment(enrollmentId, action) {
  return apiRequest(`/api/admin/automation-studio/enrollments/${enrollmentId}/action`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  })
}

export async function runAdminDueAutomations() {
  return apiRequest('/api/admin/automation-studio/run-due', {
    method: 'POST',
  })
}
// automation-studio-pass-29-api-end

// unified-notification-center-pass-25-api-start
function buildNotificationQuery(filters = {}) {
  const params = new URLSearchParams()
  if (filters.unreadOnly) params.set('unreadOnly', 'true')
  if (filters.category) params.set('category', filters.category)
  if (filters.limit) params.set('limit', String(filters.limit))
  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function getAdminNotificationSummary() { return apiRequest('/api/admin/notifications/summary') }
export async function getAdminNotifications(filters = {}) { return apiRequest(`/api/admin/notifications${buildNotificationQuery(filters)}`) }
export async function markAdminNotificationRead(id) { return apiRequest(`/api/admin/notifications/${id}/read`, { method: 'PATCH' }) }
export async function markAllAdminNotificationsRead() { return apiRequest('/api/admin/notifications/mark-all-read', { method: 'POST' }) }
export async function dismissAdminNotification(id) { return apiRequest(`/api/admin/notifications/${id}`, { method: 'DELETE' }) }
export async function clearReadAdminNotifications() { return apiRequest('/api/admin/notifications/clear-read', { method: 'POST' }) }
export async function getAdminNotificationPreferences() { return apiRequest('/api/admin/notifications/preferences') }
export async function updateAdminNotificationPreferences(payload) { return apiRequest('/api/admin/notifications/preferences', { method: 'PATCH', body: JSON.stringify(payload) }) }

export async function getClientNotificationSummary() { return apiRequest('/api/public/client-portal/notifications/summary') }
export async function getClientNotifications(filters = {}) { return apiRequest(`/api/public/client-portal/notifications${buildNotificationQuery(filters)}`) }
export async function markClientNotificationRead(id) { return apiRequest(`/api/public/client-portal/notifications/${id}/read`, { method: 'PATCH' }) }
export async function markAllClientNotificationsRead() { return apiRequest('/api/public/client-portal/notifications/mark-all-read', { method: 'POST' }) }
export async function dismissClientNotification(id) { return apiRequest(`/api/public/client-portal/notifications/${id}`, { method: 'DELETE' }) }
export async function clearReadClientNotifications() { return apiRequest('/api/public/client-portal/notifications/clear-read', { method: 'POST' }) }
export async function getClientNotificationPreferences() { return apiRequest('/api/public/client-portal/notifications/preferences') }
export async function updateClientNotificationPreferences(payload) { return apiRequest('/api/public/client-portal/notifications/preferences', { method: 'PATCH', body: JSON.stringify(payload) }) }
// unified-notification-center-pass-25-api-end

// booking-intake-onboarding-pass-30-api-start
export async function getAdminOnboardingStudio() {
  return apiRequest('/api/admin/onboarding-studio')
}

export async function createAdminIntakeTemplate(payload) {
  return apiRequest('/api/admin/onboarding-studio/templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminIntakeTemplate(templateId, payload) {
  return apiRequest(`/api/admin/onboarding-studio/templates/${templateId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminAppointmentOnboarding(appointmentTypeId, payload) {
  return apiRequest(`/api/admin/onboarding-studio/appointment-types/${appointmentTypeId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function startAdminClientOnboarding(clientId, payload) {
  return apiRequest(`/api/admin/onboarding-studio/clients/${clientId}/start`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateAdminClientOnboarding(clientId, payload) {
  return apiRequest(`/api/admin/onboarding-studio/clients/${clientId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function runAdminBookingCommunications() {
  return apiRequest('/api/admin/onboarding-studio/run-due', {
    method: 'POST',
  })
}

export async function getClientPortalOnboarding() {
  return apiRequest('/api/public/client-portal/onboarding')
}

export async function saveClientPortalOnboarding(answers) {
  return apiRequest('/api/public/client-portal/onboarding', {
    method: 'PATCH',
    body: JSON.stringify({ answers }),
  })
}

export async function submitClientPortalOnboarding(answers) {
  return apiRequest('/api/public/client-portal/onboarding/submit', {
    method: 'POST',
    body: JSON.stringify({ answers }),
  })
}
// booking-intake-onboarding-pass-30-api-end


export async function getDeveloperErrorCenter(query = '') {
  const suffix = query ? `?${query}` : ''
  const [summary, errors] = await Promise.all([
    apiRequest('/api/admin/developer/errors/summary'),
    apiRequest(`/api/admin/developer/errors${suffix}`),
  ])

  return {
    summary: summary.summary,
    settings: summary.settings,
    errors: errors.errors || [],
  }
}

export async function updateDeveloperErrorStatus(errorId, status) {
  return apiRequest(`/api/admin/developer/errors/${errorId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function deleteDeveloperError(errorId) {
  return apiRequest(`/api/admin/developer/errors/${errorId}`, {
    method: 'DELETE',
  })
}

export async function runDeveloperErrorChecks() {
  return apiRequest('/api/admin/developer/errors/run-checks', {
    method: 'POST',
  })
}

export async function saveDeveloperErrorSettings(settings) {
  return apiRequest('/api/admin/developer/errors/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export async function createDeveloperErrorTest() {
  return apiRequest('/api/admin/developer/errors/test', {
    method: 'POST',
  })
}

// phase-26-asset-vault-api-start
function encodeAssetHeader(value) {
  return encodeURIComponent(String(value || ''))
}

function assetQuery(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

async function uploadAssetBinary(path, file, metadata = {}, options = {}) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${API_BASE_URL}${path}`)
    request.withCredentials = true
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    request.setRequestHeader('X-PWC-File-Name', encodeAssetHeader(file.name))
    if (metadata.title) request.setRequestHeader('X-PWC-Asset-Title', encodeAssetHeader(metadata.title))
    if (metadata.folderId) request.setRequestHeader('X-PWC-Folder-Id', metadata.folderId)
    if (metadata.tags?.length) request.setRequestHeader('X-PWC-Tags', encodeAssetHeader(metadata.tags.join(',')))
    if (metadata.notes) request.setRequestHeader('X-PWC-Version-Notes', encodeAssetHeader(metadata.notes))

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable || typeof options.onProgress !== 'function') return
      options.onProgress({ loaded: event.loaded, total: event.total, percent: Math.round((event.loaded / event.total) * 100) })
    })
    request.addEventListener('load', () => {
      let data = null
      try { data = request.responseText ? JSON.parse(request.responseText) : null } catch { /* non-JSON upload error */ }
      if (request.status >= 200 && request.status < 300) {
        options.onProgress?.({ loaded: file.size, total: file.size, percent: 100 })
        resolve(data)
        return
      }
      reject(new Error(data?.error || data?.message || `Upload failed with status ${request.status}`))
    })
    request.addEventListener('error', () => reject(new Error('The upload connection was interrupted.')))
    request.addEventListener('abort', () => reject(new DOMException('The upload was cancelled.', 'AbortError')))
    options.signal?.addEventListener('abort', () => request.abort(), { once: true })
    request.send(file)
  })
}

export async function getAssetVaultSummary() {
  return apiRequest('/api/admin/assets/summary')
}

export async function getAssetVaultAssets(filters = {}) {
  return apiRequest(`/api/admin/assets${assetQuery(filters)}`)
}

export async function getAssetVaultAsset(assetId) {
  return apiRequest(`/api/admin/assets/${assetId}`)
}

export async function createAssetVaultFolder(payload) {
  return apiRequest('/api/admin/assets/folders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function uploadAssetVaultFile(file, metadata = {}, options = {}) {
  return uploadAssetBinary('/api/admin/assets/upload', file, metadata, options)
}

export async function uploadAssetVaultVersion(assetId, file, notes = '', options = {}) {
  return uploadAssetBinary(`/api/admin/assets/${assetId}/versions`, file, { notes }, options)
}

export async function updateAssetVaultAsset(assetId, payload) {
  return apiRequest(`/api/admin/assets/${assetId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function archiveAssetVaultAsset(assetId) {
  return apiRequest(`/api/admin/assets/${assetId}/archive`, { method: 'POST' })
}

export async function restoreAssetVaultAsset(assetId) {
  return apiRequest(`/api/admin/assets/${assetId}/restore`, { method: 'POST' })
}

export async function assignAssetVaultAsset(assetId, payload) {
  return apiRequest(`/api/admin/assets/${assetId}/assignments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function assignAssetVaultAssetToAllClients(assetId, payload) {
  return apiRequest(`/api/admin/assets/${assetId}/assignments/all`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function assignAssetVaultAssetToClients(assetId, payload) {
  return apiRequest(`/api/admin/assets/${assetId}/assignments/selected`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createAssetVaultAccessGrant(assetId, purpose = 'download') {
  const response = await apiRequest(`/api/admin/assets/${assetId}/access-grants`, {
    method: 'POST',
    body: JSON.stringify({ purpose }),
  })
  return { ...response, url: `${API_BASE_URL}${response.path}` }
}

export async function getAssetVaultRelationships(assetId) {
  return apiRequest(`/api/admin/assets/${assetId}/relationships`)
}

export async function createAssetVaultRelationship(assetId, payload) {
  return apiRequest(`/api/admin/assets/${assetId}/relationships`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function removeAssetVaultRelationship(assetId, relationshipId) {
  return apiRequest(`/api/admin/assets/${assetId}/relationships/${relationshipId}`, { method: 'DELETE' })
}

export async function unassignAssetVaultAsset(assetId, assignmentId) {
  return apiRequest(`/api/admin/assets/${assetId}/assignments/${assignmentId}`, {
    method: 'DELETE',
  })
}

export function getAssetVaultDownloadUrl(assetId) {
  return `${API_BASE_URL}/api/admin/assets/${assetId}/download`
}

export function getAssetVaultPreviewUrl(assetId) {
  return `${API_BASE_URL}/api/admin/assets/${assetId}/preview`
}
// phase-26-asset-vault-api-end

// phase-27-newsletter-audience-api-start
function audienceQuery(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

export async function subscribePublicNewsletter(payload) {
  return apiRequest('/api/public/newsletter/subscribe', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getNewsletterAudienceSummary() {
  return apiRequest('/api/admin/audience/summary')
}

export async function getNewsletterAudienceSubscribers(filters = {}) {
  return apiRequest(`/api/admin/audience/subscribers${audienceQuery(filters)}`)
}

export async function getNewsletterAudienceSubscriber(subscriberId) {
  return apiRequest(`/api/admin/audience/subscribers/${subscriberId}`)
}

export async function getNewsletterAudiencePreviewCount(filters = {}) {
  return apiRequest(`/api/admin/audience/preview-count${audienceQuery(filters)}`)
}

export async function createNewsletterAudienceSubscriber(payload) {
  return apiRequest('/api/admin/audience/subscribers', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createNewsletterAudienceBulk(payload) {
  return apiRequest('/api/admin/audience/subscribers/bulk', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function importNewsletterAudienceCsv(payload) {
  return apiRequest('/api/admin/audience/imports/csv', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function addClientToNewsletterAudience(clientProfileId, payload) {
  return apiRequest(`/api/admin/audience/clients/${clientProfileId}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateNewsletterAudienceSubscriber(subscriberId, payload) {
  return apiRequest(`/api/admin/audience/subscribers/${subscriberId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function updateNewsletterAudienceStatus(subscriberId, payload) {
  return apiRequest(`/api/admin/audience/subscribers/${subscriberId}/status`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function bulkUpdateNewsletterAudienceTags(payload) {
  return apiRequest('/api/admin/audience/bulk/tags', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function bulkUpdateNewsletterAudienceSegments(payload) {
  return apiRequest('/api/admin/audience/bulk/segments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createNewsletterAudienceSegment(payload) {
  return apiRequest('/api/admin/audience/segments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
// phase-27-newsletter-audience-api-end

// phase-28-letter-builder-api-start
function letterQuery(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

export async function getLetterBuilderOverview() {
  return apiRequest('/api/admin/letters/overview')
}

export async function getLetters(filters = {}) {
  return apiRequest(`/api/admin/letters/letters${letterQuery(filters)}`)
}

export async function getLetter(letterId) {
  return apiRequest(`/api/admin/letters/letters/${letterId}`)
}

export async function createLetter(payload) {
  return apiRequest('/api/admin/letters/letters', { method: 'POST', body: JSON.stringify(payload) })
}

export async function saveLetter(letterId, payload) {
  return apiRequest(`/api/admin/letters/letters/${letterId}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export async function duplicateLetter(letterId) {
  return apiRequest(`/api/admin/letters/letters/${letterId}/duplicate`, { method: 'POST' })
}

export async function previewLetter(letterId) {
  return apiRequest(`/api/admin/letters/letters/${letterId}/preview`, { method: 'POST' })
}

export async function sendLetterTest(letterId, email) {
  return apiRequest(`/api/admin/letters/letters/${letterId}/test-send`, { method: 'POST', body: JSON.stringify({ email }) })
}

export async function getLetterVersions(letterId) {
  return apiRequest(`/api/admin/letters/letters/${letterId}/versions`)
}

export async function restoreLetterVersion(letterId, versionId) {
  return apiRequest(`/api/admin/letters/letters/${letterId}/versions/${versionId}/restore`, { method: 'POST' })
}

export async function getLetterTemplates(status = 'active') {
  return apiRequest(`/api/admin/letters/templates?status=${encodeURIComponent(status)}`)
}

export async function createLetterTemplate(payload) {
  return apiRequest('/api/admin/letters/templates', { method: 'POST', body: JSON.stringify(payload) })
}

export async function saveLetterAsTemplate(letterId, payload) {
  return apiRequest(`/api/admin/letters/letters/${letterId}/save-template`, { method: 'POST', body: JSON.stringify(payload) })
}

export async function previewLetterAudience(audienceFilter) {
  return apiRequest('/api/admin/letters/audience-preview', { method: 'POST', body: JSON.stringify(audienceFilter) })
}

export async function prepareLetterBroadcast(letterId, audienceFilter) {
  return apiRequest(`/api/admin/letters/letters/${letterId}/broadcasts/prepare`, { method: 'POST', body: JSON.stringify({ audienceFilter }) })
}

export async function getLetterBroadcasts(filters = {}) {
  return apiRequest(`/api/admin/letters/broadcasts${letterQuery(filters)}`)
}

export async function getLetterBroadcast(broadcastId) {
  return apiRequest(`/api/admin/letters/broadcasts/${broadcastId}`)
}

export async function scheduleLetterBroadcast(broadcastId, scheduledAt) {
  return apiRequest(`/api/admin/letters/broadcasts/${broadcastId}/schedule`, { method: 'POST', body: JSON.stringify({ scheduledAt }) })
}

export async function sendLetterBroadcastNow(broadcastId) {
  return apiRequest(`/api/admin/letters/broadcasts/${broadcastId}/send-now`, { method: 'POST' })
}

export async function cancelLetterBroadcast(broadcastId) {
  return apiRequest(`/api/admin/letters/broadcasts/${broadcastId}/cancel`, { method: 'POST' })
}

export async function processDueLetterBroadcasts() {
  return apiRequest('/api/admin/letters/process-due', { method: 'POST' })
}

export function getLetterBroadcastExportUrl(broadcastId) {
  return `${API_BASE_URL}/api/admin/letters/broadcasts/${broadcastId}/export.csv`
}
// phase-28-letter-builder-api-end
