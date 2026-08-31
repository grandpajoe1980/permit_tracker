-- Wave 3 follow-up: role assignment is an authenticated, organization-scoped
-- mutation. The browser must never update membership.role directly.

create or replace function public.rpc_set_organization_member_role(
  p_user_id uuid,
  p_organization_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_membership public.organization_memberships%rowtype;
  v_old_role text;
begin
  if v_actor_id is null then
    raise exception 'authentication is required to change organization roles';
  end if;
  if p_role not in ('contributor', 'supervisor', 'organization_admin', 'system_admin') then
    raise exception 'invalid organization membership role: %', p_role;
  end if;
  if not (select app_private.is_system_admin())
     and not (select app_private.is_organization_admin(p_organization_id)) then
    raise exception 'organization administrator capability required for organization %', p_organization_id;
  end if;
  if p_role = 'system_admin' and not (select app_private.is_system_admin()) then
    raise exception 'only a system administrator can assign system_admin';
  end if;

  select * into v_membership
  from public.organization_memberships
  where user_id = p_user_id and organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'organization membership not found for user %', p_user_id;
  end if;

  v_old_role := v_membership.role;
  update public.organization_memberships
  set role = p_role
  where id = v_membership.id;

  insert into public.audit_events (
    actor_id, organization_id, action, resource_type, resource_id,
    entity_type, entity_id, action_type, old_value, new_value, created_at
  ) values (
    v_actor_id, p_organization_id, 'organization_member_role_updated',
    'organization_membership', v_membership.id,
    'organization_membership', v_membership.id::text,
    'organization_member_role_updated', v_old_role, p_role, now()
  );

  select * into v_membership from public.organization_memberships where id = v_membership.id;
  return jsonb_build_object(
    'id', v_membership.id,
    'user_id', v_membership.user_id,
    'organization_id', v_membership.organization_id,
    'role', v_membership.role,
    'status', v_membership.status,
    'effective_from', v_membership.effective_from,
    'effective_to', v_membership.effective_to
  );
end;
$$;

revoke execute on function public.rpc_set_organization_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.rpc_set_organization_member_role(uuid, uuid, text) to authenticated;
