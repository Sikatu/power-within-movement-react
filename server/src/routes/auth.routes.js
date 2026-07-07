const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { z } = require('zod')

const { env } = require('../config/env')
const { pool } = require('../db/pool')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')

const router = express.Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  }
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    env.jwtSecret,
    {
      expiresIn: '7d',
    },
  )
}

function getAuthCookieOptions(maxAge) {
  const options = {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    secure: env.cookieSecure,
    path: '/',
  }

  if (typeof maxAge === 'number') {
    options.maxAge = maxAge
  }

  if (env.cookieDomain) {
    options.domain = env.cookieDomain
  }

  return options
}

function setAuthCookie(res, token) {
  res.cookie(
    'pwc_auth',
    token,
    getAuthCookieOptions(7 * 24 * 60 * 60 * 1000),
  )
}

router.post('/login', async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const parsed = loginSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'Valid email and password are required.',
      })
    }

    const { email, password } = parsed.data

    const result = await pool.query(
      `
      SELECT
        id,
        email,
        password_hash,
        role,
        status,
        last_login_at,
        created_at,
        updated_at
      FROM system_users
      WHERE email = $1
      LIMIT 1
      `,
      [email],
    )

    const user = result.rows[0]

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        ok: false,
        error: 'Invalid email or password.',
      })
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash)

    if (!passwordMatches) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid email or password.',
      })
    }

    await pool.query(
      `
      UPDATE system_users
      SET last_login_at = now(),
          updated_at = now()
      WHERE id = $1
      `,
      [user.id],
    )

    const refreshedUserResult = await pool.query(
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
      [user.id],
    )

    const refreshedUser = refreshedUserResult.rows[0]
    const token = createToken(refreshedUser)

    setAuthCookie(res, token)

    res.json({
      ok: true,
      message: 'Login successful.',
      user: publicUser(refreshedUser),
      token,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/me', requireAuth, (req, res) => {
  res.json({
    ok: true,
    user: publicUser(req.user),
  })
})

router.get(
  '/admin-check',
  requireAuth,
  requireRole(['owner', 'admin', 'staff']),
  (req, res) => {
    res.json({
      ok: true,
      message: 'Admin access confirmed.',
      user: publicUser(req.user),
    })
  },
)



router.get('/founder-check', requireAuth, async (req, res, next) => {
  try {
    const isFounder = req.user.role === 'owner'

    if (!isFounder) {
      try {
        if (pool) {
          await pool.query(
            `
            INSERT INTO audit_logs (
              actor_user_id,
              action,
              entity_type,
              entity_id,
              after_data
            )
            VALUES ($1, 'founders_view_access_denied', 'system_users', $2, $3::jsonb)
            `,
            [
              req.user.id,
              req.user.id,
              JSON.stringify({
                email: req.user.email,
                role: req.user.role,
                route: '/api/auth/founder-check',
                reason: 'owner_role_required',
              }),
            ],
          )
        }
      } catch {
        // Do not expose audit logging failures to the requester.
      }

      return res.status(403).json({
        ok: false,
        error: 'Founder access is restricted to the owner account.',
      })
    }

    return res.json({
      ok: true,
      message: 'Founder access confirmed.',
      user: publicUser(req.user),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/logout', (req, res) => {
  res.clearCookie('pwc_auth', getAuthCookieOptions())

  res.json({
    ok: true,
    message: 'Logged out successfully.',
  })
})

module.exports = router