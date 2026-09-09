-- S1: keep a customer request as the durable identity for its external filing.
-- A request may be submitted before the State Project Office creates a
-- workstream, so a filing cannot require a guessed workstream at intake.

alter table public.external_filings
  add column if not exists customer_request_id text;

alter table public.external_filings
  alter column workstream_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'external_filings_customer_request_id_fkey'
      and conrelid = 'public.external_filings'::regclass
  ) then
    alter table public.external_filings
      add constraint external_filings_customer_request_id_fkey
      foreign key (customer_request_id)
      references public.customer_requests(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists idx_external_filings_customer_request
  on public.external_filings(customer_request_id, created_at desc);

create unique index if not exists external_filings_customer_request_permit_key
  on public.external_filings(customer_request_id, permit_type_id)
  where customer_request_id is not null and permit_type_id is not null;

create or replace function public.rpc_create_external_filing(
  p_id text,
  p_project_id text,
  p_customer_request_id text,
  p_workstream_id text,
  p_permit_type_id text,
  p_authority_organization_id text,
  p_authority_organization_name text,
  p_filing_method text,
  p_official_portal_url text,
  p_external_reference_number text,
  p_external_record_url text,
  p_external_status text,
  p_submitted_at timestamptz,
  p_authoritative_system_name text,
  p_notes text,
  p_receipt_document_version_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_project_id uuid;
  v_project_ref text;
  v_project_access boolean;
  v_request public.customer_requests%rowtype;
  v_existing public.external_filings%rowtype;
  v_filing public.external_filings%rowtype;
begin
  if v_actor_id is null then
    raise exception 'authentication is required to record an external filing';
  end if;

  if nullif(trim(p_id), '') is null then
    raise exception 'external filing id is required';
  end if;
  if p_filing_method not in ('PATH_SUPPORTED', 'EXTERNAL_PORTAL', 'EMAIL_PAPER_OTHER', 'TRACK_ONLY') then
    raise exception 'invalid external filing method: %', p_filing_method;
  end if;
  if p_external_status not in ('not_started', 'draft', 'submitted', 'under_review', 'additional_information', 'approved', 'denied', 'closed') then
    raise exception 'invalid external filing status: %', p_external_status;
  end if;
  if coalesce(jsonb_typeof(p_receipt_document_version_ids), 'array') <> 'array' then
    raise exception 'receipt_document_version_ids must be a JSON array';
  end if;

  select p.id, p.id::text
    into v_project_id, v_project_ref
  from public.projects p
  where p.id::text = p_project_id or p.number = p_project_id
  limit 1;

  if v_project_id is null then
    raise exception 'project not found: %', p_project_id;
  end if;
  v_project_access := (select app_private.has_project_access(v_project_id));
  if not v_project_access then
    raise exception 'authenticated user cannot access project %', p_project_id;
  end if;

  v_actor_name := coalesce(
    (select nullif(trim(p.full_name), '') from public.profiles p where p.id = v_actor_id),
    (select nullif(trim(up.full_name), '') from public.user_profiles up where up.user_id = v_actor_id),
    nullif(auth.jwt() ->> 'email', ''),
    'Authenticated user'
  );

  if p_customer_request_id is not null then
    select * into v_request
    from public.customer_requests
    where id = p_customer_request_id
      and project_id = v_project_ref
    for update;
    if not found then
      raise exception 'customer request not found for project: %', p_customer_request_id;
    end if;
  end if;

  if p_workstream_id is not null and not exists (
    select 1
    from public.workstreams w
    where (w.id::text = p_workstream_id or w.code = p_workstream_id)
      and w.project_id = v_project_id
  ) then
    raise exception 'workstream % does not belong to project %', p_workstream_id, p_project_id;
  end if;

  -- The client-generated filing id is an idempotency key. A retry after a
  -- committed insert returns the same row and cannot change its identity.
  select * into v_existing
  from public.external_filings
  where id = p_id
  for update;
  if found then
    if v_existing.project_id is distinct from v_project_ref
       or v_existing.customer_request_id is distinct from p_customer_request_id
       or v_existing.permit_type_id is distinct from p_permit_type_id then
      raise exception 'external filing id is already in use: %', p_id;
    end if;
    return to_jsonb(v_existing);
  end if;

  -- The request/permit pair is the second idempotency boundary. This stops a
  -- double submit from creating two filing rows even if the browser generated
  -- two request attempts before the first response returned.
  if p_customer_request_id is not null and p_permit_type_id is not null then
    select * into v_existing
    from public.external_filings
    where customer_request_id = p_customer_request_id
      and permit_type_id = p_permit_type_id
    order by created_at
    limit 1
    for update;
    if found then
      return to_jsonb(v_existing);
    end if;
  end if;

  insert into public.external_filings (
    id, project_id, workstream_id, customer_request_id, permit_type_id,
    authority_organization_id, authority_organization_name, filing_method,
    official_portal_url, external_reference_number, external_record_url,
    external_status, submitted_at, submitted_by_user_id,
    last_status_verified_at, last_status_verified_by,
    authoritative_system_name, notes, receipt_document_version_ids,
    created_at, updated_at
  )
  values (
    p_id, v_project_ref, p_workstream_id, p_customer_request_id, p_permit_type_id,
    p_authority_organization_id, p_authority_organization_name, p_filing_method,
    p_official_portal_url, p_external_reference_number, p_external_record_url,
    p_external_status, p_submitted_at, v_actor_id,
    case when p_external_status <> 'not_started' then now() else null end,
    case when p_external_status <> 'not_started' then v_actor_id else null end,
    p_authoritative_system_name, p_notes,
    coalesce(p_receipt_document_version_ids, '[]'::jsonb), now(), now()
  )
  returning * into v_filing;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, new_value, reason, project_id, created_at
  )
  values (
    v_actor_id, 'external_filing_recorded', 'external_filing', 'external_filing',
    p_id, v_actor_name, p_authority_organization_name, 'external_filing_recorded',
    coalesce(p_external_reference_number, 'Reference pending'),
    coalesce(p_notes, 'Manual tracking record created.'), v_project_ref, now()
  );

  return to_jsonb(v_filing);
end;
$$;

revoke execute on function public.rpc_create_external_filing(
  text, text, text, text, text, text, text, text, text, text, text, text,
  timestamptz, text, text, jsonb
) from public, anon;
grant execute on function public.rpc_create_external_filing(
  text, text, text, text, text, text, text, text, text, text, text, text,
  timestamptz, text, text, jsonb
) to authenticated;
