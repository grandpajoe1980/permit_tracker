-- Keep customer request updates in one permissive policy so PostgreSQL does not
-- evaluate overlapping UPDATE predicates for every row.
drop policy if exists customer_requests_update_government on public.customer_requests;
drop policy if exists customer_requests_update_own_draft on public.customer_requests;

create policy customer_requests_update on public.customer_requests
for update to authenticated
using (
  (select app_private.is_system_admin())
  or exists (
    select 1 from public.organization_memberships m
    where m.user_id = (select auth.uid()) and m.status = 'active'
  )
  or (submitted_by_user_id = (select auth.uid()) and status = 'draft')
)
with check (
  (select app_private.is_system_admin())
  or exists (
    select 1 from public.organization_memberships m
    where m.user_id = (select auth.uid()) and m.status = 'active'
  )
  or (submitted_by_user_id = (select auth.uid()) and status = 'draft')
);
