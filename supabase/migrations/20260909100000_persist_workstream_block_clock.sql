-- Keep workstream blocker transitions authoritative for both lifecycle state
-- and the persisted review clock. The schedule projection can then reflect a
-- real pause/resume after a fresh hydration instead of a local-only label.

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
  v_old_clock_status text;
  v_old_paused_at timestamptz;
  v_total_paused integer;
  v_clock_status text;
  v_clock_paused_at timestamptz;
  v_clock_paused_reason text;
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
  if v_workstream.operational_state in ('complete', 'cancelled') then
    raise exception 'closed workstreams cannot be blocked';
  end if;

  v_old_state := v_workstream.operational_state;
  v_old_clock_status := coalesce(v_workstream.clock_status, 'active');
  v_old_paused_at := v_workstream.clock_paused_at;
  v_total_paused := coalesce(v_workstream.clock_total_paused_seconds, 0);

  if p_pause_clock then
    v_clock_status := 'paused';
    v_clock_paused_at := coalesce(v_old_paused_at, v_now);
    v_clock_paused_reason := nullif(trim(p_reason), '');
  else
    v_clock_status := 'active';
    if v_old_clock_status = 'paused' and v_old_paused_at is not null then
      v_total_paused := v_total_paused + greatest(extract(epoch from (v_now - v_old_paused_at))::integer, 0);
    end if;
    v_clock_paused_at := null;
    v_clock_paused_reason := null;
  end if;

  update public.workstreams set
    operational_state = v_state,
    operational_state_label = v_label,
    waiting_reason = nullif(trim(p_reason), ''),
    waiting_on_entity = nullif(trim(p_waiting_on), ''),
    clock_status = v_clock_status,
    clock_paused_at = v_clock_paused_at,
    clock_paused_reason = v_clock_paused_reason,
    clock_total_paused_seconds = v_total_paused,
    updated_at = v_now
  where id = v_workstream.id
  returning * into v_workstream;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason, project_id, created_at
  ) values (
    auth.uid(), 'workstream_blocked', 'workstream', 'workstream', v_workstream.code,
    p_actor_name, p_actor_org_name, 'blocked', v_old_state,
    v_state, p_reason || ' · Waiting on ' || p_waiting_on || ' · Clock ' || v_clock_status,
    v_workstream.project_id::text, v_now
  );
  return to_jsonb(v_workstream);
end;
$$;

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
  v_old_clock_status text;
  v_old_paused_at timestamptz;
  v_total_paused integer;
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
  if v_workstream.operational_state not in ('blocked', 'waiting_government', 'waiting_external') then
    raise exception 'workstream is not blocked or waiting on an agency';
  end if;

  v_old_state := v_workstream.operational_state;
  v_old_reason := v_workstream.waiting_reason;
  v_old_clock_status := coalesce(v_workstream.clock_status, 'active');
  v_old_paused_at := v_workstream.clock_paused_at;
  v_total_paused := coalesce(v_workstream.clock_total_paused_seconds, 0);
  if v_old_clock_status = 'paused' and v_old_paused_at is not null then
    v_total_paused := v_total_paused + greatest(extract(epoch from (v_now - v_old_paused_at))::integer, 0);
  end if;

  update public.workstreams set
    operational_state = 'running',
    operational_state_label = coalesce(nullif('Running (' || current_stage_name || ')', 'Running ()'), 'Running'),
    waiting_reason = null,
    waiting_on_entity = null,
    clock_status = 'active',
    clock_paused_at = null,
    clock_paused_reason = null,
    clock_total_paused_seconds = v_total_paused,
    updated_at = v_now
  where id = v_workstream.id
  returning * into v_workstream;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason, project_id, created_at
  ) values (
    auth.uid(), 'workstream_resumed', 'workstream', 'workstream', v_workstream.code,
    p_actor_name, p_actor_org_name, 'resumed', v_old_state, 'running',
    coalesce(nullif(trim(p_resolution_notes), ''), 'Blocker cleared; review clock resumed.') ||
      case when v_old_reason is not null then ' Previous blocker: ' || v_old_reason else '' end ||
      ' Total paused seconds: ' || v_total_paused,
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

revoke execute on function public.rpc_mark_workstream_blocked(text, text, text, boolean, text, text) from public, anon;
revoke execute on function public.rpc_clear_workstream_blocker(text, text, text, text) from public, anon;
grant execute on function public.rpc_mark_workstream_blocked(text, text, text, boolean, text, text) to authenticated;
grant execute on function public.rpc_clear_workstream_blocker(text, text, text, text) to authenticated;
