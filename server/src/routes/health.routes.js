const express = require('express')
const { checkDatabase } = require('../db/pool')

const router = express.Router()

router.get('/', async (req, res) => {
  const database = await checkDatabase()

  res.json({
    ok: true,
    service: 'Power Within Native Backend',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    database,
  })
})

module.exports = router