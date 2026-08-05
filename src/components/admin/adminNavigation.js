export const workspaceDefinitions = [
  {
    id: 'studio',
    label: 'The Studio',
    description: 'Business operations',
    to: '/admin/dashboard',
    roles: ['developer', 'owner', 'admin', 'staff'],
  },
  {
    id: 'founder',
    label: 'Founder’s View',
    description: 'Owner clarity and approvals',
    to: '/admin/founders-view',
    roles: ['developer', 'owner'],
  },
  {
    id: 'developer',
    label: 'Developer Operations',
    description: 'Health, security, access, and releases',
    to: '/admin/developer',
    roles: ['developer'],
  },
]

export const workspacePrimaryItems = {
  studio: [
    {
      id: 'overview',
      to: '/admin/dashboard',
      label: 'Today',
      description: 'Priorities, sessions, and next actions',
      module: 'dashboard',
      icon: 'overview',
    },
    {
      id: 'clients',
      to: '/admin/clients',
      label: 'Clients',
      description: 'Client records, care, and access',
      module: 'clients',
      icon: 'clients',
      match: ['/admin/clients', '/admin/client-360', '/admin/momentum', '/admin/coverage'],
    },
    {
      id: 'sessions',
      to: '/admin/scheduler',
      label: 'Sessions',
      description: 'Requests, bookings, and availability',
      module: 'sessions',
      icon: 'sessions',
    },
    {
      id: 'inbox',
      to: '/admin/inbox',
      label: 'Messages',
      description: 'Client conversations and follow-up',
      module: 'inbox',
      icon: 'inbox',
    },
  ],
  founder: [
    {
      id: 'founder-overview',
      to: '/admin/founders-view',
      label: 'Founder Overview',
      description: 'Priorities, approvals, and today’s focus',
      roles: ['developer', 'owner'],
      icon: 'founder',
    },
    {
      id: 'founder-calendar',
      to: '/admin/founders-calendar',
      label: 'My Calendar',
      description: 'Sessions and protected time',
      roles: ['developer', 'owner'],
      icon: 'calendar',
    },
    {
      id: 'founder-availability',
      to: '/admin/founders-availability',
      label: 'Protect My Time',
      description: 'Weekly hours and date exceptions',
      roles: ['developer', 'owner'],
      icon: 'availability',
    },
  ],
  developer: [
    {
      id: 'developer-overview',
      to: '/admin/developer',
      label: 'Command Center',
      description: 'Monitor, protect, release, and configure',
      roles: ['developer'],
      developerOnly: true,
      icon: 'developer',
    },
    {
      id: 'developer-errors',
      to: '/admin/developer/errors',
      label: 'Error Center',
      description: 'Production issues and triage',
      roles: ['developer'],
      developerOnly: true,
      icon: 'errors',
      hiddenInSidebar: true,
    },
    {
      id: 'developer-integrity',
      to: '/admin/developer/integrity',
      label: 'Security & Integrity',
      description: 'Identity and permission checks',
      roles: ['developer'],
      developerOnly: true,
      icon: 'security',
      hiddenInSidebar: true,
    },
    {
      id: 'developer-release',
      to: '/admin/developer/qa',
      label: 'Release QA',
      description: 'Evidence and deployment readiness',
      roles: ['developer'],
      developerOnly: true,
      icon: 'release',
      hiddenInSidebar: true,
    },
    {
      id: 'developer-team',
      to: '/admin/team',
      label: 'Staff & Team',
      description: 'Accounts, roles, and workload',
      roles: ['developer'],
      developerOnly: true,
      icon: 'team',
    },
  ],
}

export const studioGroups = [
  {
    id: 'growth',
    label: 'Growth',
    description: 'Leads, onboarding, and nurture',
    items: [
      {
        to: '/admin/leads',
        label: 'Leads & Intake',
        module: 'clients',
      },
      {
        to: '/admin/onboarding',
        label: 'Booking & Onboarding',
        module: 'clients',
      },
      {
        to: '/admin/automations',
        label: 'Automations',
        module: 'communications',
      },
    ],
  },
  {
    id: 'programs',
    label: 'Programs & Community',
    description: 'Learning, resources, memberships, and community',
    items: [
      {
        to: '/admin/courses',
        label: 'Learning Library',
        module: 'learning',
      },
      {
        to: '/admin/assets',
        label: 'Asset Vault',
      },
      {
        to: '/admin/memberships',
        label: 'Memberships',
        module: 'memberships',
      },
      {
        to: '/admin/circle',
        label: 'The Circle',
        module: 'circle',
      },
    ],
  },
  {
    id: 'messages',
    label: 'Message Tools',
    description: 'Portal updates, letters, and audiences',
    items: [
      {
        to: '/admin/encouragements',
        label: 'Portal Messages',
        module: 'encouragements',
      },
      {
        to: '/admin/letters',
        label: 'Letters & Broadcasts',
        module: 'communications',
      },
      {
        to: '/admin/audience',
        label: 'Newsletter Audience',
        module: 'communications',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Planning, care continuity, and accountable history',
    items: [
      {
        to: '/admin/operations',
        label: 'Operations Center',
        module: 'dashboard',
      },
      {
        to: '/admin/week',
        label: 'Week Planner',
        module: 'dashboard',
      },
      {
        to: '/admin/capacity',
        label: 'Studio Capacity',
        module: 'dashboard',
      },
      {
        to: '/admin/attention',
        label: 'Attention Queue',
        module: 'clients',
      },
      {
        to: '/admin/readiness',
        label: 'Session Readiness',
        module: 'sessions',
      },
      {
        to: '/admin/follow-through',
        label: 'Session Follow-Through',
        module: 'sessions',
      },
      {
        to: '/admin/session-changes',
        label: 'Session Changes',
        module: 'sessions',
      },
      {
        to: '/admin/activity',
        label: 'History',
        module: 'dashboard',
      },
      {
        to: '/admin/audit-log',
        label: 'Activity Journal',
        module: 'audit',
        hiddenInSidebar: true,
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Studio identity and private configuration',
    items: [
      {
        to: '/admin/studio-profile',
        label: 'Studio Profile',
        roles: ['developer', 'owner', 'admin'],
      },
    ],
  },
]

export function workspaceForPath(pathname) {
  if (
    pathname === '/admin/team'
    || pathname.startsWith('/admin/developer')
  ) {
    return 'developer'
  }

  if (pathname.startsWith('/admin/founders')) return 'founder'

  return 'studio'
}
