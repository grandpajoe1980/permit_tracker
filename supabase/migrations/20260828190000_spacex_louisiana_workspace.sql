-- SpaceX Louisiana proof-of-concept workspace.
-- One customer workspace, with internal teams receiving requests by category.

update public.organizations
set code = 'SPACEPORT', name = 'SpaceX Louisiana Spaceport Program', organization_type = 'program', jurisdiction_level = 'external_partner'
where code = 'LDEQ';

insert into public.organizations (code, name, organization_type, jurisdiction_level)
values
  ('ENVIRONMENT', 'Environmental and Coastal Permitting', 'internal_team', 'state'),
  ('INFRASTRUCTURE', 'Infrastructure and Civil Works', 'internal_team', 'state'),
  ('COMMUNITY', 'Community and Facilities', 'internal_team', 'local'),
  ('SAFETY', 'Safety and Emergency Management', 'internal_team', 'state')
on conflict (code) do update set name = excluded.name, organization_type = excluded.organization_type, jurisdiction_level = excluded.jurisdiction_level;

insert into public.customer_organizations (name, legal_name)
values ('SpaceX Louisiana', 'Space Exploration Technologies Corp. — Louisiana Program')
on conflict do nothing;

alter table public.projects add column if not exists description text;
alter table public.requests add column if not exists priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical'));
alter table public.requests add column if not exists category text;
alter table public.requests add column if not exists applicant_name text;
alter table public.requests add column if not exists organization_name text;
alter table public.requests add column if not exists status_label text;
alter table public.requests add column if not exists current_day integer not null default 0 check (current_day >= 0);
alter table public.requests add column if not exists total_days integer not null default 180 check (total_days > 0);
alter table public.requests add column if not exists owner_name text;
alter table public.requests add column if not exists owner_email text;
alter table public.requests add column if not exists contact_phone text;

create or replace function app_private.default_request_team()
returns trigger language plpgsql security definer set search_path = public, app_private
as $$
declare team_code text;
begin
  team_code := case
    when lower(coalesce(new.category, '') || ' ' || new.request_type || ' ' || new.title) ~ '(wetland|beach|dredg|ocean|coastal|water|environment)' then 'ENVIRONMENT'
    when lower(coalesce(new.category, '') || ' ' || new.request_type || ' ' || new.title) ~ '(road|airport|tower|factory|restaurant|utility|building|civil)' then 'INFRASTRUCTURE'
    when lower(coalesce(new.category, '') || ' ' || new.request_type || ' ' || new.title) ~ '(community|housing|school|food|public)' then 'COMMUNITY'
    when lower(coalesce(new.category, '') || ' ' || new.request_type || ' ' || new.title) ~ '(fire|safety|emergency|security)' then 'SAFETY'
    else 'SPACEPORT'
  end;
  select id into new.owning_organization_id from public.organizations where code = team_code and active;
  return new;
end;
$$;
revoke all on function app_private.default_request_team() from public;
drop trigger if exists requests_assign_team on public.requests;
create trigger requests_assign_team before insert on public.requests for each row execute function app_private.default_request_team();

drop policy if exists requests_insert on public.requests;
create policy requests_insert on public.requests for insert to authenticated
with check (submitter_id = (select auth.uid()) and (select app_private.is_customer_org_member((select p.customer_organization_id from public.profiles p where p.id = (select auth.uid())))));

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert to authenticated with check (recipient_id = (select auth.uid()));

insert into public.projects (number, name, description, customer_organization_id, lead_organization_id, project_type, location, status, risk, start_date, target_date)
select 'PRJ-PECAN-2026', 'Pecan Island Spaceport Buildout', 'Illustrative two-month construction and permitting program for a SpaceX Louisiana coastal spaceport.', c.id, o.id, 'Spaceport master development', '{"parish":"Vermilion","region":"Pecan Island","state":"Louisiana"}'::jsonb, 'active', 'at_risk', current_date - 60, current_date + 1100
from public.customer_organizations c, public.organizations o
where c.name = 'SpaceX Louisiana' and o.code = 'SPACEPORT'
on conflict (number) do update set description = excluded.description, updated_at = now();

insert into public.workflow_definitions (organization_id, case_type, version, active)
select id, 'spaceport_request', 1, true from public.organizations where code = 'SPACEPORT'
on conflict (organization_id, case_type, version) do nothing;

insert into public.workflow_stages (workflow_id, stage_key, label, sort_order, service_target_days)
select w.id, s.stage_key, s.label, s.sort_order, s.days
from public.workflow_definitions w
cross join (values ('intake','Request intake',1,5),('technical_review','Technical team review',2,30),('agency_coordination','Agency coordination',3,45),('construction_release','Construction release',4,30),('monitoring','Monitoring and closeout',5,60)) s(stage_key,label,sort_order,days)
where w.case_type = 'spaceport_request'
on conflict (workflow_id, stage_key) do nothing;
