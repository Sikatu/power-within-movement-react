const jwt = require('jsonwebtoken')
const { env } = require('../config/env')
const { pool } = require('../db/pool')

function getTokenFromRequest(req) {
  const bearer = req.headers.authorization

  if (bearer && bearer.startsWith('Bearer ')) {
    return bearer.slice('Bearer '.length)
  }

  if (req.cookies && req.cookies.pwc_auth) {
    return req.cookies.pwc_auth
  }

  return null
}

async function requireAuth(req, res, next) {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const token = getTokenFromRequest(req)

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: 'Authentication required.',
      })
    }

    const payload = jwt.verify(token, env.jwtSecret)

    const result = await pool.query(
      `
      SELECT
        id,
        email,
        role,
        status,
        last_login_at,
        created_at,
        updated_at
      FROM system_users
      WHERE id = $1
      LIMIT 1
      `,
      [payload.sub],
    )

    const user = result.rows[0]

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        ok: false,
        error: 'User is not active.',
      })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: 'Invalid or expired authentication.',
    })
  }
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: 'Authentication required.',
      })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        ok: false,
        error: 'You do not have permission to access this resource.',
      })
    }

    next()
  }
}

module.exports = {
  requireAuth,
  requireRole,
}