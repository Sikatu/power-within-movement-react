import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  changeClientPortalPassword,
  getClientPortalDashboard,
  getClientPortalMessages,
  getClientPortalResources,
  getClientLearningLibrary,
  getClientMemberships,
  logoutClientPortal,
  markClientPortalMessageRead,
  updateClientPortalProfile,
  updateClientLearningProgress,
} from '../lib/nativeApi'

import './ClientPortal.css'

const businessTimeZone = 'America/New_York'

const portalSections = [
  {
    key: 'home',
    path: '/client-portal/home',
    label: 'Home',
    shortLabel: 'Home',
  },
  {
    key: 'journey',
    path: '/client-portal/journey',
    label: 'My Journey',
    shortLabel: 'Journey',
  },
  {
    key: 'resources',
    path: '/client-portal/resources',
    label: 'Resources',
    shortLabel: 'Resources',
  },
  {
    key: 'learning',
    path: '/client-portal/learning',
    label: 'Learning',
    shortLabel: 'Learning',
  },
  {
    key: 'membership',
    path: '/client-portal/membership',
    label: 'Membership',
    shortLabel: 'Membership',
  },
  {
    key: 'circle',
    path: '/client-portal/circle',
    label: 'The Circle',
    shortLabel: 'The Circle',
  },
  {
    key: 'sessions',
    path: '/client-portal/sessions',
    label: 'Sessions',
    shortLabel: 'Sessions',
  },
  {
    key: 'messages',
    path: '/client-portal/messages',
    label: 'Messages',
    shortLabel: 'Messages',
  },
  {
    key: 'profile',
    path: '/client-portal/profile',
    label: 'Profile & Security',
    shortLabel: 'Profile',
  },
]

const sectionCopy = {
  home: {
    eyebrow: 'Your Private Space',
    title: 'A calm place to return to.',
    description:
      'See the next meaningful step in your Power Within journey without searching through every detail.',
  },
  journey: {
    eyebrow: 'My Journey',
    title: 'Your shared care record.',
    description:
      'Review reflections, follow-ups, and service history that Power Within has prepared for you.',
  },
  resources: {
    eyebrow: 'Resources',
    title: 'Your personal resource library.',
    description:
      'Return to guides, links, worksheets, videos, reminders, and notes selected for your care.',
  },
  learning: {
    eyebrow: 'Learning Library',
    title: 'Guided experiences for your next season.',
    description:
      'Move through private lessons, reflections, videos, and downloads selected for your personal growth.',
  },
  membership: {
    eyebrow: 'Membership',
    title: 'Your ongoing member experience.',
    description:
      'See your active membership, renewal details, private benefits, member resources, learning, and community updates.',
  },
  sessions: {
    eyebrow: 'Sessions',
    title: 'Upcoming and previous sessions.',
    description:
      'See what is scheduled next and revisit the history connected to your private client profile.',
  },
  messages: {
    eyebrow: 'Messages',
    title: 'Encouragements from Power Within.',
    description:
      'A private place for published encouragements and supportive notes shared with your community or directly with you.',
  },
  profile: {
    eyebrow: 'Profile & Security',
    title: 'Keep your information current.',
    description:
      'Update your contact details and protect your private portal with a strong password.',
  },
}

const resourceTypeLabels = {
  guide: 'Guides',
  worksheet: 'Worksheets',
  link: 'Links',
  video: 'Videos',
  reminder: 'Reminders',
  note: 'Notes',
}

const resourceTypeDescriptions = {
  guide: 'Curated direction and supportive references.',
  worksheet: 'Reflective exercises and guided prompts.',
  link: 'Helpful links selected for your journey.',
  video: 'Watchable resources and visual guidance.',
  reminder: 'Gentle reminders and next-step cues.',
  note: 'Personal notes and care-based references.',
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled'

  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: businessTimeZone,
    }).format(new Date(value))
  } catch {
    return 'Date unavailable'
  }
}

function formatDate(value) {
  if (!value) return 'No date'

  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeZone: businessTimeZone,
    }).format(new Date(value))
  } catch {
    return 'Date unavailable'
  }
}

function formatLabel(value) {
  const label = String(value || '')
    .replaceAll('_', ' ')
    .trim()
    .toLowerCase()

  return label ? label.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not specified'
}

function formatLessonType(value) {
  const labels = {
    text: 'Reading',
    video: 'Video',
    download: 'Download',
    reflection: 'Reflection',
  }

  return labels[value] || 'Lesson'
}

function formatMembershipPrice(cents, currency = 'USD', interval = null) {
  if (cents === null || cents === undefined) return 'Included in your care plan'

  try {
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(Number(cents) / 100)
    const intervals = {
      one_time: 'one time',
      monthly: 'per month',
      quarterly: 'per quarter',
      yearly: 'per year',
    }

    return interval ? `${amount} ${intervals[interval] || ''}`.trim() : amount
  } catch {
    return `${Number(cents) / 100} ${currency}`
  }
}

function getFriendlyClientPortalError(message) {
  const normalizedMessage = String(message || '').toLowerCase()

  if (
    normalizedMessage.includes('failed to fetch') ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('load failed')
  ) {
    return 'We could not reach your private portal for a moment. Please refresh the page or try again shortly.'
  }

  if (
    normalizedMessage.includes('login required') ||
    normalizedMessage.includes('unauthorized') ||
    normalizedMessage.includes('forbidden') ||
    normalizedMessage.includes('401') ||
    normalizedMessage.includes('403')
  ) {
    return 'Your private session has ended. Please sign in again to continue.'
  }

  return message || 'We could not load your private portal yet. Please try again shortly.'
}

function getSectionFromPath(pathname) {
  const matchingSection = portalSections.find((section) => pathname === section.path)
  return matchingSection?.key || 'home'
}

function getResourceTypeLabel(type) {
  return resourceTypeLabels[type] || 'Resources'
}

function getResourceDescription(type) {
  return resourceTypeDescriptions[type] || 'Resources selected for your care.'
}

function groupResourcesByType(resources) {
  return resources.reduce((groups, resource) => {
    const type = resource.resource_type || 'note'

    if (!groups[type]) groups[type] = []

    groups[type].push(resource)

    return groups
  }, {})
}

function EmptyState({ title, children, action }) {
  return (
    <div className="client-portal-empty-state-v3">
      <strong>{title}</strong>
      <p>{children}</p>
      {action}
    </div>
  )
}

function PortalPanel({ eyebrow, title, action, children, className = '' }) {
  return (
    <section className={`client-portal-panel-v3 ${className}`.trim()}>
      <div className="client-portal-panel-heading-v3">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function ClientPortalDashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeSection = getSectionFromPath(location.pathname)
  const activeCopy = sectionCopy[activeSection]

  const [dashboard, setDashboard] = useState(null)
  const [resources, setResources] = useState([])
  const [learningCourses, setLearningCourses] = useState([])
  const [learningFeatureEnabled, setLearningFeatureEnabled] = useState(true)
  const [memberships, setMemberships] = useState([])
  const [membershipFeatureEnabled, setMembershipFeatureEnabled] = useState(true)
  const [activeLearningCourseId, setActiveLearningCourseId] = useState('')
  const [activeLearningLessonId, setActiveLearningLessonId] = useState('')
  const [learningNotes, setLearningNotes] = useState({})
  const [learningNotice, setLearningNotice] = useState('')
  const [learningError, setLearningError] = useState('')
  const [savingLessonId, setSavingLessonId] = useState('')
  const [messages, setMessages] = useState([])
  const [messagesFeatureEnabled, setMessagesFeatureEnabled] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [error, setError] = useState('')
  const [profileDraft, setProfileDraft] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileNotice, setProfileNotice] = useState('')
  const [profileError, setProfileError] = useState('')
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [readingMessageId, setReadingMessageId] = useState('')
  const [portalNow, setPortalNow] = useState(() => Date.now())

  useEffect(() => {
    document.body.classList.add('client-portal-mode')

    return () => {
      document.body.classList.remove('client-portal-mode')
    }
  }, [])

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setPortalNow(Date.now())
    }, 60 * 1000)

    return () => window.clearInterval(timerId)
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadPortal() {
      try {
        setIsLoading(true)
        setError('')

        const [
          dashboardResponse,
          resourcesResponse,
          learningResponse,
          membershipResponse,
          messagesResponse,
        ] = await Promise.all([
          getClientPortalDashboard(),
          getClientPortalResources().catch(() => ({ resources: [] })),
          getClientLearningLibrary().catch(() => ({
            courses: [],
            featureEnabled: true,
          })),
          getClientMemberships().catch(() => ({
            memberships: [],
            featureEnabled: true,
          })),
          getClientPortalMessages().catch(() => ({
            messages: [],
            unreadCount: 0,
            featureEnabled: true,
          })),
        ])

        if (!isMounted) return

        setDashboard(dashboardResponse)
        setResources(resourcesResponse.resources || [])
        const loadedLearningCourses = learningResponse.courses || []
        setLearningCourses(loadedLearningCourses)
        setLearningFeatureEnabled(learningResponse.featureEnabled !== false)
        setMemberships(membershipResponse.memberships || [])
        setMembershipFeatureEnabled(membershipResponse.featureEnabled !== false)
        setActiveLearningCourseId((current) => current || loadedLearningCourses[0]?.id || '')
        setLearningNotes(
          loadedLearningCourses.reduce((notes, course) => {
            ;(course.modules || []).forEach((module) => {
              ;(module.lessons || []).forEach((lesson) => {
                notes[lesson.id] = lesson.progress_notes || ''
              })
            })
            return notes
          }, {}),
        )
        setMessages(messagesResponse.messages || [])
        setMessagesFeatureEnabled(messagesResponse.featureEnabled !== false)

        const loadedClient = dashboardResponse.client

        if (loadedClient) {
          setProfileDraft({
            firstName: loadedClient.firstName || '',
            lastName: loadedClient.lastName || '',
            phone: loadedClient.phone || '',
            emergencyContactName: loadedClient.emergencyContactName || '',
            emergencyContactPhone: loadedClient.emergencyContactPhone || '',
          })
        }
      } catch (loadError) {
        if (!isMounted) return

        const friendlyError = getFriendlyClientPortalError(loadError.message)
        setError(friendlyError)

        const lowerMessage = String(loadError.message || '').toLowerCase()

        if (
          lowerMessage.includes('login required') ||
          lowerMessage.includes('unauthorized') ||
          lowerMessage.includes('401')
        ) {
          navigate('/client-portal/login', { replace: true })
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadPortal()

    return () => {
      isMounted = false
    }
  }, [navigate])

  const client = dashboard?.client

  const serviceRecords = useMemo(
    () => dashboard?.serviceRecords || [],
    [dashboard],
  )
  const visibleNotes = useMemo(
    () => dashboard?.visibleNotes || [],
    [dashboard],
  )
  const followUps = useMemo(
    () => dashboard?.followUps || [],
    [dashboard],
  )
  const bookings = useMemo(() => dashboard?.bookings || [], [dashboard])

  const upcomingBookings = useMemo(() => {
    return bookings
      .filter((booking) => {
        const start = new Date(booking.starts_at).getTime()
        const status = String(booking.status || '').toLowerCase()

        return (
          Number.isFinite(start) &&
          start >= portalNow &&
          !['cancelled', 'no_show', 'completed'].includes(status)
        )
      })
      .sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      )
  }, [bookings, portalNow])

  const previousBookings = useMemo(() => {
    return bookings
      .filter((booking) => {
        const start = new Date(booking.starts_at).getTime()
        return Number.isFinite(start) && start < portalNow
      })
      .sort(
        (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
      )
  }, [bookings, portalNow])

  const sortedFollowUps = useMemo(
    () =>
      [...followUps].sort(
        (a, b) =>
          new Date(a.follow_up_at || a.updated_at || a.created_at).getTime() -
          new Date(b.follow_up_at || b.updated_at || b.created_at).getTime(),
      ),
    [followUps],
  )

  const resourceCategories = useMemo(
    () =>
      Object.entries(groupResourcesByType(resources))
        .map(([type, items]) => ({
          type,
          label: getResourceTypeLabel(type),
          description: getResourceDescription(type),
          items,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [resources],
  )

  const nextBooking = upcomingBookings[0] || null
  const nextFollowUp = sortedFollowUps[0] || null
  const featuredResource = resources[0] || null
  const latestMessage = messages[0] || null
  const unreadMessageCount = messages.filter((message) => !message.read_at).length

  const activeLearningCourse = useMemo(
    () =>
      learningCourses.find((course) => course.id === activeLearningCourseId) ||
      learningCourses[0] ||
      null,
    [learningCourses, activeLearningCourseId],
  )

  const activeLearningLesson = useMemo(() => {
    if (!activeLearningCourse) return null

    const lessons = (activeLearningCourse.modules || []).flatMap(
      (module) => module.lessons || [],
    )

    return (
      lessons.find((lesson) => lesson.id === activeLearningLessonId) ||
      lessons.find((lesson) => !lesson.completed_at) ||
      lessons[0] ||
      null
    )
  }, [activeLearningCourse, activeLearningLessonId])

  function updateLearningLessonLocal(lessonId, changes) {
    setLearningCourses((current) =>
      current.map((course) => {
        let lessonWasUpdated = false

        const modules = (course.modules || []).map((module) => ({
          ...module,
          lessons: (module.lessons || []).map((lesson) => {
            if (lesson.id !== lessonId) return lesson

            lessonWasUpdated = true
            return { ...lesson, ...changes }
          }),
        }))

        if (!lessonWasUpdated) return course

        const lessons = modules.flatMap((module) => module.lessons || [])
        const completedCount = lessons.filter((lesson) => lesson.completed_at).length

        return {
          ...course,
          modules,
          lessonCount: lessons.length,
          completedCount,
          progressPercent:
            lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0,
        }
      }),
    )
  }

  async function handleOpenLearningLesson(courseId, lesson) {
    setActiveLearningCourseId(courseId)
    setActiveLearningLessonId(lesson.id)
    setLearningError('')
    setLearningNotice('')

    try {
      const response = await updateClientLearningProgress(lesson.id, {
        completed: Boolean(lesson.completed_at),
        notes: learningNotes[lesson.id] || lesson.progress_notes || '',
      })

      updateLearningLessonLocal(lesson.id, {
        last_viewed_at: response.progress?.last_viewed_at || new Date().toISOString(),
      })
    } catch {
      // The lesson remains readable even if view tracking is temporarily unavailable.
    }
  }

  async function handleLearningProgress(lesson, completed) {
    setSavingLessonId(lesson.id)
    setLearningError('')
    setLearningNotice('')

    try {
      const response = await updateClientLearningProgress(lesson.id, {
        completed,
        notes: learningNotes[lesson.id] || '',
      })

      updateLearningLessonLocal(lesson.id, {
        completed_at: response.progress?.completed_at || null,
        last_viewed_at: response.progress?.last_viewed_at || new Date().toISOString(),
        progress_notes: response.progress?.notes || '',
      })
      setLearningNotice(response.message || 'Your lesson progress was saved.')
    } catch (progressError) {
      setLearningError(
        progressError.message || 'We could not save your lesson progress yet.',
      )
    } finally {
      setSavingLessonId('')
    }
  }

  async function handleSaveLearningNotes(lesson) {
    await handleLearningProgress(lesson, Boolean(lesson.completed_at))
  }

  async function handleLogout() {
    setIsLoggingOut(true)

    try {
      await logoutClientPortal()
      navigate('/client-portal/login')
    } finally {
      setIsLoggingOut(false)
    }
  }

  async function handleProfileSubmit(event) {
    event.preventDefault()
    setIsSavingProfile(true)
    setProfileError('')
    setProfileNotice('')

    try {
      const response = await updateClientPortalProfile(profileDraft)

      setDashboard((current) => ({
        ...current,
        client: response.client,
      }))
      setProfileDraft({
        firstName: response.client.firstName || '',
        lastName: response.client.lastName || '',
        phone: response.client.phone || '',
        emergencyContactName: response.client.emergencyContactName || '',
        emergencyContactPhone: response.client.emergencyContactPhone || '',
      })
      setProfileNotice(response.message || 'Your profile details were saved.')
    } catch (saveError) {
      setProfileError(saveError.message || 'We could not save your profile yet.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    setIsChangingPassword(true)
    setPasswordError('')
    setPasswordNotice('')

    try {
      const response = await changeClientPortalPassword(passwordDraft)

      setPasswordDraft({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setPasswordNotice(response.message || 'Your password was changed successfully.')
      setDashboard((current) => ({
        ...current,
        client: {
          ...current.client,
          passwordChangedAt: response.passwordChangedAt,
        },
      }))
    } catch (changeError) {
      setPasswordError(
        changeError.message || 'We could not change your password yet.',
      )
    } finally {
      setIsChangingPassword(false)
    }
  }

  async function handleMarkMessageRead(messageId) {
    const currentMessage = messages.find((message) => message.id === messageId)

    if (!currentMessage || currentMessage.read_at) return

    setReadingMessageId(messageId)

    try {
      const response = await markClientPortalMessageRead(messageId)

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                read_at: response.readAt || new Date().toISOString(),
              }
            : message,
        ),
      )
    } catch {
      // The message remains visible and can be marked again later.
    } finally {
      setReadingMessageId('')
    }
  }

  function renderHome() {
    return (
      <div className="client-portal-home-v3">
        <section className="client-portal-focus-card-v3">
          <div>
            <p className="eyebrow">Your Next Step</p>
            <h2>
              {nextBooking
                ? 'Your next session is already on the calendar.'
                : featuredResource
                  ? 'Begin with the resource selected for you.'
                  : latestMessage
                    ? 'A new encouragement is waiting for you.'
                    : 'Your private care space is ready.'}
            </h2>
            <p>
              {nextBooking
                ? `${nextBooking.appointment_type_name || 'Private session'} is scheduled for ${formatDateTime(nextBooking.starts_at)} Eastern Time.`
                : featuredResource
                  ? featuredResource.description ||
                    'Open your featured resource whenever you need a grounded reset.'
                  : latestMessage
                    ? 'Open Messages to read the latest note from Power Within.'
                    : 'Shared resources, notes, sessions, and messages will appear here as your journey grows.'}
            </p>
          </div>

          <div className="client-portal-focus-actions-v3">
            {nextBooking ? (
              <Link to="/client-portal/sessions">View my sessions</Link>
            ) : featuredResource ? (
              <Link to="/client-portal/resources">Open my resources</Link>
            ) : latestMessage ? (
              <Link to="/client-portal/messages">Read my messages</Link>
            ) : (
              <Link to="/session-request">Request a session</Link>
            )}
          </div>
        </section>

        <section className="client-portal-home-cards-v3">
          <article>
            <span>Next Session</span>
            <strong>
              {nextBooking
                ? formatDate(nextBooking.starts_at)
                : 'Nothing scheduled'}
            </strong>
            <p>
              {nextBooking
                ? formatDateTime(nextBooking.starts_at)
                : 'Request a session whenever you are ready.'}
            </p>
            <Link to="/client-portal/sessions">Open Sessions</Link>
          </article>

          <article>
            <span>Next Follow-Up</span>
            <strong>
              {nextFollowUp
                ? nextFollowUp.title || nextFollowUp.service_name
                : 'You are up to date'}
            </strong>
            <p>
              {nextFollowUp
                ? formatDateTime(nextFollowUp.follow_up_at)
                : 'No active follow-up reminders right now.'}
            </p>
            <Link to="/client-portal/journey">Open My Journey</Link>
          </article>

          <article>
            <span>Messages</span>
            <strong>
              {unreadMessageCount > 0
                ? `${unreadMessageCount} unread`
                : 'All caught up'}
            </strong>
            <p>
              {latestMessage?.title ||
                'Encouragements from Power Within will appear here.'}
            </p>
            <Link to="/client-portal/messages">Open Messages</Link>
          </article>
        </section>

        <div className="client-portal-home-grid-v3">
          <PortalPanel
            eyebrow="Featured Resource"
            title={featuredResource?.title || 'Your library is ready'}
            action={
              <Link className="client-portal-text-action-v3" to="/client-portal/resources">
                View all
              </Link>
            }
          >
            {featuredResource ? (
              <div className="client-portal-feature-card-v3">
                <div>
                  <span>{formatLabel(featuredResource.resource_type)}</span>
                  <p>
                    {featuredResource.description ||
                      'A resource selected for your current care journey.'}
                  </p>
                </div>

                {featuredResource.resource_url ? (
                  <a
                    href={featuredResource.resource_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Resource
                  </a>
                ) : (
                  <em>Saved as a private note</em>
                )}
              </div>
            ) : (
              <EmptyState title="No resource has been assigned yet.">
                When Power Within adds a guide, worksheet, link, video, reminder,
                or note, it will appear here.
              </EmptyState>
            )}
          </PortalPanel>

          <PortalPanel
            eyebrow="Latest Reflection"
            title="Shared With You"
            action={
              <Link className="client-portal-text-action-v3" to="/client-portal/journey">
                View journey
              </Link>
            }
          >
            {visibleNotes[0] ? (
              <article className="client-portal-note-card-v3">
                <span>{formatLabel(visibleNotes[0].service_type)}</span>
                <h3>{visibleNotes[0].title || visibleNotes[0].service_name}</h3>
                <p>{visibleNotes[0].client_visible_notes}</p>
                <time>{formatDateTime(visibleNotes[0].service_date)}</time>
              </article>
            ) : (
              <EmptyState title="No reflection has been shared yet.">
                Client-visible notes will appear here after Power Within prepares them.
              </EmptyState>
            )}
          </PortalPanel>
        </div>
      </div>
    )
  }

  function renderJourney() {
    return (
      <div className="client-portal-section-stack-v3">
        {client?.clientVisibleNotes && (
          <section className="client-portal-welcome-note-v3">
            <p className="eyebrow">A Note For You</p>
            <p>{client.clientVisibleNotes}</p>
          </section>
        )}

        <div className="client-portal-journey-grid-v3">
          <PortalPanel eyebrow="Shared Reflections" title="Notes From Your Care">
            {visibleNotes.length === 0 ? (
              <EmptyState title="No shared reflections yet.">
                Notes meant for you will appear here after they are prepared.
              </EmptyState>
            ) : (
              <div className="client-portal-card-list-v3">
                {visibleNotes.map((record) => (
                  <article className="client-portal-note-card-v3" key={record.id}>
                    <span>{formatLabel(record.service_type)}</span>
                    <h3>{record.title || record.service_name}</h3>
                    <p>{record.client_visible_notes}</p>
                    <time>{formatDateTime(record.service_date)}</time>
                  </article>
                ))}
              </div>
            )}
          </PortalPanel>

          <PortalPanel eyebrow="Next Steps" title="Follow-Ups">
            {sortedFollowUps.length === 0 ? (
              <EmptyState title="You are up to date.">
                Any gentle reminders or next steps will appear here.
              </EmptyState>
            ) : (
              <div className="client-portal-card-list-v3">
                {sortedFollowUps.map((record) => (
                  <article className="client-portal-follow-up-card-v3" key={record.id}>
                    <strong>{record.title || record.service_name}</strong>
                    <span>{formatDateTime(record.follow_up_at)}</span>
                    {record.summary && <p>{record.summary}</p>}
                  </article>
                ))}
              </div>
            )}
          </PortalPanel>
        </div>

        <PortalPanel eyebrow="Care History" title="Your Service Record">
          {serviceRecords.length === 0 ? (
            <EmptyState title="Your care history will begin here.">
              Completed and planned services will appear as your client record grows.
            </EmptyState>
          ) : (
            <div className="client-portal-timeline-v3">
              {serviceRecords.map((record) => (
                <article key={record.id}>
                  <div className="client-portal-timeline-marker-v3" />
                  <div>
                    <span>{formatLabel(record.service_type)}</span>
                    <h3>{record.title || record.service_name}</h3>
                    {record.summary && <p>{record.summary}</p>}
                    <div>
                      <em>{formatLabel(record.status)}</em>
                      <time>{formatDateTime(record.service_date)}</time>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </PortalPanel>
      </div>
    )
  }

  function renderResources() {
    return (
      <div className="client-portal-section-stack-v3">
        {featuredResource && (
          <section className="client-portal-featured-resource-v3">
            <div>
              <p className="eyebrow">Begin Here</p>
              <h2>{featuredResource.title}</h2>
              <p>
                {featuredResource.description ||
                  'A resource selected for your current care journey.'}
              </p>
            </div>

            <div>
              <span>{formatLabel(featuredResource.resource_type)}</span>
              <time>{formatDate(featuredResource.created_at)}</time>
              {featuredResource.resource_url ? (
                <a
                  href={featuredResource.resource_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Resource
                </a>
              ) : (
                <em>This resource is a private note.</em>
              )}
            </div>
          </section>
        )}

        <PortalPanel eyebrow="Your Library" title={`${resources.length} Saved Resources`}>
          {resources.length === 0 ? (
            <EmptyState title="Your library is waiting for its first resource.">
              When Power Within shares something for your journey, it will appear here.
            </EmptyState>
          ) : (
            <div className="client-portal-resource-categories-v3">
              {resourceCategories.map((category) => (
                <section key={category.type}>
                  <div className="client-portal-resource-category-v3">
                    <span>{category.items.length} saved</span>
                    <h3>{category.label}</h3>
                    <p>{category.description}</p>
                  </div>

                  <div className="client-portal-resource-list-v3">
                    {category.items.map((resource) => (
                      <article key={resource.id}>
                        <div>
                          <strong>{resource.title}</strong>
                          <p>
                            {resource.description ||
                              'Resource saved for your private portal.'}
                          </p>
                          <time>{formatDate(resource.created_at)}</time>
                        </div>

                        {resource.resource_url ? (
                          <a
                            href={resource.resource_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                          </a>
                        ) : (
                          <em>Private note</em>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </PortalPanel>
      </div>
    )
  }

  function renderLearning() {
    if (!learningFeatureEnabled) {
      return (
        <PortalPanel eyebrow="Learning Library" title="Your guided learning space">
          <EmptyState title="The Learning Library is resting right now.">
            Power Within will let you know when guided programs become available in your portal.
          </EmptyState>
        </PortalPanel>
      )
    }

    if (learningCourses.length === 0) {
      return (
        <PortalPanel eyebrow="Learning Library" title="Your guided learning space">
          <EmptyState title="No learning program has been assigned yet.">
            When Power Within selects a guided experience for your journey, it will appear here.
          </EmptyState>
        </PortalPanel>
      )
    }

    return (
      <div className="client-portal-learning-v4">
        {learningError && (
          <div className="client-portal-form-alert-v3 is-error">{learningError}</div>
        )}
        {learningNotice && (
          <div className="client-portal-form-alert-v3 is-success">{learningNotice}</div>
        )}

        <section className="client-learning-program-picker-v4">
          {learningCourses.map((course) => (
            <button
              className={course.id === activeLearningCourse?.id ? 'is-active' : ''}
              key={course.id}
              type="button"
              onClick={() => {
                setActiveLearningCourseId(course.id)
                setActiveLearningLessonId('')
                setLearningError('')
                setLearningNotice('')
              }}
            >
              <span>{course.category || 'Personal Growth'}</span>
              <strong>{course.title}</strong>
              <small>{course.progressPercent || 0}% complete</small>
            </button>
          ))}
        </section>

        {activeLearningCourse && (
          <>
            <section className="client-learning-hero-v4">
              {activeLearningCourse.cover_image_url && (
                <img src={activeLearningCourse.cover_image_url} alt="" />
              )}
              <div>
                <p className="eyebrow">{activeLearningCourse.category || 'Learning Program'}</p>
                <h2>{activeLearningCourse.title}</h2>
                <p>
                  {activeLearningCourse.description ||
                    'A guided experience selected for your personal growth.'}
                </p>
                <div className="client-learning-meta-v4">
                  <span>{activeLearningCourse.lessonCount || 0} lessons</span>
                  <span>{activeLearningCourse.estimated_minutes || 30} minutes</span>
                  <span>{activeLearningCourse.progressPercent || 0}% complete</span>
                </div>
                <div
                  className="client-learning-progress-v4"
                  aria-label={`${activeLearningCourse.progressPercent || 0}% complete`}
                >
                  <span
                    style={{ width: `${Math.min(100, activeLearningCourse.progressPercent || 0)}%` }}
                  />
                </div>
              </div>
            </section>

            <div className="client-learning-layout-v4">
              <aside className="client-learning-curriculum-v4">
                <p className="eyebrow">Your Path</p>
                <h3>Modules & Lessons</h3>
                {(activeLearningCourse.modules || []).map((module, moduleIndex) => (
                  <details key={module.id} open={moduleIndex === 0}>
                    <summary>
                      <span>{moduleIndex + 1}</span>
                      <div>
                        <strong>{module.title}</strong>
                        <small>{module.lessons?.length || 0} lessons</small>
                      </div>
                    </summary>
                    {module.description && <p>{module.description}</p>}
                    <div>
                      {(module.lessons || []).map((lesson, lessonIndex) => (
                        <button
                          className={
                            lesson.id === activeLearningLesson?.id ? 'is-active' : ''
                          }
                          key={lesson.id}
                          type="button"
                          onClick={() => handleOpenLearningLesson(activeLearningCourse.id, lesson)}
                        >
                          <span>{lesson.completed_at ? '✓' : lessonIndex + 1}</span>
                          <div>
                            <strong>{lesson.title}</strong>
                            <small>
                              {formatLessonType(lesson.lesson_type)} ·{' '}
                              {lesson.estimated_minutes || 5} min
                            </small>
                          </div>
                        </button>
                      ))}
                    </div>
                  </details>
                ))}
              </aside>

              <article className="client-learning-lesson-v4">
                {activeLearningLesson ? (
                  <>
                    <header>
                      <div>
                        <span>{formatLessonType(activeLearningLesson.lesson_type)}</span>
                        <h3>{activeLearningLesson.title}</h3>
                        <small>{activeLearningLesson.estimated_minutes || 5} minutes</small>
                      </div>
                      <em className={activeLearningLesson.completed_at ? 'is-complete' : ''}>
                        {activeLearningLesson.completed_at ? 'Complete' : 'In progress'}
                      </em>
                    </header>

                    {activeLearningLesson.content_html ? (
                      <div className="client-learning-lesson-copy-v4">
                        {activeLearningLesson.content_html}
                      </div>
                    ) : (
                      <p className="client-learning-lesson-copy-v4">
                        Open the supporting resource below, then return here when you are ready.
                      </p>
                    )}

                    {activeLearningLesson.external_url && (
                      <a
                        className="client-learning-resource-link-v4"
                        href={activeLearningLesson.external_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {activeLearningLesson.lesson_type === 'video'
                          ? 'Watch the video'
                          : activeLearningLesson.lesson_type === 'download'
                            ? 'Open the download'
                            : 'Open supporting resource'}
                      </a>
                    )}

                    <label className="client-learning-notes-v4">
                      <span>
                        {activeLearningLesson.lesson_type === 'reflection'
                          ? 'Your private reflection'
                          : 'Private notes for yourself'}
                      </span>
                      <textarea
                        rows="6"
                        placeholder="Write anything you want to remember..."
                        value={learningNotes[activeLearningLesson.id] || ''}
                        onChange={(event) =>
                          setLearningNotes((current) => ({
                            ...current,
                            [activeLearningLesson.id]: event.target.value,
                          }))
                        }
                      />
                      <small>These notes stay inside your private client portal.</small>
                    </label>

                    <div className="client-learning-actions-v4">
                      <button
                        type="button"
                        onClick={() => handleSaveLearningNotes(activeLearningLesson)}
                        disabled={savingLessonId === activeLearningLesson.id}
                      >
                        {savingLessonId === activeLearningLesson.id
                          ? 'Saving...'
                          : 'Save my notes'}
                      </button>
                      <button
                        className="is-primary"
                        type="button"
                        onClick={() =>
                          handleLearningProgress(
                            activeLearningLesson,
                            !activeLearningLesson.completed_at,
                          )
                        }
                        disabled={savingLessonId === activeLearningLesson.id}
                      >
                        {activeLearningLesson.completed_at
                          ? 'Mark as not complete'
                          : 'Mark lesson complete'}
                      </button>
                    </div>
                  </>
                ) : (
                  <EmptyState title="This program is waiting for its first lesson.">
                    Power Within is still preparing the learning experience.
                  </EmptyState>
                )}
              </article>
            </div>
          </>
        )}
      </div>
    )
  }

  function renderMembership() {
    if (!membershipFeatureEnabled) {
      return (
        <PortalPanel eyebrow="Membership Circle" title="Memberships are taking a quiet pause.">
          <EmptyState title="This space is not open right now.">
            Power Within will make your membership experience available again when it is ready.
          </EmptyState>
        </PortalPanel>
      )
    }

    if (memberships.length === 0) {
      return (
        <PortalPanel eyebrow="Membership" title="No active membership is connected yet.">
          <EmptyState title="Your portal is ready for future membership access.">
            When Power Within adds you to an active membership, your benefits, resources,
            learning, renewal details, and private updates will appear here.
          </EmptyState>
        </PortalPanel>
      )
    }

    return (
      <div className="client-portal-membership-list-v3">
        {memberships.map((membership) => (
          <article className="client-portal-membership-card-v3" key={membership.id}>
            <header>
              <div>
                <p className="eyebrow">Active Membership</p>
                <h2>{membership.name}</h2>
                <p>{membership.tagline || membership.description}</p>
              </div>
              <div className="client-portal-membership-status-v3">
                <span>{formatLabel(membership.enrollment_status)}</span>
                <strong>
                  {formatMembershipPrice(
                    membership.price_cents,
                    membership.currency,
                    membership.billing_interval,
                  )}
                </strong>
              </div>
            </header>

            {membership.welcome_message && (
              <div className="client-portal-membership-welcome-v3">
                <strong>Welcome to your circle.</strong>
                <p>{membership.welcome_message}</p>
              </div>
            )}

            <div className="client-portal-membership-dates-v3">
              <div>
                <span>Member since</span>
                <strong>{formatDate(membership.started_at)}</strong>
              </div>
              <div>
                <span>Next renewal</span>
                <strong>
                  {membership.renewal_at ? formatDate(membership.renewal_at) : 'Not scheduled'}
                </strong>
              </div>
              <div>
                <span>Access through</span>
                <strong>
                  {membership.ends_at ? formatDate(membership.ends_at) : 'Ongoing'}
                </strong>
              </div>
            </div>

            {Array.isArray(membership.benefits) && membership.benefits.length > 0 && (
              <section className="client-portal-membership-section-v3">
                <div className="client-portal-membership-section-heading-v3">
                  <div>
                    <p className="eyebrow">Your Benefits</p>
                    <h3>What is included</h3>
                  </div>
                </div>
                <ul className="client-portal-membership-benefits-v3">
                  {membership.benefits.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
              </section>
            )}

            {(membership.resources || []).length > 0 && (
              <section className="client-portal-membership-section-v3">
                <div className="client-portal-membership-section-heading-v3">
                  <div>
                    <p className="eyebrow">Member Resources</p>
                    <h3>Private resources for your membership</h3>
                  </div>
                </div>
                <div className="client-portal-membership-resources-v3">
                  {membership.resources.map((resource) => (
                    <article key={resource.id}>
                      <span>{formatLabel(resource.resource_type)}</span>
                      <strong>{resource.title}</strong>
                      <p>{resource.description || 'A private resource selected for members.'}</p>
                      {resource.resource_url && (
                        <a href={resource.resource_url} target="_blank" rel="noreferrer">
                          Open Resource
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {(membership.courses || []).length > 0 && (
              <section className="client-portal-membership-section-v3">
                <div className="client-portal-membership-section-heading-v3">
                  <div>
                    <p className="eyebrow">Member Learning</p>
                    <h3>Learning included with your membership</h3>
                  </div>
                  <Link to="/client-portal/learning">Open Learning Library</Link>
                </div>
                <div className="client-portal-membership-courses-v3">
                  {membership.courses.map((course) => (
                    <article key={course.id}>
                      <span>{course.category || 'Personal Growth'}</span>
                      <strong>{course.title}</strong>
                      <p>{course.description || 'A guided member learning experience.'}</p>
                      <small>{course.estimated_minutes || 30} minutes</small>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {(membership.announcements || []).length > 0 && (
              <section className="client-portal-membership-section-v3">
                <div className="client-portal-membership-section-heading-v3">
                  <div>
                    <p className="eyebrow">Circle Updates</p>
                    <h3>Private membership notes</h3>
                  </div>
                </div>
                <div className="client-portal-membership-updates-v3">
                  {membership.announcements.map((announcement) => (
                    <article key={announcement.id}>
                      <time>{formatDate(announcement.published_at)}</time>
                      <h4>{announcement.title}</h4>
                      <p>{announcement.body}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </article>
        ))}
      </div>
    )
  }

  function renderSessions() {
    return (
      <div className="client-portal-section-stack-v3">
        <section className="client-portal-session-request-v3">
          <div>
            <p className="eyebrow">Need Time Together?</p>
            <h2>Request another session.</h2>
            <p>
              Choose from the available experiences and submit a preferred time.
              Power Within will review the request before it is confirmed.
            </p>
          </div>
          <Link to="/session-request">Request a Session</Link>
        </section>

        <PortalPanel eyebrow="Coming Up" title="Upcoming Sessions">
          {upcomingBookings.length === 0 ? (
            <EmptyState
              title="Nothing is scheduled right now."
              action={<Link to="/session-request">Request a session</Link>}
            >
              When a session is approved or confirmed, it will appear here.
            </EmptyState>
          ) : (
            <div className="client-portal-session-list-v3">
              {upcomingBookings.map((booking, index) => (
                <article className={index === 0 ? 'is-next' : ''} key={booking.id}>
                  <div>
                    {index === 0 && <span>Next Session</span>}
                    <h3>{booking.appointment_type_name || 'Private Session'}</h3>
                    <p>{formatDateTime(booking.starts_at)} Eastern Time</p>
                  </div>
                  <em>{formatLabel(booking.status)}</em>
                </article>
              ))}
            </div>
          )}
        </PortalPanel>

        <PortalPanel eyebrow="Previous Care" title="Session History">
          {previousBookings.length === 0 ? (
            <EmptyState title="No previous sessions are connected yet.">
              Your past session history will appear here.
            </EmptyState>
          ) : (
            <div className="client-portal-session-list-v3 is-history">
              {previousBookings.map((booking) => (
                <article key={booking.id}>
                  <div>
                    <h3>{booking.appointment_type_name || 'Private Session'}</h3>
                    <p>{formatDateTime(booking.starts_at)} Eastern Time</p>
                  </div>
                  <em>{formatLabel(booking.status)}</em>
                </article>
              ))}
            </div>
          )}
        </PortalPanel>
      </div>
    )
  }

  function renderMessages() {
    return (
      <PortalPanel
        eyebrow="Encouragements"
        title={
          unreadMessageCount > 0
            ? `${unreadMessageCount} Unread Message${unreadMessageCount === 1 ? '' : 's'}`
            : 'Your Messages'
        }
      >
        {!messagesFeatureEnabled ? (
          <EmptyState title="Messages are taking a quiet pause.">
            This space will return when Power Within is ready to share new encouragements.
          </EmptyState>
        ) : messages.length === 0 ? (
          <EmptyState title="No messages have been published yet.">
            Encouragements shared with you or the wider Power Within community will appear here.
          </EmptyState>
        ) : (
          <div className="client-portal-message-list-v3">
            {messages.map((message) => (
              <article
                className={message.read_at ? 'is-read' : 'is-unread'}
                key={message.id}
              >
                <div className="client-portal-message-meta-v3">
                  <span>{message.read_at ? 'Read' : 'New'}</span>
                  <time>{formatDate(message.published_at || message.created_at)}</time>
                </div>
                <h3>{message.title || 'A note from Power Within'}</h3>
                <p>{message.body}</p>
                {!message.read_at && (
                  <button
                    type="button"
                    onClick={() => handleMarkMessageRead(message.id)}
                    disabled={readingMessageId === message.id}
                  >
                    {readingMessageId === message.id
                      ? 'Marking as read...'
                      : 'Mark as read'}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </PortalPanel>
    )
  }

  function renderProfile() {
    return (
      <div className="client-portal-profile-grid-v3">
        <PortalPanel eyebrow="Personal Details" title="My Profile">
          {profileError && (
            <div className="client-portal-form-alert-v3 is-error">{profileError}</div>
          )}
          {profileNotice && (
            <div className="client-portal-form-alert-v3 is-success">
              {profileNotice}
            </div>
          )}

          <form className="client-portal-profile-form-v3" onSubmit={handleProfileSubmit}>
            <div className="client-portal-form-grid-v3">
              <label>
                <span>First name</span>
                <input
                  value={profileDraft.firstName}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      firstName: event.target.value,
                    }))
                  }
                  autoComplete="given-name"
                  required
                />
              </label>

              <label>
                <span>Last name</span>
                <input
                  value={profileDraft.lastName}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      lastName: event.target.value,
                    }))
                  }
                  autoComplete="family-name"
                />
              </label>
            </div>

            <label>
              <span>Email</span>
              <input value={client?.email || ''} disabled readOnly />
              <small>
                Contact Power Within if the email connected to your private portal needs to change.
              </small>
            </label>

            <label>
              <span>Phone</span>
              <input
                type="tel"
                value={profileDraft.phone}
                onChange={(event) =>
                  setProfileDraft((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                autoComplete="tel"
              />
            </label>

            <div className="client-portal-form-divider-v3">
              <strong>Emergency contact</strong>
              <p>Optional, but helpful to keep current.</p>
            </div>

            <div className="client-portal-form-grid-v3">
              <label>
                <span>Name</span>
                <input
                  value={profileDraft.emergencyContactName}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      emergencyContactName: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Phone</span>
                <input
                  type="tel"
                  value={profileDraft.emergencyContactPhone}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      emergencyContactPhone: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <button type="submit" disabled={isSavingProfile}>
              {isSavingProfile ? 'Saving...' : 'Save My Profile'}
            </button>
          </form>
        </PortalPanel>

        <PortalPanel eyebrow="Portal Security" title="Change My Password">
          {passwordError && (
            <div className="client-portal-form-alert-v3 is-error">{passwordError}</div>
          )}
          {passwordNotice && (
            <div className="client-portal-form-alert-v3 is-success">
              {passwordNotice}
            </div>
          )}

          <form className="client-portal-profile-form-v3" onSubmit={handlePasswordSubmit}>
            <label>
              <span>Current password</span>
              <input
                type="password"
                value={passwordDraft.currentPassword}
                onChange={(event) =>
                  setPasswordDraft((current) => ({
                    ...current,
                    currentPassword: event.target.value,
                  }))
                }
                autoComplete="current-password"
                required
              />
            </label>

            <label>
              <span>New password</span>
              <input
                type="password"
                value={passwordDraft.newPassword}
                onChange={(event) =>
                  setPasswordDraft((current) => ({
                    ...current,
                    newPassword: event.target.value,
                  }))
                }
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>

            <label>
              <span>Confirm new password</span>
              <input
                type="password"
                value={passwordDraft.confirmPassword}
                onChange={(event) =>
                  setPasswordDraft((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>

            <div className="client-portal-password-rules-v3">
              Use at least 12 characters with uppercase, lowercase, a number, and a symbol.
            </div>

            <button type="submit" disabled={isChangingPassword}>
              {isChangingPassword ? 'Changing Password...' : 'Change My Password'}
            </button>
          </form>

          <div className="client-portal-security-meta-v3">
            <span>Portal status</span>
            <strong>{formatLabel(client?.portalStatus || 'active')}</strong>
            <span>Password last changed</span>
            <strong>
              {client?.passwordChangedAt
                ? formatDate(client.passwordChangedAt)
                : 'Date not recorded'}
            </strong>
          </div>
        </PortalPanel>
      </div>
    )
  }

  function renderActiveSection() {
    if (activeSection === 'journey') return renderJourney()
    if (activeSection === 'resources') return renderResources()
    if (activeSection === 'learning') return renderLearning()
    if (activeSection === 'membership') return renderMembership()
    if (activeSection === 'sessions') return renderSessions()
    if (activeSection === 'messages') return renderMessages()
    if (activeSection === 'profile') return renderProfile()
    return renderHome()
  }

  return (
    <main className="client-portal-app-page-v3">
      <section className="client-portal-app-shell-v3">
        <header className="client-portal-app-header-v3">
          <div className="client-portal-app-brand-v3">
            <span>Power Within</span>
            <strong>Client Portal</strong>
          </div>

          <div className="client-portal-app-user-v3">
            <div>
              <span>Signed in as</span>
              <strong>{client?.name || client?.email || 'Client'}</strong>
            </div>
            <Link to="/">Website</Link>
            <button type="button" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </header>

        <nav className="client-portal-navigation-v3" aria-label="Client portal">
          {portalSections.map((section) => (
            <NavLink
              key={section.key}
              to={section.path}
              className={({ isActive }) => (isActive ? 'is-active' : '')}
            >
              <span>{section.shortLabel}</span>
              {section.key === 'messages' && unreadMessageCount > 0 && (
                <em>{unreadMessageCount}</em>
              )}
            </NavLink>
          ))}
        </nav>

        <section className="client-portal-section-heading-v3">
          <p className="eyebrow">{activeCopy.eyebrow}</p>
          <h1>{activeCopy.title}</h1>
          <p>{activeCopy.description}</p>
        </section>

        {isLoading ? (
          <div className="client-portal-dashboard-message-v1">
            Preparing your private client space...
          </div>
        ) : error ? (
          <div className="client-portal-dashboard-message-v1 is-error">
            <strong>We could not open your portal.</strong>
            <p>{error}</p>
            <Link to="/client-portal/login">Return to login</Link>
          </div>
        ) : (
          renderActiveSection()
        )}
      </section>
    </main>
  )
}
