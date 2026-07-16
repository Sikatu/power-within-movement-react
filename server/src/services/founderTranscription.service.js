const { env } = require('../config/env')
const { readObject } = require('./assetStorage.service')

const DEFAULT_PRIMARY_TIMEZONE = 'America/Chicago'
const DEFAULT_COMPARISON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Manila',
  'Europe/London',
]
const TRANSCRIPTION_LOCK_ID = 290029
let dispatcherTimer = null
let dispatcherRunning = false

function isValidTimeZone(value) {
  const timeZone = String(value || '').trim()
  if (!timeZone || timeZone.length > 100) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function normalizeComparisonTimeZones(values, maximum = 8) {
  const source = Array.isArray(values) ? values : DEFAULT_COMPARISON_TIMEZONES
  return [...new Set(source.map((value) => String(value || '').trim()).filter(isValidTimeZone))]
    .slice(0, maximum)
}

function getTranscriptionConfiguration(config = env) {
  const provider = String(config.founderTranscriptionProvider || 'disabled').trim().toLowerCase()
  const supported = provider === 'generic'
  const missing = []
  if (supported && !config.founderTranscriptionApiUrl) missing.push('endpoint')
  if (supported && !config.founderTranscriptionApiKey) missing.push('credential')
  const configured = supported && missing.length === 0

  return {
    provider,
    configured,
    canRequest: configured,
    status: configured ? 'ready' : provider === 'disabled' ? 'disabled' : supported ? 'incomplete' : 'unsupported',
    message: configured
      ? 'Server transcription is ready.'
      : provider === 'disabled'
        ? 'Server transcription has not been enabled yet.'
        : supported
          ? `Server transcription is missing its ${missing.join(' and ')}.`
          : 'The configured transcription provider is not supported.',
  }
}

function extractTranscript(payload) {
  const text = typeof payload === 'string'
    ? payload
    : payload?.text || payload?.transcript || payload?.result?.text || ''
  return String(text || '').trim()
}

async function transcribeRecording(recording, config = env) {
  const state = getTranscriptionConfiguration(config)
  if (!state.configured) {
    const error = new Error(state.message)
    error.code = 'TRANSCRIPTION_NOT_CONFIGURED'
    throw error
  }

  const audio = await readObject(recording)
  const form = new FormData()
  form.append('file', new Blob([audio], { type: recording.mime_type }), recording.original_filename)
  if (config.founderTranscriptionModel) form.append('model', config.founderTranscriptionModel)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.founderTranscriptionTimeoutMs || 120000)
  try {
    const response = await fetch(config.founderTranscriptionApiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.founderTranscriptionApiKey}` },
      body: form,
      signal: controller.signal,
    })
    const body = await response.text()
    let payload = body
    try { payload = JSON.parse(body) } catch { /* plain text is a supported generic response */ }
    if (!response.ok) throw new Error(`Transcription provider returned HTTP ${response.status}.`)
    const transcript = extractTranscript(payload)
    if (!transcript) throw new Error('Transcription provider returned an empty transcript.')
    return transcript
  } finally {
    clearTimeout(timeout)
  }
}

async function processFounderTranscriptions(pool, { limit = 2 } = {}) {
  const configuration = getTranscriptionConfiguration()
  if (!pool) return { processed: 0, skipped: 'database_not_configured', configuration }
  if (!configuration.configured) return { processed: 0, skipped: 'provider_not_configured', configuration }

  const lockResult = await pool.query('SELECT pg_try_advisory_lock($1) AS acquired', [TRANSCRIPTION_LOCK_ID])
  if (!lockResult.rows[0]?.acquired) return { processed: 0, skipped: 'dispatcher_busy', configuration }

  let processed = 0
  let completed = 0
  let failed = 0
  try {
    const jobsResult = await pool.query(
      `
      SELECT job.id AS job_id, job.recording_id, job.attempts,
        recording.asset_id, recording.mime_type,
        asset.original_filename, asset.storage_driver, asset.storage_key
      FROM founder_transcription_jobs job
      JOIN founder_recordings recording ON recording.id = job.recording_id
      JOIN assets asset ON asset.id = recording.asset_id
      WHERE job.status IN ('queued', 'failed')
        AND job.available_at <= now()
        AND recording.status = 'active'
        AND asset.status = 'active'
        AND job.attempts < 3
      ORDER BY job.available_at ASC, job.created_at ASC
      LIMIT $1
      `,
      [Math.min(Math.max(Number(limit) || 2, 1), 5)],
    )

    for (const job of jobsResult.rows) {
      const claim = await pool.query(
        `
        UPDATE founder_transcription_jobs
        SET status = 'processing', locked_at = now(), attempts = attempts + 1, error_message = NULL
        WHERE id = $1 AND status IN ('queued', 'failed')
        RETURNING *
        `,
        [job.job_id],
      )
      if (!claim.rows[0]) continue
      processed += 1
      await pool.query(
        `UPDATE founder_recordings SET transcript_status = 'processing', transcript_error = NULL WHERE id = $1`,
        [job.recording_id],
      )

      try {
        const transcript = await transcribeRecording(job)
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          await client.query(
            `
            UPDATE founder_recordings
            SET transcript_status = 'ready', transcript_text = $2, transcript_provider = $3,
                transcript_error = NULL, transcript_completed_at = now()
            WHERE id = $1
            `,
            [job.recording_id, transcript, configuration.provider],
          )
          await client.query(
            `UPDATE founder_transcription_jobs SET status = 'completed', completed_at = now(), locked_at = NULL WHERE id = $1`,
            [job.job_id],
          )
          await client.query(
            `INSERT INTO founder_recording_events (recording_id, asset_id, event_type, metadata) VALUES ($1, $2, 'transcript_completed', $3::jsonb)`,
            [job.recording_id, job.asset_id, JSON.stringify({ provider: configuration.provider, characters: transcript.length })],
          )
          await client.query('COMMIT')
          completed += 1
        } catch (error) {
          await client.query('ROLLBACK')
          throw error
        } finally {
          client.release()
        }
      } catch (error) {
        const safeMessage = error.name === 'AbortError'
          ? 'Transcription timed out.'
          : String(error.message || 'Transcription failed.').slice(0, 500)
        const attempts = Number(claim.rows[0].attempts || 1)
        await pool.query(
          `
          UPDATE founder_transcription_jobs
          SET status = 'failed', error_message = $2, locked_at = NULL,
              available_at = now() + ($3::int * interval '5 minutes')
          WHERE id = $1
          `,
          [job.job_id, safeMessage, attempts],
        )
        await pool.query(
          `UPDATE founder_recordings SET transcript_status = 'failed', transcript_error = $2 WHERE id = $1`,
          [job.recording_id, safeMessage],
        )
        failed += 1
      }
    }
  } finally {
    await pool.query('SELECT pg_advisory_unlock($1)', [TRANSCRIPTION_LOCK_ID])
  }

  return { processed, completed, failed, configuration }
}

function startFounderTranscriptionDispatcher(pool) {
  if (!pool || dispatcherTimer) return
  const run = async () => {
    if (dispatcherRunning) return
    dispatcherRunning = true
    try { await processFounderTranscriptions(pool) } catch (error) {
      console.error('Founder transcription dispatcher failed:', error.message)
    } finally { dispatcherRunning = false }
  }
  dispatcherTimer = setInterval(run, 60_000)
  dispatcherTimer.unref?.()
  const startupTimer = setTimeout(run, 5_000)
  startupTimer.unref?.()
}

module.exports = {
  DEFAULT_COMPARISON_TIMEZONES,
  DEFAULT_PRIMARY_TIMEZONE,
  extractTranscript,
  getTranscriptionConfiguration,
  isValidTimeZone,
  normalizeComparisonTimeZones,
  processFounderTranscriptions,
  startFounderTranscriptionDispatcher,
  transcribeRecording,
}
