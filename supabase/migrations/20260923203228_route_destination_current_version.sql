-- Route rules pin the selected destination version for reproducibility while
-- editing, but a later publish retires that version. At submission time,
-- resolve its definition to the definition's current active published version.
do $$
declare
  v_definition text;
  v_old text := $old$
  v_destination := v_rule->'destination';
  select * into v_target_version from public.workflow_versions
  where id = v_destination->>'workflowVersionId'
    and lifecycle_status = 'published' and is_active;
  if not found then raise exception 'automatic route target workflow is no longer published and active'; end if;
  select * into v_target_definition from public.workflow_definitions
  where id = v_target_version.workflow_id and active;
  if not found or not app_private.workflow_owner_matches_project(v_target_definition.organization_id, v_project.id) then
    raise exception 'automatic route target workflow is not owned by an active project participant';
  end if;
$old$;
  v_new text := $new$
  v_destination := v_rule->'destination';
  select * into v_target_definition
  from public.workflow_definitions definition
  where definition.id = (
    select selected.workflow_id
    from public.workflow_versions selected
    where selected.id = v_destination->>'workflowVersionId'
  ) and definition.active;
  if not found then raise exception 'automatic route target workflow definition is unavailable'; end if;

  select * into v_target_version from public.workflow_versions
  where workflow_id = v_target_definition.id
    and lifecycle_status = 'published' and is_active
  order by version_number desc
  limit 1;
  if not found then raise exception 'automatic route target workflow definition has no active published version'; end if;
  if not app_private.workflow_owner_matches_project(v_target_definition.organization_id, v_project.id) then
    raise exception 'automatic route target workflow is not owned by an active project participant';
  end if;
$new$;
begin
  select pg_get_functiondef('app_private.auto_route_customer_request(text)'::regprocedure)
  into v_definition;
  if position(v_old in v_definition) = 0 then
    raise exception 'auto_route_customer_request did not contain the expected pinned-destination lookup';
  end if;
  v_definition := replace(v_definition, v_old, v_new);
  if position(v_new in v_definition) = 0 then
    raise exception 'auto_route_customer_request destination resolver replacement failed';
  end if;
  execute v_definition;
end;
$$;

-- Keep the source intake version in workflowVersionId for compatibility and
-- expose the actual destination version used to create the workstream.
do $$
declare
  v_definition text;
  v_old text := $old$
  v_receipt := jsonb_build_object(
    'status', 'routed', 'workflowVersionId', v_source_version.id, 'ruleId', v_rule->>'id',
    'workstreamId', v_workstream.id, 'workstreamCode', v_workstream.code,
    'leadOrgCode', v_owner.code, 'leadOrgName', coalesce(nullif(v_destination->>'leadOrgName', ''), v_owner.name),
    'assignmentGroupId', v_group.id, 'targetDate', v_target_date
  );
$old$;
  v_new text := $new$
  v_receipt := jsonb_build_object(
    'status', 'routed', 'workflowVersionId', v_source_version.id,
    'destinationWorkflowVersionId', v_target_version.id, 'ruleId', v_rule->>'id',
    'workstreamId', v_workstream.id, 'workstreamCode', v_workstream.code,
    'leadOrgCode', v_owner.code, 'leadOrgName', coalesce(nullif(v_destination->>'leadOrgName', ''), v_owner.name),
    'assignmentGroupId', v_group.id, 'targetDate', v_target_date
  );
$new$;
begin
  select pg_get_functiondef('app_private.auto_route_customer_request(text)'::regprocedure)
  into v_definition;
  if position(v_old in v_definition) = 0 then
    raise exception 'auto_route_customer_request did not contain the expected route receipt';
  end if;
  v_definition := replace(v_definition, v_old, v_new);
  if position(v_new in v_definition) = 0 then
    raise exception 'auto_route_customer_request destination version receipt replacement failed';
  end if;
  execute v_definition;
end;
$$;
