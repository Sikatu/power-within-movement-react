import { spawn } from 'node:child_process'
import { cpus } from 'node:os'

const scripts = [
  'scripts/check-admin-ui-reset.mjs',
  'scripts/check-admin-routes.mjs',
  'scripts/check-admin-dialogs.mjs',
  'scripts/check-admin-resilience.mjs',
  'scripts/check-admin-command-center.mjs',
  'scripts/check-admin-pinned-workspaces.mjs',
  'scripts/check-admin-activity-center.mjs',
  'scripts/check-admin-attention-queue.mjs',
  'scripts/check-admin-daily-brief.mjs',
  'scripts/check-admin-week-planner.mjs',
  'scripts/check-admin-capacity-center.mjs',
  'scripts/check-admin-client-momentum.mjs',
  'scripts/check-admin-client-coverage.mjs',
  'scripts/check-admin-session-readiness.mjs',
  'scripts/check-admin-session-follow-through.mjs',
  'scripts/check-admin-security-integrity.mjs',
  'scripts/check-admin-release-qa.mjs',
  'scripts/check-admin-phase24-stability.mjs',
  'scripts/check-admin-phase25-developer-operations.mjs',
  'scripts/check-admin-phase25-premium.mjs',
  'scripts/check-admin-phase25r1-finish.mjs',
  'scripts/check-admin-phase25r2-finish.mjs',
  'scripts/check-admin-phase26-asset-vault.mjs',
  'scripts/check-admin-phase26r1-bulk-assignment.mjs',
  'scripts/check-admin-phase26r2-asset-hardening.mjs',
  'scripts/check-admin-phase27-audience.mjs',
  'scripts/check-admin-phase28-letters.mjs',
  'scripts/check-admin-phase29-founder.mjs',
  'scripts/check-admin-phase30-release.mjs',
  'scripts/check-admin-phase30r2-clients-layout.mjs',
  'scripts/check-admin-phase30r4-client-actions.mjs',
  'scripts/check-admin-phase30r6-client-tabs.mjs',
  'scripts/check-admin-phase31-streamlining.mjs',
  'scripts/check-admin-phase32-daily-workflows.mjs',
  'scripts/check-admin-phase33-growth-workflows.mjs',
  'scripts/check-admin-phase34-client-experience.mjs',
  'scripts/check-admin-phase35-communication-workflows.mjs',
  'scripts/check-admin-phase36-operations-workflows.mjs',
  'scripts/check-admin-phase37-founder-workflows.mjs',
  'scripts/check-admin-phase38-developer-workflows.mjs',
  'scripts/check-admin-phase39-shell-streamlining.mjs',
  'scripts/check-phase40-client-portal-streamlining.mjs',
  'scripts/check-phase41-client-workflow-streamlining.mjs',
  'scripts/check-phase42-client-explore-streamlining.mjs',
  'scripts/check-phase43-client-account-foundation.mjs',
  'scripts/check-phase44-client-notification-center.mjs',
  'scripts/check-phase45-client-messages.mjs',
  'scripts/check-phase45r1-founder-shell.mjs',
  'scripts/check-phase45r2-backend-repairs.mjs',
  'scripts/check-phase45r2r1-auth-ui.mjs',
  'scripts/check-phase46-studio-profile.mjs',
  'scripts/check-phase47-private-studio-identity.mjs',
  'scripts/check-phase48-error-center-reliability.mjs',
  'scripts/check-phase48r1-error-notifications.mjs',
  'scripts/check-phase49-incident-triage.mjs',
  'scripts/check-phase50-release-candidate.mjs',
  'scripts/check-phase50r1-final-usability.mjs',
  'scripts/check-phase51-guided-accessibility.mjs',
  'scripts/check-phase52-comfort-view.mjs',
  'scripts/check-phase53-visual-acceptance.mjs',
  'scripts/check-phase54-predeploy-performance.mjs',
  'scripts/check-public-release-essentials.mjs',
  'scripts/check-admin-visual-coverage.mjs',
]

const maxConcurrent = Math.min(8, Math.max(1, cpus().length - 1))

function runScript(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { stdio: 'inherit' })
    child.on('error', (error) => resolve({ script, code: 1, error }))
    child.on('close', (code) => resolve({ script, code: code ?? 1 }))
  })
}

async function main() {
  console.log(`Starting ${scripts.length} verification scripts with concurrency ${maxConcurrent}...`)
  const queue = [...scripts]
  const failures = []

  async function worker() {
    while (queue.length > 0) {
      const script = queue.shift()
      const result = await runScript(script)
      if (result.code !== 0) failures.push(result)
    }
  }

  await Promise.all(Array.from({ length: Math.min(maxConcurrent, scripts.length) }, () => worker()))

  if (failures.length > 0) {
    console.error(`\n${failures.length} verification script(s) failed:`)
    for (const failure of failures) console.error(`- ${failure.script} (exit ${failure.code})`)
    process.exit(1)
  }

  console.log(`All ${scripts.length} verification scripts passed successfully.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
