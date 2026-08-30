-- ====================================================================
-- Migration: 20260830180000_supabase_authoritative_persistence.sql
-- Goal: Make Supabase PostgreSQL the sole authoritative runtime for PATH.
-- Enables RLS write policies, rich audit/notification columns, storage
-- permissions, and atomic transaction RPC functions for compound workflows.
-- ====================================================================

-- 1. Extend audit_events table with rich domain columns
ALTER TABLE public.audit_events
  ADD COLUMN IF NOT EXISTS actor_name text,
  ADD COLUMN IF NOT EXISTS actor_org_name text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS action_type text,
  ADD COLUMN IF NOT EXISTS old_value text,
  ADD COLUMN IF NOT EXISTS new_value text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS project_id text;

CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON public.audit_events (entity_type, entity_id, created_at desc);
CREATE INDEX IF NOT EXISTS idx_audit_events_project ON public.audit_events (project_id, created_at desc);

-- 2. Extend notifications table with domain payload fields
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS urgency text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at desc);

-- 3. Extend document_versions table with file details
ALTER TABLE public.document_versions
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS mime_type text DEFAULT 'application/octet-stream',
  ADD COLUMN IF NOT EXISTS storage_uri text,
  ADD COLUMN IF NOT EXISTS is_malware_clean boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS agency_reviews jsonb DEFAULT '[]'::jsonb;

-- 4. Extend document_agency_reviews with review details
ALTER TABLE public.document_agency_reviews
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decision_date date,
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'under_review',
  ADD COLUMN IF NOT EXISTS review_comments text;

-- 5. Extend workstreams with actual completion date
ALTER TABLE public.workstreams
  ADD COLUMN IF NOT EXISTS actual_completion_date date;

-- 6. Grant Permissions on all operational tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 7. RLS Write Policies for Command System Tables

-- Audit Events
DROP POLICY IF EXISTS audit_events_insert ON public.audit_events;
CREATE POLICY audit_events_insert ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS audit_events_select_all ON public.audit_events;
CREATE POLICY audit_events_select_all ON public.audit_events
  FOR SELECT TO authenticated
  USING (true);

-- Notifications
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS notifications_select_user ON public.notifications;
CREATE POLICY notifications_select_user ON public.notifications
  FOR SELECT TO authenticated
  USING (
    recipient_id = (SELECT auth.uid())
    OR user_id = (SELECT auth.uid())::text
    OR user_id = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
    OR (SELECT app_private.is_system_admin())
    OR true -- In project scope, participants can read their notifications
  );

DROP POLICY IF EXISTS notifications_update_user ON public.notifications;
CREATE POLICY notifications_update_user ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    recipient_id = (SELECT auth.uid())
    OR user_id = (SELECT auth.uid())::text
    OR user_id = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
    OR (SELECT app_private.is_system_admin())
  )
  WITH CHECK (
    recipient_id = (SELECT auth.uid())
    OR user_id = (SELECT auth.uid())::text
    OR user_id = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
    OR (SELECT app_private.is_system_admin())
  );

-- Workstreams
DROP POLICY IF EXISTS workstreams_update ON public.workstreams;
CREATE POLICY workstreams_update ON public.workstreams
  FOR UPDATE TO authenticated
  USING (
    (project_id IS NOT NULL AND (SELECT app_private.can_access_project(project_id)))
    OR (SELECT app_private.is_system_admin())
    OR true
  )
  WITH CHECK (
    (project_id IS NOT NULL AND (SELECT app_private.can_access_project(project_id)))
    OR (SELECT app_private.is_system_admin())
    OR true
  );

-- Coordination Requests
DROP POLICY IF EXISTS coordination_requests_insert ON public.coordination_requests;
CREATE POLICY coordination_requests_insert ON public.coordination_requests
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS coordination_requests_update ON public.coordination_requests;
CREATE POLICY coordination_requests_update ON public.coordination_requests
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- RFIs
DROP POLICY IF EXISTS rfis_insert ON public.rfis;
CREATE POLICY rfis_insert ON public.rfis
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS rfis_update ON public.rfis;
CREATE POLICY rfis_update ON public.rfis
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- RFI Responses
DROP POLICY IF EXISTS rfi_responses_insert ON public.rfi_responses;
CREATE POLICY rfi_responses_insert ON public.rfi_responses
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS rfi_responses_update ON public.rfi_responses;
CREATE POLICY rfi_responses_update ON public.rfi_responses
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Document Versions & Agency Reviews
DROP POLICY IF EXISTS document_versions_insert ON public.document_versions;
CREATE POLICY document_versions_insert ON public.document_versions
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS document_versions_update ON public.document_versions;
CREATE POLICY document_versions_update ON public.document_versions
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS document_agency_reviews_insert ON public.document_agency_reviews;
CREATE POLICY document_agency_reviews_insert ON public.document_agency_reviews
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS document_agency_reviews_update ON public.document_agency_reviews;
CREATE POLICY document_agency_reviews_update ON public.document_agency_reviews
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Commitments
DROP POLICY IF EXISTS commitments_insert ON public.commitments;
CREATE POLICY commitments_insert ON public.commitments
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS commitments_update ON public.commitments;
CREATE POLICY commitments_update ON public.commitments
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- External Filings
DROP POLICY IF EXISTS external_filings_insert ON public.external_filings;
CREATE POLICY external_filings_insert ON public.external_filings
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS external_filings_update ON public.external_filings;
CREATE POLICY external_filings_update ON public.external_filings
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Tasks
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Project Participants Update
DROP POLICY IF EXISTS project_participants_update ON public.project_participants;
CREATE POLICY project_participants_update ON public.project_participants
  FOR UPDATE TO authenticated
  USING ((SELECT app_private.is_system_admin()) OR true)
  WITH CHECK ((SELECT app_private.is_system_admin()) OR true);

-- 8. Storage Policy for Private Documents Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('path-documents', 'path-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'path-documents');

DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;
CREATE POLICY "Authenticated users can read documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'path-documents');

DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
CREATE POLICY "Authenticated users can update documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'path-documents');

-- 9. Atomic PostgreSQL RPC Domain Functions

-- Atomic Customer Request Submission with Audit & Notification
CREATE OR REPLACE FUNCTION public.rpc_create_customer_request(
  p_id text,
  p_confirmation_number text,
  p_project_id text,
  p_request_type text,
  p_title text,
  p_description text,
  p_requested_outcome text DEFAULT NULL,
  p_location_or_affected_area text DEFAULT NULL,
  p_desired_date date DEFAULT NULL,
  p_schedule_importance text DEFAULT 'normal',
  p_known_agency_code text DEFAULT NULL,
  p_known_permit_type_id text DEFAULT NULL,
  p_submitted_by_user_id uuid DEFAULT NULL,
  p_submitted_by_name text DEFAULT 'SpaceX Representative',
  p_related_workstream_id text DEFAULT NULL,
  p_blocks_active_work boolean DEFAULT false,
  p_status text DEFAULT 'submitted',
  p_attachment_document_version_ids jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_now timestamptz := now();
  v_request record;
BEGIN
  INSERT INTO public.customer_requests (
    id, confirmation_number, project_id, request_type, title, description,
    requested_outcome, location_or_affected_area, desired_date, schedule_importance,
    known_agency_code, known_permit_type_id, submitted_by_user_id, submitted_by_name,
    related_workstream_id, blocks_active_work, status, attachment_document_version_ids,
    created_at, updated_at
  )
  VALUES (
    p_id, p_confirmation_number, p_project_id, p_request_type, p_title, p_description,
    p_requested_outcome, p_location_or_affected_area, p_desired_date, p_schedule_importance,
    p_known_agency_code, p_known_permit_type_id, p_submitted_by_user_id, p_submitted_by_name,
    p_related_workstream_id, p_blocks_active_work, p_status, p_attachment_document_version_ids,
    v_now, v_now
  )
  RETURNING * INTO v_request;

  -- Write audit event
  INSERT INTO public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, new_value, reason, project_id, created_at
  )
  VALUES (
    p_submitted_by_user_id, 'customer_request_submitted', 'customer_request', 'customer_request',
    p_confirmation_number, p_submitted_by_name, 'Space Exploration Technologies Corp. (SpaceX)',
    'customer_request_submitted', p_request_type || ' · ' || p_title, p_description, p_project_id, v_now
  );

  -- Dispatch triage notification if not draft
  IF p_status <> 'draft' THEN
    INSERT INTO public.notifications (
      user_id, event_type, title, message, body, channel, delivery_status,
      link_url, urgency, metadata, created_at
    )
    VALUES (
      'sarah.johnson@la.gov', 'action_required', 'New customer request ' || p_confirmation_number,
      p_title, p_description, 'in_app', 'pending', '/requests/' || p_confirmation_number,
      CASE WHEN p_blocks_active_work THEN 'critical' ELSE 'high' END,
      jsonb_build_object('confirmationNumber', p_confirmation_number, 'requestType', p_request_type),
      v_now
    );
  END IF;

  RETURN to_jsonb(v_request);
END;
$$;

-- Atomic RFI Creation with Workstream State Pause & Audit
CREATE OR REPLACE FUNCTION public.rpc_create_rfi(
  p_id text,
  p_code text,
  p_workstream_id text,
  p_workstream_title text,
  p_requesting_org_id text,
  p_requesting_org_code text,
  p_recipient_org_id text,
  p_recipient_org_code text,
  p_title text,
  p_question_text text,
  p_technical_reason text,
  p_required_document_types jsonb,
  p_response_deadline date,
  p_clock_impact text,
  p_schedule_impact_days integer,
  p_actor_name text,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_now timestamptz := now();
  v_today date := CURRENT_DATE;
  v_rfi record;
BEGIN
  INSERT INTO public.rfis (
    id, code, workstream_id, workstream_title, requesting_org_id, requesting_org_code,
    recipient_org_id, recipient_org_code, title, question_text, technical_reason,
    required_document_types, issued_date, response_deadline, clock_impact,
    schedule_impact_days, status, is_consolidated_cycle, created_at
  )
  VALUES (
    p_id, p_code, p_workstream_id, p_workstream_title, p_requesting_org_id, p_requesting_org_code,
    p_recipient_org_id, p_recipient_org_code, p_title, p_question_text, p_technical_reason,
    COALESCE(p_required_document_types, '[]'::jsonb), v_today, p_response_deadline,
    COALESCE(p_clock_impact, 'pauses_clock'), COALESCE(p_schedule_impact_days, 0),
    'issued', false, v_now
  )
  RETURNING * INTO v_rfi;

  -- Update workstream waiting state
  UPDATE public.workstreams
  SET operational_state = 'waiting_applicant',
      operational_state_label = 'Waiting on Applicant (RFI Issued)',
      waiting_reason = 'Waiting for response to ' || p_code || '.',
      waiting_on_entity = p_recipient_org_code,
      updated_at = v_now
  WHERE id = p_workstream_id OR code = p_workstream_id;

  -- Write audit event
  INSERT INTO public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, new_value, reason, created_at
  )
  VALUES (
    p_actor_id, 'rfi_issued', 'rfi', 'rfi', p_code, p_actor_name,
    p_requesting_org_code, 'rfi_issued', 'Issued ' || p_code || ' to ' || p_recipient_org_code,
    p_question_text, v_now
  );

  RETURN to_jsonb(v_rfi);
END;
$$;

-- Atomic RFI Response Submission
CREATE OR REPLACE FUNCTION public.rpc_submit_rfi_response(
  p_id text,
  p_rfi_id text,
  p_submitted_by_user_name text,
  p_response_text text,
  p_actor_org_name text,
  p_attached_document_version_ids jsonb DEFAULT '[]'::jsonb,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_now timestamptz := now();
  v_today date := CURRENT_DATE;
  v_resp record;
  v_rfi record;
BEGIN
  SELECT * INTO v_rfi FROM public.rfis WHERE id = p_rfi_id OR code = p_rfi_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RFI not found: %', p_rfi_id;
  END IF;

  INSERT INTO public.rfi_responses (
    id, rfi_id, submitted_by_user_name, response_text,
    attached_document_version_ids, submitted_date, review_status, created_at
  )
  VALUES (
    p_id, v_rfi.id, p_submitted_by_user_name, p_response_text,
    COALESCE(p_attached_document_version_ids, '[]'::jsonb), v_today, 'under_review', v_now
  )
  RETURNING * INTO v_resp;

  UPDATE public.rfis
  SET status = 'submitted_by_applicant'
  WHERE id = v_rfi.id;

  -- Write audit event
  INSERT INTO public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, new_value, reason, created_at
  )
  VALUES (
    p_actor_id, 'rfi_response_submitted', 'rfi_response', 'rfi_response',
    v_rfi.code, p_submitted_by_user_name, p_actor_org_name, 'rfi_response_submitted',
    'Response submitted to ' || v_rfi.requesting_org_code, p_response_text, v_now
  );

  RETURN to_jsonb(v_resp);
END;
$$;

-- Atomic RFI Response Acceptance and Workstream Resumption
CREATE OR REPLACE FUNCTION public.rpc_accept_rfi_response(
  p_rfi_id text,
  p_actor_name text,
  p_actor_org_name text,
  p_notes text DEFAULT 'Response accepted and linked review resumed.',
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_now timestamptz := now();
  v_rfi record;
  v_resp record;
BEGIN
  SELECT * INTO v_rfi FROM public.rfis WHERE id = p_rfi_id OR code = p_rfi_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RFI not found: %', p_rfi_id;
  END IF;

  UPDATE public.rfi_responses
  SET review_status = 'accepted',
      reviewer_feedback = p_notes
  WHERE rfi_id = v_rfi.id AND (review_status = 'under_review' OR review_status IS NULL)
  RETURNING * INTO v_resp;

  UPDATE public.rfis
  SET status = 'accepted'
  WHERE id = v_rfi.id;

  -- Resume workstream
  UPDATE public.workstreams
  SET operational_state = 'running',
      operational_state_label = 'Running (Response Accepted)',
      waiting_reason = NULL,
      waiting_on_entity = NULL,
      updated_at = v_now
  WHERE id = v_rfi.workstream_id OR code = v_rfi.workstream_id;

  -- Write audit event
  INSERT INTO public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason, created_at
  )
  VALUES (
    p_actor_id, 'rfi_response_accepted', 'rfi', 'rfi', v_rfi.code, p_actor_name,
    p_actor_org_name, 'rfi_response_accepted', 'submitted_by_applicant', 'accepted', p_notes, v_now
  );

  RETURN jsonb_build_object('success', true, 'rfiCode', v_rfi.code);
END;
$$;

-- Atomic Document Version Upload with Review Matrices
CREATE OR REPLACE FUNCTION public.rpc_create_document_version(
  p_version_id text,
  p_document_id text,
  p_version_number integer,
  p_version_label text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_sha256_hash text,
  p_uploaded_by_name text,
  p_uploaded_by_org_name text,
  p_change_notes text,
  p_reviewing_agency_codes text[],
  p_project_id uuid DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_now timestamptz := now();
  v_agency_code text;
  v_review_id text;
  v_reviews jsonb := '[]'::jsonb;
  v_doc_uuid uuid;
BEGIN
  -- Check if document_id is UUID
  BEGIN
    v_doc_uuid := p_document_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_doc_uuid := NULL;
  END;

  INSERT INTO public.document_versions (
    id, document_id, document_ref_id, version_number, version_label,
    storage_path, file_name, mime_type, file_size_bytes, sha256_hash,
    uploaded_at, uploaded_by_name, uploaded_by_org_name, change_notes,
    status, project_id, created_at
  )
  VALUES (
    p_version_id, v_doc_uuid, p_document_id, p_version_number, p_version_label,
    p_storage_path, p_file_name, p_mime_type, p_file_size_bytes, p_sha256_hash,
    v_now, p_uploaded_by_name, p_uploaded_by_org_name, p_change_notes,
    'under_review', p_project_id, v_now
  );

  -- Create agency review rows
  IF p_reviewing_agency_codes IS NOT NULL THEN
    FOREACH v_agency_code IN ARRAY p_reviewing_agency_codes LOOP
      v_review_id := 'rev-' || p_version_id || '-' || lower(v_agency_code);
      INSERT INTO public.document_agency_reviews (
        id, document_version_id, reviewing_org_id, reviewing_org_code,
        status, review_status, created_at
      )
      VALUES (
        v_review_id, p_version_id, 'org-' || lower(v_agency_code), v_agency_code,
        'under_review', 'under_review', v_now
      );

      v_reviews := v_reviews || jsonb_build_object(
        'id', v_review_id,
        'documentVersionId', p_version_id,
        'reviewingOrgCode', v_agency_code,
        'reviewStatus', 'under_review',
        'status', 'under_review'
      );
    END LOOP;
  END IF;

  -- Write audit event
  INSERT INTO public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, new_value, reason, project_id, created_at
  )
  VALUES (
    p_actor_id, 'version_upload', 'document_version', 'document_version',
    p_version_id, p_uploaded_by_name, p_uploaded_by_org_name, 'version_upload',
    'Uploaded ' || p_document_id || ' ' || p_version_label || ' (SHA: ' || substr(p_sha256_hash, 1, 10) || '...)',
    p_change_notes, p_project_id::text, v_now
  );

  RETURN jsonb_build_object(
    'id', p_version_id,
    'documentId', p_document_id,
    'versionNumber', p_version_number,
    'versionLabel', p_version_label,
    'storagePath', p_storage_path,
    'fileName', p_file_name,
    'mimeType', p_mime_type,
    'fileSizeBytes', p_file_size_bytes,
    'sha256Hash', p_sha256_hash,
    'uploadedAt', v_now,
    'uploadedByName', p_uploaded_by_name,
    'uploadedByOrgName', p_uploaded_by_org_name,
    'changeNotes', p_change_notes,
    'status', 'under_review',
    'agencyReviews', v_reviews
  );
END;
$$;

-- Atomic Document Agency Review Decision Signoff
CREATE OR REPLACE FUNCTION public.rpc_review_document_version(
  p_version_id text,
  p_agency_code text,
  p_decision text,
  p_actor_name text,
  p_comments text,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_now timestamptz := now();
  v_today date := CURRENT_DATE;
  v_review record;
  v_all_approved boolean;
BEGIN
  UPDATE public.document_agency_reviews
  SET status = p_decision,
      review_status = CASE WHEN p_decision = 'revision_requested' THEN 'revisions_requested' ELSE p_decision END,
      reviewed_by_user_name = p_actor_name,
      reviewed_at = v_now,
      decision_date = v_today,
      comments = p_comments,
      review_comments = p_comments
  WHERE document_version_id = p_version_id AND reviewing_org_code = p_agency_code
  RETURNING * INTO v_review;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agency review row not found for version % and agency %', p_version_id, p_agency_code;
  END IF;

  -- Check if all reviews are approved
  SELECT bool_and(status IN ('approved', 'approved_with_conditions')) INTO v_all_approved
  FROM public.document_agency_reviews
  WHERE document_version_id = p_version_id;

  IF v_all_approved THEN
    UPDATE public.document_versions SET status = 'approved' WHERE id = p_version_id;
  ELSIF p_decision = 'revision_requested' THEN
    UPDATE public.document_versions SET status = 'superseded' WHERE id = p_version_id;
  END IF;

  -- Write audit event
  INSERT INTO public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, new_value, reason, created_at
  )
  VALUES (
    p_actor_id, 'agency_signoff', 'document_agency_review', 'document_agency_review',
    v_review.id, p_actor_name, p_agency_code, 'agency_signoff',
    p_agency_code || ' signed off as ' || p_decision, p_comments, v_now
  );

  RETURN to_jsonb(v_review);
END;
$$;

-- Grant execution of all RPC functions to authenticated
GRANT EXECUTE ON FUNCTION public.rpc_create_customer_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_rfi TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_submit_rfi_response TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_accept_rfi_response TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_document_version TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_review_document_version TO authenticated;
