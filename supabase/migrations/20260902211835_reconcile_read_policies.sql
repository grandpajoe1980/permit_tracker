-- Reconcile the effective read surface after the historical permissive
-- policies were removed. This migration is intentionally forward-only.
--
-- Data API grants decide which roles can reach a relation; these policies then
-- decide which rows are visible. Keep both explicit so a new table cannot be
-- accidentally exposed by a default privilege.

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organizations', 'projects', 'permit_types', 'requirement_resources',
    'workflow_definitions', 'workflow_stages', 'workflow_versions',
    'workflow_version_stages', 'workstreams', 'tasks', 'task_dependencies',
    'coordination_requests', 'rfis', 'rfi_responses', 'documents',
    'document_versions', 'document_agency_reviews', 'commitments',
    'decisions', 'meetings', 'external_filings', 'project_participants'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM public, anon', table_name);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', table_name);
  END LOOP;
END;
$$;

-- Remove only policies owned by this reconciliation so the migration remains
-- safe to re-run in disposable environments and does not delete write/RPC
-- policies owned by other forward migrations.
DROP POLICY IF EXISTS organizations_read_authenticated ON public.organizations;
DROP POLICY IF EXISTS projects_read_authenticated ON public.projects;
DROP POLICY IF EXISTS permit_types_read_authenticated ON public.permit_types;
DROP POLICY IF EXISTS requirement_resources_read_authenticated ON public.requirement_resources;
DROP POLICY IF EXISTS workflow_definitions_read_authenticated ON public.workflow_definitions;
DROP POLICY IF EXISTS workflow_stages_read_authenticated ON public.workflow_stages;
DROP POLICY IF EXISTS workflow_versions_read_authenticated ON public.workflow_versions;
DROP POLICY IF EXISTS workflow_version_stages_read_authenticated ON public.workflow_version_stages;
DROP POLICY IF EXISTS workstreams_read_authenticated ON public.workstreams;
DROP POLICY IF EXISTS tasks_read_authenticated ON public.tasks;
DROP POLICY IF EXISTS task_dependencies_read_authenticated ON public.task_dependencies;
DROP POLICY IF EXISTS coordination_requests_read_authenticated ON public.coordination_requests;
DROP POLICY IF EXISTS rfis_read_authenticated ON public.rfis;
DROP POLICY IF EXISTS rfi_responses_read_authenticated ON public.rfi_responses;
DROP POLICY IF EXISTS documents_read_authenticated ON public.documents;
DROP POLICY IF EXISTS document_versions_read_authenticated ON public.document_versions;
DROP POLICY IF EXISTS document_reviews_read_authenticated ON public.document_agency_reviews;
DROP POLICY IF EXISTS commitments_read_authenticated ON public.commitments;
DROP POLICY IF EXISTS decisions_read_authenticated ON public.decisions;
DROP POLICY IF EXISTS meetings_read_authenticated ON public.meetings;
DROP POLICY IF EXISTS external_filings_read_authenticated ON public.external_filings;
DROP POLICY IF EXISTS project_participants_read_authenticated ON public.project_participants;

CREATE POLICY organizations_read_authenticated ON public.organizations
  FOR SELECT TO authenticated
  USING (active);

CREATE POLICY projects_read_authenticated ON public.projects
  FOR SELECT TO authenticated
  USING ((SELECT app_private.has_project_access(id)));

CREATE POLICY permit_types_read_authenticated ON public.permit_types
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY requirement_resources_read_authenticated ON public.requirement_resources
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY workflow_definitions_read_authenticated ON public.workflow_definitions
  FOR SELECT TO authenticated
  USING (
    (SELECT app_private.is_system_admin())
    OR (SELECT app_private.is_org_member(organization_id))
  );

CREATE POLICY workflow_stages_read_authenticated ON public.workflow_stages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workflow_definitions definition
      WHERE definition.id = workflow_id
        AND ((SELECT app_private.is_system_admin())
          OR (SELECT app_private.is_org_member(definition.organization_id)))
    )
  );

CREATE POLICY workflow_versions_read_authenticated ON public.workflow_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workflow_definitions definition
      WHERE definition.id = workflow_id
        AND ((SELECT app_private.is_system_admin())
          OR (SELECT app_private.is_org_member(definition.organization_id)))
    )
  );

CREATE POLICY workflow_version_stages_read_authenticated ON public.workflow_version_stages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workflow_versions version
      JOIN public.workflow_definitions definition ON definition.id = version.workflow_id
      WHERE version.id = workflow_version_id
        AND ((SELECT app_private.is_system_admin())
          OR (SELECT app_private.is_org_member(definition.organization_id)))
    )
  );

CREATE POLICY workstreams_read_authenticated ON public.workstreams
  FOR SELECT TO authenticated
  USING (project_id IS NOT NULL AND (SELECT app_private.has_project_access(project_id)));

CREATE POLICY tasks_read_authenticated ON public.tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workstreams workstream
      WHERE workstream.id = workstream_id
        AND workstream.project_id IS NOT NULL
        AND (SELECT app_private.has_project_access(workstream.project_id))
    )
  );

CREATE POLICY task_dependencies_read_authenticated ON public.task_dependencies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks successor
      JOIN public.workstreams workstream ON workstream.id = successor.workstream_id
      WHERE successor.id = successor_task_id
        AND workstream.project_id IS NOT NULL
        AND (SELECT app_private.has_project_access(workstream.project_id))
    )
  );

CREATE POLICY coordination_requests_read_authenticated ON public.coordination_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workstreams workstream
      WHERE workstream.id = workstream_id
        AND (SELECT app_private.has_project_access(workstream.project_id))
    )
  );

CREATE POLICY rfis_read_authenticated ON public.rfis
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workstreams workstream
      WHERE workstream.id = workstream_id
        AND (SELECT app_private.has_project_access(workstream.project_id))
    )
  );

CREATE POLICY rfi_responses_read_authenticated ON public.rfi_responses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.rfis rfi
      JOIN public.workstreams workstream ON workstream.id = rfi.workstream_id
      WHERE rfi.id = rfi_id
        AND (SELECT app_private.has_project_access(workstream.project_id))
    )
  );

CREATE POLICY documents_read_authenticated ON public.documents
  FOR SELECT TO authenticated
  USING (
    (project_id IS NOT NULL AND (SELECT app_private.has_project_access(project_id)))
    OR (request_id IS NOT NULL AND (SELECT app_private.can_access_request(request_id)))
  );

CREATE POLICY document_versions_read_authenticated ON public.document_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.documents document_record
      WHERE document_record.id = document_id
        AND (
          (document_record.project_id IS NOT NULL AND (SELECT app_private.has_project_access(document_record.project_id)))
          OR (document_record.request_id IS NOT NULL AND (SELECT app_private.can_access_request(document_record.request_id)))
        )
    )
  );

CREATE POLICY document_reviews_read_authenticated ON public.document_agency_reviews
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.document_versions version
      JOIN public.documents document_record ON document_record.id = version.document_id
      WHERE version.id = document_version_id
        AND (
          (document_record.project_id IS NOT NULL AND (SELECT app_private.has_project_access(document_record.project_id)))
          OR (document_record.request_id IS NOT NULL AND (SELECT app_private.can_access_request(document_record.request_id)))
        )
    )
  );

CREATE POLICY commitments_read_authenticated ON public.commitments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workstreams workstream
      WHERE workstream.id = workstream_id
        AND (SELECT app_private.has_project_access(workstream.project_id))
    )
  );

CREATE POLICY decisions_read_authenticated ON public.decisions
  FOR SELECT TO authenticated
  USING (project_id IS NOT NULL AND (SELECT app_private.has_project_access(project_id)));

CREATE POLICY meetings_read_authenticated ON public.meetings
  FOR SELECT TO authenticated
  USING (project_id IS NOT NULL AND (SELECT app_private.has_project_access(project_id)));

CREATE POLICY external_filings_read_authenticated ON public.external_filings
  FOR SELECT TO authenticated
  USING ((SELECT app_private.has_project_access_text(project_id)));

CREATE POLICY project_participants_read_authenticated ON public.project_participants
  FOR SELECT TO authenticated
  USING ((SELECT app_private.has_project_access(project_id)));

-- Storage upsert and replacement paths require an UPDATE grant and policy in
-- addition to INSERT/SELECT. The application currently uses non-upsert
-- uploads, but keeping the boundary complete prevents future silent failures.
REVOKE ALL ON TABLE storage.objects FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage.objects TO authenticated;
DROP POLICY IF EXISTS path_documents_update_authenticated ON storage.objects;
CREATE POLICY path_documents_update_authenticated ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'path-documents'
    AND EXISTS (
      SELECT 1
      FROM public.documents document_record
      WHERE document_record.id::text = (storage.foldername(name))[1]
        AND (
          (document_record.project_id IS NOT NULL AND (SELECT app_private.has_project_access(document_record.project_id)))
          OR (document_record.request_id IS NOT NULL AND (SELECT app_private.can_access_request(document_record.request_id)))
        )
    )
  )
  WITH CHECK (
    bucket_id = 'path-documents'
    AND EXISTS (
      SELECT 1
      FROM public.documents document_record
      WHERE document_record.id::text = (storage.foldername(name))[1]
        AND (
          (document_record.project_id IS NOT NULL AND (SELECT app_private.has_project_access(document_record.project_id)))
          OR (document_record.request_id IS NOT NULL AND (SELECT app_private.can_access_request(document_record.request_id)))
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_tasks_workstream_id ON public.tasks(workstream_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_successor ON public.task_dependencies(successor_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_predecessor ON public.task_dependencies(predecessor_task_id);
CREATE INDEX IF NOT EXISTS idx_coordination_requests_workstream_id ON public.coordination_requests(workstream_id);
CREATE INDEX IF NOT EXISTS idx_rfis_workstream_id ON public.rfis(workstream_id);
CREATE INDEX IF NOT EXISTS idx_rfi_responses_rfi_id ON public.rfi_responses(rfi_id);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON public.documents(project_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON public.document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_reviews_version_id ON public.document_agency_reviews(document_version_id);
CREATE INDEX IF NOT EXISTS idx_commitments_workstream_id ON public.commitments(workstream_id);
CREATE INDEX IF NOT EXISTS idx_decisions_project_id ON public.decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON public.meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_external_filings_project_id ON public.external_filings(project_id);
CREATE INDEX IF NOT EXISTS idx_project_participants_project_id ON public.project_participants(project_id);
