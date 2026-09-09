-- The customer portal is authorized by profiles.customer_organization_id.
-- Do not require a duplicate organization_memberships row for an applicant;
-- keep the check scoped to the RFI's authoritative project customer.

CREATE OR REPLACE FUNCTION public.rpc_submit_rfi_response(
  p_id text,
  p_rfi_id text,
  p_submitted_by_user_name text,
  p_response_text text,
  p_actor_org_name text,
  p_attached_document_version_ids jsonb DEFAULT '[]'::jsonb,
  p_actor_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_now timestamptz := now();
  v_today date := current_date;
  v_resp public.rfi_responses%rowtype;
  v_existing public.rfi_responses%rowtype;
  v_rfi record;
  v_actor_name text;
  v_actor_org_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authenticated user required'; END IF;

  SELECT r.*, w.project_id
    INTO v_rfi
  FROM public.rfis r
  JOIN public.workstreams w ON w.id = r.workstream_id
  WHERE r.id = p_rfi_id OR r.code = p_rfi_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RFI not found: %', p_rfi_id; END IF;
  IF v_rfi.status IN ('accepted', 'closed', 'withdrawn') THEN
    RAISE EXCEPTION 'RFI is already terminal: %', v_rfi.status;
  END IF;
  IF NOT (SELECT app_private.has_project_access(v_rfi.project_id)) THEN
    RAISE EXCEPTION 'authenticated user cannot access RFI project';
  END IF;

  IF NOT (
    (SELECT app_private.is_system_admin())
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      JOIN public.organizations o ON o.id = m.organization_id
      WHERE m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
        AND m.effective_from <= now()
        AND (m.effective_to IS NULL OR m.effective_to > now())
        AND upper(o.code) = upper(v_rfi.recipient_org_code)
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles profile
      JOIN public.projects project ON project.customer_organization_id = profile.customer_organization_id
      WHERE profile.id = (SELECT auth.uid())
        AND profile.status = 'active'
        AND project.id = v_rfi.project_id
    )
  ) THEN
    RAISE EXCEPTION 'recipient organization membership required';
  END IF;

  IF nullif(trim(p_response_text), '') IS NULL THEN RAISE EXCEPTION 'RFI response is required'; END IF;
  IF jsonb_typeof(coalesce(p_attached_document_version_ids, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'RFI attachments must be a JSON array';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(coalesce(p_attached_document_version_ids, '[]'::jsonb)) attachment(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.document_versions document_version
      LEFT JOIN public.documents document_record ON document_record.id = document_version.document_id
      WHERE document_version.id = attachment.value
        AND (document_version.project_id = v_rfi.project_id OR document_record.project_id = v_rfi.project_id)
    )
  ) THEN
    RAISE EXCEPTION 'RFI attachment is not part of the project';
  END IF;

  SELECT * INTO v_existing FROM public.rfi_responses WHERE id = p_id;
  IF FOUND THEN
    IF v_existing.rfi_id <> v_rfi.id THEN
      RAISE EXCEPTION 'response ID already belongs to another RFI: %', p_id;
    END IF;
    RETURN to_jsonb(v_existing);
  END IF;

  v_actor_name := coalesce(
    (SELECT profile.full_name FROM public.user_profiles profile WHERE profile.user_id = (SELECT auth.uid()) LIMIT 1),
    nullif(trim(p_submitted_by_user_name), ''),
    'Authenticated user'
  );
  SELECT organization.name INTO v_actor_org_name
  FROM public.organization_memberships membership
  JOIN public.organizations organization ON organization.id = membership.organization_id
  WHERE membership.user_id = (SELECT auth.uid()) AND membership.status = 'active'
  ORDER BY CASE WHEN upper(organization.code) = upper(v_rfi.recipient_org_code) THEN 0 ELSE 1 END
  LIMIT 1;
  IF v_actor_org_name IS NULL THEN
    SELECT customer_organization.name INTO v_actor_org_name
    FROM public.customer_organizations customer_organization
    JOIN public.profiles profile ON profile.customer_organization_id = customer_organization.id
    JOIN public.projects project ON project.customer_organization_id = customer_organization.id
    WHERE profile.id = (SELECT auth.uid())
      AND profile.status = 'active'
      AND project.id = v_rfi.project_id
    LIMIT 1;
  END IF;
  v_actor_org_name := coalesce(v_actor_org_name, nullif(trim(p_actor_org_name), ''), v_rfi.recipient_org_code);

  INSERT INTO public.rfi_responses (
    id, rfi_id, submitted_by_user_id, submitted_by_user_name, response_text,
    attached_document_version_ids, submitted_date, review_status, created_at
  ) VALUES (
    p_id, v_rfi.id, (SELECT auth.uid()), v_actor_name, p_response_text,
    coalesce(p_attached_document_version_ids, '[]'::jsonb), v_today, 'under_review', v_now
  ) RETURNING * INTO v_resp;

  UPDATE public.rfis SET status = 'submitted_by_applicant' WHERE id = v_rfi.id;
  INSERT INTO public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, new_value, reason, project_id, created_at
  ) VALUES (
    (SELECT auth.uid()), 'rfi_response_submitted', 'rfi_response', 'rfi_response',
    v_rfi.code, v_actor_name, v_actor_org_name, 'rfi_response_submitted',
    'Response submitted to ' || v_rfi.requesting_org_code, p_response_text,
    v_rfi.project_id::text, v_now
  );
  RETURN to_jsonb(v_resp);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_submit_rfi_response(text, text, text, text, text, jsonb, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_submit_rfi_response(text, text, text, text, text, jsonb, uuid) TO authenticated, service_role;
