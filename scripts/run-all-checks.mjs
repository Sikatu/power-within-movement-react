import { spawn } from 'node:child_process';
import { cpus } from 'node:os';

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
  'scripts/check-workflow-phase3-client-management.mjs',
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
];

// Run up to (cores - 1) scripts concurrently to prevent CPU starvation
const MAX_CONCURRENT = Math.max(1, cpus().length - 1);

async function runScript(script) {
  return new Promise((resolve, reject) => {
    // using stdio: inherit to stream outputs directly to the console
    const child = spawn('node', [script], { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} failed with code ${code}`));
    });
  });
}

async function main() {
  console.log(`Starting ${scripts.length} verification scripts with concurrency ${MAX_CONCURRENT}...`);
  const queue = [...scripts];
  const running = new Set();

  while (queue.length > 0 || running.size > 0) {
    while (queue.length > 0 && running.size < MAX_CONCURRENT) {
      const script = queue.shift();
      const promise = runScript(script).finally(() => running.delete(promise));
      running.add(promise);
    }
    // Wait for at least one script to finish before spawning more
    if (running.size >= MAX_CONCURRENT || queue.length === 0) {
      await Promise.race(running);
    }
  }
  console.log('All verification scripts passed successfully.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
