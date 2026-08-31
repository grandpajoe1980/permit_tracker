-- Wave 1 follow-up: derive customer-request identity and tenant context from
-- the authenticated session. The historical RPC accepted both values as
-- parameters, which allowed a direct caller to spoof the submitter in the
-- request row and its audit trail.

create or replace function public.rpc_create_customer_request(
  p_id text,
  p_confirmation_number text,
  p_project_id text,
  p_request_type text,
  p_title text,
  p_description text,
  p_requested_outcome text default null,
  p_location_or_affected_area text default null,
  p_desired_date date default null,
  p_schedule_importance text default 'normal',
  p_known_agency_code text default null,
  p_known_permit_type_id text default null,
  p_submitted_by_user_id uuid default null,
  p_submitted_by_name text default 'SpaceX Representative',
  p_related_workstream_id text default null,
  p_blocks_active_work boolean default false,
  p_status text default 'submitted',
  p_attachment_document_version_ids jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_now timestamptz := now();
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_project_id uuid;
  v_project_ref text;
  v_request public.customer_requests%rowtype;
  v_existing public.customer_requests%rowtype;
begin
  if v_actor_id is null then
    raise exception 'authentication is required to create a customer request';
  end if;

  if p_status not in ('draft', 'submitted') then
    raise exception 'invalid customer request status: %', p_status;
  end if;

  select p.id, p.id::text
    into v_project_id, v_project_ref
  from public.projects p
  where p.id::text = p_project_id or p.number = p_project_id
  limit 1;

  if v_project_id is null then
    raise exception 'project not found: %', p_project_id;
  end if;
  if not (select app_private.has_project_access(v_project_id)) then
    raise exception 'authenticated user cannot access project %', p_project_id;
  end if;

  v_actor_name := coalesce(
    (select nullif(trim(p.full_name), '') from public.profiles p where p.id = v_actor_id),
    (select nullif(trim(up.full_name), '') from public.user_profiles up where up.user_id = v_actor_id),
    nullif(auth.jwt() ->> 'email', ''),
    'Authenticated user'
  );

  -- The client-generated ID is an idempotency key. A retry may return its own
  -- identical request, but it can never use an existing ID for another actor
  -- or a different payload.
  select * into v_existing
  from public.customer_requests
  where id = p_id;
  if found then
    if v_existing.submitted_by_user_id is distinct from v_actor_id
       or v_existing.confirmation_number is distinct from p_confirmation_number
       or v_existing.project_id is distinct from v_project_ref
       or v_existing.title is distinct from p_title
       or v_existing.description is distinct from p_description then
      raise exception 'customer request id is already in use: %', p_id;
    end if;
    return to_jsonb(v_existing);
  end if;

  if coalesce(jsonb_typeof(p_attachment_document_version_ids), 'array') <> 'array' then
    raise exception 'attachment_document_version_ids must be a JSON array';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_attachment_document_version_ids, '[]'::jsonb)) attachment(id)
    where not exists (
      select 1
      from public.document_versions dv
      join public.documents d on d.id = dv.document_id
      where dv.id = attachment.id
        and d.project_id = v_project_id
    )
  ) then
    raise exception 'customer request attachments must belong to the selected project';
  end if;

  insert into public.customer_requests (
    id, confirmation_number, project_id, request_type, title, description,
    requested_outcome, location_or_affected_area, desired_date, schedule_importance,
    known_agency_code, known_permit_type_id, submitted_by_user_id, submitted_by_name,
    related_workstream_id, blocks_active_work, status, attachment_document_version_ids,
    created_at, updated_at
  )
  values (
    p_id, p_confirmation_number, v_project_ref, p_request_type, p_title, p_description,
    p_requested_outcome, p_location_or_affected_area, p_desired_date, p_schedule_importance,
    p_known_agency_code, p_known_permit_type_id, v_actor_id, v_actor_name,
    p_related_workstream_id, p_blocks_active_work, p_status, coalesce(p_attachment_document_version_ids, '[]'::jsonb),
    v_now, v_now
  )
  returning * into v_request;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, new_value, reason, project_id, created_at
  )
  values (
    v_actor_id, 'customer_request_submitted', 'customer_request', 'customer_request',
    p_confirmation_number, v_actor_name, 'Space Exploration Technologies Corp. (SpaceX)',
    'customer_request_submitted', p_request_type || ' · ' || p_title, p_description, v_project_ref, v_now
  );

  if p_status <> 'draft' then
    insert into public.notifications (
      user_id, event_type, title, message, body, channel, delivery_status,
      link_url, urgency, metadata, created_at
    )
    values (
      'sarah.johnson@la.gov', 'action_required', 'New customer request ' || p_confirmation_number,
      p_title, p_description, 'in_app', 'pending', '/requests/' || p_confirmation_number,
      case when p_blocks_active_work then 'critical' else 'high' end,
      jsonb_build_object('confirmationNumber', p_confirmation_number, 'requestType', p_request_type),
      v_now
    );
  end if;

  return to_jsonb(v_request);
end;
$$;

revoke execute on function public.rpc_create_customer_request(
  text, text, text, text, text, text, text, text, date, text, text, text,
  uuid, text, text, boolean, text, jsonb
) from public, anon;
grant execute on function public.rpc_create_customer_request(
  text, text, text, text, text, text, text, text, date, text, text, text,
  uuid, text, text, boolean, text, jsonb
) to authenticated;
