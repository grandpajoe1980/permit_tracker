-- Connect intake tasks created by the authenticated triage boundaries to the
-- stage-completion transaction. Existing open intake tasks are metadata-only
-- repairs: no status, audit history, or published workflow definition changes.

update public.tasks t
set stage_id = w.current_stage_id,
    is_stage_action = true
from public.workstreams w
where t.workstream_id = w.id
  and t.stage_id is null
  and not t.is_stage_action
  and t.status not in ('completed', 'waived', 'cancelled')
  and t.task_code like '%-INTAKE-%'
  and w.workflow_version_id is not null
  and nullif(w.current_stage_id, '') is not null;

-- The multi-workstream triage RPC historically inserted the first task without
-- stage metadata. Preserve its validation and authorization while repairing
-- only that insert contract.
do $migration$
declare
  v_definition text;
  v_needle text := $needle$
      assigned_to_user_id, assigned_org_code, itsm_state
    ) values (
      'task-' || replace(gen_random_uuid()::text, '-', ''), v_workstream.id,
      v_group.org_code || '-INTAKE-' || v_code,
      coalesce(v_stage_label, 'Request intake') || ' — ' || trim(v_item->>'title'),
      v_stage_duration, current_date, v_target_date, current_date, v_target_date,
      true, 'in_progress', '[]'::jsonb, v_group.id, v_assigned_user_id, v_group.org_code,
      'in_progress'
    );
$needle$;
  v_replacement text := $replacement$
      assigned_to_user_id, assigned_org_code, itsm_state, stage_id, is_stage_action
    ) values (
      'task-' || replace(gen_random_uuid()::text, '-', ''), v_workstream.id,
      v_group.org_code || '-INTAKE-' || v_code,
      coalesce(v_stage_label, 'Request intake') || ' — ' || trim(v_item->>'title'),
      v_stage_duration, current_date, v_target_date, current_date, v_target_date,
      true, 'in_progress', '[]'::jsonb, v_group.id, v_assigned_user_id, v_group.org_code,
      'in_progress', v_stage_id, true
    );
$replacement$;
begin
  select pg_get_functiondef('public.rpc_triage_customer_request(text,jsonb)'::regprocedure)
    into v_definition;
  if position(v_needle in v_definition) = 0 then
    raise exception 'rpc_triage_customer_request did not contain the expected intake-task insert';
  end if;
  execute replace(v_definition, v_needle, v_replacement);
end;
$migration$;

-- The single-workstream creation RPC did not create an initial stage action at
-- all. Add the existing private helper immediately after its authoritative
-- workstream insert, without changing its request/role checks.
do $migration$
declare
  v_definition text;
  v_needle text := $needle$returning * into v_workstream;

  update public.customer_requests$needle$;
  v_replacement text := $replacement$returning * into v_workstream;

  perform app_private.ensure_stage_action(v_workstream.id);

  update public.customer_requests$replacement$;
begin
  select pg_get_functiondef('public.rpc_create_workstream_from_request(text,text,text,text,text,text,text,text)'::regprocedure)
    into v_definition;
  if position(v_needle in v_definition) = 0 then
    raise exception 'rpc_create_workstream_from_request did not contain the expected workstream insert';
  end if;
  execute replace(v_definition, v_needle, v_replacement);
end;
$migration$;
