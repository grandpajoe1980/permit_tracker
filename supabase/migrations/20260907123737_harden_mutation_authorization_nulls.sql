create or replace function app_private.can_mutate_ticket(
  p_ticket_id text,
  p_ticket_type text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private
as $$
declare
  v_project_ref text;
  v_project_id uuid;
  v_group_id uuid;
  v_assignee_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  if p_ticket_type = 'customer_request' then
    select project_id, assignment_group_id, assigned_to_user_id
      into v_project_ref, v_group_id, v_assignee_id
    from public.customer_requests
    where id = p_ticket_id or confirmation_number = p_ticket_id;
  elsif p_ticket_type = 'workstream' then
    select project_id::text, assignment_group_id, assigned_to_user_id
      into v_project_ref, v_group_id, v_assignee_id
    from public.workstreams
    where id = p_ticket_id or code = p_ticket_id;
  elsif p_ticket_type = 'task' then
    select workstream.project_id::text, task.assignment_group_id, task.assigned_to_user_id
      into v_project_ref, v_group_id, v_assignee_id
    from public.tasks task
    join public.workstreams workstream on workstream.id = task.workstream_id
    where task.id = p_ticket_id;
  else
    return false;
  end if;

  select project_record.id into v_project_id
  from public.projects project_record
  where project_record.id::text = v_project_ref or project_record.number = v_project_ref
  limit 1;

  if v_project_id is null
     or not coalesce((select app_private.has_project_access(v_project_id)), false) then
    return false;
  end if;

  return coalesce((select app_private.can_dispatch_project(v_project_id)), false)
    or coalesce(v_assignee_id = (select auth.uid()), false)
    or (
      v_group_id is not null
      and coalesce(
        (select app_private.can_fulfill_group(v_group_id, (select auth.uid()))),
        false
      )
    );
end;
$$;

revoke all on function app_private.can_mutate_ticket(text, text) from public;
grant execute on function app_private.can_mutate_ticket(text, text) to authenticated;
