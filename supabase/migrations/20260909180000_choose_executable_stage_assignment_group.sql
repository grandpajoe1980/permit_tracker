-- Select a next-stage group that can actually receive work.
-- Published workflow versions may predate canonical group IDs, so the
-- transition boundary must resolve a valid active group without rewriting
-- the published version or silently selecting an empty group.
create or replace function app_private.resolve_stage_assignment_group(
  p_org_code text,
  p_preferred_group_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_group_id uuid;
begin
  if nullif(trim(p_preferred_group_id), '') is not null then
    begin
      select g.id
      into v_group_id
      from public.assignment_groups g
      where g.id = trim(p_preferred_group_id)::uuid
        and g.active
        and upper(g.org_code) = upper(trim(p_org_code));
    exception when invalid_text_representation then
      v_group_id := null;
    end;
    if v_group_id is not null then
      return v_group_id;
    end if;
  end if;

  select g.id
  into v_group_id
  from public.assignment_groups g
  where g.active
    and upper(g.org_code) = upper(trim(p_org_code))
    and exists (
      select 1
      from public.assignment_group_memberships m
      join public.profiles p on p.id = m.user_id
      where m.assignment_group_id = g.id
        and coalesce(p.status, 'active') = 'active'
    )
  order by g.name, g.id
  limit 1;

  if v_group_id is null then
    raise exception 'No active executable assignment group is configured for organization %', p_org_code;
  end if;
  return v_group_id;
end;
$$;

revoke all on function app_private.resolve_stage_assignment_group(text, text) from public, anon, authenticated;

-- Preserve the existing guarded transition implementation and replace only
-- its next-stage group lookup. The assertion prevents this forward repair from
-- silently succeeding if the live function has drifted to another contract.
do $$
declare
  v_definition text;
  v_lookup text := '(select id from public.assignment_groups where org_code=v_next_org_code and active order by name,id limit 1)';
begin
  select pg_get_functiondef('app_private.complete_workstream_stage(text,text[],text[],text,text)'::regprocedure)
    into v_definition;
  if position(v_lookup in v_definition) = 0 then
    raise exception 'complete_workstream_stage did not contain the expected executable-group lookup';
  end if;
  v_definition := replace(
    v_definition,
    v_lookup,
    'app_private.resolve_stage_assignment_group(v_next_org_code, v_next_version_stage.default_assignment_group_id)'
  );
  execute v_definition;
end;
$$;
