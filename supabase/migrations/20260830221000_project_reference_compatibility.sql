-- Normalize legacy text references emitted by the original fixture-backed
-- customer portal to the canonical projects.id value used by PostgreSQL.
do $$
declare
  v_project_id uuid;
begin
  select id into v_project_id from public.projects where number = 'PRJ-PECAN-2026';
  if v_project_id is not null then
    update public.customer_requests
    set project_id = v_project_id::text
    where project_id = 'proj-spacex-pecan';

    update public.external_filings
    set project_id = v_project_id::text
    where project_id = 'proj-spacex-pecan';

    update public.audit_events
    set project_id = v_project_id::text
    where project_id = 'proj-spacex-pecan';
  end if;
end;
$$;

-- Triage must accept only canonical project ids/numbers, while still being
-- able to process requests created before this compatibility migration ran.
create or replace function app_private.require_project_admin(p_project_ref text)
returns uuid
language plpgsql security definer
set search_path = public, app_private
as $$
declare
  v_project_id uuid;
begin
  if auth.uid() is null or not (select app_private.is_system_admin()) then
    raise exception 'project administrator capability required';
  end if;
  select p.id into v_project_id from public.projects p
  where p.id::text = p_project_ref
     or p.number = p_project_ref
     or (p.number = 'PRJ-PECAN-2026' and p_project_ref = 'proj-spacex-pecan')
  limit 1;
  if v_project_id is null then raise exception 'project not found: %', p_project_ref; end if;
  if not (select app_private.has_project_access(v_project_id)) then
    raise exception 'authenticated user cannot access project %', p_project_ref;
  end if;
  return v_project_id;
end;
$$;

revoke all on function app_private.require_project_admin(text) from public, anon;
grant execute on function app_private.require_project_admin(text) to authenticated;
