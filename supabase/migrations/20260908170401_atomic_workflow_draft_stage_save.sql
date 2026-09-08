-- Checkpoint 5: persist the complete workflow draft contract atomically.
--
-- The designer can add, remove, reorder, and configure stages. A sequence of
-- single-row updates cannot represent those operations safely, so the client
-- sends the complete draft stage list and this guarded transaction replaces
-- it in one operation. Published versions remain immutable.

alter table public.workflow_version_stages
  add column if not exists internal_description text,
  add column if not exists responsible_org_id text,
  add column if not exists responsible_unit_name text,
  add column if not exists external_filing_url text,
  add column if not exists legal_authority_citation text,
  add column if not exists default_assignment_group_id text,
  add column if not exists default_assignee_id text,
  add column if not exists rfi_behavior text not null default 'pauses_clock',
  add column if not exists hold_behavior text not null default 'standard_running',
  add column if not exists dependencies jsonb not null default '[]'::jsonb,
  add column if not exists tasks jsonb not null default '[]'::jsonb;

create or replace function public.rpc_replace_workflow_draft_stages(
  p_version_id text,
  p_stages jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_organization_id uuid;
  v_stage jsonb;
  v_dependency jsonb;
  v_stage_position integer;
  v_dependency_position integer;
  v_stage_key text;
  v_stage_name text;
  v_responsible_org_code text;
  v_sequence integer := 0;
  v_seen_keys text[] := '{}'::text[];
begin
  if auth.uid() is null then
    raise exception 'authenticated user required';
  end if;

  select d.organization_id
    into v_organization_id
  from public.workflow_versions v
  join public.workflow_definitions d on d.id = v.workflow_id
  where v.id = p_version_id;

  if v_organization_id is null then
    raise exception 'workflow draft not found: %', p_version_id;
  end if;
  perform app_private.require_workflow_admin(v_organization_id);

  if not exists (
    select 1 from public.workflow_versions
    where id = p_version_id and lifecycle_status = 'draft'
  ) then
    raise exception 'only draft workflow versions can be edited';
  end if;
  if jsonb_typeof(p_stages) <> 'array' or coalesce(jsonb_array_length(p_stages), 0) = 0 then
    raise exception 'a workflow requires at least one stage';
  end if;

  -- Validate the complete payload before deleting any existing rows. The
  -- transaction would roll back on an exception, but validating first makes
  -- the failure reason deterministic for the editor.
  for v_stage, v_stage_position in
    select value, ordinality::integer
    from jsonb_array_elements(p_stages) with ordinality
  loop
    v_stage_key := nullif(trim(v_stage->>'stageKey'), '');
    v_stage_name := nullif(trim(coalesce(v_stage->>'name', v_stage->>'label')), '');
    v_responsible_org_code := nullif(trim(v_stage->>'responsibleOrgCode'), '');
    if v_stage_key is null or v_stage_name is null or v_responsible_org_code is null then
      raise exception 'every workflow stage requires a key, label, and responsible organization';
    end if;
    if v_stage_key = any(v_seen_keys) then
      raise exception 'duplicate workflow stage key: %', v_stage_key;
    end if;
    v_seen_keys := array_append(v_seen_keys, v_stage_key);
    if coalesce((v_stage->>'targetDurationDays')::integer, 0) <= 0 then
      raise exception 'stage % target duration must be greater than zero', v_stage_key;
    end if;
    if coalesce((v_stage->>'minimumStatutoryDays')::integer, 0) < 0 then
      raise exception 'stage % statutory minimum cannot be negative', v_stage_key;
    end if;
    if coalesce((v_stage->>'targetDurationDays')::integer, 0) < coalesce((v_stage->>'minimumStatutoryDays')::integer, 0) then
      raise exception 'stage % target duration cannot be less than its statutory minimum', v_stage_key;
    end if;
    if jsonb_typeof(coalesce(v_stage->'requiredInputs', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(v_stage->'completionRequirements', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(v_stage->'permittedTransitions', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(v_stage->'dependencies', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(v_stage->'tasks', '[]'::jsonb)) <> 'array' then
      raise exception 'stage % list fields must be arrays', v_stage_key;
    end if;
    for v_dependency in select value from jsonb_array_elements(coalesce(v_stage->'dependencies', '[]'::jsonb)) loop
      select candidate.ordinality::integer
        into v_dependency_position
        from jsonb_array_elements(p_stages) with ordinality as candidate(value, ordinality)
        where candidate.value->>'stageKey' = v_dependency #>> '{}';
      if v_dependency_position is null then
        raise exception 'stage % specifies unknown prerequisite %', v_stage_key, v_dependency #>> '{}';
      end if;
      if v_dependency_position >= v_stage_position then
        raise exception 'stage % prerequisite % must appear earlier in the workflow', v_stage_key, v_dependency #>> '{}';
      end if;
    end loop;
    if exists (
      select 1
      from jsonb_array_elements(coalesce(v_stage->'tasks', '[]'::jsonb)) task
      where nullif(trim(task->>'id'), '') is null or nullif(trim(task->>'title'), '') is null
    ) then
      raise exception 'stage % contains a task without an id and title', v_stage_key;
    end if;
    if exists (
      select 1
      from jsonb_array_elements(coalesce(v_stage->'tasks', '[]'::jsonb)) task
      where task ? 'defaultDays' and coalesce((task->>'defaultDays')::numeric, -1) < 0
    ) then
      raise exception 'stage % contains a task with an invalid default duration', v_stage_key;
    end if;
  end loop;

  delete from public.workflow_version_stages where workflow_version_id = p_version_id;

  for v_stage in select value from jsonb_array_elements(p_stages) loop
    v_sequence := v_sequence + 1;
    v_stage_key := trim(v_stage->>'stageKey');
    insert into public.workflow_version_stages (
      id,
      workflow_version_id,
      stage_key,
      sequence_order,
      label,
      internal_description,
      customer_visibility_label,
      responsible_org_id,
      responsible_org_code,
      responsible_unit_name,
      target_duration_days,
      minimum_statutory_days,
      required_inputs,
      completion_requirements,
      permitted_transitions,
      can_run_in_parallel,
      is_milestone_gate,
      external_filing_url,
      legal_authority_citation,
      default_assignment_group_id,
      default_assignee_id,
      rfi_behavior,
      hold_behavior,
      dependencies,
      tasks,
      updated_at
    ) values (
      p_version_id || '-stage-' || substr(md5(v_stage_key), 1, 16),
      p_version_id,
      v_stage_key,
      v_sequence,
      trim(coalesce(v_stage->>'name', v_stage->>'label')),
      nullif(trim(v_stage->>'internalDescription'), ''),
      trim(coalesce(nullif(v_stage->>'customerVisibilityLabel', ''), v_stage->>'name', v_stage->>'label')),
      nullif(trim(coalesce(v_stage->>'responsibleOrgId', v_stage->>'responsibleOrgCode')), ''),
      trim(v_stage->>'responsibleOrgCode'),
      nullif(trim(v_stage->>'responsibleUnitName'), ''),
      (v_stage->>'targetDurationDays')::integer,
      coalesce((v_stage->>'minimumStatutoryDays')::integer, 0),
      coalesce(v_stage->'requiredInputs', '[]'::jsonb),
      coalesce(v_stage->'completionRequirements', '[]'::jsonb),
      coalesce(v_stage->'permittedTransitions', '[]'::jsonb),
      coalesce((v_stage->>'canRunInParallel')::boolean, false),
      coalesce((v_stage->>'isMilestoneGate')::boolean, false),
      nullif(trim(v_stage->>'externalFilingUrl'), ''),
      nullif(trim(v_stage->>'legalAuthorityCitation'), ''),
      nullif(trim(v_stage->>'defaultAssignmentGroupId'), ''),
      nullif(trim(v_stage->>'defaultAssigneeId'), ''),
      coalesce(nullif(trim(v_stage->>'rfiBehavior'), ''), 'pauses_clock'),
      coalesce(nullif(trim(v_stage->>'holdBehavior'), ''), 'standard_running'),
      coalesce(v_stage->'dependencies', '[]'::jsonb),
      coalesce(v_stage->'tasks', '[]'::jsonb),
      now()
    );
  end loop;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id,
    actor_name, action_type, new_value, reason, created_at
  ) values (
    auth.uid(), 'workflow_draft_saved', 'workflow_version', 'workflow_version',
    p_version_id,
    coalesce((select full_name from public.profiles where id = auth.uid()), 'PATH administrator'),
    'workflow_draft_saved', p_version_id, 'Saved complete workflow stage definition', now()
  );

  return jsonb_build_object(
    'id', p_version_id,
    'status', 'draft',
    'stageCount', v_sequence
  );
end;
$$;

revoke execute on function public.rpc_replace_workflow_draft_stages(text, jsonb) from public, anon;
grant execute on function public.rpc_replace_workflow_draft_stages(text, jsonb) to authenticated;
