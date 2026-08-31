-- Wave 2/9 follow-up: make legacy workflows first-class pinned versions and
-- make stage completion read the pinned definition rather than the mutable
-- legacy workflow_stages table.

-- Existing installations may have only workflow_definitions/workflow_stages.
-- Import those definitions once so new workstreams can always pin a version.
insert into public.workflow_versions (
  id, workflow_id, version_number, version_label, change_summary,
  is_active, effective_date, lifecycle_status
)
select
  'legacy-workflow-version-' || replace(w.id::text, '-', ''),
  w.id, w.version, 'v' || w.version::text,
  'Imported from the original workflow definition',
  w.active, current_date, case when w.active then 'published' else 'retired' end
from public.workflow_definitions w
where not exists (
  select 1 from public.workflow_versions v
  where v.workflow_id = w.id and v.version_number = w.version
);

insert into public.workflow_version_stages (
  id, workflow_version_id, stage_key, sequence_order, label,
  customer_visibility_label, responsible_org_code, target_duration_days,
  minimum_statutory_days, required_inputs, completion_requirements,
  permitted_transitions, can_run_in_parallel, is_milestone_gate
)
select
  v.id || '-' || s.stage_key, v.id, s.stage_key, s.sort_order, s.label,
  s.label, coalesce(s.stage_key, 'PATH'), coalesce(s.service_target_days, 0),
  coalesce(s.minimum_processing_days, 0), coalesce(s.required_documents, '[]'::jsonb),
  '[]'::jsonb, coalesce(s.allowed_transitions, '[]'::jsonb), false, false
from public.workflow_stages s
join public.workflow_definitions w on w.id = s.workflow_id
join public.workflow_versions v on v.workflow_id = w.id and v.version_number = w.version
where not exists (
  select 1 from public.workflow_version_stages vs
  where vs.workflow_version_id = v.id and vs.stage_key = s.stage_key
)
on conflict (id) do nothing;

create or replace function public.rpc_complete_workstream_stage(
  p_workstream_id text,
  p_completed_checklists text[] default '{}',
  p_provided_document_categories text[] default '{}',
  p_actor_name text default 'PATH user',
  p_completion_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_now timestamptz := now();
  v_workstream public.workstreams%rowtype;
  v_version_stage public.workflow_version_stages%rowtype;
  v_next_version_stage public.workflow_version_stages%rowtype;
  v_legacy_stage public.workflow_stages%rowtype;
  v_next_legacy_stage public.workflow_stages%rowtype;
  v_has_version_stage boolean := false;
  v_has_next_stage boolean := false;
  v_current_key text;
  v_current_label text;
  v_next_label text;
  v_next_key text;
  v_next_stage_id text;
  v_next_org_code text;
  v_required text;
  v_run_id uuid;
  v_recipient uuid;
begin
  if auth.uid() is null then
    raise exception 'authenticated actor required';
  end if;

  select * into v_workstream
  from public.workstreams
  where id = p_workstream_id or code = p_workstream_id
  for update;
  if not found then raise exception 'workstream not found: %', p_workstream_id; end if;
  if v_workstream.project_id is null or not (select app_private.has_project_access(v_workstream.project_id)) then
    raise exception 'authenticated user cannot complete workstream %', p_workstream_id;
  end if;
  if v_workstream.operational_state in ('complete', 'cancelled') then
    raise exception 'workstream is already %', v_workstream.operational_state;
  end if;
  if jsonb_array_length(coalesce(v_workstream.active_blockers, '[]'::jsonb)) > 0 then
    raise exception 'unresolved blocking dependencies remain';
  end if;
  if exists (
    select 1 from public.rfis r
    where r.workstream_id = v_workstream.id
      and r.status not in ('accepted', 'closed', 'withdrawn')
  ) then
    raise exception 'unresolved RFI remains';
  end if;
  if coalesce(array_length(p_completed_checklists, 1), 0) = 0 then
    raise exception 'required completion checklist was not supplied';
  end if;

  v_current_key := lower(regexp_replace(coalesce(v_workstream.current_stage_name, ''), '[^a-z0-9]+', '_', 'gi'));
  if v_workstream.workflow_version_id is not null then
    select * into v_version_stage
    from public.workflow_version_stages
    where workflow_version_id = v_workstream.workflow_version_id
      and (id::text = nullif(v_workstream.current_stage_id, '')
        or stage_key = v_current_key
        or lower(label) = lower(v_workstream.current_stage_name))
    order by sequence_order
    limit 1;
    v_has_version_stage := found;
  end if;

  if v_has_version_stage then
    v_current_key := v_version_stage.stage_key;
    v_current_label := v_version_stage.label;

    if v_version_stage.minimum_statutory_days > 0
       and v_workstream.current_stage_started_at is not null
       and v_workstream.current_stage_started_at + make_interval(days => v_version_stage.minimum_statutory_days) > v_now then
      raise exception 'minimum processing period has not elapsed';
    end if;

    for v_required in
      select item_key from public.workflow_checklist_items
      where workflow_version_id = v_version_stage.workflow_version_id
        and stage_key = v_version_stage.stage_key and required
      order by sort_order
    loop
      if not (v_required = any(coalesce(p_completed_checklists, '{}'::text[]))) then
        raise exception 'required checklist item is incomplete: %', v_required;
      end if;
    end loop;
    for v_required in select value from jsonb_array_elements_text(coalesce(v_version_stage.completion_requirements, '[]'::jsonb)) loop
      if not (v_required = any(coalesce(p_completed_checklists, '{}'::text[]))) then
        raise exception 'required checklist item is incomplete: %', v_required;
      end if;
    end loop;
    for v_required in select value from jsonb_array_elements_text(coalesce(v_version_stage.required_inputs, '[]'::jsonb)) loop
      if not exists (
        select 1
        from public.documents d
        join public.document_versions dv on dv.document_id = d.id or dv.document_ref_id = d.id::text
        where (d.project_id = v_workstream.project_id or dv.project_id = v_workstream.project_id::text)
          and lower(regexp_replace(coalesce(d.document_type, ''), '[^a-z0-9]+', '_', 'gi')) = lower(regexp_replace(v_required, '[^a-z0-9]+', '_', 'gi'))
      ) then
        raise exception 'required input document is missing: %', v_required;
      end if;
    end loop;

    select * into v_next_version_stage
    from public.workflow_version_stages
    where workflow_version_id = v_version_stage.workflow_version_id
      and sequence_order > v_version_stage.sequence_order
    order by sequence_order
    limit 1;
    v_has_next_stage := found;
    if v_has_next_stage then
      v_next_key := v_next_version_stage.stage_key;
      v_next_label := v_next_version_stage.label;
      v_next_stage_id := v_next_version_stage.id;
      v_next_org_code := v_next_version_stage.responsible_org_code;
      if jsonb_array_length(coalesce(v_version_stage.permitted_transitions, '[]'::jsonb)) > 0
         and not exists (
           select 1 from jsonb_array_elements_text(v_version_stage.permitted_transitions) allowed(value)
           where lower(value) in (lower(v_next_key), lower(v_next_label))
         ) then
        raise exception 'configured workflow transition is not permitted: % -> %', v_current_key, v_next_key;
      end if;
    end if;
  else
    select * into v_legacy_stage
    from public.workflow_stages
    where lower(label) = lower(v_workstream.current_stage_name)
       or lower(stage_key) = v_current_key
    order by sort_order
    limit 1;
    if found then
      v_current_key := v_legacy_stage.stage_key;
      v_current_label := v_legacy_stage.label;
      if coalesce(v_legacy_stage.minimum_processing_days, 0) > 0
         and v_workstream.current_stage_started_at is not null
         and v_workstream.current_stage_started_at + make_interval(days => v_legacy_stage.minimum_processing_days) > v_now then
        raise exception 'minimum processing period has not elapsed';
      end if;
      for v_required in select value from jsonb_array_elements_text(coalesce(v_legacy_stage.required_documents, '[]'::jsonb)) loop
        if not exists (
          select 1
          from public.documents d
          join public.document_versions dv on dv.document_id = d.id or dv.document_ref_id = d.id::text
          where (d.project_id = v_workstream.project_id or dv.project_id = v_workstream.project_id::text)
            and lower(regexp_replace(coalesce(d.document_type, ''), '[^a-z0-9]+', '_', 'gi')) = lower(regexp_replace(v_required, '[^a-z0-9]+', '_', 'gi'))
        ) then
          raise exception 'required input document is missing: %', v_required;
        end if;
      end loop;
      select * into v_next_legacy_stage
      from public.workflow_stages
      where workflow_id = v_legacy_stage.workflow_id and sort_order > v_legacy_stage.sort_order
      order by sort_order limit 1;
      if found then
        v_has_next_stage := true;
        v_next_key := v_next_legacy_stage.stage_key;
        v_next_label := v_next_legacy_stage.label;
        v_next_stage_id := v_next_legacy_stage.id::text;
        v_next_org_code := v_next_legacy_stage.stage_key;
      end if;
    end if;
  end if;

  insert into public.stage_runs (
    workstream_id, workflow_version_id, stage_id, stage_key, status,
    completed_at, completed_checklist_items, provided_document_categories,
    completed_by, completion_notes
  ) values (
    v_workstream.id, v_workstream.workflow_version_id,
    nullif(coalesce(v_workstream.current_stage_id, case when v_has_version_stage then v_version_stage.id else v_legacy_stage.id::text end), ''),
    coalesce(v_current_key, 'current'), 'completed', v_now,
    to_jsonb(coalesce(p_completed_checklists, '{}'::text[])),
    to_jsonb(coalesce(p_provided_document_categories, '{}'::text[])), auth.uid(), p_completion_notes
  ) returning id into v_run_id;

  update public.workstreams
  set current_stage_name = case when v_has_next_stage then v_next_label else 'Complete & Ready for Final Determination' end,
      current_stage_id = case when v_has_next_stage then v_next_stage_id else null end,
      assigned_owner_org_code = case when v_has_next_stage then v_next_org_code else assigned_owner_org_code end,
      current_stage_started_at = case when v_has_next_stage then v_now else current_stage_started_at end,
      operational_state = case when v_has_next_stage then 'running' else 'complete' end,
      operational_state_label = case when v_has_next_stage then 'Running (' || v_next_label || ')' else 'Complete' end,
      waiting_reason = null, waiting_on_entity = null,
      actual_completion_date = case when v_has_next_stage then null else current_date end,
      updated_at = v_now
  where id = v_workstream.id;

  if v_has_next_stage and not exists (
    select 1 from public.tasks where workstream_id = v_workstream.id
      and task_code = coalesce(v_next_org_code, 'PATH') || '-STAGE-' || v_next_key
  ) then
    insert into public.tasks (
      id, workstream_id, task_code, title, duration_days, early_start,
      early_finish, late_start, late_finish, is_critical_path, status, predecessors
    ) values (
      'task-' || replace(gen_random_uuid()::text, '-', ''), v_workstream.id,
      coalesce(v_next_org_code, 'PATH') || '-STAGE-' || v_next_key,
      v_next_label, 1, current_date, current_date + 1,
      current_date, current_date + 1, true, 'in_progress', '[]'::jsonb
    );
  end if;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason, project_id, created_at
  ) values (
    auth.uid(), 'workflow_transition', 'workstream', 'workstream', v_workstream.code,
    p_actor_name, coalesce(v_workstream.regulatory_lead->>'orgCode', 'PATH'),
    'workflow_transition', v_workstream.current_stage_name,
    case when v_has_next_stage then v_next_label else 'Complete & Ready for Final Determination' end,
    p_completion_notes, v_workstream.project_id::text, v_now
  );

  if v_has_next_stage then
    for v_recipient in
      select m.user_id
      from public.organization_memberships m
      join public.organizations o on o.id = m.organization_id
      where o.code = v_next_org_code and o.active and m.status = 'active'
        and m.role in ('supervisor', 'organization_admin', 'system_admin')
    loop
      insert into public.notifications (
        recipient_id, event_type, title, body, channel, delivery_status, dedupe_key, created_at
      ) values (
        v_recipient, 'workflow_handoff', v_workstream.code || ' is ready for your agency',
        'The next workflow stage is ' || v_next_label || '.', 'in_app', 'pending',
        v_workstream.id || ':' || v_next_key, v_now
      ) on conflict (dedupe_key) do nothing;
    end loop;
  end if;

  return jsonb_build_object(
    'workstreamId', v_workstream.id, 'stageRunId', v_run_id,
    'nextStageName', case when v_has_next_stage then v_next_label else 'Complete & Ready for Final Determination' end,
    'operationalState', case when v_has_next_stage then 'running' else 'complete' end
  );
end;
$$;

revoke execute on function public.rpc_complete_workstream_stage(text, text[], text[], text, text) from public, anon;
grant execute on function public.rpc_complete_workstream_stage(text, text[], text[], text, text) to authenticated;
