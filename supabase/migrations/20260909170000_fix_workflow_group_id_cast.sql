-- Assignment-group references use text in workflow_version_stages while the
-- canonical assignment_groups primary key is uuid. Keep validation strict
-- without requiring a destructive type rewrite of published workflow data.

create or replace function public.rpc_validate_workflow_draft(p_version_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_errors jsonb := '[]'::jsonb;
  v_owner_errors jsonb := '[]'::jsonb;
  v_group_errors jsonb := '[]'::jsonb;
  v_count integer;
  v_organization_id uuid;
begin
  select d.organization_id into v_organization_id
  from public.workflow_versions v
  join public.workflow_definitions d on d.id = v.workflow_id
  where v.id = p_version_id;
  perform app_private.require_workflow_admin(v_organization_id);

  if not exists (
    select 1 from public.workflow_versions
    where id = p_version_id and lifecycle_status in ('draft', 'validated')
  ) then
    raise exception 'only draft workflow versions can be validated';
  end if;

  select count(*) into v_count
  from public.workflow_version_stages
  where workflow_version_id = p_version_id;
  if v_count = 0 then
    v_errors := v_errors || jsonb_build_array('At least one workflow stage is required');
  end if;

  if exists (
    select 1 from public.workflow_version_stages
    where workflow_version_id = p_version_id
      and (nullif(trim(label), '') is null or nullif(trim(responsible_org_code), '') is null)
  ) then
    v_errors := v_errors || jsonb_build_array('Every stage needs a label and responsible organization');
  end if;

  select coalesce(jsonb_agg(
    format('Stage "%s" references an unknown or inactive owner organization "%s"', label, responsible_org_code)
    order by sequence_order
  ), '[]'::jsonb)
  into v_owner_errors
  from public.workflow_version_stages s
  where s.workflow_version_id = p_version_id
    and not exists (
      select 1 from public.organizations o
      where o.code = s.responsible_org_code and o.active
    );
  v_errors := v_errors || v_owner_errors;

  select coalesce(jsonb_agg(
    format('Stage "%s" references a missing or inactive assignment group', label)
    order by sequence_order
  ), '[]'::jsonb)
  into v_group_errors
  from public.workflow_version_stages s
  where s.workflow_version_id = p_version_id
    and s.default_assignment_group_id is not null
    and not exists (
      select 1 from public.assignment_groups g
      where g.id::text = s.default_assignment_group_id and g.active
    );
  v_errors := v_errors || v_group_errors;

  if jsonb_array_length(v_errors) = 0 then
    update public.workflow_versions set lifecycle_status = 'validated' where id = p_version_id;
  end if;

  return jsonb_build_object('valid', jsonb_array_length(v_errors) = 0, 'errors', v_errors);
end;
$$;

revoke execute on function public.rpc_validate_workflow_draft(text) from public, anon;
grant execute on function public.rpc_validate_workflow_draft(text) to authenticated;
