"use client";

import { useState } from "react";
import { BadgeCheck, ExternalLink, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DocumentRecord, ExternalFilingRecord, OrganizationMembershipRecord, OrganizationRecord, WorkstreamRecord } from "@/lib/domain-models";
import { canVerifyExternalFiling } from "@/lib/external-filing-access";
import { filterExternalFilings, filingHasStatusMismatch, latestFilingCheck, linkedFilingWorkstream, receiptVersionsForFiling, type ExternalFilingQueue } from "@/lib/external-filing-queue";

const statuses: Array<ExternalFilingRecord["externalStatus"]> = [
  "not_started", "draft", "submitted", "under_review", "additional_information", "approved", "denied", "closed",
];

function statusLabel(status: ExternalFilingRecord["externalStatus"]): string {
  return status.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function localDate(value?: string): string {
  if (!value) return "Not verified";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

type VerifyInput = {
  externalFilingId: string;
  verifiedStatus: ExternalFilingRecord["externalStatus"];
  sourceName: string;
  sourceUrl: string;
  verificationNote: string;
  verifiedByUserId: string;
  verifiedByName: string;
  verifiedByOrganizationId: string;
  verifiedByOrganizationName: string;
};

export function ExternalFilingVerificationPanel({
  filings,
  workstreams,
  documents,
  memberships,
  organizations,
  userId,
  actorName,
  customerSafe = false,
  onVerify,
  onDownloadReceipt,
}: {
  filings: ExternalFilingRecord[];
  workstreams: WorkstreamRecord[];
  documents: DocumentRecord[];
  memberships: OrganizationMembershipRecord[];
  organizations: OrganizationRecord[];
  userId: string;
  actorName: string;
  customerSafe?: boolean;
  onVerify: (input: VerifyInput) => Promise<string | null>;
  onDownloadReceipt?: (documentId: string, versionId: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, { status: ExternalFilingRecord["externalStatus"]; sourceName: string; sourceUrl: string; note: string }>>({});
  const [busyFilingId, setBusyFilingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [queue, setQueue] = useState<ExternalFilingQueue>("needs_verification");

  if (customerSafe || filings.length === 0) return null;

  const queueTabs: Array<{ id: ExternalFilingQueue; label: string }> = [
    { id: "needs_verification", label: "Needs verification" },
    { id: "reconciled", label: "Reconciled" },
    { id: "all", label: "All filings" },
  ];
  const visibleFilings = filterExternalFilings(filings, queue);

  function draftFor(filing: ExternalFilingRecord) {
    return drafts[filing.id] ?? {
      status: filing.externalStatus,
      sourceName: "",
      sourceUrl: filing.externalRecordUrl ?? "",
      note: "",
    };
  }

  function updateDraft(filing: ExternalFilingRecord, patch: Partial<ReturnType<typeof draftFor>>) {
    setDrafts((current) => ({ ...current, [filing.id]: { ...draftFor(filing), ...patch } }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>, filing: ExternalFilingRecord) {
    event.preventDefault();
    const draft = draftFor(filing);
    const authorityRef = filing.authorityOrganizationId.trim().toUpperCase();
    const authorityCode = authorityRef.replace(/^ORG-/, "");
    const organization = organizations.find((item) => item.id.toUpperCase() === authorityRef || item.code.toUpperCase() === authorityRef || item.code.toUpperCase() === authorityCode);
    if (!organization) {
      setErrors((current) => ({ ...current, [filing.id]: "The issuing authority is not mapped to an active organization. An administrator must correct the authority assignment before verification." }));
      return;
    }

    setBusyFilingId(filing.id);
    setSuccess(null);
    setErrors((current) => ({ ...current, [filing.id]: "" }));
    const error = await onVerify({
      externalFilingId: filing.id,
      verifiedStatus: draft.status,
      sourceName: draft.sourceName,
      sourceUrl: draft.sourceUrl,
      verificationNote: draft.note,
      verifiedByUserId: userId,
      verifiedByName: actorName,
      verifiedByOrganizationId: organization.id,
      verifiedByOrganizationName: organization.name,
    });
    if (error) setErrors((current) => ({ ...current, [filing.id]: error }));
    else setSuccess(`Authority status verified for ${filing.externalReferenceNumber ?? filing.id}.`);
    setBusyFilingId(null);
  }

  return (
    <Card className="border-indigo-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]">
          <ShieldCheck className="size-5 text-indigo-700" /> External filing status verification
        </CardTitle>
        <p className="text-sm leading-6 text-slate-600">PATH-entered statuses remain unverified until an administrator from the issuing authority records an HTTPS source and observation note. PATH does not synchronize agency systems.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div aria-label="External filing queue" role="group" className="flex flex-wrap gap-2">
          {queueTabs.map((tab) => {
            const count = filterExternalFilings(filings, tab.id).length;
            return <Button key={tab.id} type="button" size="sm" variant={queue === tab.id ? "default" : "outline"} aria-pressed={queue === tab.id} onClick={() => setQueue(tab.id)}>
              {tab.label} <span className="ml-1 tabular-nums">{count}</span>
            </Button>;
          })}
        </div>
        {visibleFilings.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-600">
          {queue === "needs_verification" ? "No filing is awaiting an authority observation." : queue === "reconciled" ? "No recorded verification has changed the PATH-entered status." : "No external filings are available."}
        </p> : visibleFilings.map((filing) => {
          const authorized = canVerifyExternalFiling(filing, memberships, organizations, userId);
          const draft = draftFor(filing);
          const latestCheck = latestFilingCheck(filing);
          const mismatch = filingHasStatusMismatch(filing);
          const linkedWorkstream = linkedFilingWorkstream(filing, workstreams);
          const receiptVersions = receiptVersionsForFiling(filing, documents);
          return (
            <section key={filing.id} aria-label={`Verification for ${filing.externalReferenceNumber ?? filing.id}`} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#00284d]">{filing.externalReferenceNumber ?? "Agency reference pending"}</p>
                  <p className="mt-1 text-xs text-slate-600">{filing.authorityOrganizationName} · {filing.authoritativeSystemName ?? "Issuing authority system"}</p>
                </div>
                <div className="text-right">
                  <BadgeCheck className={`mx-auto size-5 ${filing.lastStatusVerifiedAt ? "text-emerald-700" : "text-amber-700"}`} aria-hidden="true" />
                  <p className={`mt-1 text-[10px] font-black uppercase ${filing.lastStatusVerifiedAt ? "text-emerald-800" : "text-amber-800"}`}>{filing.lastStatusVerifiedAt ? "Authority verified" : "PATH entry · unverified"}</p>
                </div>
              </div>

              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div><dt className="font-bold text-slate-500">Current status</dt><dd className="mt-0.5 font-black capitalize text-slate-900">{statusLabel(filing.externalStatus)}</dd></div>
                <div><dt className="font-bold text-slate-500">Last verification</dt><dd className="mt-0.5 text-slate-800">{localDate(filing.lastStatusVerifiedAt)}</dd></div>
              </dl>

              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <p className="font-bold text-slate-500">PATH workstream</p>
                {linkedWorkstream ? <p className="mt-1 font-semibold text-slate-900">{linkedWorkstream.code} · {linkedWorkstream.title} — {linkedWorkstream.operationalStateLabel}{linkedWorkstream.currentStageName ? ` · ${linkedWorkstream.currentStageName}` : ""}</p> : <p className="mt-1 text-slate-700">{filing.workstreamId ? "Linked workstream is not available in this project view." : "No PATH workstream linked."}</p>}
              </div>

              <div className="mt-3 rounded-lg border border-slate-200 p-3 text-xs">
                <p className="font-bold text-slate-500">Authority receipt evidence</p>
                {receiptVersions.length > 0 ? <ul className="mt-2 space-y-2">{receiptVersions.map(({ document, version }) => <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                  <span><strong className="text-slate-900">{document.title}</strong> · {version.fileName} · SHA-256 {version.sha256Hash.slice(0, 12)}…</span>
                  {onDownloadReceipt && <Button type="button" size="sm" variant="outline" onClick={() => onDownloadReceipt(document.id, version.id)}>Download receipt</Button>}
                </li>)}</ul> : <p className="mt-1 text-slate-700">{filing.receiptDocumentVersionIds.length > 0 ? "Linked receipt versions are not available in this project view." : "No receipt document is linked to this filing."}</p>}
              </div>

              {mismatch && latestCheck && <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"><strong>Status reconciled with a difference:</strong> PATH reported {statusLabel(latestCheck.previousStatus)}; the authority source showed {statusLabel(latestCheck.verifiedStatus)}.</p>}

              {filing.lastStatusVerifiedAt && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
                <p><strong>Source:</strong> {filing.lastStatusVerificationSourceName ?? "Recorded authority source"}</p>
                {filing.lastStatusVerificationSourceUrl && <a href={filing.lastStatusVerificationSourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-bold underline">Open evidence <ExternalLink className="size-3" /></a>}
                {filing.lastStatusVerificationNote && <p className="mt-1">{filing.lastStatusVerificationNote}</p>}
              </div>}

              {(filing.statusChecks?.length ?? 0) > 0 && <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-bold text-slate-700">Immutable verification history ({filing.statusChecks?.length})</summary>
                <ol className="mt-2 space-y-2">
                  {filing.statusChecks?.map((check) => <li key={check.id} className="border-t border-slate-200 pt-2 text-xs text-slate-700">
                    <p className="font-bold">{statusLabel(check.previousStatus)} → {statusLabel(check.verifiedStatus)} · {localDate(check.verifiedAt)}</p>
                    <p>{check.verifiedByName} · {check.verifiedByOrganizationName} · {check.sourceName}</p>
                    <a href={check.sourceUrl} target="_blank" rel="noreferrer" className="font-bold text-teal-800 underline">Evidence source</a>
                    <p className="mt-1">{check.verificationNote}</p>
                  </li>)}
                </ol>
              </details>}

              {authorized ? <form onSubmit={(event) => void submit(event, filing)} className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2">
                <div><label htmlFor={`verify-status-${filing.id}`} className="text-xs font-bold text-slate-700">Status observed in authority record</label><select id={`verify-status-${filing.id}`} value={draft.status} onChange={(event) => updateDraft(filing, { status: event.target.value as ExternalFilingRecord["externalStatus"] })} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></div>
                <div><label htmlFor={`verify-source-${filing.id}`} className="text-xs font-bold text-slate-700">Issuing authority / source name</label><Input id={`verify-source-${filing.id}`} value={draft.sourceName} onChange={(event) => updateDraft(filing, { sourceName: event.target.value })} maxLength={180} required placeholder="Agency portal or official contact" /></div>
                <div><label htmlFor={`verify-url-${filing.id}`} className="text-xs font-bold text-slate-700">HTTPS source URL</label><Input id={`verify-url-${filing.id}`} type="url" pattern="https://.*" value={draft.sourceUrl} onChange={(event) => updateDraft(filing, { sourceUrl: event.target.value })} required placeholder="https://agency.gov/record/..." /></div>
                <div><label htmlFor={`verify-note-${filing.id}`} className="text-xs font-bold text-slate-700">Verification note</label><textarea id={`verify-note-${filing.id}`} value={draft.note} onChange={(event) => updateDraft(filing, { note: event.target.value })} maxLength={2000} required rows={2} className="mt-1 w-full rounded-md border border-slate-300 p-2.5 text-sm" placeholder="What did you check, and what status did the issuing authority show?" /></div>
                {errors[filing.id] && <p role="alert" className="text-sm font-semibold text-red-800 md:col-span-2">{errors[filing.id]}</p>}
                {success && <p role="status" className="text-sm font-semibold text-emerald-800 md:col-span-2">{success}</p>}
                <div className="md:col-span-2"><Button type="submit" disabled={busyFilingId === filing.id} className="bg-indigo-800 font-bold">{busyFilingId === filing.id ? "Saving verification…" : "Record authority verification"}</Button></div>
              </form> : <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">Verification is available only to an active administrator of this issuing authority.</p>}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
