const express = require('express')

const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const {
  enforceTeamClientAssignment,
  enforceTeamPermission,
  getTeamAccessForUser,
} = require('../services/teamManagement.service')
const { listTeamWorkload } = require('../services/teamWorkload.service')
const { listClientMomentum } = require('../services/clientMomentum.service')
const { listClientCoverage } = require('../services/clientCoverage.service')
const { listSessionReadiness } = require('../services/sessionReadiness.service')
const { listSessionFollowThrough } = require('../services/sessionFollowThrough.service')

const router = express.Router()

const requireAdmin = [
  requireAuth,
  requireRole(['developer', 'owner', 'admin', 'staff']),
  enforceTeamPermission,
  enforceTeamClientAssignment,
]

router.get('/team/workload', requireAdmin, async (req, res, next) => {
  try {
    return res.json({
      ok: true,
      ...(await listTeamWorkload(req.user)),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/client-momentum', requireAdmin, async (req, res, next) => {
  try {
    return res.json({
      ok: true,
      ...(await listClientMomentum(req.user)),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/client-coverage', requireAdmin, async (req, res, next) => {
  try {
    return res.json({
      ok: true,
      ...(await listClientCoverage(req.user)),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/session-readiness', requireAdmin, async (req, res, next) => {
  try {
    return res.json({
      ok: true,
      ...(await listSessionReadiness(req.user, { days: req.query.days })),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/session-follow-through', requireAdmin, async (req, res, next) => {
  try {
    return res.json({
      ok: true,
      ...(await listSessionFollowThrough(req.user, { days: req.query.days })),
    })
  } catch (error) {
    return next(error)
  }
})

router.get('/team/my-access', requireAdmin, async (req, res, next) => {
  try {
    return res.json({
      ok: true,
      access: await getTeamAccessForUser(req.user),
    })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
