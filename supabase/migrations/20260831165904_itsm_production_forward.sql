-- Production-canonical ITSM forward migration.
-- This migration targets the linked production PATH baseline rather than the
-- divergent local migration ledger. It intentionally uses live organization
-- codes and authenticated actor context rather than fixture UUIDs.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM public;
GRANT USAGE ON SCHEMA app_private TO authenticated;

-- ---------------------------------------------------------------------------
-- Schema and compatibility columns
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.assignment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_code TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  lead_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_assignment_groups_org_name UNIQUE (org_code, name)
);

CREATE TABLE IF NOT EXISTS public.assignment_group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_group_id UUID NOT NULL REFERENCES public.assignment_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'lead', 'backup')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_group_user_membership UNIQUE (assignment_group_id, user_id)
);

ALTER TABLE public.audit_events
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS related_entity_id TEXT;

ALTER TABLE public.customer_requests
  ADD COLUMN IF NOT EXISTS assignment_group_id UUID REFERENCES public.assignment_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS itsm_state TEXT NOT NULL DEFAULT 'submitted'
    CHECK (itsm_state IN ('draft', 'submitted', 'triaged', 'in_progress', 'pending_customer', 'pending_agency', 'blocked', 'resolved', 'closed')),
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'P3'
    CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
  ADD COLUMN IF NOT EXISTS statutory_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clock_status TEXT NOT NULL DEFAULT 'active'
    CHECK (clock_status IN ('active', 'paused', 'stopped', 'extended')),
  ADD COLUMN IF NOT EXISTS clock_paused_reason TEXT,
  ADD COLUMN IF NOT EXISTS clock_paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clock_total_paused_seconds INTEGER NOT NULL DEFAULT 0
    CHECK (clock_total_paused_seconds >= 0);

ALTER TABLE public.workstreams
  ADD COLUMN IF NOT EXISTS assignment_group_id UUID REFERENCES public.assignment_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_org_code TEXT,
  ADD COLUMN IF NOT EXISTS itsm_state TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (itsm_state IN ('draft', 'submitted', 'triaged', 'in_progress', 'pending_customer', 'pending_agency', 'blocked', 'resolved', 'closed')),
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'P3'
    CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
  ADD COLUMN IF NOT EXISTS statutory_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clock_status TEXT NOT NULL DEFAULT 'active'
    CHECK (clock_status IN ('active', 'paused', 'stopped', 'extended')),
  ADD COLUMN IF NOT EXISTS clock_paused_reason TEXT,
  ADD COLUMN IF NOT EXISTS clock_paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clock_total_paused_seconds INTEGER NOT NULL DEFAULT 0
    CHECK (clock_total_paused_seconds >= 0);

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignment_group_id UUID REFERENCES public.assignment_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_org_code TEXT,
  ADD COLUMN IF NOT EXISTS itsm_state TEXT NOT NULL DEFAULT 'submitted'
    CHECK (itsm_state IN ('draft', 'submitted', 'triaged', 'in_progress', 'pending_customer', 'pending_agency', 'blocked', 'resolved', 'closed')),
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'P3'
    CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
  ADD COLUMN IF NOT EXISTS statutory_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clock_status TEXT NOT NULL DEFAULT 'active'
    CHECK (clock_status IN ('active', 'paused', 'stopped', 'extended')),
  ADD COLUMN IF NOT EXISTS clock_paused_reason TEXT,
  ADD COLUMN IF NOT EXISTS clock_paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clock_total_paused_seconds INTEGER NOT NULL DEFAULT 0
    CHECK (clock_total_paused_seconds >= 0);

CREATE INDEX IF NOT EXISTS idx_audit_events_occurred_at ON public.audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user ON public.notifications (recipient_user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignment_groups_org ON public.assignment_groups (org_code, active);
CREATE INDEX IF NOT EXISTS idx_assignment_groups_org_id ON public.assignment_groups (organization_id, active);
CREATE INDEX IF NOT EXISTS idx_assignment_group_memberships_group ON public.assignment_group_memberships (assignment_group_id);
CREATE INDEX IF NOT EXISTS idx_assignment_group_memberships_user ON public.assignment_group_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_customer_requests_assignment ON public.customer_requests (assignment_group_id, itsm_state);
CREATE INDEX IF NOT EXISTS idx_customer_requests_assignee ON public.customer_requests (assigned_to_user_id, itsm_state);
CREATE INDEX IF NOT EXISTS idx_workstreams_assignment ON public.workstreams (assignment_group_id, itsm_state);
CREATE INDEX IF NOT EXISTS idx_workstreams_assignee ON public.workstreams (assigned_to_user_id, itsm_state);
CREATE INDEX IF NOT EXISTS idx_tasks_assignment ON public.tasks (assignment_group_id, itsm_state);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks (assigned_to_user_id, itsm_state);

-- ---------------------------------------------------------------------------
-- Authenticated actor and authorization helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_private.has_project_access(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT (SELECT app_private.can_access_project(p_project_id))
    OR (SELECT app_private.is_system_admin());
$$;

CREATE OR REPLACE FUNCTION app_private.has_project_access_text(p_project_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE (p.id::text = p_project_id OR p.number = p_project_id)
      AND (SELECT app_private.has_project_access(p.id))
  );
$$;

CREATE OR REPLACE FUNCTION app_private.is_organization_admin(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT (SELECT app_private.is_system_admin())
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships membership
      WHERE membership.organization_id = p_organization_id
        AND membership.user_id = (SELECT auth.uid())
        AND membership.status = 'active'
        AND membership.effective_from <= now()
        AND (membership.effective_to IS NULL OR membership.effective_to > now())
        AND membership.role IN ('organization_admin', 'system_admin')
    );
$$;

CREATE OR REPLACE FUNCTION app_private.is_assignment_group_member(
  p_group_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assignment_group_memberships membership
    WHERE membership.assignment_group_id = p_group_id
      AND membership.user_id = COALESCE(p_user_id, (SELECT auth.uid()))
  );
$$;

CREATE OR REPLACE FUNCTION app_private.can_fulfill_group(
  p_group_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT (SELECT app_private.is_system_admin())
    OR (SELECT app_private.is_assignment_group_member(p_group_id, COALESCE(p_user_id, (SELECT auth.uid()))))
    OR EXISTS (
      SELECT 1
      FROM public.assignment_groups group_record
      WHERE group_record.id = p_group_id
        AND (SELECT app_private.is_organization_admin(group_record.organization_id))
    );
$$;

CREATE OR REPLACE FUNCTION app_private.can_dispatch_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT (SELECT app_private.is_system_admin())
    OR EXISTS (
      SELECT 1
      FROM public.projects project_record
      WHERE project_record.id = p_project_id
        AND (SELECT app_private.is_organization_admin(project_record.lead_organization_id))
    );
$$;

CREATE OR REPLACE FUNCTION app_private.can_assign_group(
  p_group_id UUID,
  p_project_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT (SELECT app_private.has_project_access(p_project_id))
    AND EXISTS (
      SELECT 1
      FROM public.assignment_groups group_record
      JOIN public.projects project_record ON project_record.id = p_project_id
      WHERE group_record.id = p_group_id
        AND (
          group_record.organization_id = project_record.lead_organization_id
          OR EXISTS (
            SELECT 1
            FROM public.project_participants participant
            WHERE participant.project_id = project_record.id
              AND participant.organization_id = group_record.organization_id
              AND participant.is_active
              AND (participant.expires_at IS NULL OR participant.expires_at > now())
          )
        )
        AND (
          (SELECT app_private.can_dispatch_project(p_project_id))
          OR (SELECT app_private.can_fulfill_group(group_record.id, (SELECT auth.uid())))
        )
    );
$$;

CREATE OR REPLACE FUNCTION app_private.enforce_customer_request_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.submitted_by_user_id IS DISTINCT FROM auth.uid()
       AND NOT (SELECT app_private.is_system_admin()) THEN
      RAISE EXCEPTION 'submitted_by_user_id must match the authenticated user';
    END IF;
    IF NOT (SELECT app_private.has_project_access_text(NEW.project_id)) THEN
      RAISE EXCEPTION 'authenticated user cannot access project %', NEW.project_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.normalize_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.actor_id := auth.uid();
  END IF;
  NEW.resource_type := COALESCE(NULLIF(NEW.resource_type, ''), NULLIF(NEW.entity_type, ''), 'unknown');
  IF NEW.resource_id IS NULL
     AND NEW.entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    NEW.resource_id := NEW.entity_id::UUID;
  END IF;
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.occurred_at := COALESCE(NEW.occurred_at, NEW.created_at, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.normalize_notification_recipient()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF NEW.recipient_id IS NULL AND NEW.recipient_user_id IS NOT NULL THEN
    NEW.recipient_id := NEW.recipient_user_id;
  END IF;
  IF NEW.recipient_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT user_record.id INTO NEW.recipient_id
    FROM auth.users user_record
    WHERE user_record.id::TEXT = NEW.user_id OR lower(user_record.email) = lower(NEW.user_id)
    LIMIT 1;
  END IF;
  IF NEW.recipient_id IS NULL THEN
    RAISE EXCEPTION 'notification recipient could not be resolved';
  END IF;
  NEW.recipient_user_id := COALESCE(NEW.recipient_user_id, NEW.recipient_id);
  NEW.user_id := COALESCE(NEW.user_id, NEW.recipient_id::TEXT);
  NEW.event_type := COALESCE(NULLIF(NEW.event_type, ''), NULLIF(NEW.type, ''), 'system');
  NEW.type := COALESCE(NULLIF(NEW.type, ''), NEW.event_type);
  NEW.body := COALESCE(NEW.body, NEW.message, NEW.title);
  NEW.message := COALESCE(NEW.message, NEW.body, NEW.title);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.can_mutate_ticket(
  p_ticket_id TEXT,
  p_ticket_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_project_ref TEXT;
  v_project_id UUID;
  v_group_id UUID;
  v_assignee_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF p_ticket_type = 'customer_request' THEN
    SELECT project_id, assignment_group_id, assigned_to_user_id
      INTO v_project_ref, v_group_id, v_assignee_id
    FROM public.customer_requests
    WHERE id = p_ticket_id OR confirmation_number = p_ticket_id;
  ELSIF p_ticket_type = 'workstream' THEN
    SELECT project_id::TEXT, assignment_group_id, assigned_to_user_id
      INTO v_project_ref, v_group_id, v_assignee_id
    FROM public.workstreams
    WHERE id = p_ticket_id OR code = p_ticket_id;
  ELSIF p_ticket_type = 'task' THEN
    SELECT workstream.project_id::TEXT, task.assignment_group_id, task.assigned_to_user_id
      INTO v_project_ref, v_group_id, v_assignee_id
    FROM public.tasks task
    JOIN public.workstreams workstream ON workstream.id = task.workstream_id
    WHERE task.id = p_ticket_id;
  ELSE
    RETURN false;
  END IF;

  SELECT project_record.id INTO v_project_id
  FROM public.projects project_record
  WHERE project_record.id::TEXT = v_project_ref OR project_record.number = v_project_ref
  LIMIT 1;

  IF v_project_id IS NULL OR NOT (SELECT app_private.has_project_access(v_project_id)) THEN
    RETURN false;
  END IF;
  RETURN (SELECT app_private.can_dispatch_project(v_project_id))
    OR v_assignee_id = (SELECT auth.uid())
    OR (v_group_id IS NOT NULL AND (SELECT app_private.can_fulfill_group(v_group_id, (SELECT auth.uid()))));
END;
$$;

REVOKE ALL ON FUNCTION app_private.has_project_access(UUID) FROM public;
REVOKE ALL ON FUNCTION app_private.has_project_access_text(TEXT) FROM public;
REVOKE ALL ON FUNCTION app_private.is_organization_admin(UUID) FROM public;
REVOKE ALL ON FUNCTION app_private.is_assignment_group_member(UUID, UUID) FROM public;
REVOKE ALL ON FUNCTION app_private.can_fulfill_group(UUID, UUID) FROM public;
REVOKE ALL ON FUNCTION app_private.can_dispatch_project(UUID) FROM public;
REVOKE ALL ON FUNCTION app_private.can_assign_group(UUID, UUID) FROM public;
REVOKE ALL ON FUNCTION app_private.can_mutate_ticket(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION app_private.has_project_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_project_access_text(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_organization_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_assignment_group_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.can_fulfill_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.can_dispatch_project(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.can_assign_group(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.can_mutate_ticket(TEXT, TEXT) TO authenticated;

DROP TRIGGER IF EXISTS customer_requests_enforce_actor ON public.customer_requests;
CREATE TRIGGER customer_requests_enforce_actor
BEFORE INSERT OR UPDATE ON public.customer_requests
FOR EACH ROW EXECUTE FUNCTION app_private.enforce_customer_request_actor();

DROP TRIGGER IF EXISTS audit_events_normalize_actor ON public.audit_events;
DROP TRIGGER IF EXISTS audit_events_normalize_compat ON public.audit_events;
CREATE TRIGGER audit_events_normalize_compat
BEFORE INSERT ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION app_private.normalize_audit_event();

DROP TRIGGER IF EXISTS notifications_normalize_recipient ON public.notifications;
DROP TRIGGER IF EXISTS notifications_normalize_fields ON public.notifications;
CREATE TRIGGER notifications_normalize_recipient
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION app_private.normalize_notification_recipient();

-- ---------------------------------------------------------------------------
-- Production-code-based seed and backfill
-- ---------------------------------------------------------------------------

INSERT INTO public.assignment_groups (org_code, organization_id, name, description, active)
SELECT seed.org_code, organization.id, seed.name, seed.description, true
FROM (VALUES
  ('SPACEX', 'SpaceX - Internal Technical Queue', 'Flight hardware, pad civil engineering, and cryogenic infrastructure reviews'),
  ('SPACEX', 'SpaceX - Regulatory Affairs Queue', 'Regulatory filings, environmental reviews, and statutory compliance'),
  ('STATEPO', 'Governors Project Office - Executive Triage', 'State-level executive triage, bottleneck clearing, and escalation coordination'),
  ('STATEPO', 'Governors Project Office - Interagency Concierge', 'Dedicated liaison queue for concurrent agency reviews'),
  ('DOTD', 'DOTD - Structures and Bridge Review', 'Structural load simulations and bridge engineering ratings'),
  ('DOTD', 'DOTD - Highway Access and Heavy-Haul', 'Superload permits, turning radii, and right-of-way access'),
  ('LDEQ', 'LDEQ - Water Quality and Deluge Permitting', 'Industrial stormwater and deluge wastewater review'),
  ('LDEQ', 'LDEQ - Air Quality and Environmental Review', 'Air emissions and environmental impact assessments'),
  ('CPRA', 'CPRA - Coastal Use and Hydrology Permitting', 'Coastal use permits and ecological impact review'),
  ('CPRA', 'CPRA - Drainage and Levee Concurrence', 'Hydrologic modeling, levee protection, and wetland mitigation'),
  ('SAFETY', 'Safety - Life Safety and Plan Review', 'Commercial building, blast mitigation, and emergency exit review'),
  ('SAFETY', 'Safety - Hazardous Materials and Cryogenic Safety', 'Liquid methane, oxygen, and high-pressure cryogenic safety'),
  ('VERMILION', 'Vermilion - Coastal Permitting and Police Jury', 'Local development permits and public hearing coordination'),
  ('VERMILION', 'Vermilion - Public Works and Drainage', 'Parish canal crossings, culvert sizing, and roadway impacts'),
  ('USACE', 'USACE - Federal Water and Wetlands Review', 'Federal waterway, wetlands, and navigation concurrence')
) AS seed(org_code, name, description)
JOIN public.organizations organization ON organization.code = seed.org_code AND organization.active
ON CONFLICT (org_code, name) DO UPDATE
SET organization_id = EXCLUDED.organization_id,
    description = EXCLUDED.description,
    active = true,
    updated_at = now();

INSERT INTO public.assignment_group_memberships (assignment_group_id, user_id, role)
SELECT group_record.id, membership.user_id,
  CASE WHEN membership.role IN ('supervisor', 'organization_admin', 'system_admin') THEN 'lead' ELSE 'member' END
FROM public.assignment_groups group_record
JOIN public.organization_memberships membership
  ON membership.organization_id = group_record.organization_id
 AND membership.status = 'active'
ON CONFLICT (assignment_group_id, user_id) DO UPDATE
SET role = EXCLUDED.role, updated_at = now();

UPDATE public.workstreams workstream
SET assignment_group_id = group_record.id,
    assigned_org_code = group_record.org_code
FROM public.assignment_groups group_record
WHERE workstream.assignment_group_id IS NULL
  AND (
    (workstream.code ILIKE '%WETLAND%' AND group_record.org_code = 'CPRA' AND group_record.name = 'CPRA - Coastal Use and Hydrology Permitting')
    OR (workstream.code ILIKE '%HEAVYHAUL%' AND group_record.org_code = 'DOTD' AND group_record.name = 'DOTD - Structures and Bridge Review')
    OR (workstream.code ILIKE '%WATER%' AND group_record.org_code = 'LDEQ' AND group_record.name = 'LDEQ - Water Quality and Deluge Permitting')
    OR (workstream.code ILIKE '%COMMUNITY%' AND group_record.org_code = 'VERMILION' AND group_record.name = 'Vermilion - Coastal Permitting and Police Jury')
    OR (workstream.code ILIKE '%AIRSPACE%' AND group_record.org_code = 'SAFETY' AND group_record.name = 'Safety - Hazardous Materials and Cryogenic Safety')
  );

UPDATE public.workstreams workstream
SET assignment_group_id = group_record.id,
    assigned_org_code = group_record.org_code
FROM public.assignment_groups group_record
WHERE workstream.assignment_group_id IS NULL
  AND group_record.org_code = 'STATEPO'
  AND group_record.name = 'Governors Project Office - Interagency Concierge';

UPDATE public.customer_requests request
SET assignment_group_id = group_record.id,
    itsm_state = CASE
      WHEN request.status = 'triage' THEN 'triaged'
      WHEN request.status = 'in_progress' THEN 'in_progress'
      WHEN request.status = 'resolved' THEN 'resolved'
      WHEN request.status = 'closed' THEN 'closed'
      WHEN request.status = 'draft' THEN 'draft'
      ELSE 'submitted'
    END,
    priority = CASE
      WHEN request.schedule_importance = 'critical' THEN 'P1'
      WHEN request.schedule_importance = 'high' THEN 'P2'
      WHEN request.schedule_importance = 'low' THEN 'P4'
      ELSE 'P3'
    END
FROM public.assignment_groups group_record
WHERE request.assignment_group_id IS NULL
  AND group_record.org_code = 'STATEPO'
  AND group_record.name = 'Governors Project Office - Executive Triage';

UPDATE public.tasks task
SET assignment_group_id = workstream.assignment_group_id,
    assigned_org_code = group_record.org_code,
    itsm_state = CASE
      WHEN task.status = 'completed' THEN 'closed'
      WHEN task.status = 'in_progress' THEN 'in_progress'
      WHEN task.status = 'blocked' THEN 'blocked'
      WHEN task.status = 'waiting' THEN 'pending_agency'
      ELSE 'submitted'
    END
FROM public.workstreams workstream
LEFT JOIN public.assignment_groups group_record ON group_record.id = workstream.assignment_group_id
WHERE task.workstream_id = workstream.id
  AND task.assignment_group_id IS NULL;

-- ---------------------------------------------------------------------------
-- RLS and grants. Remove all inherited policies on these tables first; RLS
-- policies are ORed, so retaining a permissive legacy policy is unsafe.
-- ---------------------------------------------------------------------------

ALTER TABLE public.assignment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
  policy_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'assignment_groups', 'assignment_group_memberships', 'customer_requests',
    'workstreams', 'tasks', 'audit_events', 'notifications'
  ] LOOP
    FOR policy_name IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_name, table_name);
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON TABLE public.assignment_groups, public.assignment_group_memberships,
  public.customer_requests, public.workstreams, public.tasks, public.audit_events,
  public.notifications FROM public, anon;
GRANT SELECT ON TABLE public.assignment_groups, public.assignment_group_memberships,
  public.customer_requests, public.workstreams, public.tasks, public.audit_events,
  public.notifications TO authenticated;
GRANT UPDATE (is_read) ON TABLE public.notifications TO authenticated;

CREATE POLICY assignment_groups_select ON public.assignment_groups
FOR SELECT TO authenticated
USING (
  active
  AND (
    (SELECT app_private.is_system_admin())
    OR (SELECT app_private.is_org_member(organization_id))
    OR EXISTS (
      SELECT 1
      FROM public.projects project_record
      LEFT JOIN public.project_participants participant ON participant.project_id = project_record.id
      WHERE (participant.organization_id = assignment_groups.organization_id
             OR project_record.lead_organization_id = assignment_groups.organization_id)
        AND (SELECT app_private.has_project_access(project_record.id))
    )
  )
);

CREATE POLICY assignment_group_memberships_select ON public.assignment_group_memberships
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT app_private.is_system_admin())
  OR EXISTS (
    SELECT 1
    FROM public.assignment_groups group_record
    WHERE group_record.id = assignment_group_id
      AND (SELECT app_private.is_organization_admin(group_record.organization_id))
  )
);

CREATE POLICY customer_requests_select ON public.customer_requests
FOR SELECT TO authenticated
USING (
  submitted_by_user_id = (SELECT auth.uid())
  OR (SELECT app_private.has_project_access_text(project_id))
  OR assigned_to_user_id = (SELECT auth.uid())
  OR (assignment_group_id IS NOT NULL AND (SELECT app_private.can_fulfill_group(assignment_group_id, (SELECT auth.uid()))))
);

CREATE POLICY workstreams_select ON public.workstreams
FOR SELECT TO authenticated
USING (project_id IS NOT NULL AND (SELECT app_private.has_project_access(project_id)));

CREATE POLICY tasks_select ON public.tasks
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workstreams workstream
    WHERE workstream.id = workstream_id
      AND workstream.project_id IS NOT NULL
      AND (SELECT app_private.has_project_access(workstream.project_id))
  )
);

CREATE POLICY audit_events_select ON public.audit_events
FOR SELECT TO authenticated
USING (
  actor_id = (SELECT auth.uid())
  OR (project_id IS NOT NULL AND (SELECT app_private.has_project_access_text(project_id)))
  OR (SELECT app_private.is_system_admin())
);

CREATE POLICY notifications_select ON public.notifications
FOR SELECT TO authenticated
USING (recipient_id = (SELECT auth.uid()) OR recipient_user_id = (SELECT auth.uid()));

CREATE POLICY notifications_update ON public.notifications
FOR UPDATE TO authenticated
USING (recipient_id = (SELECT auth.uid()) OR recipient_user_id = (SELECT auth.uid()))
WITH CHECK (recipient_id = (SELECT auth.uid()) OR recipient_user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- Tenant-aware ticket RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_assign_ticket(
  p_ticket_id TEXT,
  p_ticket_type TEXT,
  p_assignment_group_id UUID,
  p_assigned_to_user_id UUID DEFAULT NULL,
  p_assignment_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_group public.assignment_groups%ROWTYPE;
  v_ticket_id TEXT;
  v_project_ref TEXT;
  v_project_id UUID;
  v_old_group_id UUID;
  v_old_assignee_id UUID;
  v_actor_name TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'authentication required for ticket assignment'; END IF;
  IF p_ticket_type NOT IN ('customer_request', 'workstream', 'task') THEN RAISE EXCEPTION 'invalid ticket type: %', p_ticket_type; END IF;

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
  IF v_ticket_id IS NULL THEN RAISE EXCEPTION 'ticket not found: %', p_ticket_id; END IF;

  SELECT id INTO v_project_id FROM public.projects
  WHERE id::TEXT = v_project_ref OR number = v_project_ref LIMIT 1;
  SELECT * INTO v_group FROM public.assignment_groups WHERE id = p_assignment_group_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'assignment group not found or inactive: %', p_assignment_group_id; END IF;
  IF v_project_id IS NULL OR NOT (SELECT app_private.can_assign_group(v_group.id, v_project_id)) THEN
    RAISE EXCEPTION 'authenticated user cannot assign ticket % to group %', p_ticket_id, v_group.name;
  END IF;
  IF p_assigned_to_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.assignment_group_memberships
    WHERE assignment_group_id = v_group.id AND user_id = p_assigned_to_user_id
  ) THEN RAISE EXCEPTION 'assigned user is not a member of assignment group %', v_group.name; END IF;

  SELECT COALESCE(NULLIF(full_name, ''), 'Authorized Fulfiller') INTO v_actor_name
  FROM public.profiles WHERE id = v_actor_id;
  v_actor_name := COALESCE(v_actor_name, 'Authorized Fulfiller');

  IF p_ticket_type = 'customer_request' THEN
    UPDATE public.customer_requests SET assignment_group_id = v_group.id,
      assigned_to_user_id = p_assigned_to_user_id,
      itsm_state = CASE WHEN itsm_state IN ('draft', 'submitted') THEN 'triaged' ELSE itsm_state END,
      updated_at = v_now WHERE id = v_ticket_id;
  ELSIF p_ticket_type = 'workstream' THEN
    UPDATE public.workstreams SET assignment_group_id = v_group.id,
      assigned_to_user_id = p_assigned_to_user_id, assigned_org_code = v_group.org_code,
      updated_at = v_now WHERE id = v_ticket_id;
  ELSE
    UPDATE public.tasks SET assignment_group_id = v_group.id,
      assigned_to_user_id = p_assigned_to_user_id, assigned_org_code = v_group.org_code
      WHERE id = v_ticket_id;
  END IF;

  INSERT INTO public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason, project_id, created_at, occurred_at
  ) VALUES (
    v_actor_id, 'ticket_assigned', p_ticket_type, p_ticket_type, v_ticket_id, v_actor_name,
    v_group.org_code, 'assigned',
    jsonb_build_object('groupId', v_old_group_id, 'assigneeId', v_old_assignee_id)::TEXT,
    jsonb_build_object('groupId', v_group.id, 'groupName', v_group.name, 'assigneeId', p_assigned_to_user_id)::TEXT,
    p_assignment_notes, v_project_ref, v_now, v_now
  );

  IF p_assigned_to_user_id IS NOT NULL AND p_assigned_to_user_id <> v_actor_id THEN
    INSERT INTO public.notifications (
      recipient_id, recipient_user_id, user_id, title, body, message, event_type,
      type, link_url, urgency, metadata, channel, delivery_status, is_read, related_entity_id, created_at
    ) VALUES (
      p_assigned_to_user_id, p_assigned_to_user_id, p_assigned_to_user_id::TEXT,
      'Work assigned: ' || v_group.name,
      'You were assigned to ' || p_ticket_type || ' (' || v_ticket_id || ') by ' || v_actor_name,
      'You were assigned to ' || p_ticket_type || ' (' || v_ticket_id || ') by ' || v_actor_name,
      'assignment', 'assignment', '/work/' || v_ticket_id, 'action_required',
      jsonb_build_object('ticketId', v_ticket_id, 'ticketType', p_ticket_type, 'assignmentGroupId', v_group.id),
      'in_app', 'pending', false, v_ticket_id, v_now
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'ticketId', v_ticket_id,
    'ticketType', p_ticket_type, 'assignmentGroupId', v_group.id,
    'assignmentGroupName', v_group.name, 'assignedToUserId', p_assigned_to_user_id,
    'updatedAt', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_update_ticket_itsm_state(
  p_ticket_id TEXT,
  p_ticket_type TEXT,
  p_new_state TEXT,
  p_reason TEXT DEFAULT NULL,
  p_pause_reason TEXT DEFAULT NULL
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
  v_old_state TEXT;
  v_old_clock_status TEXT;
  v_old_clock_paused_at TIMESTAMPTZ;
  v_total_paused INTEGER := 0;
  v_now TIMESTAMPTZ := now();
  v_clock_status TEXT;
  v_clock_paused_at TIMESTAMPTZ;
  v_clock_paused_reason TEXT;
  v_actor_name TEXT;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'authentication required for state transitions'; END IF;
  IF p_ticket_type NOT IN ('customer_request', 'workstream', 'task') THEN RAISE EXCEPTION 'invalid ticket type: %', p_ticket_type; END IF;
  IF p_new_state NOT IN ('draft', 'submitted', 'triaged', 'in_progress', 'pending_customer', 'pending_agency', 'blocked', 'resolved', 'closed') THEN RAISE EXCEPTION 'invalid ITSM state: %', p_new_state; END IF;

  IF p_ticket_type = 'customer_request' THEN
    SELECT id, project_id, itsm_state, clock_status, clock_paused_at, clock_total_paused_seconds
      INTO v_ticket_id, v_project_ref, v_old_state, v_old_clock_status, v_old_clock_paused_at, v_total_paused
    FROM public.customer_requests WHERE id = p_ticket_id OR confirmation_number = p_ticket_id FOR UPDATE;
  ELSIF p_ticket_type = 'workstream' THEN
    SELECT id, project_id::TEXT, itsm_state, clock_status, clock_paused_at, clock_total_paused_seconds
      INTO v_ticket_id, v_project_ref, v_old_state, v_old_clock_status, v_old_clock_paused_at, v_total_paused
    FROM public.workstreams WHERE id = p_ticket_id OR code = p_ticket_id FOR UPDATE;
  ELSE
    SELECT task.id, workstream.project_id::TEXT, task.itsm_state, task.clock_status, task.clock_paused_at, task.clock_total_paused_seconds
      INTO v_ticket_id, v_project_ref, v_old_state, v_old_clock_status, v_old_clock_paused_at, v_total_paused
    FROM public.tasks task JOIN public.workstreams workstream ON workstream.id = task.workstream_id
    WHERE task.id = p_ticket_id FOR UPDATE;
  END IF;
  IF v_ticket_id IS NULL THEN RAISE EXCEPTION 'ticket not found: %', p_ticket_id; END IF;
  IF NOT (SELECT app_private.can_mutate_ticket(v_ticket_id, p_ticket_type)) THEN RAISE EXCEPTION 'authenticated user cannot update ticket %', p_ticket_id; END IF;

  v_total_paused := COALESCE(v_total_paused, 0);
  IF p_new_state IN ('pending_customer', 'pending_agency', 'blocked') THEN
    v_clock_status := 'paused';
    v_clock_paused_at := COALESCE(v_old_clock_paused_at, v_now);
    v_clock_paused_reason := COALESCE(p_pause_reason, p_reason, 'Waiting for the next required response');
  ELSIF p_new_state IN ('resolved', 'closed') THEN
    v_clock_status := 'stopped';
    IF v_old_clock_status = 'paused' AND v_old_clock_paused_at IS NOT NULL THEN
      v_total_paused := v_total_paused + GREATEST(EXTRACT(EPOCH FROM v_now - v_old_clock_paused_at)::INTEGER, 0);
    END IF;
  ELSE
    v_clock_status := 'active';
    IF v_old_clock_status = 'paused' AND v_old_clock_paused_at IS NOT NULL THEN
      v_total_paused := v_total_paused + GREATEST(EXTRACT(EPOCH FROM v_now - v_old_clock_paused_at)::INTEGER, 0);
    END IF;
  END IF;

  IF p_ticket_type = 'customer_request' THEN
    UPDATE public.customer_requests SET itsm_state = p_new_state,
      status = CASE WHEN p_new_state = 'draft' THEN 'draft' WHEN p_new_state = 'submitted' THEN 'submitted'
        WHEN p_new_state = 'triaged' THEN 'triage' WHEN p_new_state IN ('in_progress', 'pending_customer', 'pending_agency', 'blocked') THEN 'in_progress'
        WHEN p_new_state = 'resolved' THEN 'resolved' WHEN p_new_state = 'closed' THEN 'closed' ELSE status END,
      clock_status = v_clock_status,
      clock_paused_at = CASE WHEN v_clock_status = 'paused' THEN v_clock_paused_at ELSE NULL END,
      clock_paused_reason = CASE WHEN v_clock_status = 'paused' THEN v_clock_paused_reason ELSE NULL END,
      clock_total_paused_seconds = v_total_paused, updated_at = v_now WHERE id = v_ticket_id;
  ELSIF p_ticket_type = 'workstream' THEN
    UPDATE public.workstreams SET itsm_state = p_new_state,
      operational_state = CASE WHEN p_new_state = 'blocked' THEN 'blocked' WHEN p_new_state = 'pending_customer' THEN 'waiting_applicant'
        WHEN p_new_state = 'pending_agency' THEN 'waiting_government' WHEN p_new_state IN ('resolved', 'closed') THEN 'complete' ELSE 'running' END,
      operational_state_label = CASE WHEN p_new_state = 'blocked' THEN 'Blocked (Action Required)' WHEN p_new_state = 'pending_customer' THEN 'Waiting on Applicant'
        WHEN p_new_state = 'pending_agency' THEN 'Waiting on Government' WHEN p_new_state = 'resolved' THEN 'Resolved' WHEN p_new_state = 'closed' THEN 'Closed' ELSE 'In Progress' END,
      clock_status = v_clock_status,
      clock_paused_at = CASE WHEN v_clock_status = 'paused' THEN v_clock_paused_at ELSE NULL END,
      clock_paused_reason = CASE WHEN v_clock_status = 'paused' THEN v_clock_paused_reason ELSE NULL END,
      clock_total_paused_seconds = v_total_paused,
      actual_completion_date = CASE WHEN p_new_state IN ('resolved', 'closed') THEN COALESCE(actual_completion_date, CURRENT_DATE) ELSE actual_completion_date END,
      updated_at = v_now WHERE id = v_ticket_id;
  ELSE
    UPDATE public.tasks SET itsm_state = p_new_state,
      status = CASE WHEN p_new_state = 'blocked' THEN 'blocked' WHEN p_new_state IN ('pending_customer', 'pending_agency') THEN 'waiting'
        WHEN p_new_state IN ('resolved', 'closed') THEN 'completed' WHEN p_new_state = 'in_progress' THEN 'in_progress' ELSE 'pending' END,
      clock_status = v_clock_status,
      clock_paused_at = CASE WHEN v_clock_status = 'paused' THEN v_clock_paused_at ELSE NULL END,
      clock_paused_reason = CASE WHEN v_clock_status = 'paused' THEN v_clock_paused_reason ELSE NULL END,
      clock_total_paused_seconds = v_total_paused WHERE id = v_ticket_id;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), 'Authorized Fulfiller') INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
  INSERT INTO public.audit_events (actor_id, action, resource_type, entity_type, entity_id, actor_name, action_type, old_value, new_value, reason, project_id, created_at, occurred_at)
  VALUES (v_actor_id, 'itsm_state_transition', p_ticket_type, p_ticket_type, v_ticket_id,
    COALESCE(v_actor_name, 'Authorized Fulfiller'), 'status_changed', v_old_state, p_new_state, p_reason, v_project_ref, v_now, v_now);

  RETURN jsonb_build_object('success', true, 'ticketId', v_ticket_id, 'ticketType', p_ticket_type,
    'oldState', v_old_state, 'newState', p_new_state, 'clockStatus', v_clock_status,
    'totalPausedSeconds', v_total_paused, 'updatedAt', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_set_ticket_priority(
  p_ticket_id TEXT,
  p_ticket_type TEXT,
  p_priority TEXT,
  p_reason TEXT DEFAULT NULL
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
  v_old_priority TEXT;
  v_actor_name TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'authentication required to set priority'; END IF;
  IF p_ticket_type NOT IN ('customer_request', 'workstream', 'task') OR p_priority NOT IN ('P1', 'P2', 'P3', 'P4') THEN RAISE EXCEPTION 'invalid ticket type or priority'; END IF;
  IF p_ticket_type = 'customer_request' THEN
    SELECT id, project_id, priority INTO v_ticket_id, v_project_ref, v_old_priority FROM public.customer_requests WHERE id = p_ticket_id OR confirmation_number = p_ticket_id FOR UPDATE;
  ELSIF p_ticket_type = 'workstream' THEN
    SELECT id, project_id::TEXT, priority INTO v_ticket_id, v_project_ref, v_old_priority FROM public.workstreams WHERE id = p_ticket_id OR code = p_ticket_id FOR UPDATE;
  ELSE
    SELECT task.id, workstream.project_id::TEXT, task.priority INTO v_ticket_id, v_project_ref, v_old_priority FROM public.tasks task JOIN public.workstreams workstream ON workstream.id = task.workstream_id WHERE task.id = p_ticket_id FOR UPDATE;
  END IF;
  IF v_ticket_id IS NULL OR NOT (SELECT app_private.can_mutate_ticket(v_ticket_id, p_ticket_type)) THEN RAISE EXCEPTION 'authenticated user cannot update ticket %', p_ticket_id; END IF;
  IF p_ticket_type = 'customer_request' THEN UPDATE public.customer_requests SET priority = p_priority, updated_at = v_now WHERE id = v_ticket_id;
  ELSIF p_ticket_type = 'workstream' THEN UPDATE public.workstreams SET priority = p_priority, updated_at = v_now WHERE id = v_ticket_id;
  ELSE UPDATE public.tasks SET priority = p_priority WHERE id = v_ticket_id;
  END IF;
  SELECT COALESCE(NULLIF(full_name, ''), 'Authorized Fulfiller') INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
  INSERT INTO public.audit_events (actor_id, action, resource_type, entity_type, entity_id, actor_name, action_type, old_value, new_value, reason, project_id, created_at, occurred_at)
  VALUES (v_actor_id, 'ticket_priority_updated', p_ticket_type, p_ticket_type, v_ticket_id,
    COALESCE(v_actor_name, 'Authorized Fulfiller'), 'priority_changed', v_old_priority, p_priority, p_reason, v_project_ref, v_now, v_now);
  RETURN jsonb_build_object('success', true, 'ticketId', v_ticket_id, 'ticketType', p_ticket_type,
    'oldPriority', v_old_priority, 'newPriority', p_priority, 'updatedAt', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_manage_assignment_group(
  p_id UUID DEFAULT NULL,
  p_org_code TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_lead_user_id UUID DEFAULT NULL,
  p_active BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_group public.assignment_groups%ROWTYPE;
  v_org_id UUID;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_id IS NULL THEN
    IF NULLIF(trim(p_org_code), '') IS NULL OR NULLIF(trim(p_name), '') IS NULL THEN RAISE EXCEPTION 'organization code and group name are required'; END IF;
    SELECT id INTO v_org_id FROM public.organizations WHERE code = upper(trim(p_org_code));
    IF v_org_id IS NULL OR NOT (SELECT app_private.is_organization_admin(v_org_id)) THEN RAISE EXCEPTION 'organization administrator capability required'; END IF;
    INSERT INTO public.assignment_groups (org_code, organization_id, name, description, lead_user_id, active, created_at, updated_at)
    VALUES (upper(trim(p_org_code)), v_org_id, trim(p_name), NULLIF(trim(p_description), ''), p_lead_user_id, COALESCE(p_active, true), v_now, v_now)
    RETURNING * INTO v_group;
  ELSE
    SELECT * INTO v_group FROM public.assignment_groups WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR NOT (SELECT app_private.is_organization_admin(v_group.organization_id)) THEN RAISE EXCEPTION 'organization administrator capability required'; END IF;
    UPDATE public.assignment_groups SET name = COALESCE(NULLIF(trim(p_name), ''), name),
      description = COALESCE(NULLIF(trim(p_description), ''), description),
      lead_user_id = COALESCE(p_lead_user_id, lead_user_id), active = COALESCE(p_active, active), updated_at = v_now
    WHERE id = p_id RETURNING * INTO v_group;
  END IF;
  RETURN jsonb_build_object('id', v_group.id, 'orgCode', v_group.org_code,
    'organizationId', v_group.organization_id, 'name', v_group.name, 'description', v_group.description,
    'leadUserId', v_group.lead_user_id, 'active', v_group.active, 'updatedAt', v_group.updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_manage_assignment_group_membership(
  p_assignment_group_id UUID,
  p_user_id UUID,
  p_role TEXT DEFAULT 'member',
  p_action TEXT DEFAULT 'upsert'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_group public.assignment_groups%ROWTYPE;
  v_membership public.assignment_group_memberships%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_action NOT IN ('upsert', 'delete') OR p_role NOT IN ('member', 'lead', 'backup') THEN RAISE EXCEPTION 'invalid membership action or role'; END IF;
  SELECT * INTO v_group FROM public.assignment_groups WHERE id = p_assignment_group_id FOR UPDATE;
  IF NOT FOUND OR NOT (SELECT app_private.is_organization_admin(v_group.organization_id)) THEN RAISE EXCEPTION 'organization administrator capability required'; END IF;
  IF p_action = 'delete' THEN
    DELETE FROM public.assignment_group_memberships WHERE assignment_group_id = p_assignment_group_id AND user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'action', 'deleted');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_memberships WHERE organization_id = v_group.organization_id AND user_id = p_user_id AND status = 'active') THEN RAISE EXCEPTION 'group member must be an active organization member'; END IF;
  INSERT INTO public.assignment_group_memberships (assignment_group_id, user_id, role)
  VALUES (p_assignment_group_id, p_user_id, p_role)
  ON CONFLICT (assignment_group_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now()
  RETURNING * INTO v_membership;
  RETURN jsonb_build_object('id', v_membership.id, 'assignmentGroupId', v_membership.assignment_group_id,
    'userId', v_membership.user_id, 'role', v_membership.role, 'updatedAt', v_membership.updated_at);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_assign_ticket(TEXT, TEXT, UUID, UUID, TEXT) FROM public, anon;
REVOKE ALL ON FUNCTION public.rpc_update_ticket_itsm_state(TEXT, TEXT, TEXT, TEXT, TEXT) FROM public, anon;
REVOKE ALL ON FUNCTION public.rpc_set_ticket_priority(TEXT, TEXT, TEXT, TEXT) FROM public, anon;
REVOKE ALL ON FUNCTION public.rpc_manage_assignment_group(UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN) FROM public, anon;
REVOKE ALL ON FUNCTION public.rpc_manage_assignment_group_membership(UUID, UUID, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_assign_ticket(TEXT, TEXT, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_update_ticket_itsm_state(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_ticket_priority(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_manage_assignment_group(UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_manage_assignment_group_membership(UUID, UUID, TEXT, TEXT) TO authenticated;
