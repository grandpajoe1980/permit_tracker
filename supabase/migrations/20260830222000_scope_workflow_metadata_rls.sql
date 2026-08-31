-- Wave 9 security follow-up: workflow transition and checklist metadata is
-- project-scoped. Reference metadata must not become a cross-tenant read
-- channel merely because the caller is authenticated.

drop policy if exists workflow_transitions_select on public.workflow_transitions;
create policy workflow_transitions_select_project on public.workflow_transitions
for select to authenticated using (
  (select app_private.is_system_admin())
  or exists (
    select 1
    from public.workflow_versions v
    join public.workstreams w on w.workflow_version_id = v.id
    where v.id = workflow_version_id
      and w.project_id is not null
      and (select app_private.has_project_access(w.project_id))
  )
);

drop policy if exists workflow_checklist_items_select on public.workflow_checklist_items;
create policy workflow_checklist_items_select_project on public.workflow_checklist_items
for select to authenticated using (
  (select app_private.is_system_admin())
  or exists (
    select 1
    from public.workflow_versions v
    join public.workstreams w on w.workflow_version_id = v.id
    where v.id = workflow_version_id
      and w.project_id is not null
      and (select app_private.has_project_access(w.project_id))
  )
);
