export const RELEASE_QA_VIEWPORTS = [
  { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
  { id: 'laptop', label: 'Laptop', width: 1280, height: 800 },
  { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
  { id: 'mobile', label: 'Mobile', width: 390, height: 844 },
]

export const RELEASE_QA_CHECKS = [
  {
    id: 'developer-access',
    title: 'Developer session',
    category: 'Access',
    endpoint: '/api/auth/developer-check',
    route: '/admin/developer',
    description: 'Confirms the current browser session can reach Developer-only operations.',
    requiredPaths: ['ok'],
    critical: true,
  },
  {
    id: 'studio-overview',
    title: 'Studio overview',
    category: 'Core Studio',
    endpoint: '/api/admin/overview',
    route: '/admin/dashboard',
    description: 'Checks the primary dashboard aggregate and its production count payload.',
    requiredPaths: ['overview'],
    critical: true,
  },
  {
    id: 'client-circle',
    title: 'Client Circle',
    category: 'Core Studio',
    endpoint: '/api/admin/clients',
    route: '/admin/clients',
    description: 'Verifies the role-scoped client collection and flags high-density visual review.',
    collectionPaths: ['clients', 'clientProfiles', 'records'],
    densityThreshold: 40,
    critical: true,
  },
  {
    id: 'sessions',
    title: 'Sessions and calendar',
    category: 'Core Studio',
    endpoint: '/api/admin/bookings',
    route: '/admin/scheduler',
    description: 'Verifies booking data used by the calendar and session workspaces.',
    collectionPaths: ['bookings', 'records'],
    densityThreshold: 45,
    critical: true,
  },
  {
    id: 'secure-inbox',
    title: 'Secure Inbox',
    category: 'Communication',
    endpoint: '/api/admin/inbox',
    route: '/admin/inbox',
    description: 'Checks private conversation data and identifies dense inbox states.',
    collectionPaths: ['conversations'],
    requiredPaths: ['metrics'],
    densityThreshold: 30,
  },
  {
    id: 'attention-queue',
    title: 'Attention Queue',
    category: 'Operations',
    endpoint: '/api/admin/attention-queue',
    route: '/admin/attention',
    description: 'Checks accountable work, ownership data, and due-date coverage.',
    collectionPaths: ['tasks'],
    requiredPaths: ['metrics'],
    densityThreshold: 35,
  },
  {
    id: 'studio-capacity',
    title: 'Studio Capacity',
    category: 'Operations',
    endpoint: '/api/admin/team/workload',
    route: '/admin/capacity',
    description: 'Checks team workload, availability, and assignment aggregates.',
    collectionPaths: ['members'],
    requiredPaths: ['summary'],
    densityThreshold: 16,
  },
  {
    id: 'client-momentum',
    title: 'Client Momentum',
    category: 'Client Care',
    endpoint: '/api/admin/client-momentum',
    route: '/admin/momentum',
    description: 'Checks active client journey signals against real operational data.',
    collectionPaths: ['clients'],
    requiredPaths: ['summary'],
    densityThreshold: 35,
  },
  {
    id: 'coverage-handoffs',
    title: 'Coverage and handoffs',
    category: 'Client Care',
    endpoint: '/api/admin/client-coverage',
    route: '/admin/coverage',
    description: 'Checks ownership, availability, backup support, and continuity signals.',
    collectionPaths: ['clients'],
    requiredPaths: ['summary'],
    densityThreshold: 35,
  },
  {
    id: 'session-readiness',
    title: 'Session Readiness',
    category: 'Sessions',
    endpoint: '/api/admin/session-readiness?days=14',
    route: '/admin/readiness',
    description: 'Checks upcoming preparation signals across intake, care, and confirmations.',
    collectionPaths: ['sessions'],
    requiredPaths: ['summary'],
    densityThreshold: 30,
  },
  {
    id: 'session-follow-through',
    title: 'Session Follow-Through',
    category: 'Sessions',
    endpoint: '/api/admin/session-follow-through?days=30',
    route: '/admin/follow-through',
    description: 'Checks recent-session continuity, documentation, and next-step signals.',
    collectionPaths: ['sessions'],
    requiredPaths: ['summary'],
    densityThreshold: 30,
  },
  {
    id: 'asset-vault',
    title: 'Asset Vault',
    category: 'Content Infrastructure',
    endpoint: '/api/admin/assets',
    route: '/admin/assets',
    description: 'Checks protected asset metadata, assignment density, and reusable content records.',
    collectionPaths: ['assets'],
    densityThreshold: 80,
    critical: true,
  },
  {
    id: 'security-integrity',
    title: 'Security and data integrity',
    category: 'System',
    endpoint: '/api/admin/developer/security-integrity',
    route: '/admin/developer/integrity',
    description: 'Checks privileged access, permissions, runtime security, and record integrity.',
    collectionPaths: ['checks'],
    requiredPaths: ['summary', 'runtime'],
    densityThreshold: 25,
    critical: true,
  },
  {
    id: 'system-health',
    title: 'Platform system health',
    category: 'System',
    endpoint: '/api/admin/developer/system-health',
    route: '/admin/developer',
    description: 'Checks database connectivity, required tables, runtime configuration, and memory.',
    requiredPaths: ['database', 'application', 'configuration'],
    critical: true,
  },
]

export function getReleaseQaValue(source, path) {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((value, key) => value?.[key], source)
}

export function getReleaseQaCollection(response, collectionPaths = []) {
  for (const path of collectionPaths) {
    const value = getReleaseQaValue(response, path)
    if (Array.isArray(value)) return { path, value }
  }

  return null
}

export function inspectReleaseQaResponse({
  response,
  durationMs = 0,
  contract,
  error,
}) {
  if (error) {
    return {
      status: 'fail',
      count: null,
      topLevelKeys: [],
      notes: [error.message || String(error)],
      durationMs: Math.max(0, Math.round(durationMs)),
    }
  }

  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return {
      status: 'fail',
      count: null,
      topLevelKeys: [],
      notes: ['The endpoint did not return a JSON object.'],
      durationMs: Math.max(0, Math.round(durationMs)),
    }
  }

  const notes = []
  let status = 'pass'
  let count = null

  const missingPaths = (contract.requiredPaths || []).filter(
    (path) => getReleaseQaValue(response, path) === undefined,
  )

  if (missingPaths.length) {
    status = 'fail'
    notes.push(`Missing required response field${missingPaths.length === 1 ? '' : 's'}: ${missingPaths.join(', ')}`)
  }

  if (contract.collectionPaths?.length) {
    const collection = getReleaseQaCollection(response, contract.collectionPaths)

    if (!collection) {
      status = 'fail'
      notes.push(`Expected one collection field: ${contract.collectionPaths.join(', ')}`)
    } else {
      count = collection.value.length
      notes.push(`${count} record${count === 1 ? '' : 's'} returned from ${collection.path}.`)

      if (contract.densityThreshold && count >= contract.densityThreshold && status !== 'fail') {
        status = 'review'
        notes.push(`High-density state: review ${contract.route} at desktop, tablet, and mobile widths.`)
      } else if (count === 0) {
        notes.push('Empty-state rendering is required for this workspace.')
      }
    }
  }

  const roundedDuration = Math.max(0, Math.round(durationMs))
  if (roundedDuration >= 2500) {
    status = contract.critical ? 'fail' : status === 'pass' ? 'review' : status
    notes.push(`Slow response: ${roundedDuration} ms exceeds the 2500 ms release threshold.`)
  } else if (roundedDuration >= 1200) {
    if (status === 'pass') status = 'review'
    notes.push(`Response took ${roundedDuration} ms; review database and network timing.`)
  }

  if (!notes.length) notes.push('Response shape and timing are within the release thresholds.')

  return {
    status,
    count,
    durationMs: roundedDuration,
    topLevelKeys: Object.keys(response).sort(),
    notes,
  }
}

export function summarizeReleaseQaResults(results = []) {
  const completed = results.filter((result) => result.status && result.status !== 'pending')
  const passed = completed.filter((result) => result.status === 'pass').length
  const review = completed.filter((result) => result.status === 'review').length
  const failed = completed.filter((result) => result.status === 'fail').length
  const durations = completed
    .map((result) => Number(result.durationMs || 0))
    .filter((duration) => Number.isFinite(duration))
  const averageLatencyMs = durations.length
    ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)
    : 0

  return {
    total: results.length,
    completed: completed.length,
    passed,
    review,
    failed,
    averageLatencyMs,
    ready: completed.length === results.length && failed === 0,
  }
}

export function buildReleaseQaReport(results = [], generatedAt = new Date().toISOString()) {
  const summary = summarizeReleaseQaResults(results)
  const lines = [
    'Power Within Collective — Phase 23 Release QA',
    `Generated: ${generatedAt}`,
    `Status: ${summary.ready ? 'READY FOR MANUAL VISUAL REVIEW' : 'NOT READY'}`,
    `Checks: ${summary.passed} passed, ${summary.review} review, ${summary.failed} failed`,
    `Average response: ${summary.averageLatencyMs} ms`,
    '',
  ]

  for (const result of results) {
    lines.push(`[${String(result.status || 'pending').toUpperCase()}] ${result.title}`)
    lines.push(`Endpoint: ${result.endpoint}`)
    lines.push(`Duration: ${result.durationMs ?? 0} ms`)
    if (result.count !== null && result.count !== undefined) lines.push(`Records: ${result.count}`)
    for (const note of result.notes || []) lines.push(`- ${note}`)
    lines.push('')
  }

  return lines.join('\n').trim()
}
