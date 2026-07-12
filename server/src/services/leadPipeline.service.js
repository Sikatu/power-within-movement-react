const { pool } = require('../db/pool')
const { enrollMatchingAutomations } = require('./automationStudio.service')

const PIPELINE_STAGES = [
  'new_inquiry',
  'contacted',
  'consultation_booked',
  'qualified',
  'nurturing',
  'converted',
  'not_a_fit',
]

const LEAD_PRIORITIES = ['low', 'normal', 'high', 'urgent']

function clientName(row) {
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    row.email ||
    row.public_contact_email ||
    'Unnamed lead'
}

function serializeLead(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    name: clientName(row),
    email: row.email || row.public_contact_email || null,
    phone: row.phone,
    clientStatus: row.client_status,
    pipelineStage: row.pipeline_stage,
    priority: row.lead_priority,
    interest: row.lead_interest,
    source: row.lead_source,
    inquiryReceivedAt: row.inquiry_received_at,
    nextFollowUpAt: row.next_follow_up_at,
    ownerUserId: row.lead_owner_user_id,
    ownerName: row.owner_display_name || row.owner_email || null,
    summary: row.lead_summary || '',
    lostReason: row.lost_reason || '',
    convertedAt: row.converted_at,
    openFollowUps: Number(row.open_follow_ups || 0),
    overdueFollowUps: Number(row.overdue_follow_ups || 0),
    lastActivityAt: row.last_activity_at || row.updated_at || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function serializeFollowUp(row) {
  return {
    id: row.id,
    clientProfileId: row.client_profile_id,
    assignedToUserId: row.assigned_to_user_id,
    assigneeName: row.assignee_display_name || row.assignee_email || null,
    title: row.title,
    notes: row.notes || '',
    status: row.status,
    priority: row.priority,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function serializeActivity(row) {
  return {
    id: row.id,
    activityType: row.activity_type,
    title: row.title,
    details: row.details || '',
    metadata: row.metadata || {},
    actorName: row.actor_display_name || row.actor_email || 'System',
    createdAt: row.created_at,
  }
}

async function listLeadPipeline(teamUserId = null) {
  if (!pool) throw new Error('Database is not configured.')

  const [leadsResult, teamResult] = await Promise.all([
    pool.query(
      `
      SELECT
        cp.id,
        cp.first_name,
        cp.last_name,
        cp.phone,
        cp.client_status,
        cp.public_contact_email,
        cp.lead_interest,
        cp.lead_source,
        cp.inquiry_received_at,
        cp.pipeline_stage,
        cp.lead_priority,
        cp.next_follow_up_at,
        cp.lead_owner_user_id,
        cp.lead_summary,
        cp.lost_reason,
        cp.converted_at,
        cp.created_at,
        cp.updated_at,
        su.email,
        owner.email AS owner_email,
        owner_profile.display_name AS owner_display_name,
        COALESCE(follow_up_counts.open_follow_ups, 0)::int AS open_follow_ups,
        COALESCE(follow_up_counts.overdue_follow_ups, 0)::int AS overdue_follow_ups,
        latest_activity.last_activity_at
      FROM client_profiles cp
      LEFT JOIN system_users su ON su.id = cp.user_id
      LEFT JOIN system_users owner ON owner.id = cp.lead_owner_user_id
      LEFT JOIN team_member_profiles owner_profile ON owner_profile.user_id = owner.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE lfu.status = 'open')::int AS open_follow_ups,
          COUNT(*) FILTER (
            WHERE lfu.status = 'open'
              AND lfu.due_at IS NOT NULL
              AND lfu.due_at < now()
          )::int AS overdue_follow_ups
        FROM lead_follow_ups lfu
        WHERE lfu.client_profile_id = cp.id
      ) follow_up_counts ON true
      LEFT JOIN LATERAL (
        SELECT MAX(lpa.created_at) AS last_activity_at
        FROM lead_pipeline_activities lpa
        WHERE lpa.client_profile_id = cp.id
      ) latest_activity ON true
      WHERE (
        cp.client_status = 'lead'
        OR (
          cp.pipeline_stage IN ('converted', 'not_a_fit')
          AND COALESCE(cp.converted_at, cp.updated_at) >= now() - interval '30 days'
        )
      )
      AND (
        $1::uuid IS NULL
        OR EXISTS (
          SELECT 1
          FROM team_client_assignments tca
          WHERE tca.team_user_id = $1
            AND tca.client_profile_id = cp.id
        )
      )
      ORDER BY
        CASE cp.lead_priority
          WHEN 'urgent' THEN 0
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          ELSE 3
        END,
        cp.next_follow_up_at ASC NULLS LAST,
        cp.inquiry_received_at DESC NULLS LAST,
        cp.created_at DESC
      LIMIT 300
      `,
      [teamUserId],
    ),
    pool.query(
      `
      SELECT
        su.id,
        su.email,
        su.role,
        COALESCE(tmp.display_name, su.email) AS display_name
      FROM system_users su
      LEFT JOIN team_member_profiles tmp ON tmp.user_id = su.id
      WHERE su.role IN ('admin', 'staff')
        AND su.status = 'active'
        AND COALESCE(tmp.is_assignable, true) = true
      ORDER BY
        CASE su.role WHEN 'admin' THEN 0 ELSE 1 END,
        COALESCE(tmp.display_name, su.email)
      `,
    ),
  ])

  const leads = leadsResult.rows.map(serializeLead)
  const metrics = {
    total: leads.filter((lead) => lead.clientStatus === 'lead').length,
    urgent: leads.filter((lead) => lead.clientStatus === 'lead' && lead.priority === 'urgent').length,
    overdue: leads.filter((lead) => lead.clientStatus === 'lead' && lead.overdueFollowUps > 0).length,
    consultationBooked: leads.filter((lead) => lead.pipelineStage === 'consultation_booked').length,
    convertedLast30Days: leads.filter((lead) => lead.pipelineStage === 'converted').length,
  }

  return {
    stages: PIPELINE_STAGES,
    priorities: LEAD_PRIORITIES,
    metrics,
    leads,
    teamUsers: teamResult.rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      displayName: row.display_name,
    })),
  }
}

async function getLeadDetail(clientProfileId) {
  if (!pool) throw new Error('Database is not configured.')

  const [leadResult, followUpsResult, activitiesResult] = await Promise.all([
    pool.query(
      `
      SELECT
        cp.*,
        su.email,
        owner.email AS owner_email,
        owner_profile.display_name AS owner_display_name,
        0::int AS open_follow_ups,
        0::int AS overdue_follow_ups,
        NULL::timestamptz AS last_activity_at
      FROM client_profiles cp
      LEFT JOIN system_users su ON su.id = cp.user_id
      LEFT JOIN system_users owner ON owner.id = cp.lead_owner_user_id
      LEFT JOIN team_member_profiles owner_profile ON owner_profile.user_id = owner.id
      WHERE cp.id = $1
      LIMIT 1
      `,
      [clientProfileId],
    ),
    pool.query(
      `
      SELECT
        lfu.*,
        assignee.email AS assignee_email,
        assignee_profile.display_name AS assignee_display_name
      FROM lead_follow_ups lfu
      LEFT JOIN system_users assignee ON assignee.id = lfu.assigned_to_user_id
      LEFT JOIN team_member_profiles assignee_profile ON assignee_profile.user_id = assignee.id
      WHERE lfu.client_profile_id = $1
      ORDER BY
        CASE lfu.status WHEN 'open' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
        lfu.due_at ASC NULLS LAST,
        lfu.created_at DESC
      LIMIT 100
      `,
      [clientProfileId],
    ),
    pool.query(
      `
      SELECT
        lpa.*,
        actor.email AS actor_email,
        actor_profile.display_name AS actor_display_name
      FROM lead_pipeline_activities lpa
      LEFT JOIN system_users actor ON actor.id = lpa.actor_user_id
      LEFT JOIN team_member_profiles actor_profile ON actor_profile.user_id = actor.id
      WHERE lpa.client_profile_id = $1
      ORDER BY lpa.created_at DESC
      LIMIT 100
      `,
      [clientProfileId],
    ),
  ])

  const row = leadResult.rows[0]
  if (!row) return null

  return {
    lead: serializeLead(row),
    followUps: followUpsResult.rows.map(serializeFollowUp),
    activities: activitiesResult.rows.map(serializeActivity),
  }
}

async function validateAssignableUser(userId, db = pool) {
  if (!userId) return true

  const result = await db.query(
    `
    SELECT 1
    FROM system_users su
    LEFT JOIN team_member_profiles tmp ON tmp.user_id = su.id
    WHERE su.id = $1
      AND su.role IN ('admin', 'staff')
      AND su.status = 'active'
      AND COALESCE(tmp.is_assignable, true) = true
    LIMIT 1
    `,
    [userId],
  )

  return Boolean(result.rows[0])
}

async function addActivity(db, clientProfileId, actorUserId, activityType, title, details = '', metadata = {}) {
  const result = await db.query(
    `
    INSERT INTO lead_pipeline_activities (
      client_profile_id,
      actor_user_id,
      activity_type,
      title,
      details,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    RETURNING *
    `,
    [clientProfileId, actorUserId || null, activityType, title, details || null, JSON.stringify(metadata || {})],
  )

  return result.rows[0]
}

async function refreshNextFollowUp(db, clientProfileId) {
  await db.query(
    `
    UPDATE client_profiles cp
    SET next_follow_up_at = follow_up.next_due_at,
        updated_at = now()
    FROM (
      SELECT MIN(due_at) AS next_due_at
      FROM lead_follow_ups
      WHERE client_profile_id = $1
        AND status = 'open'
        AND due_at IS NOT NULL
    ) follow_up
    WHERE cp.id = $1
    `,
    [clientProfileId],
  )
}

async function updateLeadProfile(clientProfileId, payload, actorUserId) {
  if (!pool) throw new Error('Database is not configured.')

  const db = await pool.connect()

  try {
    await db.query('BEGIN')

    const beforeResult = await db.query(
      `SELECT * FROM client_profiles WHERE id = $1 LIMIT 1 FOR UPDATE`,
      [clientProfileId],
    )
    const before = beforeResult.rows[0]
    if (!before) {
      await db.query('ROLLBACK')
      return null
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'ownerUserId')) {
      const validOwner = await validateAssignableUser(payload.ownerUserId, db)
      if (!validOwner) {
        const error = new Error('Choose an active assignable Admin or Staff member.')
        error.code = 'INVALID_LEAD_OWNER'
        throw error
      }
    }

    const nextStage = payload.pipelineStage ?? before.pipeline_stage
    const nextClientStatus = nextStage === 'converted'
      ? (before.client_status === 'member' ? 'member' : 'active_client')
      : nextStage === 'not_a_fit'
        ? 'inactive'
        : 'lead'

    const result = await db.query(
      `
      UPDATE client_profiles
      SET
        pipeline_stage = COALESCE($2, pipeline_stage),
        lead_priority = COALESCE($3, lead_priority),
        lead_owner_user_id = CASE WHEN $4::boolean THEN $5::uuid ELSE lead_owner_user_id END,
        lead_summary = CASE WHEN $6::boolean THEN $7::text ELSE lead_summary END,
        lost_reason = CASE WHEN $8::boolean THEN $9::text ELSE lost_reason END,
        next_follow_up_at = CASE WHEN $10::boolean THEN $11::timestamptz ELSE next_follow_up_at END,
        client_status = $12,
        converted_at = CASE
          WHEN $2 = 'converted' THEN COALESCE(converted_at, now())
          WHEN $2 IS NOT NULL AND $2 <> 'converted' THEN NULL
          ELSE converted_at
        END,
        updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        clientProfileId,
        payload.pipelineStage ?? null,
        payload.priority ?? null,
        Object.prototype.hasOwnProperty.call(payload, 'ownerUserId'),
        payload.ownerUserId || null,
        Object.prototype.hasOwnProperty.call(payload, 'summary'),
        payload.summary || null,
        Object.prototype.hasOwnProperty.call(payload, 'lostReason'),
        payload.lostReason || null,
        Object.prototype.hasOwnProperty.call(payload, 'nextFollowUpAt'),
        payload.nextFollowUpAt || null,
        nextClientStatus,
      ],
    )

    const after = result.rows[0]

    if (before.pipeline_stage !== after.pipeline_stage) {
      await addActivity(
        db,
        clientProfileId,
        actorUserId,
        after.pipeline_stage === 'converted' ? 'converted' : 'stage_change',
        after.pipeline_stage === 'converted' ? 'Lead converted to client' : 'Pipeline stage changed',
        `${before.pipeline_stage || 'new_inquiry'} → ${after.pipeline_stage}`,
        { before: before.pipeline_stage, after: after.pipeline_stage },
      )
    }

    if (before.lead_priority !== after.lead_priority) {
      await addActivity(
        db,
        clientProfileId,
        actorUserId,
        'priority_change',
        'Lead priority changed',
        `${before.lead_priority || 'normal'} → ${after.lead_priority}`,
        { before: before.lead_priority, after: after.lead_priority },
      )
    }

    if (before.lead_owner_user_id !== after.lead_owner_user_id) {
      await addActivity(
        db,
        clientProfileId,
        actorUserId,
        'owner_change',
        'Lead owner changed',
        '',
        { before: before.lead_owner_user_id, after: after.lead_owner_user_id },
      )
    }

    await db.query('COMMIT')

    if (before.pipeline_stage !== after.pipeline_stage) {
      try {
        await enrollMatchingAutomations({
          clientProfileId,
          triggerType: 'pipeline_stage',
          triggerStage: after.pipeline_stage,
          actorUserId,
        })

        if (after.pipeline_stage === 'converted') {
          await enrollMatchingAutomations({
            clientProfileId,
            triggerType: 'client_converted',
            triggerStage: 'converted',
            actorUserId,
          })
        }
      } catch (automationError) {
        console.error('Lead automation enrollment failed:', automationError.message)
      }
    }

    return { before, after }
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  } finally {
    db.release()
  }
}

async function createLeadFollowUp(clientProfileId, payload, actorUserId) {
  if (!pool) throw new Error('Database is not configured.')

  const db = await pool.connect()

  try {
    await db.query('BEGIN')

    const validAssignee = await validateAssignableUser(payload.assignedToUserId, db)
    if (!validAssignee) {
      const error = new Error('Choose an active assignable Admin or Staff member.')
      error.code = 'INVALID_FOLLOW_UP_ASSIGNEE'
      throw error
    }

    const clientResult = await db.query(
      'SELECT id FROM client_profiles WHERE id = $1 LIMIT 1 FOR UPDATE',
      [clientProfileId],
    )
    if (!clientResult.rows[0]) {
      await db.query('ROLLBACK')
      return null
    }

    const result = await db.query(
      `
      INSERT INTO lead_follow_ups (
        client_profile_id,
        assigned_to_user_id,
        created_by_user_id,
        title,
        notes,
        priority,
        due_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        clientProfileId,
        payload.assignedToUserId || null,
        actorUserId,
        payload.title,
        payload.notes || null,
        payload.priority || 'normal',
        payload.dueAt || null,
      ],
    )

    await refreshNextFollowUp(db, clientProfileId)
    await addActivity(
      db,
      clientProfileId,
      actorUserId,
      'follow_up_scheduled',
      'Follow-up scheduled',
      payload.title,
      { followUpId: result.rows[0].id, dueAt: payload.dueAt || null },
    )

    await db.query('COMMIT')
    return result.rows[0]
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  } finally {
    db.release()
  }
}

async function updateLeadFollowUp(clientProfileId, followUpId, payload, actorUserId) {
  if (!pool) throw new Error('Database is not configured.')

  const db = await pool.connect()

  try {
    await db.query('BEGIN')

    const beforeResult = await db.query(
      `
      SELECT *
      FROM lead_follow_ups
      WHERE id = $1
        AND client_profile_id = $2
      LIMIT 1
      FOR UPDATE
      `,
      [followUpId, clientProfileId],
    )
    const before = beforeResult.rows[0]
    if (!before) {
      await db.query('ROLLBACK')
      return null
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'assignedToUserId')) {
      const validAssignee = await validateAssignableUser(payload.assignedToUserId, db)
      if (!validAssignee) {
        const error = new Error('Choose an active assignable Admin or Staff member.')
        error.code = 'INVALID_FOLLOW_UP_ASSIGNEE'
        throw error
      }
    }

    const result = await db.query(
      `
      UPDATE lead_follow_ups
      SET
        assigned_to_user_id = CASE WHEN $3::boolean THEN $4::uuid ELSE assigned_to_user_id END,
        title = COALESCE($5, title),
        notes = CASE WHEN $6::boolean THEN $7::text ELSE notes END,
        status = COALESCE($8, status),
        priority = COALESCE($9, priority),
        due_at = CASE WHEN $10::boolean THEN $11::timestamptz ELSE due_at END,
        completed_at = CASE
          WHEN $8 = 'completed' THEN COALESCE(completed_at, now())
          WHEN $8 IS NOT NULL AND $8 <> 'completed' THEN NULL
          ELSE completed_at
        END,
        updated_at = now()
      WHERE id = $1
        AND client_profile_id = $2
      RETURNING *
      `,
      [
        followUpId,
        clientProfileId,
        Object.prototype.hasOwnProperty.call(payload, 'assignedToUserId'),
        payload.assignedToUserId || null,
        payload.title ?? null,
        Object.prototype.hasOwnProperty.call(payload, 'notes'),
        payload.notes || null,
        payload.status ?? null,
        payload.priority ?? null,
        Object.prototype.hasOwnProperty.call(payload, 'dueAt'),
        payload.dueAt || null,
      ],
    )

    const after = result.rows[0]
    await refreshNextFollowUp(db, clientProfileId)
    await addActivity(
      db,
      clientProfileId,
      actorUserId,
      after.status === 'completed' && before.status !== 'completed'
        ? 'follow_up_completed'
        : 'follow_up_updated',
      after.status === 'completed' && before.status !== 'completed'
        ? 'Follow-up completed'
        : 'Follow-up updated',
      after.title,
      { followUpId, beforeStatus: before.status, afterStatus: after.status },
    )

    await db.query('COMMIT')
    return { before, after }
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  } finally {
    db.release()
  }
}

async function addLeadNote(clientProfileId, note, actorUserId) {
  if (!pool) throw new Error('Database is not configured.')

  const clientResult = await pool.query('SELECT id FROM client_profiles WHERE id = $1 LIMIT 1', [clientProfileId])
  if (!clientResult.rows[0]) return null

  return addActivity(pool, clientProfileId, actorUserId, 'note', 'Team note added', note, {})
}

module.exports = {
  LEAD_PRIORITIES,
  PIPELINE_STAGES,
  addLeadNote,
  createLeadFollowUp,
  getLeadDetail,
  listLeadPipeline,
  updateLeadFollowUp,
  updateLeadProfile,
}
