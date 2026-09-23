import type { CustomerRequestRecord, ExternalFilingRecord } from "./domain-models";

/** Match the actual filing/request IDs; a shared agency does not establish a relationship. */
export function filingForPermit(permitTypeId: string, filings: ExternalFilingRecord[]): ExternalFilingRecord | undefined {
  return filings
    .filter((filing) => filing.permitTypeId === permitTypeId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

export function requestForPermit(
  permitTypeId: string,
  filing: ExternalFilingRecord | undefined,
  requests: CustomerRequestRecord[],
): CustomerRequestRecord | undefined {
  if (filing) {
    return filing.customerRequestId
      ? requests.find((request) => request.id === filing.customerRequestId)
      : undefined;
  }
  return requests
    .filter((request) => request.knownPermitTypeId === permitTypeId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

/** Only render a navigable agency record when the stored URL is a secure web address. */
export function agencyRecordUrl(filing: ExternalFilingRecord | undefined): string | undefined {
  if (!filing?.externalRecordUrl) return undefined;
  try {
    const url = new URL(filing.externalRecordUrl);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
