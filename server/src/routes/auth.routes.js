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

const changePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(12, 'Password must be at least 12 characters.')
      .max(128, 'Password must be 128 characters or fewer.')
      .regex(/[a-z]/, 'Password must include a lowercase letter.')
      .regex(/[A-Z]/, 'Password must include an uppercase letter.')
      .regex(/[0-9]/, 'Password must include a number.')
      .regex(/[^A-Za-z0-9]/, 'Password must include a symbol.'),
    confirmPassword: z.string().min(1),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: Boolean(user.must_change_password),
    passwordChangedAt: user.password_changed_at,
    sessionVersion: Number(user.session_version || 1),
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
      purpose: 'auth',
      sessionVersion: Number(user.session_version || 1),
    },
    env.jwtSecret,
    {
      expiresIn: '7d',
    },
  )
}

function createPasswordChangeToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      purpose: 'password_change',
    },
    env.jwtSecret,
    {
      expiresIn: '15m',
    },
  )
}

function getCookieOptions({ maxAge, path = '/' } = {}) {
  const options = {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    secure: env.cookieSecure,
    path,
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
    getCookieOptions({ maxAge: 7 * 24 * 60 * 60 * 1000 }),
  )
}

function clearAuthCookie(res) {
  res.clearCookie('pwc_auth', getCookieOptions())
}

function setPasswordChangeCookie(res, token) {
  res.cookie(
    'pwc_password_change',
    token,
    getCookieOptions({
      maxAge: 15 * 60 * 1000,
      path: '/api/auth',
    }),
  )
}

function clearPasswordChangeCookie(res) {
  res.clearCookie(
    'pwc_password_change',
    getCookieOptions({ path: '/api/auth' }),
  )
}

async function writeAuditLog({ actorUserId, action, afterData }) {
  try {
    if (!pool) return

    await pool.query(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        after_data
      )
      VALUES ($1, $2, 'system_users', $1, $3::jsonb)
      `,
      [actorUserId, action, JSON.stringify(afterData || {})],
    )
  } catch {
    // Authentication must not fail only because audit logging is unavailable.
  }
}

function readPasswordChangeToken(req) {
  const token = req.cookies?.pwc_password_change

  if (!token) {
    const error = new Error('Password-change session is missing or expired.')
    error.statusCode = 401
    throw error
  }

  const payload = jwt.verify(token, env.jwtSecret)

  if (payload.purpose !== 'password_change') {
    const error = new Error('Invalid password-change session.')
    error.statusCode = 401
    throw error
  }

  return payload
}

async function getPasswordChangeUser(req) {
  const payload = readPasswordChangeToken(req)

  const result = await pool.query(
    `
    SELECT
      id,
      email,
      password_hash,
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

  if (!user || user.status !== 'active' || !user.must_change_password) {
    const error = new Error('Password-change session is no longer valid.')
    error.statusCode = 401
    throw error
  }

  const expiresAt = user.temporary_password_expires_at
    ? new Date(user.temporary_password_expires_at)
    : null

  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    const error = new Error('The temporary password has expired. Ask the developer for a new one.')
    error.statusCode = 403
    error.code = 'TEMPORARY_PASSWORD_EXPIRED'
    throw error
  }

  return user
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
        must_change_password,
        temporary_password_expires_at,
        password_changed_at,
        session_version,
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

    if (user.must_change_password) {
      const expiresAt = user.temporary_password_expires_at
        ? new Date(user.temporary_password_expires_at)
        : null

      if (!expiresAt || expiresAt.getTime() <= Date.now()) {
        clearAuthCookie(res)
        clearPasswordChangeCookie(res)

        return res.status(403).json({
          ok: false,
          code: 'TEMPORARY_PASSWORD_EXPIRED',
          error: 'The temporary password has expired. Ask the developer for a new one.',
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

      clearAuthCookie(res)
      setPasswordChangeCookie(res, createPasswordChangeToken(user))

      await writeAuditLog({
        actorUserId: user.id,
        action: 'temporary_password_verified',
        afterData: {
          email: user.email,
          role: user.role,
          passwordChangeRequired: true,
        },
      })

      return res.json({
        ok: true,
        message: 'Temporary password verified. Create your permanent password to continue.',
        passwordChangeRequired: true,
        user: publicUser(user),
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
      [user.id],
    )

    const refreshedUser = refreshedUserResult.rows[0]
    const token = createToken(refreshedUser)

    clearPasswordChangeCookie(res)
    setAuthCookie(res, token)

    return res.json({
      ok: true,
      message: 'Login successful.',
      passwordChangeRequired: false,
      user: publicUser(refreshedUser),
      token,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/password-change-status', async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const user = await getPasswordChangeUser(req)

    return res.json({
      ok: true,
      passwordChangeRequired: true,
      user: publicUser(user),
    })
  } catch (error) {
    clearPasswordChangeCookie(res)

    return res.status(error.statusCode || 401).json({
      ok: false,
      code: error.code,
      error: error.message || 'Password-change session is invalid or expired.',
    })
  }
})

router.post('/change-password', async (req, res, next) => {
  try {
    if (!pool) {
      return res.status(503).json({
        ok: false,
        error: 'Database is not configured.',
      })
    }

    const parsed = changePasswordSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues[0]?.message || 'A valid new password is required.',
      })
    }

    const user = await getPasswordChangeUser(req)
    const { newPassword } = parsed.data
    const matchesTemporaryPassword = await bcrypt.compare(
      newPassword,
      user.password_hash,
    )

    if (matchesTemporaryPassword) {
      return res.status(400).json({
        ok: false,
        error: 'Your permanent password must be different from the temporary password.',
      })
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)

    const result = await pool.query(
      `
      UPDATE system_users
      SET password_hash = $1,
          must_change_password = false,
          temporary_password_expires_at = NULL,
          password_changed_at = now(),
          session_version = COALESCE(session_version, 1) + 1,
          last_login_at = now(),
          updated_at = now()
      WHERE id = $2
      RETURNING
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
      `,
      [passwordHash, user.id],
    )

    const refreshedUser = result.rows[0]
    const token = createToken(refreshedUser)

    clearPasswordChangeCookie(res)
    setAuthCookie(res, token)

    await writeAuditLog({
      actorUserId: refreshedUser.id,
      action: 'required_password_change_completed',
      afterData: {
        email: refreshedUser.email,
        role: refreshedUser.role,
        passwordChangedAt: refreshedUser.password_changed_at,
      },
    })

    return res.json({
      ok: true,
      message: 'Your permanent password has been created.',
      user: publicUser(refreshedUser),
    })
  } catch (error) {
    if (error.statusCode) {
      clearPasswordChangeCookie(res)

      return res.status(error.statusCode).json({
        ok: false,
        code: error.code,
        error: error.message,
      })
    }

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
  requireRole(['developer', 'owner', 'admin', 'staff']),
  (req, res) => {
    res.json({
      ok: true,
      message: 'Admin access confirmed.',
      user: publicUser(req.user),
    })
  },
)

router.get(
  '/developer-check',
  requireAuth,
  requireRole(['developer']),
  (req, res) => {
    res.json({
      ok: true,
      message: 'Developer access confirmed.',
      user: publicUser(req.user),
    })
  },
)

router.get('/founder-check', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === 'owner') {
      return res.json({
        ok: true,
        message: 'Founder access confirmed.',
        accessMode: 'owner',
        user: publicUser(req.user),
        founderOwner: publicUser(req.user),
      })
    }

    if (req.user.role === 'developer') {
      const ownerResult = await pool.query(
        `
        SELECT *
        FROM system_users
        WHERE role = 'owner'
          AND status = 'active'
        ORDER BY created_at ASC
        LIMIT 1
        `,
      )

      const founderOwner = ownerResult.rows[0]

      if (!founderOwner) {
        return res.status(409).json({
          ok: false,
          error: 'No active owner account is available for the Founder workspace.',
        })
      }

      await writeAuditLog({
        actorUserId: req.user.id,
        action: 'founders_view_developer_access_confirmed',
        afterData: {
          developerEmail: req.user.email,
          founderOwnerId: founderOwner.id,
          founderOwnerEmail: founderOwner.email,
          route: '/api/auth/founder-check',
        },
      })

      return res.json({
        ok: true,
        message: 'Developer access to the live Founder workspace confirmed.',
        accessMode: 'developer',
        user: publicUser(req.user),
        founderOwner: publicUser(founderOwner),
      })
    }

    await writeAuditLog({
      actorUserId: req.user.id,
      action: 'founders_view_access_denied',
      afterData: {
        email: req.user.email,
        role: req.user.role,
        route: '/api/auth/founder-check',
        reason: 'owner_or_developer_role_required',
      },
    })

    return res.status(403).json({
      ok: false,
      error: 'Founder access requires the owner or developer account.',
    })
  } catch (error) {
    next(error)
  }
})

router.post('/logout', (req, res) => {
  clearAuthCookie(res)
  clearPasswordChangeCookie(res)

  res.json({
    ok: true,
    message: 'Logged out successfully.',
  })
})

module.exports = router
