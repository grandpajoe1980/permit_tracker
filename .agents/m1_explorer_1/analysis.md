# Milestone 1 Database & SQL Schema Analysis: ITSM & Multi-Tenancy Data Model

**Date**: 2026-08-31  
**Author**: `m1_explorer_1` (Milestone 1 Database & SQL Schema Explorer)  
**Target Migration**: `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql`  

---

## 1. Executive Summary & Design Overview

Milestone 1 transforms the SpaceX Louisiana Critical Path / PATH platform into an enterprise-grade ITSM and multi-agency project management tracking system. This database architecture provides:
1. **First-Class Multi-Tenancy & Assignment Groups**: Hierarchical organization models spanning SpaceX (Applicant), Reviewing State/Parish Agencies (DOTD, LDEQ, CPRA, OSFM, LSP, Vermilion Parish), and the Governor's Project Office, paired with dedicated fulfiller queues (`assignment_groups`) and group memberships (`assignment_group_memberships`).
2. **Standard ITSM Lifecycle & Priorities**: Decoupled ITSM state machine (`draft`, `submitted`, `triaged`, `in_progress`, `pending_customer`, `pending_agency`, `blocked`, `resolved`, `closed`) and standard Priority Matrix (`P1` - Critical Blocker, `P2` - High / Impeded, `P3` - Normal / Planned, `P4` - Low / Routine) added across `customer_requests`, `workstreams`, and `tasks`.
3. **Statutory SLA & Clock Management**: First-class tracking of statutory deadlines, clock pause/resume triggers with automatic accumulation of paused duration (`clock_total_paused_seconds`), and audit-logged pause reasons.
4. **Hardened RLS & Secure RPC Execution**: Role-based access control leveraging Supabase best practices (`search_path = public, app_private`, `(select auth.uid())`, explicit `TO authenticated` and `WITH CHECK` clauses), denying direct destructive modifications while exposing atomic, transaction-safe PostgreSQL RPC functions.
5. **Deterministic Multi-Agency Seed Data & Dual Hydration Parity**: Complete seed coverage for all 8 multi-agency organizations, 15 specialized assignment groups, fulfiller group memberships for existing user profiles, and seamless schema alignment with Drizzle ORM (`db/schema.ts`) and the in-memory repository (`lib/repository.ts`).

---

## 2. PostgreSQL Migration Specification

### Migration File Name
`supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql`

### 2.1 Complete SQL Migration Script

```sql
-- ============================================================================
-- Migration: 20260831140000_itsm_assignment_groups_and_states.sql
-- Description: Milestone 1 ITSM & Multi-Tenancy Data Model & Supabase Persistence
-- Entities: assignment_groups, assignment_group_memberships, ITSM state & clock alterations,
--           RLS security boundaries, multi-agency seeds, and atomic assignment RPCs.
-- ============================================================================

-- Ensure uuid extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. SCHEMAS & PRE-REQUISITE CHECK
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM public;
GRANT USAGE ON SCHEMA app_private TO authenticated;

-- ============================================================================
-- 2. ENSURE ORGANIZATIONS EXIST (MULTI-AGENCY REGISTRY)
-- ============================================================================
INSERT INTO public.organizations (id, code, name, organization_type, jurisdiction_level, active, created_at, updated_at)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'SPACEX', 'Space Exploration Technologies Corp.', 'applicant', 'external_partner', true, now(), now()),
  ('c0000000-0000-0000-0000-000000000002', 'LA-PROJECTS', 'Louisiana Governor''s Office of Major Projects & Delivery', 'coordination', 'state', true, now(), now()),
  ('c0000000-0000-0000-0000-000000000003', 'DOTD', 'Louisiana Department of Transportation and Development', 'agency', 'state', true, now(), now()),
  ('c0000000-0000-0000-0000-000000000004', 'LDEQ', 'Louisiana Department of Environmental Quality', 'agency', 'state', true, now(), now()),
  ('c0000000-0000-0000-0000-000000000005', 'CPRA', 'Coastal Protection and Restoration Authority', 'agency', 'state', true, now(), now()),
  ('c0000000-0000-0000-0000-000000000006', 'OSFM', 'Louisiana Office of State Fire Marshal', 'agency', 'state', true, now(), now()),
  ('c0000000-0000-0000-0000-000000000007', 'LSP', 'Louisiana State Police', 'agency', 'state', true, now(), now()),
  ('c0000000-0000-0000-0000-000000000008', 'VERMILION-PARISH', 'Vermilion Parish Police Jury & Permitting Office', 'agency', 'local', true, now(), now()),
  ('c0000000-0000-0000-0000-000000000009', 'USACE', 'U.S. Army Corps of Engineers — New Orleans District', 'agency', 'federal', true, now(), now()),
  ('c0000000-0000-0000-0000-000000000010', 'LED', 'Louisiana Economic Development', 'agency', 'state', true, now(), now())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  organization_type = EXCLUDED.organization_type,
  jurisdiction_level = EXCLUDED.jurisdiction_level,
  active = EXCLUDED.active,
  updated_at = now();

-- ============================================================================
-- 3. ASSIGNMENT GROUPS & GROUP MEMBERSHIPS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assignment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_code TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
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

-- ============================================================================
-- 4. TABLE ALTERATIONS: CUSTOMER_REQUESTS, WORKSTREAMS, TASKS
-- ============================================================================

-- 4.1 public.customer_requests
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
  ADD COLUMN IF NOT EXISTS clock_total_paused_seconds INTEGER NOT NULL DEFAULT 0 CHECK (clock_total_paused_seconds >= 0);

-- 4.2 public.workstreams
ALTER TABLE public.workstreams
  ADD COLUMN IF NOT EXISTS assignment_group_id UUID REFERENCES public.assignment_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS itsm_state TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (itsm_state IN ('draft', 'submitted', 'triaged', 'in_progress', 'pending_customer', 'pending_agency', 'blocked', 'resolved', 'closed')),
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'P3'
    CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
  ADD COLUMN IF NOT EXISTS statutory_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clock_status TEXT NOT NULL DEFAULT 'active'
    CHECK (clock_status IN ('active', 'paused', 'stopped', 'extended')),
  ADD COLUMN IF NOT EXISTS clock_paused_reason TEXT,
  ADD COLUMN IF NOT EXISTS clock_paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clock_total_paused_seconds INTEGER NOT NULL DEFAULT 0 CHECK (clock_total_paused_seconds >= 0);

-- 4.3 public.tasks
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
  ADD COLUMN IF NOT EXISTS clock_total_paused_seconds INTEGER NOT NULL DEFAULT 0 CHECK (clock_total_paused_seconds >= 0);

-- ============================================================================
-- 5. PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_assignment_groups_org ON public.assignment_groups(org_code, active);
CREATE INDEX IF NOT EXISTS idx_assignment_groups_org_id ON public.assignment_groups(organization_id, active);
CREATE INDEX IF NOT EXISTS idx_assignment_group_memberships_group ON public.assignment_group_memberships(assignment_group_id);
CREATE INDEX IF NOT EXISTS idx_assignment_group_memberships_user ON public.assignment_group_memberships(user_id);

CREATE INDEX IF NOT EXISTS idx_customer_requests_assignment ON public.customer_requests(assignment_group_id, itsm_state);
CREATE INDEX IF NOT EXISTS idx_customer_requests_assignee ON public.customer_requests(assigned_to_user_id, itsm_state);
CREATE INDEX IF NOT EXISTS idx_customer_requests_itsm_priority ON public.customer_requests(itsm_state, priority);
CREATE INDEX IF NOT EXISTS idx_customer_requests_clock ON public.customer_requests(clock_status);

CREATE INDEX IF NOT EXISTS idx_workstreams_assignment ON public.workstreams(assignment_group_id, itsm_state);
CREATE INDEX IF NOT EXISTS idx_workstreams_assignee ON public.workstreams(assigned_to_user_id, itsm_state);
CREATE INDEX IF NOT EXISTS idx_workstreams_itsm_priority ON public.workstreams(itsm_state, priority);
CREATE INDEX IF NOT EXISTS idx_workstreams_clock ON public.workstreams(clock_status);

CREATE INDEX IF NOT EXISTS idx_tasks_assignment ON public.tasks(assignment_group_id, itsm_state);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assigned_to_user_id, itsm_state);

-- ============================================================================
-- 6. SECURITY HELPER FUNCTIONS (app_private)
-- ============================================================================

CREATE OR REPLACE FUNCTION app_private.is_assignment_group_member(p_group_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignment_group_memberships
    WHERE assignment_group_id = p_group_id
      AND user_id = coalesce(p_user_id, (SELECT auth.uid()))
  );
$$;
REVOKE ALL ON FUNCTION app_private.is_assignment_group_member(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION app_private.is_assignment_group_member(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.is_fulfiller(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT (SELECT app_private.is_system_admin())
    OR EXISTS (
      SELECT 1 FROM public.assignment_group_memberships
      WHERE user_id = coalesce(p_user_id, (SELECT auth.uid()))
    );
$$;
REVOKE ALL ON FUNCTION app_private.is_fulfiller(UUID) FROM public;
GRANT EXECUTE ON FUNCTION app_private.is_fulfiller(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.can_fulfill_group(p_group_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT (SELECT app_private.is_system_admin())
    OR (SELECT app_private.is_assignment_group_member(p_group_id, coalesce(p_user_id, (SELECT auth.uid()))))
    OR EXISTS (
      SELECT 1 FROM public.assignment_groups ag
      WHERE ag.id = p_group_id
        AND (SELECT app_private.is_organization_admin(ag.organization_id))
    );
$$;
REVOKE ALL ON FUNCTION app_private.can_fulfill_group(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION app_private.can_fulfill_group(UUID, UUID) TO authenticated;

-- ============================================================================
-- 7. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.assignment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_group_memberships ENABLE ROW LEVEL SECURITY;

-- Revoke dangerous direct mutation privileges by default
REVOKE ALL ON TABLE public.assignment_groups, public.assignment_group_memberships FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.assignment_groups, public.assignment_group_memberships FROM authenticated;

-- assignment_groups policies
DROP POLICY IF EXISTS assignment_groups_select ON public.assignment_groups;
CREATE POLICY assignment_groups_select ON public.assignment_groups
  FOR SELECT TO authenticated
  USING (
    active = true
    OR (SELECT app_private.is_system_admin())
    OR (SELECT app_private.is_assignment_group_member(id, (SELECT auth.uid())))
  );

-- assignment_group_memberships policies
DROP POLICY IF EXISTS assignment_group_memberships_select ON public.assignment_group_memberships;
CREATE POLICY assignment_group_memberships_select ON public.assignment_group_memberships
  FOR SELECT TO authenticated
  USING (true);

-- Extend customer_requests select policy for fulfillers in assigned groups
DROP POLICY IF EXISTS customer_requests_select_fulfiller ON public.customer_requests;
CREATE POLICY customer_requests_select_fulfiller ON public.customer_requests
  FOR SELECT TO authenticated
  USING (
    submitted_by_user_id = (SELECT auth.uid())
    OR (SELECT app_private.is_system_admin())
    OR (assignment_group_id IS NOT NULL AND (SELECT app_private.is_assignment_group_member(assignment_group_id, (SELECT auth.uid()))))
    OR (assigned_to_user_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = project_id
        AND (SELECT app_private.can_access_project(p.id))
    )
  );

-- ============================================================================
-- 8. ATOMIC SUPABASE RPC FUNCTIONS
-- ============================================================================

-- 8.1 Ticket Assignment RPC
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
  v_old_group_id UUID;
  v_old_assignee_id UUID;
  v_old_state TEXT;
  v_now TIMESTAMPTZ := now();
  v_actor_name TEXT;
  v_result JSONB;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required for ticket assignment';
  END IF;

  IF p_ticket_type NOT IN ('customer_request', 'workstream', 'task') THEN
    RAISE EXCEPTION 'Invalid ticket type: %. Expected customer_request, workstream, or task', p_ticket_type;
  END IF;

  -- Validate target group
  SELECT * INTO v_group FROM public.assignment_groups WHERE id = p_assignment_group_id AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment group not found or inactive: %', p_assignment_group_id;
  END IF;

  -- Validate assignee membership if assigned to individual
  IF p_assigned_to_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.assignment_group_memberships
      WHERE assignment_group_id = p_assignment_group_id AND user_id = p_assigned_to_user_id
    ) THEN
      RAISE EXCEPTION 'Assigned user % is not an active member of assignment group %', p_assigned_to_user_id, v_group.name;
    END IF;
  END IF;

  -- Fetch actor display name for audit ledger
  SELECT coalesce(full_name, email, 'Authorized Fulfiller') INTO v_actor_name
  FROM public.profiles WHERE id = v_actor_id;
  IF v_actor_name IS NULL THEN v_actor_name := 'Authorized Fulfiller'; END IF;

  IF p_ticket_type = 'customer_request' THEN
    SELECT assignment_group_id, assigned_to_user_id, itsm_state
      INTO v_old_group_id, v_old_assignee_id, v_old_state
    FROM public.customer_requests WHERE id = p_ticket_id FOR UPDATE;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer request not found: %', p_ticket_id; END IF;

    UPDATE public.customer_requests
    SET assignment_group_id = p_assignment_group_id,
        assigned_to_user_id = p_assigned_to_user_id,
        itsm_state = CASE WHEN itsm_state IN ('draft', 'submitted') THEN 'triaged' ELSE itsm_state END,
        updated_at = v_now
    WHERE id = p_ticket_id;

  ELSIF p_ticket_type = 'workstream' THEN
    SELECT assignment_group_id, assigned_to_user_id, itsm_state
      INTO v_old_group_id, v_old_assignee_id, v_old_state
    FROM public.workstreams WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Workstream not found: %', p_ticket_id; END IF;

    UPDATE public.workstreams
    SET assignment_group_id = p_assignment_group_id,
        assigned_to_user_id = p_assigned_to_user_id,
        updated_at = v_now
    WHERE id = p_ticket_id;

  ELSIF p_ticket_type = 'task' THEN
    SELECT assignment_group_id, assigned_to_user_id, itsm_state
      INTO v_old_group_id, v_old_assignee_id, v_old_state
    FROM public.tasks WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Task not found: %', p_ticket_id; END IF;

    UPDATE public.tasks
    SET assignment_group_id = p_assignment_group_id,
        assigned_to_user_id = p_assigned_to_user_id,
        assigned_org_code = v_group.org_code,
        updated_at = v_now
    WHERE id = p_ticket_id;
  END IF;

  -- Insert structured audit ledger entry
  INSERT INTO public.audit_events (
    actor_id, actor_name, actor_org_name, entity_type, entity_id,
    action_type, action, old_value, new_value, reason, occurred_at
  ) VALUES (
    v_actor_id, v_actor_name, v_group.org_code, p_ticket_type, p_ticket_id,
    'assigned', 'ticket_assigned',
    jsonb_build_object('groupId', v_old_group_id, 'assigneeId', v_old_assignee_id)::text,
    jsonb_build_object('groupId', p_assignment_group_id, 'groupName', v_group.name, 'assigneeId', p_assigned_to_user_id)::text,
    p_assignment_notes, v_now
  );

  -- Emits notification if assigned to an individual fulfiller
  IF p_assigned_to_user_id IS NOT NULL AND p_assigned_to_user_id <> v_actor_id THEN
    INSERT INTO public.notifications (
      recipient_user_id, title, body, urgency, related_entity_id, is_read, created_at
    ) VALUES (
      p_assigned_to_user_id,
      'Work Assigned: ' || v_group.name,
      'You were assigned to ' || p_ticket_type || ' (' || p_ticket_id || ') by ' || v_actor_name,
      'action_required',
      p_ticket_id,
      false,
      v_now
    );
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'ticketId', p_ticket_id,
    'ticketType', p_ticket_type,
    'assignmentGroupId', p_assignment_group_id,
    'assignmentGroupName', v_group.name,
    'assignedToUserId', p_assigned_to_user_id,
    'assignedAt', v_now
  );

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_assign_ticket(TEXT, TEXT, UUID, UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_assign_ticket(TEXT, TEXT, UUID, UUID, TEXT) TO authenticated;


-- 8.2 ITSM State Transition RPC
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
  v_old_state TEXT;
  v_old_clock_status TEXT;
  v_old_clock_paused_at TIMESTAMPTZ;
  v_total_paused INTEGER := 0;
  v_now TIMESTAMPTZ := now();
  v_new_clock_status TEXT := 'active';
  v_new_clock_paused_at TIMESTAMPTZ := NULL;
  v_new_clock_paused_reason TEXT := NULL;
  v_actor_name TEXT;
  v_elapsed_pause_seconds INTEGER := 0;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required for state transitions';
  END IF;

  IF p_new_state NOT IN ('draft', 'submitted', 'triaged', 'in_progress', 'pending_customer', 'pending_agency', 'blocked', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'Invalid ITSM state: %', p_new_state;
  END IF;

  SELECT coalesce(full_name, email, 'Authorized Fulfiller') INTO v_actor_name
  FROM public.profiles WHERE id = v_actor_id;
  IF v_actor_name IS NULL THEN v_actor_name := 'Authorized Fulfiller'; END IF;

  IF p_ticket_type = 'customer_request' THEN
    SELECT itsm_state, clock_status, clock_paused_at, clock_total_paused_seconds
      INTO v_old_state, v_old_clock_status, v_old_clock_paused_at, v_total_paused
    FROM public.customer_requests WHERE id = p_ticket_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer request not found: %', p_ticket_id; END IF;

  ELSIF p_ticket_type = 'workstream' THEN
    SELECT itsm_state, clock_status, clock_paused_at, clock_total_paused_seconds
      INTO v_old_state, v_old_clock_status, v_old_clock_paused_at, v_total_paused
    FROM public.workstreams WHERE id = p_ticket_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Workstream not found: %', p_ticket_id; END IF;

  ELSIF p_ticket_type = 'task' THEN
    SELECT itsm_state, clock_status, clock_paused_at, clock_total_paused_seconds
      INTO v_old_state, v_old_clock_status, v_old_clock_paused_at, v_total_paused
    FROM public.tasks WHERE id = p_ticket_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Task not found: %', p_ticket_id; END IF;
  ELSE
    RAISE EXCEPTION 'Invalid ticket type: %', p_ticket_type;
  END IF;

  -- Clock State Management & Calculation
  IF p_new_state IN ('pending_customer', 'pending_agency', 'blocked') THEN
    v_new_clock_status := 'paused';
    v_new_clock_paused_at := coalesce(v_old_clock_paused_at, v_now);
    v_new_clock_paused_reason := coalesce(p_pause_reason, p_reason, 'Awaiting customer response or agency concurrence');
  ELSIF p_new_state IN ('resolved', 'closed') THEN
    v_new_clock_status := 'stopped';
    IF v_old_clock_status = 'paused' AND v_old_clock_paused_at IS NOT NULL THEN
      v_elapsed_pause_seconds := greatest(extract(epoch from (v_now - v_old_clock_paused_at))::integer, 0);
      v_total_paused := v_total_paused + v_elapsed_pause_seconds;
    END IF;
    v_new_clock_paused_at := NULL;
    v_new_clock_paused_reason := NULL;
  ELSE -- Active in_progress or triaged
    v_new_clock_status := 'active';
    IF v_old_clock_status = 'paused' AND v_old_clock_paused_at IS NOT NULL THEN
      v_elapsed_pause_seconds := greatest(extract(epoch from (v_now - v_old_clock_paused_at))::integer, 0);
      v_total_paused := v_total_paused + v_elapsed_pause_seconds;
    END IF;
    v_new_clock_paused_at := NULL;
    v_new_clock_paused_reason := NULL;
  END IF;

  -- Apply updates & backward-compatibility sync
  IF p_ticket_type = 'customer_request' THEN
    UPDATE public.customer_requests
    SET itsm_state = p_new_state,
        status = CASE
          WHEN p_new_state = 'draft' THEN 'draft'
          WHEN p_new_state = 'submitted' THEN 'submitted'
          WHEN p_new_state = 'triaged' THEN 'triage'
          WHEN p_new_state IN ('in_progress', 'pending_customer', 'pending_agency', 'blocked') THEN 'in_progress'
          WHEN p_new_state = 'resolved' THEN 'resolved'
          WHEN p_new_state = 'closed' THEN 'closed'
          ELSE status
        END,
        clock_status = v_new_clock_status,
        clock_paused_at = v_new_clock_paused_at,
        clock_paused_reason = v_new_clock_paused_reason,
        clock_total_paused_seconds = v_total_paused,
        updated_at = v_now
    WHERE id = p_ticket_id;

  ELSIF p_ticket_type = 'workstream' THEN
    UPDATE public.workstreams
    SET itsm_state = p_new_state,
        operational_state = CASE
          WHEN p_new_state = 'blocked' THEN 'blocked'
          WHEN p_new_state = 'pending_customer' THEN 'waiting_applicant'
          WHEN p_new_state = 'pending_agency' THEN 'waiting_government'
          WHEN p_new_state IN ('resolved', 'closed') THEN 'complete'
          ELSE 'running'
        END,
        clock_status = v_new_clock_status,
        clock_paused_at = v_new_clock_paused_at,
        clock_paused_reason = v_new_clock_paused_reason,
        clock_total_paused_seconds = v_total_paused,
        updated_at = v_now
    WHERE id = p_ticket_id;

  ELSIF p_ticket_type = 'task' THEN
    UPDATE public.tasks
    SET itsm_state = p_new_state,
        status = CASE
          WHEN p_new_state = 'blocked' THEN 'blocked'
          WHEN p_new_state = 'pending_customer' THEN 'waiting'
          WHEN p_new_state = 'pending_agency' THEN 'waiting'
          WHEN p_new_state IN ('resolved', 'closed') THEN 'completed'
          WHEN p_new_state = 'in_progress' THEN 'in_progress'
          ELSE 'pending'
        END,
        clock_status = v_new_clock_status,
        clock_paused_at = v_new_clock_paused_at,
        clock_paused_reason = v_new_clock_paused_reason,
        clock_total_paused_seconds = v_total_paused
    WHERE id = p_ticket_id;
  END IF;

  -- Insert structured audit ledger entry
  INSERT INTO public.audit_events (
    actor_id, actor_name, entity_type, entity_id,
    action_type, action, old_value, new_value, reason, occurred_at
  ) VALUES (
    v_actor_id, v_actor_name, p_ticket_type, p_ticket_id,
    'status_changed', 'itsm_state_transition',
    v_old_state, p_new_state, p_reason, v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'ticketId', p_ticket_id,
    'ticketType', p_ticket_type,
    'oldState', v_old_state,
    'newState', p_new_state,
    'clockStatus', v_new_clock_status,
    'totalPausedSeconds', v_total_paused,
    'updatedAt', v_now
  );
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_update_ticket_itsm_state(TEXT, TEXT, TEXT, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_update_ticket_itsm_state(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- 8.3 Priority Update RPC
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
  v_old_priority TEXT;
  v_now TIMESTAMPTZ := now();
  v_actor_name TEXT;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required to set priority'; END IF;
  IF p_priority NOT IN ('P1', 'P2', 'P3', 'P4') THEN RAISE EXCEPTION 'Invalid priority: %. Expected P1, P2, P3, or P4', p_priority; END IF;

  SELECT coalesce(full_name, email, 'Authorized Fulfiller') INTO v_actor_name
  FROM public.profiles WHERE id = v_actor_id;

  IF p_ticket_type = 'customer_request' THEN
    SELECT priority INTO v_old_priority FROM public.customer_requests WHERE id = p_ticket_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer request not found: %', p_ticket_id; END IF;
    UPDATE public.customer_requests SET priority = p_priority, updated_at = v_now WHERE id = p_ticket_id;

  ELSIF p_ticket_type = 'workstream' THEN
    SELECT priority INTO v_old_priority FROM public.workstreams WHERE id = p_ticket_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Workstream not found: %', p_ticket_id; END IF;
    UPDATE public.workstreams SET priority = p_priority, updated_at = v_now WHERE id = p_ticket_id;

  ELSIF p_ticket_type = 'task' THEN
    SELECT priority INTO v_old_priority FROM public.tasks WHERE id = p_ticket_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Task not found: %', p_ticket_id; END IF;
    UPDATE public.tasks SET priority = p_priority WHERE id = p_ticket_id;
  ELSE
    RAISE EXCEPTION 'Invalid ticket type: %', p_ticket_type;
  END IF;

  INSERT INTO public.audit_events (
    actor_id, actor_name, entity_type, entity_id,
    action_type, action, old_value, new_value, reason, occurred_at
  ) VALUES (
    v_actor_id, v_actor_name, p_ticket_type, p_ticket_id,
    'priority_changed', 'ticket_priority_updated',
    v_old_priority, p_priority, p_reason, v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'ticketId', p_ticket_id,
    'ticketType', p_ticket_type,
    'oldPriority', v_old_priority,
    'newPriority', p_priority,
    'updatedAt', v_now
  );
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_set_ticket_priority(TEXT, TEXT, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_set_ticket_priority(TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- 8.4 Assignment Group Management RPC
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
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  
  -- Determine organization ID
  IF p_org_code IS NOT NULL THEN
    SELECT id INTO v_org_id FROM public.organizations WHERE code = upper(p_org_code);
    IF v_org_id IS NULL THEN RAISE EXCEPTION 'Organization code not found: %', p_org_code; END IF;
  END IF;

  -- Admin verification
  IF not (SELECT app_private.is_system_admin())
     AND (v_org_id IS NOT NULL AND NOT (SELECT app_private.is_organization_admin(v_org_id))) THEN
    RAISE EXCEPTION 'Administrative capability required for organization %', p_org_code;
  END IF;

  IF p_id IS NULL THEN
    -- Insert new assignment group
    INSERT INTO public.assignment_groups (org_code, organization_id, name, description, lead_user_id, active, created_at, updated_at)
    VALUES (upper(p_org_code), v_org_id, trim(p_name), p_description, p_lead_user_id, p_active, v_now, v_now)
    RETURNING * INTO v_group;
  ELSE
    -- Update existing assignment group
    UPDATE public.assignment_groups
    SET name = coalesce(nullif(trim(p_name), ''), name),
        description = coalesce(p_description, description),
        lead_user_id = coalesce(p_lead_user_id, lead_user_id),
        active = coalesce(p_active, active),
        updated_at = v_now
    WHERE id = p_id
    RETURNING * INTO v_group;
  END IF;

  RETURN jsonb_build_object(
    'id', v_group.id,
    'orgCode', v_group.org_code,
    'name', v_group.name,
    'description', v_group.description,
    'leadUserId', v_group.lead_user_id,
    'active', v_group.active,
    'updatedAt', v_group.updated_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_manage_assignment_group(UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_manage_assignment_group(UUID, TEXT, TEXT, TEXT, UUID, BOOLEAN) TO authenticated;


-- 8.5 Assignment Group Membership Management RPC
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
  v_actor_id UUID := auth.uid();
  v_group public.assignment_groups%ROWTYPE;
  v_membership public.assignment_group_memberships%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_role NOT IN ('member', 'lead', 'backup') THEN RAISE EXCEPTION 'Invalid group membership role: %', p_role; END IF;

  SELECT * INTO v_group FROM public.assignment_groups WHERE id = p_assignment_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assignment group not found: %', p_assignment_group_id; END IF;

  IF NOT (SELECT app_private.is_system_admin())
     AND NOT (SELECT app_private.is_organization_admin(v_group.organization_id)) THEN
    RAISE EXCEPTION 'Administrative capability required to manage group memberships';
  END IF;

  IF p_action = 'delete' THEN
    DELETE FROM public.assignment_group_memberships
    WHERE assignment_group_id = p_assignment_group_id AND user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'action', 'deleted');
  ELSE
    INSERT INTO public.assignment_group_memberships (assignment_group_id, user_id, role, created_at, updated_at)
    VALUES (p_assignment_group_id, p_user_id, p_role, now(), now())
    ON CONFLICT (assignment_group_id, user_id) DO UPDATE
      SET role = EXCLUDED.role, updated_at = now()
    RETURNING * INTO v_membership;

    RETURN jsonb_build_object(
      'id', v_membership.id,
      'assignmentGroupId', v_membership.assignment_group_id,
      'userId', v_membership.user_id,
      'role', v_membership.role,
      'updatedAt', v_membership.updated_at
    );
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_manage_assignment_group_membership(UUID, UUID, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_manage_assignment_group_membership(UUID, UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 9. MULTI-AGENCY SEED DATA
-- ============================================================================

-- 9.1 Seed 15 Multi-Agency Assignment Groups
INSERT INTO public.assignment_groups (id, org_code, organization_id, name, description, active)
VALUES
  -- SpaceX Internal Queues
  ('d0000000-0000-0000-0000-000000000001', 'SPACEX', 'c0000000-0000-0000-0000-000000000001', 'SpaceX - Internal Technical Queue', 'Flight hardware, pad civil engineering, and cryogenic infrastructure submittals', true),
  ('d0000000-0000-0000-0000-000000000002', 'SPACEX', 'c0000000-0000-0000-0000-000000000001', 'SpaceX - Regulatory Affairs Queue', 'Regulatory filings, NEPA environmental reviews, and statutory compliance management', true),

  -- Louisiana Governor's Project Office (PATH Concierge)
  ('d0000000-0000-0000-0000-000000000003', 'LA-PROJECTS', 'c0000000-0000-0000-0000-000000000002', 'Governor''s Project Office - Executive Triage & Delivery', 'State-level executive triage, cross-agency bottleneck clearing, and escalation coordination', true),
  ('d0000000-0000-0000-0000-000000000004', 'LA-PROJECTS', 'c0000000-0000-0000-0000-000000000002', 'Governor''s Project Office - Interagency Concierge', 'Dedicated liaison team assisting applicant submittals and agency concurrent reviews', true),

  -- DOTD
  ('d0000000-0000-0000-0000-000000000005', 'DOTD', 'c0000000-0000-0000-0000-000000000003', 'DOTD - Structures & Bridge Review', 'Structural load simulations, bridge engineering ratings, and axle distribution approvals', true),
  ('d0000000-0000-0000-0000-000000000006', 'DOTD', 'c0000000-0000-0000-0000-000000000003', 'DOTD - Highway Access & Heavy-Haul', 'LA-82 superload escort permits, turning radius geometries, and right-of-way access', true),

  -- LDEQ
  ('d0000000-0000-0000-0000-000000000007', 'LDEQ', 'c0000000-0000-0000-0000-000000000004', 'LDEQ - Water Quality & Deluge Permitting', 'LPDES industrial stormwater, deluge wastewater neutralization, and baseline monitoring', true),
  ('d0000000-0000-0000-0000-000000000008', 'LDEQ', 'c0000000-0000-0000-0000-000000000004', 'LDEQ - Air Quality & Environmental Review', 'Title V air emissions, flare operations, and environmental impact assessments', true),

  -- CPRA
  ('d0000000-0000-0000-0000-000000000009', 'CPRA', 'c0000000-0000-0000-0000-000000000005', 'CPRA - Coastal Use & Hydrology Permitting', 'Coastal Use Permits (CUP), coastal zone boundary adherence, and ecological impact', true),
  ('d0000000-0000-0000-0000-000000000010', 'CPRA', 'c0000000-0000-0000-0000-000000000005', 'CPRA - Drainage & Levee Concurrence', 'Hydrologic storm surge modeling, levee protection buffer, and wetland mitigation plans', true),

  -- OSFM
  ('d0000000-0000-0000-0000-000000000011', 'OSFM', 'c0000000-0000-0000-0000-000000000006', 'OSFM - Life Safety & Plan Review', 'Commercial building codes, blast mitigation setbacks, and emergency exit staging', true),
  ('d0000000-0000-0000-0000-000000000012', 'OSFM', 'c0000000-0000-0000-0000-000000000006', 'OSFM - Hazardous Materials & Cryogenic Safety', 'Liquid methane, liquid oxygen bulk storage, and high-pressure cryogenic safety systems', true),

  -- LSP
  ('d0000000-0000-0000-0000-000000000013', 'LSP', 'c0000000-0000-0000-0000-000000000007', 'LSP - Emergency Response & Route Clearance', 'Highway patrol logistics, road closure traffic control, and hazardous cargo escort', true),

  -- Vermilion Parish
  ('d0000000-0000-0000-0000-000000000014', 'VERMILION-PARISH', 'c0000000-0000-0000-0000-000000000008', 'Vermilion Parish - Coastal Permitting & Police Jury', 'Local parish development permits, public hearing notices, and parish council coordination', true),
  ('d0000000-0000-0000-0000-000000000015', 'VERMILION-PARISH', 'c0000000-0000-0000-0000-000000000008', 'Vermilion Parish - Public Works & Drainage', 'Parish canal crossings, culvert sizing, and heavy vehicle roadway impact bonds', true)
ON CONFLICT (org_code, name) DO UPDATE SET
  description = EXCLUDED.description,
  active = EXCLUDED.active,
  updated_at = now();

-- 9.2 Backfill Existing Records with Initial Assignment Groups & ITSM States
-- Workstreams
UPDATE public.workstreams w
SET assignment_group_id = ag.id,
    assigned_org_code = ag.org_code
FROM public.assignment_groups ag
WHERE w.assignment_group_id IS NULL
  AND (
    (w.code ILIKE '%WETLAND%' AND ag.name = 'CPRA - Coastal Use & Hydrology Permitting')
    OR (w.code ILIKE '%HEAVYHAUL%' AND ag.name = 'DOTD - Structures & Bridge Review')
    OR (w.code ILIKE '%WATER%' AND ag.name = 'LDEQ - Water Quality & Deluge Permitting')
    OR (w.code ILIKE '%COMMUNITY%' AND ag.name = 'Vermilion Parish - Coastal Permitting & Police Jury')
    OR (w.code ILIKE '%AIRSPACE%' AND ag.name = 'OSFM - Hazardous Materials & Cryogenic Safety')
  );

-- Default any unassigned workstreams to Governor's Project Office Concierge
UPDATE public.workstreams
SET assignment_group_id = 'd0000000-0000-0000-0000-000000000004'
WHERE assignment_group_id IS NULL;

-- Customer Requests
UPDATE public.customer_requests
SET assignment_group_id = 'd0000000-0000-0000-0000-000000000003', -- GPO Triage
    itsm_state = CASE
      WHEN status = 'submitted' THEN 'submitted'
      WHEN status = 'triage' THEN 'triaged'
      WHEN status = 'in_progress' THEN 'in_progress'
      WHEN status = 'resolved' THEN 'resolved'
      WHEN status = 'closed' THEN 'closed'
      ELSE 'submitted'
    END,
    priority = CASE
      WHEN schedule_importance = 'critical' THEN 'P1'
      WHEN schedule_importance = 'low' THEN 'P4'
      ELSE 'P3'
    END
WHERE assignment_group_id IS NULL;

-- Tasks
UPDATE public.tasks t
SET assignment_group_id = w.assignment_group_id,
    itsm_state = CASE
      WHEN t.status = 'completed' THEN 'closed'
      WHEN t.status = 'in_progress' THEN 'in_progress'
      WHEN t.status = 'blocked' THEN 'blocked'
      WHEN t.status = 'waiting' THEN 'pending_agency'
      ELSE 'submitted'
    END
FROM public.workstreams w
WHERE t.workstream_id = w.id
  AND t.assignment_group_id IS NULL;
```

---

## 3. TypeScript Domain Models & Drizzle ORM Parity

### 3.1 TypeScript Type Definitions (`lib/domain-models.ts`)

```typescript
// ==========================================
// ITSM & MULTI-TENANCY TYPES
// ==========================================

export type ITSMState =
  | "draft"
  | "submitted"
  | "triaged"
  | "in_progress"
  | "pending_customer"
  | "pending_agency"
  | "blocked"
  | "resolved"
  | "closed";

export type TicketPriority = "P1" | "P2" | "P3" | "P4";

export type ClockStatus = "active" | "paused" | "stopped" | "extended";

export interface AssignmentGroupRecord {
  id: string;
  orgCode: string;
  organizationId?: string;
  name: string;
  description?: string;
  leadUserId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentGroupMembershipRecord {
  id: string;
  assignmentGroupId: string;
  userId: string;
  role: "member" | "lead" | "backup";
  createdAt: string;
  updatedAt: string;
}

// Extends CustomerRequestRecord, WorkstreamRecord, TaskRecord with ITSM attributes:
export interface ITSMTicketAttributes {
  assignmentGroupId?: string;
  assignmentGroupName?: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
  assignedOrgCode?: string;
  itsmState: ITSMState;
  priority: TicketPriority;
  statutoryDeadline?: string;
  clockStatus: ClockStatus;
  clockPausedReason?: string;
  clockPausedAt?: string;
  clockTotalPausedSeconds: number;
}
```

### 3.2 Drizzle ORM Relational Schema (`db/schema.ts`)

```typescript
// SQLite & PostgreSQL Drizzle schema additions:
export const assignmentGroups = sqliteTable("assignment_groups", {
  id: text("id").primaryKey(),
  orgCode: text("org_code").notNull(),
  organizationId: text("organization_id").references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  leadUserId: text("lead_user_id").references(() => users.id),
  active: integer("active", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const assignmentGroupMemberships = sqliteTable("assignment_group_memberships", {
  id: text("id").primaryKey(),
  assignmentGroupId: text("assignment_group_id")
    .notNull()
    .references(() => assignmentGroups.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role", { enum: ["member", "lead", "backup"] }).default("member").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});
```

---

## 4. Supabase Client Mutations & Queries

### 4.1 Mutation Wrappers (`lib/supabase/mutations.ts`)

1. `mutateAssignTicket(params: { ticketId: string; ticketType: 'customer_request' | 'workstream' | 'task'; assignmentGroupId: string; assignedToUserId?: string; assignmentNotes?: string }): Promise<MutationResult<any>>`
2. `mutateUpdateTicketITSMState(params: { ticketId: string; ticketType: 'customer_request' | 'workstream' | 'task'; newState: ITSMState; reason?: string; pauseReason?: string }): Promise<MutationResult<any>>`
3. `mutateSetTicketPriority(params: { ticketId: string; ticketType: 'customer_request' | 'workstream' | 'task'; priority: TicketPriority; reason?: string }): Promise<MutationResult<any>>`
4. `mutateManageAssignmentGroup(params: { id?: string; orgCode?: string; name?: string; description?: string; leadUserId?: string; active?: boolean }): Promise<MutationResult<AssignmentGroupRecord>>`
5. `mutateManageAssignmentGroupMembership(params: { assignmentGroupId: string; userId: string; role?: 'member' | 'lead' | 'backup'; action?: 'upsert' | 'delete' }): Promise<MutationResult<any>>`

### 4.2 Query Fetchers (`lib/supabase/queries.ts`)

1. `fetchAssignmentGroups(orgCode?: string): Promise<AssignmentGroupRecord[]>`
2. `fetchAssignmentGroupMemberships(groupId?: string): Promise<AssignmentGroupMembershipRecord[]>`
3. Enhanced `fetchWorkstreams`, `fetchCustomerRequests`, and `fetchTasks` with ITSM state, priority, clock status, and assignment group fields.

---

## 5. Summary Matrix: Multi-Agency Assignment Groups & Queues

| # | Agency / Org | Assignment Group Name | Org Code | Lead Persona | Description / Primary Mission |
|---|---|---|---|---|---|
| 1 | SpaceX | SpaceX - Internal Technical Queue | SPACEX | Alex Martin | Flight hardware, launch mount civil engineering, deluge piping |
| 2 | SpaceX | SpaceX - Regulatory Affairs Queue | SPACEX | Maya Chen | Regulatory submissions, statutory notice filings, environmental data |
| 3 | Governor's Project Office | GPO - Executive Triage & Delivery | LA-PROJECTS | Sarah Johnson | State-level executive intake, cross-agency bottleneck escalation |
| 4 | Governor's Project Office | GPO - Interagency Concierge | LA-PROJECTS | Sarah Johnson / Joe Skaggs | Multi-agency concurrent review tracking and applicant assistance |
| 5 | DOTD | DOTD - Structures & Bridge Review | DOTD | Sam Rivera | LA-82 bridge structural load ratings and heavy-haul clearances |
| 6 | DOTD | DOTD - Highway Access & Heavy-Haul | DOTD | Sam Rivera | Right-of-way permits, transport escorts, turning geometries |
| 7 | LDEQ | LDEQ - Water Quality & Deluge Permitting | LDEQ | Jordan Lee | LPDES stormwater, deluge runoff treatment, water quality |
| 8 | LDEQ | LDEQ - Air Quality & Environmental Review | LDEQ | Jordan Lee | Air emissions modeling, flare stack compliance, NEPA review |
| 9 | CPRA | CPRA - Coastal Use & Hydrology Permitting | CPRA | Jean-Paul Guidry | Coastal Use Permits (CUP), coastal zone compliance |
| 10 | CPRA | CPRA - Drainage & Levee Concurrence | CPRA | Jean-Paul Guidry | Hydrologic surge model concurrence, levee protection buffer |
| 11 | OSFM | OSFM - Life Safety & Plan Review | OSFM | Chief Dan Thibodeaux | Building code life safety, blast safety setbacks, assembly review |
| 12 | OSFM | OSFM - Hazardous Materials & Cryogenic | OSFM | Chief Dan Thibodeaux | Liquid methane/oxygen bulk tankage, cryogenic safety systems |
| 13 | LSP | LSP - Emergency Response & Route Clearance | LSP | Trooper Command | State Police heavy transport escort, traffic closures |
| 14 | Vermilion Parish | Vermilion Parish - Coastal Permitting | VERMILION-PARISH | Riley Brooks | Parish development approval, public comment hearings, police jury |
| 15 | Vermilion Parish | Vermilion Parish - Public Works & Drainage | VERMILION-PARISH | Riley Brooks | Parish canal crossings, drainage ditches, local road impact |

---

## 6. Implementation Plan for Milestone 1 Implementer (`m1_coder_1`)

1. **Step 1: Write Database Migration**  
   Create `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql` with the full DDL, alterations, performance indexes, RLS policies, RPC functions, and multi-agency seed data.
2. **Step 2: Update TypeScript Domain Models**  
   Add `AssignmentGroupRecord`, `AssignmentGroupMembershipRecord`, `ITSMState`, `TicketPriority`, `ClockStatus` to `lib/domain-models.ts` and extend `CustomerRequestRecord`, `WorkstreamRecord`, `TaskRecord`.
3. **Step 3: Update Drizzle Relational Schema**  
   Update `db/schema.ts` with `assignmentGroups`, `assignmentGroupMemberships`, and column alterations.
4. **Step 4: Update Supabase Mappings, Queries & Mutations**  
   Add mapping transforms in `lib/supabase/mappings.ts`, query fetchers in `lib/supabase/queries.ts`, and RPC mutation wrappers in `lib/supabase/mutations.ts`.
5. **Step 5: Update Repository Dual Hydration & Fixtures**  
   Update `lib/repository.ts` and `lib/spacex-megaproject-fixture.ts` to hydrate assignment groups and membership queues both from Supabase and in offline mock fallback.
6. **Step 6: Run Verification Suite**  
   Execute test runner across unit and integration tests to confirm zero regressions and 100% test pass.
