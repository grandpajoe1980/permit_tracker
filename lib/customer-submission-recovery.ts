import type { CustomerRequestRecord, ExternalFilingRecord } from "./domain-models";

const STORAGE_KEY = "path-customer-submission-recovery-v1";

export type CustomerSubmissionFingerprintInput = Pick<
  CustomerRequestRecord,
  "projectId" | "requestType" | "title" | "description" | "requestedOutcome" | "locationOrAffectedArea" | "desiredDate" | "blocksActiveWork"
> & {
  knownAgencyCode?: string;
  permitTypeId?: string;
};

export type CustomerSubmissionRecovery = {
  version: 1;
  requestId: string;
  confirmationNumber: string;
  projectId: string;
  requestType: CustomerRequestRecord["requestType"];
  permitTypeId?: string;
  requestFingerprint: string;
  filingPending: boolean;
  externalReferenceNumber?: string;
  externalRecordUrl?: string;
  externalStatus?: ExternalFilingRecord["externalStatus"];
  submittedAt?: string;
};

export function customerSubmissionFingerprint(input: CustomerSubmissionFingerprintInput): string {
  return [
    input.projectId,
    input.requestType,
    input.title,
    input.description,
    input.requestedOutcome ?? "",
    input.locationOrAffectedArea ?? "",
    input.desiredDate ?? "",
    input.knownAgencyCode ?? "",
    input.permitTypeId ?? "",
    input.blocksActiveWork ? "critical" : "normal",
  ].map((value) => value.trim()).join("\u001f");
}

function isRecovery(value: unknown): value is CustomerSubmissionRecovery {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CustomerSubmissionRecovery>;
  return candidate.version === 1
    && typeof candidate.requestId === "string"
    && typeof candidate.confirmationNumber === "string"
    && typeof candidate.projectId === "string"
    && typeof candidate.requestType === "string"
    && typeof candidate.requestFingerprint === "string"
    && typeof candidate.filingPending === "boolean";
}

export function readCustomerSubmissionRecovery(): CustomerSubmissionRecovery | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isRecovery(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCustomerSubmissionRecovery(recovery: CustomerSubmissionRecovery): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(recovery));
  } catch {
    // A private browsing context may deny session storage. The database RPCs
    // still provide server-side idempotency when the browser cannot persist
    // this recovery hint.
  }
}

export function clearCustomerSubmissionRecovery(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures; the persisted request remains safe.
  }
}
