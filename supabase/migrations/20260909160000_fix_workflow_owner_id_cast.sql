-- Type-correct the owner normalization introduced by the preceding workflow
-- validation repair. The legacy stage contract stores responsible_org_id as
-- text even though organizations.id is uuid.

create or replace function public.rpc_create_workflow_draft(
  p_source_version_id text,
  p_change_summary text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_source public.workflow_versions%rowtype;
  v_draft_id text := 'workflow-version-' || replace(gen_random_uuid()::text, '-', '');
  v_now timestamptz := now();
  v_next_number integer;
  v_organization_id uuid;
begin
  select * into v_source from public.workflow_versions where id = p_source_version_id;
  if not found then raise exception 'workflow version not found: %', p_source_version_id; end if;

  select organization_id into v_organization_id
  from public.workflow_definitions where id = v_source.workflow_id;
  perform app_private.require_workflow_admin(v_organization_id);

  select coalesce(max(version_number), 0) + 1 into v_next_number
  from public.workflow_versions where workflow_id = v_source.workflow_id;

  insert into public.workflow_versions (
    id, workflow_id, version_number, version_label, change_summary,
    is_active, effective_date, lifecycle_status, created_at
  ) values (
    v_draft_id, v_source.workflow_id, v_next_number, 'v' || v_next_number::text,
    coalesce(nullif(trim(p_change_summary), ''), 'Draft workflow revision'),
    false, current_date, 'draft', v_now
  );

  if exists (select 1 from public.workflow_version_stages where workflow_version_id = p_source_version_id) then
    insert into public.workflow_version_stages (
      id, workflow_version_id, stage_key, sequence_order, label,
      internal_description, customer_visibility_label, responsible_org_id,
      responsible_org_code, responsible_unit_name, target_duration_days,
      minimum_statutory_days, required_inputs, completion_requirements,
      permitted_transitions, can_run_in_parallel, is_milestone_gate,
      external_filing_url, legal_authority_citation, default_assignment_group_id,
      default_assignee_id, rfi_behavior, hold_behavior, dependencies, tasks
    )
    select
      v_draft_id || '-' || s.stage_key, v_draft_id, s.stage_key, s.sequence_order,
      s.label, s.internal_description, s.customer_visibility_label,
      case when owner.normalized_code = s.responsible_org_code
        then s.responsible_org_id else owner.organization_id::text end,
      owner.normalized_code, s.responsible_unit_name, s.target_duration_days,
      s.minimum_statutory_days, s.required_inputs, s.completion_requirements,
      s.permitted_transitions, s.can_run_in_parallel, s.is_milestone_gate,
      s.external_filing_url, s.legal_authority_citation, s.default_assignment_group_id,
      s.default_assignee_id, s.rfi_behavior, s.hold_behavior, s.dependencies, s.tasks
    from public.workflow_version_stages s
    cross join lateral (
      select
        case when exists (
          select 1 from public.organizations o
          where o.code = s.responsible_org_code and o.active
        ) then s.responsible_org_code else 'STATEPO' end as normalized_code,
        (select o.id from public.organizations o
         where o.code = case when exists (
           select 1 from public.organizations active_owner
           where active_owner.code = s.responsible_org_code and active_owner.active
         ) then s.responsible_org_code else 'STATEPO' end
         and o.active limit 1) as organization_id
    ) owner
    where s.workflow_version_id = p_source_version_id
    order by s.sequence_order;
  else
    insert into public.workflow_version_stages (
      id, workflow_version_id, stage_key, sequence_order, label,
      customer_visibility_label, responsible_org_code, responsible_org_id,
      target_duration_days, minimum_statutory_days, required_inputs,
      completion_requirements, permitted_transitions, can_run_in_parallel,
      is_milestone_gate
    )
    select
      v_draft_id || '-' || s.stage_key, v_draft_id, s.stage_key, s.sort_order,
      s.label, s.label, owner.normalized_code, owner.organization_id::text,
      coalesce(s.service_target_days, 0), coalesce(s.minimum_processing_days, 0),
      coalesce(s.required_documents, '[]'::jsonb), '[]'::jsonb,
      coalesce(s.allowed_transitions, '[]'::jsonb), false, false
    from public.workflow_stages s
    cross join lateral (
      select
        case when exists (
          select 1 from public.organizations o
          where o.code = s.stage_key and o.active
        ) then s.stage_key else 'STATEPO' end as normalized_code,
        (select o.id from public.organizations o
         where o.code = case when exists (
           select 1 from public.organizations active_owner
           where active_owner.code = s.stage_key and active_owner.active
         ) then s.stage_key else 'STATEPO' end
         and o.active limit 1) as organization_id
    ) owner
    where s.workflow_id = v_source.workflow_id
    order by s.sort_order;
  end if;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    action_type, new_value, reason, created_at
  ) values (
    auth.uid(), 'workflow_draft_created', 'workflow_version', 'workflow_version',
    v_draft_id,
    coalesce((select full_name from public.profiles where id = auth.uid()), 'PATH administrator'),
    'workflow_draft_created', v_draft_id, p_change_summary, v_now
  );

  return jsonb_build_object('id', v_draft_id, 'versionNumber', v_next_number, 'status', 'draft');
end;
$$;

revoke execute on function public.rpc_create_workflow_draft(text, text) from public, anon;
grant execute on function public.rpc_create_workflow_draft(text, text) to authenticated;
