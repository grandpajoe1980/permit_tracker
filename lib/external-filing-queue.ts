import type { DocumentRecord, DocumentVersionRecord, ExternalFilingRecord, WorkstreamRecord } from "@/lib/domain-models";

export type ExternalFilingQueue = "needs_verification" | "reconciled" | "all";

export function latestFilingCheck(filing: ExternalFilingRecord) {
  return filing.statusChecks?.[0];
}

export function filingHasStatusMismatch(filing: ExternalFilingRecord): boolean {
  const latest = latestFilingCheck(filing);
  return Boolean(latest && latest.previousStatus !== latest.verifiedStatus);
}

export function filterExternalFilings(
  filings: ExternalFilingRecord[],
  queue: ExternalFilingQueue,
): ExternalFilingRecord[] {
  if (queue === "needs_verification") return filings.filter((filing) => !filing.lastStatusVerifiedAt);
  if (queue === "reconciled") return filings.filter(filingHasStatusMismatch);
  return filings;
}

export function linkedFilingWorkstream(
  filing: ExternalFilingRecord,
  workstreams: WorkstreamRecord[],
): WorkstreamRecord | undefined {
  if (!filing.workstreamId) return undefined;
  return workstreams.find((workstream) => workstream.id === filing.workstreamId && workstream.projectId === filing.projectId);
}

export function receiptVersionsForFiling(
  filing: ExternalFilingRecord,
  documents: DocumentRecord[],
): Array<{ document: DocumentRecord; version: DocumentVersionRecord }> {
  const receiptIds = new Set(filing.receiptDocumentVersionIds);
  return documents
    .filter((document) => document.projectId === filing.projectId)
    .flatMap((document) => document.versions
      .filter((version) => receiptIds.has(version.id))
      .map((version) => ({ document, version })));
}
