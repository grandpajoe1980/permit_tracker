-- CP8: typed task corrections must cross an authenticated administrative
-- command boundary. Do not grant direct task UPDATE access to the browser.

create or replace function public.rpc_admin_update_task(
  p_task_id text,
  p_status text,
  p_title text,
  p_reason text,
  p_actor_name text,
  p_actor_org_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_workstream public.workstreams%rowtype;
  v_old_status text;
  v_old_title text;
  v_status text;
  v_itsm_state text;
  v_actor_name text;
  v_actor_org_name text;
begin
  if v_actor_id is null then
    raise exception 'authentication is required for administrative task corrections';
  end if;

  if not coalesce((select app_private.is_system_admin()), false)
     and not exists (
       select 1
       from public.organization_memberships membership
       where membership.user_id = v_actor_id
         and membership.status = 'active'
         and membership.role in ('organization_admin', 'system_admin')
     ) then
    raise exception 'administrator access is required for task corrections';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'a correction reason is required';
  end if;

  v_status := nullif(trim(coalesce(p_status, '')), '');
  if v_status is null or v_status not in ('pending', 'in_progress', 'waiting', 'blocked', 'completed', 'waived') then
    raise exception 'invalid task status: %', coalesce(p_status, '<empty>');
  end if;

  select * into v_task
  from public.tasks
  where id = p_task_id
  for update;
  if not found then
    raise exception 'task not found: %', p_task_id;
  end if;

  select * into v_workstream
  from public.workstreams
  where id = v_task.workstream_id
  for share;
  if not found or v_workstream.project_id is null then
    raise exception 'task workstream is not available: %', p_task_id;
  end if;

  if not coalesce((select app_private.is_system_admin()), false)
     and not coalesce((select app_private.has_project_access(v_workstream.project_id)), false) then
    raise exception 'administrator cannot access task project: %', p_task_id;
  end if;

  select
    coalesce(profile.full_name, actor.email, 'Authenticated administrator'),
    coalesce(profile.organization_name, 'PATH')
  into v_actor_name, v_actor_org_name
  from auth.users actor
  left join public.user_profiles profile on profile.user_id = actor.id
  where actor.id = v_actor_id;

  v_old_status := v_task.status;
  v_old_title := v_task.title;
  v_itsm_state := case v_status
    when 'completed' then 'resolved'
    when 'waived' then 'resolved'
    when 'blocked' then 'blocked'
    when 'waiting' then 'blocked'
    when 'in_progress' then 'in_progress'
    else 'submitted'
  end;

  update public.tasks
  set status = v_status,
      itsm_state = v_itsm_state,
      title = coalesce(nullif(trim(coalesce(p_title, '')), ''), title)
  where id = v_task.id
  returning * into v_task;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason,
    project_id, created_at, occurred_at
  ) values (
    v_actor_id, 'admin_task_corrected', 'task', 'task', v_task.id,
    coalesce(v_actor_name, nullif(trim(p_actor_name), ''), 'Authenticated administrator'),
    coalesce(v_actor_org_name, nullif(trim(p_actor_org_name), ''), 'PATH'),
    'administrative_correction',
    v_old_status || ' · ' || coalesce(v_old_title, ''),
    v_task.status || ' · ' || coalesce(v_task.title, ''),
    trim(p_reason), v_workstream.project_id::text, now(), now()
  );

  return jsonb_build_object('success', true, 'task', to_jsonb(v_task));
end;
$$;

revoke all on function public.rpc_admin_update_task(text, text, text, text, text, text) from public, anon;
grant execute on function public.rpc_admin_update_task(text, text, text, text, text, text) to authenticated;
