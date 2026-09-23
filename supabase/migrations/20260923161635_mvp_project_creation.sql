-- Project creation stays behind a SECURITY DEFINER RPC so the application
-- never receives broad insert grants on projects or project participants.

DROP POLICY IF EXISTS customer_org_select ON public.customer_organizations;
CREATE POLICY customer_org_select ON public.customer_organizations
  FOR SELECT TO authenticated
  USING (
    (SELECT app_private.is_customer_org_member(id))
    OR (SELECT app_private.is_system_admin())
    OR EXISTS (
      SELECT 1
      FROM public.projects project
      WHERE project.customer_organization_id = customer_organizations.id
        AND (SELECT app_private.has_project_access(project.id))
    )
  );

CREATE OR REPLACE FUNCTION public.rpc_create_project(
  p_number text,
  p_name text,
  p_customer_organization_id uuid,
  p_lead_organization_id uuid,
  p_participant_organization_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_new_customer_organization_name text DEFAULT NULL,
  p_new_customer_organization_legal_name text DEFAULT NULL,
  p_customer_user_id uuid DEFAULT NULL,
  p_customer_user_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_number text := upper(trim(coalesce(p_number, '')));
  v_name text := trim(coalesce(p_name, ''));
  v_project public.projects%ROWTYPE;
  v_customer_organization_id uuid := p_customer_organization_id;
  v_customer_organization_name text;
  v_customer_user_id uuid := p_customer_user_id;
  v_customer_user_email text := nullif(lower(trim(coalesce(p_customer_user_email, ''))), '');
  v_customer_directory_organization_id uuid;
  v_customer_profile_organization_id uuid;
  v_customer_profile_status text;
  v_participant_ids uuid[];
  v_active_participant_count integer;
BEGIN
  IF v_actor_id IS NULL OR NOT coalesce((SELECT app_private.is_system_admin()), false) THEN
    RAISE EXCEPTION 'System administrator access is required to create a project.' USING ERRCODE = '42501';
  END IF;

  IF length(v_name) < 2 OR length(v_name) > 160 THEN
    RAISE EXCEPTION 'Project name must be between 2 and 160 characters.' USING ERRCODE = '22023';
  END IF;
  IF length(v_number) < 3 OR length(v_number) > 32 OR v_number !~ '^[A-Z0-9][A-Z0-9-]{1,31}$' THEN
    RAISE EXCEPTION 'Project number must use 3 to 32 letters, numbers, or hyphens.' USING ERRCODE = '22023';
  END IF;
  IF v_customer_organization_id IS NULL THEN
    v_customer_organization_name := trim(coalesce(p_new_customer_organization_name, ''));
    IF length(v_customer_organization_name) < 2 OR length(v_customer_organization_name) > 160 THEN
      RAISE EXCEPTION 'Choose an active customer or enter a new customer organization name.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.customer_organizations customer
      WHERE lower(trim(customer.name)) = lower(v_customer_organization_name) AND customer.active
    ) THEN
      RAISE EXCEPTION 'A customer organization with that name already exists. Select it from the list.' USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.customer_organizations (name, legal_name, active)
    VALUES (
      v_customer_organization_name,
      nullif(trim(coalesce(p_new_customer_organization_legal_name, '')), ''),
      true
    )
    RETURNING id, name INTO v_customer_organization_id, v_customer_organization_name;
  ELSE
    SELECT customer.name INTO v_customer_organization_name
    FROM public.customer_organizations customer
    WHERE customer.id = v_customer_organization_id AND customer.active;
    IF v_customer_organization_name IS NULL THEN
      RAISE EXCEPTION 'Choose an active customer organization.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_customer_user_email IS NOT NULL THEN
    SELECT account.id INTO v_customer_user_id
    FROM auth.users account
    WHERE lower(account.email) = v_customer_user_email AND account.deleted_at IS NULL;
    IF v_customer_user_id IS NULL THEN
      RAISE EXCEPTION 'No active account was found for that customer email.' USING ERRCODE = '22023';
    END IF;
    IF p_customer_user_id IS NOT NULL AND p_customer_user_id <> v_customer_user_id THEN
      RAISE EXCEPTION 'The supplied customer email and user ID belong to different accounts.' USING ERRCODE = '22023';
    END IF;
  ELSIF v_customer_user_id IS NOT NULL THEN
    PERFORM 1 FROM auth.users account
    WHERE account.id = v_customer_user_id AND account.deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The customer account was not found.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_customer_user_id IS NOT NULL THEN
    SELECT profile.customer_organization_id
      , profile.status
    INTO v_customer_profile_organization_id
      , v_customer_profile_status
    FROM public.profiles profile
    WHERE profile.id = v_customer_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The customer account profile is not ready. Sign in to PATH once, then retry.' USING ERRCODE = '22023';
    END IF;
    IF v_customer_profile_status <> 'active' THEN
      RAISE EXCEPTION 'The customer account is not active.' USING ERRCODE = '23514';
    END IF;
    IF v_customer_profile_organization_id IS NOT NULL
      AND v_customer_profile_organization_id <> v_customer_organization_id THEN
      RAISE EXCEPTION 'This account already belongs to another customer organization. Use an account assigned to this customer.' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.project_participants participant
      JOIN public.projects project ON project.id = participant.project_id
      WHERE participant.user_id = v_customer_user_id
        AND participant.project_id IS DISTINCT FROM (
          SELECT existing_project.id
          FROM public.projects existing_project
          WHERE upper(existing_project.number) = v_number
          LIMIT 1
        )
        AND project.customer_organization_id IS DISTINCT FROM v_customer_organization_id
        AND participant.is_active
        AND (participant.expires_at IS NULL OR participant.expires_at > now())
        AND (participant.starts_on IS NULL OR participant.starts_on <= current_date)
        AND (participant.ends_on IS NULL OR participant.ends_on >= current_date)
    ) THEN
      RAISE EXCEPTION 'This account already has direct access to another customer project. Choose an account dedicated to this customer.' USING ERRCODE = '23514';
    END IF;

    -- Keep customer membership on the account's single customer organization.
    -- The account is attached only to this new project's participant list.
    UPDATE public.profiles
    SET customer_organization_id = v_customer_organization_id, updated_at = now()
    WHERE id = v_customer_user_id;

    INSERT INTO public.organizations (code, name, organization_type, jurisdiction_level, active)
    VALUES (
      'CUST-' || upper(substr(replace(v_customer_organization_id::text, '-', ''), 1, 12)),
      v_customer_organization_name,
      'customer',
      'external_partner',
      true
    )
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      organization_type = EXCLUDED.organization_type,
      jurisdiction_level = EXCLUDED.jurisdiction_level,
      active = true,
      updated_at = now()
    RETURNING id INTO v_customer_directory_organization_id;

    INSERT INTO public.user_profiles (
      id, user_id, full_name, organization_id, organization_name,
      display_title, work_email, project_role, is_customer_visible, is_active
    )
    SELECT
      'customer-' || v_customer_user_id::text,
      v_customer_user_id,
      coalesce(nullif(trim(profile.full_name), ''), nullif(account.raw_user_meta_data ->> 'full_name', ''), split_part(account.email, '@', 1)),
      v_customer_directory_organization_id::text,
      v_customer_organization_name,
      'Customer project participant',
      coalesce(account.email, v_customer_user_email, ''),
      'Customer',
      true,
      true
    FROM auth.users account
    LEFT JOIN public.profiles profile ON profile.id = account.id
    WHERE account.id = v_customer_user_id
    ON CONFLICT (user_id) DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      organization_name = EXCLUDED.organization_name,
      display_title = EXCLUDED.display_title,
      project_role = 'Customer',
      is_customer_visible = true,
      is_active = true,
      updated_at = now();
  END IF;
  IF p_lead_organization_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.organizations organization
    WHERE organization.id = p_lead_organization_id AND organization.active
  ) THEN
    RAISE EXCEPTION 'Choose an active lead organization.' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(array_agg(DISTINCT selected.organization_id), ARRAY[]::uuid[])
  INTO v_participant_ids
  FROM unnest(coalesce(p_participant_organization_ids, ARRAY[]::uuid[]) || ARRAY[p_lead_organization_id]) AS selected(organization_id)
  WHERE selected.organization_id IS NOT NULL;

  SELECT count(*)::integer
  INTO v_active_participant_count
  FROM public.organizations organization
  WHERE organization.id = ANY(v_participant_ids) AND organization.active;
  IF v_active_participant_count <> cardinality(v_participant_ids) THEN
    RAISE EXCEPTION 'Every participant must be an active organization.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.projects (
    number,
    name,
    customer_organization_id,
    lead_organization_id,
    created_by,
    status
  ) VALUES (
    v_number,
    v_name,
    v_customer_organization_id,
    p_lead_organization_id,
    v_actor_id,
    'active'
  )
  RETURNING * INTO v_project;

  INSERT INTO public.project_participants (
    project_id,
    organization_id,
    participation_role,
    access_scope
  )
  SELECT
    v_project.id,
    selected.organization_id,
    CASE WHEN selected.organization_id = p_lead_organization_id THEN 'lead' ELSE 'reviewing' END,
    'project'
  FROM unnest(v_participant_ids) AS selected(organization_id);

  IF v_customer_user_id IS NOT NULL THEN
    INSERT INTO public.project_participants (
      project_id,
      organization_id,
      user_id,
      participation_role,
      access_scope,
      organization_name,
      project_role,
      visibility_scope,
      is_active
    ) VALUES (
      v_project.id,
      v_customer_directory_organization_id,
      v_customer_user_id,
      'reviewing',
      'project',
      v_customer_organization_name,
      'Customer',
      'customer',
      true
    );
  END IF;

  INSERT INTO public.audit_events (
    actor_id,
    action,
    resource_type,
    resource_id,
    after_data
  ) VALUES (
    v_actor_id,
    'project_created',
    'project',
    v_project.id,
    jsonb_build_object(
      'number', v_project.number,
      'name', v_project.name,
      'customer_organization_id', v_customer_organization_id,
      'customer_organization_name', v_customer_organization_name,
      'lead_organization_id', v_project.lead_organization_id,
      'participant_organization_ids', to_jsonb(v_participant_ids),
      'customer_user_id', v_customer_user_id
    )
  );

  RETURN jsonb_build_object(
    'id', v_project.id,
    'number', v_project.number,
    'name', v_project.name,
    'customer_organization_id', v_customer_organization_id,
    'customer_organization_name', v_customer_organization_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_project(text, text, uuid, uuid, uuid[], text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_project(text, text, uuid, uuid, uuid[], text, text, uuid, text) TO authenticated;

-- A direct customer participant can access only projects that list their user
-- id. Organization membership remains a separate access path.
CREATE OR REPLACE FUNCTION app_private.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects project
    WHERE project.id = p_project_id
      AND (
        app_private.is_customer_org_member(project.customer_organization_id)
        OR app_private.is_org_member(project.lead_organization_id)
        OR EXISTS (
          SELECT 1
          FROM public.project_participants participant
          WHERE participant.project_id = project.id
            AND (participant.expires_at IS NULL OR participant.expires_at > now())
            AND (participant.ends_on IS NULL OR participant.ends_on >= current_date)
            AND (participant.starts_on IS NULL OR participant.starts_on <= current_date)
            AND participant.is_active
            AND (
              participant.user_id = auth.uid()
              OR app_private.is_org_member(participant.organization_id)
            )
        )
      )
  );
$$;
