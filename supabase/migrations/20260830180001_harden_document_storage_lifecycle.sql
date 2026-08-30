-- Keep every revision immutable at the metadata layer as well as in Storage.
CREATE UNIQUE INDEX IF NOT EXISTS document_versions_document_ref_version_uidx
  ON public.document_versions (document_ref_id, version_number);

-- Replace the initial permissive/duplicate Storage policies with one policy
-- per operation. Object paths begin with the UUID of their document row.
DROP POLICY IF EXISTS path_documents_read ON storage.objects;
DROP POLICY IF EXISTS path_documents_insert ON storage.objects;
DROP POLICY IF EXISTS path_documents_update ON storage.objects;
DROP POLICY IF EXISTS path_documents_delete ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;

CREATE POLICY path_documents_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'path-documents'
    AND EXISTS (
      SELECT 1
      FROM public.documents AS document
      WHERE document.id::text = (storage.foldername(name))[1]
        AND (
          (document.request_id IS NOT NULL AND (SELECT app_private.can_access_request(document.request_id)))
          OR (document.project_id IS NOT NULL AND (SELECT app_private.can_access_project(document.project_id)))
          OR (SELECT app_private.is_system_admin())
        )
    )
  );

CREATE POLICY path_documents_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'path-documents'
    AND EXISTS (
      SELECT 1
      FROM public.documents AS document
      WHERE document.id::text = (storage.foldername(name))[1]
        AND (
          (document.request_id IS NOT NULL AND (SELECT app_private.can_access_request(document.request_id)))
          OR (document.project_id IS NOT NULL AND (SELECT app_private.can_access_project(document.project_id)))
          OR (SELECT app_private.is_system_admin())
        )
    )
  );

CREATE POLICY path_documents_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'path-documents'
    AND EXISTS (
      SELECT 1
      FROM public.documents AS document
      WHERE document.id::text = (storage.foldername(name))[1]
        AND (
          (document.request_id IS NOT NULL AND (SELECT app_private.can_access_request(document.request_id)))
          OR (document.project_id IS NOT NULL AND (SELECT app_private.can_access_project(document.project_id)))
          OR (SELECT app_private.is_system_admin())
        )
    )
  );

-- The browser no longer uses upsert for immutable versions, so no UPDATE
-- policy is intentionally provided.

-- This RPC is part of the authenticated document workflow, not a public API.
REVOKE EXECUTE ON FUNCTION public.rpc_create_document_version(
  text, text, integer, text, text, text, text, bigint, text,
  text, text, text, text[], uuid, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_document_version(
  text, text, integer, text, text, text, text, bigint, text,
  text, text, text, text[], uuid, uuid
) TO authenticated, service_role;
