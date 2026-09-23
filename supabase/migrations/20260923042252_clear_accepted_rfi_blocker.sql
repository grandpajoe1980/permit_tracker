-- A completed RFI can leave its own blocker entry behind in active_blockers,
-- which would continue to fail the workstream completion gate. Remove only
-- entries explicitly linked to an already accepted RFI.
update public.workstreams as w
set active_blockers = coalesce((
      select jsonb_agg(b.value order by b.ordinality)
      from jsonb_array_elements(coalesce(w.active_blockers, '[]'::jsonb)) with ordinality as b(value, ordinality)
      where not exists (
        select 1
        from public.rfis as r
        where r.workstream_id = w.id
          and r.status = 'accepted'
          and (
            b.value ->> 'id' = r.id::text
            or b.value ->> 'id' = r.code
            or b.value ->> 'source' = r.id::text
            or b.value ->> 'source' = r.code
          )
      )
    ), '[]'::jsonb),
    updated_at = now()
where jsonb_typeof(coalesce(w.active_blockers, '[]'::jsonb)) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(coalesce(w.active_blockers, '[]'::jsonb)) as b(value)
    join public.rfis as r on r.workstream_id = w.id and r.status = 'accepted'
    where b.value ->> 'id' = r.id::text
       or b.value ->> 'id' = r.code
       or b.value ->> 'source' = r.id::text
       or b.value ->> 'source' = r.code
  );

create or replace function public.rpc_accept_rfi_response(
  p_rfi_id text,
  p_actor_name text,
  p_actor_org_name text,
  p_notes text default 'Response accepted and linked review resumed.',
  p_actor_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_now timestamptz := now();
  v_rfi record;
  v_resp public.rfi_responses%rowtype;
  v_workstream public.workstreams%rowtype;
  v_remaining public.rfis%rowtype;
  v_actor_name text;
  v_already_accepted boolean := false;
begin
  if auth.uid() is null then raise exception 'authenticated user required'; end if;
  select r.*, w.project_id into v_rfi
  from public.rfis r join public.workstreams w on w.id = r.workstream_id
  where r.id = p_rfi_id or r.code = p_rfi_id
  for update;
  if not found then raise exception 'RFI not found: %', p_rfi_id; end if;
  if not (select app_private.has_project_access(v_rfi.project_id)) then
    raise exception 'authenticated user cannot access RFI project';
  end if;
  if not (select app_private.is_system_admin())
     and not exists (
       select 1 from public.organization_memberships m
       join public.organizations o on o.id = m.organization_id
       where m.user_id = (select auth.uid()) and m.status = 'active'
         and m.effective_from <= now() and (m.effective_to is null or m.effective_to > now())
         and upper(o.code) = upper(v_rfi.requesting_org_code)
     ) then
    raise exception 'requesting organization membership required';
  end if;

  if v_rfi.status = 'accepted' then
    v_already_accepted := true;
  else
    select * into v_resp
    from public.rfi_responses
    where rfi_id = v_rfi.id and review_status = 'under_review'
    order by created_at desc, id desc
    limit 1
    for update;
    if not found then raise exception 'no pending RFI response to accept'; end if;

    update public.rfi_responses
    set review_status = 'accepted', reviewer_feedback = p_notes
    where id = v_resp.id
    returning * into v_resp;
    update public.rfis set status = 'accepted' where id = v_rfi.id;
  end if;

  select * into v_workstream from public.workstreams where id = v_rfi.workstream_id for update;
  update public.workstreams as w
  set active_blockers = coalesce((
        select jsonb_agg(b.value order by b.ordinality)
        from jsonb_array_elements(coalesce(w.active_blockers, '[]'::jsonb)) with ordinality as b(value, ordinality)
        where not (
          b.value ->> 'id' = v_rfi.id::text
          or b.value ->> 'id' = v_rfi.code
          or b.value ->> 'source' = v_rfi.id::text
          or b.value ->> 'source' = v_rfi.code
        )
      ), '[]'::jsonb),
      updated_at = v_now
  where w.id = v_workstream.id
    and jsonb_typeof(coalesce(w.active_blockers, '[]'::jsonb)) = 'array'
    and exists (
      select 1
      from jsonb_array_elements(coalesce(w.active_blockers, '[]'::jsonb)) as b(value)
      where b.value ->> 'id' = v_rfi.id::text
         or b.value ->> 'id' = v_rfi.code
         or b.value ->> 'source' = v_rfi.id::text
         or b.value ->> 'source' = v_rfi.code
    );
  select * into v_workstream from public.workstreams where id = v_rfi.workstream_id;

  if v_already_accepted then
    return jsonb_build_object('success', true, 'rfiCode', v_rfi.code, 'alreadyAccepted', true);
  end if;

  select * into v_remaining
  from public.rfis
  where workstream_id = v_rfi.workstream_id
    and status in ('issued', 'partially_answered', 'submitted_by_applicant')
  order by response_deadline nulls last, created_at, id
  limit 1;

  if found then
    -- Keep a precise next owner when another RFI remains. Do not overwrite
    -- an independent blocked/coordination state.
    if v_workstream.operational_state = 'waiting_applicant' then
      update public.workstreams
      set waiting_reason = 'Waiting for response to ' || v_remaining.code || '.',
          waiting_on_entity = v_remaining.recipient_org_code,
          updated_at = v_now
      where id = v_workstream.id;
    end if;
  elsif v_workstream.operational_state = 'waiting_applicant'
        and (v_workstream.waiting_on_entity = v_rfi.recipient_org_code
             or v_workstream.waiting_reason ilike '%' || v_rfi.code || '%') then
    update public.workstreams
    set operational_state = 'running',
        operational_state_label = 'Running (Response Accepted)',
        waiting_reason = null,
        waiting_on_entity = null,
        updated_at = v_now
    where id = v_workstream.id;
  end if;

  v_actor_name := coalesce(
    (select up.full_name from public.user_profiles up
      where up.user_id = (select auth.uid()) limit 1),
    nullif(trim(p_actor_name), ''), 'Authenticated user'
  );
  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason, project_id, created_at
  ) values (
    (select auth.uid()), 'rfi_response_accepted', 'rfi', 'rfi', v_rfi.code, v_actor_name,
    coalesce(nullif(trim(p_actor_org_name), ''), v_rfi.requesting_org_code),
    'rfi_response_accepted', 'submitted_by_applicant', 'accepted', p_notes,
    v_rfi.project_id::text, v_now
  );
  return jsonb_build_object('success', true, 'rfiCode', v_rfi.code, 'responseId', v_resp.id);
end;
$$;

revoke execute on function public.rpc_accept_rfi_response(text,text,text,text,uuid) from public, anon;
grant execute on function public.rpc_accept_rfi_response(text,text,text,text,uuid) to authenticated, service_role;
