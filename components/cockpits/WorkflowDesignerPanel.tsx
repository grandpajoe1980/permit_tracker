"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock3,
  ExternalLink,
  GitBranch,
  Layers,
  Link2,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPermitCatalog, getRegisteredOrganizations, getWorkflowTemplates } from "@/lib/permit-utils";

export function WorkflowDesignerPanel() {
  const templates = getWorkflowTemplates();
  const catalog = getPermitCatalog();
  const orgs = getRegisteredOrganizations();
  const [activeTab, setActiveTab] = useState<"workflows" | "catalog" | "agencies">("workflows");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || "");

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];
  const activeVersion = selectedTemplate?.versions.find((v) => v.status === "published") || selectedTemplate?.versions[0];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-sky-50 text-sky-800 border-sky-200">
                Agency Administration & Process Engineering
              </Badge>
              <span className="text-xs text-slate-500 font-mono">Version-Controlled Templates & Regulatory Catalog</span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900">
              Workflow Designer & Permit Catalog
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Configure versioned multi-stage workflows, SLA service targets, checklist gates, and maintain institutional statutory knowledge.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "workflows" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("workflows")}
              className="text-xs"
            >
              <Workflow className="size-3.5 mr-1" /> Workflow Templates
            </Button>
            <Button
              variant={activeTab === "catalog" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("catalog")}
              className="text-xs"
            >
              <Layers className="size-3.5 mr-1" /> Permit Catalog ({catalog.length})
            </Button>
            <Button
              variant={activeTab === "agencies" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("agencies")}
              className="text-xs"
            >
              <Building2 className="size-3.5 mr-1" /> Agency Registry ({orgs.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Tab 1: Workflow Designer (Versioned Stages) */}
      {activeTab === "workflows" && selectedTemplate && activeVersion && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900">{selectedTemplate.name}</h2>
              <Badge className="bg-emerald-600 text-white font-mono text-xs">
                Published v{activeVersion.versionNumber}.0
              </Badge>
            </div>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow">
              <Plus className="size-3.5" /> Create Draft v{activeVersion.versionNumber + 1}.0
            </Button>
          </div>

          {/* Version Guardrail Alert */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 text-xs text-sky-900 flex items-start gap-2.5">
            <ShieldCheck className="size-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block">Immutable Versioning Guardrail:</strong>
              Active workstreams in flight execute on their assigned version (v4). Edits will create a new draft version (v5) without modifying live case histories until formal publication.
            </div>
          </div>

          {/* Stages List */}
          <div className="space-y-4">
            {activeVersion.stages.map((stage, idx) => (
              <Card key={stage.id} className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        Stage {stage.sequenceOrder}
                      </span>
                      <Badge variant="outline" className="font-bold">
                        {stage.responsibleOrgCode}
                      </Badge>
                      {stage.canRunInParallel && (
                        <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                          ⚡ Can Run In Parallel
                        </Badge>
                      )}
                      {stage.isMilestoneGate && (
                        <Badge className="bg-purple-100 text-purple-800 text-[10px]">
                          Milestone Gate
                        </Badge>
                      )}
                    </div>
                    <div className="text-right text-xs font-semibold text-slate-600">
                      SLA: {stage.targetDurationDays} Business Days
                      {stage.minimumStatutoryDays > 0 && ` (${stage.minimumStatutoryDays}d statutory min)`}
                    </div>
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900 mt-2">
                    {stage.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Customer Visibility Label: <strong className="text-slate-700">&quot;{stage.customerVisibilityLabel}&quot;</strong>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                      <span className="font-bold text-slate-700 block mb-1">Required Document Inputs:</span>
                      <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                        {stage.requiredInputs.map((inp) => (
                          <li key={inp}>{inp.replace("_", " ")}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                      <span className="font-bold text-slate-700 block mb-1">Checklist Gates to Advance:</span>
                      <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                        {stage.completionRequirements.map((req) => (
                          <li key={req}>{req.replace("_", " ")}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <div>
                      <span>Permitted Next Steps: {stage.permittedTransitions.join(", ")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Permit & Authorization Catalog */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Living Statutory Permit & Authorization Catalog
            </h2>
            <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs gap-1.5 shadow">
              <Plus className="size-3.5" /> Add Authorization Type
            </Button>
          </div>

          <div className="space-y-4">
            {catalog.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {item.code}
                      </span>
                      <Badge variant="outline">{item.responsibleOrgCode}</Badge>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        Verified {item.lastVerifiedAt}
                      </Badge>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1">{item.name}</h3>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-500">Expected Lead Time</div>
                    <div className="text-sm font-bold text-slate-900">{item.expectedLeadTimeDays} Days</div>
                  </div>
                </div>

                <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-900 block mb-0.5">Regulatory Trigger:</span>
                  {item.triggerExplanation}
                </div>

                <div className="rounded-lg bg-indigo-50/50 p-2.5 border border-indigo-100 text-xs text-indigo-900">
                  <span className="font-bold">Statute & Authority: </span>
                  <span>{item.statutoryCitation}</span>
                </div>

                {item.resources && item.resources.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Link2 className="size-3.5 text-indigo-600" /> Version-Controlled Resources & Filing Forms (180-Day Audit Active)
                    </span>
                    {item.resources.map((res) => (
                      <div key={res.id} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-slate-900 text-white font-mono text-[10px]">{res.versionTag}</Badge>
                          <span className="font-medium text-slate-900">{res.resourceName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                          <span>Verified by {res.verifiedBy} ({res.verifiedAt})</span>
                          <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-0.5">
                            Open <ExternalLink className="size-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Agency Registry */}
      {activeTab === "agencies" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Participating Organization & Agency Registry
            </h2>
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5 shadow">
              <Plus className="size-3.5" /> Register Organization
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {orgs.map((org) => (
              <Card key={org.id} className="border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-slate-900 text-white font-bold font-mono text-xs">
                      {org.code}
                    </Badge>
                    <Badge variant="outline">{org.jurisdictionLevel}</Badge>
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900 mt-2">
                    {org.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Project Liaison: <strong className="text-slate-700">{org.projectLiaisonName || "Liaison Officer"}</strong> ({org.projectLiaisonEmail})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-slate-600 pt-1">
                  {org.statutoryAuthority && (
                    <p className="bg-slate-50 p-2.5 rounded border border-slate-100">
                      <strong className="text-slate-800">Authority: </strong>
                      {org.statutoryAuthority}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <span>Hours: {org.workingHours}</span>
                    <span>Default SLA: {org.defaultSlaDays} Days</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
