-- Versioned intake, routing, branching, and notification rules.
-- The configuration lives on immutable workflow versions so existing cases
-- continue to execute the exact process version they started with.

alter table public.workflow_versions
  add column if not exists intake_questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(intake_questions) = 'array'),
  add column if not exists routing_rules jsonb not null default '[]'::jsonb
    check (jsonb_typeof(routing_rules) = 'array'),
  add column if not exists stage_branches jsonb not null default '[]'::jsonb
    check (jsonb_typeof(stage_branches) = 'array'),
  add column if not exists notice_templates jsonb not null default '[]'::jsonb
    check (jsonb_typeof(notice_templates) = 'array'),
  add column if not exists auto_route_enabled boolean not null default false;

alter table public.customer_requests
  add column if not exists intake_workflow_version_id text
    references public.workflow_versions(id) on delete set null,
  add column if not exists intake_answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(intake_answers) = 'object'),
  add column if not exists auto_routed_workflow_version_id text
    references public.workflow_versions(id) on delete set null,
  add column if not exists auto_routed_rule_id text,
  add column if not exists auto_route_receipt jsonb not null default '{"status":"manual"}'::jsonb
    check (jsonb_typeof(auto_route_receipt) = 'object');

alter table public.stage_runs
  add column if not exists review_outcome text;

create index if not exists idx_customer_requests_intake_workflow_version
  on public.customer_requests(intake_workflow_version_id);

-- A configured workflow is visible to users who can access a project where
-- its owner organization is an active participant. This permits project
-- customers to load the versioned intake form without granting global reads.
create or replace function app_private.workflow_owner_visible_on_project(p_owner_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects project
    where project.lead_organization_id = p_owner_organization_id
      and app_private.has_project_access(project.id)
    union all
    select 1
    from public.project_participants participant
    where participant.organization_id = p_owner_organization_id
      and participant.is_active
      and (participant.expires_at is null or participant.expires_at > now())
      and (participant.starts_on is null or participant.starts_on <= current_date)
      and (participant.ends_on is null or participant.ends_on >= current_date)
      and app_private.has_project_access(participant.project_id)
  );
$$;
revoke all on function app_private.workflow_owner_visible_on_project(uuid) from public, anon, authenticated;
grant execute on function app_private.workflow_owner_visible_on_project(uuid) to authenticated;

create or replace function app_private.workflow_owner_matches_project(
  p_owner_organization_id uuid,
  p_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.projects project
    where project.id = p_project_id
      and app_private.has_project_access(project.id)
      and (
        project.lead_organization_id = p_owner_organization_id
        or exists (
          select 1 from public.project_participants participant
          where participant.project_id = project.id
            and participant.organization_id = p_owner_organization_id
            and participant.is_active
            and (participant.expires_at is null or participant.expires_at > now())
            and (participant.starts_on is null or participant.starts_on <= current_date)
            and (participant.ends_on is null or participant.ends_on >= current_date)
        )
      )
  );
$$;
revoke all on function app_private.workflow_owner_matches_project(uuid, uuid) from public, anon, authenticated;

drop policy if exists workflow_definitions_read_authenticated on public.workflow_definitions;
drop policy if exists workflows_select on public.workflow_definitions;
drop policy if exists workflow_definition_read_pinned on public.workflow_definitions;
create policy workflow_definitions_read_authenticated on public.workflow_definitions
for select to authenticated using (
  (select app_private.is_system_admin())
  or (select app_private.is_org_member(organization_id))
  or (select app_private.workflow_owner_visible_on_project(organization_id))
  or (select app_private.can_read_pinned_workflow(id))
);

drop policy if exists workflow_stages_read_authenticated on public.workflow_stages;
drop policy if exists stages_select on public.workflow_stages;
create policy workflow_stages_read_authenticated on public.workflow_stages
for select to authenticated using (
  exists (
    select 1 from public.workflow_definitions definition
    where definition.id = workflow_id
      and ((select app_private.is_system_admin())
        or (select app_private.is_org_member(definition.organization_id))
        or (select app_private.workflow_owner_visible_on_project(definition.organization_id))
        or (select app_private.can_read_pinned_workflow(definition.id)))
  )
);

drop policy if exists workflow_versions_read_authenticated on public.workflow_versions;
drop policy if exists workflow_versions_select on public.workflow_versions;
drop policy if exists workflow_version_read_pinned on public.workflow_versions;
create policy workflow_versions_read_authenticated on public.workflow_versions
for select to authenticated using (
  exists (
    select 1 from public.workflow_definitions definition
    where definition.id = workflow_id
      and ((select app_private.is_system_admin())
        or (select app_private.is_org_member(definition.organization_id))
        or (select app_private.workflow_owner_visible_on_project(definition.organization_id))
        or exists (select 1 from public.workstreams pinned where pinned.workflow_version_id = workflow_versions.id and app_private.has_project_access(pinned.project_id)))
  )
);

drop policy if exists workflow_version_stages_read_authenticated on public.workflow_version_stages;
drop policy if exists workflow_version_stages_select_admin on public.workflow_version_stages;
drop policy if exists workflow_stage_read_pinned on public.workflow_version_stages;
create policy workflow_version_stages_read_authenticated on public.workflow_version_stages
for select to authenticated using (
  exists (
    select 1 from public.workflow_versions version
    join public.workflow_definitions definition on definition.id = version.workflow_id
    where version.id = workflow_version_id
      and ((select app_private.is_system_admin())
        or (select app_private.is_org_member(definition.organization_id))
        or (select app_private.workflow_owner_visible_on_project(definition.organization_id))
        or exists (select 1 from public.workstreams pinned where pinned.workflow_version_id = workflow_version_stages.workflow_version_id and app_private.has_project_access(pinned.project_id)))
  )
);

-- Draft revisions inherit automation from the source version. Historical
-- workflows start with automatic routing disabled by the column default.
create or replace function app_private.copy_workflow_automation_to_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lifecycle_status = 'draft' and new.workflow_id is not null then
    select source.intake_questions, source.routing_rules, source.stage_branches,
           source.notice_templates, source.auto_route_enabled
      into new.intake_questions, new.routing_rules, new.stage_branches,
           new.notice_templates, new.auto_route_enabled
    from public.workflow_versions source
    where source.workflow_id = new.workflow_id
      and source.lifecycle_status = 'published'
    order by source.version_number desc
    limit 1;
  end if;
  return new;
end;
$$;
revoke all on function app_private.copy_workflow_automation_to_draft() from public, anon, authenticated;
drop trigger if exists workflow_versions_copy_automation_to_draft on public.workflow_versions;
create trigger workflow_versions_copy_automation_to_draft
before insert on public.workflow_versions
for each row execute function app_private.copy_workflow_automation_to_draft();

create or replace function public.rpc_update_workflow_draft_automation(
  p_version_id text,
  p_config jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_version public.workflow_versions%rowtype;
begin
  select definition.organization_id into v_organization_id
  from public.workflow_versions version
  join public.workflow_definitions definition on definition.id = version.workflow_id
  where version.id = p_version_id;
  if v_organization_id is null then raise exception 'workflow version not found: %', p_version_id; end if;
  perform app_private.require_workflow_admin(v_organization_id);
  if jsonb_typeof(p_config) <> 'object' then raise exception 'workflow automation config must be an object'; end if;
  if not exists (
    select 1 from public.workflow_versions
    where id = p_version_id and lifecycle_status = 'draft'
  ) then
    raise exception 'only draft workflow versions can be edited';
  end if;
  if coalesce(jsonb_typeof(p_config->'intakeQuestions'), 'array') <> 'array'
     or coalesce(jsonb_typeof(p_config->'routingRules'), 'array') <> 'array'
     or coalesce(jsonb_typeof(p_config->'stageBranches'), 'array') <> 'array'
     or coalesce(jsonb_typeof(p_config->'noticeTemplates'), 'array') <> 'array' then
    raise exception 'workflow automation lists must be JSON arrays';
  end if;
  if p_config->'autoRouteEnabled' is not null and jsonb_typeof(p_config->'autoRouteEnabled') <> 'boolean' then
    raise exception 'autoRouteEnabled must be a boolean';
  end if;
  update public.workflow_versions set
    intake_questions = coalesce(p_config->'intakeQuestions', '[]'::jsonb),
    routing_rules = coalesce(p_config->'routingRules', '[]'::jsonb),
    stage_branches = coalesce(p_config->'stageBranches', '[]'::jsonb),
    notice_templates = coalesce(p_config->'noticeTemplates', '[]'::jsonb),
    auto_route_enabled = coalesce(p_config->'autoRouteEnabled' = 'true'::jsonb, false)
  where id = p_version_id
  returning * into v_version;
  return jsonb_build_object(
    'intakeQuestions', v_version.intake_questions,
    'routingRules', v_version.routing_rules,
    'stageBranches', v_version.stage_branches,
    'noticeTemplates', v_version.notice_templates,
    'autoRouteEnabled', v_version.auto_route_enabled
  );
end;
$$;
revoke all on function public.rpc_update_workflow_draft_automation(text, jsonb) from public, anon;
grant execute on function public.rpc_update_workflow_draft_automation(text, jsonb) to authenticated;

-- Shared database evaluator. Conditions are ANDed and keep the same primitive
-- comparison semantics as lib/workflow-rules.ts.
create or replace function app_private.workflow_conditions_match(
  p_conditions jsonb,
  p_answers jsonb,
  p_review_outcome text default null,
  p_project jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_condition jsonb;
  v_source text;
  v_key text;
  v_operator text;
  v_actual jsonb;
  v_values jsonb;
begin
  if coalesce(jsonb_typeof(p_conditions), 'array') <> 'array'
     or coalesce(jsonb_typeof(p_answers), 'object') <> 'object'
     or coalesce(jsonb_typeof(p_project), 'object') <> 'object' then
    return false;
  end if;
  for v_condition in select value from jsonb_array_elements(coalesce(p_conditions, '[]'::jsonb)) loop
    if jsonb_typeof(v_condition) <> 'object' then return false; end if;
    v_source := coalesce(v_condition->>'source', 'answer');
    v_key := coalesce(v_condition->>'key', '');
    v_operator := coalesce(v_condition->>'operator', '');
    if v_source = 'review_outcome' then
      v_actual := to_jsonb(p_review_outcome);
    elsif v_source = 'answer' then
      v_actual := p_answers->v_key;
    elsif v_source = 'project' and v_key in ('projectId', 'projectNumber', 'projectType', 'customerOrganizationId', 'leadOrganizationId') then
      v_actual := p_project->v_key;
    else
      return false;
    end if;
    if v_actual is null or v_actual = 'null'::jsonb then return false; end if;
    if v_operator in ('equals', 'yes_no') then
      if v_actual is distinct from v_condition->'value' then return false; end if;
    elsif v_operator = 'one_of' then
      v_values := case when jsonb_typeof(v_condition->'values') = 'array' then v_condition->'values' else '[]'::jsonb end;
      if jsonb_typeof(v_actual) <> 'string'
         or not exists (
           select 1 from jsonb_array_elements_text(v_values) allowed(value)
           where allowed.value = v_actual #>> '{}'
         ) then
        return false;
      end if;
    else
      return false;
    end if;
  end loop;
  return true;
end;
$$;
revoke all on function app_private.workflow_conditions_match(jsonb, jsonb, text, jsonb) from public, anon, authenticated;

create or replace function app_private.workflow_date_is_valid(p_value text)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  begin
    perform p_value::date;
    return true;
  exception when others then
    return false;
  end;
end;
$$;
revoke all on function app_private.workflow_date_is_valid(text) from public, anon, authenticated;

-- Validate the full condition contract at the database publish gate. This
-- keeps direct RPC callers from publishing rules that the shared evaluator
-- could never match (for example, text comparisons against yes/no answers).
create or replace function app_private.workflow_condition_is_valid(
  p_condition jsonb,
  p_questions jsonb,
  p_allow_review_outcome boolean default false
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_source text;
  v_key text;
  v_operator text;
  v_question jsonb;
begin
  if jsonb_typeof(p_condition) <> 'object' then return false; end if;
  v_source := coalesce(p_condition->>'source', 'answer');
  v_key := coalesce(p_condition->>'key', '');
  v_operator := coalesce(p_condition->>'operator', '');
  if nullif(trim(v_key), '') is null then return false; end if;

  if v_source = 'answer' then
    select question.value into v_question
    from jsonb_array_elements(case when jsonb_typeof(p_questions) = 'array' then p_questions else '[]'::jsonb end) question(value)
    where question.value->>'key' = v_key
    limit 1;
    if v_question is null then return false; end if;
    if v_question->>'type' = 'yes_no' and v_operator <> 'yes_no' then return false; end if;
    if v_question->>'type' <> 'yes_no' and v_operator = 'yes_no' then return false; end if;
  elsif v_source = 'review_outcome' then
    if not p_allow_review_outcome or v_key <> 'review_outcome' or v_operator = 'yes_no' then return false; end if;
  elsif v_source = 'project' then
    if v_key not in ('projectId', 'projectNumber', 'projectType', 'customerOrganizationId', 'leadOrganizationId')
       or v_operator = 'yes_no' then return false; end if;
  else
    return false;
  end if;

  if v_operator = 'equals' then
    if jsonb_typeof(p_condition->'value') <> 'string'
       or nullif(trim(p_condition->>'value'), '') is null then return false; end if;
    if v_source = 'answer' and v_question->>'type' = 'single_choice'
       and not exists (
         select 1 from jsonb_array_elements(case when jsonb_typeof(v_question->'options') = 'array' then v_question->'options' else '[]'::jsonb end) option(value)
         where option.value = p_condition->'value'
       ) then return false; end if;
    if v_source = 'answer' and v_question->>'type' = 'date'
       and not app_private.workflow_date_is_valid(p_condition->>'value') then return false; end if;
  elsif v_operator = 'one_of' then
    if jsonb_typeof(p_condition->'values') <> 'array'
       or jsonb_array_length(p_condition->'values') = 0 then return false; end if;
    if exists (
      select 1 from jsonb_array_elements(p_condition->'values') candidate(value)
      where jsonb_typeof(candidate.value) <> 'string' or nullif(trim(candidate.value #>> '{}'), '') is null
    ) or exists (
      select 1 from jsonb_array_elements(p_condition->'values') candidate(value)
      group by candidate.value having count(*) > 1
    ) then return false; end if;
    if v_source = 'answer' and v_question->>'type' = 'single_choice'
       and exists (
         select 1 from jsonb_array_elements(p_condition->'values') candidate(value)
         where not exists (
           select 1 from jsonb_array_elements(case when jsonb_typeof(v_question->'options') = 'array' then v_question->'options' else '[]'::jsonb end) option(value)
           where option.value = candidate.value
         )
       ) then return false; end if;
    if v_source = 'answer' and v_question->>'type' = 'date'
       and exists (
         select 1 from jsonb_array_elements(p_condition->'values') candidate(value)
         where not app_private.workflow_date_is_valid(candidate.value #>> '{}')
       ) then return false; end if;
  elsif v_operator = 'yes_no' then
    if v_source <> 'answer' or jsonb_typeof(p_condition->'value') <> 'boolean' then return false; end if;
  else
    return false;
  end if;
  return true;
end;
$$;
revoke all on function app_private.workflow_condition_is_valid(jsonb, jsonb, boolean) from public, anon, authenticated;

-- Allowed values for one simple condition. Validation rejects malformed
-- operators before publish; these guards keep draft validation recoverable.
create or replace function app_private.workflow_condition_values(p_condition jsonb)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_condition) <> 'object' then '[]'::jsonb
    when p_condition->>'operator' in ('equals', 'yes_no') and p_condition->'value' is not null
      then jsonb_build_array(p_condition->'value')
    when p_condition->>'operator' = 'one_of' and jsonb_typeof(p_condition->'values') = 'array'
      then p_condition->'values'
    else '[]'::jsonb
  end;
$$;
revoke all on function app_private.workflow_condition_values(jsonb) from public, anon, authenticated;

create or replace function app_private.workflow_conditions_satisfiable(p_conditions jsonb)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_condition jsonb;
  v_source text;
  v_key text;
  v_values jsonb;
  v_next_values jsonb;
begin
  if coalesce(jsonb_typeof(p_conditions), 'array') <> 'array' then return false; end if;
  for v_condition in select value from jsonb_array_elements(coalesce(p_conditions, '[]'::jsonb)) loop
    if jsonb_typeof(v_condition) <> 'object' then return false; end if;
    v_source := coalesce(v_condition->>'source', 'answer');
    v_key := coalesce(v_condition->>'key', '');
    v_values := app_private.workflow_condition_values(v_condition);
    if jsonb_array_length(v_values) = 0 then return false; end if;
    select coalesce(jsonb_agg(item.value order by item.ordinality), '[]'::jsonb)
      into v_next_values
    from jsonb_array_elements(v_values) with ordinality item(value, ordinality)
    where not exists (
      select 1 from jsonb_array_elements(coalesce(p_conditions, '[]'::jsonb)) other
      where coalesce(other->>'source', 'answer') = v_source
        and coalesce(other->>'key', '') = v_key
        and not exists (
          select 1 from jsonb_array_elements(app_private.workflow_condition_values(other)) allowed(value)
          where allowed.value = item.value
        )
    );
    if jsonb_array_length(v_next_values) = 0 then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function app_private.workflow_conditions_satisfiable(jsonb) from public, anon, authenticated;

-- Return true when every assignment accepted by p_narrow is also accepted by
-- p_broad. Both arrays represent ANDed conditions over answer/project fields.
create or replace function app_private.workflow_conditions_subsume(p_broad jsonb, p_narrow jsonb)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_field record;
  v_broad_values jsonb;
  v_narrow_values jsonb;
begin
  if coalesce(jsonb_typeof(p_broad), 'array') <> 'array'
     or coalesce(jsonb_typeof(p_narrow), 'array') <> 'array' then return false; end if;
  if not app_private.workflow_conditions_satisfiable(p_broad)
     or not app_private.workflow_conditions_satisfiable(p_narrow) then return false; end if;
  for v_field in
    select distinct coalesce(condition->>'source', 'answer') as source, condition->>'key' as key
    from jsonb_array_elements(p_broad) condition
  loop
    if not exists (
      select 1 from jsonb_array_elements(p_narrow) condition
      where coalesce(condition->>'source', 'answer') = v_field.source
        and condition->>'key' = v_field.key
    ) then return false; end if;

    select coalesce(jsonb_agg(candidate.value order by candidate.ordinality), '[]'::jsonb)
      into v_broad_values
    from jsonb_array_elements(app_private.workflow_condition_values((
      select condition from jsonb_array_elements(p_broad) condition
      where coalesce(condition->>'source', 'answer') = v_field.source
        and condition->>'key' = v_field.key limit 1
    ))) with ordinality candidate(value, ordinality)
    where not exists (
      select 1 from jsonb_array_elements(p_broad) condition
      where coalesce(condition->>'source', 'answer') = v_field.source
        and condition->>'key' = v_field.key
        and not exists (
          select 1 from jsonb_array_elements(app_private.workflow_condition_values(condition)) allowed(value)
          where allowed.value = candidate.value
        )
    );
    select coalesce(jsonb_agg(candidate.value order by candidate.ordinality), '[]'::jsonb)
      into v_narrow_values
    from jsonb_array_elements(app_private.workflow_condition_values((
      select condition from jsonb_array_elements(p_narrow) condition
      where coalesce(condition->>'source', 'answer') = v_field.source
        and condition->>'key' = v_field.key limit 1
    ))) with ordinality candidate(value, ordinality)
    where not exists (
      select 1 from jsonb_array_elements(p_narrow) condition
      where coalesce(condition->>'source', 'answer') = v_field.source
        and condition->>'key' = v_field.key
        and not exists (
          select 1 from jsonb_array_elements(app_private.workflow_condition_values(condition)) allowed(value)
          where allowed.value = candidate.value
        )
    );
    if exists (
      select 1 from jsonb_array_elements(v_narrow_values) value
      where not exists (select 1 from jsonb_array_elements(v_broad_values) allowed where allowed.value = value.value)
    ) then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function app_private.workflow_conditions_subsume(jsonb, jsonb) from public, anon, authenticated;

create or replace function app_private.workflow_rule_priority(p_value text)
returns integer
language plpgsql
immutable
security definer
set search_path = ''
as $$
begin
  if p_value is null or p_value !~ '^-?\d+$' then return null; end if;
  begin
    return p_value::integer;
  exception when numeric_value_out_of_range then
    return null;
  end;
end;
$$;
revoke all on function app_private.workflow_rule_priority(text) from public, anon, authenticated;

create or replace function app_private.validate_workflow_automation(p_version_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version public.workflow_versions%rowtype;
  v_errors jsonb := '[]'::jsonb;
  v_bad text;
begin
  select * into v_version from public.workflow_versions where id = p_version_id;
  if not found then return jsonb_build_array('Workflow version not found'); end if;

  if coalesce(jsonb_typeof(v_version.intake_questions), 'array') <> 'array'
     or coalesce(jsonb_typeof(v_version.routing_rules), 'array') <> 'array'
     or coalesce(jsonb_typeof(v_version.stage_branches), 'array') <> 'array'
     or coalesce(jsonb_typeof(v_version.notice_templates), 'array') <> 'array' then
    return jsonb_build_array('Intake questions, routing rules, stage branches, and notification templates must be arrays');
  end if;
  if exists (select 1 from jsonb_array_elements(v_version.intake_questions) item where jsonb_typeof(item) <> 'object')
     or exists (select 1 from jsonb_array_elements(v_version.routing_rules) item where jsonb_typeof(item) <> 'object')
     or exists (select 1 from jsonb_array_elements(v_version.stage_branches) item where jsonb_typeof(item) <> 'object')
     or exists (select 1 from jsonb_array_elements(v_version.notice_templates) item where jsonb_typeof(item) <> 'object') then
    return jsonb_build_array('Workflow automation entries must be JSON objects');
  end if;
  if exists (
    select 1 from public.workflow_version_stages stage
    where stage.workflow_version_id = p_version_id
      and coalesce(jsonb_typeof(stage.permitted_transitions), 'array') <> 'array'
  ) then
    return jsonb_build_array('Stage permitted transitions must be JSON arrays');
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_version.intake_questions) q
    group by q->>'key' having count(*) > 1
  ) then v_errors := v_errors || jsonb_build_array('Intake question keys must be unique'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.intake_questions) q
    where nullif(trim(q->>'key'), '') is null or nullif(trim(q->>'label'), '') is null
       or coalesce(q->>'type', '') not in ('text', 'long_text', 'single_choice', 'yes_no', 'date')
       or coalesce(jsonb_typeof(q->'required'), '') <> 'boolean'
  ) then v_errors := v_errors || jsonb_build_array('Every intake question needs a key, label, supported type, and required flag'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.intake_questions) q
    where q->>'type' = 'single_choice'
      and (jsonb_typeof(q->'options') <> 'array' or case when jsonb_typeof(q->'options') = 'array' then jsonb_array_length(q->'options') else 0 end = 0)
  ) then v_errors := v_errors || jsonb_build_array('Every single choice question needs one or more options'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.intake_questions) q
    where q->'options' is not null and jsonb_typeof(q->'options') <> 'array'
  ) then v_errors := v_errors || jsonb_build_array('Intake question options must be arrays'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.intake_questions) q
    cross join lateral jsonb_array_elements(case when jsonb_typeof(q->'options') = 'array' then q->'options' else '[]'::jsonb end) option(value)
    where q->>'type' = 'single_choice' and (jsonb_typeof(option.value) <> 'string' or nullif(trim(option.value #>> '{}'), '') is null)
  ) then v_errors := v_errors || jsonb_build_array('Single choice options must be non-empty text'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.intake_questions) q
    cross join lateral jsonb_array_elements(case when jsonb_typeof(q->'options') = 'array' then q->'options' else '[]'::jsonb end) option(value)
    group by q->>'key', option.value having count(*) > 1
  ) then v_errors := v_errors || jsonb_build_array('Single choice options must be unique within each question'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.intake_questions) q
    where q->>'type' <> 'single_choice'
      and jsonb_typeof(q->'options') = 'array'
      and jsonb_array_length(q->'options') > 0
  ) then v_errors := v_errors || jsonb_build_array('Only single choice questions can define options'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.intake_questions) q
    where q->'visibleWhen' is not null and jsonb_typeof(q->'visibleWhen') <> 'array'
  ) then v_errors := v_errors || jsonb_build_array('Intake question visibility conditions must be arrays'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.intake_questions) q
    cross join lateral jsonb_array_elements(case when jsonb_typeof(q->'visibleWhen') = 'array' then q->'visibleWhen' else '[]'::jsonb end) condition
    where coalesce(condition->>'source', 'answer') not in ('answer', 'project')
       or jsonb_typeof(condition) <> 'object'
       or nullif(trim(condition->>'key'), '') is null
       or condition->>'operator' not in ('equals', 'one_of', 'yes_no')
       or (coalesce(condition->>'source', 'answer') = 'answer'
           and not exists (
             select 1
             from jsonb_array_elements(v_version.intake_questions) with ordinality source_question(value, ordinality)
             where source_question.value->>'key' = condition->>'key'
               and source_question.ordinality < (select current_question.ordinality
                 from jsonb_array_elements(v_version.intake_questions) with ordinality current_question(value, ordinality)
                 where current_question.value = q limit 1)
           ))
       or (condition->>'source' = 'project' and condition->>'key' not in ('projectId', 'projectNumber', 'projectType', 'customerOrganizationId', 'leadOrganizationId'))
       or (condition->>'source' = 'project' and condition->>'operator' = 'yes_no')
       or (condition->>'operator' = 'yes_no' and coalesce(jsonb_typeof(condition->'value'), '') <> 'boolean')
       or (condition->>'operator' = 'one_of' and (jsonb_typeof(condition->'values') <> 'array' or case when jsonb_typeof(condition->'values') = 'array' then jsonb_array_length(condition->'values') else 0 end = 0
           or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(condition->'values') = 'array' then condition->'values' else '[]'::jsonb end) as candidate(value) where jsonb_typeof(candidate.value) <> 'string' or nullif(trim(candidate.value #>> '{}'), '') is null)))
       or (condition->>'operator' = 'equals' and (jsonb_typeof(condition->'value') <> 'string' or nullif(trim(condition->>'value'), '') is null))
       or condition->>'key' = q->>'key'
       or not app_private.workflow_condition_is_valid(condition, v_version.intake_questions, false)
  ) then v_errors := v_errors || jsonb_build_array('An intake visibility condition is invalid or references its own/later answer'); end if;

  if exists (
    select 1 from (
      select app_private.workflow_rule_priority(rule->>'priority') as priority
      from jsonb_array_elements(v_version.routing_rules) rule
    ) priorities group by priority having count(*) > 1
  ) then v_errors := v_errors || jsonb_build_array('Routing rule priorities must be unique'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.routing_rules) rule
    where app_private.workflow_rule_priority(rule->>'priority') is null
  ) then v_errors := v_errors || jsonb_build_array('Routing rule priorities must be integers'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.routing_rules) rule
    where nullif(trim(rule->>'id'), '') is null or nullif(trim(rule->>'name'), '') is null
       or nullif(trim(rule->'destination'->>'workflowVersionId'), '') is null
       or nullif(trim(rule->'destination'->>'leadOrgCode'), '') is null
       or coalesce(jsonb_typeof(rule->'conditions'), '') <> 'array'
  ) then v_errors := v_errors || jsonb_build_array('Routing rules need an id, name, conditions array, and complete destination'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.routing_rules) rule
    group by rule->>'id' having count(*) > 1
  ) then v_errors := v_errors || jsonb_build_array('Routing rule ids must be unique'); end if;
  if v_version.auto_route_enabled and jsonb_array_length(v_version.routing_rules) = 0 then
    v_errors := v_errors || jsonb_build_array('Automatic routing needs at least one routing rule');
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.routing_rules) rule
      where exists (
      select 1 from jsonb_array_elements(v_version.routing_rules) earlier
      where app_private.workflow_rule_priority(earlier->>'priority') < app_private.workflow_rule_priority(rule->>'priority')
        and app_private.workflow_conditions_subsume(earlier->'conditions', rule->'conditions')
    )
  ) then v_errors := v_errors || jsonb_build_array('A routing rule is unreachable because an earlier rule always matches first'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.routing_rules) rule
    where not app_private.workflow_conditions_satisfiable(rule->'conditions')
  ) then v_errors := v_errors || jsonb_build_array('A routing rule has contradictory or malformed conditions and can never match'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.routing_rules) rule
    cross join lateral jsonb_array_elements(case when jsonb_typeof(rule->'conditions') = 'array' then rule->'conditions' else '[]'::jsonb end) condition
    where coalesce(condition->>'source', 'answer') = 'answer'
      and not exists (select 1 from jsonb_array_elements(v_version.intake_questions) q where q->>'key' = condition->>'key')
  ) then v_errors := v_errors || jsonb_build_array('A routing condition references an unknown intake question'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.routing_rules) rule
    cross join lateral jsonb_array_elements(case when jsonb_typeof(rule->'conditions') = 'array' then rule->'conditions' else '[]'::jsonb end) condition
    where coalesce(condition->>'source', 'answer') not in ('answer', 'review_outcome', 'project')
       or condition->>'operator' not in ('equals', 'one_of', 'yes_no')
       or nullif(trim(condition->>'key'), '') is null
       or (condition->>'operator' = 'yes_no' and coalesce(jsonb_typeof(condition->'value'), '') <> 'boolean')
       or (condition->>'operator' = 'one_of' and (jsonb_typeof(condition->'values') <> 'array' or case when jsonb_typeof(condition->'values') = 'array' then jsonb_array_length(condition->'values') else 0 end = 0
           or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(condition->'values') = 'array' then condition->'values' else '[]'::jsonb end) as candidate(value) where jsonb_typeof(candidate.value) <> 'string' or nullif(trim(candidate.value #>> '{}'), '') is null)))
       or (condition->>'operator' = 'equals' and (jsonb_typeof(condition->'value') <> 'string' or nullif(trim(condition->>'value'), '') is null))
       or jsonb_typeof(condition) <> 'object'
       or (condition->>'source' = 'review_outcome' and condition->>'key' <> 'review_outcome')
       or (condition->>'source' = 'review_outcome' and condition->>'operator' = 'yes_no')
       or (condition->>'source' = 'project' and condition->>'key' not in ('projectId', 'projectNumber', 'projectType', 'customerOrganizationId', 'leadOrganizationId'))
       or (condition->>'source' = 'project' and condition->>'operator' = 'yes_no')
       or (coalesce(condition->>'source', 'answer') = 'answer' and condition->>'operator' = 'yes_no'
           and not exists (select 1 from jsonb_array_elements(v_version.intake_questions) q where q->>'key' = condition->>'key' and q->>'type' = 'yes_no'))
       or not app_private.workflow_condition_is_valid(condition, v_version.intake_questions, false)
  ) then v_errors := v_errors || jsonb_build_array('A routing rule contains an invalid condition'); end if;
  if exists (
    select 1
    from jsonb_array_elements(v_version.routing_rules) rule
    join public.workflow_versions target on target.id = rule->'destination'->>'workflowVersionId'
    join public.workflow_definitions target_definition on target_definition.id = target.workflow_id
    where target.lifecycle_status <> 'published' or not target.is_active or not target_definition.active
  ) or exists (
    select 1 from jsonb_array_elements(v_version.routing_rules) rule
    where not exists (select 1 from public.workflow_versions target where target.id = rule->'destination'->>'workflowVersionId' and target.lifecycle_status = 'published' and target.is_active)
  ) then v_errors := v_errors || jsonb_build_array('Every routing destination must use an active published workflow version'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.routing_rules) rule
    where not exists (
      select 1 from public.organizations owner
      where owner.code = upper(trim(rule->'destination'->>'leadOrgCode')) and owner.active
    )
  ) then v_errors := v_errors || jsonb_build_array('Every routing destination needs an active owning organization'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.routing_rules) rule
    where v_version.auto_route_enabled
      and nullif(trim(rule->'destination'->>'assignmentGroupId'), '') is null
  ) then v_errors := v_errors || jsonb_build_array('Automatic routing requires an assignment group for every route'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.routing_rules) rule
    where nullif(trim(rule->'destination'->>'assignmentGroupId'), '') is not null
      and not exists (
        select 1 from public.assignment_groups grp
        where grp.id::text = rule->'destination'->>'assignmentGroupId'
          and grp.active
          and upper(grp.org_code) = upper(trim(rule->'destination'->>'leadOrgCode'))
      )
  ) then v_errors := v_errors || jsonb_build_array('A routing destination references a missing, inactive, or mismatched assignment group'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.routing_rules) rule
    where nullif(trim(rule->'destination'->>'assignedToUserId'), '') is not null
      and not exists (
        select 1 from public.assignment_group_memberships membership
        join auth.users member_user on member_user.id = membership.user_id
        where membership.assignment_group_id::text = rule->'destination'->>'assignmentGroupId'
          and membership.user_id::text = rule->'destination'->>'assignedToUserId'
      )
  ) then v_errors := v_errors || jsonb_build_array('A routing destination assignee must belong to its active assignment group'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.routing_rules) rule
    where nullif(trim(rule->'destination'->>'targetDate'), '') is not null
      and not app_private.workflow_date_is_valid(rule->'destination'->>'targetDate')
  ) then v_errors := v_errors || jsonb_build_array('A routing target date must use YYYY-MM-DD'); end if;

  if exists (
    select 1 from jsonb_array_elements(v_version.stage_branches) branch
    where nullif(trim(branch->>'id'), '') is null
       or not exists (select 1 from public.workflow_version_stages source where source.workflow_version_id = p_version_id and source.stage_key = branch->>'fromStageKey')
       or not exists (select 1 from public.workflow_version_stages target where target.workflow_version_id = p_version_id and target.stage_key = branch->>'toStageKey')
       or branch->>'fromStageKey' = branch->>'toStageKey'
       or coalesce(jsonb_typeof(branch->'conditions'), '') <> 'array'
  ) then v_errors := v_errors || jsonb_build_array('A stage branch references a missing stage or invalid condition list'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.stage_branches) branch
    group by branch->>'id' having count(*) > 1
  ) then v_errors := v_errors || jsonb_build_array('Stage branch ids must be unique'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.stage_branches) branch
    join public.workflow_version_stages source on source.workflow_version_id = p_version_id and source.stage_key = branch->>'fromStageKey'
    where jsonb_array_length(coalesce(source.permitted_transitions, '[]'::jsonb)) > 0
      and not exists (
        select 1 from jsonb_array_elements_text(source.permitted_transitions) allowed(value)
        where lower(allowed.value) = lower(branch->>'toStageKey')
      )
  ) then v_errors := v_errors || jsonb_build_array('A stage branch target is not a permitted transition'); end if;
  if exists (
    select 1 from (
      select branch->>'fromStageKey' as stage_key, coalesce(app_private.workflow_rule_priority(branch->>'priority'), 0) as priority
      from jsonb_array_elements(v_version.stage_branches) branch
    ) priorities group by stage_key, priority having count(*) > 1
  ) then v_errors := v_errors || jsonb_build_array('Stage branch priorities must be unique for each source stage'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.stage_branches) branch
    where branch->>'priority' is not null and app_private.workflow_rule_priority(branch->>'priority') is null
  ) then v_errors := v_errors || jsonb_build_array('Stage branch priorities must be integers'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.stage_branches) branch
    cross join lateral jsonb_array_elements(case when jsonb_typeof(branch->'conditions') = 'array' then branch->'conditions' else '[]'::jsonb end) condition
    where coalesce(condition->>'source', 'answer') = 'answer'
      and not exists (select 1 from jsonb_array_elements(v_version.intake_questions) q where q->>'key' = condition->>'key')
  ) then v_errors := v_errors || jsonb_build_array('A stage branch condition references an unknown intake question'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.stage_branches) branch
    cross join lateral jsonb_array_elements(case when jsonb_typeof(branch->'conditions') = 'array' then branch->'conditions' else '[]'::jsonb end) condition
    where jsonb_typeof(condition) <> 'object'
       or coalesce(condition->>'source', 'answer') not in ('answer', 'review_outcome', 'project')
       or condition->>'operator' not in ('equals', 'one_of', 'yes_no')
       or nullif(trim(condition->>'key'), '') is null
       or (condition->>'source' = 'review_outcome' and condition->>'key' <> 'review_outcome')
       or (condition->>'source' = 'review_outcome' and condition->>'operator' = 'yes_no')
       or (condition->>'source' = 'project' and condition->>'key' not in ('projectId', 'projectNumber', 'projectType', 'customerOrganizationId', 'leadOrganizationId'))
       or (condition->>'source' = 'project' and condition->>'operator' = 'yes_no')
       or (condition->>'operator' = 'yes_no' and coalesce(jsonb_typeof(condition->'value'), '') <> 'boolean')
       or (condition->>'operator' = 'equals' and (jsonb_typeof(condition->'value') <> 'string' or nullif(trim(condition->>'value'), '') is null))
       or (condition->>'operator' = 'one_of' and (jsonb_typeof(condition->'values') <> 'array' or case when jsonb_typeof(condition->'values') = 'array' then jsonb_array_length(condition->'values') else 0 end = 0
           or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(condition->'values') = 'array' then condition->'values' else '[]'::jsonb end) as candidate(value) where jsonb_typeof(candidate.value) <> 'string' or nullif(trim(candidate.value #>> '{}'), '') is null)))
       or (coalesce(condition->>'source', 'answer') = 'answer' and condition->>'operator' = 'yes_no'
           and not exists (select 1 from jsonb_array_elements(v_version.intake_questions) q where q->>'key' = condition->>'key' and q->>'type' = 'yes_no'))
       or not app_private.workflow_condition_is_valid(condition, v_version.intake_questions, true)
  ) then v_errors := v_errors || jsonb_build_array('A stage branch contains an invalid condition'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.stage_branches) branch
    where exists (
      select 1 from jsonb_array_elements(v_version.stage_branches) earlier
      where earlier->>'fromStageKey' = branch->>'fromStageKey'
        and coalesce(app_private.workflow_rule_priority(earlier->>'priority'), 0) < coalesce(app_private.workflow_rule_priority(branch->>'priority'), 0)
        and app_private.workflow_conditions_subsume(earlier->'conditions', branch->'conditions')
    )
  ) then v_errors := v_errors || jsonb_build_array('A stage branch is unreachable because an earlier branch always matches first'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.stage_branches) branch
    where not app_private.workflow_conditions_satisfiable(branch->'conditions')
  ) then v_errors := v_errors || jsonb_build_array('A stage branch has contradictory or malformed conditions and can never match'); end if;

  with recursive stage_edges as (
    select source.stage_key as from_key, target.stage_key as to_key
    from public.workflow_version_stages source
    cross join lateral jsonb_array_elements_text(source.permitted_transitions) allowed(value)
    join public.workflow_version_stages target
      on target.workflow_version_id = source.workflow_version_id
     and (lower(target.stage_key) = lower(allowed.value) or lower(target.label) = lower(allowed.value))
    where source.workflow_version_id = p_version_id
    union
    select source.stage_key, next_stage.stage_key
    from public.workflow_version_stages source
    join public.workflow_version_stages next_stage
      on next_stage.workflow_version_id = source.workflow_version_id
     and next_stage.sequence_order = source.sequence_order + 1
    where source.workflow_version_id = p_version_id
      and not exists (
        select 1 from jsonb_array_elements_text(source.permitted_transitions) allowed(value)
        join public.workflow_version_stages target
          on target.workflow_version_id = source.workflow_version_id
         and (lower(target.stage_key) = lower(allowed.value) or lower(target.label) = lower(allowed.value))
      )
    union
    select branch->>'fromStageKey', branch->>'toStageKey'
    from jsonb_array_elements(v_version.stage_branches) branch
  ), reach(start_key, node_key) as (
    select first_stage.stage_key, first_stage.stage_key
    from public.workflow_version_stages first_stage
    where first_stage.workflow_version_id = p_version_id and first_stage.sequence_order = 1
    union
    select reach.start_key, edge.to_key
    from reach join stage_edges edge on edge.from_key = reach.node_key
  )
  select string_agg(stage.stage_key, ', ' order by stage.sequence_order) into v_bad
  from public.workflow_version_stages stage
  where stage.workflow_version_id = p_version_id
    and not exists (select 1 from reach where reach.node_key = stage.stage_key);
  if v_bad is not null then v_errors := v_errors || jsonb_build_array('Workflow contains unreachable stages: ' || v_bad); end if;

  with recursive stage_edges as (
    select source.stage_key as from_key, target.stage_key as to_key
    from public.workflow_version_stages source
    cross join lateral jsonb_array_elements_text(source.permitted_transitions) allowed(value)
    join public.workflow_version_stages target
      on target.workflow_version_id = source.workflow_version_id
     and (lower(target.stage_key) = lower(allowed.value) or lower(target.label) = lower(allowed.value))
    where source.workflow_version_id = p_version_id
    union
    select source.stage_key, next_stage.stage_key
    from public.workflow_version_stages source
    join public.workflow_version_stages next_stage
      on next_stage.workflow_version_id = source.workflow_version_id
     and next_stage.sequence_order = source.sequence_order + 1
    where source.workflow_version_id = p_version_id
      and not exists (
        select 1 from jsonb_array_elements_text(source.permitted_transitions) allowed(value)
        join public.workflow_version_stages target
          on target.workflow_version_id = source.workflow_version_id
         and (lower(target.stage_key) = lower(allowed.value) or lower(target.label) = lower(allowed.value))
      )
    union
    select branch->>'fromStageKey', branch->>'toStageKey'
    from jsonb_array_elements(v_version.stage_branches) branch
  ), walks(start_key, node_key, path, has_cycle) as (
    select edge.from_key, edge.to_key, array[edge.from_key, edge.to_key], edge.from_key = edge.to_key
    from stage_edges edge
    union all
    select walk.start_key, edge.to_key, walk.path || edge.to_key, edge.to_key = any(walk.path)
    from walks walk join stage_edges edge on edge.from_key = walk.node_key
    where not walk.has_cycle
  )
  select string_agg(distinct walks.start_key, ', ' order by walks.start_key) into v_bad
  from walks where walks.has_cycle;
  if v_bad is not null then v_errors := v_errors || jsonb_build_array('Workflow transitions contain cycles from: ' || v_bad); end if;

  if exists (
    select 1 from jsonb_array_elements(v_version.notice_templates) template
    where nullif(trim(template->>'id'), '') is null
       or nullif(trim(template->>'title'), '') is null
       or nullif(trim(template->>'body'), '') is null
       or coalesce(template->>'trigger', '') not in ('request_routed', 'stage_completed', 'review_outcome')
       or coalesce(template->>'audience', 'both') not in ('customer', 'team', 'both')
  ) then v_errors := v_errors || jsonb_build_array('Notification templates need an id, trigger, title, and body'); end if;
  if exists (
    select 1 from jsonb_array_elements(v_version.notice_templates) template
    group by template->>'id' having count(*) > 1
  ) then v_errors := v_errors || jsonb_build_array('Notification template ids must be unique'); end if;

  return v_errors;
end;
$$;
revoke all on function app_private.validate_workflow_automation(text) from public, anon, authenticated;

create or replace function app_private.resolve_intake_workflow_version(
  p_project_id uuid,
  p_known_permit_type_id text,
  p_request_type text,
  p_requested_version_id text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_version_id text;
  v_match_count integer;
begin
  select * into v_project from public.projects where id = p_project_id;
  if not found then raise exception 'project not found: %', p_project_id; end if;

  if nullif(trim(p_requested_version_id), '') is not null then
    select version.id into v_version_id
    from public.workflow_versions version
    join public.workflow_definitions definition on definition.id = version.workflow_id
    where version.id = trim(p_requested_version_id)
      and version.lifecycle_status = 'published'
      and version.is_active
      and definition.active
      and app_private.workflow_owner_matches_project(definition.organization_id, p_project_id);
    if v_version_id is null then
      raise exception 'intake workflow version is not the current published version for this project';
    end if;
    return v_version_id;
  end if;

  with ranked as (
    select version.id,
      case
        when nullif(trim(p_known_permit_type_id), '') is not null
          and lower(trim(definition.case_type)) = lower(trim(p_known_permit_type_id)) then 1
        when nullif(trim(v_project.project_type), '') is not null
          and lower(trim(definition.case_type)) = lower(trim(v_project.project_type)) then 2
        when lower(trim(definition.case_type)) = lower(trim(p_request_type)) then 3
        else 9
      end as match_rank,
      version.version_number
    from public.workflow_versions version
    join public.workflow_definitions definition on definition.id = version.workflow_id
    where version.lifecycle_status = 'published'
      and version.is_active
      and definition.active
      and app_private.workflow_owner_matches_project(definition.organization_id, p_project_id)
      and lower(trim(definition.case_type)) in (
        lower(trim(coalesce(nullif(p_known_permit_type_id, ''), ''))),
        lower(trim(coalesce(nullif(v_project.project_type, ''), ''))),
        lower(trim(coalesce(nullif(p_request_type, ''), '')))
      )
  ), best_rank as (
    select min(match_rank) as rank from ranked
  )
  select count(*), min(ranked.id)
    into v_match_count, v_version_id
  from ranked join best_rank on ranked.match_rank = best_rank.rank;

  -- Multiple candidate owners are intentionally left for staff to resolve.
  if v_match_count = 1 then return v_version_id; end if;
  return null;
end;
$$;
revoke all on function app_private.resolve_intake_workflow_version(uuid, text, text, text) from public, anon, authenticated;

create or replace function app_private.assert_intake_answers(
  p_version_id text,
  p_answers jsonb,
  p_project jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.workflow_versions%rowtype;
  v_question jsonb;
  v_key text;
  v_answer jsonb;
  v_visible boolean;
begin
  if coalesce(jsonb_typeof(p_answers), 'object') <> 'object' then
    raise exception 'intake answers must be a JSON object';
  end if;
  if p_version_id is null then
    if p_answers <> '{}'::jsonb then raise exception 'intake answers require a published workflow version'; end if;
    return;
  end if;
  select * into v_version from public.workflow_versions where id = p_version_id;
  if not found or v_version.lifecycle_status <> 'published' or not v_version.is_active then
    raise exception 'intake workflow version is not currently published';
  end if;

  if exists (
    select 1 from jsonb_object_keys(p_answers) answer_key(key)
    where not exists (
      select 1 from jsonb_array_elements(v_version.intake_questions) question
      where question->>'key' = answer_key.key
    )
  ) then raise exception 'intake answers contain fields that are not configured for this workflow version'; end if;

  for v_question in select value from jsonb_array_elements(v_version.intake_questions) loop
    v_key := v_question->>'key';
    v_answer := p_answers->v_key;
    v_visible := app_private.workflow_conditions_match(v_question->'visibleWhen', p_answers, null, p_project);
    if not v_visible then
      if v_answer is not null and v_answer <> 'null'::jsonb then
        raise exception 'hidden intake question cannot be answered: %', v_key;
      end if;
      continue;
    end if;
    if v_answer is null or v_answer = 'null'::jsonb
       or (jsonb_typeof(v_answer) = 'string' and nullif(trim(v_answer #>> '{}'), '') is null) then
      if coalesce((v_question->>'required')::boolean, false) then
        raise exception 'required intake answer is missing: %', v_key;
      end if;
      continue;
    end if;

    if v_question->>'type' = 'yes_no' then
      if jsonb_typeof(v_answer) <> 'boolean' then raise exception 'intake answer must be yes or no: %', v_key; end if;
    elsif jsonb_typeof(v_answer) <> 'string' then
      raise exception 'intake answer must be text: %', v_key;
    elsif v_question->>'type' = 'single_choice' and not exists (
      select 1 from jsonb_array_elements_text(coalesce(v_question->'options', '[]'::jsonb)) option(value)
      where option.value = v_answer #>> '{}'
    ) then
      raise exception 'intake answer is not a configured option: %', v_key;
    elsif v_question->>'type' = 'date' then
      if (v_answer #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'intake date must use YYYY-MM-DD: %', v_key; end if;
      begin
        perform (v_answer #>> '{}')::date;
      exception when others then
        raise exception 'intake date is invalid: %', v_key;
      end;
    end if;
  end loop;
end;
$$;
revoke all on function app_private.assert_intake_answers(text, jsonb, jsonb) from public, anon, authenticated;

-- Preserve the existing owner/group/stage validator and add the automation
-- contract checks as a required part of the same publish gate.
alter function public.rpc_validate_workflow_draft(text)
  rename to rpc_validate_workflow_draft_stages_only;
revoke all on function public.rpc_validate_workflow_draft_stages_only(text) from public, anon, authenticated;

create function public.rpc_validate_workflow_draft(p_version_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_base_result jsonb;
  v_automation_errors jsonb;
  v_errors jsonb;
begin
  select definition.organization_id into v_organization_id
  from public.workflow_versions version
  join public.workflow_definitions definition on definition.id = version.workflow_id
  where version.id = p_version_id;
  if v_organization_id is null then raise exception 'workflow version not found: %', p_version_id; end if;
  perform app_private.require_workflow_admin(v_organization_id);
  if not exists (
    select 1 from public.workflow_versions
    where id = p_version_id and lifecycle_status in ('draft', 'validated')
  ) then
    raise exception 'only draft workflow versions can be validated';
  end if;

  v_base_result := public.rpc_validate_workflow_draft_stages_only(p_version_id);
  v_automation_errors := app_private.validate_workflow_automation(p_version_id);
  v_errors := coalesce(v_base_result->'errors', '[]'::jsonb) || coalesce(v_automation_errors, '[]'::jsonb);
  if jsonb_array_length(v_errors) = 0 then
    update public.workflow_versions set lifecycle_status = 'validated' where id = p_version_id;
  else
    update public.workflow_versions set lifecycle_status = 'draft' where id = p_version_id;
  end if;
  return jsonb_build_object('valid', jsonb_array_length(v_errors) = 0, 'errors', v_errors);
end;
$$;
revoke all on function public.rpc_validate_workflow_draft(text) from public, anon;
grant execute on function public.rpc_validate_workflow_draft(text) to authenticated;

create or replace function app_private.render_workflow_notice(p_template text, p_values jsonb)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_result text := coalesce(p_template, '');
  v_pair record;
begin
  if coalesce(jsonb_typeof(p_values), 'object') <> 'object' then return v_result; end if;
  for v_pair in select key, value from jsonb_each_text(p_values) loop
    v_result := replace(v_result, '{' || v_pair.key || '}', coalesce(v_pair.value, ''));
  end loop;
  return v_result;
end;
$$;
revoke all on function app_private.render_workflow_notice(text, jsonb) from public, anon, authenticated;

-- A route is a single database transaction with the request row. The selected
-- published version and answers are retained even when no rule matches.
create or replace function app_private.auto_route_customer_request(p_request_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.customer_requests%rowtype;
  v_project public.projects%rowtype;
  v_source_version public.workflow_versions%rowtype;
  v_target_version public.workflow_versions%rowtype;
  v_target_definition public.workflow_definitions%rowtype;
  v_rule jsonb;
  v_destination jsonb;
  v_template jsonb;
  v_receipt jsonb;
  v_project_context jsonb;
  v_notice_values jsonb;
  v_group public.assignment_groups%rowtype;
  v_owner public.organizations%rowtype;
  v_stage public.workflow_version_stages%rowtype;
  v_workstream public.workstreams%rowtype;
  v_workstream_id text;
  v_code text;
  v_target_date date;
  v_assigned_user_id uuid;
  v_user_id uuid;
  v_title text;
  v_body text;
  v_audience text := 'both';
  v_now timestamptz := now();
begin
  select * into v_request from public.customer_requests where id = p_request_id for update;
  if not found then raise exception 'customer request not found: %', p_request_id; end if;

  v_receipt := jsonb_build_object('status', 'manual', 'workflowVersionId', v_request.intake_workflow_version_id);
  if v_request.status <> 'submitted' then
    v_receipt := v_receipt || jsonb_build_object('reason', 'draft_request');
    update public.customer_requests set auto_route_receipt = v_receipt where id = v_request.id returning * into v_request;
    return to_jsonb(v_request);
  end if;
  if nullif(trim(v_request.related_workstream_id), '') is not null then
    v_receipt := v_receipt || jsonb_build_object('reason', 'existing_workstream');
    update public.customer_requests set auto_route_receipt = v_receipt where id = v_request.id returning * into v_request;
    return to_jsonb(v_request);
  end if;
  if v_request.intake_workflow_version_id is null then
    v_receipt := v_receipt || jsonb_build_object('reason', 'no_published_workflow');
    update public.customer_requests set auto_route_receipt = v_receipt where id = v_request.id returning * into v_request;
    return to_jsonb(v_request);
  end if;

  select * into v_source_version from public.workflow_versions
  where id = v_request.intake_workflow_version_id;
  if not found or v_source_version.lifecycle_status <> 'published'
     or not v_source_version.is_active then
    v_receipt := v_receipt || jsonb_build_object('reason', 'no_published_workflow');
    update public.customer_requests set auto_route_receipt = v_receipt where id = v_request.id returning * into v_request;
    return to_jsonb(v_request);
  end if;
  if not v_source_version.auto_route_enabled then
    v_receipt := v_receipt || jsonb_build_object('reason', 'auto_route_disabled');
    update public.customer_requests set auto_route_receipt = v_receipt where id = v_request.id returning * into v_request;
    return to_jsonb(v_request);
  end if;

  select * into v_project from public.projects where id::text = v_request.project_id or number = v_request.project_id limit 1;
  if not found then raise exception 'request project not found: %', v_request.project_id; end if;
  v_project_context := jsonb_build_object(
    'projectId', v_project.id::text,
    'projectNumber', v_project.number,
    'projectType', v_project.project_type,
    'customerOrganizationId', v_project.customer_organization_id::text,
    'leadOrganizationId', v_project.lead_organization_id::text
  );

  select rule.value into v_rule
  from jsonb_array_elements(v_source_version.routing_rules) with ordinality rule(value, ordinality)
  where app_private.workflow_conditions_match(
    rule.value->'conditions', v_request.intake_answers, null, v_project_context
  )
  order by app_private.workflow_rule_priority(rule.value->>'priority'), rule.ordinality
  limit 1;
  if v_rule is null then
    v_receipt := v_receipt || jsonb_build_object('reason', 'no_matching_rule');
    update public.customer_requests set auto_route_receipt = v_receipt where id = v_request.id returning * into v_request;
    return to_jsonb(v_request);
  end if;

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

  select * into v_owner from public.organizations
  where upper(code) = upper(trim(v_destination->>'leadOrgCode')) and active;
  if not found or not (
    v_project.lead_organization_id = v_owner.id
    or exists (
      select 1 from public.project_participants participant
      where participant.project_id = v_project.id
        and participant.organization_id = v_owner.id
        and participant.is_active
        and (participant.expires_at is null or participant.expires_at > v_now)
        and (participant.starts_on is null or participant.starts_on <= current_date)
        and (participant.ends_on is null or participant.ends_on >= current_date)
    )
  ) then raise exception 'automatic route owner is not an active project participant'; end if;

  begin
    v_group.id := (v_destination->>'assignmentGroupId')::uuid;
  exception when invalid_text_representation then
    raise exception 'automatic route team id is invalid';
  end;
  select * into v_group from public.assignment_groups
  where id = v_group.id and active and upper(org_code) = upper(v_owner.code);
  if not found then raise exception 'automatic route assignment group is missing or inactive'; end if;

  v_assigned_user_id := null;
  if nullif(trim(v_destination->>'assignedToUserId'), '') is not null then
    begin
      v_assigned_user_id := (v_destination->>'assignedToUserId')::uuid;
    exception when invalid_text_representation then
      raise exception 'automatic route assignee id is invalid';
    end;
    if not exists (
      select 1 from public.assignment_group_memberships membership
      join auth.users member_user on member_user.id = membership.user_id
      where membership.assignment_group_id = v_group.id
        and membership.user_id = v_assigned_user_id
    ) then raise exception 'automatic route assignee is not a member of its team'; end if;
  end if;

  select * into v_stage from public.workflow_version_stages
  where workflow_version_id = v_target_version.id order by sequence_order limit 1;
  if not found then raise exception 'automatic route target workflow has no stages'; end if;

  if nullif(v_destination->>'targetDate', '') is not null then
    begin
      v_target_date := (v_destination->>'targetDate')::date;
    exception when others then raise exception 'automatic route target date is invalid';
    end;
  else
    v_target_date := coalesce(v_request.desired_date, current_date + greatest(v_stage.target_duration_days, 1));
  end if;
  v_code := 'REQ-' || upper(regexp_replace(v_request.confirmation_number, '[^A-Z0-9]+', '-', 'g'))
    || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_workstream_id := 'ws-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.workstreams (
    id, project_id, code, title, category, permit_type_id, workflow_version_id,
    current_stage_id, current_stage_name, operational_state, operational_state_label,
    rag_status, rag_label, baseline_target_date, forecast_target_date,
    current_stage_started_at, state_concierge, regulatory_lead, six_questions,
    customer_request_id, assignment_group_id, assigned_to_user_id, assigned_org_code,
    assigned_owner_org_code, itsm_state, created_at, updated_at
  ) values (
    v_workstream_id, v_project.id, v_code, v_request.title, v_request.request_type,
    coalesce(nullif(v_destination->>'permitTypeId', ''), v_request.known_permit_type_id),
    v_target_version.id, v_stage.id, v_stage.label, 'running', 'Running (' || v_stage.label || ')',
    'green', 'On Track', v_target_date, v_target_date, v_now,
    jsonb_build_object('name', 'State Project Concierge', 'title', 'Project Manager', 'agency', v_group.name),
    jsonb_build_object('orgCode', v_owner.code, 'orgName', coalesce(nullif(v_destination->>'leadOrgName', ''), v_owner.name)),
    jsonb_build_object('intakeWorkflowVersionId', v_source_version.id, 'intakeAnswers', v_request.intake_answers),
    v_request.id, v_group.id, v_assigned_user_id, v_group.org_code, v_group.org_code, 'in_progress', v_now, v_now
  ) returning * into v_workstream;

  insert into public.tasks (
    id, workstream_id, task_code, title, stage_id, is_stage_action, duration_days,
    early_start, early_finish, late_start, late_finish, is_critical_path, status,
    predecessors, assignment_group_id, assigned_to_user_id, assigned_org_code, itsm_state
  ) values (
    'task-' || replace(gen_random_uuid()::text, '-', ''), v_workstream.id,
    v_group.org_code || '-INTAKE-' || v_code, 'Complete ' || v_stage.label || ' — ' || v_request.title,
    v_stage.id, false, greatest(v_stage.target_duration_days, 1), current_date,
    v_target_date, current_date, v_target_date, true, 'in_progress', '[]'::jsonb,
    v_group.id, v_assigned_user_id, v_group.org_code, 'in_progress'
  );
  perform app_private.ensure_stage_action(v_workstream.id);

  select template.value into v_template
  from jsonb_array_elements(v_source_version.notice_templates) as template(value)
  where template.value->>'trigger' = 'request_routed'
  limit 1;
  v_notice_values := jsonb_build_object(
    'requestTitle', v_request.title,
    'confirmationNumber', v_request.confirmation_number,
    'teamName', v_group.name,
    'targetDate', v_target_date::text,
    'workstreamCode', v_workstream.code,
    'projectNumber', v_project.number
  );
  v_title := app_private.render_workflow_notice(coalesce(v_template->>'title', 'Request routed to ' || v_group.name), v_notice_values);
  v_body := app_private.render_workflow_notice(coalesce(v_template->>'body', v_request.confirmation_number || ' was routed to ' || v_group.name || '.'), v_notice_values);
  v_audience := coalesce(v_template->>'audience', 'both');

  if v_audience in ('team', 'both') then
  for v_user_id in
    select distinct membership.user_id from public.assignment_group_memberships membership
    where membership.assignment_group_id = v_group.id
      and (v_assigned_user_id is null or membership.user_id = v_assigned_user_id)
  loop
    insert into public.notifications (
      recipient_id, recipient_user_id, user_id, title, message, body,
      event_type, type, link_url, urgency, metadata, channel,
      delivery_status, is_read, dedupe_key, created_at
    ) values (
      v_user_id, v_user_id, v_user_id::text, v_title, v_body, v_body,
      'customer_request_routed', 'assignment', '/work/workflow/' || v_workstream.id,
      case when v_request.blocks_active_work then 'high' else 'normal' end,
      jsonb_build_object('requestId', v_request.id, 'workstreamId', v_workstream.id, 'assignmentGroupId', v_group.id, 'targetDate', v_target_date),
      'in_app', 'pending', false,
      'customer-request-routed:' || v_request.id || ':' || v_workstream.id || ':' || v_user_id::text,
      v_now
    ) on conflict (dedupe_key) do nothing;
  end loop;
  end if;

  if v_request.submitted_by_user_id is not null and v_audience in ('customer', 'both') then
    insert into public.notifications (
      recipient_id, recipient_user_id, user_id, title, message, body,
      event_type, type, link_url, urgency, metadata, channel,
      delivery_status, is_read, dedupe_key, created_at
    ) values (
      v_request.submitted_by_user_id, v_request.submitted_by_user_id, v_request.submitted_by_user_id::text,
      v_title, v_body, v_body, 'customer_request_routed', 'status_update',
      '/requests/' || v_request.confirmation_number, 'normal',
      jsonb_build_object('requestId', v_request.id, 'workstreamId', v_workstream.id, 'workstreamCode', v_workstream.code),
      'in_app', 'pending', false, 'customer-request-routed-customer:' || v_request.id, v_now
    ) on conflict (dedupe_key) do nothing;
  end if;

  v_receipt := jsonb_build_object(
    'status', 'routed', 'workflowVersionId', v_source_version.id, 'ruleId', v_rule->>'id',
    'workstreamId', v_workstream.id, 'workstreamCode', v_workstream.code,
    'leadOrgCode', v_owner.code, 'leadOrgName', coalesce(nullif(v_destination->>'leadOrgName', ''), v_owner.name),
    'assignmentGroupId', v_group.id, 'targetDate', v_target_date
  );
  update public.customer_requests set
    status = 'in_progress', itsm_state = 'in_progress',
    related_workstream_id = v_workstream.id, assignment_group_id = v_group.id,
    assigned_to_user_id = v_assigned_user_id, triaged_at = v_now,
    triaged_by_user_id = auth.uid(), triage_notes = 'Automatically routed by the published workflow.',
    triaged_workstream_ids = jsonb_build_array(v_workstream.id),
    auto_routed_workflow_version_id = v_source_version.id,
    auto_routed_rule_id = v_rule->>'id', auto_route_receipt = v_receipt, updated_at = v_now
  where id = v_request.id returning * into v_request;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason, project_id, created_at
  ) values (
    auth.uid(), 'customer_request_auto_routed', 'customer_request', 'customer_request',
    v_request.id, v_request.submitted_by_name, v_owner.name, 'customer_request_auto_routed',
    'manual', jsonb_build_object('ruleId', v_rule->>'id', 'workstreamId', v_workstream.id,
      'workstreamCode', v_workstream.code, 'workflowVersionId', v_target_version.id)::text,
    'Matched published workflow rule ' || coalesce(v_rule->>'name', v_rule->>'id'), v_project.id, v_now
  );
  return to_jsonb(v_request);
end;
$$;
revoke all on function app_private.auto_route_customer_request(text) from public, anon, authenticated;

-- Remove the pre-automation signature before creating its replacement. This
-- prevents PostgREST from seeing two functions with overlapping defaults.
drop function public.rpc_create_customer_request(
  text, text, text, text, text, text, text, text, date, text, text, text,
  uuid, text, text, boolean, text, jsonb
);

create function public.rpc_create_customer_request(
  p_id text,
  p_confirmation_number text,
  p_project_id text,
  p_request_type text,
  p_title text,
  p_description text,
  p_requested_outcome text default null,
  p_location_or_affected_area text default null,
  p_desired_date date default null,
  p_schedule_importance text default 'normal',
  p_known_agency_code text default null,
  p_known_permit_type_id text default null,
  p_submitted_by_user_id uuid default null,
  p_submitted_by_name text default 'SpaceX Representative',
  p_related_workstream_id text default null,
  p_blocks_active_work boolean default false,
  p_status text default 'submitted',
  p_attachment_document_version_ids jsonb default '[]'::jsonb,
  p_intake_workflow_version_id text default null,
  p_intake_answers jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_project public.projects%rowtype;
  v_project_ref text;
  v_request public.customer_requests%rowtype;
  v_existing public.customer_requests%rowtype;
  v_version_id text;
  v_project_context jsonb;
begin
  if v_actor_id is null then raise exception 'authentication is required to create a customer request'; end if;
  if p_status not in ('draft', 'submitted') then raise exception 'invalid customer request status: %', p_status; end if;
  if coalesce(jsonb_typeof(p_intake_answers), 'object') <> 'object' then raise exception 'intake answers must be a JSON object'; end if;

  select * into v_project from public.projects p
  where p.id::text = p_project_id or p.number = p_project_id limit 1;
  if not found then raise exception 'project not found: %', p_project_id; end if;
  v_project_ref := v_project.id::text;
  if not app_private.has_project_access(v_project.id) then
    raise exception 'authenticated user cannot access project %', p_project_id;
  end if;

  v_actor_name := coalesce(
    (select nullif(trim(profile.full_name), '') from public.profiles profile where profile.id = v_actor_id),
    (select nullif(trim(user_profile.full_name), '') from public.user_profiles user_profile where user_profile.user_id = v_actor_id),
    nullif(auth.jwt() ->> 'email', ''), 'Authenticated user'
  );

  -- The client-generated ID is the whole-operation idempotency key. Replays
  -- return the original workflow choice, answers, route, and receipt.
  select * into v_existing from public.customer_requests where id = p_id;
  if found then
    if v_existing.submitted_by_user_id is distinct from v_actor_id
       or v_existing.confirmation_number is distinct from p_confirmation_number
       or v_existing.project_id is distinct from v_project_ref
       or v_existing.title is distinct from p_title
       or v_existing.description is distinct from p_description
       or v_existing.intake_answers is distinct from coalesce(p_intake_answers, '{}'::jsonb)
       or (nullif(trim(p_intake_workflow_version_id), '') is not null
           and v_existing.intake_workflow_version_id is distinct from trim(p_intake_workflow_version_id)) then
      raise exception 'customer request id is already in use: %', p_id;
    end if;
    return to_jsonb(v_existing);
  end if;

  if coalesce(jsonb_typeof(p_attachment_document_version_ids), 'array') <> 'array' then
    raise exception 'attachment_document_version_ids must be a JSON array';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(coalesce(p_attachment_document_version_ids, '[]'::jsonb)) attachment(id)
    where not exists (
      select 1 from public.document_versions version
      join public.documents document on document.id = version.document_id
      where version.id = attachment.id and document.project_id = v_project.id
    )
  ) then raise exception 'customer request attachments must belong to the selected project'; end if;

  v_version_id := app_private.resolve_intake_workflow_version(
    v_project.id, p_known_permit_type_id, p_request_type, p_intake_workflow_version_id
  );
  v_project_context := jsonb_build_object(
    'projectId', v_project.id::text, 'projectNumber', v_project.number,
    'projectType', v_project.project_type,
    'customerOrganizationId', v_project.customer_organization_id::text,
    'leadOrganizationId', v_project.lead_organization_id::text
  );
  if p_status = 'submitted' then
    perform app_private.assert_intake_answers(v_version_id, coalesce(p_intake_answers, '{}'::jsonb), v_project_context);
  elsif v_version_id is null and coalesce(p_intake_answers, '{}'::jsonb) <> '{}'::jsonb then
    raise exception 'draft intake answers require a published workflow version';
  end if;

  insert into public.customer_requests (
    id, confirmation_number, project_id, request_type, title, description,
    requested_outcome, location_or_affected_area, desired_date, schedule_importance,
    known_agency_code, known_permit_type_id, submitted_by_user_id, submitted_by_name,
    related_workstream_id, blocks_active_work, status, attachment_document_version_ids,
    intake_workflow_version_id, intake_answers, auto_route_receipt, created_at, updated_at
  ) values (
    p_id, p_confirmation_number, v_project_ref, p_request_type, p_title, p_description,
    p_requested_outcome, p_location_or_affected_area, p_desired_date, p_schedule_importance,
    p_known_agency_code, p_known_permit_type_id, v_actor_id, v_actor_name,
    p_related_workstream_id, p_blocks_active_work, p_status, coalesce(p_attachment_document_version_ids, '[]'::jsonb),
    v_version_id, coalesce(p_intake_answers, '{}'::jsonb),
    jsonb_build_object('status', 'manual', 'workflowVersionId', v_version_id), v_now, v_now
  ) returning * into v_request;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, new_value, reason, project_id, created_at
  ) values (
    v_actor_id, 'customer_request_submitted', 'customer_request', 'customer_request',
    p_confirmation_number, v_actor_name, 'Space Exploration Technologies Corp. (SpaceX)',
    'customer_request_submitted', p_request_type || ' · ' || p_title, p_description, v_project_ref, v_now
  );

  if p_status <> 'draft' then
    insert into public.notifications (
      user_id, event_type, title, message, body, channel, delivery_status,
      link_url, urgency, metadata, created_at
    ) values (
      'sarah.johnson@la.gov', 'action_required', 'New customer request ' || p_confirmation_number,
      p_title, p_description, 'in_app', 'pending', '/requests/' || p_confirmation_number,
      case when p_blocks_active_work then 'critical' else 'high' end,
      jsonb_build_object('confirmationNumber', p_confirmation_number, 'requestType', p_request_type), v_now
    );
    select * into v_request from jsonb_populate_record(null::public.customer_requests,
      app_private.auto_route_customer_request(v_request.id));
  end if;

  return to_jsonb(v_request);
end;
$$;
revoke all on function public.rpc_create_customer_request(
  text, text, text, text, text, text, text, text, date, text, text, text,
  uuid, text, text, boolean, text, jsonb, text, jsonb
) from public, anon;
grant execute on function public.rpc_create_customer_request(
  text, text, text, text, text, text, text, text, date, text, text, text,
  uuid, text, text, boolean, text, jsonb, text, jsonb
) to authenticated;

-- Keep the attachment and request in the same transaction and pass the exact
-- same intake choice through both the new-request and idempotent-replay paths.
create or replace function public.rpc_create_customer_request_with_document(p_request jsonb, p_document jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_document_id uuid;
  v_version_id text;
  v_storage_path text;
  v_request jsonb;
begin
  if v_actor_id is null then raise exception 'authentication is required to create a customer request'; end if;
  if jsonb_typeof(p_request) <> 'object' or jsonb_typeof(p_document) <> 'object' then
    raise exception 'request and document payloads must be JSON objects';
  end if;

  if nullif(trim(p_request->>'id'), '') is not null
     and exists (select 1 from public.customer_requests where id = p_request->>'id') then
    return public.rpc_create_customer_request(
      p_id => p_request->>'id', p_confirmation_number => p_request->>'confirmationNumber',
      p_project_id => p_request->>'projectId', p_request_type => p_request->>'requestType',
      p_title => p_request->>'title', p_description => p_request->>'description',
      p_requested_outcome => p_request->>'requestedOutcome',
      p_location_or_affected_area => p_request->>'locationOrAffectedArea',
      p_desired_date => nullif(p_request->>'desiredDate', '')::date,
      p_schedule_importance => coalesce(nullif(p_request->>'scheduleImportance', ''), 'normal'),
      p_known_agency_code => p_request->>'knownAgencyCode',
      p_known_permit_type_id => p_request->>'knownPermitTypeId',
      p_submitted_by_user_id => v_actor_id, p_submitted_by_name => p_request->>'submittedByName',
      p_related_workstream_id => p_request->>'relatedWorkstreamId',
      p_blocks_active_work => coalesce((p_request->>'blocksActiveWork')::boolean, false),
      p_status => coalesce(nullif(p_request->>'status', ''), 'submitted'),
      p_attachment_document_version_ids => '[]'::jsonb,
      p_intake_workflow_version_id => p_request->>'intakeWorkflowVersionId',
      p_intake_answers => coalesce(p_request->'intakeAnswers', '{}'::jsonb)
    );
  end if;

  begin v_document_id := (p_document->>'documentId')::uuid;
  exception when invalid_text_representation then raise exception 'documentId must be a UUID'; end;
  v_storage_path := p_document->>'storagePath';
  if v_storage_path is null or left(v_storage_path, length(v_document_id::text || '/v1/')) <> v_document_id::text || '/v1/' then
    raise exception 'document storage path does not match the document and version';
  end if;
  if coalesce((p_document->>'sha256Hash') !~ '^[0-9a-fA-F]{64}$', true) then raise exception 'document SHA-256 hash is invalid'; end if;
  if coalesce((p_document->>'fileSizeBytes')::bigint, -1) < 0 then raise exception 'document file size is invalid'; end if;

  select * into v_project from public.projects project
  where project.id::text = p_request->>'projectId' or project.number = p_request->>'projectId' limit 1;
  if not found then raise exception 'project not found: %', p_request->>'projectId'; end if;
  if not app_private.has_project_access(v_project.id) then raise exception 'authenticated user cannot access project %', p_request->>'projectId'; end if;

  v_version_id := coalesce(nullif(p_document->>'versionId', ''), 'doc-v-' || replace(v_document_id::text, '-', ''));
  insert into public.documents (
    id, project_id, owner_organization_id, storage_path, document_type,
    visibility, version, scan_status, retention_category, created_by
  ) values (
    v_document_id, v_project.id, v_project.lead_organization_id, v_storage_path,
    coalesce(nullif(p_document->>'documentType', ''), 'customer_attachment'),
    'customer', 1, 'pending', 'project_delivery', v_actor_id
  );
  insert into public.document_versions (
    id, document_id, document_ref_id, version_number, version_label,
    storage_path, storage_uri, file_name, mime_type, file_size_bytes,
    sha256_hash, uploaded_at, uploaded_by_name, uploaded_by_org_name,
    change_notes, status, project_id, created_at
  ) values (
    v_version_id, v_document_id, v_document_id::text, 1,
    coalesce(nullif(p_document->>'versionLabel', ''), 'v1.0'),
    v_storage_path, v_storage_path, p_document->>'fileName',
    coalesce(nullif(p_document->>'mimeType', ''), 'application/octet-stream'),
    (p_document->>'fileSizeBytes')::bigint, lower(p_document->>'sha256Hash'), now(),
    coalesce(nullif(p_document->>'uploadedByName', ''), 'Authenticated user'),
    coalesce(nullif(p_document->>'uploadedByOrgName', ''), 'Customer'),
    coalesce(p_document->>'changeNotes', ''), 'under_review', v_project.id, now()
  );
  v_request := public.rpc_create_customer_request(
    p_id => p_request->>'id', p_confirmation_number => p_request->>'confirmationNumber',
    p_project_id => v_project.id::text, p_request_type => p_request->>'requestType',
    p_title => p_request->>'title', p_description => p_request->>'description',
    p_requested_outcome => p_request->>'requestedOutcome',
    p_location_or_affected_area => p_request->>'locationOrAffectedArea',
    p_desired_date => nullif(p_request->>'desiredDate', '')::date,
    p_schedule_importance => coalesce(nullif(p_request->>'scheduleImportance', ''), 'normal'),
    p_known_agency_code => p_request->>'knownAgencyCode', p_known_permit_type_id => p_request->>'knownPermitTypeId',
    p_submitted_by_user_id => v_actor_id, p_submitted_by_name => p_request->>'submittedByName',
    p_related_workstream_id => p_request->>'relatedWorkstreamId',
    p_blocks_active_work => coalesce((p_request->>'blocksActiveWork')::boolean, false),
    p_status => coalesce(nullif(p_request->>'status', ''), 'submitted'),
    p_attachment_document_version_ids => jsonb_build_array(v_version_id),
    p_intake_workflow_version_id => p_request->>'intakeWorkflowVersionId',
    p_intake_answers => coalesce(p_request->'intakeAnswers', '{}'::jsonb)
  );
  return v_request;
end;
$$;
revoke all on function public.rpc_create_customer_request_with_document(jsonb, jsonb) from public, anon;
grant execute on function public.rpc_create_customer_request_with_document(jsonb, jsonb) to authenticated;


-- Pin outcome-aware branching and notification behavior to the workstream version.
create function app_private.complete_workstream_stage(
  p_workstream_id text,
  p_completed_checklists text[] default '{}',
  p_provided_document_categories text[] default '{}',
  p_actor_name text default 'PATH user',
  p_completion_notes text default null,
  p_review_outcome text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
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
  v_next_assignment_group_id uuid;
  v_notice_assignment_group_id uuid;
  v_automation_version public.workflow_versions%rowtype;
  v_customer_request public.customer_requests%rowtype;
  v_branch jsonb;
  v_intake_answers jsonb := '{}'::jsonb;
  v_project_context jsonb := '{}'::jsonb;
  v_notice_template jsonb;
  v_notice_values jsonb;
  v_notice_title text;
  v_notice_body text;
  v_notice_trigger text;
  v_notice_audience text;
  v_notice_configured boolean := false;
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
  if p_review_outcome is not null and length(p_review_outcome) > 1000 then
    raise exception 'review outcome must be 1000 characters or fewer';
  end if;
  if v_workstream.workflow_version_id is not null then
    select * into v_automation_version from public.workflow_versions where id = v_workstream.workflow_version_id;
  end if;
  if v_workstream.customer_request_id is not null then
    select * into v_customer_request from public.customer_requests where id = v_workstream.customer_request_id;
    v_intake_answers := coalesce(v_customer_request.intake_answers, '{}'::jsonb);
  end if;
  select jsonb_build_object(
    'projectId', project.id::text, 'projectNumber', project.number,
    'projectType', project.project_type,
    'customerOrganizationId', project.customer_organization_id::text,
    'leadOrganizationId', project.lead_organization_id::text
  ) into v_project_context
  from public.projects project where project.id = v_workstream.project_id;
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
    end if;

    select branch.value into v_branch
    from jsonb_array_elements(coalesce(v_automation_version.stage_branches, '[]'::jsonb)) with ordinality branch(value, ordinality)
    where branch.value->>'fromStageKey' = v_current_key
      and app_private.workflow_conditions_match(
        branch.value->'conditions', v_intake_answers, p_review_outcome, v_project_context
      )
    order by app_private.workflow_rule_priority(branch.value->>'priority'), branch.ordinality
    limit 1;
    if v_branch is not null then
      select * into v_next_version_stage
      from public.workflow_version_stages
      where workflow_version_id = v_workstream.workflow_version_id
        and stage_key = v_branch->>'toStageKey'
      limit 1;
      if not found then raise exception 'configured workflow branch target is missing'; end if;
      v_has_next_stage := true;
      v_next_key := v_next_version_stage.stage_key;
      v_next_label := v_next_version_stage.label;
      v_next_stage_id := v_next_version_stage.id;
      v_next_org_code := v_next_version_stage.responsible_org_code;
      if not exists(select 1 from public.organizations where code=v_next_org_code and active) then
        raise exception 'The next stage needs a valid owner organization in Workflow Designer';
      end if;
    end if;

    if v_has_next_stage
       and jsonb_array_length(coalesce(v_version_stage.permitted_transitions, '[]'::jsonb)) > 0
       and not exists (
         select 1 from jsonb_array_elements_text(v_version_stage.permitted_transitions) allowed(value)
         where lower(value) in (lower(v_next_key), lower(v_next_label))
       ) then
      raise exception 'configured workflow transition is not permitted: % -> %', v_current_key, v_next_key;
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
    completed_by, completion_notes, review_outcome
  ) values (
    v_workstream.id, v_workstream.workflow_version_id,
    nullif(coalesce(v_workstream.current_stage_id, case when v_has_version_stage then v_version_stage.id else v_legacy_stage.id::text end), ''),
    coalesce(v_current_key, 'current'), 'completed', v_now,
    to_jsonb(coalesce(p_completed_checklists, '{}'::text[])),
    to_jsonb(coalesce(p_provided_document_categories, '{}'::text[])), auth.uid(), p_completion_notes, p_review_outcome
  ) returning id into v_run_id;

  if v_has_next_stage then
    v_next_assignment_group_id := app_private.resolve_stage_assignment_group(
      v_next_org_code, v_next_version_stage.default_assignment_group_id
    );
  end if;
  v_notice_assignment_group_id := coalesce(v_next_assignment_group_id, v_workstream.assignment_group_id);

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
      assignment_group_id = case when v_has_next_stage then v_next_assignment_group_id else assignment_group_id end,
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

  v_notice_trigger := 'stage_completed';
  select template.value into v_notice_template
  from jsonb_array_elements(coalesce(v_automation_version.notice_templates, '[]'::jsonb)) as template(value)
  where template.value->>'trigger' = v_notice_trigger
  limit 1;
  v_notice_configured := v_notice_template is not null;
  v_notice_audience := coalesce(v_notice_template->>'audience', 'both');
  v_notice_values := jsonb_build_object(
    'requestTitle', coalesce(v_customer_request.title, v_workstream.title),
    'confirmationNumber', v_customer_request.confirmation_number,
    'teamName', coalesce(v_next_org_code, v_version_stage.responsible_org_code, v_workstream.assigned_org_code),
    'targetDate', coalesce(v_workstream.forecast_target_date::text, ''),
    'workstreamCode', v_workstream.code,
    'stageName', v_current_label,
    'nextStageName', coalesce(v_next_label, 'Complete & Ready for Final Determination'),
    'reviewOutcome', coalesce(p_review_outcome, '')
  );
  v_notice_title := app_private.render_workflow_notice(
    coalesce(v_notice_template->>'title', v_workstream.code || ' is ready for your agency'), v_notice_values
  );
  v_notice_body := app_private.render_workflow_notice(
    coalesce(v_notice_template->>'body', 'The next workflow stage is ' || coalesce(v_next_label, 'complete') || '.'), v_notice_values
  );
  if (v_has_next_stage and not v_notice_configured)
     or (v_notice_configured and v_notice_audience in ('team', 'both')) then
    for v_recipient in
      select eligible.user_id
      from (
        select membership.user_id
        from public.assignment_group_memberships membership
        where v_notice_configured
          and v_notice_audience in ('team', 'both')
          and membership.assignment_group_id = v_notice_assignment_group_id
        union
        select membership.user_id
        from public.organization_memberships membership
        join public.organizations organization on organization.id = membership.organization_id
        where not v_notice_configured
          and v_has_next_stage
          and organization.code = coalesce(v_next_org_code, v_version_stage.responsible_org_code, v_workstream.assigned_org_code)
          and organization.active and membership.status = 'active'
          and membership.role in ('supervisor', 'organization_admin', 'system_admin')
      ) eligible
    loop
      insert into public.notifications (
        recipient_id, event_type, title, body, channel, delivery_status, dedupe_key, created_at
      ) values (
        v_recipient, 'workflow_handoff', v_notice_title,
        v_notice_body, 'in_app', 'pending',
        v_run_id::text || ':' || v_recipient::text, v_now
      ) on conflict (dedupe_key) do nothing;
    end loop;
  end if;

  if v_customer_request.submitted_by_user_id is not null then
    v_notice_values := jsonb_build_object(
      'requestTitle', coalesce(v_customer_request.title, v_workstream.title),
      'confirmationNumber', v_customer_request.confirmation_number,
      'teamName', coalesce(v_next_org_code, v_workstream.assigned_org_code),
      'targetDate', coalesce(v_workstream.forecast_target_date::text, ''),
      'workstreamCode', v_workstream.code,
      'stageName', v_current_label,
      'nextStageName', coalesce(v_next_label, 'Complete & Ready for Final Determination'),
      'reviewOutcome', coalesce(p_review_outcome, '')
    );
    select template.value into v_notice_template
    from jsonb_array_elements(coalesce(v_automation_version.notice_templates, '[]'::jsonb)) as template(value)
    where template.value->>'trigger' = 'stage_completed'
      and coalesce(template.value->>'audience', 'both') in ('customer', 'both')
    limit 1;
    if v_notice_template is not null then
      v_notice_title := app_private.render_workflow_notice(v_notice_template->>'title', v_notice_values);
      v_notice_body := app_private.render_workflow_notice(v_notice_template->>'body', v_notice_values);
      insert into public.notifications (
        recipient_id, recipient_user_id, user_id, title, message, body,
        event_type, type, link_url, urgency, metadata, channel,
        delivery_status, is_read, dedupe_key, created_at
      ) values (
        v_customer_request.submitted_by_user_id, v_customer_request.submitted_by_user_id,
        v_customer_request.submitted_by_user_id::text, v_notice_title, v_notice_body, v_notice_body,
        'workflow_stage_completed', 'status_update', '/requests/' || v_customer_request.confirmation_number,
        'normal', jsonb_build_object('requestId', v_customer_request.id, 'workstreamId', v_workstream.id, 'stageRunId', v_run_id),
        'in_app', 'pending', false, 'workflow-stage-customer:' || v_run_id::text, v_now
      ) on conflict (dedupe_key) do nothing;
    end if;

    if p_review_outcome is not null then
      select template.value into v_notice_template
      from jsonb_array_elements(coalesce(v_automation_version.notice_templates, '[]'::jsonb)) as template(value)
      where template.value->>'trigger' = 'review_outcome'
        and coalesce(template.value->>'audience', 'both') in ('customer', 'both')
      limit 1;
      if v_notice_template is not null then
        v_notice_title := app_private.render_workflow_notice(v_notice_template->>'title', v_notice_values);
        v_notice_body := app_private.render_workflow_notice(v_notice_template->>'body', v_notice_values);
        insert into public.notifications (
          recipient_id, recipient_user_id, user_id, title, message, body,
          event_type, type, link_url, urgency, metadata, channel,
          delivery_status, is_read, dedupe_key, created_at
        ) values (
          v_customer_request.submitted_by_user_id, v_customer_request.submitted_by_user_id,
          v_customer_request.submitted_by_user_id::text, v_notice_title, v_notice_body, v_notice_body,
          'workflow_review_outcome', 'status_update', '/requests/' || v_customer_request.confirmation_number,
          'normal', jsonb_build_object('requestId', v_customer_request.id, 'workstreamId', v_workstream.id, 'stageRunId', v_run_id, 'reviewOutcome', p_review_outcome),
          'in_app', 'pending', false, 'workflow-review-customer:' || v_run_id::text, v_now
        ) on conflict (dedupe_key) do nothing;
      end if;
    end if;
  end if;

  if p_review_outcome is not null then
    select template.value into v_notice_template
    from jsonb_array_elements(coalesce(v_automation_version.notice_templates, '[]'::jsonb)) as template(value)
    where template.value->>'trigger' = 'review_outcome'
      and coalesce(template.value->>'audience', 'both') in ('team', 'both')
    limit 1;
    if v_notice_template is not null then
      v_notice_values := jsonb_build_object(
        'requestTitle', coalesce(v_customer_request.title, v_workstream.title),
        'confirmationNumber', v_customer_request.confirmation_number,
        'teamName', coalesce(v_next_org_code, v_version_stage.responsible_org_code, v_workstream.assigned_org_code),
        'targetDate', coalesce(v_workstream.forecast_target_date::text, ''),
        'workstreamCode', v_workstream.code,
        'stageName', v_current_label,
        'nextStageName', coalesce(v_next_label, 'Complete & Ready for Final Determination'),
        'reviewOutcome', p_review_outcome
      );
      v_notice_title := app_private.render_workflow_notice(v_notice_template->>'title', v_notice_values);
      v_notice_body := app_private.render_workflow_notice(v_notice_template->>'body', v_notice_values);
      for v_recipient in
        select distinct membership.user_id
        from public.assignment_group_memberships membership
        where membership.assignment_group_id = v_notice_assignment_group_id
      loop
        insert into public.notifications (
          recipient_id, event_type, title, body, channel, delivery_status, dedupe_key, created_at
        ) values (
          v_recipient, 'workflow_review_outcome', v_notice_title, v_notice_body,
          'in_app', 'pending', v_run_id::text || ':review:' || v_recipient::text, v_now
        ) on conflict (dedupe_key) do nothing;
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'workstreamId', v_workstream.id, 'stageRunId', v_run_id,
    'nextStageName', case when v_has_next_stage then v_next_label else 'Complete & Ready for Final Determination' end,
    'operationalState', case when v_has_next_stage then 'running' else 'complete' end
  );
end;
$$;


create or replace function app_private.complete_workstream_stage(
  p_workstream_id text,
  p_completed_checklists text[] default '{}',
  p_provided_document_categories text[] default '{}',
  p_actor_name text default 'PATH user',
  p_completion_notes text default null
)
returns jsonb language sql security definer set search_path = '' as $$
  select app_private.complete_workstream_stage(
    p_workstream_id, p_completed_checklists, p_provided_document_categories,
    p_actor_name, p_completion_notes, null::text
  );
$$;
revoke all on function app_private.complete_workstream_stage(text,text[],text[],text,text) from public, anon, authenticated;
revoke all on function app_private.complete_workstream_stage(text,text[],text[],text,text,text) from public, anon, authenticated;

drop function public.rpc_complete_workstream_stage(text,text[],text[],text,text);
create function public.rpc_complete_workstream_stage(
  p_workstream_id text,
  p_completed_checklists text[] default '{}',
  p_provided_document_categories text[] default '{}',
  p_actor_name text default 'PATH user',
  p_completion_notes text default null,
  p_review_outcome text default null
)
returns jsonb language sql security definer set search_path = '' as $$
  select app_private.complete_workstream_stage(
    p_workstream_id, p_completed_checklists, p_provided_document_categories,
    p_actor_name, p_completion_notes, p_review_outcome
  );
$$;
revoke all on function public.rpc_complete_workstream_stage(text,text[],text[],text,text,text) from public, anon;
grant execute on function public.rpc_complete_workstream_stage(text,text[],text[],text,text,text) to authenticated;
