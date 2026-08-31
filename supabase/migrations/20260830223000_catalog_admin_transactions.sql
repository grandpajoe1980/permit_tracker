-- Wave 3 follow-up: make statutory catalog and organization registration
-- server-confirmed administrative operations.

revoke insert, update, delete on public.organizations, public.permit_types from authenticated;

create or replace function public.rpc_register_organization(
  p_code text,
  p_name text,
  p_organization_type text default 'agency',
  p_jurisdiction_level text default 'state',
  p_abbreviation text default null,
  p_website_url text default null,
  p_general_contact_email text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare
  v_row public.organizations%rowtype;
  v_code text := upper(trim(p_code));
begin
  perform app_private.require_workflow_admin();
  if v_code !~ '^[A-Z][A-Z0-9_-]{1,31}$' then
    raise exception 'organization code must be 2-32 uppercase letters, numbers, underscores, or hyphens';
  end if;
  if nullif(trim(p_name), '') is null then raise exception 'organization name is required'; end if;

  insert into public.organizations (code, name, organization_type, jurisdiction_level, contacts)
  values (
    v_code, trim(p_name), coalesce(nullif(trim(p_organization_type), ''), 'agency'),
    coalesce(nullif(trim(p_jurisdiction_level), ''), 'state'),
    jsonb_strip_nulls(jsonb_build_object(
      'abbreviation', nullif(trim(p_abbreviation), ''),
      'websiteUrl', nullif(trim(p_website_url), ''),
      'generalContactEmail', nullif(trim(p_general_contact_email), '')
    ))
  )
  returning * into v_row;

  insert into public.audit_events (actor_id, action, resource_type, entity_type, entity_id, actor_name, action_type, new_value, created_at)
  values (auth.uid(), 'organization_registered', 'organization', 'organization', v_row.id::text,
    coalesce((select full_name from public.profiles where id = auth.uid()), 'PATH administrator'),
    'organization_registered', v_row.code, now());
  return to_jsonb(v_row);
end;
$$;

create or replace function public.rpc_create_permit_type(
  p_id text,
  p_code text,
  p_name text,
  p_category text,
  p_responsible_org_code text,
  p_trigger_explanation text,
  p_statutory_citation text,
  p_expected_lead_time_days integer default 30,
  p_minimum_statutory_days integer default 0,
  p_official_filing_url text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare
  v_row public.permit_types%rowtype;
  v_org_id text;
begin
  perform app_private.require_workflow_admin();
  select id::text into v_org_id from public.organizations where code = upper(trim(p_responsible_org_code));
  if v_org_id is null then raise exception 'responsible organization not found: %', p_responsible_org_code; end if;
  if nullif(trim(p_id), '') is null or nullif(trim(p_code), '') is null or nullif(trim(p_name), '') is null then
    raise exception 'permit id, code, and name are required';
  end if;

  insert into public.permit_types (
    id, code, name, category, responsible_org_id, responsible_org_code,
    trigger_explanation, statutory_citation, official_filing_url,
    expected_lead_time_days, minimum_statutory_days, last_verified_at, verification_status
  ) values (
    trim(p_id), upper(trim(p_code)), trim(p_name), coalesce(nullif(trim(p_category), ''), 'permit'),
    v_org_id, upper(trim(p_responsible_org_code)), coalesce(nullif(trim(p_trigger_explanation), ''), 'Agency review required.'),
    coalesce(nullif(trim(p_statutory_citation), ''), 'Authority to be confirmed by the responsible agency.'),
    nullif(trim(p_official_filing_url), ''), greatest(coalesce(p_expected_lead_time_days, 30), 0),
    greatest(coalesce(p_minimum_statutory_days, 0), 0), current_date, 'verification_due'
  ) returning * into v_row;

  insert into public.audit_events (actor_id, action, resource_type, entity_type, entity_id, actor_name, action_type, new_value, created_at)
  values (auth.uid(), 'permit_type_created', 'permit_type', 'permit_type', v_row.id,
    coalesce((select full_name from public.profiles where id = auth.uid()), 'PATH administrator'),
    'permit_type_created', v_row.code, now());
  return to_jsonb(v_row);
end;
$$;

revoke execute on function public.rpc_register_organization(text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.rpc_create_permit_type(text, text, text, text, text, text, text, integer, integer, text) from public, anon;
grant execute on function public.rpc_register_organization(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.rpc_create_permit_type(text, text, text, text, text, text, text, integer, integer, text) to authenticated;
