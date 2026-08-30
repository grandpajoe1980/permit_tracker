-- Organization administrators retain organization-scoped access; only an
-- explicit system_admin membership receives the cross-project admin bypass.
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
      and m.effective_from <= now()
      and (m.effective_to is null or m.effective_to > now())
      and m.role = 'system_admin'
  );
$$;

drop policy if exists customer_requests_select on public.customer_requests;
create policy customer_requests_select on public.customer_requests
for select to authenticated using (
  submitted_by_user_id = (select auth.uid())
  or (select app_private.is_system_admin())
  or exists (
    select 1
    from public.projects p
    where p.id::text = project_id
      and (select app_private.can_access_project(p.id))
  )
);

drop policy if exists customer_requests_update on public.customer_requests;
create policy customer_requests_update on public.customer_requests
for update to authenticated
using (
  (select app_private.is_system_admin())
  or (
    exists (
      select 1
      from public.projects p
      where p.id::text = project_id
        and (select app_private.can_access_project(p.id))
    )
  )
  or (submitted_by_user_id = (select auth.uid()) and status = 'draft')
)
with check (
  (select app_private.is_system_admin())
  or (
    exists (
      select 1
      from public.projects p
      where p.id::text = project_id
        and (select app_private.can_access_project(p.id))
    )
  )
  or (submitted_by_user_id = (select auth.uid()) and status = 'draft')
);
