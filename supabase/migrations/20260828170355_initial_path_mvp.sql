-- PATH MVP schema. Apply with `supabase db push` after linking this project.
-- All application tables are tenant-scoped and protected by RLS.

create extension if not exists pgcrypto;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and length(code) between 2 and 32),
  name text not null,
  organization_type text not null default 'agency',
  jurisdiction_level text not null default 'state' check (jurisdiction_level in ('local', 'state', 'federal', 'external_partner')),
  active boolean not null default true,
  contacts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  status text not null default 'active' check (status in ('active', 'invited', 'suspended', 'deactivated')),
  customer_organization_id uuid references public.customer_organizations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('contributor', 'supervisor', 'organization_admin', 'system_admin')),
  status text not null default 'active' check (status in ('active', 'pending', 'suspended', 'expired')),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('PRJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  name text not null,
  customer_organization_id uuid not null references public.customer_organizations(id),
  lead_organization_id uuid not null references public.organizations(id),
  project_type text,
  location jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('draft', 'active', 'on_hold', 'completed', 'archived')),
  risk text not null default 'normal' check (risk in ('normal', 'at_risk', 'blocked')),
  start_date date,
  target_date date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_participants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  participation_role text not null default 'reviewing' check (participation_role in ('lead', 'coordinating', 'reviewing', 'consulting', 'notified')),
  access_scope text not null default 'project' check (access_scope in ('project', 'workstream', 'documents')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, organization_id)
);

create table if not exists public.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_type text not null,
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, case_type, version)
);

create table if not exists public.workflow_stages (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflow_definitions(id) on delete cascade,
  stage_key text not null,
  label text not null,
  sort_order integer not null check (sort_order > 0),
  allowed_transitions jsonb not null default '[]'::jsonb,
  required_documents jsonb not null default '[]'::jsonb,
  service_target_days integer check (service_target_days is null or service_target_days >= 0),
  minimum_processing_days integer check (minimum_processing_days is null or minimum_processing_days >= 0),
  unique (workflow_id, stage_key),
  unique (workflow_id, sort_order)
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('PATH-' || to_char(current_date, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  project_id uuid references public.projects(id),
  submitter_id uuid not null references auth.users(id),
  owning_organization_id uuid not null references public.organizations(id),
  request_type text not null,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'in_review', 'action_required', 'on_hold', 'completed', 'withdrawn', 'archived')),
  current_stage text not null default 'intake',
  next_action text,
  submitted_at timestamptz,
  due_date date,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_workflows (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.requests(id) on delete cascade,
  workflow_id uuid not null references public.workflow_definitions(id),
  stage_key text not null,
  clock_state text not null default 'running' check (clock_state in ('running', 'paused', 'extended', 'complete')),
  minimum_completion_date date,
  target_completion_date date,
  updated_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  assignee_user_id uuid references auth.users(id),
  assignee_organization_id uuid references public.organizations(id),
  assignment_role text not null default 'owner' check (assignment_role in ('owner', 'reviewer', 'coordinator', 'supervisor')),
  due_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  check (assignee_user_id is not null or assignee_organization_id is not null)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  owner_organization_id uuid not null references public.organizations(id),
  storage_path text not null unique,
  document_type text not null,
  visibility text not null default 'customer' check (visibility in ('customer', 'organization', 'participants', 'restricted')),
  version integer not null default 1 check (version > 0),
  scan_status text not null default 'pending' check (scan_status in ('pending', 'clean', 'blocked', 'failed')),
  retention_category text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (request_id is not null or project_id is not null)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid references public.requests(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null,
  channel text not null default 'in_app' check (channel in ('in_app', 'email')),
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed', 'read')),
  dedupe_key text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  organization_id uuid references public.organizations(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  before_data jsonb,
  after_data jsonb,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_memberships_user_active on public.organization_memberships (user_id, status);
create index if not exists idx_memberships_org_active on public.organization_memberships (organization_id, status);
create index if not exists idx_projects_customer on public.projects (customer_organization_id, status);
create index if not exists idx_projects_lead on public.projects (lead_organization_id, status);
create index if not exists idx_requests_submitter on public.requests (submitter_id, created_at desc);
create index if not exists idx_requests_org_status on public.requests (owning_organization_id, status, created_at desc);
create index if not exists idx_requests_project on public.requests (project_id, created_at desc);
create index if not exists idx_assignments_user_active on public.assignments (assignee_user_id, status, due_date);
create index if not exists idx_notifications_recipient on public.notifications (recipient_id, delivery_status, created_at desc);
create index if not exists idx_audit_resource on public.audit_events (resource_type, resource_id, created_at desc);

create or replace function app_private.is_org_member(p_org_id uuid)
returns boolean language sql stable security definer set search_path = public, app_private
as $$ select exists (
  select 1 from public.organization_memberships m
  where m.organization_id = p_org_id and m.user_id = (select auth.uid())
    and m.status = 'active'
    and m.effective_from <= now()
    and (m.effective_to is null or m.effective_to > now())
); $$;

create or replace function app_private.is_customer_org_member(p_customer_org_id uuid)
returns boolean language sql stable security definer set search_path = public, app_private
as $$ select exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.customer_organization_id = p_customer_org_id and p.status = 'active'
); $$;

create or replace function app_private.can_access_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public, app_private
as $$ select exists (
  select 1 from public.projects p
  where p.id = p_project_id
    and (app_private.is_customer_org_member(p.customer_organization_id)
      or app_private.is_org_member(p.lead_organization_id)
      or exists (select 1 from public.project_participants pp where pp.project_id = p.id and app_private.is_org_member(pp.organization_id) and (pp.expires_at is null or pp.expires_at > now())))
); $$;

create or replace function app_private.can_access_request(p_request_id uuid)
returns boolean language sql stable security definer set search_path = public, app_private
as $$ select exists (
  select 1 from public.requests r
  where r.id = p_request_id
    and (r.submitter_id = (select auth.uid()) or app_private.is_org_member(r.owning_organization_id) or (r.project_id is not null and app_private.can_access_project(r.project_id)))
); $$;

create or replace function app_private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, app_private
as $$ begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end; $$;

revoke all on function app_private.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

revoke all on function app_private.is_org_member(uuid) from public;
revoke all on function app_private.is_customer_org_member(uuid) from public;
revoke all on function app_private.can_access_project(uuid) from public;
revoke all on function app_private.can_access_request(uuid) from public;
grant execute on function app_private.is_org_member(uuid) to authenticated;
grant execute on function app_private.is_customer_org_member(uuid) to authenticated;
grant execute on function app_private.can_access_project(uuid) to authenticated;
grant execute on function app_private.can_access_request(uuid) to authenticated;

do $$ declare t text; begin
  foreach t in array array['organizations','customer_organizations','profiles','organization_memberships','projects','project_participants','workflow_definitions','workflow_stages','requests','case_workflows','assignments','documents','notifications','audit_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select on table public.%I to authenticated', t);
  end loop;
end $$;
grant insert, update on public.profiles, public.requests, public.documents to authenticated;

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to authenticated using ((select app_private.is_org_member(id)));
drop policy if exists customer_org_select on public.customer_organizations;
create policy customer_org_select on public.customer_organizations for select to authenticated using ((select app_private.is_customer_org_member(id)));
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()) or (customer_organization_id is not null and (select app_private.is_customer_org_member(customer_organization_id))));
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists memberships_select on public.organization_memberships;
create policy memberships_select on public.organization_memberships for select to authenticated using (user_id = (select auth.uid()) or (select app_private.is_org_member(organization_id)));
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated using ((select app_private.can_access_project(id)));
drop policy if exists requests_select on public.requests;
create policy requests_select on public.requests for select to authenticated using ((select app_private.can_access_request(id)));
drop policy if exists requests_insert on public.requests;
create policy requests_insert on public.requests for insert to authenticated with check (submitter_id = (select auth.uid()));
drop policy if exists requests_update on public.requests;
create policy requests_update on public.requests for update to authenticated using (submitter_id = (select auth.uid()) or (select app_private.is_org_member(owning_organization_id))) with check (submitter_id = (select auth.uid()) or (select app_private.is_org_member(owning_organization_id)));
drop policy if exists workflows_select on public.workflow_definitions;
create policy workflows_select on public.workflow_definitions for select to authenticated using ((select app_private.is_org_member(organization_id)));
drop policy if exists stages_select on public.workflow_stages;
create policy stages_select on public.workflow_stages for select to authenticated using (exists (select 1 from public.workflow_definitions w where w.id = workflow_id and app_private.is_org_member(w.organization_id)));
drop policy if exists case_workflows_select on public.case_workflows;
create policy case_workflows_select on public.case_workflows for select to authenticated using ((select app_private.can_access_request(request_id)));
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments for select to authenticated using (assignee_user_id = (select auth.uid()) or (assignee_organization_id is not null and (select app_private.is_org_member(assignee_organization_id))) or (select app_private.can_access_request(request_id)));
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select to authenticated using ((select app_private.can_access_request(request_id)) or (project_id is not null and (select app_private.can_access_project(project_id))));
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (recipient_id = (select auth.uid()));
drop policy if exists audit_select on public.audit_events;
create policy audit_select on public.audit_events for select to authenticated using (actor_id = (select auth.uid()) or (organization_id is not null and (select app_private.is_org_member(organization_id))));

insert into public.organizations (code, name, organization_type, jurisdiction_level)
values ('LDEQ', 'Louisiana Department of Environmental Quality', 'agency', 'state')
on conflict (code) do nothing;

insert into storage.buckets (id, name, public)
values ('path-documents', 'path-documents', false)
on conflict (id) do update set public = false;

alter table storage.objects enable row level security;
drop policy if exists path_documents_read on storage.objects;
create policy path_documents_read on storage.objects for select to authenticated using (
  bucket_id = 'path-documents' and exists (
    select 1 from public.documents d
    where d.storage_path = name and d.scan_status = 'clean'
      and ((d.request_id is not null and app_private.can_access_request(d.request_id))
        or (d.project_id is not null and app_private.can_access_project(d.project_id)))
  )
);
drop policy if exists path_documents_insert on storage.objects;
create policy path_documents_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'path-documents' and exists (
    select 1 from public.documents d
    where d.storage_path = name
      and ((d.request_id is not null and app_private.can_access_request(d.request_id))
        or (d.project_id is not null and app_private.can_access_project(d.project_id)))
  )
);
drop policy if exists path_documents_update on storage.objects;
create policy path_documents_update on storage.objects for update to authenticated using (
  bucket_id = 'path-documents' and exists (select 1 from public.documents d where d.storage_path = name and app_private.can_access_request(d.request_id))
) with check (bucket_id = 'path-documents');
drop policy if exists path_documents_delete on storage.objects;
create policy path_documents_delete on storage.objects for delete to authenticated using (
  bucket_id = 'path-documents' and exists (select 1 from public.documents d where d.storage_path = name and app_private.can_access_request(d.request_id))
);
