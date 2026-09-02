import type { DocumentRecord } from "./domain-models";
import type { OperationalWorkItem } from "./operational-ux";

function withPreferredVersion(document: DocumentRecord, preferredVersionId?: string): DocumentRecord {
  if (!preferredVersionId || document.versions[0]?.id === preferredVersionId) return document;

  const preferredVersion = document.versions.find((version) => version.id === preferredVersionId);
  if (!preferredVersion) return document;

  return {
    ...document,
    versions: [preferredVersion, ...document.versions.filter((version) => version.id !== preferredVersionId)],
  };
}

function documentForAttachment(documents: DocumentRecord[], attachmentId: string): DocumentRecord | undefined {
  return documents.find(
    (document) =>
      document.id === attachmentId ||
      document.versions.some((version) => version.id === attachmentId),
  );
}

/**
 * Resolves the real document records shown on a work-item detail page.
 *
 * Review assignments carry a version ID, while older request/workstream
 * records may only carry a document ID. Both must resolve back to the
 * authoritative document list before view/download actions are wired.
 */
export function resolveWorkItemDocuments(
  item: OperationalWorkItem,
  documents: DocumentRecord[],
): DocumentRecord[] {
  const resolved: DocumentRecord[] = [];

  const add = (document: DocumentRecord | undefined, preferredVersionId?: string) => {
    if (!document || resolved.some((entry) => entry.id === document.id)) return;
    resolved.push(withPreferredVersion(document, preferredVersionId));
  };

  add(item.sourceDocument, item.exactDocumentVersionId);

  for (const attachment of item.documents) {
    const document = documentForAttachment(documents, attachment.id);
    const preferredVersionId = document?.versions.some((version) => version.id === attachment.id)
      ? attachment.id
      : undefined;
    add(document, preferredVersionId);
  }

  if (item.workstreamId) {
    for (const document of documents) {
      if (
        document.workstreamId === item.workstreamId ||
        document.agencyReviews.some((review) => review.workstreamId === item.workstreamId)
      ) {
        add(document);
      }
    }
  }

  return resolved;
}
