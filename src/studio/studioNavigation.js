export const studioPrimaryNavigation = [
  {
    id: 'today',
    to: '/studio/today',
    label: 'Today',
    description: 'Priorities and next actions',
    icon: 'today',
  },
  {
    id: 'pipeline',
    to: '/studio/pipeline',
    label: 'Pipeline',
    description: 'Leads and conversion',
    icon: 'pipeline',
  },
  {
    id: 'clients',
    to: '/studio/clients',
    label: 'Clients',
    description: 'Relationships and care',
    icon: 'clients',
  },
  {
    id: 'sessions',
    to: '/studio/sessions',
    label: 'Sessions',
    description: 'Requests through follow-through',
    icon: 'sessions',
  },
  {
    id: 'inbox',
    to: '/studio/inbox',
    label: 'Inbox',
    description: 'Conversations and communication',
    icon: 'inbox',
  },
  {
    id: 'more',
    to: '/studio/more',
    label: 'More',
    description: 'Secondary Studio tools',
    icon: 'more',
  },
]

export const studioWorkspaceContracts = {
  pipeline: {
    id: 'pipeline',
    eyebrow: 'Lead journey',
    title: 'Pipeline',
    description:
      'Guide each inquiry from the first response through a clear service decision.',
    legacyPath: '/admin/leads',
    legacyLabel: 'Open current Leads & Intake',
    workflow: [
      'New Inquiry',
      'Contacted',
      'Consultation Scheduled',
      'Consultation Completed',
      'Service Recommended',
      'Decision Pending',
      'Converted',
    ],
    principles: [
      'Every lead has an owner.',
      'Every active lead has a next action.',
      'Every next action has a due date.',
      'Conversion preserves the complete relationship history.',
    ],
  },
  clients: {
    id: 'clients',
    eyebrow: 'Client relationships',
    title: 'Clients',
    description:
      'Keep every established client relationship, journey, and next action together.',
    legacyPath: '/admin/clients',
    legacyLabel: 'Open current Client Circle',
    workflow: [
      'Onboarding',
      'Active Service',
      'Follow-Up',
      'Ongoing Care',
      'Alumni / Referral',
    ],
    principles: [
      'One complete record per client.',
      'Sessions, messages, notes, and tasks share one timeline.',
      'Portal access is managed from the client relationship.',
      'Secondary details appear progressively, not as separate dashboards.',
    ],
  },
  sessions: {
    id: 'sessions',
    eyebrow: 'Session lifecycle',
    title: 'Sessions',
    description:
      'Manage every session through one calm and predictable lifecycle.',
    legacyPath: '/admin/scheduler',
    legacyLabel: 'Open current Sessions workspace',
    workflow: [
      'Request',
      'Review',
      'Confirm',
      'Prepare',
      'Complete',
      'Follow Through',
    ],
    principles: [
      'Requests and confirmed sessions remain distinguishable.',
      'The next session action is always visible.',
      'Availability supports the workflow without dominating it.',
      'Changes and cancellations remain part of the same session record.',
    ],
  },
  inbox: {
    id: 'inbox',
    eyebrow: 'Communication',
    title: 'Inbox',
    description:
      'Keep lead and client communication together without creating separate systems.',
    legacyPath: '/admin/inbox',
    legacyLabel: 'Open current Messages workspace',
    workflow: [
      'Conversations',
      'Email',
      'Encouragements',
      'Letters',
      'Broadcasts',
    ],
    principles: [
      'The person and relationship remain visible.',
      'Unread and response-needed states are clear.',
      'Communication history connects to the lead or client record.',
      'Secondary composition tools never overpower the conversation.',
    ],
  },
}

export const studioMoreTools = [
  {
    group: 'Client experience',
    items: [
      {
        label: 'Resource Library',
        description: 'Guides, worksheets, videos, and private assignments',
        to: '/admin/assets',
      },
      {
        label: 'Learning Library',
        description: 'Courses, lessons, and client learning access',
        to: '/admin/courses',
      },
      {
        label: 'Memberships',
        description: 'Plans, enrollments, benefits, and announcements',
        to: '/admin/memberships',
      },
      {
        label: 'The Circle',
        description: 'Private community and moderation',
        to: '/admin/circle',
      },
    ],
  },
  {
    group: 'Studio operations',
    items: [
      {
        label: 'Automations',
        description: 'Care and communication workflow automation',
        to: '/admin/automations',
      },
      {
        label: 'Onboarding',
        description: 'Booking, intake, and client setup',
        to: '/admin/onboarding',
      },
      {
        label: 'Studio Profile',
        description: 'Private business identity and settings',
        to: '/admin/studio-profile',
      },
      {
        label: 'Activity Journal',
        description: 'Accountable operational history',
        to: '/admin/audit-log',
      },
    ],
  },
]

export function studioNavigationForPath(pathname) {
  return studioPrimaryNavigation.find((item) => (
    pathname === item.to || pathname.startsWith(`${item.to}/`)
  )) || studioPrimaryNavigation[0]
}