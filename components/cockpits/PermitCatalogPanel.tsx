"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Download, ExternalLink, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PermitTypeRecord, RequirementResourceClassification, RequirementResourceRecord, WorkflowTemplateRecord } from "@/lib/domain-models";

type CatalogResourceType = "form_pdf" | "guidance_doc" | "checklist";
type CatalogResource = {
  href?: string;
  name: string;
  classification: RequirementResourceClassification;
  sourceAuthority: string;
  versionTag?: string;
  verifiedAt?: string;
  verifiedBy?: string;
};

function internalResourceUrl(permit: PermitTypeRecord, resourceType: CatalogResourceType = "guidance_doc") {
  return `/demo-resources/${encodeURIComponent(permit.code)}?resource=${resourceType}`;
}

function configuredResource(permit: PermitTypeRecord, resourceType: CatalogResourceType): RequirementResourceRecord | undefined {
  return permit.resources?.find((resource) => resource.resourceType === resourceType);
}

function resourceUrl(permit: PermitTypeRecord, resourceType: CatalogResourceType) {
  const configured = configuredResource(permit, resourceType);
  if (configured) {
    if (configured.resourceClassification === "unavailable") return "";
    return configured.url ?? internalResourceUrl(permit, resourceType);
  }
  return resourceType === "form_pdf"
    ? permit.applicationFormUrl ?? internalResourceUrl(permit, resourceType)
    : resourceType === "guidance_doc"
      ? permit.instructionsUrl ?? internalResourceUrl(permit, resourceType)
      : internalResourceUrl(permit, resourceType);
}

function inferredClassification(resourceType: CatalogResourceType, href?: string): RequirementResourceClassification {
  if (!href) return "unavailable";
  if (href.startsWith("/demo-resources/")) return "internal_demo_guide";
  if (resourceType === "form_pdf" && /\.pdf(?:$|[?#])/i.test(href)) return "file_download";
  return "official_resource";
}

function catalogResource(permit: PermitTypeRecord, resourceType: CatalogResourceType, fallbackName: string): CatalogResource {
  const configured = configuredResource(permit, resourceType);
  const href = resourceUrl(permit, resourceType) || undefined;
  const classification = configured?.resourceClassification ?? inferredClassification(resourceType, href);
  return {
    href,
    name: configured?.resourceName ?? fallbackName,
    classification,
    sourceAuthority: configured?.sourceAuthority ?? (classification === "internal_demo_guide" ? "PATH internal demonstration content" : `${permit.responsibleOrgCode} catalog record`),
    versionTag: configured?.versionTag,
    verifiedAt: configured?.verifiedAt ?? permit.lastVerifiedAt,
    verifiedBy: configured?.verifiedBy,
  };
}

function classificationLabel(classification: RequirementResourceClassification): string {
  return {
    official_resource: "Official resource",
    internal_demo_guide: "Internal demo guide",
    unavailable: "Unavailable",
    file_download: "File download",
    unclassified: "Classification pending",
  }[classification];
}

function classificationTone(classification: RequirementResourceClassification): string {
  if (classification === "official_resource" || classification === "file_download") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (classification === "internal_demo_guide") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function verificationLabel(permit: PermitTypeRecord): string {
  if (permit.verificationStatus === "stale_over_180d") return "Verification overdue";
  if (permit.verificationStatus === "verification_due") return "Verification due";
  return permit.lastVerifiedAt ? `Verified ${permit.lastVerifiedAt}` : "Verification date not recorded";
}

function verificationTone(permit: PermitTypeRecord): string {
  if (permit.verificationStatus === "verified" && permit.lastVerifiedAt) return "text-emerald-700";
  if (permit.verificationStatus === "verified" || permit.verificationStatus === "verification_due") return "text-amber-800";
  return "text-rose-800";
}

function VerificationIcon({ permit }: { permit: PermitTypeRecord }) {
  if (permit.verificationStatus === "verified" && permit.lastVerifiedAt) return <CheckCircle2 className="mr-1 inline size-3.5" aria-hidden="true" />;
  if (permit.verificationStatus === "verified" || permit.verificationStatus === "verification_due") return <Clock3 className="mr-1 inline size-3.5" aria-hidden="true" />;
  return <AlertTriangle className="mr-1 inline size-3.5" aria-hidden="true" />;
}

function ResourceLink({ resource }: { resource: CatalogResource }) {
  const details = [resource.versionTag, resource.verifiedAt ? `reviewed ${resource.verifiedAt}` : "review date not recorded"].filter(Boolean).join(" · ");
  return <div className={`rounded-lg border p-3 ${classificationTone(resource.classification)}`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-sm font-black">{resource.name}</p>
        <p className="mt-1 text-xs">{classificationLabel(resource.classification)} · {details}</p>
      </div>
      {resource.href && <a href={resource.href} target={resource.href.startsWith("/") ? undefined : "_blank"} rel={resource.href.startsWith("/") ? undefined : "noreferrer"} download={resource.classification === "file_download" ? true : undefined} className="inline-flex shrink-0 items-center gap-1 text-xs font-black underline underline-offset-2">
        {resource.classification === "file_download" ? <Download className="size-3.5" aria-hidden="true" /> : resource.href.startsWith("/") ? <ArrowRight className="size-3.5" aria-hidden="true" /> : <ExternalLink className="size-3.5" aria-hidden="true" />}
        {resource.classification === "file_download" ? "Download file" : resource.classification === "internal_demo_guide" ? "Open demo guide" : "Open resource"}
      </a>}
    </div>
    <p className="mt-2 text-xs"><strong>Source:</strong> {resource.sourceAuthority}{resource.verifiedBy ? ` · verified by ${resource.verifiedBy}` : ""}</p>
    {!resource.href && <p className="mt-2 text-xs font-bold">No link is configured. Do not treat this entry as a filing form or download.</p>}
  </div>;
}

export function PermitCatalogPanel({ catalog, templates = [], onStartRequest }: { catalog: PermitTypeRecord[]; templates?: WorkflowTemplateRecord[]; onStartRequest?: (permitId: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return catalog.filter((permit) => !normalized || [permit.code, permit.name, permit.responsibleOrgCode, permit.triggerExplanation].some((value) => value.toLowerCase().includes(normalized)));
  }, [catalog, query]);

  return <div className="space-y-5" aria-label="Permit and approval resource catalog">
    <Card className="border-teal-200 bg-white"><CardHeader><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Permit and approval resources</p><CardTitle className="mt-1 text-2xl font-black text-[#00284d]">Start with the authorization you need</CardTitle><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Review the purpose, trigger, submission path, requirements, and configured review stages before opening a PATH request. External agency systems remain authoritative for formal filing.</p></div><div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" aria-hidden="true" /><input aria-label="Search permit catalog" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search permits or agencies" className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm" /></div></div></CardHeader></Card>
    {filtered.length === 0 && <Card><CardContent className="p-6 text-sm text-slate-600">No catalog entry matches “{query}”. Try an agency, permit name, or code.</CardContent></Card>}
    {filtered.map((permit) => {
      const template = templates.find((candidate) => candidate.permitTypeId === permit.id);
      const activeVersion = template?.versions.find((version) => version.versionNumber === template.activeVersionNumber) ?? template?.versions.find((version) => version.status === "published");
      const reviewingGroup = activeVersion?.stages[0]?.responsibleUnitName ?? `${permit.responsibleOrgCode} review group`;
      const related = permit.relatedPermitTypeIds.map((id) => catalog.find((entry) => entry.id === id)?.name ?? id);
      const resources = [
        { ...catalogResource(permit, "form_pdf", permit.applicationFormUrl ? "Application form" : "Application form guidance"), href: resourceUrl(permit, "form_pdf") || undefined },
        { ...catalogResource(permit, "guidance_doc", "Submission instructions"), href: resourceUrl(permit, "guidance_doc") || undefined },
        { ...catalogResource(permit, "checklist", "Submission checklist"), href: resourceUrl(permit, "checklist") || undefined },
      ];
      return <Card key={permit.id} className="border-slate-200 bg-white shadow-sm"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><Badge className="bg-slate-900 font-mono text-white">{permit.code}</Badge><Badge variant="outline">{permit.responsibleOrgCode}</Badge><span className={`text-xs font-bold ${verificationTone(permit)}`}><VerificationIcon permit={permit} />{verificationLabel(permit)}</span></div><CardTitle className="mt-2 text-xl font-black text-[#00284d]">{permit.name}</CardTitle></div><div className="text-right text-xs text-slate-500"><p className="font-bold text-slate-800">{permit.expectedLeadTimeDays} days typical</p><p>{permit.minimumStatutoryDays} days statutory minimum</p></div></div></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 text-sm md:grid-cols-2"><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Purpose and when required</p><p className="mt-1 leading-6 text-slate-700">{permit.triggerExplanation}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Responsible agency and reviewing group</p><p className="mt-1 font-bold text-slate-800">{permit.responsibleOrgCode} · {reviewingGroup}</p><p className="mt-1 text-xs text-slate-600">Formal authority: {permit.statutoryCitation}</p></div></div>
        <div className="grid gap-3 text-sm md:grid-cols-2"><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Supporting documents and prerequisites</p><ul className="mt-2 space-y-1 text-slate-700">{permit.prerequisites.length > 0 ? permit.prerequisites.map((item) => <li key={item}>• {item}</li>) : <li>No additional prerequisite is listed.</li>}</ul></div><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Typical PATH review stages</p><ol className="mt-2 space-y-1 text-slate-700">{activeVersion?.stages.length ? activeVersion.stages.map((stage) => <li key={stage.id}>{stage.sequenceOrder}. {stage.customerVisibilityLabel}</li>) : <li>Configured review stages will appear after request triage.</li>}</ol></div></div>
        <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 text-sm"><p className="font-black text-teal-950">How to submit</p><p className="mt-1 text-teal-900">{permit.filingMode === "EXTERNAL_PORTAL" ? `Submit through the authoritative ${permit.responsibleOrgCode} filing system, then record the external reference in PATH.` : "Use the PATH request flow; the project office will provide the supported submission handoff."}</p>{permit.officialFilingUrl ? <a href={permit.officialFilingUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal-800 underline">Open agency filing site <ExternalLink className="size-3.5" /></a> : <a href={internalResourceUrl(permit, "guidance_doc")} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal-800 underline">Open internal demo submission guide <ArrowRight className="size-3.5" /></a>}</div>
        <div className="space-y-2 border-t border-slate-100 pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Resources and provenance</p><p className="text-xs text-slate-500">Permit record: {verificationLabel(permit)}</p></div>{resources.map((resource) => <ResourceLink key={`${permit.id}-${resource.name}`} resource={resource} />)}</div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">{onStartRequest && <Button type="button" onClick={() => onStartRequest(permit.id)} className="ml-auto bg-[#00284d] text-xs font-bold">Start this request <ArrowRight className="size-3.5" /></Button>}</div>
        <div className="grid gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600 sm:grid-cols-2"><p><strong className="text-slate-800">Related permits:</strong> {related.length ? related.join(" · ") : "None listed"}</p><p><strong className="text-slate-800">Contact / escalation:</strong> {permit.agencyContactName ?? `${permit.responsibleOrgCode} permit desk`} · {permit.agencyContactEmail ?? "Use the agency filing site or PATH project office"}</p></div>
      </CardContent></Card>;
    })}
  </div>;
}
