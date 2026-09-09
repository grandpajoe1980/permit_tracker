-- Keep the seeded Maya persona's authorization records attached to the
-- authenticated account used by the application. The older demo account is
-- retained for historical compatibility; active authorization and ownership
-- records must follow the canonical @spacex.com account.

DO $$
DECLARE
  v_canonical_id uuid;
  v_legacy_id uuid;
BEGIN
  SELECT id
    INTO v_canonical_id
  FROM auth.users
  WHERE lower(email) = 'maya.chen@spacex.com'
  LIMIT 1;

  SELECT id
    INTO v_legacy_id
  FROM auth.users
  WHERE lower(email) = 'maya.chen@demo.permit.local'
  LIMIT 1;

  -- Auth users are provisioned outside migrations in some environments. Do
  -- not invent an identity or authorization row when the seeded account is
  -- absent; the repair is applied when both known accounts are present.
  IF v_canonical_id IS NULL OR v_legacy_id IS NULL OR v_canonical_id = v_legacy_id THEN
    RETURN;
  END IF;

  -- Merge duplicate authorization rows before changing the legacy key so the
  -- table-level uniqueness constraints remain valid.
  DELETE FROM public.assignment_group_memberships legacy
  WHERE legacy.user_id = v_legacy_id
    AND EXISTS (
      SELECT 1
      FROM public.assignment_group_memberships canonical
      WHERE canonical.assignment_group_id = legacy.assignment_group_id
        AND canonical.user_id = v_canonical_id
    );
  UPDATE public.assignment_group_memberships
  SET user_id = v_canonical_id,
      updated_at = now()
  WHERE user_id = v_legacy_id;

  DELETE FROM public.organization_memberships legacy
  WHERE legacy.user_id = v_legacy_id
    AND EXISTS (
      SELECT 1
      FROM public.organization_memberships canonical
      WHERE canonical.organization_id = legacy.organization_id
        AND canonical.user_id = v_canonical_id
    );
  UPDATE public.organization_memberships
  SET user_id = v_canonical_id
  WHERE user_id = v_legacy_id;

  DELETE FROM public.project_participants legacy
  WHERE legacy.user_id = v_legacy_id
    AND EXISTS (
      SELECT 1
      FROM public.project_participants canonical
      WHERE canonical.project_id = legacy.project_id
        AND canonical.organization_id IS NOT DISTINCT FROM legacy.organization_id
        AND canonical.user_id = v_canonical_id
    );
  UPDATE public.project_participants
  SET user_id = v_canonical_id
  WHERE user_id = v_legacy_id;

  DELETE FROM public.user_profiles legacy
  WHERE legacy.user_id = v_legacy_id
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles canonical
      WHERE canonical.user_id = v_canonical_id
    );
  UPDATE public.user_profiles
  SET user_id = v_canonical_id
  WHERE user_id = v_legacy_id;

  UPDATE public.assignment_groups SET lead_user_id = v_canonical_id WHERE lead_user_id = v_legacy_id;
  UPDATE public.assignments SET assignee_user_id = v_canonical_id WHERE assignee_user_id = v_legacy_id;
  UPDATE public.audit_events SET actor_id = v_canonical_id WHERE actor_id = v_legacy_id;
  UPDATE public.customer_requests SET assigned_to_user_id = v_canonical_id WHERE assigned_to_user_id = v_legacy_id;
  UPDATE public.customer_requests SET triaged_by_user_id = v_canonical_id WHERE triaged_by_user_id = v_legacy_id;
  UPDATE public.document_agency_reviews SET reviewed_by_user_id = v_canonical_id WHERE reviewed_by_user_id = v_legacy_id;
  UPDATE public.documents SET created_by = v_canonical_id WHERE created_by = v_legacy_id;
  UPDATE public.external_filings SET submitted_by_user_id = v_canonical_id WHERE submitted_by_user_id = v_legacy_id;
  UPDATE public.external_filings SET last_status_verified_by = v_canonical_id WHERE last_status_verified_by = v_legacy_id;
  UPDATE public.notifications SET recipient_id = v_canonical_id WHERE recipient_id = v_legacy_id;
  UPDATE public.notifications SET recipient_user_id = v_canonical_id WHERE recipient_user_id = v_legacy_id;
  UPDATE public.notifications SET user_id = v_canonical_id::text WHERE user_id = v_legacy_id::text;
  UPDATE public.projects SET created_by = v_canonical_id WHERE created_by = v_legacy_id;
  UPDATE public.requests SET submitter_id = v_canonical_id WHERE submitter_id = v_legacy_id;
  UPDATE public.rfi_responses SET submitted_by_user_id = v_canonical_id WHERE submitted_by_user_id = v_legacy_id;
  UPDATE public.stage_runs SET completed_by = v_canonical_id WHERE completed_by = v_legacy_id;
  UPDATE public.tasks SET assigned_to_user_id = v_canonical_id WHERE assigned_to_user_id = v_legacy_id;
  UPDATE public.workstreams SET assigned_owner_user_id = v_canonical_id WHERE assigned_owner_user_id = v_legacy_id;
  UPDATE public.workstreams SET assigned_to_user_id = v_canonical_id WHERE assigned_to_user_id = v_legacy_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.assignment_group_memberships
    WHERE user_id = v_canonical_id
      AND assignment_group_id = 'df22014f-c2e4-4ef9-8d51-4303c358dc10'
  ) THEN
    RAISE EXCEPTION 'Maya identity repair did not preserve the SpaceX Regulatory Affairs membership';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.assignment_group_memberships
    WHERE user_id = '6c36cc88-153e-44fa-ae9a-6d50e59c9387'
  ) THEN
    RAISE EXCEPTION 'legacy Maya assignment-group membership remains after canonical identity repair';
  END IF;
END;
$$;
