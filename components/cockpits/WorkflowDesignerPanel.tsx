"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Building2,
  Check,
  CheckCircle2,
  ExternalLink,
  Layers,
  Link2,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
  Workflow,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPermitCatalog, getRegisteredOrganizations, getWorkflowTemplates } from "@/lib/permit-utils";
import { mutateCreatePermitType, mutateRegisterOrganization } from "@/lib/supabase/mutations";
import { repository } from "@/lib/repository";
import { validateWorkflowDraft, type WorkflowDraftValidationResult } from "@/lib/engines/workflow-engine";
import type { OrganizationRecord, PermitTypeRecord, WorkflowTemplateRecord, WorkflowStageRecord } from "@/lib/domain-models";

export function WorkflowDesignerPanel({
  catalog: catalogProp,
  organizations: organizationsProp,
  templates: templatesProp,
}: {
  catalog?: PermitTypeRecord[];
  organizations?: OrganizationRecord[];
  templates?: WorkflowTemplateRecord[];
} = {}) {
  const templates = templatesProp ?? getWorkflowTemplates();
  const [catalogAdds, setCatalogAdds] = useState<PermitTypeRecord[]>([]);
  const [organizationAdds, setOrganizationAdds] = useState<OrganizationRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"workflows" | "catalog" | "agencies">("workflows");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || "");
  const [expandedStageKey, setExpandedStageKey] = useState<string | null>(null);
  const [designerMessage, setDesignerMessage] = useState("");
  const [designerBusy, setDesignerBusy] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [permitForm, setPermitForm] = useState({ code: "", name: "", responsibleOrgCode: "LDEQ", statutoryCitation: "", triggerExplanation: "" });
  const [organizationForm, setOrganizationForm] = useState({ code: "", name: "", generalContactEmail: "" });

  const baseCatalog = catalogProp ?? getPermitCatalog();
  const catalog = [...baseCatalog, ...catalogAdds.filter((item) => !baseCatalog.some((entry) => entry.id === item.id))];
  const baseOrganizations = organizationsProp ?? getRegisteredOrganizations();

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];
  const activeVersion = selectedTemplate?.versions.find((v) => v.status === "published") || selectedTemplate?.versions[0];
  const nextVersionNumber = Math.max(...(selectedTemplate?.versions.map((v) => v.versionNumber) ?? [1]), 0) + 1;

  function getInitialDraft(template: WorkflowTemplateRecord | undefined): { draftVersionId: string | null; draftStages: WorkflowStageRecord[] } {
    if (!template) return { draftVersionId: null, draftStages: [] };
    const existingDraft = template.versions.find((v) => v.status === "draft");
    if (existingDraft) {
      return { draftVersionId: existingDraft.id, draftStages: existingDraft.stages };
    }
    const repoDraft = repository.getWorkflowDraft(template.id);
    if (repoDraft) {
      return { draftVersionId: repoDraft.id, draftStages: repoDraft.stages };
    }
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`path_draft_${template.id}`);
        if (stored) {
          const parsed = JSON.parse(stored) as { draftVersionId: string; stages: WorkflowStageRecord[] };
          if (parsed?.draftVersionId && Array.isArray(parsed.stages)) {
            return { draftVersionId: parsed.draftVersionId, draftStages: parsed.stages };
          }
        }
      } catch {}
    }
    return { draftVersionId: null, draftStages: [] };
  }

  const [draftState, setDraftState] = useState(() => getInitialDraft(selectedTemplate));
  const draftVersionId = draftState.draftVersionId;
  const draftStages = draftState.draftStages;

  function handleSelectTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const tmpl = templates.find((t) => t.id === templateId) || templates[0];
    setDraftState(getInitialDraft(tmpl));
    setExpandedStageKey(null);
  }

  // Persist draft changes
  function persistDraftChanges(stages: WorkflowStageRecord[], draftId: string) {
    setDraftState({ draftVersionId: draftId, draftStages: stages });
    try {
      if (selectedTemplate) {
        localStorage.setItem(`path_draft_${selectedTemplate.id}`, JSON.stringify({ draftVersionId: draftId, stages }));
      }
    } catch {}
  }

  const orgs = React.useMemo(
    () => [...baseOrganizations, ...organizationAdds.filter((item) => !baseOrganizations.some((entry) => entry.id === item.id))],
    [baseOrganizations, organizationAdds]
  );

  const visibleStages = React.useMemo(
    () => (draftStages.length > 0 ? draftStages : activeVersion?.stages ?? []),
    [draftStages, activeVersion]
  );

  // Validation
  const validationResult: WorkflowDraftValidationResult = React.useMemo(() => {
    if (!draftVersionId) return { valid: true, errors: [], warnings: [], unreachableStages: [], cyclicStages: [] };
    return validateWorkflowDraft({
      stages: visibleStages,
      organizations: orgs,
    });
  }, [draftVersionId, visibleStages, orgs]);

  async function createDraft() {
    if (!activeVersion || !selectedTemplate) return;
    setDesignerBusy(true);

    const res = await repository.createWorkflowDraftPersisted({
      templateId: selectedTemplate.id,
      changeSummary: `Draft revision v${nextVersionNumber}.0 of ${selectedTemplate.name}`,
    });
    setDesignerBusy(false);

    if (res.error || !res.data) {
      setDesignerMessage(res.error?.message ?? "Draft creation failed.");
      return;
    }

    const newDraftId = res.data.draftVersionId;
    const clonedStages = activeVersion.stages.map((stage, idx) => ({
      ...stage,
      id: `${newDraftId}-stg-${idx + 1}`,
      workflowVersionId: newDraftId,
      sequenceOrder: idx + 1,
    }));

    setDraftVersionId(newDraftId);
    persistDraftChanges(clonedStages, newDraftId);
    setDesignerMessage(`Draft ${newDraftId} (v${res.data.versionNumber}.0) created. You can now add, reorder, and configure stages.`);
  }

  function discardDraft() {
    if (!selectedTemplate) return;
    setDraftVersionId(null);
    setDraftStages([]);
    setExpandedStageKey(null);
    try {
      localStorage.removeItem(`path_draft_${selectedTemplate.id}`);
    } catch {}
    setDesignerMessage("Draft discarded. Showing currently published workflow.");
  }

  function handleAddStage() {
    if (!draftVersionId) return;
    const newIdx = draftStages.length + 1;
    const newStageKey = `stage_${newIdx}`;
    const newStage: WorkflowStageRecord = {
      id: `${draftVersionId}-${newStageKey}`,
      workflowVersionId: draftVersionId,
      stageKey: newStageKey,
      name: `New Workflow Stage ${newIdx}`,
      customerVisibilityLabel: `Workflow Stage ${newIdx}`,
      sequenceOrder: newIdx,
      responsibleOrgId: orgs[0]?.code ?? "DOTD",
      responsibleOrgCode: orgs[0]?.code ?? "DOTD",
      targetDurationDays: 10,
      minimumStatutoryDays: 0,
      requiredInputs: ["Supporting technical package"],
      completionRequirements: ["Regulatory review signoff"],
      permittedTransitions: ["complete"],
      canRunInParallel: false,
      isMilestoneGate: false,
      rfiBehavior: "pauses_clock",
      holdBehavior: "standard_running",
    };

    const nextStages = [...draftStages, newStage];
    persistDraftChanges(nextStages, draftVersionId);
    setExpandedStageKey(newStageKey);
    setDesignerMessage(`Added stage "${newStage.name}" to draft.`);
  }

  function handleRemoveStage(stageKey: string) {
    if (!draftVersionId || draftStages.length <= 1) return;
    const nextStages = draftStages
      .filter((s) => s.stageKey !== stageKey)
      .map((s, idx) => ({ ...s, sequenceOrder: idx + 1 }));
    persistDraftChanges(nextStages, draftVersionId);
    if (expandedStageKey === stageKey) setExpandedStageKey(null);
    setDesignerMessage(`Removed stage from draft.`);
  }

  function handleMoveStage(index: number, direction: "up" | "down") {
    if (!draftVersionId) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= draftStages.length) return;

    const nextStages = [...draftStages];
    const temp = nextStages[index];
    nextStages[index] = nextStages[targetIdx];
    nextStages[targetIdx] = temp;

    const resequenced = nextStages.map((s, idx) => ({ ...s, sequenceOrder: idx + 1 }));
    persistDraftChanges(resequenced, draftVersionId);
    setDesignerMessage(`Stages reordered.`);
  }

  function updateStageField<K extends keyof WorkflowStageRecord>(stageKey: string, field: K, value: WorkflowStageRecord[K]) {
    if (!draftVersionId) return;
    const nextStages = draftStages.map((s) => (s.stageKey === stageKey ? { ...s, [field]: value } : s));
    persistDraftChanges(nextStages, draftVersionId);
  }

  async function handlePublishDraft() {
    if (!draftVersionId || !selectedTemplate) return;
    if (!validationResult.valid) {
      setDesignerMessage(`Cannot publish: Draft contains ${validationResult.errors.length} validation errors.`);
      return;
    }

    setDesignerBusy(true);
    const res = await repository.publishWorkflowVersionPersisted({
      templateId: selectedTemplate.id,
      draftVersionId,
      actorName: "PATH administrator",
    });
    setDesignerBusy(false);

    if (res.error || !res.data) {
      setDesignerMessage(res.error?.message ?? "Publish failed.");
      return;
    }

    try {
      localStorage.removeItem(`path_draft_${selectedTemplate.id}`);
    } catch {}
    setDraftVersionId(null);
    setDraftStages([]);
    setShowPreviewModal(false);
    setDesignerMessage(`Workflow published as v${res.data.versionNumber}.0! Existing workstreams remain pinned to prior versions. New workstreams will use this version.`);
  }

  async function registerOrganization() {
    setDesignerBusy(true);
    const result = await mutateRegisterOrganization(organizationForm);
    setDesignerBusy(false);
    if (result.error || !result.data) {
      setDesignerMessage(result.error?.message ?? "The organization was not confirmed by the database.");
      return;
    }
    setOrganizationAdds((current) => [result.data!, ...current]);
    setOrganizationForm({ code: "", name: "", generalContactEmail: "" });
    setDesignerMessage(`${result.data.code} registered and audit logged.`);
  }

  async function registerPermitType() {
    setDesignerBusy(true);
    const result = await mutateCreatePermitType({
      ...permitForm,
      id: `permit-${permitForm.code.toLowerCase()}`,
      category: "permit",
      statutoryCitation: permitForm.statutoryCitation || "Authority to be confirmed by the responsible agency.",
      triggerExplanation: permitForm.triggerExplanation || "Agency review required.",
    });
    setDesignerBusy(false);
    if (result.error || !result.data) {
      setDesignerMessage(result.error?.message ?? "The authorization was not confirmed by the database.");
      return;
    }
    setCatalogAdds((current) => [result.data!, ...current]);
    setPermitForm({ code: "", name: "", responsibleOrgCode: "LDEQ", statutoryCitation: "", triggerExplanation: "" });
    setDesignerMessage(`${result.data.code} added to the authorization catalog and audit logged.`);
  }

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {templates.length > 1 && <label className="sr-only" htmlFor="workflow-template-select">Workflow template</label>}
              {templates.length > 1 && (
                <select
                  id="workflow-template-select"
                  aria-label="Workflow template"
                  value={selectedTemplate?.id ?? ""}
                  onChange={(event) => handleSelectTemplate(event.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-bold text-slate-800"
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              )}
              <h2 className="text-lg font-bold text-slate-900">{selectedTemplate.name}</h2>
              <Badge className="bg-emerald-600 text-white font-mono text-xs">
                Published v{activeVersion.versionNumber}.0
              </Badge>
              {draftVersionId && (
                <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-mono text-xs font-bold">
                  Editing Draft v{nextVersionNumber}.0
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!draftVersionId ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void createDraft()}
                  disabled={designerBusy}
                  className="bg-[#00284d] text-white font-bold text-xs gap-1.5 shadow-none"
                >
                  <Plus className="size-3.5" /> Create Draft v{nextVersionNumber}.0
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddStage}
                    disabled={designerBusy}
                    className="text-xs font-bold gap-1"
                  >
                    <Plus className="size-3.5" /> Add Stage
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={discardDraft}
                    className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50"
                  >
                    Discard Draft
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowPreviewModal(true)}
                    disabled={designerBusy || !validationResult.valid}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5"
                  >
                    <Check className="size-3.5" /> Review & Publish
                  </Button>
                </>
              )}
            </div>
          </div>

          {designerMessage && (
            <div role="status" className="rounded-lg border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700">
              {designerMessage}
            </div>
          )}

          {/* Validation Feedback Banner in Draft Mode */}
          {draftVersionId && (
            <div>
              {validationResult.valid ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-700 shrink-0" />
                  <span>
                    <strong>Draft validation passed:</strong> All {draftStages.length} stages are reachable, ownership is complete, and constraints are verified.
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle className="size-4 text-amber-700 shrink-0" />
                    <span>Draft contains {validationResult.errors.length} validation issue(s) that must be corrected before publishing:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-amber-900 pl-2">
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Dynamic Version Guardrail Alert */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 text-xs text-sky-900 flex items-start gap-2.5">
            <ShieldCheck className="size-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block">Immutable Versioning Guardrail:</strong>
              Active workstreams in flight execute on their assigned version (v{activeVersion.versionNumber}.0). Edits will create a new draft version (v{nextVersionNumber}.0) without modifying live case histories until formal publication.
            </div>
          </div>

          {/* Stages List (Ordered Process List with Expandable Settings) */}
          <div className="space-y-4">
            {visibleStages.map((stage, index) => {
              const isExpanded = expandedStageKey === stage.stageKey;
              const isUnreachable = validationResult.unreachableStages.includes(stage.stageKey);
              const isCyclic = validationResult.cyclicStages.includes(stage.stageKey);

              return (
                <Card
                  key={stage.id || stage.stageKey}
                  className={`border transition-all ${
                    isUnreachable || isCyclic
                      ? "border-red-300 bg-red-50/30"
                      : isExpanded
                      ? "border-teal-400 bg-white shadow-sm"
                      : "border-slate-200 bg-white shadow-xs hover:border-slate-300"
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
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
                        {isUnreachable && (
                          <Badge className="bg-red-100 text-red-800 text-[10px] font-bold">
                            Unreachable
                          </Badge>
                        )}
                        {isCyclic && (
                          <Badge className="bg-red-100 text-red-800 text-[10px] font-bold">
                            Cycle Blocked
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        {draftVersionId && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={index === 0}
                              onClick={() => handleMoveStage(index, "up")}
                              className="size-7 text-slate-500 hover:text-slate-900"
                              title="Move stage up"
                            >
                              <ArrowUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={index === visibleStages.length - 1}
                              onClick={() => handleMoveStage(index, "down")}
                              className="size-7 text-slate-500 hover:text-slate-900"
                              title="Move stage down"
                            >
                              <ArrowDown className="size-3.5" />
                            </Button>
                            {visibleStages.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveStage(stage.stageKey)}
                                className="size-7 text-red-400 hover:text-red-700 hover:bg-red-50"
                                title="Remove stage from draft"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedStageKey(isExpanded ? null : stage.stageKey)}
                              className="text-[11px] font-bold gap-1"
                            >
                              <Settings className="size-3" />
                              {isExpanded ? "Close" : "Configure"}
                            </Button>
                          </>
                        )}
                        <span className="ml-2 font-mono text-[11px]">
                          SLA: {stage.targetDurationDays} Business Days
                          {stage.minimumStatutoryDays > 0 && ` (${stage.minimumStatutoryDays}d statutory min)`}
                        </span>
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
                    {/* Expandable Settings Editor in Draft Mode */}
                    {draftVersionId && isExpanded ? (
                      <div className="space-y-4 rounded-xl border border-teal-200 bg-teal-50/30 p-4 text-xs">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">Stage Title</label>
                            <input
                              value={stage.name}
                              onChange={(e) => updateStageField(stage.stageKey, "name", e.target.value)}
                              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">Customer Visibility Label</label>
                            <input
                              value={stage.customerVisibilityLabel}
                              onChange={(e) => updateStageField(stage.stageKey, "customerVisibilityLabel", e.target.value)}
                              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">Owning Agency / Responsible Org</label>
                            <select
                              value={stage.responsibleOrgCode}
                              onChange={(e) => updateStageField(stage.stageKey, "responsibleOrgCode", e.target.value)}
                              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
                            >
                              {orgs.map((org) => (
                                <option key={org.id} value={org.code}>
                                  {org.code} — {org.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="font-bold text-slate-700 block mb-1">Target SLA (Days)</label>
                              <input
                                type="number"
                                min={1}
                                value={stage.targetDurationDays}
                                onChange={(e) => updateStageField(stage.stageKey, "targetDurationDays", Number(e.target.value))}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
                              />
                            </div>
                            <div>
                              <label className="font-bold text-slate-700 block mb-1">Statutory Min (Days)</label>
                              <input
                                type="number"
                                min={0}
                                value={stage.minimumStatutoryDays}
                                onChange={(e) => updateStageField(stage.stageKey, "minimumStatutoryDays", Number(e.target.value))}
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Behaviors & Parallelism */}
                        <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-teal-100">
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                              <input
                                type="checkbox"
                                checked={stage.canRunInParallel}
                                onChange={(e) => updateStageField(stage.stageKey, "canRunInParallel", e.target.checked)}
                                className="size-4 accent-teal-700"
                              />
                              Run In Parallel
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                              <input
                                type="checkbox"
                                checked={stage.isMilestoneGate}
                                onChange={(e) => updateStageField(stage.stageKey, "isMilestoneGate", e.target.checked)}
                                className="size-4 accent-teal-700"
                              />
                              Milestone Gate
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="font-bold text-slate-700 block mb-1">RFI Behavior</label>
                              <select
                                value={stage.rfiBehavior ?? "pauses_clock"}
                                onChange={(e) => updateStageField(stage.stageKey, "rfiBehavior", e.target.value as "pauses_clock" | "continuous_clock" | "customer_hold")}
                                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                              >
                                <option value="pauses_clock">Pauses SLA Clock</option>
                                <option value="continuous_clock">Continuous Clock</option>
                                <option value="customer_hold">Customer Hold</option>
                              </select>
                            </div>
                            <div>
                              <label className="font-bold text-slate-700 block mb-1">Hold Behavior</label>
                              <select
                                value={stage.holdBehavior ?? "standard_running"}
                                onChange={(e) => updateStageField(stage.stageKey, "holdBehavior", e.target.value as "standard_running" | "statutory_hold" | "applicant_hold")}
                                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                              >
                                <option value="standard_running">Standard Running</option>
                                <option value="statutory_hold">Statutory Hold</option>
                                <option value="applicant_hold">Applicant Hold</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Document Inputs & Completion Requirements */}
                        <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-teal-100">
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">
                              Required Document Inputs (comma separated)
                            </label>
                            <textarea
                              rows={2}
                              value={stage.requiredInputs.join(", ")}
                              onChange={(e) =>
                                updateStageField(
                                  stage.stageKey,
                                  "requiredInputs",
                                  e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                )
                              }
                              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 block mb-1">
                              Checklist Gates to Advance (comma separated)
                            </label>
                            <textarea
                              rows={2}
                              value={stage.completionRequirements.join(", ")}
                              onChange={(e) =>
                                updateStageField(
                                  stage.stageKey,
                                  "completionRequirements",
                                  e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                )
                              }
                              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
                            />
                          </div>
                        </div>

                        {/* Permitted Transitions */}
                        <div className="pt-2 border-t border-teal-100">
                          <label className="font-bold text-slate-700 block mb-1">
                            Permitted Transitions (comma separated, e.g. &quot;complete&quot;, &quot;stage_2&quot;)
                          </label>
                          <input
                            value={stage.permittedTransitions.join(", ")}
                            onChange={(e) =>
                              updateStageField(
                                stage.stageKey,
                                "permittedTransitions",
                                e.target.value
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean)
                              )
                            }
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Read-Only Summary when not editing */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                          <span className="font-bold text-slate-700 block mb-1">Required Document Inputs:</span>
                          {stage.requiredInputs.length > 0 ? (
                            <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                              {stage.requiredInputs.map((inp) => (
                                <li key={inp}>{inp.replace("_", " ")}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-slate-400 italic">No document requirements defined</p>
                          )}
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                          <span className="font-bold text-slate-700 block mb-1">Checklist Gates to Advance:</span>
                          {stage.completionRequirements.length > 0 ? (
                            <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                              {stage.completionRequirements.map((req) => (
                                <li key={req}>{req.replace("_", " ")}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-slate-400 italic">No checklist gates configured</p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                      <div>
                        <span>Permitted Next Steps: {stage.permittedTransitions.join(", ") || "Sequential flow"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Pre-Publish Change Preview Modal */}
      {showPreviewModal && draftVersionId && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Pre-Publish Workflow Version Review
                </h3>
                <p className="text-xs text-slate-500">
                  Confirm the changes for {selectedTemplate?.name} before activating.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowPreviewModal(false)}>
                <X className="size-4" />
              </Button>
            </div>

            {/* Crucial Pinned Version Guardrail Notice */}
            <div className="rounded-xl border border-sky-300 bg-sky-50 p-4 text-xs text-sky-950 space-y-1">
              <strong className="flex items-center gap-1.5 font-bold text-sky-900">
                <ShieldCheck className="size-4 text-sky-700 shrink-0" />
                Immutable Case History Guarantee:
              </strong>
              <p>
                Existing in-flight workstreams remain pinned to their current published version (v{activeVersion?.versionNumber}.0) and will NOT be modified.
                New workstreams created after publication will execute on this new version (v{nextVersionNumber}.0).
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider">Version Diff Summary</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                  <span className="font-bold text-slate-700 block">Current Published (v{activeVersion?.versionNumber}.0)</span>
                  <p className="mt-1 text-slate-600">{activeVersion?.stages.length} workflow stages</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200">
                  <span className="font-bold text-emerald-900 block">New Version to Publish (v{nextVersionNumber}.0)</span>
                  <p className="mt-1 text-emerald-800">{draftStages.length} workflow stages</p>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <span className="font-bold text-slate-700 block">Planned Stages:</span>
                <ol className="list-decimal list-inside space-y-1 text-slate-700">
                  {draftStages.map((s) => (
                    <li key={s.stageKey}>
                      <span className="font-semibold">{s.name}</span> ({s.responsibleOrgCode}) — SLA: {s.targetDurationDays}d
                      {s.isMilestoneGate && " · [Milestone Gate]"}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowPreviewModal(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handlePublishDraft()}
                disabled={designerBusy}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
              >
                Confirm & Publish Version v{nextVersionNumber}.0
              </Button>
            </div>
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
            <Button
              type="button"
              size="sm"
              onClick={() => setDesignerMessage("Complete the authorization form below, then save it through the administrator transaction.")}
              className="bg-[#00284d] text-white font-bold text-xs gap-1.5 shadow-none"
            >
              <Plus className="size-3.5" /> Add Authorization Type
            </Button>
          </div>

          <Card className="border-sky-200 bg-sky-50/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Register authorization type</CardTitle>
              <CardDescription>
                Creates a database-backed catalog record. The server validates administrator authority and the responsible organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <input
                aria-label="Authorization code"
                placeholder="Authorization code"
                value={permitForm.code}
                onChange={(event) => setPermitForm({ ...permitForm, code: event.target.value })}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <input
                aria-label="Authorization name"
                placeholder="Authorization name"
                value={permitForm.name}
                onChange={(event) => setPermitForm({ ...permitForm, name: event.target.value })}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <input
                aria-label="Responsible organization code"
                placeholder="Responsible organization code"
                value={permitForm.responsibleOrgCode}
                onChange={(event) => setPermitForm({ ...permitForm, responsibleOrgCode: event.target.value })}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <input
                aria-label="Statutory citation"
                placeholder="Statutory citation"
                value={permitForm.statutoryCitation}
                onChange={(event) => setPermitForm({ ...permitForm, statutoryCitation: event.target.value })}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <input
                aria-label="Regulatory trigger"
                placeholder="Regulatory trigger"
                value={permitForm.triggerExplanation}
                onChange={(event) => setPermitForm({ ...permitForm, triggerExplanation: event.target.value })}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              />
              <Button
                type="button"
                onClick={() => void registerPermitType()}
                disabled={designerBusy || !permitForm.code.trim() || !permitForm.name.trim()}
                className="bg-[#00284d] text-white md:col-span-2"
              >
                Save authorization type
              </Button>
            </CardContent>
          </Card>

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
                          <span>{res.verifiedBy && res.verifiedAt ? `Verified by ${res.verifiedBy} (${res.verifiedAt})` : "Verification record incomplete"}</span>
                          {res.url ? (
                            <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-0.5">
                              Open <ExternalLink className="size-3" />
                            </a>
                          ) : (
                            <span className="font-semibold text-slate-500">No link configured</span>
                          )}
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
            <Button
              type="button"
              size="sm"
              onClick={() => setDesignerMessage("Complete the organization form below, then save it through the administrator transaction.")}
              className="bg-[#00284d] text-white font-bold text-xs gap-1.5 shadow-none"
            >
              <Plus className="size-3.5" /> Register Organization
            </Button>
          </div>

          <Card className="border-sky-200 bg-sky-50/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Register organization</CardTitle>
              <CardDescription>
                Creates a database-backed organization record and immutable audit event.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <input
                aria-label="Organization code"
                placeholder="Organization code"
                value={organizationForm.code}
                onChange={(event) => setOrganizationForm({ ...organizationForm, code: event.target.value })}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <input
                aria-label="Organization name"
                placeholder="Organization name"
                value={organizationForm.name}
                onChange={(event) => setOrganizationForm({ ...organizationForm, name: event.target.value })}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <input
                aria-label="General contact email"
                placeholder="General contact email"
                value={organizationForm.generalContactEmail}
                onChange={(event) => setOrganizationForm({ ...organizationForm, generalContactEmail: event.target.value })}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
              />
              <Button
                type="button"
                onClick={() => void registerOrganization()}
                disabled={designerBusy || !organizationForm.code.trim() || !organizationForm.name.trim()}
                className="bg-[#00284d] text-white md:col-span-2"
              >
                Save organization
              </Button>
            </CardContent>
          </Card>

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
