-- Wave 3: version-scoped workflow authoring. Published definitions are
-- immutable; designer edits happen only in a draft copy.

create table if not exists public.workflow_version_stages (
  id text primary key,
  workflow_version_id text not null references public.workflow_versions(id) on delete cascade,
  stage_key text not null,
  sequence_order integer not null check (sequence_order > 0),
  label text not null,
  customer_visibility_label text not null,
  responsible_org_code text not null,
  target_duration_days integer not null default 0 check (target_duration_days >= 0),
  minimum_statutory_days integer not null default 0 check (minimum_statutory_days >= 0),
  required_inputs jsonb not null default '[]'::jsonb,
  completion_requirements jsonb not null default '[]'::jsonb,
  permitted_transitions jsonb not null default '[]'::jsonb,
  can_run_in_parallel boolean not null default false,
  is_milestone_gate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_version_id, stage_key),
  unique (workflow_version_id, sequence_order)
);

alter table public.workflow_version_stages enable row level security;
revoke all on table public.workflow_version_stages from anon;
grant select on table public.workflow_version_stages to authenticated;

drop policy if exists workflow_version_stages_select_admin on public.workflow_version_stages;
create policy workflow_version_stages_select_admin on public.workflow_version_stages
for select to authenticated using ((select app_private.is_system_admin()));

create or replace function app_private.require_workflow_admin()
returns void
language plpgsql security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is null or not (select app_private.is_system_admin()) then
    raise exception 'workflow administrator capability required';
  end if;
end;
$$;

create or replace function public.rpc_create_workflow_draft(
  p_source_version_id text,
  p_change_summary text
)
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare
  v_source public.workflow_versions%rowtype;
  v_draft_id text := 'workflow-version-' || replace(gen_random_uuid()::text, '-', '');
  v_now timestamptz := now();
  v_next_number integer;
begin
  perform app_private.require_workflow_admin();
  select * into v_source from public.workflow_versions where id = p_source_version_id;
  if not found then raise exception 'workflow version not found: %', p_source_version_id; end if;
  select coalesce(max(version_number), 0) + 1 into v_next_number
  from public.workflow_versions where workflow_id = v_source.workflow_id;

  insert into public.workflow_versions (
    id, workflow_id, version_number, version_label, change_summary,
    is_active, effective_date, lifecycle_status, created_at
  ) values (
    v_draft_id, v_source.workflow_id, v_next_number,
    'v' || v_next_number::text, coalesce(nullif(trim(p_change_summary), ''), 'Draft workflow revision'),
    false, current_date, 'draft', v_now
  );

  insert into public.workflow_version_stages (
    id, workflow_version_id, stage_key, sequence_order, label,
    customer_visibility_label, responsible_org_code, target_duration_days,
    minimum_statutory_days, required_inputs, completion_requirements,
    permitted_transitions, can_run_in_parallel, is_milestone_gate
  )
  select v_draft_id || '-' || s.stage_key, v_draft_id, s.stage_key, s.sort_order,
    s.label, s.label, coalesce(s.stage_key, 'PATH'), coalesce(s.service_target_days, 0),
    coalesce(s.minimum_processing_days, 0), coalesce(s.required_documents, '[]'::jsonb),
    '[]'::jsonb, coalesce(s.allowed_transitions, '[]'::jsonb), false, false
  from public.workflow_stages s
  where s.workflow_id = v_source.workflow_id;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    action_type, new_value, reason, created_at
  ) values (
    auth.uid(), 'workflow_draft_created', 'workflow_version', 'workflow_version',
    v_draft_id, coalesce((select full_name from public.profiles where id = auth.uid()), 'PATH administrator'),
    'workflow_draft_created', v_draft_id, p_change_summary, v_now
  );
  return jsonb_build_object('id', v_draft_id, 'versionNumber', v_next_number, 'status', 'draft');
end;
$$;

create or replace function public.rpc_update_workflow_draft_stage(
  p_version_id text,
  p_stage_key text,
  p_label text,
  p_customer_visibility_label text,
  p_responsible_org_code text,
  p_target_duration_days integer,
  p_minimum_statutory_days integer,
  p_required_inputs jsonb,
  p_completion_requirements jsonb,
  p_permitted_transitions jsonb,
  p_can_run_in_parallel boolean,
  p_is_milestone_gate boolean
)
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare v_stage public.workflow_version_stages%rowtype;
begin
  perform app_private.require_workflow_admin();
  if not exists (select 1 from public.workflow_versions where id = p_version_id and lifecycle_status = 'draft') then
    raise exception 'only draft workflow versions can be edited';
  end if;
  update public.workflow_version_stages set
    label = nullif(trim(p_label), ''),
    customer_visibility_label = nullif(trim(p_customer_visibility_label), ''),
    responsible_org_code = nullif(trim(p_responsible_org_code), ''),
    target_duration_days = greatest(p_target_duration_days, 0),
    minimum_statutory_days = greatest(p_minimum_statutory_days, 0),
    required_inputs = coalesce(p_required_inputs, '[]'::jsonb),
    completion_requirements = coalesce(p_completion_requirements, '[]'::jsonb),
    permitted_transitions = coalesce(p_permitted_transitions, '[]'::jsonb),
    can_run_in_parallel = coalesce(p_can_run_in_parallel, false),
    is_milestone_gate = coalesce(p_is_milestone_gate, false),
    updated_at = now()
  where workflow_version_id = p_version_id and stage_key = p_stage_key
  returning * into v_stage;
  if not found then raise exception 'draft stage not found: %', p_stage_key; end if;
  return to_jsonb(v_stage);
end;
$$;

create or replace function public.rpc_validate_workflow_draft(p_version_id text)
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare v_errors jsonb := '[]'::jsonb; v_count integer;
begin
  perform app_private.require_workflow_admin();
  if not exists (select 1 from public.workflow_versions where id = p_version_id and lifecycle_status in ('draft', 'validated')) then
    raise exception 'only draft workflow versions can be validated';
  end if;
  select count(*) into v_count from public.workflow_version_stages where workflow_version_id = p_version_id;
  if v_count = 0 then v_errors := v_errors || jsonb_build_array('At least one workflow stage is required'); end if;
  if exists (select 1 from public.workflow_version_stages where workflow_version_id = p_version_id and (label = '' or responsible_org_code = '')) then
    v_errors := v_errors || jsonb_build_array('Every stage needs a label and responsible organization');
  end if;
  if jsonb_array_length(v_errors) = 0 then
    update public.workflow_versions set lifecycle_status = 'validated' where id = p_version_id;
  end if;
  return jsonb_build_object('valid', jsonb_array_length(v_errors) = 0, 'errors', v_errors);
end;
$$;

create or replace function public.rpc_publish_workflow_version(p_version_id text)
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare v_result jsonb; v_now timestamptz := now();
begin
  perform app_private.require_workflow_admin();
  select public.rpc_validate_workflow_draft(p_version_id) into v_result;
  if coalesce((v_result->>'valid')::boolean, false) is not true then return v_result; end if;
  update public.workflow_versions
  set lifecycle_status = 'published', is_active = true, published_at = v_now
  where id = p_version_id;
  update public.workflow_versions
  set is_active = false, lifecycle_status = case when lifecycle_status = 'published' then 'retired' else lifecycle_status end, retired_at = v_now
  where workflow_id = (select workflow_id from public.workflow_versions where id = p_version_id)
    and id <> p_version_id and is_active = true;
  insert into public.audit_events (actor_id, action, resource_type, entity_type, entity_id, action_type, new_value, created_at)
  values (auth.uid(), 'workflow_published', 'workflow_version', 'workflow_version', p_version_id, 'workflow_published', p_version_id, v_now);
  return jsonb_build_object('id', p_version_id, 'status', 'published');
end;
$$;

revoke execute on function public.rpc_create_workflow_draft(text, text) from public, anon;
revoke execute on function public.rpc_update_workflow_draft_stage(text, text, text, text, text, integer, integer, jsonb, jsonb, jsonb, boolean, boolean) from public, anon;
revoke execute on function public.rpc_validate_workflow_draft(text) from public, anon;
revoke execute on function public.rpc_publish_workflow_version(text) from public, anon;
grant execute on function public.rpc_create_workflow_draft(text, text) to authenticated;
grant execute on function public.rpc_update_workflow_draft_stage(text, text, text, text, text, integer, integer, jsonb, jsonb, jsonb, boolean, boolean) to authenticated;
grant execute on function public.rpc_validate_workflow_draft(text) to authenticated;
grant execute on function public.rpc_publish_workflow_version(text) to authenticated;
