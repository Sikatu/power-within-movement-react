import {
  RELEASE_QA_CHECKS,
  buildReleaseQaReport,
  inspectReleaseQaResponse,
  summarizeReleaseQaResults,
} from '../src/components/admin/adminReleaseQa.js'

const baseUrl = String(process.env.PWC_QA_BASE_URL || 'http://localhost:8787').replace(/\/$/, '')
const bearerToken = String(process.env.PWC_QA_BEARER_TOKEN || '').trim()
const cookie = String(process.env.PWC_QA_COOKIE || '').trim()

if (!bearerToken && !cookie) {
  console.error('Set PWC_QA_BEARER_TOKEN or PWC_QA_COOKIE before running live release QA.')
  console.error('Example: $env:PWC_QA_BASE_URL="http://localhost:8787"')
  process.exit(2)
}

const results = []

for (const check of RELEASE_QA_CHECKS) {
  const startedAt = performance.now()

  try {
    const response = await fetch(`${baseUrl}${check.endpoint}`, {
      headers: {
        Accept: 'application/json',
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
    })
    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(data?.error || data?.message || `HTTP ${response.status}`)
    }

    results.push({
      ...check,
      ...inspectReleaseQaResponse({
        response: data,
        durationMs: performance.now() - startedAt,
        contract: check,
      }),
    })
  } catch (error) {
    results.push({
      ...check,
      ...inspectReleaseQaResponse({
        error,
        durationMs: performance.now() - startedAt,
        contract: check,
      }),
    })
  }
}

const summary = summarizeReleaseQaResults(results)
console.log(buildReleaseQaReport(results))
process.exit(summary.failed ? 1 : 0)
