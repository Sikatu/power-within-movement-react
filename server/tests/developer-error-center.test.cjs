const assert = require('node:assert/strict')
const test = require('node:test')

const {
  captureApplicationError,
  getErrorCenterPersistenceHealth,
} = require('../src/services/developerErrorCenter.service')

test('Developer Error Center writes use the named fingerprint constraint', async () => {
  const queries = []
  const db = {
    async query(sql, params = []) {
      queries.push({ sql, params })

      if (sql.includes('SELECT value FROM platform_settings')) {
        return { rows: [] }
      }

      if (sql.includes('INSERT INTO application_errors')) {
        return {
          rows: [{
            id: 'error-1',
            fingerprint: params[0],
            severity: 'low',
            title: 'Safe persistence test',
            message: 'The event was stored.',
          }],
        }
      }

      throw new Error(`Unexpected query in Error Center test: ${sql}`)
    },
  }

  const row = await captureApplicationError({
    source: 'backend',
    severity: 'low',
    title: 'Safe persistence test',
    message: 'The event was stored.',
  }, db)

  assert.equal(row?.id, 'error-1')
  const insert = queries.find(({ sql }) => sql.includes('INSERT INTO application_errors'))
  assert.ok(insert)
  assert.match(
    insert.sql,
    /ON CONFLICT ON CONSTRAINT application_errors_fingerprint_unique/,
  )
  assert.match(insert.sql, /occurrence_count = application_errors\.occurrence_count \+ 1/)
})

test('Developer Error Center persistence health reports the constraint state', async () => {
  const ready = await getErrorCenterPersistenceHealth({
    async query(sql) {
      assert.match(sql, /constraint_record\.convalidated/)
      assert.match(sql, /NOT constraint_record\.condeferrable/)
      return {
        rows: [{
          constraint_ready: true,
          last_captured_at: '2026-07-21T00:00:00.000Z',
        }],
      }
    },
  })

  assert.deepEqual(ready, {
    status: 'ready',
    constraintReady: true,
    lastCapturedAt: '2026-07-21T00:00:00.000Z',
  })

  const repairRequired = await getErrorCenterPersistenceHealth({
    async query() {
      return { rows: [{ constraint_ready: false, last_captured_at: null }] }
    },
  })

  assert.deepEqual(repairRequired, {
    status: 'repair_required',
    constraintReady: false,
    lastCapturedAt: null,
  })
})
