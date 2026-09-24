-- Customer-submitted filing status is a PATH report, not evidence that the
-- issuing authority independently confirmed that status. Keep verification as
-- a separate, permissioned event with an immutable source/history record.

alter table public.external_filings
  add column if not exists last_status_verification_source text,
  add column if not exists last_status_verification_url text,
  add column if not exists last_status_verification_note text,
  add column if not exists last_status_verified_by_name text;

-- Older versions stamped customer-entered values as verified without an
-- agency source. Retain the filing/status while removing the unsupported claim.
update public.external_filings
set last_status_verified_at = null,
    last_status_verified_by = null,
    last_status_verification_source = null,
    last_status_verification_url = null,
    last_status_verification_note = null,
    last_status_verified_by_name = null
where last_status_verified_at is not null
   or last_status_verified_by is not null;

create or replace function app_private.normalize_external_filing_verification()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  -- The existing customer filing RPC still accepts a PATH-entered status. It
  -- cannot create an agency verification because it supplies no evidence.
  if new.last_status_verified_at is null
     or new.last_status_verified_by is null
     or nullif(trim(new.last_status_verification_source), '') is null
     or nullif(trim(new.last_status_verification_url), '') is null
     or new.last_status_verification_url !~* '^https://[^[:space:]]+$'
     or nullif(trim(new.last_status_verified_by_name), '') is null then
    new.last_status_verified_at := null;
    new.last_status_verified_by := null;
    new.last_status_verification_source := null;
    new.last_status_verification_url := null;
    new.last_status_verification_note := null;
    new.last_status_verified_by_name := null;
  else
    new.last_status_verification_source := trim(new.last_status_verification_source);
    new.last_status_verification_url := trim(new.last_status_verification_url);
    new.last_status_verification_note := nullif(trim(new.last_status_verification_note), '');
    new.last_status_verified_by_name := trim(new.last_status_verified_by_name);
  end if;
  return new;
end;
$$;
revoke all on function app_private.normalize_external_filing_verification() from public, anon, authenticated;

drop trigger if exists external_filings_normalize_verification on public.external_filings;
create trigger external_filings_normalize_verification
before insert or update on public.external_filings
for each row execute function app_private.normalize_external_filing_verification();

alter table public.external_filings
  drop constraint if exists external_filings_verification_evidence_check;
alter table public.external_filings
  add constraint external_filings_verification_evidence_check check (
    (last_status_verified_at is null
      and last_status_verified_by is null
      and last_status_verification_source is null
      and last_status_verification_url is null
      and last_status_verification_note is null
      and last_status_verified_by_name is null)
    or
    (last_status_verified_at is not null
      and last_status_verified_by is not null
      and nullif(trim(last_status_verification_source), '') is not null
      and last_status_verification_url ~* '^https://[^[:space:]]+$'
      and nullif(trim(last_status_verified_by_name), '') is not null)
  );

create table if not exists public.external_filing_status_checks (
  id uuid primary key default gen_random_uuid(),
  external_filing_id text not null references public.external_filings(id) on delete cascade,
  project_id text not null,
  previous_status text not null,
  verified_status text not null,
  source_name text not null check (nullif(trim(source_name), '') is not null),
  source_url text not null check (source_url ~* '^https://[^[:space:]]+$'),
  verification_note text,
  verified_at timestamptz not null default now(),
  verified_by_user_id uuid references auth.users(id) on delete set null,
  verified_by_name text not null
);

create index if not exists idx_external_filing_status_checks_filing_time
  on public.external_filing_status_checks(external_filing_id, verified_at desc);
create index if not exists idx_external_filing_status_checks_project_time
  on public.external_filing_status_checks(project_id, verified_at desc);

alter table public.external_filing_status_checks enable row level security;
revoke all on table public.external_filing_status_checks from public, anon;
revoke insert, update, delete on table public.external_filing_status_checks from authenticated;
grant select on table public.external_filing_status_checks to authenticated;
drop policy if exists external_filing_status_checks_read_project on public.external_filing_status_checks;
create policy external_filing_status_checks_read_project on public.external_filing_status_checks
  for select to authenticated
  using ((select app_private.has_project_access_text(project_id)));

-- Direct updates would let a project participant impersonate the issuing
-- authority. Status changes now go through the authority-checked RPC only.
drop policy if exists external_filings_update_project on public.external_filings;
revoke insert, update, delete on table public.external_filings from authenticated;
revoke all on table public.external_filings from anon;

create or replace function public.rpc_verify_external_filing_status(
  p_external_filing_id text,
  p_verified_status text,
  p_source_name text,
  p_source_url text,
  p_verification_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_authority_name text;
  v_now timestamptz := clock_timestamp();
  v_filing public.external_filings%rowtype;
  v_check public.external_filing_status_checks%rowtype;
begin
  if v_actor_id is null then
    raise exception 'authentication is required to verify an external filing status';
  end if;
  if nullif(trim(p_external_filing_id), '') is null then
    raise exception 'external filing id is required';
  end if;
  if p_verified_status is null or p_verified_status not in ('not_started', 'draft', 'submitted', 'under_review', 'additional_information', 'approved', 'denied', 'closed') then
    raise exception 'invalid external filing status: %', p_verified_status;
  end if;
  if nullif(trim(p_source_name), '') is null or length(trim(p_source_name)) > 200 then
    raise exception 'a source name between 1 and 200 characters is required';
  end if;
  if nullif(trim(p_source_url), '') is null
     or length(trim(p_source_url)) > 2048
     or trim(p_source_url) !~* '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' then
    raise exception 'a valid HTTPS agency source URL is required';
  end if;
  if nullif(trim(p_verification_note), '') is null or length(trim(p_verification_note)) > 2000 then
    raise exception 'a verification note between 1 and 2000 characters is required';
  end if;

  select * into v_filing
  from public.external_filings
  where id = trim(p_external_filing_id)
  for update;
  if not found then
    raise exception 'external filing not found: %', p_external_filing_id;
  end if;
  if not (select app_private.has_project_access_text(v_filing.project_id)) then
    raise exception 'authenticated user cannot access filing project %', v_filing.project_id;
  end if;

  if not (select app_private.is_system_admin())
     and not exists (
       select 1
       from public.organization_memberships m
       where m.organization_id::text = v_filing.authority_organization_id
         and m.user_id = v_actor_id
         and m.role = 'organization_admin'
         and m.status = 'active'
         and m.effective_from <= v_now
         and (m.effective_to is null or m.effective_to > v_now)
     ) then
    raise exception 'administrator access for the issuing authority is required';
  end if;

  v_actor_name := coalesce(
    (select nullif(trim(p.full_name), '') from public.profiles p where p.id = v_actor_id),
    (select nullif(trim(up.full_name), '') from public.user_profiles up where up.user_id = v_actor_id),
    nullif(auth.jwt() ->> 'email', ''),
    'Authenticated authority administrator'
  );
  select o.name into v_authority_name
  from public.organizations o
  where o.id::text = v_filing.authority_organization_id;

  insert into public.external_filing_status_checks (
    external_filing_id, project_id, previous_status, verified_status,
    source_name, source_url, verification_note, verified_at,
    verified_by_user_id, verified_by_name
  ) values (
    v_filing.id, v_filing.project_id, v_filing.external_status, p_verified_status,
    trim(p_source_name), trim(p_source_url), trim(p_verification_note), v_now,
    v_actor_id, v_actor_name
  ) returning * into v_check;

  update public.external_filings
  set external_status = p_verified_status,
      last_status_verified_at = v_now,
      last_status_verified_by = v_actor_id,
      last_status_verification_source = trim(p_source_name),
      last_status_verification_url = trim(p_source_url),
      last_status_verification_note = trim(p_verification_note),
      last_status_verified_by_name = v_actor_name,
      updated_at = v_now
  where id = v_filing.id
  returning * into v_filing;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason,
    project_id, created_at
  ) values (
    v_actor_id, 'external_filing_status_verified', 'external_filing',
    'external_filing', v_filing.id, v_actor_name,
    coalesce(v_authority_name, v_filing.authority_organization_name),
    'external_filing_status_verified', v_check.previous_status,
    v_check.verified_status,
    format('%s — %s (%s)', v_check.verification_note, v_check.source_name, v_check.source_url),
    v_filing.project_id, v_now
  );

  return jsonb_build_object('filing', to_jsonb(v_filing), 'verification', to_jsonb(v_check));
end;
$$;

revoke execute on function public.rpc_verify_external_filing_status(text, text, text, text, text) from public, anon;
grant execute on function public.rpc_verify_external_filing_status(text, text, text, text, text) to authenticated;
