-- Wave 5: workbench state changes and their audit/notification effects are
-- committed together by the database.

create or replace function public.rpc_mark_workstream_blocked(
  p_workstream_id text,
  p_reason text,
  p_waiting_on text,
  p_pause_clock boolean,
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
  v_now timestamptz := now();
  v_state text := case when p_pause_clock then 'waiting_government' else 'blocked' end;
  v_label text := case when p_pause_clock then 'Waiting on Government (Clock Paused)' else 'Blocked (Action Required)' end;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into v_workstream from public.workstreams
  where id = p_workstream_id or code = p_workstream_id for update;
  if not found then raise exception 'workstream not found: %', p_workstream_id; end if;
  if v_workstream.project_id is null or not (select app_private.has_project_access(v_workstream.project_id)) then
    raise exception 'authenticated user cannot access workstream %', p_workstream_id;
  end if;
  v_old_state := v_workstream.operational_state;
  update public.workstreams set
    operational_state = v_state,
    operational_state_label = v_label,
    waiting_reason = nullif(trim(p_reason), ''),
    waiting_on_entity = nullif(trim(p_waiting_on), ''),
    updated_at = v_now
  where id = v_workstream.id returning * into v_workstream;
  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason, project_id, created_at
  ) values (
    auth.uid(), 'workstream_blocked', 'workstream', 'workstream', v_workstream.code,
    p_actor_name, p_actor_org_name, 'blocked', v_old_state,
    v_state, p_reason || ' · Waiting on ' || p_waiting_on, v_workstream.project_id::text, v_now
  );
  return to_jsonb(v_workstream);
end;
$$;

create or replace function public.rpc_escalate_workstream(
  p_workstream_id text,
  p_problem_type text,
  p_actor_name text,
  p_actor_org_name text
)
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare
  v_workstream public.workstreams%rowtype;
  v_level integer;
  v_now timestamptz := now();
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into v_workstream from public.workstreams
  where id = p_workstream_id or code = p_workstream_id for update;
  if not found then raise exception 'workstream not found: %', p_workstream_id; end if;
  if v_workstream.project_id is null or not (select app_private.has_project_access(v_workstream.project_id)) then
    raise exception 'authenticated user cannot access workstream %', p_workstream_id;
  end if;
  v_level := least(5, greatest(1, coalesce(v_workstream.escalation_level, 0) + 1));
  update public.workstreams set
    operational_state = 'escalated', operational_state_label = 'Escalated for Help',
    escalation_level = v_level, escalation_triggered_at = v_now,
    escalation_summary = nullif(trim(p_problem_type), ''), updated_at = v_now
  where id = v_workstream.id;
  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, new_value, reason, project_id, created_at
  ) values (
    auth.uid(), 'workstream_escalated', 'workstream', 'workstream', v_workstream.code,
    p_actor_name, p_actor_org_name, 'escalated', 'Escalation ' || v_level || ': ' || p_problem_type,
    p_problem_type, v_workstream.project_id::text, v_now
  );
  return jsonb_build_object('newLevel', v_level, 'success', true);
end;
$$;

create or replace function public.rpc_transfer_workstream(
  p_workstream_id text,
  p_transfer_type text,
  p_target_name text,
  p_note text,
  p_actor_name text,
  p_actor_org_name text
)
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare
  v_workstream public.workstreams%rowtype;
  v_now timestamptz := now();
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into v_workstream from public.workstreams
  where id = p_workstream_id or code = p_workstream_id;
  if not found then raise exception 'workstream not found: %', p_workstream_id; end if;
  if v_workstream.project_id is null or not (select app_private.has_project_access(v_workstream.project_id)) then
    raise exception 'authenticated user cannot access workstream %', p_workstream_id;
  end if;
  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, new_value, reason, project_id, created_at
  ) values (
    auth.uid(), 'workstream_transfer_requested', 'workstream', 'workstream', v_workstream.code,
    p_actor_name, p_actor_org_name, 'transfer_requested', p_transfer_type || ' → ' || p_target_name,
    coalesce(nullif(trim(p_note), ''), 'Help requested from supervisor.'), v_workstream.project_id::text, v_now
  );
  return jsonb_build_object('success', true, 'workstreamId', v_workstream.id);
end;
$$;

revoke execute on function public.rpc_mark_workstream_blocked(text, text, text, boolean, text, text) from public, anon;
revoke execute on function public.rpc_escalate_workstream(text, text, text, text) from public, anon;
revoke execute on function public.rpc_transfer_workstream(text, text, text, text, text, text) from public, anon;
grant execute on function public.rpc_mark_workstream_blocked(text, text, text, boolean, text, text) to authenticated;
grant execute on function public.rpc_escalate_workstream(text, text, text, text) to authenticated;
grant execute on function public.rpc_transfer_workstream(text, text, text, text, text, text) to authenticated;
