-- Non-destructive, idempotent lifecycle scenarios for the PATH demo.
--
-- Preconditions:
--   1. supabase/seed.sql and scripts/seed-spacex-demo.mjs have run.
--   2. The baseline demo auth users and assignment groups exist.
--
-- This file is intentionally DML-only. It does not create auth users, write
-- Storage objects, delete rows, or alter RLS. Stable PATH-DEMO-* identifiers
-- make reruns safe and make the records easy to isolate in verification.
do $$
declare
  v_project_id uuid;
  v_spaceport_id uuid;
  v_ldeq_id uuid;
  v_dotd_id uuid;
  v_cpra_id uuid;
  v_path_id uuid;
  v_alex_id uuid;
  v_maya_id uuid;
  v_jordan_id uuid;
  v_sam_id uuid;
  v_sarah_id uuid;
  v_title_v_permit_id text;
  v_group_spaceport uuid;
  v_group_ldeq uuid;
  v_group_dotd uuid;
  v_group_cpra uuid;
  v_group_path uuid;
  v_attachment_id text;
  v_attachment_ids jsonb;
  v_now timestamptz := '2026-09-07T12:00:00Z';
begin
  select id into v_project_id from public.projects where number = 'PRJ-PECAN-2026' limit 1;
  select id into v_spaceport_id from public.organizations where code = 'SPACEPORT' limit 1;
  select id into v_ldeq_id from public.organizations where code = 'LDEQ' limit 1;
  select id into v_dotd_id from public.organizations where code = 'DOTD' limit 1;
  select id into v_cpra_id from public.organizations where code = 'CPRA' limit 1;
  select id into v_path_id from public.organizations where code = 'LA-PROJECTS' limit 1;

  select id into v_alex_id from auth.users where email = 'alex.martin@demo.permit.local' limit 1;
  select id into v_maya_id from auth.users where email = 'maya.chen@demo.permit.local' limit 1;
  select id into v_jordan_id from auth.users where email = 'jordan.lee@demo.permit.local' limit 1;
  select id into v_sam_id from auth.users where email = 'sam.rivera@demo.permit.local' limit 1;
  select id into v_sarah_id from auth.users where email = 'sarah.johnson@demo.permit.local' limit 1;

  select id into v_title_v_permit_id from public.permit_types where code = 'LDEQ-AIR-TITLEV' limit 1;
  select id into v_group_spaceport from public.assignment_groups where org_code = 'SPACEPORT' and name = 'SpaceX Regulatory Affairs' and active limit 1;
  select id into v_group_ldeq from public.assignment_groups where org_code = 'LDEQ' and name = 'LDEQ Air and Water Review' and active limit 1;
  select id into v_group_dotd from public.assignment_groups where org_code = 'DOTD' and name = 'DOTD Transportation Review' and active limit 1;
  select id into v_group_cpra from public.assignment_groups where org_code = 'CPRA' and name = 'CPRA Coastal Review' and active limit 1;
  select id into v_group_path from public.assignment_groups where org_code = 'LA-PROJECTS' and name = 'Louisiana Project Delivery Office' and active limit 1;

  if v_project_id is null or v_spaceport_id is null or v_ldeq_id is null or v_dotd_id is null or v_cpra_id is null or v_path_id is null then
    raise exception 'PATH demo baseline project or organization is missing';
  end if;
  if v_alex_id is null or v_maya_id is null or v_jordan_id is null or v_sam_id is null or v_sarah_id is null then
    raise exception 'PATH demo baseline auth persona is missing';
  end if;
  if v_group_spaceport is null or v_group_ldeq is null or v_group_dotd is null or v_group_cpra is null or v_group_path is null then
    raise exception 'PATH demo baseline assignment group is missing';
  end if;

  select id into v_attachment_id
  from public.document_versions
  where file_name = 'launch-flight-safety-hazard-demo-v1.pdf'
    and file_size_bytes > 0
    and sha256_hash is not null
  order by created_at
  limit 1;
  v_attachment_ids := case when v_attachment_id is null then '[]'::jsonb else jsonb_build_array(v_attachment_id) end;

  insert into public.workstreams (
    id, project_id, code, title, category, permit_type_id, current_stage_name,
    operational_state, operational_state_label, rag_status, rag_label,
    is_critical_path, baseline_target_date, forecast_target_date,
    schedule_variance_days, remaining_float_days, state_concierge,
    regulatory_lead, six_questions, waiting_reason, waiting_on_entity,
    current_action_summary, escalation_level, escalation_triggered_at,
    escalation_summary, stage_history, active_blockers, created_at, updated_at,
    workflow_version_id, current_stage_id, current_stage_started_at,
    assigned_owner_user_id, assigned_owner_org_code, assignment_group_id,
    assigned_to_user_id, assigned_org_code, itsm_state, priority,
    statutory_deadline, clock_status, clock_paused_reason, clock_paused_at,
    clock_total_paused_seconds, customer_request_id
  ) values
  (
    'PATH-DEMO-WS-AIR', v_project_id, 'PATH-DEMO-WS-AIR', 'Demo — Air permit response and technical review', 'air', v_title_v_permit_id, 'Technical team review',
    'waiting_applicant', 'Waiting on applicant response', 'yellow', 'Action Needed', true, '2026-09-15', '2026-10-01', 16, 0,
    jsonb_build_object('name', 'Sarah Johnson', 'title', 'State project coordinator', 'agency', 'Louisiana Project Delivery Office', 'email', 'sarah.johnson@demo.permit.local'),
    jsonb_build_object('orgCode', 'LDEQ', 'orgName', 'Louisiana Department of Environmental Quality', 'jurisdictionLevel', 'State', 'assignedReviewerName', 'Jordan Lee', 'assignedReviewerEmail', 'jordan.lee@demo.permit.local'),
    jsonb_build_object('currentActionSummary', 'Review the applicant''s revised emissions inventory.', 'nextExpectedEvent', 'Applicant response to PATH-DEMO-RFI-WAITING', 'customerActionRequired', 'Upload the control-technology memo.', 'primaryDelayReason', 'customer_response'),
    'A response is required before technical review can resume.', 'SPACEPORT', 'Review the applicant''s revised emissions inventory.', 0, null, '',
    '[{"stageKey":"intake","label":"Request intake","status":"complete","completedAt":"2026-08-25"},{"stageKey":"technical_review","label":"Technical team review","status":"active","startedAt":"2026-08-26"}]'::jsonb,
    '[{"id":"PATH-DEMO-BLOCKER-AIR","title":"Applicant response to RFI","severity":"medium","source":"PATH-DEMO-RFI-WAITING"}]'::jsonb,
    '2026-08-25T12:00:00Z', v_now, 'workflow-version-spaceport-request-v1', 'workflow-version-spaceport-request-v1-technical_review', '2026-08-26T12:00:00Z',
    v_jordan_id, 'LDEQ', v_group_ldeq, v_jordan_id, 'LDEQ', 'pending_customer', 'P1', '2026-10-15T00:00:00Z', 'paused', 'Waiting for applicant response', '2026-09-02T12:00:00Z', 432000, 'PATH-DEMO-REQ-RFI'
  ),
  (
    'PATH-DEMO-WS-COAST', v_project_id, 'PATH-DEMO-WS-COAST', 'Demo — Coastal concurrence and dependency clearance', 'coastal', null, 'Agency coordination',
    'blocked', 'Response recorded — dependency still blocked', 'red', 'Blocked / Escalated', true, '2026-09-20', '2026-10-10', 20, 0,
    jsonb_build_object('name', 'Sarah Johnson', 'title', 'State project coordinator', 'agency', 'Louisiana Project Delivery Office', 'email', 'sarah.johnson@demo.permit.local'),
    jsonb_build_object('orgCode', 'CPRA', 'orgName', 'Coastal Protection and Restoration Authority', 'jurisdictionLevel', 'State', 'assignedReviewerName', 'Sarah Johnson', 'assignedReviewerEmail', 'sarah.johnson@demo.permit.local'),
    jsonb_build_object('currentActionSummary', 'Review the CPRA response and decide whether the dependency can be cleared.', 'nextExpectedEvent', 'Coordinator dependency-clearance decision', 'customerActionRequired', 'No customer action required right now.', 'primaryDelayReason', 'agency_dependency'),
    'CPRA responded, but the originating team has not cleared the dependency.', 'CPRA', 'Review the CPRA response and decide whether the dependency can be cleared.', 1, '2026-09-05T12:00:00Z', 'Response received; dependency remains visibly unresolved.',
    '[{"stageKey":"intake","label":"Request intake","status":"complete","completedAt":"2026-08-22"},{"stageKey":"technical_review","label":"Technical team review","status":"complete","completedAt":"2026-08-30"},{"stageKey":"agency_coordination","label":"Agency coordination","status":"active","startedAt":"2026-09-01"}]'::jsonb,
    '[{"id":"PATH-DEMO-BLOCKER-COAST","title":"Dependency clearance decision","severity":"high","source":"PATH-DEMO-COORD-RESPONDED"}]'::jsonb,
    '2026-08-22T12:00:00Z', v_now, 'workflow-version-spaceport-request-v1', 'workflow-version-spaceport-request-v1-agency_coordination', '2026-09-01T12:00:00Z',
    v_sarah_id, 'LA-PROJECTS', v_group_path, v_sarah_id, 'LA-PROJECTS', 'blocked', 'P1', '2026-10-20T00:00:00Z', 'paused', 'Agency response received; dependency clearance pending', '2026-09-05T12:00:00Z', 172800, 'PATH-DEMO-REQ-COORD'
  ),
  (
    'PATH-DEMO-WS-UTILITY', v_project_id, 'PATH-DEMO-WS-UTILITY', 'Demo — Utility interconnection parallel review', 'infrastructure', null, 'Technical team review',
    'running', 'Running — parallel technical reviews', 'green', 'On Track', false, '2026-10-05', '2026-10-05', 0, 12,
    jsonb_build_object('name', 'Sarah Johnson', 'title', 'State project coordinator', 'agency', 'Louisiana Project Delivery Office', 'email', 'sarah.johnson@demo.permit.local'),
    jsonb_build_object('orgCode', 'DOTD', 'orgName', 'Louisiana Department of Transportation and Development', 'jurisdictionLevel', 'State', 'assignedReviewerName', 'Sam Rivera', 'assignedReviewerEmail', 'sam.rivera@demo.permit.local'),
    jsonb_build_object('currentActionSummary', 'Run the utility and transportation technical reviews in parallel.', 'nextExpectedEvent', 'Technical review checkpoint', 'customerActionRequired', 'No action currently required.', 'primaryDelayReason', 'none'),
    null, null, 'Run the utility and transportation technical reviews in parallel.', 0, null, '',
    '[{"stageKey":"intake","label":"Request intake","status":"complete","completedAt":"2026-08-28"},{"stageKey":"technical_review","label":"Technical team review","status":"active","startedAt":"2026-09-02","parallel":true},{"stageKey":"agency_coordination","label":"Agency coordination","status":"active","startedAt":"2026-09-03","parallel":true}]'::jsonb,
    '[]'::jsonb, '2026-08-28T12:00:00Z', v_now, 'workflow-version-spaceport-request-v1', 'workflow-version-spaceport-request-v1-technical_review', '2026-09-02T12:00:00Z',
    v_sam_id, 'DOTD', v_group_dotd, v_sam_id, 'DOTD', 'in_progress', 'P2', null, 'active', null, null, 0, 'PATH-DEMO-REQ-ACTIVE'
  ),
  (
    'PATH-DEMO-WS-COMPLETE', v_project_id, 'PATH-DEMO-WS-COMPLETE', 'Demo — Completed drainage authorization', 'water', null, 'Monitoring and closeout',
    'complete', 'Complete', 'green', 'On Track', false, '2026-08-25', '2026-08-25', 0, 0,
    jsonb_build_object('name', 'Sarah Johnson', 'title', 'State project coordinator', 'agency', 'Louisiana Project Delivery Office', 'email', 'sarah.johnson@demo.permit.local'),
    jsonb_build_object('orgCode', 'LDEQ', 'orgName', 'Louisiana Department of Environmental Quality', 'jurisdictionLevel', 'State', 'assignedReviewerName', 'Jordan Lee', 'assignedReviewerEmail', 'jordan.lee@demo.permit.local'),
    jsonb_build_object('currentActionSummary', 'Monitor closeout record and preserve the completion history.', 'nextExpectedEvent', 'Closeout archive review', 'customerActionRequired', 'No action currently required.', 'primaryDelayReason', 'none'),
    null, null, 'Monitor closeout record and preserve the completion history.', 0, null, '',
    '[{"stageKey":"intake","label":"Request intake","status":"complete","completedAt":"2026-08-10"},{"stageKey":"technical_review","label":"Technical team review","status":"complete","completedAt":"2026-08-15"},{"stageKey":"agency_coordination","label":"Agency coordination","status":"complete","completedAt":"2026-08-20"},{"stageKey":"construction_release","label":"Construction release","status":"complete","completedAt":"2026-08-23"},{"stageKey":"monitoring","label":"Monitoring and closeout","status":"complete","completedAt":"2026-08-25"}]'::jsonb,
    '[]'::jsonb, '2026-08-10T12:00:00Z', v_now, 'workflow-version-spaceport-request-v1', 'workflow-version-spaceport-request-v1-monitoring', '2026-08-23T12:00:00Z',
    v_jordan_id, 'LDEQ', v_group_ldeq, v_jordan_id, 'LDEQ', 'resolved', 'P3', null, 'stopped', null, null, 0, 'PATH-DEMO-REQ-COMPLETE'
  )
  on conflict (id) do update set
    project_id = excluded.project_id, code = excluded.code, title = excluded.title, category = excluded.category,
    permit_type_id = excluded.permit_type_id, current_stage_name = excluded.current_stage_name,
    operational_state = excluded.operational_state, operational_state_label = excluded.operational_state_label,
    rag_status = excluded.rag_status, rag_label = excluded.rag_label, is_critical_path = excluded.is_critical_path,
    baseline_target_date = excluded.baseline_target_date, forecast_target_date = excluded.forecast_target_date,
    schedule_variance_days = excluded.schedule_variance_days, remaining_float_days = excluded.remaining_float_days,
    state_concierge = excluded.state_concierge, regulatory_lead = excluded.regulatory_lead, six_questions = excluded.six_questions,
    waiting_reason = excluded.waiting_reason, waiting_on_entity = excluded.waiting_on_entity,
    current_action_summary = excluded.current_action_summary, escalation_level = excluded.escalation_level,
    escalation_triggered_at = excluded.escalation_triggered_at, escalation_summary = excluded.escalation_summary,
    stage_history = excluded.stage_history, active_blockers = excluded.active_blockers, updated_at = excluded.updated_at,
    workflow_version_id = excluded.workflow_version_id, current_stage_id = excluded.current_stage_id,
    current_stage_started_at = excluded.current_stage_started_at, assigned_owner_user_id = excluded.assigned_owner_user_id,
    assigned_owner_org_code = excluded.assigned_owner_org_code, assignment_group_id = excluded.assignment_group_id,
    assigned_to_user_id = excluded.assigned_to_user_id, assigned_org_code = excluded.assigned_org_code,
    itsm_state = excluded.itsm_state, priority = excluded.priority, statutory_deadline = excluded.statutory_deadline,
    clock_status = excluded.clock_status, clock_paused_reason = excluded.clock_paused_reason,
    clock_paused_at = excluded.clock_paused_at, clock_total_paused_seconds = excluded.clock_total_paused_seconds,
    customer_request_id = excluded.customer_request_id;

  insert into public.tasks (
    id, workstream_id, task_code, title, duration_days, float_days, early_start,
    early_finish, late_start, late_finish, is_critical_path, status, predecessors,
    created_at, assignment_group_id, assigned_to_user_id, assigned_org_code,
    itsm_state, priority, statutory_deadline, clock_status, clock_paused_reason,
    clock_paused_at, clock_total_paused_seconds, stage_id, is_stage_action,
    description, assigned_user_name, actual_completion_date
  ) values
  ('PATH-DEMO-T-AIR-001', 'PATH-DEMO-WS-AIR', 'PATH-DEMO-T-AIR-001', 'Confirm emissions inventory assumptions', 5, 0, '2026-08-26', '2026-08-30', '2026-08-26', '2026-08-30', true, 'completed', '[]'::jsonb, '2026-08-26T12:00:00Z', v_group_spaceport, v_alex_id, 'SPACEPORT', 'resolved', 'P1', null, 'stopped', null, null, 0, 'workflow-version-spaceport-request-v1-technical_review', true, 'Applicant baseline package is complete.', 'Alex Martin', '2026-08-30'),
  ('PATH-DEMO-T-AIR-002', 'PATH-DEMO-WS-AIR', 'PATH-DEMO-T-AIR-002', 'Resolve technical review questions', 8, 0, '2026-08-31', '2026-09-08', '2026-08-31', '2026-09-08', true, 'pending_customer', '["PATH-DEMO-T-AIR-001"]'::jsonb, '2026-08-31T12:00:00Z', v_group_ldeq, v_jordan_id, 'LDEQ', 'pending_customer', 'P1', '2026-10-15T00:00:00Z', 'paused', 'Waiting for applicant response', '2026-09-02T12:00:00Z', 432000, 'workflow-version-spaceport-request-v1-technical_review', true, 'Reviewer is waiting on the applicant RFI response.', 'Jordan Lee', null),
  ('PATH-DEMO-T-COAST-001', 'PATH-DEMO-WS-COAST', 'PATH-DEMO-T-COAST-001', 'Review CPRA response and clear dependency', 4, 0, '2026-09-05', '2026-09-08', '2026-09-05', '2026-09-08', true, 'blocked', '[]'::jsonb, '2026-09-05T12:00:00Z', v_group_path, v_sarah_id, 'LA-PROJECTS', 'blocked', 'P1', '2026-10-20T00:00:00Z', 'paused', 'Dependency clearance pending', '2026-09-05T12:00:00Z', 172800, 'workflow-version-spaceport-request-v1-agency_coordination', true, 'A response exists, but the dependency is not yet cleared.', 'Sarah Johnson', null),
  ('PATH-DEMO-T-UTILITY-001', 'PATH-DEMO-WS-UTILITY', 'PATH-DEMO-T-UTILITY-001', 'Review utility interconnection package', 7, 6, '2026-09-02', '2026-09-08', '2026-09-08', '2026-09-14', false, 'in_progress', '[]'::jsonb, '2026-09-02T12:00:00Z', v_group_dotd, v_sam_id, 'DOTD', 'in_progress', 'P2', null, 'active', null, null, 0, 'workflow-version-spaceport-request-v1-technical_review', true, 'Technical review is active in parallel with agency coordination.', 'Sam Rivera', null),
  ('PATH-DEMO-T-UTILITY-002', 'PATH-DEMO-WS-UTILITY', 'PATH-DEMO-T-UTILITY-002', 'Prepare transportation concurrency note', 5, 8, '2026-09-03', '2026-09-07', '2026-09-09', '2026-09-15', false, 'submitted', '[]'::jsonb, '2026-09-03T12:00:00Z', v_group_dotd, v_sam_id, 'DOTD', 'submitted', 'P2', null, 'active', null, null, 0, 'workflow-version-spaceport-request-v1-agency_coordination', true, 'Parallel agency coordination input is ready for review.', 'Sam Rivera', null),
  ('PATH-DEMO-T-COMPLETE-001', 'PATH-DEMO-WS-COMPLETE', 'PATH-DEMO-T-COMPLETE-001', 'Archive completed drainage authorization', 2, 0, '2026-08-24', '2026-08-25', '2026-08-24', '2026-08-25', false, 'completed', '[]'::jsonb, '2026-08-24T12:00:00Z', v_group_ldeq, v_jordan_id, 'LDEQ', 'resolved', 'P3', null, 'stopped', null, null, 0, 'workflow-version-spaceport-request-v1-monitoring', true, 'Completion history is retained for the project story.', 'Jordan Lee', '2026-08-25')
  on conflict (id) do update set
    workstream_id = excluded.workstream_id, task_code = excluded.task_code, title = excluded.title,
    duration_days = excluded.duration_days, float_days = excluded.float_days, early_start = excluded.early_start,
    early_finish = excluded.early_finish, late_start = excluded.late_start, late_finish = excluded.late_finish,
    is_critical_path = excluded.is_critical_path, status = excluded.status, predecessors = excluded.predecessors,
    assignment_group_id = excluded.assignment_group_id, assigned_to_user_id = excluded.assigned_to_user_id,
    assigned_org_code = excluded.assigned_org_code, itsm_state = excluded.itsm_state, priority = excluded.priority,
    statutory_deadline = excluded.statutory_deadline, clock_status = excluded.clock_status,
    clock_paused_reason = excluded.clock_paused_reason, clock_paused_at = excluded.clock_paused_at,
    clock_total_paused_seconds = excluded.clock_total_paused_seconds, stage_id = excluded.stage_id,
    is_stage_action = excluded.is_stage_action, description = excluded.description,
    assigned_user_name = excluded.assigned_user_name, actual_completion_date = excluded.actual_completion_date;

  insert into public.task_dependencies (id, predecessor_task_id, successor_task_id, dependency_type, gate_type, lag_days, is_controlling, created_at)
  values
    ('PATH-DEMO-DEP-AIR-001-002', 'PATH-DEMO-T-AIR-001', 'PATH-DEMO-T-AIR-002', 'finish_to_start', 'statutory_mandatory', 0, true, v_now),
    ('PATH-DEMO-DEP-COAST-RESPONSE', 'PATH-DEMO-T-COAST-001', 'PATH-DEMO-T-UTILITY-001', 'finish_to_start', 'coordination_gate', 0, false, v_now)
  on conflict (id) do update set predecessor_task_id = excluded.predecessor_task_id, successor_task_id = excluded.successor_task_id, dependency_type = excluded.dependency_type, gate_type = excluded.gate_type, lag_days = excluded.lag_days, is_controlling = excluded.is_controlling;

  insert into public.customer_requests (
    id, confirmation_number, project_id, request_type, title, description,
    requested_outcome, location_or_affected_area, desired_date, schedule_importance,
    known_agency_code, known_permit_type_id, submitted_by_user_id, submitted_by_name,
    related_workstream_id, blocks_active_work, status, attachment_document_version_ids,
    created_at, updated_at, assignment_group_id, assigned_to_user_id, itsm_state,
    priority, statutory_deadline, clock_status, clock_paused_reason, clock_paused_at,
    clock_total_paused_seconds, triaged_at, triaged_by_user_id, triage_notes,
    triaged_workstream_ids
  ) values
  ('PATH-DEMO-REQ-INTAKE', 'PATH-2026-DEMO-INTAKE', v_project_id::text, 'permit_authorization', 'Request a review path for a utility expansion', 'Demo request awaiting deliberate coordinator routing. No workstream is linked until the route is confirmed.', 'Identify the correct agencies and next step.', 'Launch Complex utility corridor', null, 'normal', 'LDEQ', v_title_v_permit_id, v_alex_id, 'Alex Martin', null, false, 'submitted', '[]'::jsonb, '2026-09-06T12:00:00Z', v_now, null, null, 'submitted', 'P3', null, 'active', null, null, 0, null, null, null, '[]'::jsonb),
  ('PATH-DEMO-REQ-ACTIVE', 'PATH-2026-DEMO-ACTIVE', v_project_id::text, 'government_help', 'Coordinate a utility interconnection review', 'Demo request linked to an active workstream with parallel technical steps.', 'Confirm the review owners and next handoff.', '230kV service corridor', '2026-10-05', 'important', 'DOTD', null, v_alex_id, 'Alex Martin', 'PATH-DEMO-WS-UTILITY', true, 'in_progress', '[]'::jsonb, '2026-09-01T12:00:00Z', v_now, v_group_dotd, v_sam_id, 'triaged', 'P2', null, 'active', null, null, 0, '2026-09-02T12:00:00Z', v_sarah_id, 'Confirmed parallel DOTD review and utility workstream.', '["PATH-DEMO-WS-UTILITY"]'::jsonb),
  ('PATH-DEMO-REQ-RFI', 'PATH-2026-DEMO-RFI', v_project_id::text, 'project_question', 'Respond to an air-permit information request', 'Demo request waiting for an applicant response to an issued RFI.', 'Submit the requested control-technology memo.', 'Air permit package', null, 'important', 'LDEQ', v_title_v_permit_id, v_alex_id, 'Alex Martin', 'PATH-DEMO-WS-AIR', true, 'pending_customer', '[]'::jsonb, '2026-09-02T12:00:00Z', v_now, v_group_spaceport, v_maya_id, 'pending_customer', 'P1', '2026-10-15T00:00:00Z', 'paused', 'Waiting for applicant response', '2026-09-02T12:00:00Z', 432000, '2026-09-02T12:00:00Z', v_sarah_id, 'Routed to LDEQ and SpaceX response queue.', '["PATH-DEMO-WS-AIR"]'::jsonb),
  ('PATH-DEMO-REQ-COORD', 'PATH-2026-DEMO-COORD', v_project_id::text, 'blocker_coordination', 'Resolve a coastal concurrence dependency', 'Demo request whose agency response exists but whose dependency still needs an explicit clear action.', 'Review the response and record whether the dependency is resolved.', 'Coastal authorization area', null, 'critical', 'CPRA', null, v_alex_id, 'Alex Martin', 'PATH-DEMO-WS-COAST', true, 'blocked', '[]'::jsonb, '2026-08-29T12:00:00Z', v_now, v_group_path, v_sarah_id, 'blocked', 'P1', '2026-10-20T00:00:00Z', 'paused', 'Dependency clearance pending', '2026-09-05T12:00:00Z', 172800, '2026-08-30T12:00:00Z', v_sarah_id, 'Routed to the project delivery office for cross-agency coordination.', '["PATH-DEMO-WS-COAST"]'::jsonb),
  ('PATH-DEMO-REQ-COMPLETE', 'PATH-2026-DEMO-COMPLETE', v_project_id::text, 'permit_authorization', 'Completed drainage authorization request', 'Demo request with a completed workstream and preserved completion history.', 'Retain the closeout record.', 'Drainage authorization area', '2026-08-25', 'normal', 'LDEQ', null, v_alex_id, 'Alex Martin', 'PATH-DEMO-WS-COMPLETE', false, 'resolved', v_attachment_ids, '2026-08-10T12:00:00Z', v_now, v_group_ldeq, v_jordan_id, 'resolved', 'P3', null, 'stopped', null, null, 0, '2026-08-11T12:00:00Z', v_sarah_id, 'Completed demo route.', '["PATH-DEMO-WS-COMPLETE"]'::jsonb)
  on conflict (id) do update set
    confirmation_number = excluded.confirmation_number, project_id = excluded.project_id, request_type = excluded.request_type,
    title = excluded.title, description = excluded.description, requested_outcome = excluded.requested_outcome,
    location_or_affected_area = excluded.location_or_affected_area, desired_date = excluded.desired_date,
    schedule_importance = excluded.schedule_importance, known_agency_code = excluded.known_agency_code,
    known_permit_type_id = excluded.known_permit_type_id, submitted_by_user_id = excluded.submitted_by_user_id,
    submitted_by_name = excluded.submitted_by_name, related_workstream_id = excluded.related_workstream_id,
    blocks_active_work = excluded.blocks_active_work, status = excluded.status,
    attachment_document_version_ids = excluded.attachment_document_version_ids, updated_at = excluded.updated_at,
    assignment_group_id = excluded.assignment_group_id, assigned_to_user_id = excluded.assigned_to_user_id,
    itsm_state = excluded.itsm_state, priority = excluded.priority, statutory_deadline = excluded.statutory_deadline,
    clock_status = excluded.clock_status, clock_paused_reason = excluded.clock_paused_reason, clock_paused_at = excluded.clock_paused_at,
    clock_total_paused_seconds = excluded.clock_total_paused_seconds, triaged_at = excluded.triaged_at,
    triaged_by_user_id = excluded.triaged_by_user_id, triage_notes = excluded.triage_notes, triaged_workstream_ids = excluded.triaged_workstream_ids;

  insert into public.rfis (
    id, code, workstream_id, workstream_title, requesting_org_id, requesting_org_code,
    recipient_org_id, recipient_org_code, title, question_text, technical_reason,
    required_document_types, issued_date, response_deadline, clock_impact,
    schedule_impact_days, status, is_consolidated_cycle, consolidated_batch_id,
    lead_reviewer_approved_at, created_at
  ) values
  ('PATH-DEMO-RFI-WAITING', 'PATH-DEMO-RFI-WAITING', 'PATH-DEMO-WS-AIR', 'Demo — Air permit response and technical review', v_ldeq_id::text, 'LDEQ', v_spaceport_id::text, 'SPACEPORT', 'Confirm control-technology assumptions', 'Please confirm the control-technology assumptions used in the revised emissions inventory.', 'The reviewer needs the assumptions before the technical review can resume.', '["control technology memo","revised emissions inventory"]'::jsonb, '2026-09-02', '2026-09-18', 'pauses_clock', 10, 'issued', false, null, null, '2026-09-02T12:00:00Z'),
  ('PATH-DEMO-RFI-REVIEW', 'PATH-DEMO-RFI-REVIEW', 'PATH-DEMO-WS-UTILITY', 'Demo — Utility interconnection parallel review', v_dotd_id::text, 'DOTD', v_spaceport_id::text, 'SPACEPORT', 'Review the submitted utility note', 'Please review the submitted utility concurrency note and confirm whether the assumptions are acceptable.', 'The reviewer must accept or clarify the submitted response.', '["utility concurrency note"]'::jsonb, '2026-09-03', '2026-09-17', 'pauses_clock', 0, 'submitted_by_applicant', false, null, null, '2026-09-03T12:00:00Z'),
  ('PATH-DEMO-RFI-ACCEPTED', 'PATH-DEMO-RFI-ACCEPTED', 'PATH-DEMO-WS-COMPLETE', 'Demo — Completed drainage authorization', v_ldeq_id::text, 'LDEQ', v_spaceport_id::text, 'SPACEPORT', 'Accept the closeout response', 'Confirm that the closeout response is complete for the archived drainage authorization.', 'The reviewer accepted the final response for the completed scenario.', '["closeout record"]'::jsonb, '2026-08-18', '2026-08-22', 'none', 0, 'accepted', false, null, '2026-08-23T12:00:00Z', '2026-08-18T12:00:00Z')
  on conflict (id) do update set
    code = excluded.code, workstream_id = excluded.workstream_id, workstream_title = excluded.workstream_title,
    requesting_org_id = excluded.requesting_org_id, requesting_org_code = excluded.requesting_org_code,
    recipient_org_id = excluded.recipient_org_id, recipient_org_code = excluded.recipient_org_code,
    title = excluded.title, question_text = excluded.question_text, technical_reason = excluded.technical_reason,
    required_document_types = excluded.required_document_types, issued_date = excluded.issued_date,
    response_deadline = excluded.response_deadline, clock_impact = excluded.clock_impact,
    schedule_impact_days = excluded.schedule_impact_days, status = excluded.status,
    is_consolidated_cycle = excluded.is_consolidated_cycle, consolidated_batch_id = excluded.consolidated_batch_id,
    lead_reviewer_approved_at = excluded.lead_reviewer_approved_at;

  insert into public.rfi_responses (
    id, rfi_id, submitted_by_user_name, response_text, attached_document_version_ids,
    submitted_date, review_status, reviewer_feedback, created_at, submitted_by_user_id
  ) values
  ('PATH-DEMO-RFI-RESPONSE-REVIEW', 'PATH-DEMO-RFI-REVIEW', 'Alex Martin', 'The utility concurrency note is attached for reviewer confirmation.', v_attachment_ids, '2026-09-04', 'under_review', null, '2026-09-04T12:00:00Z', v_alex_id),
  ('PATH-DEMO-RFI-RESPONSE-ACCEPTED', 'PATH-DEMO-RFI-ACCEPTED', 'Maya Chen', 'The closeout record confirms the completed authorization conditions.', v_attachment_ids, '2026-08-22', 'accepted', 'Accepted for the demo closeout path.', '2026-08-22T12:00:00Z', v_maya_id)
  on conflict (id) do update set
    rfi_id = excluded.rfi_id, submitted_by_user_name = excluded.submitted_by_user_name,
    response_text = excluded.response_text, attached_document_version_ids = excluded.attached_document_version_ids,
    submitted_date = excluded.submitted_date, review_status = excluded.review_status,
    reviewer_feedback = excluded.reviewer_feedback, submitted_by_user_id = excluded.submitted_by_user_id;

  insert into public.coordination_requests (
    id, code, workstream_id, workstream_title, requesting_org_id, requesting_org_code,
    target_org_id, target_org_code, requesting_user_name, assigned_to_user_name,
    title, need_description, requested_date, due_date, response_date, concurred_at,
    attached_document_version_ids, blocks_workstream_title, priority, status,
    response_summary, created_at
  ) values
  ('PATH-DEMO-COORD-WAITING', 'PATH-DEMO-COORD-WAITING', 'PATH-DEMO-WS-UTILITY', 'Demo — Utility interconnection parallel review', v_path_id::text, 'LA-PROJECTS', v_dotd_id::text, 'DOTD', 'Sarah Johnson', null, 'Confirm transportation concurrency assumptions', 'The project office needs the receiving team to confirm the assumptions used in the parallel review.', '2026-09-03', '2026-09-12', null, null, '[]'::jsonb, 'Demo — Utility interconnection parallel review', 'normal', 'pending', null, '2026-09-03T12:00:00Z'),
  ('PATH-DEMO-COORD-RESPONDED', 'PATH-DEMO-COORD-RESPONDED', 'PATH-DEMO-WS-COAST', 'Demo — Coastal concurrence and dependency clearance', v_path_id::text, 'LA-PROJECTS', v_cpra_id::text, 'CPRA', 'Sarah Johnson', null, 'Confirm coastal concurrence conditions', 'Confirm whether the coastal conditions can be accepted for the next handoff.', '2026-09-01', '2026-09-05', '2026-09-05', null, v_attachment_ids, 'Demo — Coastal concurrence and dependency clearance', 'high', 'objection_raised', 'Response recorded: CPRA requested one additional condition review. The originating work remains blocked until the dependency is explicitly cleared.', '2026-09-01T12:00:00Z'),
  ('PATH-DEMO-COORD-RESOLVED', 'PATH-DEMO-COORD-RESOLVED', 'PATH-DEMO-WS-COMPLETE', 'Demo — Completed drainage authorization', v_path_id::text, 'LA-PROJECTS', v_ldeq_id::text, 'LDEQ', 'Sarah Johnson', 'Jordan Lee', 'Confirm drainage closeout', 'Confirm that the completed drainage authorization can move to archive.', '2026-08-23', '2026-08-25', '2026-08-25', '2026-08-25T12:00:00Z', v_attachment_ids, 'Demo — Completed drainage authorization', 'normal', 'concurred', 'Concurred and dependency resolved for the completed scenario.', '2026-08-23T12:00:00Z')
  on conflict (id) do update set
    code = excluded.code, workstream_id = excluded.workstream_id, workstream_title = excluded.workstream_title,
    requesting_org_id = excluded.requesting_org_id, requesting_org_code = excluded.requesting_org_code,
    target_org_id = excluded.target_org_id, target_org_code = excluded.target_org_code,
    requesting_user_name = excluded.requesting_user_name, assigned_to_user_name = excluded.assigned_to_user_name,
    title = excluded.title, need_description = excluded.need_description, requested_date = excluded.requested_date,
    due_date = excluded.due_date, response_date = excluded.response_date, concurred_at = excluded.concurred_at,
    attached_document_version_ids = excluded.attached_document_version_ids, blocks_workstream_title = excluded.blocks_workstream_title,
    priority = excluded.priority, status = excluded.status, response_summary = excluded.response_summary;

  insert into public.external_filings (
    id, project_id, workstream_id, permit_type_id, authority_organization_id,
    authority_organization_name, filing_method, official_portal_url,
    external_reference_number, external_record_url, external_status, submitted_at,
    submitted_by_user_id, last_status_verified_at, last_status_verified_by,
    authoritative_system_name, notes, receipt_document_version_ids, created_at, updated_at
  ) values (
    'PATH-DEMO-FILING-AIR', v_project_id::text, 'PATH-DEMO-WS-AIR', v_title_v_permit_id,
    v_ldeq_id::text, 'Louisiana Department of Environmental Quality', 'EXTERNAL_PORTAL', null,
    null, null, 'not_started', null, null, null, null, 'Not connected in demo',
    'No filing has been submitted. This row intentionally preserves an unsent, recoverable state.', '[]'::jsonb, '2026-09-02T12:00:00Z', v_now
  )
  on conflict (id) do update set
    project_id = excluded.project_id, workstream_id = excluded.workstream_id, permit_type_id = excluded.permit_type_id,
    authority_organization_id = excluded.authority_organization_id, authority_organization_name = excluded.authority_organization_name,
    filing_method = excluded.filing_method, official_portal_url = excluded.official_portal_url,
    external_reference_number = excluded.external_reference_number, external_record_url = excluded.external_record_url,
    external_status = excluded.external_status, submitted_at = excluded.submitted_at, submitted_by_user_id = excluded.submitted_by_user_id,
    last_status_verified_at = excluded.last_status_verified_at, last_status_verified_by = excluded.last_status_verified_by,
    authoritative_system_name = excluded.authoritative_system_name, notes = excluded.notes,
    receipt_document_version_ids = excluded.receipt_document_version_ids, updated_at = excluded.updated_at;

  insert into public.notifications (
    id, recipient_id, request_id, event_type, title, body, channel, delivery_status,
    dedupe_key, created_at, user_id, message, type, link_url, urgency, metadata,
    is_read, recipient_user_id, related_entity_id
  ) values
  (md5('PATH-DEMO:notification:rfi-waiting:maya')::uuid, v_maya_id, null, 'rfi_issued', 'Applicant response requested', 'PATH-DEMO-RFI-WAITING is waiting for the applicant response. No reviewer action is required until the response arrives.', 'in_app', 'pending', 'PATH-DEMO-SEED-2026-09-07:rfi-waiting:maya', '2026-09-02T12:05:00Z', v_maya_id::text, 'Applicant response requested for the demo air review.', 'rfi', '/work/workstream/PATH-DEMO-WS-AIR', 'high', jsonb_build_object('seedTag', 'PATH-DEMO-SEED-2026-09-07', 'scenario', 'rfi-waiting'), false, v_maya_id, 'PATH-DEMO-RFI-WAITING'),
  (md5('PATH-DEMO:notification:rfi-review:jordan')::uuid, v_jordan_id, null, 'rfi_response_submitted', 'RFI response waiting for review', 'PATH-DEMO-RFI-REVIEW has a submitted response waiting for reviewer acceptance or clarification.', 'in_app', 'pending', 'PATH-DEMO-SEED-2026-09-07:rfi-review:jordan', '2026-09-04T12:05:00Z', v_jordan_id::text, 'RFI response waiting for review.', 'rfi', '/work/workstream/PATH-DEMO-WS-UTILITY', 'normal', jsonb_build_object('seedTag', 'PATH-DEMO-SEED-2026-09-07', 'scenario', 'rfi-review'), false, v_jordan_id, 'PATH-DEMO-RFI-REVIEW'),
  (md5('PATH-DEMO:notification:coordination:sarah')::uuid, v_sarah_id, null, 'coordination_response_recorded', 'Coordination response needs a decision', 'PATH-DEMO-COORD-RESPONDED has a response, but the dependency remains blocked until it is explicitly cleared.', 'in_app', 'pending', 'PATH-DEMO-SEED-2026-09-07:coordination:sarah', '2026-09-05T12:05:00Z', v_sarah_id::text, 'Coordination response recorded; dependency still blocked.', 'coordination', '/work/workstream/PATH-DEMO-WS-COAST', 'high', jsonb_build_object('seedTag', 'PATH-DEMO-SEED-2026-09-07', 'scenario', 'coordination-responded'), false, v_sarah_id, 'PATH-DEMO-COORD-RESPONDED')
  on conflict (id) do update set
    recipient_id = excluded.recipient_id, event_type = excluded.event_type, title = excluded.title,
    body = excluded.body, channel = excluded.channel, delivery_status = excluded.delivery_status,
    dedupe_key = excluded.dedupe_key, user_id = excluded.user_id, message = excluded.message,
    type = excluded.type, link_url = excluded.link_url, urgency = excluded.urgency, metadata = excluded.metadata,
    is_read = excluded.is_read, recipient_user_id = excluded.recipient_user_id, related_entity_id = excluded.related_entity_id;

  insert into public.audit_events (
    id, actor_id, organization_id, action, resource_type, resource_id, before_data,
    after_data, correlation_id, created_at, actor_name, actor_org_name,
    entity_type, entity_id, action_type, old_value, new_value, reason,
    project_id, occurred_at
  ) values
  (md5('PATH-DEMO:audit:request-intake')::uuid, v_alex_id, v_spaceport_id, 'seeded_demo_scenario', 'customer_request', null, null, jsonb_build_object('seedTag', 'PATH-DEMO-SEED-2026-09-07', 'state', 'submitted', 'confirmationNumber', 'PATH-2026-DEMO-INTAKE'), md5('PATH-DEMO:correlation:request-intake')::uuid, '2026-09-06T12:00:00Z', 'Alex Martin', 'Space Exploration Technologies Corp.', 'customer_request', 'PATH-DEMO-REQ-INTAKE', 'demo_seeded', null, 'submitted', 'Tagged request intentionally remains unlinked until routing confirmation.', v_project_id::text, '2026-09-06T12:00:00Z'),
  (md5('PATH-DEMO:audit:triage-active')::uuid, v_sarah_id, v_path_id, 'seeded_demo_scenario', 'customer_request', null, jsonb_build_object('status', 'submitted'), jsonb_build_object('seedTag', 'PATH-DEMO-SEED-2026-09-07', 'status', 'in_progress', 'workstreams', jsonb_build_array('PATH-DEMO-WS-UTILITY')), md5('PATH-DEMO:correlation:triage-active')::uuid, '2026-09-02T12:00:00Z', 'Sarah Johnson', 'Louisiana Economic Development Space Coordination', 'customer_request', 'PATH-DEMO-REQ-ACTIVE', 'demo_seeded', 'submitted', 'in_progress', 'Tagged request demonstrates confirmed routing and assignment.', v_project_id::text, '2026-09-02T12:00:00Z'),
  (md5('PATH-DEMO:audit:rfi-response')::uuid, v_alex_id, v_spaceport_id, 'seeded_demo_scenario', 'rfi_response', null, null, jsonb_build_object('seedTag', 'PATH-DEMO-SEED-2026-09-07', 'reviewStatus', 'under_review', 'attachedDocumentVersionIds', v_attachment_ids), md5('PATH-DEMO:correlation:rfi-response')::uuid, '2026-09-04T12:00:00Z', 'Alex Martin', 'Space Exploration Technologies Corp.', 'rfi_response', 'PATH-DEMO-RFI-RESPONSE-REVIEW', 'demo_seeded', null, 'under_review', case when v_attachment_id is null then 'Tagged response is attachment-ready; no non-empty demo document version was found.' else 'Tagged response references an existing non-empty immutable document version.' end, v_project_id::text, '2026-09-04T12:00:00Z'),
  (md5('PATH-DEMO:audit:coordination-response')::uuid, v_sarah_id, v_path_id, 'seeded_demo_scenario', 'coordination_request', null, jsonb_build_object('status', 'pending'), jsonb_build_object('seedTag', 'PATH-DEMO-SEED-2026-09-07', 'status', 'objection_raised', 'dependencyResolved', false), md5('PATH-DEMO:correlation:coordination-response')::uuid, '2026-09-05T12:00:00Z', 'Sarah Johnson', 'Louisiana Economic Development Space Coordination', 'coordination_request', 'PATH-DEMO-COORD-RESPONDED', 'demo_seeded', 'pending', 'objection_raised', 'Response and dependency clearance remain separate demo states.', v_project_id::text, '2026-09-05T12:00:00Z')
  on conflict (id) do update set
    actor_id = excluded.actor_id, organization_id = excluded.organization_id, action = excluded.action,
    resource_type = excluded.resource_type, before_data = excluded.before_data, after_data = excluded.after_data,
    correlation_id = excluded.correlation_id, actor_name = excluded.actor_name, actor_org_name = excluded.actor_org_name,
    entity_type = excluded.entity_type, entity_id = excluded.entity_id, action_type = excluded.action_type,
    old_value = excluded.old_value, new_value = excluded.new_value, reason = excluded.reason,
    project_id = excluded.project_id, occurred_at = excluded.occurred_at;
end $$;
