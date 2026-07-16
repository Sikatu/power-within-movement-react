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
      label: 'Overview',
      description: 'Daily priorities and Studio health',
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
      match: ['/admin/clients', '/admin/client-360'],
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
      label: 'Inbox',
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
      { to: '/admin/leads', label: 'Leads & Intake', module: 'clients' },
      { to: '/admin/onboarding', label: 'Booking & Onboarding', module: 'clients' },
      { to: '/admin/automations', label: 'Automations', module: 'communications' },
    ],
  },
  {
    id: 'client-experience',
    label: 'Client Experience',
    description: 'Programs, assets, and community',
    items: [
      { to: '/admin/encouragements', label: 'Daily Encouragements', module: 'encouragements' },
      { to: '/admin/courses', label: 'Learning Library', module: 'learning' },
      { to: '/admin/assets', label: 'Asset Vault' },
      { to: '/admin/memberships', label: 'Membership Circle', module: 'memberships' },
      { to: '/admin/circle', label: 'The Circle', module: 'circle' },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    description: 'Letters and session updates',
    items: [
      { to: '/admin/letters', label: 'Letters & Broadcasts', module: 'communications' },
      { to: '/admin/audience', label: 'Newsletter Audience', module: 'communications' },
      { to: '/admin/session-changes', label: 'Session Changes', module: 'sessions' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Focus, accountability, and care quality',
    items: [
      { to: '/admin/operations', label: 'Operations Center', module: 'dashboard' },
      { to: '/admin/brief', label: 'Today in The Studio', module: 'dashboard', hiddenInSidebar: true },
      { to: '/admin/week', label: 'Studio Week Planner', module: 'dashboard', hiddenInSidebar: true },
      { to: '/admin/capacity', label: 'Studio Capacity', module: 'dashboard', hiddenInSidebar: true },
      { to: '/admin/momentum', label: 'Client Momentum', module: 'clients', hiddenInSidebar: true },
      { to: '/admin/coverage', label: 'Coverage & Handoffs', module: 'clients', hiddenInSidebar: true },
      { to: '/admin/readiness', label: 'Session Readiness', module: 'sessions', hiddenInSidebar: true },
      { to: '/admin/follow-through', label: 'Session Follow-Through', module: 'sessions', hiddenInSidebar: true },
      { to: '/admin/attention', label: 'Attention Queue', module: 'clients', hiddenInSidebar: true },
      { to: '/admin/activity', label: 'Studio Activity', module: 'dashboard', hiddenInSidebar: true },
      { to: '/admin/audit-log', label: 'Activity Journal', module: 'audit', hiddenInSidebar: true },
    ],
  },
]

export function workspaceForPath(pathname) {
  if (pathname === '/admin/team' || pathname.startsWith('/admin/developer')) {
    return 'developer'
  }
  if (pathname.startsWith('/admin/founders')) return 'founder'
  return 'studio'
}
