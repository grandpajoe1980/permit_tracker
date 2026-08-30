-- Corrective migration for the deployed customer-portal schema. This is
-- intentionally additive: the preceding portal migrations are already live.

-- Remove permissive policies before adding scoped replacements. PostgreSQL
-- combines policies with OR, so leaving a legacy policy in place defeats a
-- restrictive new policy.
drop policy if exists audit_events_anon_all on public.audit_events;
drop policy if exists audit_events_select_all on public.audit_events;
drop policy if exists audit_events_insert on public.audit_events;
drop policy if exists customer_requests_anon_insert on public.customer_requests;
drop policy if exists customer_requests_anon_select on public.customer_requests;
drop policy if exists notifications_anon_all on public.notifications;
drop policy if exists notifications_select_user on public.notifications;
drop policy if exists notifications_update_user on public.notifications;
drop policy if exists project_participants_update on public.project_participants;
drop policy if exists requests_update on public.requests;
drop policy if exists profiles_update on public.profiles;
drop policy if exists user_profiles_update on public.user_profiles;
drop policy if exists document_versions_insert on public.document_versions;
drop policy if exists document_versions_update on public.document_versions;

revoke insert, update, delete on public.audit_events, public.customer_requests,
  public.notifications, public.project_participants, public.requests,
  public.profiles, public.user_profiles, public.document_versions from authenticated, anon;

create policy audit_events_select_scoped on public.audit_events for select to authenticated using (
  actor_id = auth.uid() or app_private.is_system_admin()
);
create policy notifications_select_scoped on public.notifications for select to authenticated using (
  recipient_id = auth.uid()
  or user_id = auth.uid()::text
  or user_id = (select email from auth.users where id = auth.uid())
  or app_private.is_system_admin()
);
create policy notifications_update_scoped on public.notifications for update to authenticated
  using (recipient_id = auth.uid() or user_id = auth.uid()::text or app_private.is_system_admin())
  with check (recipient_id = auth.uid() or user_id = auth.uid()::text or app_private.is_system_admin());

-- Customer submission is a single transaction. The caller, customer
-- organization, project, status, confirmation number, audit actor, and route
-- are derived here; browser-provided actor/project/status fields are ignored.
create or replace function public.rpc_create_customer_request(
  p_id text, p_confirmation_number text, p_project_id text, p_request_type text,
  p_title text, p_description text, p_requested_outcome text default null,
  p_location_or_affected_area text default null, p_desired_date date default null,
  p_schedule_importance text default 'normal', p_known_agency_code text default null,
  p_known_permit_type_id text default null, p_submitted_by_user_id uuid default null,
  p_submitted_by_name text default 'SpaceX Representative', p_related_workstream_id text default null,
  p_blocks_active_work boolean default false, p_status text default 'submitted',
  p_attachment_document_version_ids jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path = public, app_private as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_project public.projects%rowtype;
  v_request public.customer_requests%rowtype;
  v_now timestamptz := now();
  v_request_id text;
  v_confirmation text;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if nullif(btrim(p_title), '') is null or nullif(btrim(p_request_type), '') is null then
    raise exception 'title and request type are required';
  end if;
  select * into v_profile from public.profiles where id = v_actor and status = 'active';
  if not found or v_profile.customer_organization_id is null then
    raise exception 'active customer profile required';
  end if;
  select * into v_project from public.projects
    where customer_organization_id = v_profile.customer_organization_id and status = 'active'
    order by created_at asc limit 1;
  if not found then raise exception 'no active project is available for this customer organization'; end if;
  v_request_id := 'CREQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  v_confirmation := 'PATH-' || to_char(current_date, 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.customer_requests (
    id, confirmation_number, project_id, request_type, title, description,
    requested_outcome, location_or_affected_area, desired_date, schedule_importance,
    known_agency_code, known_permit_type_id, submitted_by_user_id, submitted_by_name,
    related_workstream_id, blocks_active_work, status, attachment_document_version_ids,
    created_at, updated_at
  ) values (
    v_request_id, v_confirmation, v_project.id::text, btrim(p_request_type), btrim(p_title), nullif(btrim(p_description), ''),
    nullif(btrim(p_requested_outcome), ''), nullif(btrim(p_location_or_affected_area), ''), p_desired_date,
    case when p_schedule_importance in ('low','normal','high','critical') then p_schedule_importance else 'normal' end,
    nullif(btrim(p_known_agency_code), ''), nullif(btrim(p_known_permit_type_id), ''), v_actor,
    coalesce(v_profile.full_name, (select email from auth.users where id = v_actor), 'Customer'),
    null, false, 'submitted', coalesce(p_attachment_document_version_ids, '[]'::jsonb), v_now, v_now
  ) returning * into v_request;
  insert into public.audit_events (
    id, correlation_id, actor_id, action, resource_type, entity_type, entity_id,
    actor_name, action_type, new_value, reason, project_id, created_at
  ) values (
    gen_random_uuid(), gen_random_uuid(), v_actor, 'customer_request_submitted', 'customer_request',
    'customer_request', v_request.confirmation_number, coalesce(v_profile.full_name, 'Customer'),
    'customer_request_submitted', v_request.request_type || ' · ' || v_request.title,
    v_request.description, v_project.id::text, v_now
  );
  return to_jsonb(v_request);
end;
$$;

revoke all on function public.rpc_create_customer_request(text,text,text,text,text,text,text,text,date,text,text,text,uuid,text,text,boolean,text,jsonb) from public, anon;
grant execute on function public.rpc_create_customer_request(text,text,text,text,text,text,text,text,date,text,text,text,uuid,text,text,boolean,text,jsonb) to authenticated;
