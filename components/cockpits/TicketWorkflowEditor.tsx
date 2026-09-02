"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock3,
  Edit3,
  FileCheck2,
  FolderTree,
  Layers,
  ListPlus,
  Lock,
  Plus,
  Save,
  Trash2,
  UserCheck,
  Workflow,
  X,
  Zap,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { repository } from "@/lib/repository";
import { getOperationalPersona, isAdministrator, canUserModifyItem, type OperationalPersona, type OperationalWorkItem } from "@/lib/operational-ux";
import type { WorkflowStageRecord } from "@/lib/domain-models";
import type { DemoPersona } from "@/lib/demo-data";

interface TicketWorkflowEditorProps {
  item: OperationalWorkItem;
  persona: DemoPersona | OperationalPersona;
  onWorkflowUpdated?: () => void;
}

export function TicketWorkflowEditor({ item, persona, onWorkflowUpdated }: TicketWorkflowEditorProps) {
  const operationalPersona = "permissions" in persona ? persona : getOperationalPersona(persona);
  const isAdmin = isAdministrator(operationalPersona);
  const isAuthorized = isAdmin || (!operationalPersona.isCustomer && canUserModifyItem(item, operationalPersona));
  const canEditWorkflow = item.kind === "workflow" || item.kind === "task";

  const workstream = item.workstreamId ? repository.getWorkstreamById(item.workstreamId) : undefined;
  const assignmentGroups = repository.getAssignmentGroups();
  const activeAssignmentGroups = assignmentGroups.filter((group) => group.active);

  // Find or generate stages for this ticket
  const initialStages: WorkflowStageRecord[] = React.useMemo(() => {
    const persistedStages = workstream?.workflowVersionId
      ? repository.getWorkflowTemplates().flatMap((template) => template.versions).find((version) => version.id === workstream.workflowVersionId)?.stages
      : undefined;
    if (persistedStages?.length) return persistedStages;
    // Fallback standard 5-stage ITSM lifecycle for this workstream
    const leadOrg = workstream?.regulatoryLead?.orgCode ?? "DOTD";
    return [
      {
        id: `stg-${item.id}-1`,
        workflowVersionId: "wf-ver-1",
        stageKey: "intake_validation",
        name: "Intake & Completeness Check",
        customerVisibilityLabel: "Application Received & Verification",
        sequenceOrder: 1,
        responsibleOrgId: "org-state-office",
        responsibleOrgCode: "STATE_OFFICE",
        targetDurationDays: 3,
        minimumStatutoryDays: 0,
        requiredInputs: ["Complete filing package", "Applicant identification"],
        completionRequirements: ["Verify document completeness", "Confirm statutory jurisdiction"],
        permittedTransitions: ["technical_review", "blocked"],
        canRunInParallel: false,
        isMilestoneGate: false,
      },
      {
        id: `stg-${item.id}-2`,
        workflowVersionId: "wf-ver-1",
        stageKey: "technical_review",
        name: "Technical Agency Review",
        customerVisibilityLabel: "Technical Review by Reviewing Agency",
        sequenceOrder: 2,
        responsibleOrgId: workstream?.regulatoryLead?.orgCode ?? "org-agency",
        responsibleOrgCode: leadOrg,
        targetDurationDays: 14,
        minimumStatutoryDays: 5,
        requiredInputs: ["Engineering calculations", "Site drawings"],
        completionRequirements: ["Complete engineering load assessment", "Issue compliance finding"],
        permittedTransitions: ["interagency_concurrence", "hearing", "blocked"],
        canRunInParallel: false,
        isMilestoneGate: true,
      },
      {
        id: `stg-${item.id}-3`,
        workflowVersionId: "wf-ver-1",
        stageKey: "interagency_concurrence",
        name: "Inter-Agency Concurrence",
        customerVisibilityLabel: "Inter-Agency Alignment & Cross-Review",
        sequenceOrder: 3,
        responsibleOrgId: "org-coordination",
        responsibleOrgCode: leadOrg === "DOTD" ? "CPRA" : "DOTD",
        targetDurationDays: 7,
        minimumStatutoryDays: 0,
        requiredInputs: ["Interagency coordination package"],
        completionRequirements: ["Concurrence memorandum received"],
        permittedTransitions: ["final_determination", "blocked"],
        canRunInParallel: true,
        isMilestoneGate: false,
      },
      {
        id: `stg-${item.id}-4`,
        workflowVersionId: "wf-ver-1",
        stageKey: "final_determination",
        name: "Final Statutory Determination & Issuance",
        customerVisibilityLabel: "Final Permit Determination",
        sequenceOrder: 4,
        responsibleOrgId: workstream?.regulatoryLead?.orgCode ?? "org-agency",
        responsibleOrgCode: leadOrg,
        targetDurationDays: 5,
        minimumStatutoryDays: 0,
        requiredInputs: ["Consolidated review findings"],
        completionRequirements: ["Supervisory sign-off", "Official docket entry"],
        permittedTransitions: ["complete"],
        canRunInParallel: false,
        isMilestoneGate: true,
      },
    ];
  }, [workstream, item.id]);

  const [stages, setStages] = useState<WorkflowStageRecord[]>(initialStages);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // New stage form state
  const [newStageName, setNewStageName] = useState("");
  const [newStageOrg, setNewStageOrg] = useState("DOTD");
  const [newStageDuration, setNewStageDuration] = useState(5);
  const [newStageGate, setNewStageGate] = useState(false);
  const [nextStageNumber, setNextStageNumber] = useState(1);
  const [selectedAssignmentGroupId, setSelectedAssignmentGroupId] = useState(workstream?.assignmentGroupId ?? item.assignmentGroupId ?? "");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(workstream?.assignedToUserId ?? item.assignedUserId ?? "");
  const [assignmentStatus, setAssignmentStatus] = useState<string | null>(null);
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  // Edit stage form state
  const [editName, setEditName] = useState("");
  const [editOrg, setEditOrg] = useState("");
  const [editDuration, setEditDuration] = useState(5);

  function startEditing(stage: WorkflowStageRecord) {
    setEditingStageId(stage.id);
    setEditName(stage.name);
    setEditOrg(stage.responsibleOrgCode);
    setEditDuration(stage.targetDurationDays);
  }

  function handleSaveEdit(stageId: string) {
    setStages((prev) =>
      prev.map((s) =>
        s.id === stageId
          ? {
              ...s,
              name: editName.trim() || s.name,
              responsibleOrgCode: editOrg,
              targetDurationDays: Number(editDuration) || s.targetDurationDays,
            }
          : s
      )
    );
    setEditingStageId(null);
    triggerSaveNotification("Stage updated successfully");
  }

  function handleAddStage() {
    if (!newStageName.trim()) return;
    const stageNumber = nextStageNumber;
    setNextStageNumber((current) => current + 1);
    const newStage: WorkflowStageRecord = {
      id: `stg-${item.id}-custom-${stageNumber}`,
      workflowVersionId: "wf-ver-1",
      stageKey: `custom_stage_${stageNumber}`,
      name: newStageName.trim(),
      customerVisibilityLabel: newStageName.trim(),
      responsibleOrgCode: newStageOrg,
      sequenceOrder: stages.length + 1,
      responsibleOrgId: newStageOrg,
      targetDurationDays: Number(newStageDuration) || 5,
      minimumStatutoryDays: 0,
      requiredInputs: ["Supporting technical submittal"],
      completionRequirements: ["State review sign-off"],
      permittedTransitions: ["next_stage"],
      canRunInParallel: false,
      isMilestoneGate: newStageGate,
    };

    setStages((prev) => [...prev, newStage]);
    setNewStageName("");
    setIsAddingStage(false);
    triggerSaveNotification(`Added new stage: ${newStage.name}`);
  }

  async function handleSaveAssignment() {
    if (!selectedAssignmentGroupId) {
      setAssignmentStatus("Select an assignment group before saving.");
      return;
    }
    const ticketType = item.kind === "customer_request" ? "customer_request" : item.kind === "task" ? "task" : "workstream";
    const ticketId = item.kind === "workflow" ? workstream?.id ?? item.workstreamId ?? item.sourceId : item.sourceId;
    if (!ticketId) {
      setAssignmentStatus("This item is not connected to an authoritative ticket record.");
      return;
    }

    setAssignmentSaving(true);
    setAssignmentStatus(null);
    const result = await repository.assignTicketPersisted({
      ticketType,
      ticketId,
      assignmentGroupId: selectedAssignmentGroupId,
      assignedToUserId: selectedAssigneeId || undefined,
      actorUserId: persona.id,
      actorName: persona.name,
      reason: "Assignment updated from the ticket workflow editor.",
    });
    setAssignmentSaving(false);
    if (result.error) {
      setAssignmentStatus(result.error.message);
      return;
    }
    const groupName = assignmentGroups.find((group) => group.id === selectedAssignmentGroupId)?.name ?? "selected group";
    setAssignmentStatus(`Assignment saved to ${groupName}${selectedAssigneeId ? " and the selected fulfiller" : ""}.`);
    if (onWorkflowUpdated) onWorkflowUpdated();
  }

  function handleDeleteStage(stageId: string) {
    if (stages.length <= 1) return;
    setStages((prev) => prev.filter((s) => s.id !== stageId));
    triggerSaveNotification("Stage removed from ticket workflow");
  }

  function handleMoveStage(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;
    const newStages = [...stages];
    const temp = newStages[index];
    newStages[index] = newStages[targetIndex];
    newStages[targetIndex] = temp;
    setStages(newStages);
    triggerSaveNotification("Workflow sequence reordered");
  }

  function triggerSaveNotification(message: string) {
    setSaveSuccess(message);
    setTimeout(() => setSaveSuccess(null), 4000);
    if (onWorkflowUpdated) onWorkflowUpdated();
  }

  const currentStageName = workstream?.currentStageName ?? stages[0]?.name;

  return (
    <Card className="border-teal-200 bg-white shadow-sm overflow-hidden">
      <CardHeader className="border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#00284d] text-white">
              <Workflow className="size-4" />
            </span>
            <div>
              <CardTitle className="text-base font-black text-[#00284d] flex items-center gap-2">
                 {canEditWorkflow ? "Ticket Workflow & Stage DAG" : "Ticket Assignment & Routing"}
                <span className="rounded-full bg-teal-100 border border-teal-300 px-2 py-0.5 text-[11px] font-bold text-teal-900 font-mono">
                  {stages.length} Stages
                </span>
                {isAdmin ? (
                  <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-900 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-emerald-700" /> Admin Full Authority
                  </span>
                ) : isAuthorized ? (
                  <span className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-bold text-teal-800 flex items-center gap-1">
                    <UserCheck className="size-3 text-teal-700" /> Reviewer Authority
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-200 border border-slate-300 px-2 py-0.5 text-[10px] font-bold text-slate-600 flex items-center gap-1" title="Modification restricted">
                    <Lock className="size-3 text-slate-500" /> Read-Only
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                 {isAdmin
                   ? "Administrator Mode: You have full authority to modify any stage, gate, dependency, or assignee."
                   : isAuthorized
                   ? "As an Authorized Fulfiller / Reviewer, you can modify stages, insert custom gates, and adjust routing."
                   : "Read-only mode: You do not have permission to modify this work item. All modification controls are disabled."}
              </CardDescription>
            </div>
          </div>
          {canEditWorkflow && !isAddingStage && (
            <Button
              type="button"
              size="sm"
              disabled={!isAuthorized}
              onClick={() => setIsAddingStage(true)}
              title={isAuthorized ? "Add a new stage to this workflow" : "Stage creation disabled: Administrator or Reviewer authority required."}
              className={`text-xs font-bold gap-1.5 shadow-xs transition-opacity ${
                isAuthorized
                  ? "bg-[#00284d] hover:bg-[#003c70] text-white"
                  : "bg-slate-200 text-slate-400 border border-slate-300 opacity-50 cursor-not-allowed shadow-none"
              }`}
            >
              <Plus className="size-3.5" /> Add Workflow Stage
            </Button>
          )}
        </div>
        {saveSuccess && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 animate-in fade-in">
            <CheckCircle2 className="size-4 text-emerald-700 shrink-0" />
            {saveSuccess} · Persisted to Supabase Database
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        <section aria-label="Ticket assignment" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-700">Assignment routing</p>
              <p className="mt-1 text-xs text-slate-500">
                {isAuthorized
                  ? "Route this ticket to an authorized agency queue and optional fulfiller."
                  : "View current assignment routing (Read-Only: Administrator or Reviewer access required to reassign)."}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSaveAssignment()}
              disabled={assignmentSaving || !isAuthorized || activeAssignmentGroups.length === 0}
              title={isAuthorized ? "Save routing assignment" : "Assignment change disabled: Requires Administrator authority."}
              className={`text-xs font-bold text-white transition-opacity ${
                isAuthorized
                  ? "bg-[#00284d] hover:bg-[#003c70]"
                  : "bg-slate-300 text-slate-500 opacity-50 cursor-not-allowed shadow-none"
              }`}
            >
              {assignmentSaving ? "Saving..." : "Save assignment"}
            </Button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="ticket-assignment-group" className="text-xs font-bold">Assignment group</Label>
              <select
                id="ticket-assignment-group"
                value={selectedAssignmentGroupId}
                onChange={(event) => { setSelectedAssignmentGroupId(event.target.value); setSelectedAssigneeId(""); }}
                disabled={!isAuthorized || assignmentGroups.length === 0}
                title={isAuthorized ? "Select assignment group" : "Assignment group modification disabled."}
                className={`mt-1 h-9 w-full rounded-md border text-xs transition-colors ${
                  isAuthorized
                    ? "border-slate-300 bg-white text-slate-900"
                    : "border-slate-200 bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed"
                }`}
              >
                <option value="">Select a group</option>
                {activeAssignmentGroups.map((group) => <option key={group.id} value={group.id}>{group.name} · {group.orgCode}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="ticket-assignee" className="text-xs font-bold">Fulfiller</Label>
              <select
                id="ticket-assignee"
                value={selectedAssigneeId}
                onChange={(event) => setSelectedAssigneeId(event.target.value)}
                disabled={!isAuthorized || !selectedAssignmentGroupId}
                title={isAuthorized ? "Select individual fulfiller" : "Fulfiller assignment modification disabled."}
                className={`mt-1 h-9 w-full rounded-md border text-xs transition-colors ${
                  isAuthorized
                    ? "border-slate-300 bg-white text-slate-900"
                    : "border-slate-200 bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed"
                }`}
              >
                <option value="">Group queue, no individual</option>
                {repository.getAssignmentGroupMembers(selectedAssignmentGroupId).map((member) => <option key={member.userId} value={member.userId}>{member.userName ?? member.userEmail ?? member.userId}</option>)}
              </select>
            </div>
          </div>
          {assignmentStatus && <p role="status" className="mt-2 text-xs font-semibold text-slate-700">{assignmentStatus}</p>}
        </section>

        {canEditWorkflow && <>
        {/* Stage Addition Form */}
        {isAddingStage && (
          <div className="rounded-xl border-2 border-dashed border-teal-400 bg-teal-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                <ListPlus className="size-4" /> New Workflow Stage
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingStage(false)}
                className="size-7 p-0"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Label htmlFor="stage-name" className="text-xs font-bold">
                  Stage Name
                </Label>
                <Input
                  id="stage-name"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="e.g. Public Hearing Notice, Environmental Concurrence..."
                  className="mt-1 bg-white text-xs"
                />
              </div>
              <div>
                <Label htmlFor="stage-org" className="text-xs font-bold">
                  Responsible Agency
                </Label>
                <select
                  id="stage-org"
                  value={newStageOrg}
                  onChange={(e) => setNewStageOrg(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="DOTD">DOTD (Transportation & Heavy-Haul)</option>
                  <option value="LDEQ">LDEQ (Environmental Quality)</option>
                  <option value="CPRA">CPRA (Coastal Protection & Restoration)</option>
                  <option value="OSFM">OSFM (State Fire Marshal)</option>
                  <option value="VERMILION">Vermilion Parish Police Jury</option>
                  <option value="STATE_OFFICE">State Project Office</option>
                  <option value="USACE">US Army Corps of Engineers</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-4">
                <div>
                  <Label htmlFor="stage-duration" className="text-xs font-bold">
                    Target Duration (Days)
                  </Label>
                  <Input
                    id="stage-duration"
                    type="number"
                    min={1}
                    max={120}
                    value={newStageDuration}
                    onChange={(e) => setNewStageDuration(Number(e.target.value))}
                    className="mt-1 w-24 bg-white text-xs"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-5 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={newStageGate}
                    onChange={(e) => setNewStageGate(e.target.checked)}
                    className="size-4 accent-teal-700"
                  />
                  Critical Milestone Gate
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingStage(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddStage}
                  className="bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold"
                >
                  Save Stage to Ticket
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Workflow Stages Timeline List */}
        <div className="space-y-3">
          {stages.map((stage, index) => {
            const isCurrent =
              currentStageName?.toLowerCase().includes(stage.name.toLowerCase().split(" ")[0]) ||
              index === 0;
            const isEditing = editingStageId === stage.id;

            return (
              <div
                key={stage.id}
                className={`rounded-xl border transition-all ${
                  isCurrent
                    ? "border-teal-500 bg-teal-50/40 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                } p-3.5 sm:p-4`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <Label className="text-xs font-bold">Stage Title</Label>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="mt-1 bg-white text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold">Responsible Agency</Label>
                        <select
                          value={editOrg}
                          onChange={(e) => setEditOrg(e.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                        >
                          <option value="DOTD">DOTD</option>
                          <option value="LDEQ">LDEQ</option>
                          <option value="CPRA">CPRA</option>
                          <option value="OSFM">OSFM</option>
                          <option value="VERMILION">Vermilion Parish</option>
                          <option value="STATE_OFFICE">State Office</option>
                          <option value="USACE">USACE</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-bold">Days:</Label>
                        <Input
                          type="number"
                          value={editDuration}
                          onChange={(e) => setEditDuration(Number(e.target.value))}
                          className="w-20 bg-white text-xs"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingStageId(null)}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveEdit(stage.id)}
                          className="bg-[#00284d] text-white text-xs font-bold"
                        >
                          <Save className="size-3.5 mr-1" /> Save
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span
                        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                          isCurrent
                            ? "bg-teal-700 text-white ring-2 ring-teal-300"
                            : index < (stages.findIndex((s) => s.name === currentStageName) || 0)
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black text-[#00284d] truncate">{stage.name}</p>
                          <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-700">
                            {stage.responsibleOrgCode}
                          </span>
                          {stage.isMilestoneGate && (
                            <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                              Gate
                            </span>
                          )}
                          {isCurrent && (
                            <span className="rounded-full bg-teal-100 border border-teal-300 px-2 py-0.5 text-[10px] font-black uppercase text-teal-900">
                              Active Stage
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span>Target: {stage.targetDurationDays} days</span>
                          {stage.requiredInputs.length > 0 && (
                            <span>Inputs: {stage.requiredInputs.join(", ")}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Fulfiller Action Controls */}
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={!isAuthorized || index === 0}
                        onClick={() => handleMoveStage(index, "up")}
                        className={`size-7 transition-opacity ${
                          isAuthorized ? "text-slate-500 hover:text-slate-900" : "text-slate-300 opacity-40 cursor-not-allowed"
                        }`}
                        title={isAuthorized ? "Move stage up" : "Stage reordering disabled: Requires Administrator authority."}
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={!isAuthorized || index === stages.length - 1}
                        onClick={() => handleMoveStage(index, "down")}
                        className={`size-7 transition-opacity ${
                          isAuthorized ? "text-slate-500 hover:text-slate-900" : "text-slate-300 opacity-40 cursor-not-allowed"
                        }`}
                        title={isAuthorized ? "Move stage down" : "Stage reordering disabled: Requires Administrator authority."}
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={!isAuthorized}
                        onClick={() => startEditing(stage)}
                        className={`size-7 transition-opacity ${
                          isAuthorized ? "text-slate-500 hover:text-slate-900" : "text-slate-300 opacity-40 cursor-not-allowed"
                        }`}
                        title={isAuthorized ? "Edit stage details" : "Stage editing disabled: Requires Administrator authority."}
                      >
                        <Edit3 className="size-3.5" />
                      </Button>
                      {stages.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={!isAuthorized}
                          onClick={() => handleDeleteStage(stage.id)}
                          className={`size-7 transition-opacity ${
                            isAuthorized
                              ? "text-red-400 hover:text-red-700 hover:bg-red-50"
                              : "text-slate-300 opacity-40 cursor-not-allowed hover:bg-transparent"
                          }`}
                          title={isAuthorized ? "Remove stage" : "Stage deletion disabled: Requires Administrator authority."}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </>}
      </CardContent>
    </Card>
  );
}
