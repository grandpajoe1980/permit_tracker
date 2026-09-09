-- Preserve original submitter identity on staff updates and provide an atomic
-- authenticated Take Ownership transaction.

CREATE OR REPLACE FUNCTION app_private.enforce_customer_request_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.submitted_by_user_id IS DISTINCT FROM auth.uid()
         AND NOT (SELECT app_private.is_system_admin()) THEN
        RAISE EXCEPTION 'submitted_by_user_id must match the authenticated user';
      END IF;
    ELSIF NEW.submitted_by_user_id IS DISTINCT FROM OLD.submitted_by_user_id THEN
      RAISE EXCEPTION 'submitted_by_user_id cannot be changed';
    END IF;

    IF NOT (SELECT app_private.has_project_access_text(NEW.project_id)) THEN
      RAISE EXCEPTION 'authenticated user cannot access project %', NEW.project_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_claim_ticket(
  p_ticket_id TEXT,
  p_ticket_type TEXT,
  p_expected_assignment_group_id UUID DEFAULT NULL,
  p_expected_assigned_to_user_id UUID DEFAULT NULL,
  p_assignment_notes TEXT DEFAULT NULL
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
  v_project_id UUID;
  v_old_group_id UUID;
  v_old_assignee_id UUID;
  v_actor_name TEXT;
  v_assignee_name TEXT;
  v_group public.assignment_groups%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required for ticket claim';
  END IF;
  IF p_ticket_type NOT IN ('customer_request', 'workstream', 'task') THEN
    RAISE EXCEPTION 'invalid ticket type: %', p_ticket_type;
  END IF;

  IF p_ticket_type = 'customer_request' THEN
    SELECT id, project_id, assignment_group_id, assigned_to_user_id
      INTO v_ticket_id, v_project_ref, v_old_group_id, v_old_assignee_id
    FROM public.customer_requests
    WHERE id = p_ticket_id OR confirmation_number = p_ticket_id
    FOR UPDATE;
  ELSIF p_ticket_type = 'workstream' THEN
    SELECT id, project_id::TEXT, assignment_group_id, assigned_to_user_id
      INTO v_ticket_id, v_project_ref, v_old_group_id, v_old_assignee_id
    FROM public.workstreams
    WHERE id = p_ticket_id OR code = p_ticket_id
    FOR UPDATE;
  ELSE
    SELECT task.id, workstream.project_id::TEXT, task.assignment_group_id, task.assigned_to_user_id
      INTO v_ticket_id, v_project_ref, v_old_group_id, v_old_assignee_id
    FROM public.tasks task
    JOIN public.workstreams workstream ON workstream.id = task.workstream_id
    WHERE task.id = p_ticket_id
    FOR UPDATE;
  END IF;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'ticket not found: %', p_ticket_id;
  END IF;

  SELECT id INTO v_project_id
  FROM public.projects
  WHERE id::TEXT = v_project_ref OR number = v_project_ref
  LIMIT 1;

  IF v_project_id IS NULL OR NOT (SELECT app_private.has_project_access(v_project_id)) THEN
    RAISE EXCEPTION 'authenticated user cannot claim ticket %', v_ticket_id;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(full_name), ''), NULLIF(TRIM(email), ''), 'Name unavailable')
    INTO v_assignee_name
  FROM public.profiles
  WHERE id = v_old_assignee_id;
  v_assignee_name := COALESCE(v_assignee_name, 'Name unavailable');

  IF v_old_group_id IS DISTINCT FROM p_expected_assignment_group_id
     OR v_old_assignee_id IS DISTINCT FROM p_expected_assigned_to_user_id THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'ticketId', v_ticket_id,
      'ticketType', p_ticket_type,
      'assignmentGroupId', v_old_group_id,
      'assignedToUserId', v_old_assignee_id,
      'assignedToUserName', v_assignee_name
    );
  END IF;

  IF v_old_assignee_id = v_actor_id THEN
    RETURN jsonb_build_object(
      'status', 'already_owned',
      'ticketId', v_ticket_id,
      'ticketType', p_ticket_type,
      'assignmentGroupId', v_old_group_id,
      'assignedToUserId', v_old_assignee_id,
      'assignedToUserName', v_assignee_name
    );
  END IF;

  IF v_old_group_id IS NOT NULL THEN
    SELECT * INTO v_group
    FROM public.assignment_groups
    WHERE id = v_old_group_id AND active;
    IF NOT FOUND OR NOT (SELECT app_private.can_assign_group(v_group.id, v_project_id)) THEN
      RAISE EXCEPTION 'authenticated user cannot claim ticket % in its current group', v_ticket_id;
    END IF;
  ELSE
    SELECT group_record.* INTO v_group
    FROM public.assignment_groups group_record
    JOIN public.assignment_group_memberships membership
      ON membership.assignment_group_id = group_record.id
     AND membership.user_id = v_actor_id
    WHERE group_record.active
      AND (SELECT app_private.can_assign_group(group_record.id, v_project_id))
    ORDER BY group_record.name
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'authenticated user has no eligible assignment group for ticket %', v_ticket_id;
    END IF;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(full_name), ''), 'Authenticated user')
    INTO v_actor_name
  FROM public.profiles
  WHERE id = v_actor_id;
  v_actor_name := COALESCE(v_actor_name, 'Authenticated user');

  IF p_ticket_type = 'customer_request' THEN
    UPDATE public.customer_requests
    SET assignment_group_id = v_group.id,
        assigned_to_user_id = v_actor_id,
        itsm_state = CASE WHEN itsm_state IN ('draft', 'submitted') THEN 'triaged' ELSE itsm_state END,
        updated_at = v_now
    WHERE id = v_ticket_id;
  ELSIF p_ticket_type = 'workstream' THEN
    UPDATE public.workstreams
    SET assignment_group_id = v_group.id,
        assigned_to_user_id = v_actor_id,
        assigned_org_code = v_group.org_code,
        updated_at = v_now
    WHERE id = v_ticket_id;
  ELSE
    UPDATE public.tasks
    SET assignment_group_id = v_group.id,
        assigned_to_user_id = v_actor_id,
        assigned_org_code = v_group.org_code
    WHERE id = v_ticket_id;
  END IF;

  INSERT INTO public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason, project_id,
    created_at, occurred_at
  ) VALUES (
    v_actor_id, 'ticket_claimed', p_ticket_type, p_ticket_type, v_ticket_id,
    v_actor_name, v_group.org_code, 'assigned',
    jsonb_build_object('groupId', v_old_group_id, 'assigneeId', v_old_assignee_id)::TEXT,
    jsonb_build_object('groupId', v_group.id, 'groupName', v_group.name, 'assigneeId', v_actor_id)::TEXT,
    COALESCE(p_assignment_notes, 'Claimed ownership (Take ownership)'), v_project_ref,
    v_now, v_now
  );

  RETURN jsonb_build_object(
    'status', 'claimed',
    'ticketId', v_ticket_id,
    'ticketType', p_ticket_type,
    'assignmentGroupId', v_group.id,
    'assignmentGroupName', v_group.name,
    'assignedToUserId', v_actor_id,
    'assignedToUserName', v_actor_name,
    'updatedAt', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_claim_ticket(TEXT, TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_claim_ticket(TEXT, TEXT, UUID, UUID, TEXT) TO authenticated;
