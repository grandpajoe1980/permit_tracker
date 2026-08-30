-- Wave 1: supersede the permissive persistence migration with an explicit
-- project/organization access boundary. Historical migrations remain intact;
-- this forward migration is the effective policy state for new deployments.

create or replace function app_private.has_project_access(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = public, app_private
as $$
  select (select app_private.can_access_project(p_project_id))
    or (select app_private.is_system_admin());
$$;
revoke all on function app_private.has_project_access(uuid) from public;
grant execute on function app_private.has_project_access(uuid) to authenticated;

create or replace function app_private.has_project_access_text(p_project_id text)
returns boolean
language sql stable security definer
set search_path = public, app_private
as $$
  select exists (
    select 1 from public.projects p
    where p.id::text = p_project_id
      and (select app_private.has_project_access(p.id))
  );
$$;
revoke all on function app_private.has_project_access_text(text) from public;
grant execute on function app_private.has_project_access_text(text) to authenticated;

-- Remove every broad policy introduced by the original persistence migration.
drop policy if exists audit_events_insert on public.audit_events;
drop policy if exists audit_events_select_all on public.audit_events;
drop policy if exists notifications_insert on public.notifications;
drop policy if exists notifications_select_user on public.notifications;
drop policy if exists workstreams_update on public.workstreams;
drop policy if exists coordination_requests_insert on public.coordination_requests;
drop policy if exists coordination_requests_update on public.coordination_requests;
drop policy if exists rfis_insert on public.rfis;
drop policy if exists rfis_update on public.rfis;
drop policy if exists rfi_responses_insert on public.rfi_responses;
drop policy if exists rfi_responses_update on public.rfi_responses;
drop policy if exists document_versions_insert on public.document_versions;
drop policy if exists document_versions_update on public.document_versions;
drop policy if exists document_agency_reviews_insert on public.document_agency_reviews;
drop policy if exists document_agency_reviews_update on public.document_agency_reviews;
drop policy if exists commitments_insert on public.commitments;
drop policy if exists commitments_update on public.commitments;
drop policy if exists external_filings_insert on public.external_filings;
drop policy if exists external_filings_update on public.external_filings;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists project_participants_update on public.project_participants;

-- Direct writes are denied by default. Compound writes are performed by
-- authenticated RPCs or by a future server action that uses the RLS client.
revoke all on table public.audit_events, public.notifications,
  public.workstreams, public.coordination_requests, public.rfis,
  public.rfi_responses, public.document_versions,
  public.document_agency_reviews, public.commitments, public.external_filings,
  public.tasks, public.project_participants from anon;
revoke insert, update, delete on table public.audit_events, public.notifications,
  public.workstreams, public.coordination_requests, public.rfis,
  public.rfi_responses, public.document_versions,
  public.document_agency_reviews, public.commitments, public.external_filings,
  public.tasks, public.project_participants from authenticated;

-- Audit and notification rows are append/read-only to their authenticated
-- owner. SECURITY DEFINER RPCs still record the caller via auth.uid().
create policy audit_events_insert_actor on public.audit_events
  for insert to authenticated with check (actor_id = (select auth.uid()));
create policy audit_events_select_project on public.audit_events
  for select to authenticated using (
    actor_id = (select auth.uid())
    or (project_id is not null and (select app_private.has_project_access_text(project_id)))
    or (select app_private.is_system_admin())
  );
create policy notifications_select_recipient on public.notifications
  for select to authenticated using (
    recipient_id = (select auth.uid())
    or user_id = (select auth.uid())::text
    or user_id = (select email from auth.users where id = (select auth.uid()))
  );
create policy notifications_update_recipient on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- Project-scoped command-system access. These policies are intentionally
-- explicit so being logged in alone never grants another tenant's records.
create policy workstreams_update_project on public.workstreams
  for update to authenticated
  using (project_id is not null and (select app_private.has_project_access(project_id)))
  with check (project_id is not null and (select app_private.has_project_access(project_id)));
create policy coordination_requests_update_project on public.coordination_requests
  for update to authenticated
  using (exists (select 1 from public.workstreams w where w.id = workstream_id and (select app_private.has_project_access(w.project_id))))
  with check (exists (select 1 from public.workstreams w where w.id = workstream_id and (select app_private.has_project_access(w.project_id))));
create policy rfis_update_project on public.rfis
  for update to authenticated
  using (exists (select 1 from public.workstreams w where w.id = workstream_id and (select app_private.has_project_access(w.project_id))))
  with check (exists (select 1 from public.workstreams w where w.id = workstream_id and (select app_private.has_project_access(w.project_id))));
create policy rfi_responses_update_project on public.rfi_responses
  for update to authenticated
  using (exists (select 1 from public.rfis r join public.workstreams w on w.id = r.workstream_id where r.id = rfi_id and (select app_private.has_project_access(w.project_id))))
  with check (exists (select 1 from public.rfis r join public.workstreams w on w.id = r.workstream_id where r.id = rfi_id and (select app_private.has_project_access(w.project_id))));
create policy commitments_update_project on public.commitments
  for update to authenticated
  using (exists (select 1 from public.workstreams w where w.id = workstream_id and (select app_private.has_project_access(w.project_id))))
  with check (exists (select 1 from public.workstreams w where w.id = workstream_id and (select app_private.has_project_access(w.project_id))));
create policy external_filings_update_project on public.external_filings
  for update to authenticated
  using ((select app_private.has_project_access_text(project_id)))
  with check ((select app_private.has_project_access_text(project_id)));
create policy tasks_update_project on public.tasks
  for update to authenticated
  using (exists (select 1 from public.workstreams w where w.id = workstream_id and (select app_private.has_project_access(w.project_id))))
  with check (exists (select 1 from public.workstreams w where w.id = workstream_id and (select app_private.has_project_access(w.project_id))));
create policy project_participants_update_project on public.project_participants
  for update to authenticated
  using ((select app_private.has_project_access(project_id)))
  with check ((select app_private.has_project_access(project_id)));

-- Customer intake is canonical and project-scoped. The legacy `requests`
-- table is not part of this application intake policy.
drop policy if exists customer_requests_select on public.customer_requests;
drop policy if exists customer_requests_insert on public.customer_requests;
drop policy if exists customer_requests_update on public.customer_requests;
create policy customer_requests_select_project on public.customer_requests
  for select to authenticated using (
    submitted_by_user_id = (select auth.uid())
    or (select app_private.has_project_access_text(project_id))
  );
create policy customer_requests_insert_project on public.customer_requests
  for insert to authenticated with check (
    submitted_by_user_id = (select auth.uid())
    and (select app_private.has_project_access_text(project_id))
  );
create policy customer_requests_update_project on public.customer_requests
  for update to authenticated
  using ((select app_private.has_project_access_text(project_id)) or (submitted_by_user_id = (select auth.uid()) and status = 'draft'))
  with check ((select app_private.has_project_access_text(project_id)) or (submitted_by_user_id = (select auth.uid()) and status = 'draft'));

-- Secure Storage remains private and only metadata-authorized objects can be
-- accessed. The policy is repeated here so this migration is self-contained.
drop policy if exists path_documents_read on storage.objects;
drop policy if exists path_documents_insert on storage.objects;
drop policy if exists path_documents_delete on storage.objects;
create policy path_documents_read on storage.objects
  for select to authenticated using (
    bucket_id = 'path-documents'
    and exists (select 1 from public.documents d where d.id::text = (storage.foldername(name))[1]
      and ((d.project_id is not null and (select app_private.has_project_access(d.project_id)))
        or (d.request_id is not null and (select app_private.can_access_request(d.request_id)))
        or (select app_private.is_system_admin())))
  );
create policy path_documents_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'path-documents'
    and exists (select 1 from public.documents d where d.id::text = (storage.foldername(name))[1]
      and ((d.project_id is not null and (select app_private.has_project_access(d.project_id)))
        or (d.request_id is not null and (select app_private.can_access_request(d.request_id)))
        or (select app_private.is_system_admin())))
  );
create policy path_documents_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'path-documents'
    and exists (select 1 from public.documents d where d.id::text = (storage.foldername(name))[1]
      and ((d.project_id is not null and (select app_private.has_project_access(d.project_id)))
        or (d.request_id is not null and (select app_private.can_access_request(d.request_id)))
        or (select app_private.is_system_admin())))
  );
