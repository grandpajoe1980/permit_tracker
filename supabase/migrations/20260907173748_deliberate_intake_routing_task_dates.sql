-- S2: make intake routing an explicit, persisted decision.
--
-- The browser may propose rows, but the database is the authority for:
--   * active agencies and assignment groups;
--   * eligible group members;
--   * published workflow versions;
--   * intentional target dates; and
--   * duplicate-safe confirmation, clarification, and existing-work links.

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
  v_group public.assignment_groups%rowtype;
  v_stage_id text;
  v_stage_label text;
  v_stage_duration integer;
  v_first_workstream_id text;
  v_first_group_id uuid;
  v_first_assigned_user_id uuid;
  v_group_id uuid;
  v_assigned_user_id uuid;
  v_target_date date;
  v_code text;
  v_actor_name text;
  v_user_id uuid;
  v_created_ids jsonb := '[]'::jsonb;
  v_created_codes jsonb := '[]'::jsonb;
  v_routing_summary jsonb := '[]'::jsonb;
  v_now timestamptz := now();
begin
  if jsonb_typeof(p_workstreams) <> 'array' or jsonb_array_length(p_workstreams) < 1 or jsonb_array_length(p_workstreams) > 8 then
    raise exception 'triage requires between one and eight workstream definitions';
  end if;

  select * into v_request
  from public.customer_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'customer request not found: %', p_request_id; end if;

  -- A lost response followed by a retry returns the original result instead
  -- of creating a second fan-out. A different decision must use a new request.
  if v_request.triaged_at is not null then
    select coalesce(jsonb_agg(workstream.code order by workstream.code), '[]'::jsonb)
      into v_created_codes
    from public.workstreams workstream
    where workstream.id in (
      select jsonb_array_elements_text(coalesce(v_request.triaged_workstream_ids, '[]'::jsonb))
    );
    return jsonb_build_object(
      'requestId', v_request.id,
      'workstreamIds', coalesce(v_request.triaged_workstream_ids, '[]'::jsonb),
      'workstreamCodes', v_created_codes,
      'idempotent', true
    );
  end if;

  if v_request.status not in ('submitted', 'triage') then
    raise exception 'customer request is not ready for routing: %', v_request.status;
  end if;
  v_project_id := app_private.require_project_admin(v_request.project_id);

  if exists (
    select 1
    from (
      select upper(trim(value->>'code')) as code
      from jsonb_array_elements(p_workstreams)
    ) codes
    group by code
    having count(*) > 1
  ) then
    raise exception 'workstream codes must be unique within one routing decision';
  end if;

  v_actor_name := coalesce((select full_name from public.profiles where id = auth.uid()), 'PATH administrator');

  for v_item in select value from jsonb_array_elements(p_workstreams) loop
    v_code := upper(trim(v_item->>'code'));
    if v_code !~ '^[A-Z0-9][A-Z0-9_-]{2,63}$' then
      raise exception 'invalid workstream code: %', v_code;
    end if;
    if nullif(trim(v_item->>'title'), '') is null then
      raise exception 'each triage workstream requires a title';
    end if;
    if nullif(trim(v_item->>'leadOrgCode'), '') is null then
      raise exception 'each triage workstream requires an agency';
    end if;
    if nullif(trim(v_item->>'assignmentGroupId'), '') is null then
      raise exception 'each triage workstream requires an assignment group';
    end if;
    if nullif(trim(v_item->>'workflowVersionId'), '') is null then
      raise exception 'each triage workstream requires a published workflow version';
    end if;
    if nullif(trim(v_item->>'targetDate'), '') is null or (v_item->>'targetDate') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'each triage workstream requires a valid target date';
    end if;
    v_target_date := (v_item->>'targetDate')::date;

    begin
      v_group_id := (v_item->>'assignmentGroupId')::uuid;
    exception when invalid_text_representation then
      raise exception 'assignment group is not a valid persisted ID';
    end;
    select * into v_group
    from public.assignment_groups
    where id = v_group_id and active;
    if not found then raise exception 'active assignment group not found: %', v_item->>'assignmentGroupId'; end if;
    if upper(v_group.org_code) <> upper(trim(v_item->>'leadOrgCode')) then
      raise exception 'assignment group % does not belong to agency %', v_group.name, v_item->>'leadOrgCode';
    end if;

    v_assigned_user_id := null;
    if nullif(trim(v_item->>'assignedToUserId'), '') is not null then
      begin
        v_assigned_user_id := (v_item->>'assignedToUserId')::uuid;
      exception when invalid_text_representation then
        raise exception 'assigned person is not a valid persisted ID';
      end;
      if not exists (
        select 1
        from public.assignment_group_memberships membership
        join auth.users member_user on member_user.id = membership.user_id
        where membership.assignment_group_id = v_group.id
          and membership.user_id = v_assigned_user_id
      ) then
        raise exception 'assigned person is not an eligible member of the selected team';
      end if;
    end if;

    v_version_id := nullif(trim(v_item->>'workflowVersionId'), '');
    if not exists (
      select 1 from public.workflow_versions
      where id = v_version_id and lifecycle_status = 'published'
    ) then
      raise exception 'workflow version is not published: %', v_version_id;
    end if;

    v_stage_id := null;
    v_stage_label := null;
    v_stage_duration := 1;
    select id::text, label, greatest(coalesce(target_duration_days, 1), 1)
      into v_stage_id, v_stage_label, v_stage_duration
    from public.workflow_version_stages
    where workflow_version_id = v_version_id
    order by sequence_order
    limit 1;
    if v_stage_id is null then
      select s.id::text, s.label, greatest(coalesce(s.service_target_days, 1), 1)
        into v_stage_id, v_stage_label, v_stage_duration
      from public.workflow_stages s
      order by s.sort_order
      limit 1;
    end if;

    insert into public.workstreams (
      id, project_id, code, title, category, permit_type_id, workflow_version_id,
      current_stage_id, current_stage_name, operational_state, operational_state_label,
      rag_status, rag_label, baseline_target_date, forecast_target_date,
      current_stage_started_at, state_concierge, regulatory_lead, six_questions,
      customer_request_id, assignment_group_id, assigned_to_user_id, assigned_org_code,
      itsm_state, created_at, updated_at
    ) values (
      'ws-' || replace(gen_random_uuid()::text, '-', ''), v_project_id,
      v_code, trim(v_item->>'title'),
      coalesce(nullif(trim(v_item->>'category'), ''), v_request.request_type),
      nullif(trim(v_item->>'permitTypeId'), ''), v_version_id,
      v_stage_id, coalesce(v_stage_label, 'Request intake'), 'running', 'Running (Request intake)',
      'green', 'On Track', v_target_date, v_target_date, v_now,
      jsonb_build_object('name', 'State Project Concierge', 'title', 'Project Manager', 'agency', v_group.name),
      jsonb_build_object('orgCode', v_group.org_code, 'orgName', coalesce(nullif(trim(v_item->>'leadOrgName'), ''), v_group.name)),
      '{}', v_request.id, v_group.id, v_assigned_user_id, v_group.org_code,
      'in_progress', v_now, v_now
    ) returning * into v_workstream;

    insert into public.tasks (
      id, workstream_id, task_code, title, duration_days,
      early_start, early_finish, late_start, late_finish,
      is_critical_path, status, predecessors, assignment_group_id,
      assigned_to_user_id, assigned_org_code, itsm_state
    ) values (
      'task-' || replace(gen_random_uuid()::text, '-', ''), v_workstream.id,
      v_group.org_code || '-INTAKE-' || v_code,
      coalesce(v_stage_label, 'Request intake') || ' — ' || trim(v_item->>'title'),
      v_stage_duration, current_date, v_target_date, current_date, v_target_date,
      true, 'in_progress', '[]'::jsonb, v_group.id, v_assigned_user_id, v_group.org_code,
      'in_progress'
    );

    v_first_workstream_id := coalesce(v_first_workstream_id, v_workstream.id);
    v_first_group_id := coalesce(v_first_group_id, v_group.id);
    v_first_assigned_user_id := coalesce(v_first_assigned_user_id, v_assigned_user_id);
    v_created_ids := v_created_ids || jsonb_build_array(v_workstream.id);
    v_created_codes := v_created_codes || jsonb_build_array(v_workstream.code);
    v_routing_summary := v_routing_summary || jsonb_build_array(jsonb_build_object(
      'workstreamId', v_workstream.id,
      'workstreamCode', v_workstream.code,
      'agencyCode', v_group.org_code,
      'assignmentGroupId', v_group.id,
      'assignedToUserId', v_assigned_user_id,
      'workflowVersionId', v_version_id,
      'targetDate', v_target_date
    ));

    for v_user_id in
      select distinct membership.user_id
      from public.assignment_group_memberships membership
      where membership.assignment_group_id = v_group.id
        and (v_assigned_user_id is null or membership.user_id = v_assigned_user_id)
    loop
      insert into public.notifications (
        recipient_id, recipient_user_id, user_id, title, message, body,
        event_type, type, link_url, urgency, metadata, channel,
        delivery_status, is_read, dedupe_key, created_at
      ) values (
        v_user_id, v_user_id, v_user_id::text,
        v_workstream.code || ' routed for review',
        'A customer request was routed to your team.',
        v_workstream.title || ' · target date ' || v_target_date::text,
        'customer_request_routed', 'assignment', '/work/workflow/' || v_workstream.id,
        case when v_request.blocks_active_work then 'high' else 'normal' end,
        jsonb_build_object('requestId', v_request.id, 'workstreamId', v_workstream.id, 'assignmentGroupId', v_group.id, 'targetDate', v_target_date),
        'in_app', 'pending', false,
        'customer-request-routed:' || v_request.id || ':' || v_workstream.id || ':' || v_user_id::text,
        v_now
      ) on conflict (dedupe_key) do nothing;
    end loop;
  end loop;

  update public.customer_requests set
    status = 'in_progress',
    itsm_state = 'in_progress',
    related_workstream_id = coalesce(related_workstream_id, v_first_workstream_id),
    assignment_group_id = case when jsonb_array_length(v_created_ids) = 1 then v_first_group_id else null end,
    assigned_to_user_id = case when jsonb_array_length(v_created_ids) = 1 then v_first_assigned_user_id else null end,
    triaged_at = v_now,
    triaged_by_user_id = auth.uid(),
    triage_notes = 'Routing confirmed with persisted agency, team, workflow, and target date selections.',
    triaged_workstream_ids = v_created_ids,
    updated_at = v_now
  where id = v_request.id;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    action_type, old_value, new_value, reason, project_id, created_at
  ) values (
    auth.uid(), 'customer_request_triaged', 'customer_request', 'customer_request',
    v_request.id, v_actor_name, 'customer_request_triaged', v_request.status,
    v_routing_summary::text, 'Coordinator confirmed persisted intake routing.', v_project_id, v_now
  );

  return jsonb_build_object(
    'requestId', v_request.id,
    'workstreamIds', v_created_ids,
    'workstreamCodes', v_created_codes,
    'idempotent', false
  );
end;
$$;

create or replace function public.rpc_request_customer_intake_clarification(
  p_request_id text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_request public.customer_requests%rowtype;
  v_project_id uuid;
  v_actor_name text;
  v_now timestamptz := now();
begin
  if nullif(trim(p_notes), '') is null or length(trim(p_notes)) < 8 then
    raise exception 'clarification notes must explain what is missing';
  end if;
  select * into v_request from public.customer_requests where id = p_request_id for update;
  if not found then raise exception 'customer request not found: %', p_request_id; end if;
  v_project_id := app_private.require_project_admin(v_request.project_id);
  if v_request.triaged_at is not null then return to_jsonb(v_request); end if;
  v_actor_name := coalesce((select full_name from public.profiles where id = auth.uid()), 'PATH administrator');

  update public.customer_requests set
    status = 'pending_customer', itsm_state = 'pending_customer', triage_notes = trim(p_notes),
    triaged_by_user_id = auth.uid(), updated_at = v_now
  where id = v_request.id
  returning * into v_request;

  insert into public.audit_events (actor_id, action, resource_type, entity_type, entity_id, actor_name, action_type, old_value, new_value, reason, project_id, created_at)
  values (auth.uid(), 'customer_intake_clarification_requested', 'customer_request', 'customer_request', v_request.id, v_actor_name, 'customer_intake_clarification_requested', 'submitted', 'pending_customer', trim(p_notes), v_project_id, v_now);

  if v_request.submitted_by_user_id is not null then
    insert into public.notifications (recipient_id, recipient_user_id, user_id, title, message, body, event_type, type, link_url, urgency, metadata, channel, delivery_status, is_read, dedupe_key, created_at)
    values (v_request.submitted_by_user_id, v_request.submitted_by_user_id, v_request.submitted_by_user_id::text, 'Clarification needed for ' || v_request.confirmation_number, 'The project office needs more information before routing this request.', trim(p_notes), 'customer_intake_clarification', 'action_required', '/requests/' || v_request.confirmation_number, 'high', jsonb_build_object('requestId', v_request.id), 'in_app', 'pending', false, 'customer-intake-clarification:' || v_request.id, v_now)
    on conflict (dedupe_key) do nothing;
  end if;
  return to_jsonb(v_request);
end;
$$;

create or replace function public.rpc_link_customer_request_workstream(
  p_request_id text,
  p_workstream_id text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_request public.customer_requests%rowtype;
  v_workstream public.workstreams%rowtype;
  v_project_id uuid;
  v_actor_name text;
  v_now timestamptz := now();
begin
  if nullif(trim(p_notes), '') is null or length(trim(p_notes)) < 8 then
    raise exception 'link notes must explain the relationship';
  end if;
  select * into v_request from public.customer_requests where id = p_request_id for update;
  if not found then raise exception 'customer request not found: %', p_request_id; end if;
  v_project_id := app_private.require_project_admin(v_request.project_id);
  select * into v_workstream from public.workstreams where id = p_workstream_id and project_id = v_project_id for update;
  if not found then raise exception 'existing workstream is not in the request project'; end if;
  if v_request.triaged_at is not null then
    if v_request.related_workstream_id = v_workstream.id then return to_jsonb(v_request); end if;
    raise exception 'customer request is already linked to work';
  end if;
  v_actor_name := coalesce((select full_name from public.profiles where id = auth.uid()), 'PATH administrator');

  update public.customer_requests set
    status = 'in_progress', itsm_state = 'in_progress', related_workstream_id = v_workstream.id,
    assignment_group_id = v_workstream.assignment_group_id, assigned_to_user_id = v_workstream.assigned_to_user_id,
    triaged_at = v_now, triaged_by_user_id = auth.uid(), triage_notes = trim(p_notes),
    triaged_workstream_ids = jsonb_build_array(v_workstream.id), updated_at = v_now
  where id = v_request.id
  returning * into v_request;

  insert into public.audit_events (actor_id, action, resource_type, entity_type, entity_id, actor_name, action_type, old_value, new_value, reason, project_id, created_at)
  values (auth.uid(), 'customer_request_linked_to_workstream', 'customer_request', 'customer_request', v_request.id, v_actor_name, 'customer_request_linked_to_workstream', 'submitted', v_workstream.code, trim(p_notes), v_project_id, v_now);

  if v_request.submitted_by_user_id is not null then
    insert into public.notifications (recipient_id, recipient_user_id, user_id, title, message, body, event_type, type, link_url, urgency, metadata, channel, delivery_status, is_read, dedupe_key, created_at)
    values (v_request.submitted_by_user_id, v_request.submitted_by_user_id, v_request.submitted_by_user_id::text, 'Request linked to existing work', v_request.confirmation_number || ' is now tracked with ' || v_workstream.code || '.', trim(p_notes), 'customer_request_linked', 'status_update', '/work/workflow/' || v_workstream.id, 'normal', jsonb_build_object('requestId', v_request.id, 'workstreamId', v_workstream.id), 'in_app', 'pending', false, 'customer-request-linked:' || v_request.id, v_now)
    on conflict (dedupe_key) do nothing;
  end if;
  return to_jsonb(v_request);
end;
$$;

revoke execute on function public.rpc_triage_customer_request(text, jsonb) from public, anon;
grant execute on function public.rpc_triage_customer_request(text, jsonb) to authenticated;
revoke execute on function public.rpc_request_customer_intake_clarification(text, text) from public, anon;
grant execute on function public.rpc_request_customer_intake_clarification(text, text) to authenticated;
revoke execute on function public.rpc_link_customer_request_workstream(text, text, text) from public, anon;
grant execute on function public.rpc_link_customer_request_workstream(text, text, text) to authenticated;
