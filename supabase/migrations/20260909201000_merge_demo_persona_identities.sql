-- Reconcile legacy seeded persona accounts with the authenticated accounts
-- used by the release demo. Domain ownership must follow auth.uid(), not a
-- parallel .demo.permit.local or .test account with the same display name.

DO $$
DECLARE
  v_pair record;
  v_canonical_id uuid;
  v_legacy_id uuid;
BEGIN
  FOR v_pair IN
    SELECT *
    FROM (VALUES
      ('alex.martin@demo.permit.local', 'alex.martin@spacex.com'),
      ('alex.martin@spacex.test', 'alex.martin@spacex.com'),
      ('aris.thorne@demo.permit.local', 'aris.thorne@gulfcoast-engineering.example'),
      ('jordan.lee@demo.permit.local', 'jordan.lee@la.gov'),
      ('jordan.lee@spacex.test', 'jordan.lee@la.gov'),
      ('maya.chen@demo.permit.local', 'maya.chen@spacex.com'),
      ('maya.chen@spacex.test', 'maya.chen@spacex.com'),
      ('riley.brooks@demo.permit.local', 'riley.brooks@vermilionparish.org'),
      ('riley.brooks@spacex.test', 'riley.brooks@vermilionparish.org'),
      ('sam.rivera@demo.permit.local', 'sam.rivera@la.gov'),
      ('sam.rivera@spacex.test', 'sam.rivera@la.gov'),
      ('sarah.johnson@demo.permit.local', 'sarah.johnson@la.gov')
    ) AS aliases(legacy_email, canonical_email)
  LOOP
    SELECT id INTO v_canonical_id
    FROM auth.users
    WHERE lower(email) = lower(v_pair.canonical_email)
    LIMIT 1;

    SELECT id INTO v_legacy_id
    FROM auth.users
    WHERE lower(email) = lower(v_pair.legacy_email)
    LIMIT 1;

    IF v_canonical_id IS NULL OR v_legacy_id IS NULL OR v_canonical_id = v_legacy_id THEN
      CONTINUE;
    END IF;

    DELETE FROM public.assignment_group_memberships legacy
    WHERE legacy.user_id = v_legacy_id
      AND EXISTS (
        SELECT 1 FROM public.assignment_group_memberships canonical
        WHERE canonical.assignment_group_id = legacy.assignment_group_id
          AND canonical.user_id = v_canonical_id
      );
    UPDATE public.assignment_group_memberships SET user_id = v_canonical_id, updated_at = now() WHERE user_id = v_legacy_id;

    DELETE FROM public.organization_memberships legacy
    WHERE legacy.user_id = v_legacy_id
      AND EXISTS (
        SELECT 1 FROM public.organization_memberships canonical
        WHERE canonical.organization_id = legacy.organization_id
          AND canonical.user_id = v_canonical_id
      );
    UPDATE public.organization_memberships SET user_id = v_canonical_id WHERE user_id = v_legacy_id;

    DELETE FROM public.project_participants legacy
    WHERE legacy.user_id = v_legacy_id
      AND EXISTS (
        SELECT 1 FROM public.project_participants canonical
        WHERE canonical.project_id = legacy.project_id
          AND canonical.organization_id IS NOT DISTINCT FROM legacy.organization_id
          AND canonical.user_id = v_canonical_id
      );
    UPDATE public.project_participants SET user_id = v_canonical_id WHERE user_id = v_legacy_id;

    DELETE FROM public.user_profiles legacy
    WHERE legacy.user_id = v_legacy_id
      AND EXISTS (SELECT 1 FROM public.user_profiles canonical WHERE canonical.user_id = v_canonical_id);
    UPDATE public.user_profiles SET user_id = v_canonical_id WHERE user_id = v_legacy_id;

    UPDATE public.assignment_groups SET lead_user_id = v_canonical_id WHERE lead_user_id = v_legacy_id;
    UPDATE public.assignments SET assignee_user_id = v_canonical_id WHERE assignee_user_id = v_legacy_id;
    UPDATE public.audit_events SET actor_id = v_canonical_id WHERE actor_id = v_legacy_id;
    UPDATE public.customer_requests SET assigned_to_user_id = v_canonical_id WHERE assigned_to_user_id = v_legacy_id;
    UPDATE public.customer_requests SET submitted_by_user_id = v_canonical_id WHERE submitted_by_user_id = v_legacy_id;
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
  END LOOP;

  -- This is the handoff used by the release acceptance story. If both the
  -- legacy and canonical Sarah accounts are present, the canonical account
  -- must be able to claim Louisiana Project Delivery work.
  SELECT id INTO v_canonical_id FROM auth.users WHERE lower(email) = 'sarah.johnson@la.gov' LIMIT 1;
  IF v_canonical_id IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = 'sarah.johnson@demo.permit.local')
     AND NOT EXISTS (
       SELECT 1
       FROM public.assignment_group_memberships membership
       JOIN public.assignment_groups group_record ON group_record.id = membership.assignment_group_id
       WHERE membership.user_id = v_canonical_id
         AND group_record.name = 'Louisiana Project Delivery Office'
     ) THEN
    RAISE EXCEPTION 'canonical Sarah identity is missing the Louisiana Project Delivery Office membership';
  END IF;
END;
$$;
