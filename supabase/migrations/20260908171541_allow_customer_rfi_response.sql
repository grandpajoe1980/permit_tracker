-- Customer users are authorized by their active customer organization profile,
-- not only by an organization_memberships row. Project access is checked first,
-- so this remains scoped to the project the customer can actually see.

create or replace function public.rpc_submit_rfi_response(
  p_id text,
  p_rfi_id text,
  p_submitted_by_user_name text,
  p_response_text text,
  p_actor_org_name text,
  p_attached_document_version_ids jsonb default '[]'::jsonb,
  p_actor_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_now timestamptz := now();
  v_today date := current_date;
  v_resp public.rfi_responses%rowtype;
  v_existing public.rfi_responses%rowtype;
  v_rfi record;
  v_actor_name text;
  v_actor_org_name text;
begin
  if auth.uid() is null then raise exception 'authenticated user required'; end if;
  select r.*, w.project_id into v_rfi
  from public.rfis r
  join public.workstreams w on w.id = r.workstream_id
  where r.id = p_rfi_id or r.code = p_rfi_id
  for update;
  if not found then raise exception 'RFI not found: %', p_rfi_id; end if;
  if v_rfi.status in ('accepted', 'closed', 'withdrawn') then
    raise exception 'RFI is already terminal: %', v_rfi.status;
  end if;
  if not (select app_private.has_project_access(v_rfi.project_id)) then
    raise exception 'authenticated user cannot access RFI project';
  end if;
  if not (
    (select app_private.is_system_admin())
    or exists (
      select 1
      from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.effective_from <= now()
        and (m.effective_to is null or m.effective_to > now())
        and upper(o.code) = upper(v_rfi.recipient_org_code)
    )
    or app_private.is_customer_org_member((
      select o.id
      from public.organizations o
      where upper(o.code) = upper(v_rfi.recipient_org_code)
        and o.active
      limit 1
    ))
  ) then
    raise exception 'recipient organization membership required';
  end if;
  if nullif(trim(p_response_text), '') is null then raise exception 'RFI response is required'; end if;
  if jsonb_typeof(coalesce(p_attached_document_version_ids, '[]'::jsonb)) <> 'array' then
    raise exception 'RFI attachments must be a JSON array';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_attached_document_version_ids, '[]'::jsonb)) a(value)
    where not exists (
      select 1
      from public.document_versions dv
      left join public.documents d on d.id = dv.document_id
      where dv.id = a.value
        and (dv.project_id = v_rfi.project_id or d.project_id = v_rfi.project_id)
    )
  ) then
    raise exception 'RFI attachment is not part of the project';
  end if;

  select * into v_existing from public.rfi_responses where id = p_id;
  if found then
    if v_existing.rfi_id <> v_rfi.id then
      raise exception 'response ID already belongs to another RFI: %', p_id;
    end if;
    return to_jsonb(v_existing);
  end if;

  v_actor_name := coalesce(
    (select up.full_name from public.user_profiles up
      where up.user_id = (select auth.uid()) limit 1),
    nullif(trim(p_submitted_by_user_name), ''), 'Authenticated user'
  );
  select o.name into v_actor_org_name
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = (select auth.uid()) and m.status = 'active'
  order by case when upper(o.code) = upper(v_rfi.recipient_org_code) then 0 else 1 end
  limit 1;
  if v_actor_org_name is null then
    select o.name into v_actor_org_name
    from public.organizations o
    join public.profiles p on p.customer_organization_id = o.id
    where p.id = (select auth.uid()) and p.status = 'active'
    limit 1;
  end if;
  v_actor_org_name := coalesce(v_actor_org_name, nullif(trim(p_actor_org_name), ''), v_rfi.recipient_org_code);

  insert into public.rfi_responses (
    id, rfi_id, submitted_by_user_id, submitted_by_user_name, response_text,
    attached_document_version_ids, submitted_date, review_status, created_at
  ) values (
    p_id, v_rfi.id, (select auth.uid()), v_actor_name, p_response_text,
    coalesce(p_attached_document_version_ids, '[]'::jsonb), v_today, 'under_review', v_now
  ) returning * into v_resp;

  update public.rfis set status = 'submitted_by_applicant' where id = v_rfi.id;
  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, new_value, reason, project_id, created_at
  ) values (
    (select auth.uid()), 'rfi_response_submitted', 'rfi_response', 'rfi_response',
    v_rfi.code, v_actor_name, v_actor_org_name, 'rfi_response_submitted',
    'Response submitted to ' || v_rfi.requesting_org_code, p_response_text,
    v_rfi.project_id::text, v_now
  );
  return to_jsonb(v_resp);
end;
$$;

revoke execute on function public.rpc_submit_rfi_response(text,text,text,text,text,jsonb,uuid) from public, anon;
grant execute on function public.rpc_submit_rfi_response(text,text,text,text,text,jsonb,uuid) to authenticated, service_role;
