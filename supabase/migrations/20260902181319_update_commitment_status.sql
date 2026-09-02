-- Persist commitment status transitions through the same authenticated command
-- boundary used by the rest of the project workflow.
CREATE OR REPLACE FUNCTION public.rpc_update_commitment_status(
  p_commitment_id TEXT,
  p_status TEXT,
  p_actor_name TEXT,
  p_actor_org_name TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_project_id UUID;
  v_old_status TEXT;
  v_existing_fulfilled_date DATE;
  v_fulfilled_date DATE;
  v_now TIMESTAMPTZ := now();
  v_actor_name TEXT;
  v_actor_org_name TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user is required';
  END IF;

  IF p_status NOT IN ('on_track', 'at_risk', 'fulfilled', 'missed', 'waived') THEN
    RAISE EXCEPTION 'invalid commitment status: %', p_status;
  END IF;

  SELECT w.project_id, c.status, c.fulfilled_date
    INTO v_project_id, v_old_status, v_existing_fulfilled_date
    FROM public.commitments c
    JOIN public.workstreams w ON w.id = c.workstream_id
   WHERE c.id = p_commitment_id
   FOR UPDATE OF c;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'commitment not found: %', p_commitment_id;
  END IF;

  IF v_project_id IS NULL
     OR NOT (SELECT app_private.has_project_access(v_project_id)) THEN
    RAISE EXCEPTION 'authenticated user cannot update commitment %', p_commitment_id;
  END IF;

  v_fulfilled_date := CASE
    WHEN p_status = 'fulfilled' THEN COALESCE(v_existing_fulfilled_date, CURRENT_DATE)
    ELSE NULL
  END;

  UPDATE public.commitments
     SET status = p_status,
         fulfilled_date = v_fulfilled_date
   WHERE id = p_commitment_id;

  SELECT COALESCE(NULLIF(trim(full_name), ''), 'PATH user')
    INTO v_actor_name
    FROM public.profiles
   WHERE id = v_actor_id;

  v_actor_name := COALESCE(NULLIF(trim(p_actor_name), ''), v_actor_name, 'PATH user');
  v_actor_org_name := COALESCE(NULLIF(trim(p_actor_org_name), ''), 'PATH');

  INSERT INTO public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason, project_id,
    created_at, occurred_at
  ) VALUES (
    v_actor_id, 'commitment_status_updated', 'commitment', 'commitment',
    p_commitment_id, v_actor_name, v_actor_org_name, 'status_changed',
    v_old_status, p_status,
    COALESCE(NULLIF(trim(p_notes), ''), 'Commitment status marked ' || p_status),
    v_project_id::TEXT, v_now, v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'commitmentId', p_commitment_id,
    'oldStatus', v_old_status,
    'newStatus', p_status,
    'fulfilledDate', v_fulfilled_date,
    'updatedAt', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_update_commitment_status(TEXT, TEXT, TEXT, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_update_commitment_status(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
