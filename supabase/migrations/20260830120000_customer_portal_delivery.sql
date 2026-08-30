-- Customer portal delivery records. These tables deliberately distinguish PATH
-- workflow state from authoritative external agency filing state.
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  organization_id text NOT NULL,
  organization_name text NOT NULL,
  display_title text NOT NULL,
  organizational_unit text,
  work_email text NOT NULL,
  office_phone text,
  mobile_phone text,
  office_location text,
  preferred_contact_method text NOT NULL DEFAULT 'email',
  availability_status text NOT NULL DEFAULT 'available',
  project_role text NOT NULL,
  avatar_url text,
  is_customer_visible boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The initial PATH schema already owns this table with UUID project/org keys.
-- Extend it in place so this migration is safe on an existing installation.
ALTER TABLE public.project_participants ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.project_participants ADD COLUMN IF NOT EXISTS organization_name text;
ALTER TABLE public.project_participants ADD COLUMN IF NOT EXISTS project_role text;
ALTER TABLE public.project_participants ADD COLUMN IF NOT EXISTS workstream_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.project_participants ADD COLUMN IF NOT EXISTS assigned_task_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.project_participants ADD COLUMN IF NOT EXISTS review_responsibility jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.project_participants ADD COLUMN IF NOT EXISTS notification_responsibility jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.project_participants ADD COLUMN IF NOT EXISTS visibility_scope text NOT NULL DEFAULT 'project';
ALTER TABLE public.project_participants ADD COLUMN IF NOT EXISTS starts_on date;
ALTER TABLE public.project_participants ADD COLUMN IF NOT EXISTS ends_on date;
ALTER TABLE public.project_participants ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.external_filings (
  id text PRIMARY KEY,
  project_id text NOT NULL,
  workstream_id text NOT NULL,
  permit_type_id text,
  authority_organization_id text NOT NULL,
  authority_organization_name text NOT NULL,
  filing_method text NOT NULL CHECK (filing_method IN ('PATH_SUPPORTED', 'EXTERNAL_PORTAL', 'EMAIL_PAPER_OTHER', 'TRACK_ONLY')),
  official_portal_url text,
  external_reference_number text,
  external_record_url text,
  external_status text NOT NULL DEFAULT 'not_started',
  submitted_at timestamptz,
  submitted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_status_verified_at timestamptz,
  last_status_verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  authoritative_system_name text,
  notes text,
  receipt_document_version_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_requests (
  id text PRIMARY KEY,
  confirmation_number text NOT NULL UNIQUE,
  project_id text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('permit_authorization', 'government_help', 'project_question', 'blocker_coordination', 'escalation', 'concierge')),
  title text NOT NULL,
  description text NOT NULL,
  requested_outcome text,
  location_or_affected_area text,
  desired_date date,
  schedule_importance text NOT NULL DEFAULT 'normal',
  known_agency_code text,
  known_permit_type_id text,
  submitted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by_name text NOT NULL,
  related_workstream_id text,
  blocks_active_work boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'submitted',
  attachment_document_version_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_participants_project ON public.project_participants(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_external_filings_project ON public.external_filings(project_id, workstream_id);
CREATE INDEX IF NOT EXISTS idx_customer_requests_project ON public.customer_requests(project_id, status);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project users can read visible profiles" ON public.user_profiles FOR SELECT TO authenticated USING (
  is_active = true AND (
    user_id = auth.uid()
    OR is_customer_visible = true
    OR EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.user_id = auth.uid() AND m.status = 'active')
  )
);
REVOKE UPDATE ON public.user_profiles FROM authenticated;
GRANT UPDATE (display_title, organizational_unit, work_email, office_phone, mobile_phone, office_location, preferred_contact_method, availability_status, avatar_url) ON public.user_profiles TO authenticated;
CREATE POLICY "users can update their contact fields" ON public.user_profiles FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "participants are visible to authorized users" ON public.project_participants FOR SELECT TO authenticated USING (
  is_active = true AND (
    visibility_scope <> 'admin'
    OR EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.user_id = auth.uid() AND m.status = 'active')
  )
);
CREATE POLICY "filings are visible to authenticated users" ON public.external_filings FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers can submit requests" ON public.customer_requests FOR INSERT TO authenticated WITH CHECK (submitted_by_user_id = auth.uid());
CREATE POLICY "request submitters and government users can read requests" ON public.customer_requests FOR SELECT TO authenticated USING (
  submitted_by_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.user_id = auth.uid() AND m.status = 'active')
);
