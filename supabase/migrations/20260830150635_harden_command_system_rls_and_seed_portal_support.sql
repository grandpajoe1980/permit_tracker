-- Harden the command-system tables that were created by the initial relational
-- migration and finish the customer portal's relational foundation.
-- This migration is intentionally additive: the earlier migration is already
-- present in some environments and must not be edited in place.

create or replace function app_private.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('system_admin', 'organization_admin')
  );
$$;

revoke all on function app_private.is_system_admin() from public;
grant execute on function app_private.is_system_admin() to authenticated;

-- The original project_participants key allowed only one person per
-- organization. Keep organization-only legacy rows possible, but allow each
-- user to have a first-class participant row for the same project.
alter table public.project_participants
  drop constraint if exists project_participants_project_id_organization_id_key;

create unique index if not exists idx_project_participants_project_user
  on public.project_participants (project_id, user_id)
  where user_id is not null;

create index if not exists idx_project_participants_user_active
  on public.project_participants (user_id, is_active);

alter table public.document_versions
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

update public.document_versions v
set project_id = p.id
from public.projects p
where p.number = 'PRJ-PECAN-2026'
  and v.project_id is null;

create index if not exists idx_document_versions_project
  on public.document_versions (project_id, uploaded_at desc);

-- Add the organizations needed by the seeded project participants and keep
-- names explicit so contact and assignment records are not display strings.
insert into public.organizations (code, name, organization_type, jurisdiction_level)
values
  ('LED', 'Louisiana Economic Development (LED)', 'state_agency', 'state'),
  ('LDEQ', 'Louisiana Department of Environmental Quality', 'state_agency', 'state'),
  ('DOTD', 'Louisiana Department of Transportation and Development', 'state_agency', 'state'),
  ('CPRA', 'Coastal Protection and Restoration Authority', 'state_agency', 'state'),
  ('USACE', 'U.S. Army Corps of Engineers — New Orleans District', 'federal_agency', 'federal'),
  ('VERMILION', 'Vermilion Parish Police Jury', 'local_government', 'local'),
  ('SPACEX', 'Space Exploration Technologies Corp. (SpaceX)', 'customer', 'external_partner')
  ,('STATEPO', 'Louisiana Governor''s Office of Major Projects & Delivery', 'state_office', 'state')
  ,('COASTAL_ENGINEERING', 'Gulf Coast Engineering Partners', 'consultant', 'external_partner')
on conflict (code) do update set
  name = excluded.name,
  organization_type = excluded.organization_type,
  jurisdiction_level = excluded.jurisdiction_level,
  active = true,
  updated_at = now();

-- Remove the unsafe permissive policy installed by the original relational
-- migration. RLS policies are ORed, so leaving it in place would defeat every
-- narrower policy created below.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'permit_types', 'requirement_resources', 'workflow_versions',
    'workstreams', 'tasks', 'task_dependencies', 'coordination_requests',
    'rfis', 'rfi_responses', 'document_versions',
    'document_agency_reviews', 'commitments', 'decisions', 'meetings',
    'project_participants'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'Public full access policy', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select on table public.%I to authenticated', table_name);
  end loop;
end;
$$;

drop policy if exists permit_types_select on public.permit_types;
create policy permit_types_select on public.permit_types
for select to authenticated using (true);

drop policy if exists requirement_resources_select on public.requirement_resources;
create policy requirement_resources_select on public.requirement_resources
for select to authenticated using (true);

drop policy if exists workflow_versions_select on public.workflow_versions;
create policy workflow_versions_select on public.workflow_versions
for select to authenticated using (
  workflow_id is null
  or exists (
    select 1 from public.workflow_definitions w
    where w.id = workflow_id
      and ((select app_private.is_org_member(w.organization_id))
        or (select app_private.is_system_admin()))
  )
);

drop policy if exists workstreams_select on public.workstreams;
create policy workstreams_select on public.workstreams
for select to authenticated using (
  (project_id is not null and (select app_private.can_access_project(project_id)))
  or (select app_private.is_system_admin())
);

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
for select to authenticated using (
  exists (
    select 1 from public.workstreams w
    where w.id = workstream_id
      and (
        (w.project_id is not null and (select app_private.can_access_project(w.project_id)))
        or (select app_private.is_system_admin())
      )
  )
);

drop policy if exists task_dependencies_select on public.task_dependencies;
create policy task_dependencies_select on public.task_dependencies
for select to authenticated using (
  exists (
    select 1
    from public.tasks predecessor
    join public.workstreams w on w.id = predecessor.workstream_id
    where predecessor.id = predecessor_task_id
      and w.project_id is not null
      and ((select app_private.can_access_project(w.project_id))
        or (select app_private.is_system_admin()))
  )
  and exists (
    select 1
    from public.tasks successor
    join public.workstreams w on w.id = successor.workstream_id
    where successor.id = successor_task_id
      and w.project_id is not null
      and ((select app_private.can_access_project(w.project_id))
        or (select app_private.is_system_admin()))
  )
);

drop policy if exists coordination_requests_select on public.coordination_requests;
create policy coordination_requests_select on public.coordination_requests
for select to authenticated using (
  exists (
    select 1 from public.workstreams w
    where w.id = workstream_id
      and w.project_id is not null
      and ((select app_private.can_access_project(w.project_id))
        or (select app_private.is_system_admin()))
  )
);

drop policy if exists rfis_select on public.rfis;
create policy rfis_select on public.rfis
for select to authenticated using (
  exists (
    select 1 from public.workstreams w
    where w.id = workstream_id
      and w.project_id is not null
      and ((select app_private.can_access_project(w.project_id))
        or (select app_private.is_system_admin()))
  )
);

drop policy if exists rfi_responses_select on public.rfi_responses;
create policy rfi_responses_select on public.rfi_responses
for select to authenticated using (
  exists (
    select 1
    from public.rfis r
    join public.workstreams w on w.id = r.workstream_id
    where r.id = rfi_id
      and w.project_id is not null
      and ((select app_private.can_access_project(w.project_id))
        or (select app_private.is_system_admin()))
  )
);

drop policy if exists document_versions_select on public.document_versions;
create policy document_versions_select on public.document_versions
for select to authenticated using (
  (project_id is not null and ((select app_private.can_access_project(project_id))
    or (select app_private.is_system_admin())))
  or (
    document_id is not null
    and exists (
      select 1 from public.documents d
      where d.id = document_id
        and ((d.request_id is not null and (select app_private.can_access_request(d.request_id)))
          or (d.project_id is not null and (select app_private.can_access_project(d.project_id)))
          or (select app_private.is_system_admin()))
    )
  )
);

drop policy if exists document_agency_reviews_select on public.document_agency_reviews;
create policy document_agency_reviews_select on public.document_agency_reviews
for select to authenticated using (
  exists (
    select 1 from public.document_versions v
    where v.id = document_version_id
      and (
        (v.project_id is not null and ((select app_private.can_access_project(v.project_id))
          or (select app_private.is_system_admin())))
        or (v.document_id is not null and exists (
          select 1 from public.documents d
          where d.id = v.document_id
            and ((d.request_id is not null and (select app_private.can_access_request(d.request_id)))
              or (d.project_id is not null and (select app_private.can_access_project(d.project_id)))
              or (select app_private.is_system_admin()))
        ))
      )
  )
);

drop policy if exists commitments_select on public.commitments;
create policy commitments_select on public.commitments
for select to authenticated using (
  exists (
    select 1 from public.workstreams w
    where w.id = workstream_id
      and w.project_id is not null
      and ((select app_private.can_access_project(w.project_id))
        or (select app_private.is_system_admin()))
  )
);

drop policy if exists decisions_select on public.decisions;
create policy decisions_select on public.decisions
for select to authenticated using (
  (project_id is not null and ((select app_private.can_access_project(project_id))
    or (select app_private.is_system_admin())))
);

drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
for select to authenticated using (
  (project_id is not null and ((select app_private.can_access_project(project_id))
    or (select app_private.is_system_admin())))
);

drop policy if exists "participants are visible to authorized users" on public.project_participants;
drop policy if exists project_participants_select on public.project_participants;
create policy project_participants_select on public.project_participants
for select to authenticated using (
  is_active = true
  and (select app_private.can_access_project(project_id))
  and (
    coalesce(visibility_scope, access_scope, 'project') <> 'admin'
    or (select app_private.is_system_admin())
  )
);

-- The customer directory exposes only explicitly publishable profile rows;
-- contact edits remain self-service, while administrators use the admin path.
drop policy if exists "project users can read visible profiles" on public.user_profiles;
drop policy if exists "users can update their contact fields" on public.user_profiles;
create policy user_profiles_select on public.user_profiles
for select to authenticated using (
  is_active = true
  and (
    user_id = (select auth.uid())
    or is_customer_visible = true
    or (select app_private.is_system_admin())
    or exists (
      select 1 from public.organization_memberships m
      where m.user_id = (select auth.uid()) and m.status = 'active'
    )
  )
);
create policy user_profiles_update on public.user_profiles
for update to authenticated
using (user_id = (select auth.uid()) or (select app_private.is_system_admin()))
with check (user_id = (select auth.uid()) or (select app_private.is_system_admin()));

drop policy if exists "filings are visible to authenticated users" on public.external_filings;
create policy external_filings_select on public.external_filings
for select to authenticated using (
  exists (
    select 1 from public.projects p
    where p.id::text = project_id
      and ((select app_private.can_access_project(p.id))
        or (select app_private.is_system_admin()))
  )
);

drop policy if exists "customers can submit requests" on public.customer_requests;
drop policy if exists "request submitters and government users can read requests" on public.customer_requests;
create policy customer_requests_select on public.customer_requests
for select to authenticated using (
  submitted_by_user_id = (select auth.uid())
  or (select app_private.is_system_admin())
  or exists (
    select 1 from public.organization_memberships m
    where m.user_id = (select auth.uid()) and m.status = 'active'
  )
);
create policy customer_requests_insert on public.customer_requests
for insert to authenticated
with check (
  submitted_by_user_id = (select auth.uid())
  and (select app_private.is_customer_org_member(
    (select p.customer_organization_id from public.profiles p where p.id = (select auth.uid()))
  ))
);
create policy customer_requests_update_government on public.customer_requests
for update to authenticated
using (
  (select app_private.is_system_admin())
  or exists (
    select 1 from public.organization_memberships m
    where m.user_id = (select auth.uid()) and m.status = 'active'
  )
)
with check (
  (select app_private.is_system_admin())
  or exists (
    select 1 from public.organization_memberships m
    where m.user_id = (select auth.uid()) and m.status = 'active'
  )
);
create policy customer_requests_update_own_draft on public.customer_requests
for update to authenticated
using (submitted_by_user_id = (select auth.uid()) and status = 'draft')
with check (submitted_by_user_id = (select auth.uid()) and status = 'draft');

revoke all on table public.user_profiles, public.external_filings, public.customer_requests from anon;
grant select on public.user_profiles, public.external_filings, public.customer_requests to authenticated;
revoke update on public.user_profiles from authenticated;
grant update (
  display_title, organizational_unit, work_email, office_phone, mobile_phone,
  office_location, preferred_contact_method, availability_status, avatar_url
) on public.user_profiles to authenticated;
grant insert on public.customer_requests to authenticated;
grant update (status, requested_outcome, location_or_affected_area, desired_date,
  schedule_importance, known_agency_code, known_permit_type_id,
  related_workstream_id, blocks_active_work, attachment_document_version_ids)
  on public.customer_requests to authenticated;

create index if not exists idx_workstreams_project_state
  on public.workstreams (project_id, operational_state, forecast_target_date);
create index if not exists idx_tasks_workstream_status
  on public.tasks (workstream_id, status);
create index if not exists idx_customer_requests_submitter
  on public.customer_requests (submitted_by_user_id, created_at desc);
