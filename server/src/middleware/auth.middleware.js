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

    const payload = jwt.verify(token, env.jwtSecret, {
      algorithms: ['HS256'],
      clockTolerance: 5,
    })

    if (payload.purpose && payload.purpose !== 'auth') {
      return res.status(401).json({
        ok: false,
        error: 'Invalid authentication token.',
      })
    }

    const result = await pool.query(
      `
      SELECT
        id,
        email,
        role,
        status,
        must_change_password,
        temporary_password_expires_at,
        password_changed_at,
        session_version,
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

    const tokenSessionVersion = Number(payload.sessionVersion || 1)
    const currentSessionVersion = Number(user.session_version || 1)

    if (tokenSessionVersion !== currentSessionVersion) {
      return res.status(401).json({
        ok: false,
        code: 'SESSION_REVOKED',
        error: 'This session has been revoked. Please sign in again.',
      })
    }

    if (user.must_change_password) {
      return res.status(403).json({
        ok: false,
        code: 'PASSWORD_CHANGE_REQUIRED',
        error: 'A permanent password must be created before access is granted.',
      })
    }

    req.user = user
    next()
  } catch {
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
