-- Zero explicitly disables the demo schedule from this stage onward.
-- Preserve the current function's authorization, audit, draft-only and statutory checks.
do $migration$
declare
  definition text := pg_get_functiondef('public.rpc_replace_workflow_draft_stages(text,jsonb)'::regprocedure);
  old_guard text := $guard$coalesce((v_stage->>'targetDurationDays')::integer, 0) <= 0$guard$;
begin
  if strpos(definition, old_guard) = 0 then
    raise exception 'Unexpected workflow duration guard; inspect live definition before applying';
  end if;
  definition := replace(definition, old_guard, $guard$coalesce((v_stage->>'targetDurationDays')::integer, -1) < 0$guard$);
  definition := replace(definition, 'target duration must be greater than zero', 'target duration must be zero or greater');
  execute definition;
end;
$migration$;
