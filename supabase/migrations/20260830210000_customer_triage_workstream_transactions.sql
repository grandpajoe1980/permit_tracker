-- Wave 4: customer request triage and workstream creation are one audited
-- server-side transaction. A customer request never becomes a workstream by
-- changing a browser-side status string.

alter table public.customer_requests
  add column if not exists triaged_at timestamptz,
  add column if not exists triaged_by_user_id uuid references auth.users(id),
  add column if not exists triage_notes text,
  add column if not exists triaged_workstream_ids jsonb not null default '[]'::jsonb;

alter table public.workstreams
  add column if not exists customer_request_id text;
create index if not exists idx_workstreams_customer_request on public.workstreams (customer_request_id);

create or replace function app_private.require_project_admin(p_project_ref text)
returns uuid
language plpgsql security definer
set search_path = public, app_private
as $$
declare v_project_id uuid;
begin
  if auth.uid() is null or not (select app_private.is_system_admin()) then
    raise exception 'project administrator capability required';
  end if;
  select p.id into v_project_id from public.projects p
  where p.id::text = p_project_ref or p.number = p_project_ref limit 1;
  if v_project_id is null then raise exception 'project not found: %', p_project_ref; end if;
  if not (select app_private.has_project_access(v_project_id)) then
    raise exception 'authenticated user cannot access project %', p_project_ref;
  end if;
  return v_project_id;
end;
$$;

create or replace function public.rpc_create_workstream_from_request(
  p_request_id text,
  p_code text,
  p_title text,
  p_category text,
  p_permit_type_id text default null,
  p_lead_org_code text default 'STATEPO',
  p_lead_org_name text default 'Louisiana Governor''s Office of Major Projects & Delivery',
  p_workflow_version_id text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare
  v_request public.customer_requests%rowtype;
  v_project_id uuid;
  v_version_id text;
  v_stage record;
  v_workstream public.workstreams%rowtype;
  v_now timestamptz := now();
begin
  select * into v_request from public.customer_requests where id = p_request_id for update;
  if not found then raise exception 'customer request not found: %', p_request_id; end if;
  v_project_id := app_private.require_project_admin(v_request.project_id);
  if v_request.status = 'draft' then raise exception 'draft customer requests cannot be triaged'; end if;

  if p_workflow_version_id is null then
    select id into v_version_id from public.workflow_versions
    where is_active = true and lifecycle_status = 'published'
    order by version_number desc limit 1;
  else
    v_version_id := p_workflow_version_id;
  end if;
  if v_version_id is not null and not exists (
    select 1 from public.workflow_versions where id = v_version_id and lifecycle_status = 'published'
  ) then raise exception 'workflow version is not published: %', v_version_id; end if;

  if v_version_id is not null then
    select * into v_stage from public.workflow_version_stages
    where workflow_version_id = v_version_id order by sequence_order limit 1;
  end if;
  if v_stage is null then
    select s.* into v_stage from public.workflow_stages s order by s.sort_order limit 1;
  end if;

  insert into public.workstreams (
    id, project_id, code, title, category, permit_type_id, workflow_version_id,
    current_stage_id, current_stage_name, operational_state, operational_state_label,
    rag_status, rag_label, baseline_target_date, forecast_target_date,
    current_stage_started_at, state_concierge, regulatory_lead, six_questions,
    customer_request_id, created_at, updated_at
  ) values (
    'ws-' || replace(gen_random_uuid()::text, '-', ''), v_project_id, p_code,
    p_title, p_category, p_permit_type_id, v_version_id,
    case when v_stage is null then null else v_stage.id::text end,
    coalesce(v_stage.label, 'Request intake'), 'running', 'Running (Request intake)',
    'green', 'On Track', current_date + 30, current_date + 30, v_now,
    jsonb_build_object('name', 'State Project Concierge', 'title', 'Project Manager', 'agency', p_lead_org_name),
    jsonb_build_object('orgCode', p_lead_org_code, 'orgName', p_lead_org_name), '{}',
    v_request.id, v_now, v_now
  ) returning * into v_workstream;

  update public.customer_requests set
    status = 'in_progress', related_workstream_id = coalesce(v_request.related_workstream_id, v_workstream.id),
    triaged_at = v_now, triaged_by_user_id = auth.uid(),
    triaged_workstream_ids = coalesce(v_request.triaged_workstream_ids, '[]'::jsonb) || jsonb_build_array(v_workstream.id), updated_at = v_now
  where id = v_request.id;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    action_type, old_value, new_value, project_id, created_at
  ) values (
    auth.uid(), 'customer_request_triaged', 'customer_request', 'customer_request',
    v_request.id, coalesce((select full_name from public.profiles where id = auth.uid()), 'PATH administrator'),
    'customer_request_triaged', v_request.status, v_workstream.code, v_project_id::text, v_now
  );

  return jsonb_build_object('requestId', v_request.id, 'workstreamId', v_workstream.id, 'workstreamCode', v_workstream.code, 'workflowVersionId', v_version_id);
end;
$$;

revoke execute on function public.rpc_create_workstream_from_request(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.rpc_create_workstream_from_request(text, text, text, text, text, text, text, text) to authenticated;
