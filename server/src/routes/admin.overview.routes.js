const express = require('express')
const { pool } = require('../db/pool')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const {
  enforceTeamClientAssignment,
  enforceTeamPermission,
} = require('../services/teamManagement.service')

const router = express.Router()

const requireAdmin = [
  requireAuth,
  requireRole(['developer', 'owner', 'admin', 'staff']),
  enforceTeamPermission,
  enforceTeamClientAssignment,
]

async function getCount(tableName) {
  const allowedTables = new Set([
    'client_profiles',
    'bookings',
    'subscribers',
    'courses',
    'memberships',
    'encouragement_posts',
    'system_users',
  ])

  if (!allowedTables.has(tableName)) {
    throw new Error('Invalid count table.')
  }

  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${tableName}`)
  return result.rows[0]?.count || 0
}

router.get('/overview', requireAdmin, async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const [
      clients,
      bookings,
      subscribers,
      courses,
      memberships,
      encouragements,
      users,
    ] = await Promise.all([
      getCount('client_profiles'),
      getCount('bookings'),
      getCount('subscribers'),
      getCount('courses'),
      getCount('memberships'),
      getCount('encouragement_posts'),
      getCount('system_users'),
    ])

    res.json({
      ok: true,
      overview: {
        clients,
        bookings,
        subscribers,
        courses,
        memberships,
        encouragements,
        users,
      },
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
