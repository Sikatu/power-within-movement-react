const DEFAULT_GUIDE = {
  steps: [
    'Scan the summary first so you know what needs attention.',
    'Choose one record or task before opening its detailed controls.',
    'Review the result and save only when the next step is clear.',
  ],
  safety: 'Private information and protected actions stay inside your current account permissions.',
}

const PAGE_GUIDES = {
  '/admin/dashboard': {
    steps: [
      'Start with Needs attention instead of opening every tool.',
      'Choose the most important client, session, or message.',
      'Return here after the task to confirm the queue has moved forward.',
    ],
    safety: 'The overview summarizes work; it does not change client records by itself.',
  },
  '/admin/clients': {
    steps: [
      'Search or filter the Client Circle, then select one person.',
      'Use the quick profile tabs to review only the area you need.',
      'Open Client 360 only when deeper history or connected work is required.',
    ],
    safety: 'Private notes remain internal. Client-visible notes and portal access are clearly separated.',
  },
  '/admin/scheduler': {
    steps: [
      'Filter the request list and select the session that needs a decision.',
      'Review the requested time, client context, and current status together.',
      'Choose one clear next action, then save any private Studio notes.',
    ],
    safety: 'Status changes affect the booking workflow, so confirm the selected client and time first.',
  },
  '/admin/inbox': {
    steps: [
      'Use the attention filters to find conversations waiting for a reply.',
      'Select one conversation and read its recent context.',
      'Send a client reply or leave a private team note, then move to the next item.',
    ],
    safety: 'Client replies and private team notes are different actions and remain visibly labeled.',
  },
  '/admin/leads': {
    steps: [
      'Filter the pipeline and select one inquiry from the list.',
      'Set the stage, priority, owner, and next follow-up date.',
      'Save the lead, then use Follow-ups for the next contact step.',
    ],
    safety: 'Changing a lead stage does not grant portal access or convert the person automatically.',
  },
  '/admin/onboarding': {
    steps: [
      'Choose Start onboarding when a client is ready to begin.',
      'Select the client, template, owner, and due date before adding notes.',
      'Save the onboarding record and review its progress from the directory.',
    ],
    safety: 'The editor stays closed until you intentionally start or select an onboarding record.',
  },
  '/admin/automations': {
    steps: [
      'Select an existing workflow or create a draft.',
      'Confirm the trigger and owner before arranging its steps.',
      'Review the full sequence before changing the workflow to active.',
    ],
    safety: 'Draft workflows do not run. Activating a workflow can affect enrolled clients.',
  },
  '/admin/courses': {
    steps: [
      'Create or select a learning program from the directory.',
      'Build its modules and lessons in the order clients should follow.',
      'Review access and publish only when the learning path is complete.',
    ],
    safety: 'Draft learning content remains private until it is published and assigned.',
  },
  '/admin/memberships': {
    steps: [
      'Create or select a membership plan.',
      'Define benefits, learning access, resources, and member updates.',
      'Review members and plan status before making access live.',
    ],
    safety: 'Plan status and individual membership status both influence client access.',
  },
  '/admin/assets': {
    steps: [
      'Select an existing resource or upload a new private asset.',
      'Preview and verify the file before assigning it to a client.',
      'Use single-client delivery for normal work and reveal bulk delivery only when needed.',
    ],
    safety: 'Bulk delivery excludes archived clients and asks for confirmation before assignment.',
  },
  '/admin/circle': {
    steps: [
      'Select a post to review it, or choose New Circle Post when you are ready to write.',
      'Confirm the audience and conversation settings before publishing.',
      'Use Moderation only for comments or reports that need care.',
    ],
    safety: 'Drafts remain private. Publishing makes the post visible to its selected member audience.',
  },
  '/admin/letters': {
    steps: [
      'Create or open a letter, then build the message in the Design step.',
      'Choose only eligible recipients and review the final audience count.',
      'Send a test before scheduling or delivering the broadcast.',
    ],
    safety: 'Consent and suppression protections remain active throughout recipient selection and delivery.',
  },
  '/admin/team': {
    steps: [
      'Search the directory and select one team member.',
      'Review Profile first, then adjust Permissions only when their responsibilities change.',
      'Use Client assignments to connect only the clients they actively support.',
    ],
    safety: 'Account access and permissions are sensitive; review the selected person before saving.',
  },
  '/admin/founders-view': {
    steps: [
      'Start with Today to see the schedule and decisions that matter now.',
      'Use Protect my time for availability changes and Voice notes for captured ideas.',
      'Open detailed Studio tools only when the summary cannot complete the task.',
    ],
    safety: 'Developer access is visibly identified when the Founder workspace is being managed on the owner’s behalf.',
  },
  '/admin/developer': {
    steps: [
      'Begin with active incidents, integrity findings, and release blockers.',
      'Open the relevant specialist workspace for evidence and repair details.',
      'Re-run the affected check before considering the incident resolved.',
    ],
    safety: 'Developer tools can affect access and production readiness. Use evidence and the smallest necessary change.',
  },
}

export function adminPageGuidance(pathname) {
  if (PAGE_GUIDES[pathname]) return PAGE_GUIDES[pathname]
  if (pathname.startsWith('/admin/clients/')) return PAGE_GUIDES['/admin/clients']
  if (pathname.startsWith('/admin/client-360/')) return PAGE_GUIDES['/admin/clients']
  if (pathname.startsWith('/admin/founders')) return PAGE_GUIDES['/admin/founders-view']
  if (pathname.startsWith('/admin/developer')) return PAGE_GUIDES['/admin/developer']
  return DEFAULT_GUIDE
}

export const guidedAdminPaths = Object.freeze(Object.keys(PAGE_GUIDES))
