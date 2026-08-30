-- Versions created by the earlier browser fallback stored the document UUID
-- only in document_ref_id. Link those rows so project-scoped SELECT policies
-- can authorize and return the uploaded revision.
UPDATE public.document_versions AS version
SET document_id = document.id,
    project_id = COALESCE(version.project_id, document.project_id)
FROM public.documents AS document
WHERE version.document_ref_id = document.id::text
  AND (version.document_id IS NULL OR version.project_id IS NULL);

-- Keep the package's declared current version synchronized with its ledger.
UPDATE public.documents AS document
SET current_version_number = ledger.latest_version
FROM (
  SELECT document_id, max(version_number) AS latest_version
  FROM public.document_versions
  WHERE document_id IS NOT NULL
  GROUP BY document_id
) AS ledger
WHERE document.id = ledger.document_id
  AND document.current_version_number IS DISTINCT FROM ledger.latest_version;
