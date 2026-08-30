-- Wave 2: durable workflow execution primitives and a server-side transition
-- gate. A workstream pins the workflow version it started with; published
-- configuration is never read from the browser during a transition.

alter table public.workflow_versions
  add column if not exists lifecycle_status text not null default 'published'
    check (lifecycle_status in ('draft', 'validated', 'published', 'retired')),
  add column if not exists published_at timestamptz,
  add column if not exists retired_at timestamptz;

alter table public.workstreams
  add column if not exists workflow_version_id text,
  add column if not exists current_stage_id text,
  add column if not exists current_stage_started_at timestamptz,
  add column if not exists assigned_owner_user_id uuid references auth.users(id),
  add column if not exists assigned_owner_org_code text;

create table if not exists public.workflow_transitions (
  id text primary key,
  workflow_version_id text not null references public.workflow_versions(id) on delete cascade,
  from_stage_key text not null,
  to_stage_key text not null,
  label text not null,
  required_capability text,
  created_at timestamptz not null default now(),
  unique (workflow_version_id, from_stage_key, to_stage_key)
);

create table if not exists public.stage_runs (
  id uuid primary key default gen_random_uuid(),
  workstream_id text not null references public.workstreams(id) on delete cascade,
  workflow_version_id text,
  stage_id text,
  stage_key text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_checklist_items jsonb not null default '[]'::jsonb,
  provided_document_categories jsonb not null default '[]'::jsonb,
  completed_by uuid references auth.users(id),
  completion_notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_stage_runs_workstream on public.stage_runs (workstream_id, started_at desc);

create table if not exists public.workflow_checklist_items (
  id text primary key,
  workflow_version_id text not null references public.workflow_versions(id) on delete cascade,
  stage_key text not null,
  item_key text not null,
  label text not null,
  required boolean not null default true,
  sort_order integer not null default 1,
  unique (workflow_version_id, stage_key, item_key)
);

alter table public.workflow_transitions enable row level security;
alter table public.stage_runs enable row level security;
alter table public.workflow_checklist_items enable row level security;
revoke all on table public.workflow_transitions, public.stage_runs, public.workflow_checklist_items from anon;
grant select on table public.workflow_transitions, public.stage_runs, public.workflow_checklist_items to authenticated;

drop policy if exists workflow_transitions_select on public.workflow_transitions;
create policy workflow_transitions_select on public.workflow_transitions
for select to authenticated using (true);
drop policy if exists stage_runs_select_project on public.stage_runs;
create policy stage_runs_select_project on public.stage_runs
for select to authenticated using (
  exists (select 1 from public.workstreams w
    where w.id = workstream_id and w.project_id is not null
      and (select app_private.has_project_access(w.project_id)))
);
drop policy if exists workflow_checklist_items_select on public.workflow_checklist_items;
create policy workflow_checklist_items_select on public.workflow_checklist_items
for select to authenticated using (true);

create or replace function public.rpc_complete_workstream_stage(
  p_workstream_id text,
  p_completed_checklists text[] default '{}',
  p_provided_document_categories text[] default '{}',
  p_actor_name text default 'PATH user',
  p_completion_notes text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare
  v_now timestamptz := now();
  v_workstream public.workstreams%rowtype;
  v_stage public.workflow_stages%rowtype;
  v_next_stage public.workflow_stages%rowtype;
  v_required text[] := '{}';
  v_missing text[] := '{}';
  v_current_key text;
  v_next_key text;
  v_run_id uuid;
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
  select s.* into v_stage
  from public.workflow_stages s
  where lower(s.label) = lower(v_workstream.current_stage_name)
     or lower(s.stage_key) = v_current_key
  order by s.sort_order
  limit 1;

  if found then
    if v_stage.minimum_processing_days is not null
       and v_workstream.current_stage_started_at is not null
       and v_workstream.current_stage_started_at + make_interval(days => v_stage.minimum_processing_days) > v_now then
      raise exception 'minimum processing period has not elapsed';
    end if;
    select s.* into v_next_stage
    from public.workflow_stages s
    where s.workflow_id = v_stage.workflow_id and s.sort_order > v_stage.sort_order
    order by s.sort_order limit 1;
    v_next_key := coalesce(v_next_stage.stage_key, 'complete');
  else
    v_next_key := 'complete';
  end if;

  insert into public.stage_runs (
    workstream_id, workflow_version_id, stage_id, stage_key, status,
    completed_at, completed_checklist_items, provided_document_categories,
    completed_by, completion_notes
  ) values (
    v_workstream.id, v_workstream.workflow_version_id,
    nullif(v_workstream.current_stage_id, ''), coalesce(v_current_key, 'current'),
    'completed', v_now, to_jsonb(coalesce(p_completed_checklists, '{}')),
    to_jsonb(coalesce(p_provided_document_categories, '{}')), auth.uid(), p_completion_notes
  ) returning id into v_run_id;

  update public.workstreams
  set current_stage_name = coalesce(v_next_stage.label, 'Complete & Ready for Final Determination'),
      current_stage_id = v_next_stage.id::text,
      current_stage_started_at = case when v_next_stage.id is null then current_stage_started_at else v_now end,
      operational_state = case when v_next_stage.id is null then 'complete' else 'running' end,
      operational_state_label = case when v_next_stage.id is null then 'Complete' else 'Running (' || v_next_stage.label || ')' end,
      waiting_reason = null,
      waiting_on_entity = null,
      actual_completion_date = case when v_next_stage.id is null then current_date else null end,
      updated_at = v_now
  where id = v_workstream.id;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason, project_id, created_at
  ) values (
    auth.uid(), 'workflow_transition', 'workstream', 'workstream', v_workstream.code,
    p_actor_name, coalesce(v_workstream.regulatory_lead->>'orgCode', 'PATH'),
    'workflow_transition', v_workstream.current_stage_name,
    coalesce(v_next_stage.label, 'Complete & Ready for Final Determination'),
    p_completion_notes, v_workstream.project_id::text, v_now
  );

  return jsonb_build_object(
    'workstreamId', v_workstream.id,
    'stageRunId', v_run_id,
    'nextStageName', coalesce(v_next_stage.label, 'Complete & Ready for Final Determination'),
    'operationalState', case when v_next_stage.id is null then 'complete' else 'running' end
  );
end;
$$;

revoke execute on function public.rpc_complete_workstream_stage(text, text[], text[], text, text) from public, anon;
grant execute on function public.rpc_complete_workstream_stage(text, text[], text[], text, text) to authenticated;
