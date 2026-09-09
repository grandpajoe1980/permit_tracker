-- Persist task completion and stage handoffs as one authorized transaction.
-- No existing workstream is advanced or declared completed by this migration.
alter table public.tasks
  add column if not exists stage_id text references public.workflow_version_stages(id),
  add column if not exists is_stage_action boolean not null default false,
  add column if not exists description text,
  add column if not exists assigned_user_name text,
  add column if not exists actual_completion_date date;
create index if not exists tasks_workstream_stage on public.tasks(workstream_id,stage_id);

-- Internal helper: callers have already locked and authorized the workstream.
create or replace function app_private.ensure_stage_action(p_workstream_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare w public.workstreams%rowtype; s public.workflow_version_stages%rowtype;
begin
  select * into w from public.workstreams where id=p_workstream_id;
  select * into s from public.workflow_version_stages where id=w.current_stage_id and workflow_version_id=w.workflow_version_id;
  if not found then raise exception 'Configured workflow stage not found'; end if;
  if exists(select 1 from public.tasks where workstream_id=w.id and stage_id=s.id and is_stage_action and status<>'completed') then return; end if;
  insert into public.tasks(id,workstream_id,task_code,title,stage_id,is_stage_action,
    status,itsm_state,clock_status,assigned_org_code,assignment_group_id,
    duration_days,early_start,early_finish,late_start,late_finish,is_critical_path,predecessors)
  values('task-'||gen_random_uuid()::text,w.id,'STAGE-'||s.stage_key,'Complete '||s.label,s.id,true,
    'in_progress','in_progress','active',w.assigned_org_code,w.assignment_group_id,
    greatest(s.target_duration_days,1),current_date,current_date+greatest(s.target_duration_days,1),
    current_date,current_date+greatest(s.target_duration_days,1),w.is_critical_path,'[]');
end; $$;
revoke all on function app_private.ensure_stage_action(text) from public,anon,authenticated;

create or replace function app_private.complete_workstream_stage(
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
  if not coalesce(app_private.can_mutate_ticket(v_workstream.id, 'workstream'), false) then
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

  if v_workstream.operational_state like 'waiting_%' or v_workstream.operational_state='blocked' then
    raise exception 'Clear the workstream hold before advancing';
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
       and (v_workstream.current_stage_started_at is null
         or v_workstream.current_stage_started_at + make_interval(days => v_version_stage.minimum_statutory_days) > v_now) then
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
      if not exists(select 1 from public.organizations where code=v_next_org_code and active) then
        raise exception 'The next stage needs a valid owner organization in Workflow Designer';
      end if;
      if jsonb_array_length(coalesce(v_version_stage.permitted_transitions, '[]'::jsonb)) > 0
         and not exists (
           select 1 from jsonb_array_elements_text(v_version_stage.permitted_transitions) allowed(value)
           where lower(value) in (lower(v_next_key), lower(v_next_label))
         ) then
        raise exception 'configured workflow transition is not permitted: % -> %', v_current_key, v_next_key;
      end if;
    end if;
  else
    raise exception 'Connect this workstream to a published workflow and current stage before advancing it';
  end if;

  if exists (select 1 from public.tasks where workstream_id=v_workstream.id
    and (stage_id=v_version_stage.id or stage_id is null) and not is_stage_action
    and status not in ('completed','waived','cancelled')) then
    raise exception 'Complete the current stage tasks before advancing';
  end if;
  if exists (select 1 from public.coordination_requests where workstream_id=v_workstream.id
    and status not in ('completed','closed','cancelled','concurred') and nullif(blocks_workstream_title,'') is not null) then
    raise exception 'Resolve blocking agency coordination before advancing';
  end if;
  update public.tasks set status='completed', itsm_state='resolved', clock_status='stopped',
    actual_completion_date=current_date where workstream_id=v_workstream.id
    and stage_id=v_version_stage.id and is_stage_action and status <> 'completed';

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
      itsm_state = case when v_has_next_stage then 'in_progress' else 'resolved' end,
      clock_status = case when v_has_next_stage then 'active' else 'stopped' end,
      assigned_org_code = case when v_has_next_stage then v_next_org_code else assigned_org_code end,
      assigned_to_user_id = null, assigned_owner_user_id = null,
      assignment_group_id = case when v_has_next_stage then
        (select id from public.assignment_groups where org_code=v_next_org_code and active order by name,id limit 1)
        else assignment_group_id end,
      current_action_summary = case when v_has_next_stage then 'Complete ' || v_next_label else 'Workflow complete' end,
      operational_state_label = case when v_has_next_stage then 'Running (' || v_next_label || ')' else 'Complete' end,
      waiting_reason = null, waiting_on_entity = null,
      actual_completion_date = case when v_has_next_stage then null else current_date end,
      updated_at = v_now
  where id = v_workstream.id;

  if v_has_next_stage then
    perform app_private.ensure_stage_action(v_workstream.id);
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
        v_run_id::text || ':' || v_recipient::text, v_now
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

revoke all on function app_private.complete_workstream_stage(text,text[],text[],text,text) from public, anon;
grant execute on function app_private.complete_workstream_stage(text,text[],text[],text,text) to authenticated;

-- Legacy API delegates to the same guarded implementation.
create or replace function public.rpc_complete_workstream_stage(
  p_workstream_id text,p_completed_checklists text[] default '{}',
  p_provided_document_categories text[] default '{}',p_actor_name text default 'PATH user',
  p_completion_notes text default null)
returns jsonb language sql security invoker set search_path='' as $$
  select app_private.complete_workstream_stage(p_workstream_id,p_completed_checklists,
    p_provided_document_categories,p_actor_name,p_completion_notes);
$$;
revoke all on function public.rpc_complete_workstream_stage(text,text[],text[],text,text) from public,anon;
grant execute on function public.rpc_complete_workstream_stage(text,text[],text[],text,text) to authenticated;

-- Task IDs provide an idempotency boundary: retrying a completed task cannot
-- accidentally complete the next stage. Support tasks do not approve a stage.
create or replace function app_private.complete_task(p_task_id text,p_checklists text[],p_notes text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.tasks%rowtype; w public.workstreams%rowtype; result jsonb; actor_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select w0.* into w from public.workstreams w0 join public.tasks t0 on t0.workstream_id=w0.id
    where t0.id=p_task_id for update of w0;
  if not found then raise exception 'Task not found'; end if;
  select * into t from public.tasks where id=p_task_id for update;
  if not coalesce(app_private.can_mutate_ticket(t.id,'task'),false) then raise exception 'Task completion is not authorized'; end if;
  if t.status='completed' then return to_jsonb(t); end if;
  if w.operational_state in ('complete','cancelled') then raise exception 'Workstream is already closed'; end if;
  if t.stage_id is not null and t.stage_id is distinct from w.current_stage_id then
    raise exception 'This task belongs to a different stage. Complete the current stage first';
  end if;
  if t.status in ('blocked','waiting','pending_customer','pending_agency') then
    raise exception 'Resolve the task hold and resume it before completion';
  end if;
  if exists (
    select 1 from public.task_dependencies d join public.tasks predecessor on predecessor.id=d.predecessor_task_id
    where d.successor_task_id=t.id and predecessor.status not in ('completed','waived')
  ) or exists (
    select 1 from jsonb_array_elements_text(coalesce(t.predecessors,'[]')) dep(id)
    left join public.tasks predecessor on predecessor.id=dep.id
    where predecessor.id is null or predecessor.status not in ('completed','waived')
  ) then raise exception 'Complete predecessor tasks before this task'; end if;
  select full_name into actor_name from public.profiles where id=auth.uid();
  if t.is_stage_action then
    result:=app_private.complete_workstream_stage(w.id,p_checklists,'{}',coalesce(actor_name,'PATH user'),p_notes);
  else
    update public.tasks set status='completed',itsm_state='resolved',clock_status='stopped',
      actual_completion_date=current_date where id=t.id;
  end if;
  insert into public.audit_events(actor_id,action,resource_type,entity_type,entity_id,actor_name,
    action_type,old_value,new_value,reason,project_id)
  values(auth.uid(),'task_completed','task','task',t.id,coalesce(actor_name,'PATH user'),
    'task_completed',t.status,'completed',p_notes,w.project_id::text);
  insert into public.notifications(recipient_id,user_id,title,body,message,event_type,type,link_url,channel,delivery_status,dedupe_key)
  values(auth.uid(),auth.uid()::text,t.title||' completed',coalesce(p_notes,'Task result recorded'),
    coalesce(p_notes,'Task result recorded'),'task_completed','completion','/workstreams/'||w.id,'in_app','pending',
    'task-complete:'||t.id) on conflict(dedupe_key) do nothing;
  -- Make dependency handoff explicit. Preserve actual holds; only queued tasks
  -- whose entire dependency set is done become ready.
  update public.tasks successor set status='in_progress',itsm_state='in_progress'
  where successor.workstream_id=w.id and successor.status in ('pending','submitted','not_started')
    and (successor.stage_id is null or successor.stage_id=(select current_stage_id from public.workstreams where id=w.id))
    and (exists(select 1 from public.task_dependencies d where d.successor_task_id=successor.id and d.predecessor_task_id=t.id)
      or coalesce(successor.predecessors,'[]') ? t.id)
    and not exists(select 1 from public.task_dependencies d join public.tasks predecessor on predecessor.id=d.predecessor_task_id
      where d.successor_task_id=successor.id and predecessor.status not in ('completed','waived'))
    and not exists(select 1 from jsonb_array_elements_text(coalesce(successor.predecessors,'[]')) dep(id)
      left join public.tasks predecessor on predecessor.id=dep.id where predecessor.id is null or predecessor.status not in ('completed','waived'));
  select * into t from public.tasks where id=p_task_id;
  return to_jsonb(t);
end; $$;
revoke all on function app_private.complete_task(text,text[],text) from public,anon;
grant execute on function app_private.complete_task(text,text[],text) to authenticated;
create or replace function public.rpc_complete_task(p_task_id text,p_completed_checklists text[] default '{}',p_completion_notes text default null)
returns jsonb language sql security invoker set search_path='' as $$
  select app_private.complete_task(p_task_id,p_completed_checklists,p_completion_notes);
$$;
revoke all on function public.rpc_complete_task(text,text[],text) from public,anon;
grant execute on function public.rpc_complete_task(text,text[],text) to authenticated;

-- Administrators explicitly connect existing work to the appropriate published
-- definition; never assign an unrelated permit workflow based on a title guess.
create or replace function app_private.connect_workflow(p_workstream_id text,p_stage_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.workstreams%rowtype; s public.workflow_version_stages%rowtype; owner_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into w from public.workstreams where id=p_workstream_id for update;
  if not found or not coalesce(app_private.can_mutate_ticket(w.id,'workstream'),false) then raise exception 'Workstream access required'; end if;
  select s0.* into s from public.workflow_version_stages s0 join public.workflow_versions v on v.id=s0.workflow_version_id
    join public.workflow_definitions d on d.id=v.workflow_id
    where s0.id=p_stage_id and v.lifecycle_status='published' and d.active;
  if not found then raise exception 'Choose a published workflow stage'; end if;
  select organization_id into owner_id from public.workflow_definitions d join public.workflow_versions v on v.workflow_id=d.id where v.id=s.workflow_version_id;
  if not (app_private.is_system_admin() or app_private.is_organization_admin(owner_id)) then raise exception 'Workflow administrator required'; end if;
  if w.workflow_version_id is not null then raise exception 'This workstream already has a pinned workflow'; end if;
  if w.operational_state in ('complete','cancelled') then raise exception 'Closed workstreams cannot be connected'; end if;
  if not exists(select 1 from public.organizations where code=s.responsible_org_code and active) then raise exception 'Configure a valid owner organization for this stage first'; end if;
  update public.workstreams set workflow_version_id=s.workflow_version_id,current_stage_id=s.id,current_stage_name=s.label,
    current_stage_started_at=now(),assigned_org_code=s.responsible_org_code,assigned_owner_org_code=s.responsible_org_code,
    assigned_to_user_id=null,assigned_owner_user_id=null,
    assignment_group_id=(select id from public.assignment_groups where org_code=s.responsible_org_code and active order by name,id limit 1),
    current_action_summary='Complete '||s.label,updated_at=now() where id=w.id;
  update public.tasks set stage_id=s.id where workstream_id=w.id and stage_id is null and status not in ('completed','waived','cancelled');
  perform app_private.ensure_stage_action(w.id);
  insert into public.audit_events(actor_id,action,resource_type,entity_type,entity_id,action_type,old_value,new_value,project_id,reason)
  values(auth.uid(),'workflow_connected','workstream','workstream',w.id,'workflow_connected',w.current_stage_name,s.label,w.project_id::text,
    'Administrator connected a published workflow. Existing open tasks retained; no completed history inferred.');
  insert into public.notifications(recipient_id,user_id,title,body,message,event_type,type,link_url,channel,delivery_status)
  values(auth.uid(),auth.uid()::text,'Workflow connected',s.label,s.label,'workflow_connected','update','/workstreams/'||w.id,'in_app','pending');
  return jsonb_build_object('workstreamId',w.id,'workflowVersionId',s.workflow_version_id,'stageId',s.id);
end; $$;
revoke all on function app_private.connect_workflow(text,text) from public,anon;
grant execute on function app_private.connect_workflow(text,text) to authenticated;
create or replace function public.rpc_connect_workstream_workflow(p_workstream_id text,p_stage_id text)
returns jsonb language sql security invoker set search_path='' as $$
  select app_private.connect_workflow(p_workstream_id,p_stage_id);
$$;
revoke all on function public.rpc_connect_workstream_workflow(text,text) from public,anon;
grant execute on function public.rpc_connect_workstream_workflow(text,text) to authenticated;

-- Pinned metadata must be readable by authorized participants across agencies.
create or replace function app_private.can_read_pinned_workflow(p_definition_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.workflow_versions v
    join public.workstreams w on w.workflow_version_id=v.id
    where v.workflow_id=p_definition_id and app_private.has_project_access(w.project_id));
$$;
revoke all on function app_private.can_read_pinned_workflow(uuid) from public,anon;
grant execute on function app_private.can_read_pinned_workflow(uuid) to authenticated;
create policy workflow_definition_read_pinned on public.workflow_definitions for select to authenticated
  using(app_private.can_read_pinned_workflow(id));
create policy workflow_version_read_pinned on public.workflow_versions for select to authenticated using (
  exists(select 1 from public.workstreams w where w.workflow_version_id=workflow_versions.id and app_private.has_project_access(w.project_id)));
create policy workflow_stage_read_pinned on public.workflow_version_stages for select to authenticated using (
  exists(select 1 from public.workstreams w where w.workflow_version_id=workflow_version_stages.workflow_version_id and app_private.has_project_access(w.project_id)));

-- State dropdowns cannot skip completion requirements.
CREATE OR REPLACE FUNCTION public.rpc_update_ticket_itsm_state(
  p_ticket_id TEXT,
  p_ticket_type TEXT,
  p_new_state TEXT,
  p_reason TEXT DEFAULT NULL,
  p_pause_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_ticket_id TEXT;
  v_project_ref TEXT;
  v_old_state TEXT;
  v_old_clock_status TEXT;
  v_old_clock_paused_at TIMESTAMPTZ;
  v_total_paused INTEGER := 0;
  v_now TIMESTAMPTZ := now();
  v_clock_status TEXT;
  v_clock_paused_at TIMESTAMPTZ;
  v_clock_paused_reason TEXT;
  v_actor_name TEXT;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'authentication required for state transitions'; END IF;
  IF p_ticket_type IN ('task','workstream') AND p_new_state IN ('resolved','closed') THEN
    RAISE EXCEPTION 'Use Complete Step to validate requirements and save the workflow handoff';
  END IF;
  IF p_ticket_type NOT IN ('customer_request', 'workstream', 'task') THEN RAISE EXCEPTION 'invalid ticket type: %', p_ticket_type; END IF;
  IF p_new_state NOT IN ('draft', 'submitted', 'triaged', 'in_progress', 'pending_customer', 'pending_agency', 'blocked', 'resolved', 'closed') THEN RAISE EXCEPTION 'invalid ITSM state: %', p_new_state; END IF;

  IF p_ticket_type = 'customer_request' THEN
    SELECT id, project_id, itsm_state, clock_status, clock_paused_at, clock_total_paused_seconds
      INTO v_ticket_id, v_project_ref, v_old_state, v_old_clock_status, v_old_clock_paused_at, v_total_paused
    FROM public.customer_requests WHERE id = p_ticket_id OR confirmation_number = p_ticket_id FOR UPDATE;
  ELSIF p_ticket_type = 'workstream' THEN
    SELECT id, project_id::TEXT, itsm_state, clock_status, clock_paused_at, clock_total_paused_seconds
      INTO v_ticket_id, v_project_ref, v_old_state, v_old_clock_status, v_old_clock_paused_at, v_total_paused
    FROM public.workstreams WHERE id = p_ticket_id OR code = p_ticket_id FOR UPDATE;
  ELSE
    SELECT task.id, workstream.project_id::TEXT, task.itsm_state, task.clock_status, task.clock_paused_at, task.clock_total_paused_seconds
      INTO v_ticket_id, v_project_ref, v_old_state, v_old_clock_status, v_old_clock_paused_at, v_total_paused
    FROM public.tasks task JOIN public.workstreams workstream ON workstream.id = task.workstream_id
    WHERE task.id = p_ticket_id FOR UPDATE;
  END IF;
  IF v_ticket_id IS NULL THEN RAISE EXCEPTION 'ticket not found: %', p_ticket_id; END IF;
  IF NOT (SELECT app_private.can_mutate_ticket(v_ticket_id, p_ticket_type)) THEN RAISE EXCEPTION 'authenticated user cannot update ticket %', p_ticket_id; END IF;

  v_total_paused := COALESCE(v_total_paused, 0);
  IF p_new_state IN ('pending_customer', 'pending_agency', 'blocked') THEN
    v_clock_status := 'paused';
    v_clock_paused_at := COALESCE(v_old_clock_paused_at, v_now);
    v_clock_paused_reason := COALESCE(p_pause_reason, p_reason, 'Waiting for the next required response');
  ELSIF p_new_state IN ('resolved', 'closed') THEN
    v_clock_status := 'stopped';
    IF v_old_clock_status = 'paused' AND v_old_clock_paused_at IS NOT NULL THEN
      v_total_paused := v_total_paused + GREATEST(EXTRACT(EPOCH FROM v_now - v_old_clock_paused_at)::INTEGER, 0);
    END IF;
  ELSE
    v_clock_status := 'active';
    IF v_old_clock_status = 'paused' AND v_old_clock_paused_at IS NOT NULL THEN
      v_total_paused := v_total_paused + GREATEST(EXTRACT(EPOCH FROM v_now - v_old_clock_paused_at)::INTEGER, 0);
    END IF;
  END IF;

  IF p_ticket_type = 'customer_request' THEN
    UPDATE public.customer_requests SET itsm_state = p_new_state,
      status = CASE WHEN p_new_state = 'draft' THEN 'draft' WHEN p_new_state = 'submitted' THEN 'submitted'
        WHEN p_new_state = 'triaged' THEN 'triage' WHEN p_new_state IN ('in_progress', 'pending_customer', 'pending_agency', 'blocked') THEN 'in_progress'
        WHEN p_new_state = 'resolved' THEN 'resolved' WHEN p_new_state = 'closed' THEN 'closed' ELSE status END,
      clock_status = v_clock_status,
      clock_paused_at = CASE WHEN v_clock_status = 'paused' THEN v_clock_paused_at ELSE NULL END,
      clock_paused_reason = CASE WHEN v_clock_status = 'paused' THEN v_clock_paused_reason ELSE NULL END,
      clock_total_paused_seconds = v_total_paused, updated_at = v_now WHERE id = v_ticket_id;
  ELSIF p_ticket_type = 'workstream' THEN
    UPDATE public.workstreams SET itsm_state = p_new_state,
      operational_state = CASE WHEN p_new_state = 'blocked' THEN 'blocked' WHEN p_new_state = 'pending_customer' THEN 'waiting_applicant'
        WHEN p_new_state = 'pending_agency' THEN 'waiting_government' WHEN p_new_state IN ('resolved', 'closed') THEN 'complete' ELSE 'running' END,
      operational_state_label = CASE WHEN p_new_state = 'blocked' THEN 'Blocked (Action Required)' WHEN p_new_state = 'pending_customer' THEN 'Waiting on Applicant'
        WHEN p_new_state = 'pending_agency' THEN 'Waiting on Government' WHEN p_new_state = 'resolved' THEN 'Resolved' WHEN p_new_state = 'closed' THEN 'Closed' ELSE 'In Progress' END,
      clock_status = v_clock_status,
      clock_paused_at = CASE WHEN v_clock_status = 'paused' THEN v_clock_paused_at ELSE NULL END,
      clock_paused_reason = CASE WHEN v_clock_status = 'paused' THEN v_clock_paused_reason ELSE NULL END,
      clock_total_paused_seconds = v_total_paused,
      actual_completion_date = CASE WHEN p_new_state IN ('resolved', 'closed') THEN COALESCE(actual_completion_date, CURRENT_DATE) ELSE actual_completion_date END,
      updated_at = v_now WHERE id = v_ticket_id;
  ELSE
    UPDATE public.tasks SET itsm_state = p_new_state,
      status = CASE WHEN p_new_state = 'blocked' THEN 'blocked' WHEN p_new_state IN ('pending_customer', 'pending_agency') THEN 'waiting'
        WHEN p_new_state IN ('resolved', 'closed') THEN 'completed' WHEN p_new_state = 'in_progress' THEN 'in_progress' ELSE 'pending' END,
      clock_status = v_clock_status,
      clock_paused_at = CASE WHEN v_clock_status = 'paused' THEN v_clock_paused_at ELSE NULL END,
      clock_paused_reason = CASE WHEN v_clock_status = 'paused' THEN v_clock_paused_reason ELSE NULL END,
      clock_total_paused_seconds = v_total_paused WHERE id = v_ticket_id;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), 'Authorized Fulfiller') INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
  INSERT INTO public.audit_events (actor_id, action, resource_type, entity_type, entity_id, actor_name, action_type, old_value, new_value, reason, project_id, created_at, occurred_at)
  VALUES (v_actor_id, 'itsm_state_transition', p_ticket_type, p_ticket_type, v_ticket_id,
    COALESCE(v_actor_name, 'Authorized Fulfiller'), 'status_changed', v_old_state, p_new_state, p_reason, v_project_ref, v_now, v_now);

  RETURN jsonb_build_object('success', true, 'ticketId', v_ticket_id, 'ticketType', p_ticket_type,
    'oldState', v_old_state, 'newState', p_new_state, 'clockStatus', v_clock_status,
    'totalPausedSeconds', v_total_paused, 'updatedAt', v_now);
END;
$$;
