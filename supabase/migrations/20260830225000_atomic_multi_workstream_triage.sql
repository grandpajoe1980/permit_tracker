-- Wave 4 follow-up: multi-agency triage must be atomic. A request that fans
-- out to several workstreams cannot be left half-triaged if one branch fails.

create or replace function public.rpc_triage_customer_request(
  p_request_id text,
  p_workstreams jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_request public.customer_requests%rowtype;
  v_project_id uuid;
  v_item jsonb;
  v_version_id text;
  v_workstream public.workstreams%rowtype;
  v_stage_id text;
  v_stage_label text;
  v_first_workstream_id text;
  v_created_ids jsonb := '[]'::jsonb;
  v_created_codes jsonb := '[]'::jsonb;
  v_now timestamptz := now();
begin
  if jsonb_typeof(p_workstreams) <> 'array' or jsonb_array_length(p_workstreams) < 1 or jsonb_array_length(p_workstreams) > 8 then
    raise exception 'triage requires between one and eight workstream definitions';
  end if;

  select * into v_request from public.customer_requests where id = p_request_id for update;
  if not found then raise exception 'customer request not found: %', p_request_id; end if;
  if v_request.status = 'draft' then raise exception 'draft customer requests cannot be triaged'; end if;
  if v_request.triaged_at is not null then raise exception 'customer request has already been triaged'; end if;
  v_project_id := app_private.require_project_admin(v_request.project_id);

  for v_item in select value from jsonb_array_elements(p_workstreams) loop
    if nullif(trim(v_item->>'code'), '') is null or nullif(trim(v_item->>'title'), '') is null then
      raise exception 'each triage workstream requires a code and title';
    end if;

    v_version_id := nullif(trim(v_item->>'workflowVersionId'), '');
    if v_version_id is null then
      select id into v_version_id from public.workflow_versions
      where is_active = true and lifecycle_status = 'published'
      order by version_number desc limit 1;
    elsif not exists (
      select 1 from public.workflow_versions
      where id = v_version_id and lifecycle_status = 'published'
    ) then
      raise exception 'workflow version is not published: %', v_version_id;
    end if;

    v_stage_id := null;
    v_stage_label := null;
    if v_version_id is not null then
      select id::text, label into v_stage_id, v_stage_label from public.workflow_version_stages
      where workflow_version_id = v_version_id order by sequence_order limit 1;
    end if;
    if v_stage_id is null then
      select s.id::text, s.label into v_stage_id, v_stage_label
      from public.workflow_stages s order by s.sort_order limit 1;
    end if;

    insert into public.workstreams (
      id, project_id, code, title, category, permit_type_id, workflow_version_id,
      current_stage_id, current_stage_name, operational_state, operational_state_label,
      rag_status, rag_label, baseline_target_date, forecast_target_date,
      current_stage_started_at, state_concierge, regulatory_lead, six_questions,
      customer_request_id, created_at, updated_at
    ) values (
      'ws-' || replace(gen_random_uuid()::text, '-', ''), v_project_id,
      upper(trim(v_item->>'code')), trim(v_item->>'title'),
      coalesce(nullif(trim(v_item->>'category'), ''), v_request.request_type),
      nullif(trim(v_item->>'permitTypeId'), ''), v_version_id,
      v_stage_id, coalesce(v_stage_label, 'Request intake'), 'running', 'Running (Request intake)',
      'green', 'On Track', current_date + 30, current_date + 30, v_now,
      jsonb_build_object('name', 'State Project Concierge', 'title', 'Project Manager', 'agency', coalesce(nullif(trim(v_item->>'leadOrgName'), ''), 'Louisiana Governor''s Office of Major Projects & Delivery')),
      jsonb_build_object('orgCode', coalesce(nullif(trim(v_item->>'leadOrgCode'), ''), 'STATEPO'), 'orgName', coalesce(nullif(trim(v_item->>'leadOrgName'), ''), 'Louisiana Governor''s Office of Major Projects & Delivery')),
      '{}', v_request.id, v_now, v_now
    ) returning * into v_workstream;

    v_first_workstream_id := coalesce(v_first_workstream_id, v_workstream.id);
    v_created_ids := v_created_ids || jsonb_build_array(v_workstream.id);
    v_created_codes := v_created_codes || jsonb_build_array(v_workstream.code);
  end loop;

  update public.customer_requests set
    status = 'in_progress',
    related_workstream_id = coalesce(related_workstream_id, v_first_workstream_id),
    triaged_at = v_now,
    triaged_by_user_id = auth.uid(),
    triaged_workstream_ids = v_created_ids,
    updated_at = v_now
  where id = v_request.id;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    action_type, old_value, new_value, project_id, created_at
  ) values (
    auth.uid(), 'customer_request_triaged', 'customer_request', 'customer_request',
    v_request.id, coalesce((select full_name from public.profiles where id = auth.uid()), 'PATH administrator'),
    'customer_request_triaged', v_request.status, v_created_codes::text, v_project_id::text, v_now
  );

  return jsonb_build_object(
    'requestId', v_request.id,
    'workstreamIds', v_created_ids,
    'workstreamCodes', v_created_codes
  );
end;
$$;

revoke execute on function public.rpc_triage_customer_request(text, jsonb) from public, anon;
grant execute on function public.rpc_triage_customer_request(text, jsonb) to authenticated;
