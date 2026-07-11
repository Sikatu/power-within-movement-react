const { env } = require('../config/env')

const SYSTEM_ROLES = ['developer', 'owner', 'admin', 'staff']
const GOVERNANCE_SETTINGS_KEY = 'account_governance'

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function getCanonicalRoleForEmail(email) {
  const normalized = normalizeEmail(email)

  if (normalized === normalizeEmail(env.canonicalDeveloperEmail)) return 'developer'
  if (normalized === normalizeEmail(env.canonicalOwnerEmail)) return 'owner'

  return null
}

function isProtectedCanonicalAccount(email) {
  return Boolean(getCanonicalRoleForEmail(email))
}

async function ensureGovernanceSettings(db, actorUserId = null) {
  await db.query(
    `
    INSERT INTO platform_settings (
      key,
      value,
      updated_by_user_id
    )
    VALUES (
      $1,
      $2::jsonb,
      $3
    )
    ON CONFLICT (key) DO NOTHING
    `,
    [
      GOVERNANCE_SETTINGS_KEY,
      JSON.stringify({
        canonicalDeveloperEmail: normalizeEmail(env.canonicalDeveloperEmail),
        canonicalOwnerEmail: normalizeEmail(env.canonicalOwnerEmail),
        adminUserId: null,
      }),
      actorUserId,
    ],
  )
}

async function getGovernanceSettings(db) {
  await ensureGovernanceSettings(db)

  const result = await db.query(
    `
    SELECT value
    FROM platform_settings
    WHERE key = $1
    LIMIT 1
    `,
    [GOVERNANCE_SETTINGS_KEY],
  )

  const value = result.rows[0]?.value || {}

  return {
    canonicalDeveloperEmail: normalizeEmail(
      value.canonicalDeveloperEmail || env.canonicalDeveloperEmail,
    ),
    canonicalOwnerEmail: normalizeEmail(
      value.canonicalOwnerEmail || env.canonicalOwnerEmail,
    ),
    adminUserId: value.adminUserId || null,
  }
}

async function saveGovernanceSettings(db, settings, actorUserId = null) {
  const nextValue = {
    canonicalDeveloperEmail: normalizeEmail(env.canonicalDeveloperEmail),
    canonicalOwnerEmail: normalizeEmail(env.canonicalOwnerEmail),
    adminUserId: settings.adminUserId || null,
  }

  await db.query(
    `
    INSERT INTO platform_settings (
      key,
      value,
      updated_by_user_id
    )
    VALUES ($1, $2::jsonb, $3)
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = now()
    `,
    [GOVERNANCE_SETTINGS_KEY, JSON.stringify(nextValue), actorUserId],
  )

  return nextValue
}

async function getCanonicalAccounts(db) {
  const result = await db.query(
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
    WHERE lower(email) IN (lower($1), lower($2))
    ORDER BY lower(email)
    `,
    [env.canonicalDeveloperEmail, env.canonicalOwnerEmail],
  )

  const developer = result.rows.find(
    (user) => normalizeEmail(user.email) === normalizeEmail(env.canonicalDeveloperEmail),
  ) || null
  const owner = result.rows.find(
    (user) => normalizeEmail(user.email) === normalizeEmail(env.canonicalOwnerEmail),
  ) || null

  return { developer, owner }
}

async function getFounderAvailabilityOwnership(db) {
  const result = await db.query(
    `
    SELECT
      fas.id,
      fas.owner_user_id,
      fas.timezone,
      fas.schedule_enabled,
      fas.slot_interval_minutes,
      fas.minimum_notice_minutes,
      fas.booking_window_days,
      fas.created_at,
      fas.updated_at,
      su.email AS owner_email,
      su.role AS owner_role,
      su.status AS owner_status
    FROM founder_availability_settings fas
    LEFT JOIN system_users su
      ON su.id = fas.owner_user_id
    ORDER BY fas.updated_at DESC, fas.created_at DESC
    `,
  )

  return result.rows
}

async function listAdminCandidates(db) {
  const result = await db.query(
    `
    SELECT
      id,
      email,
      role,
      status,
      must_change_password,
      last_login_at,
      created_at,
      updated_at
    FROM system_users
    WHERE role = 'admin'
      AND lower(email) NOT IN (lower($1), lower($2))
    ORDER BY
      CASE status WHEN 'active' THEN 0 ELSE 1 END,
      lower(email)
    `,
    [env.canonicalDeveloperEmail, env.canonicalOwnerEmail],
  )

  return result.rows
}

async function getAccountGovernanceSnapshot(db) {
  const settings = await getGovernanceSettings(db)
  const [{ developer, owner }, availabilityRows, adminCandidates] = await Promise.all([
    getCanonicalAccounts(db),
    getFounderAvailabilityOwnership(db),
    listAdminCandidates(db),
  ])

  const permanentAdmin = settings.adminUserId
    ? adminCandidates.find((candidate) => candidate.id === settings.adminUserId) || null
    : null

  const canonicalOwnerAvailability = owner
    ? availabilityRows.find((row) => row.owner_user_id === owner.id) || null
    : null

  const issues = []

  if (!developer) {
    issues.push(`Developer account ${env.canonicalDeveloperEmail} does not exist.`)
  } else {
    if (developer.role !== 'developer') {
      issues.push(`Developer account is assigned the ${developer.role} role.`)
    }
    if (developer.status !== 'active') {
      issues.push(`Developer account is ${developer.status}.`)
    }
  }

  if (!owner) {
    issues.push(`Owner account ${env.canonicalOwnerEmail} does not exist.`)
  } else {
    if (owner.role !== 'owner') {
      issues.push(`Owner account is assigned the ${owner.role} role.`)
    }
    if (owner.status !== 'active') {
      issues.push(`Owner account is ${owner.status}.`)
    }
  }

  if (owner && !canonicalOwnerAvailability) {
    const currentAvailabilityOwner = availabilityRows[0]?.owner_email
    issues.push(
      currentAvailabilityOwner
        ? `Founder availability currently belongs to ${currentAvailabilityOwner}.`
        : 'Founder availability is not assigned to the canonical owner.',
    )
  }

  if (!settings.adminUserId) {
    issues.push('No permanent Admin account has been selected.')
  } else if (!permanentAdmin) {
    issues.push('The saved permanent Admin account is no longer an Admin account.')
  } else if (permanentAdmin.status !== 'active') {
    issues.push(`Permanent Admin account is ${permanentAdmin.status}.`)
  }

  return {
    healthy: issues.length === 0,
    canonical: {
      developerEmail: normalizeEmail(env.canonicalDeveloperEmail),
      ownerEmail: normalizeEmail(env.canonicalOwnerEmail),
    },
    developer,
    owner,
    permanentAdmin,
    adminCandidates,
    founderAvailability: canonicalOwnerAvailability || availabilityRows[0] || null,
    founderAvailabilityRows: availabilityRows,
    issues,
  }
}

async function writeGovernanceAudit(db, {
  actorUserId,
  action,
  entityId = null,
  beforeData = {},
  afterData = {},
}) {
  await db.query(
    `
    INSERT INTO audit_logs (
      actor_user_id,
      action,
      entity_type,
      entity_id,
      before_data,
      after_data
    )
    VALUES ($1, $2, 'account_governance', $3, $4::jsonb, $5::jsonb)
    `,
    [
      actorUserId,
      action,
      entityId,
      JSON.stringify(beforeData || {}),
      JSON.stringify(afterData || {}),
    ],
  )
}

async function reconcileCanonicalAccounts(db, actorUserId = null) {
  const client = typeof db.connect === 'function' ? await db.connect() : db
  const shouldRelease = client !== db

  try {
    await client.query('BEGIN')
    await ensureGovernanceSettings(client, actorUserId)

    const before = await getAccountGovernanceSnapshot(client)
    const { developer, owner } = await getCanonicalAccounts(client)

    if (!developer) {
      const error = new Error(
        `Canonical Developer account ${env.canonicalDeveloperEmail} does not exist. Create it before reconciling account governance.`,
      )
      error.code = 'CANONICAL_DEVELOPER_MISSING'
      throw error
    }

    if (!owner) {
      const error = new Error(
        `Canonical Owner account ${env.canonicalOwnerEmail} does not exist. Create it before reconciling account governance.`,
      )
      error.code = 'CANONICAL_OWNER_MISSING'
      throw error
    }

    await client.query(
      `
      UPDATE system_users
      SET role = 'developer',
          status = 'active',
          session_version = CASE
            WHEN role <> 'developer' OR status <> 'active'
              THEN COALESCE(session_version, 1) + 1
            ELSE COALESCE(session_version, 1)
          END,
          updated_at = now()
      WHERE id = $1
      `,
      [developer.id],
    )

    await client.query(
      `
      UPDATE system_users
      SET role = 'owner',
          status = 'active',
          session_version = CASE
            WHEN role <> 'owner' OR status <> 'active'
              THEN COALESCE(session_version, 1) + 1
            ELSE COALESCE(session_version, 1)
          END,
          updated_at = now()
      WHERE id = $1
      `,
      [owner.id],
    )

    const availabilityResult = await client.query(
      `
      SELECT *
      FROM founder_availability_settings
      WHERE owner_user_id IN ($1, $2)
      ORDER BY updated_at DESC, created_at DESC
      FOR UPDATE
      `,
      [developer.id, owner.id],
    )

    const developerAvailability = availabilityResult.rows.find(
      (row) => row.owner_user_id === developer.id,
    )
    const ownerAvailability = availabilityResult.rows.find(
      (row) => row.owner_user_id === owner.id,
    )

    if (developerAvailability && ownerAvailability) {
      const source =
        new Date(developerAvailability.updated_at).getTime() >=
        new Date(ownerAvailability.updated_at).getTime()
          ? developerAvailability
          : ownerAvailability

      await client.query(
        `
        UPDATE founder_availability_settings
        SET timezone = $2,
            schedule_enabled = $3,
            slot_interval_minutes = $4,
            minimum_notice_minutes = $5,
            booking_window_days = $6,
            updated_at = now()
        WHERE id = $1
        `,
        [
          ownerAvailability.id,
          source.timezone,
          source.schedule_enabled,
          source.slot_interval_minutes,
          source.minimum_notice_minutes,
          source.booking_window_days,
        ],
      )

      await client.query(
        `DELETE FROM founder_availability_settings WHERE id = $1`,
        [developerAvailability.id],
      )
    } else if (developerAvailability) {
      await client.query(
        `
        UPDATE founder_availability_settings
        SET owner_user_id = $2,
            updated_at = now()
        WHERE id = $1
        `,
        [developerAvailability.id, owner.id],
      )
    } else if (!ownerAvailability) {
      await client.query(
        `
        INSERT INTO founder_availability_settings (owner_user_id)
        VALUES ($1)
        ON CONFLICT (owner_user_id) DO NOTHING
        `,
        [owner.id],
      )
    }

    const after = await getAccountGovernanceSnapshot(client)

    await writeGovernanceAudit(client, {
      actorUserId,
      action: 'developer_reconciled_account_governance',
      entityId: owner.id,
      beforeData: {
        developer: before.developer,
        owner: before.owner,
        founderAvailability: before.founderAvailability,
        issues: before.issues,
      },
      afterData: {
        developer: after.developer,
        owner: after.owner,
        founderAvailability: after.founderAvailability,
        issues: after.issues,
      },
    })

    await client.query('COMMIT')
    return after
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    if (shouldRelease) client.release()
  }
}

async function validatePermanentAdmin(db, adminUserId) {
  if (!adminUserId) {
    const error = new Error('Choose the permanent Admin account before previewing cleanup.')
    error.code = 'ADMIN_REQUIRED'
    throw error
  }

  const result = await db.query(
    `
    SELECT id, email, role, status, session_version
    FROM system_users
    WHERE id = $1
    LIMIT 1
    `,
    [adminUserId],
  )

  const admin = result.rows[0]

  if (!admin || admin.role !== 'admin') {
    const error = new Error('The selected account is not an Admin account.')
    error.code = 'INVALID_ADMIN'
    throw error
  }

  if (admin.status !== 'active') {
    const error = new Error('Activate the selected Admin account before preserving it.')
    error.code = 'INACTIVE_ADMIN'
    throw error
  }

  if (isProtectedCanonicalAccount(admin.email)) {
    const error = new Error('The permanent Admin must use a separate email address.')
    error.code = 'CANONICAL_EMAIL_CONFLICT'
    throw error
  }

  return admin
}

async function listCleanupCandidates(db, adminUserId) {
  const admin = await validatePermanentAdmin(db, adminUserId)
  const result = await db.query(
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
    WHERE role = ANY($1::text[])
      AND status <> 'archived'
      AND role <> 'staff'
      AND id <> $2
      AND lower(email) NOT IN (lower($3), lower($4))
    ORDER BY
      CASE role
        WHEN 'developer' THEN 1
        WHEN 'owner' THEN 2
        WHEN 'admin' THEN 3
        WHEN 'staff' THEN 4
        ELSE 5
      END,
      lower(email)
    `,
    [SYSTEM_ROLES, admin.id, env.canonicalDeveloperEmail, env.canonicalOwnerEmail],
  )

  return { admin, candidates: result.rows }
}

async function setPermanentAdmin(db, actorUserId, adminUserId) {
  const client = typeof db.connect === 'function' ? await db.connect() : db
  const shouldRelease = client !== db

  try {
    await client.query('BEGIN')
    const before = await getAccountGovernanceSnapshot(client)
    const admin = await validatePermanentAdmin(client, adminUserId)

    await saveGovernanceSettings(client, { adminUserId: admin.id }, actorUserId)

    await writeGovernanceAudit(client, {
      actorUserId,
      action: 'developer_selected_permanent_admin',
      entityId: admin.id,
      beforeData: {
        permanentAdmin: before.permanentAdmin,
      },
      afterData: {
        permanentAdmin: admin,
      },
    })

    const after = await getAccountGovernanceSnapshot(client)
    await client.query('COMMIT')

    return {
      governance: after,
      permanentAdmin: admin,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    if (shouldRelease) client.release()
  }
}

async function previewSystemAccountCleanup(db, adminUserId) {
  const { admin, candidates } = await listCleanupCandidates(db, adminUserId)

  return {
    permanentAdmin: admin,
    candidates,
    count: candidates.length,
    action: 'archive_and_revoke_sessions',
    clientAccountsAffected: 0,
  }
}

async function applySystemAccountCleanup(db, actorUserId, adminUserId) {
  const client = typeof db.connect === 'function' ? await db.connect() : db
  const shouldRelease = client !== db

  try {
    await client.query('BEGIN')
    const before = await getAccountGovernanceSnapshot(client)
    const { admin, candidates } = await listCleanupCandidates(client, adminUserId)
    const candidateIds = candidates.map((candidate) => candidate.id)

    let archived = []

    if (candidateIds.length > 0) {
      const result = await client.query(
        `
        UPDATE system_users
        SET status = 'archived',
            session_version = COALESCE(session_version, 1) + 1,
            updated_at = now()
        WHERE id = ANY($1::uuid[])
        RETURNING id, email, role, status, session_version, updated_at
        `,
        [candidateIds],
      )

      archived = result.rows
    }

    await saveGovernanceSettings(client, { adminUserId: admin.id }, actorUserId)

    await writeGovernanceAudit(client, {
      actorUserId,
      action: 'developer_cleaned_system_accounts',
      entityId: admin.id,
      beforeData: {
        permanentAdmin: before.permanentAdmin,
        cleanupCandidates: candidates,
      },
      afterData: {
        permanentAdmin: admin,
        archivedAccounts: archived,
        clientAccountsAffected: 0,
      },
    })

    const after = await getAccountGovernanceSnapshot(client)
    await client.query('COMMIT')

    return {
      governance: after,
      permanentAdmin: admin,
      archived,
      count: archived.length,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    if (shouldRelease) client.release()
  }
}

module.exports = {
  SYSTEM_ROLES,
  GOVERNANCE_SETTINGS_KEY,
  normalizeEmail,
  getCanonicalRoleForEmail,
  isProtectedCanonicalAccount,
  ensureGovernanceSettings,
  getAccountGovernanceSnapshot,
  reconcileCanonicalAccounts,
  setPermanentAdmin,
  previewSystemAccountCleanup,
  applySystemAccountCleanup,
}
