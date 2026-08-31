-- Wave 9 failure boundary: a workstream cannot complete while a mandatory
-- predecessor in the persisted task DAG remains unfinished.

create index if not exists idx_task_dependencies_successor_gate
  on public.task_dependencies (successor_task_id, gate_type);

create or replace function app_private.enforce_mandatory_task_dependencies()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if new.operational_state = 'complete'
     and old.operational_state is distinct from 'complete'
     and exists (
       select 1
       from public.task_dependencies dep
       join public.tasks successor on successor.id = dep.successor_task_id
       join public.tasks predecessor on predecessor.id = dep.predecessor_task_id
       where successor.workstream_id = new.id
         and dep.gate_type = 'statutory_mandatory'
         and coalesce(lower(predecessor.status), 'pending') not in ('complete', 'completed', 'done')
     ) then
    raise exception 'mandatory task dependency remains incomplete for workstream %', new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_mandatory_task_dependencies on public.workstreams;
create trigger enforce_mandatory_task_dependencies
before update of operational_state on public.workstreams
for each row execute function app_private.enforce_mandatory_task_dependencies();

revoke all on function app_private.enforce_mandatory_task_dependencies() from public;
