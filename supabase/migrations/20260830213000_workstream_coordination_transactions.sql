-- Wave 5 support: blocker resolution and inter-agency coordination are
-- server-owned transactions. The browser cannot manufacture a successful
-- state transition by mutating its local projection first.

create or replace function public.rpc_clear_workstream_blocker(
  p_workstream_id text,
  p_resolution_notes text,
  p_actor_name text,
  p_actor_org_name text
)
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare
  v_workstream public.workstreams%rowtype;
  v_old_state text;
  v_old_reason text;
  v_now timestamptz := now();
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into v_workstream
  from public.workstreams
  where id = p_workstream_id or code = p_workstream_id
  for update;
  if not found then raise exception 'workstream not found: %', p_workstream_id; end if;
  if v_workstream.project_id is null or not (select app_private.has_project_access(v_workstream.project_id)) then
    raise exception 'authenticated user cannot access workstream %', p_workstream_id;
  end if;
  v_old_state := v_workstream.operational_state;
  v_old_reason := v_workstream.waiting_reason;

  update public.workstreams set
    operational_state = 'running',
    operational_state_label = coalesce(nullif('Running (' || current_stage_name || ')', 'Running ()'), 'Running'),
    waiting_reason = null,
    waiting_on_entity = null,
    updated_at = v_now
  where id = v_workstream.id;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason, project_id, created_at
  ) values (
    auth.uid(), 'workstream_resumed', 'workstream', 'workstream', v_workstream.code,
    p_actor_name, p_actor_org_name, 'resumed', v_old_state, 'running',
    coalesce(nullif(trim(p_resolution_notes), ''), 'Blocker cleared; review clock resumed.') ||
      case when v_old_reason is not null then ' Previous blocker: ' || v_old_reason else '' end,
    v_workstream.project_id::text, v_now
  );

  insert into public.notifications (
    recipient_id, user_id, title, message, body, event_type, type, link_url,
    urgency, metadata, channel, delivery_status, is_read, created_at
  ) values (
    auth.uid(), auth.uid()::text, v_workstream.title || ' resumed',
    'The blocker was cleared and work is running again.',
    'The blocker was cleared and work is running again.', 'status_update', 'status_update',
    '/workstreams/' || v_workstream.code, 'info',
    jsonb_build_object('workstreamCode', v_workstream.code), 'in_app', 'pending', false, v_now
  );
  return jsonb_build_object('success', true, 'workstreamId', v_workstream.id);
end;
$$;

create or replace function public.rpc_create_coordination_request(
  p_id text,
  p_code text,
  p_workstream_id text,
  p_workstream_title text,
  p_requesting_org_id text,
  p_requesting_org_code text,
  p_target_org_id text,
  p_target_org_code text,
  p_requesting_user_name text,
  p_assigned_to_user_name text,
  p_title text,
  p_need_description text,
  p_due_date date,
  p_attached_document_version_ids jsonb,
  p_priority text
)
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare
  v_workstream public.workstreams%rowtype;
  v_request public.coordination_requests%rowtype;
  v_now timestamptz := now();
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into v_workstream
  from public.workstreams
  where id = p_workstream_id or code = p_workstream_id
  for share;
  if not found then raise exception 'workstream not found: %', p_workstream_id; end if;
  if v_workstream.project_id is null or not (select app_private.has_project_access(v_workstream.project_id)) then
    raise exception 'authenticated user cannot access workstream %', p_workstream_id;
  end if;

  insert into public.coordination_requests (
    id, code, workstream_id, workstream_title, requesting_org_id,
    requesting_org_code, target_org_id, target_org_code, requesting_user_name,
    assigned_to_user_name, title, need_description, requested_date, due_date,
    attached_document_version_ids, blocks_workstream_title, priority, status, created_at
  ) values (
    p_id, p_code, v_workstream.id, p_workstream_title, p_requesting_org_id,
    p_requesting_org_code, p_target_org_id, p_target_org_code, p_requesting_user_name,
    p_assigned_to_user_name, p_title, p_need_description, current_date, p_due_date,
    coalesce(p_attached_document_version_ids, '[]'::jsonb), p_workstream_title,
    coalesce(nullif(p_priority, ''), 'normal'), 'pending', v_now
  ) returning * into v_request;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, new_value, reason, project_id, created_at
  ) values (
    auth.uid(), 'coordination_request_created', 'coordination_request', 'coordination_request',
    v_request.code, p_requesting_user_name, p_requesting_org_code, 'created',
    'Created ' || v_request.code || ': ' || v_request.title || ' targeting ' || v_request.target_org_code,
    v_request.need_description, v_workstream.project_id::text, v_now
  );

  insert into public.notifications (
    recipient_id, user_id, title, message, body, event_type, type, link_url,
    urgency, metadata, channel, delivery_status, is_read, created_at
  ) values (
    auth.uid(), auth.uid()::text, v_request.code || ' created', v_request.need_description,
    v_request.need_description, 'action_required', 'action_required',
    '/workstreams/' || v_workstream.code, 'high',
    jsonb_build_object('coordinationRequestCode', v_request.code), 'in_app', 'pending', false, v_now
  );
  return to_jsonb(v_request);
end;
$$;

revoke execute on function public.rpc_clear_workstream_blocker(text, text, text, text) from public, anon;
revoke execute on function public.rpc_create_coordination_request(text, text, text, text, text, text, text, text, text, text, text, text, date, jsonb, text) from public, anon;
grant execute on function public.rpc_clear_workstream_blocker(text, text, text, text) to authenticated;
grant execute on function public.rpc_create_coordination_request(text, text, text, text, text, text, text, text, text, text, text, text, date, jsonb, text) to authenticated;
