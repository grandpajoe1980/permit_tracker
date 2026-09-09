-- Allow an authenticated member of the target agency's active assignment
-- group to respond. Group membership is the eligibility boundary used by the
-- assignment system; the response must still have project access.

create or replace function public.rpc_update_coordination_request(
  p_request_id text,
  p_status text,
  p_response_summary text,
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
  v_request public.coordination_requests%rowtype;
  v_workstream public.workstreams%rowtype;
  v_target_org_id uuid;
  v_recipient_id uuid;
  v_recipient_count integer := 0;
  v_old_status text;
  v_now timestamptz := now();
begin
  if v_actor_id is null then
    raise exception 'authentication required for coordination response';
  end if;

  if p_status not in ('in_review', 'concurred', 'objection_raised', 'closed') then
    raise exception 'invalid coordination response status: %', p_status;
  end if;

  if nullif(trim(coalesce(p_response_summary, '')), '') is null then
    raise exception 'coordination response summary is required';
  end if;

  select * into v_request
  from public.coordination_requests
  where id = p_request_id or code = p_request_id
  for update;
  if not found then
    raise exception 'coordination request not found: %', p_request_id;
  end if;

  select * into v_workstream
  from public.workstreams
  where id = v_request.workstream_id
  for share;
  if not found then
    raise exception 'coordination workstream not found: %', v_request.workstream_id;
  end if;

  if v_workstream.project_id is null
     or not coalesce((select app_private.has_project_access(v_workstream.project_id)), false) then
    raise exception 'authenticated user cannot access coordination request %', v_request.code;
  end if;

  select organization_record.id into v_target_org_id
  from public.organizations organization_record
  where upper(organization_record.code) = upper(v_request.target_org_code)
    and organization_record.active
  limit 1;

  if not (
    coalesce((select app_private.is_system_admin()), false)
    or coalesce((select app_private.can_dispatch_project(v_workstream.project_id)), false)
    or (v_target_org_id is not null and coalesce((select app_private.is_org_member(v_target_org_id)), false))
    or exists (
      select 1
      from public.assignment_groups target_group
      join public.assignment_group_memberships target_membership
        on target_membership.assignment_group_id = target_group.id
       and target_membership.user_id = v_actor_id
      where target_group.active
        and upper(target_group.org_code) = upper(v_request.target_org_code)
    )
  ) then
    raise exception 'authenticated user cannot respond to coordination request %', v_request.code;
  end if;

  v_old_status := v_request.status;

  update public.coordination_requests
  set status = p_status,
      response_summary = trim(p_response_summary),
      response_date = current_date,
      concurred_at = case when p_status = 'concurred' then v_now else null end
  where id = v_request.id
  returning * into v_request;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason,
    project_id, created_at, occurred_at
  ) values (
    v_actor_id, 'coordination_response_recorded', 'coordination_request',
    'coordination_request', v_request.code, p_actor_name, p_actor_org_name,
    'response_recorded', v_old_status, p_status, trim(p_response_summary),
    v_workstream.project_id::text, v_now, v_now
  );

  for v_recipient_id in
    select distinct membership.user_id
    from public.assignment_groups group_record
    join public.assignment_group_memberships membership
      on membership.assignment_group_id = group_record.id
    where group_record.active
      and upper(group_record.org_code) = upper(v_request.requesting_org_code)
  loop
    insert into public.notifications (
      recipient_id, recipient_user_id, user_id, title, message, body,
      event_type, type, link_url, urgency, metadata, channel,
      delivery_status, is_read, related_entity_id, dedupe_key, created_at
    ) values (
      v_recipient_id, v_recipient_id, v_recipient_id::text,
      v_request.code || ' response recorded',
      p_actor_org_name || ' recorded a response for ' || v_request.workstream_title || '.',
      trim(p_response_summary), 'status_update', 'status_update',
      '/workstreams/' || v_workstream.code,
      case when p_status = 'objection_raised' then 'high' else 'normal' end,
      jsonb_build_object(
        'coordinationRequestId', v_request.id,
        'coordinationRequestCode', v_request.code,
        'status', p_status,
        'workstreamId', v_workstream.id
      ),
      'in_app', 'pending', false, v_request.id,
      'coordination-response:' || v_request.id || ':' || v_recipient_id::text,
      v_now
    ) on conflict (dedupe_key) do nothing;
    if found then
      v_recipient_count := v_recipient_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'request', to_jsonb(v_request),
    'success', true,
    'dependencyCleared', false,
    'notificationRecipientCount', v_recipient_count
  );
end;
$$;

revoke all on function public.rpc_update_coordination_request(text, text, text, text, text) from public, anon;
grant execute on function public.rpc_update_coordination_request(text, text, text, text, text) to authenticated;
