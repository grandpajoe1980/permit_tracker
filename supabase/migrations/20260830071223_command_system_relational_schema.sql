-- Create extension for UUIDs if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Permit Types (Statutory Catalog)
CREATE TABLE IF NOT EXISTS public.permit_types (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  responsible_org_id TEXT NOT NULL,
  responsible_org_code TEXT NOT NULL,
  trigger_explanation TEXT NOT NULL,
  statutory_citation TEXT NOT NULL,
  official_filing_url TEXT,
  application_form_url TEXT,
  instructions_url TEXT,
  expected_lead_time_days INTEGER NOT NULL DEFAULT 30,
  minimum_statutory_days INTEGER NOT NULL DEFAULT 10,
  public_notice_required BOOLEAN NOT NULL DEFAULT false,
  public_notice_days INTEGER NOT NULL DEFAULT 0,
  prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_permit_type_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_verified_at TIMESTAMPTZ,
  verification_status TEXT NOT NULL DEFAULT 'verified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Requirement Resources
CREATE TABLE IF NOT EXISTS public.requirement_resources (
  id TEXT PRIMARY KEY,
  permit_type_id TEXT NOT NULL REFERENCES public.permit_types(id) ON DELETE CASCADE,
  resource_name TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  url TEXT NOT NULL,
  version_tag TEXT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_by TEXT NOT NULL,
  is_stale BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Workflow Versions
CREATE TABLE IF NOT EXISTS public.workflow_versions (
  id TEXT PRIMARY KEY,
  workflow_id UUID REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  version_label TEXT NOT NULL,
  change_summary TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Workstreams (Core execution units with Dual Ownership & 6-Questions)
CREATE TABLE IF NOT EXISTS public.workstreams (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  permit_type_id TEXT REFERENCES public.permit_types(id),
  current_stage_name TEXT NOT NULL,
  operational_state TEXT NOT NULL DEFAULT 'running',
  operational_state_label TEXT NOT NULL DEFAULT 'Running (Technical Review)',
  rag_status TEXT NOT NULL DEFAULT 'green',
  rag_label TEXT NOT NULL DEFAULT 'On Track',
  is_critical_path BOOLEAN NOT NULL DEFAULT false,
  baseline_target_date DATE NOT NULL,
  forecast_target_date DATE NOT NULL,
  schedule_variance_days INTEGER NOT NULL DEFAULT 0,
  remaining_float_days INTEGER NOT NULL DEFAULT 0,
  state_concierge JSONB NOT NULL DEFAULT '{}'::jsonb,
  regulatory_lead JSONB NOT NULL DEFAULT '{}'::jsonb,
  six_questions JSONB NOT NULL DEFAULT '{}'::jsonb,
  waiting_reason TEXT,
  waiting_on_entity TEXT,
  current_action_summary TEXT,
  escalation_level INTEGER NOT NULL DEFAULT 0,
  escalation_triggered_at TIMESTAMPTZ,
  escalation_summary TEXT,
  stage_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Tasks (DAG Nodes)
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  workstream_id TEXT NOT NULL REFERENCES public.workstreams(id) ON DELETE CASCADE,
  task_code TEXT NOT NULL,
  title TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 1,
  float_days INTEGER NOT NULL DEFAULT 0,
  early_start DATE,
  early_finish DATE,
  late_start DATE,
  late_finish DATE,
  is_critical_path BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  predecessors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Task Dependencies (DAG Edges)
CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id TEXT PRIMARY KEY,
  predecessor_task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  successor_task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start',
  gate_type TEXT NOT NULL DEFAULT 'statutory_mandatory',
  lag_days INTEGER NOT NULL DEFAULT 0,
  is_controlling BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Coordination Requests (CR-00xxx)
CREATE TABLE IF NOT EXISTS public.coordination_requests (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  workstream_id TEXT NOT NULL REFERENCES public.workstreams(id) ON DELETE CASCADE,
  workstream_title TEXT NOT NULL,
  requesting_org_id TEXT NOT NULL,
  requesting_org_code TEXT NOT NULL,
  target_org_id TEXT NOT NULL,
  target_org_code TEXT NOT NULL,
  requesting_user_name TEXT NOT NULL,
  assigned_to_user_name TEXT,
  title TEXT NOT NULL,
  need_description TEXT NOT NULL,
  requested_date DATE NOT NULL,
  due_date DATE NOT NULL,
  response_date DATE,
  concurred_at TIMESTAMPTZ,
  attached_document_version_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocks_workstream_title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  response_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. RFIs & Responses
CREATE TABLE IF NOT EXISTS public.rfis (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  workstream_id TEXT NOT NULL REFERENCES public.workstreams(id) ON DELETE CASCADE,
  workstream_title TEXT NOT NULL,
  requesting_org_id TEXT NOT NULL,
  requesting_org_code TEXT NOT NULL,
  recipient_org_id TEXT NOT NULL,
  recipient_org_code TEXT NOT NULL,
  title TEXT NOT NULL,
  question_text TEXT NOT NULL,
  technical_reason TEXT NOT NULL,
  required_document_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  issued_date DATE NOT NULL,
  response_deadline DATE NOT NULL,
  clock_impact TEXT NOT NULL DEFAULT 'pauses_clock',
  schedule_impact_days INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_applicant',
  is_consolidated_cycle BOOLEAN NOT NULL DEFAULT false,
  consolidated_batch_id TEXT,
  lead_reviewer_approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rfi_responses (
  id TEXT PRIMARY KEY,
  rfi_id TEXT NOT NULL REFERENCES public.rfis(id) ON DELETE CASCADE,
  submitted_by_user_name TEXT NOT NULL,
  response_text TEXT NOT NULL,
  attached_document_version_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_date DATE NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'under_review',
  reviewer_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Document Versions (SHA-256 Ledger)
CREATE TABLE IF NOT EXISTS public.document_versions (
  id TEXT PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  document_ref_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  version_label TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  sha256_hash TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by_name TEXT NOT NULL,
  uploaded_by_org_name TEXT NOT NULL,
  change_notes TEXT,
  status TEXT NOT NULL DEFAULT 'under_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Document Agency Reviews (Signoff Matrix)
CREATE TABLE IF NOT EXISTS public.document_agency_reviews (
  id TEXT PRIMARY KEY,
  document_version_id TEXT NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  reviewing_org_id TEXT NOT NULL,
  reviewing_org_code TEXT NOT NULL,
  reviewed_by_user_name TEXT,
  reviewed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'under_review',
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Commitments (First-class accountability objects)
CREATE TABLE IF NOT EXISTS public.commitments (
  id TEXT PRIMARY KEY,
  workstream_id TEXT NOT NULL REFERENCES public.workstreams(id) ON DELETE CASCADE,
  workstream_title TEXT NOT NULL,
  committing_org_id TEXT NOT NULL,
  committing_org_code TEXT NOT NULL,
  made_by_person_name TEXT NOT NULL,
  committed_action TEXT NOT NULL,
  origin_context TEXT NOT NULL,
  committed_date DATE NOT NULL,
  promised_due_date DATE NOT NULL,
  fulfilled_date DATE,
  status TEXT NOT NULL DEFAULT 'on_track',
  impact_if_missed TEXT NOT NULL,
  is_critical_path_impact BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Decisions (Institutional Statutory Memory)
CREATE TABLE IF NOT EXISTS public.decisions (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  decision_date DATE NOT NULL,
  decision_summary TEXT NOT NULL,
  decision_maker_name TEXT NOT NULL,
  decision_maker_title TEXT NOT NULL,
  organizations_represented JSONB NOT NULL DEFAULT '[]'::jsonb,
  statutory_authority TEXT NOT NULL,
  affected_workstream_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  affected_workstream_titles JSONB NOT NULL DEFAULT '[]'::jsonb,
  referenced_document_version_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_follow_ups TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Meetings & Conversions
CREATE TABLE IF NOT EXISTS public.meetings (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  location_or_link TEXT,
  attendee_list JSONB NOT NULL DEFAULT '[]'::jsonb,
  meeting_notes TEXT NOT NULL,
  related_workstream_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_items_converted JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. Enable RLS on all newly created tables
ALTER TABLE public.permit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordination_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfi_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_agency_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- 15. Create public read/write access policies for authenticated and anon roles
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN (
      'permit_types', 'requirement_resources', 'workflow_versions', 'workstreams',
      'tasks', 'task_dependencies', 'coordination_requests', 'rfis', 'rfi_responses',
      'document_versions', 'document_agency_reviews', 'commitments', 'decisions', 'meetings'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public full access policy" ON public.%I', tbl);
    EXECUTE format('CREATE POLICY "Public full access policy" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END
$$;
;
