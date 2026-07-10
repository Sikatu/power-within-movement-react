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
    CHECK (role IN ('owner', 'admin', 'staff', 'client', 'member')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited', 'active', 'suspended', 'archived')),
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  temporary_password_expires_at TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_system_users_updated_at ON system_users;
CREATE TRIGGER set_system_users_updated_at
BEFORE UPDATE ON system_users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

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
  download_file_id UUID,
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
  UNIQUE (lesson_id, client_profile_id)
);

CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  price_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  billing_interval TEXT
    CHECK (billing_interval IN ('one_time', 'monthly', 'quarterly', 'yearly')),
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
  ends_at TIMESTAMPTZ,
  UNIQUE (membership_id, client_profile_id)
);

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
