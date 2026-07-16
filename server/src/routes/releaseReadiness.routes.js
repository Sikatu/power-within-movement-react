const express = require('express')

const { pool } = require('../db/pool')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const { getReleaseReadinessSnapshot } = require('../services/releaseReadiness.service')

const router = express.Router()

router.use(requireAuth, requireRole(['developer']))

router.get('/', async (req, res, next) => {
  try {
    return res.json(await getReleaseReadinessSnapshot(pool))
  } catch (error) {
    return next(error)
  }
})

module.exports = router
