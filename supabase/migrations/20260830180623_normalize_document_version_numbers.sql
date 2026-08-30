-- The seed importer previously removed punctuation from labels (v4.1 -> 41,
-- v12.0 -> 120). Version numbers represent the major immutable revision; the
-- complete display label remains in version_label.
UPDATE public.document_versions
SET version_number = substring(version_label FROM '^[vV]?([0-9]+)')::integer
WHERE version_label ~ '^[vV]?[0-9]+'
  AND version_number IS DISTINCT FROM substring(version_label FROM '^[vV]?([0-9]+)')::integer;

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
