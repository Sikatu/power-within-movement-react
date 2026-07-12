-- =====================================================
-- Power Within Native Platform
-- Initial PostgreSQL Schema Draft
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- -----------------------------------------------------
-- Shared updated_at trigger
-- -----------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------
-- Users and profiles
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS system_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client'
    CHECK (role IN ('developer', 'owner', 'admin', 'staff', 'client', 'member')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited', 'active', 'suspended', 'archived')),
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  temporary_password_expires_at TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  session_version INTEGER NOT NULL DEFAULT 1,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_system_users_updated_at ON system_users;
CREATE TRIGGER set_system_users_updated_at
BEFORE UPDATE ON system_users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES system_users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  birthday DATE,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  client_status TEXT NOT NULL DEFAULT 'lead'
    CHECK (client_status IN ('lead', 'active_client', 'member', 'inactive', 'archived')),
  private_admin_notes TEXT,
  client_visible_notes TEXT,
  intake_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_client_profiles_updated_at ON client_profiles;
CREATE TRIGGER set_client_profiles_updated_at
BEFORE UPDATE ON client_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- -----------------------------------------------------
-- Client Portal invites
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS client_portal_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES system_users(id) ON DELETE CASCADE,
  invite_token_hash TEXT NOT NULL,
  invite_token_preview TEXT,
  invite_link TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '14 days',
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_portal_invites_client_profile_id
  ON client_portal_invites(client_profile_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_invites_user_id
  ON client_portal_invites(user_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_invites_token_hash
  ON client_portal_invites(invite_token_hash);

-- -----------------------------------------------------
-- Leads and intake pipeline
-- -----------------------------------------------------

ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT NOT NULL DEFAULT 'new_inquiry',
  ADD COLUMN IF NOT EXISTS lead_priority TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lead_owner_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_summary TEXT,
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS lead_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  assigned_to_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_pipeline_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL
    CHECK (activity_type IN (
      'created',
      'stage_change',
      'priority_change',
      'owner_change',
      'note',
      'follow_up_scheduled',
      'follow_up_updated',
      'follow_up_completed',
      'converted'
    )),
  title TEXT NOT NULL,
  details TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_lead_follow_ups_updated_at ON lead_follow_ups;
CREATE TRIGGER set_lead_follow_ups_updated_at
BEFORE UPDATE ON lead_follow_ups
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_client_profiles_pipeline_stage
  ON client_profiles(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_client_profiles_next_follow_up_at
  ON client_profiles(next_follow_up_at);
CREATE INDEX IF NOT EXISTS idx_client_profiles_lead_owner_user_id
  ON client_profiles(lead_owner_user_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_client_status_due
  ON lead_follow_ups(client_profile_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_lead_follow_ups_assignee_status_due
  ON lead_follow_ups(assigned_to_user_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_activities_client_created
  ON lead_pipeline_activities(client_profile_id, created_at DESC);

-- -----------------------------------------------------
-- Staff and team management
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS team_member_profiles (
  user_id UUID PRIMARY KEY REFERENCES system_users(id) ON DELETE CASCADE,
  display_name TEXT,
  job_title TEXT,
  department TEXT NOT NULL DEFAULT 'client_care'
    CHECK (department IN ('leadership', 'client_care', 'operations', 'content_community', 'learning', 'administration', 'other')),
  availability_status TEXT NOT NULL DEFAULT 'available'
    CHECK (availability_status IN ('available', 'focused', 'limited', 'away')),
  capacity_percent INTEGER NOT NULL DEFAULT 100
    CHECK (capacity_percent BETWEEN 0 AND 100),
  is_assignable BOOLEAN NOT NULL DEFAULT true,
  internal_notes TEXT,
  created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_team_member_profiles_updated_at ON team_member_profiles;
CREATE TRIGGER set_team_member_profiles_updated_at
BEFORE UPDATE ON team_member_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS team_member_permissions (
  user_id UUID PRIMARY KEY REFERENCES system_users(id) ON DELETE CASCADE,
  dashboard_access TEXT NOT NULL DEFAULT 'view' CHECK (dashboard_access IN ('none', 'view', 'manage')),
  clients_access TEXT NOT NULL DEFAULT 'none' CHECK (clients_access IN ('none', 'view', 'manage')),
  sessions_access TEXT NOT NULL DEFAULT 'none' CHECK (sessions_access IN ('none', 'view', 'manage')),
  inbox_access TEXT NOT NULL DEFAULT 'none' CHECK (inbox_access IN ('none', 'view', 'manage')),
  communications_access TEXT NOT NULL DEFAULT 'none' CHECK (communications_access IN ('none', 'view', 'manage')),
  learning_access TEXT NOT NULL DEFAULT 'none' CHECK (learning_access IN ('none', 'view', 'manage')),
  memberships_access TEXT NOT NULL DEFAULT 'none' CHECK (memberships_access IN ('none', 'view', 'manage')),
  circle_access TEXT NOT NULL DEFAULT 'none' CHECK (circle_access IN ('none', 'view', 'manage')),
  encouragements_access TEXT NOT NULL DEFAULT 'none' CHECK (encouragements_access IN ('none', 'view', 'manage')),
  audit_access TEXT NOT NULL DEFAULT 'none' CHECK (audit_access IN ('none', 'view', 'manage')),
  updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_team_member_permissions_updated_at ON team_member_permissions;
CREATE TRIGGER set_team_member_permissions_updated_at
BEFORE UPDATE ON team_member_permissions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS team_client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_user_id UUID NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  assignment_role TEXT NOT NULL DEFAULT 'support'
    CHECK (assignment_role IN ('primary', 'support', 'specialist', 'observer')),
  assigned_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_user_id, client_profile_id)
);

DROP TRIGGER IF EXISTS set_team_client_assignments_updated_at ON team_client_assignments;
CREATE TRIGGER set_team_client_assignments_updated_at
BEFORE UPDATE ON team_client_assignments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_team_member_profiles_status
  ON team_member_profiles(availability_status, is_assignable);

CREATE INDEX IF NOT EXISTS idx_team_client_assignments_user
  ON team_client_assignments(team_user_id, assignment_role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_client_assignments_client
  ON team_client_assignments(client_profile_id, assignment_role, created_at DESC);

-- -----------------------------------------------------
-- Client 360 and care plans
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS client_care_plans (
  client_profile_id UUID PRIMARY KEY REFERENCES client_profiles(id) ON DELETE CASCADE,
  journey_stage TEXT NOT NULL DEFAULT 'onboarding'
    CHECK (journey_stage IN ('onboarding', 'clarity', 'active_work', 'integration', 'maintenance', 'complete')),
  care_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (care_status IN ('not_started', 'on_track', 'attention', 'paused', 'completed')),
  primary_goal TEXT,
  transformation_focus TEXT,
  success_definition TEXT,
  client_visible_focus TEXT,
  private_strategy_notes TEXT,
  next_review_at TIMESTAMPTZ,
  updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_client_care_plans_updated_at ON client_care_plans;
CREATE TRIGGER set_client_care_plans_updated_at
BEFORE UPDATE ON client_care_plans
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS client_care_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  owner_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  visibility TEXT NOT NULL DEFAULT 'team'
    CHECK (visibility IN ('team', 'client')),
  completed_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_client_care_actions_updated_at ON client_care_actions;
CREATE TRIGGER set_client_care_actions_updated_at
BEFORE UPDATE ON client_care_actions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_client_care_actions_client_status
  ON client_care_actions(client_profile_id, status, due_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_care_actions_owner_status
  ON client_care_actions(owner_user_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_client_care_plans_review
  ON client_care_plans(care_status, next_review_at);

CREATE TABLE IF NOT EXISTS client_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_tag_links (
  client_profile_id UUID REFERENCES client_profiles(id) ON DELETE CASCADE,
  client_tag_id UUID REFERENCES client_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_profile_id, client_tag_id)
);

CREATE TABLE IF NOT EXISTS service_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id UUID REFERENCES client_profiles(id) ON DELETE CASCADE,
  title TEXT,
  service_name TEXT NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'session_note',
  service_date TIMESTAMPTZ DEFAULT now(),
  occurred_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'planned', 'follow_up', 'archived', 'active', 'paused', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  summary TEXT,
  notes TEXT,
  description TEXT,
  private_notes TEXT,
  client_visible_notes TEXT,
  follow_up_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_service_records_updated_at ON service_records;
CREATE TRIGGER set_service_records_updated_at
BEFORE UPDATE ON service_records
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------
-- Native scheduler
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS appointment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  price_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
  buffer_after_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_appointment_types_updated_at ON appointment_types;
CREATE TRIGGER set_appointment_types_updated_at
BEFORE UPDATE ON appointment_types
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS availability_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  weekday INTEGER CHECK (weekday BETWEEN 0 AND 6),
  specific_date DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

DROP TRIGGER IF EXISTS set_availability_blocks_updated_at ON availability_blocks;
CREATE TRIGGER set_availability_blocks_updated_at
BEFORE UPDATE ON availability_blocks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS founder_availability_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID UNIQUE REFERENCES system_users(id) ON DELETE SET NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  schedule_enabled BOOLEAN NOT NULL DEFAULT false,
  slot_interval_minutes INTEGER NOT NULL DEFAULT 60
    CHECK (slot_interval_minutes IN (15, 30, 60)),
  minimum_notice_minutes INTEGER NOT NULL DEFAULT 0
    CHECK (minimum_notice_minutes BETWEEN 0 AND 10080),
  booking_window_days INTEGER NOT NULL DEFAULT 90
    CHECK (booking_window_days BETWEEN 7 AND 365),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_founder_availability_settings_updated_at
  ON founder_availability_settings;
CREATE TRIGGER set_founder_availability_settings_updated_at
BEFORE UPDATE ON founder_availability_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_type_id UUID REFERENCES appointment_types(id) ON DELETE SET NULL,
  client_profile_id UUID REFERENCES client_profiles(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_email CITEXT,
  guest_phone TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'confirmed', 'completed', 'cancelled', 'no_show')),
  intake_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_notes TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

DROP TRIGGER IF EXISTS set_bookings_updated_at ON bookings;
CREATE TRIGGER set_bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS booking_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('reschedule', 'cancel')),
  requested_starts_at TIMESTAMPTZ,
  requested_ends_at TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined', 'withdrawn')),
  reviewer_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (request_type = 'cancel' AND requested_starts_at IS NULL AND requested_ends_at IS NULL)
    OR
    (request_type = 'reschedule' AND requested_starts_at IS NOT NULL AND requested_ends_at IS NOT NULL)
  )
);

DROP TRIGGER IF EXISTS set_booking_change_requests_updated_at
  ON booking_change_requests;
CREATE TRIGGER set_booking_change_requests_updated_at
BEFORE UPDATE ON booking_change_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_booking_change_requests_booking
  ON booking_change_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_change_requests_client
  ON booking_change_requests(client_profile_id);
CREATE INDEX IF NOT EXISTS idx_booking_change_requests_status
  ON booking_change_requests(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_change_requests_one_pending
  ON booking_change_requests(booking_id)
  WHERE status = 'pending';

-- -----------------------------------------------------
-- Native email studio
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  status TEXT NOT NULL DEFAULT 'subscribed'
    CHECK (status IN ('subscribed', 'unsubscribed', 'bounced', 'complained')),
  source TEXT,
  consent_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_subscribers_updated_at ON subscribers;
CREATE TRIGGER set_subscribers_updated_at
BEFORE UPDATE ON subscribers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS email_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriber_tag_links (
  subscriber_id UUID REFERENCES subscribers(id) ON DELETE CASCADE,
  email_tag_id UUID REFERENCES email_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subscriber_id, email_tag_id)
);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT,
  preview_text TEXT,
  body_html TEXT,
  body_text TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_email_campaigns_updated_at ON email_campaigns;
CREATE TRIGGER set_email_campaigns_updated_at
BEFORE UPDATE ON email_campaigns
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES subscribers(id) ON DELETE CASCADE,
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'failed', 'skipped')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, subscriber_id)
);

-- -----------------------------------------------------
-- Encouragements and private messages
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS encouragement_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'all_members'
    CHECK (visibility IN ('all_members', 'tagged_group', 'single_client', 'admin_only')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'scheduled', 'archived')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_encouragement_posts_updated_at ON encouragement_posts;
CREATE TRIGGER set_encouragement_posts_updated_at
BEFORE UPDATE ON encouragement_posts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS encouragement_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encouragement_post_id UUID REFERENCES encouragement_posts(id) ON DELETE CASCADE,
  client_profile_id UUID REFERENCES client_profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (encouragement_post_id, client_profile_id)
);

-- -----------------------------------------------------
-- Courses and memberships
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Personal Growth',
  cover_image_url TEXT,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  access_mode TEXT NOT NULL DEFAULT 'assigned_clients'
    CHECK (access_mode IN ('all_clients', 'assigned_clients')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  cover_file_id UUID,
  created_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_courses_updated_at ON courses;
CREATE TRIGGER set_courses_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_course_modules_updated_at ON course_modules;
CREATE TRIGGER set_course_modules_updated_at
BEFORE UPDATE ON course_modules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  lesson_type TEXT NOT NULL DEFAULT 'text'
    CHECK (lesson_type IN ('text', 'video', 'download', 'reflection')),
  content_html TEXT,
  video_url TEXT,
  external_url TEXT,
  download_file_id UUID,
  estimated_minutes INTEGER NOT NULL DEFAULT 5,
  is_preview BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_course_lessons_updated_at ON course_lessons;
CREATE TRIGGER set_course_lessons_updated_at
BEFORE UPDATE ON course_lessons
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS course_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  client_profile_id UUID REFERENCES client_profiles(id) ON DELETE CASCADE,
  access_status TEXT NOT NULL DEFAULT 'active'
    CHECK (access_status IN ('active', 'paused', 'revoked', 'completed')),
  granted_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE (course_id, client_profile_id)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES course_lessons(id) ON DELETE CASCADE,
  client_profile_id UUID REFERENCES client_profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, client_profile_id)
);

CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tagline TEXT,
  description TEXT,
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  welcome_message TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_interval TEXT
    CHECK (billing_interval IN ('one_time', 'monthly', 'quarterly', 'yearly')),
  created_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_memberships_updated_at ON memberships;
CREATE TRIGGER set_memberships_updated_at
BEFORE UPDATE ON memberships
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS membership_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID REFERENCES memberships(id) ON DELETE CASCADE,
  client_profile_id UUID REFERENCES client_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  renewal_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  notes TEXT,
  assigned_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (membership_id, client_profile_id)
);

DROP TRIGGER IF EXISTS set_membership_enrollments_updated_at ON membership_enrollments;
CREATE TRIGGER set_membership_enrollments_updated_at
BEFORE UPDATE ON membership_enrollments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS membership_course_links (
  membership_id UUID REFERENCES memberships(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  created_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (membership_id, course_id)
);

CREATE TABLE IF NOT EXISTS membership_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID REFERENCES memberships(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'link'
    CHECK (resource_type IN ('guide', 'worksheet', 'link', 'video', 'download', 'note')),
  description TEXT,
  resource_url TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_membership_resources_updated_at ON membership_resources;
CREATE TRIGGER set_membership_resources_updated_at
BEFORE UPDATE ON membership_resources
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS membership_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID REFERENCES memberships(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_membership_announcements_updated_at ON membership_announcements;
CREATE TRIGGER set_membership_announcements_updated_at
BEFORE UPDATE ON membership_announcements
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------
-- Files and audit logs
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_name TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public', 'private', 'members_only', 'client_only')),
  uploaded_by UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE courses
  DROP CONSTRAINT IF EXISTS courses_cover_file_fk;

ALTER TABLE courses
  ADD CONSTRAINT courses_cover_file_fk
  FOREIGN KEY (cover_file_id)
  REFERENCES media_files(id)
  ON DELETE SET NULL;

ALTER TABLE course_lessons
  DROP CONSTRAINT IF EXISTS course_lessons_download_file_fk;

ALTER TABLE course_lessons
  ADD CONSTRAINT course_lessons_download_file_fk
  FOREIGN KEY (download_file_id)
  REFERENCES media_files(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------
-- Helpful indexes
-- -----------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_system_users_role ON system_users(role);
CREATE INDEX IF NOT EXISTS idx_client_profiles_status ON client_profiles(client_status);
CREATE INDEX IF NOT EXISTS idx_service_records_client_profile_id ON service_records(client_profile_id);
CREATE INDEX IF NOT EXISTS idx_service_records_service_date ON service_records(service_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_encouragement_posts_status ON encouragement_posts(status);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);


-- the-circle-community-pass-20-schema-start
CREATE TABLE IF NOT EXISTS circle_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
  author_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  post_type TEXT NOT NULL DEFAULT 'post' CHECK (post_type IN ('post', 'announcement', 'event', 'challenge')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  comments_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  reactions_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  event_starts_at TIMESTAMPTZ,
  event_ends_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (event_ends_at IS NULL OR event_starts_at IS NULL OR event_ends_at > event_starts_at)
);

CREATE TABLE IF NOT EXISTS circle_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted')),
  hidden_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  hidden_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS circle_reactions (
  post_id UUID NOT NULL REFERENCES circle_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('heart', 'celebrate', 'support')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS circle_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES circle_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES circle_comments(id) ON DELETE CASCADE,
  reporter_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  reviewed_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_circle_posts_status_published ON circle_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_circle_posts_membership_status ON circle_posts(membership_id, status);
CREATE INDEX IF NOT EXISTS idx_circle_comments_post_status ON circle_comments(post_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_circle_reports_status_created ON circle_reports(status, created_at DESC);
-- the-circle-community-pass-20-schema-end

-- secure-client-inbox-pass-22-schema-start
CREATE TABLE IF NOT EXISTS client_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id UUID NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'waiting_on_client', 'waiting_on_team', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'high', 'urgent')),
  assigned_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_client_conversations_updated_at ON client_conversations;
CREATE TRIGGER set_client_conversations_updated_at
BEFORE UPDATE ON client_conversations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS client_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES client_conversations(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('developer', 'owner', 'admin', 'staff', 'client')),
  body TEXT NOT NULL,
  attachment_url TEXT,
  attachment_label TEXT,
  is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
  read_by_client_at TIMESTAMPTZ,
  read_by_team_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((attachment_url IS NULL AND attachment_label IS NULL) OR attachment_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_client_conversations_client
  ON client_conversations(client_profile_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_conversations_status_priority
  ON client_conversations(status, priority, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_conversations_assignee
  ON client_conversations(assigned_user_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_conversation_messages_conversation
  ON client_conversation_messages(conversation_id, created_at ASC);
-- secure-client-inbox-pass-22-schema-end

-- unified-notification-center-pass-25-schema-start
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES system_users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  email_categories JSONB NOT NULL DEFAULT '{
    "inbox": true,
    "sessions": true,
    "resources": true,
    "learning": true,
    "memberships": true,
    "encouragements": true,
    "community": true,
    "system": true
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_notification_preferences_updated_at
  ON notification_preferences;
CREATE TRIGGER set_notification_preferences_updated_at
BEFORE UPDATE ON notification_preferences
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES system_users(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (
    category IN ('inbox', 'sessions', 'resources', 'learning', 'memberships', 'encouragements', 'community', 'system')
  ),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  action_label TEXT,
  entity_type TEXT,
  entity_id UUID,
  importance TEXT NOT NULL DEFAULT 'normal'
    CHECK (importance IN ('normal', 'high', 'urgent')),
  dedupe_key TEXT,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  email_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (email_status IN ('not_requested', 'pending', 'sent', 'skipped', 'failed')),
  email_attempts INTEGER NOT NULL DEFAULT 0,
  email_error TEXT,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '180 days')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_key
  ON notifications(dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications(recipient_user_id, read_at, created_at DESC)
  WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_email_queue
  ON notifications(email_status, created_at)
  WHERE email_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notifications_expiration
  ON notifications(expires_at);
-- unified-notification-center-pass-25-schema-end
