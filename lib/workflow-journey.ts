import type {
  TaskRecord,
  WorkflowStageRecord,
  WorkflowTemplateRecord,
} from "./domain-models";

export type WorkflowJourneyStageState =
  | "completed"
  | "current"
  | "waiting"
  | "blocked"
  | "upcoming"
  | "not_recorded"
  | "waived";

export interface WorkflowJourneyStageRun {
  id: string;
  stageId?: string;
  stageKey?: string;
  status: "active" | "completed" | "cancelled" | string;
  startedAt?: string;
  completedAt?: string;
  completionNotes?: string;
}

export interface WorkflowJourneySource {
  id: string;
  currentStageId?: string;
  currentStageName?: string;
  workflowVersionId?: string;
  permitTypeId?: string;
  operationalState?: string;
  operationalStateLabel?: string;
  waitingReason?: string;
  waitingOnEntity?: string;
  baselineTargetDate?: string;
  forecastTargetDate?: string;
  tasks?: Array<Partial<TaskRecord> & Pick<TaskRecord, "id" | "title">>;
  stages?: WorkflowStageRecord[];
  stageRuns?: WorkflowJourneyStageRun[];
}
export interface WorkflowJourneyStage {
  id: string;
  sequence: number;
  label: string;
  customerLabel: string;
  state: WorkflowJourneyStageState;
  ownerOrgCode?: string;
  ownerName?: string;
  targetDate?: string;
  actualCompletionDate?: string;
  completionNotes?: string;
  targetDurationDays?: number;
  minimumStatutoryDays?: number;
  requiredInputs: string[];
  isMilestoneGate: boolean;
  isParallel: boolean;
}

export interface WorkflowJourneyModel {
  stages: WorkflowJourneyStage[];
  currentStages: WorkflowJourneyStage[];
  currentStageIndex: number;
  completedCount: number;
  summary: string;
}

function normalized(value?: string) {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sameStage(a?: string, b?: string) {
  const left = normalized(a);
  const right = normalized(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function activeTemplateStages(source: WorkflowJourneySource, templates: WorkflowTemplateRecord[]) {
  const template = templates.find((candidate) => candidate.permitTypeId === source.permitTypeId);
  if (!template) return [];
  const version = source.workflowVersionId
    ? template.versions.find((candidate) => candidate.id === source.workflowVersionId)
    : undefined;
  return (version ?? template.versions.find((candidate) => candidate.versionNumber === template.activeVersionNumber) ?? template.versions[0])?.stages ?? [];
}

function stateForTask(task: Partial<TaskRecord>, stageRun?: WorkflowJourneyStageRun): WorkflowJourneyStageState {
  if (stageRun?.status === "completed") return "completed";
  if (stageRun?.status === "cancelled") return "waived";
  switch (task.status) {
    case "completed": return "completed";
    case "waived": return "waived";
    case "blocked": return "blocked";
    case "waiting": return "waiting";
    case "in_progress": return "current";
    default: return "upcoming";
  }
}

export function buildWorkflowJourney(source: WorkflowJourneySource, templates: WorkflowTemplateRecord[] = []): WorkflowJourneyModel {
  const tasks = (source.tasks ?? []).filter((task) => task.id && task.title);
  const definitions = source.stages?.length ? source.stages : activeTemplateStages(source, templates);
  const stages: WorkflowJourneyStage[] = tasks.length > 0
    ? tasks.map((task, index) => {
        const definition = definitions.find((candidate) => candidate.id === task.stageId || candidate.stageKey === (task as { stageKey?: string }).stageKey) ?? definitions[index];
        const stageRun = (source.stageRuns ?? []).find((run) => run.stageId === task.stageId || run.stageKey === (task as { stageKey?: string }).stageKey);
        const state = stateForTask(task, stageRun);
        return {
          id: task.id,
          sequence: index + 1,
          label: task.title,
          customerLabel: definition?.customerVisibilityLabel ?? task.title,
          state,
          ownerOrgCode: task.assignedOrgCode ?? definition?.responsibleOrgCode,
          ownerName: task.assignedUserName,
          targetDate: state === "completed" ? (stageRun?.completedAt ?? task.actualCompletionDate ?? task.forecastDueDate ?? task.baselineDueDate) : (task.forecastDueDate ?? task.baselineDueDate),
          actualCompletionDate: stageRun?.completedAt ?? task.actualCompletionDate,
          completionNotes: stageRun?.completionNotes,
          targetDurationDays: task.durationDays ?? definition?.targetDurationDays,
          minimumStatutoryDays: definition?.minimumStatutoryDays,
          requiredInputs: definition?.requiredInputs ?? [],
          isMilestoneGate: task.isMilestone ?? definition?.isMilestoneGate ?? false,
          isParallel: definition?.canRunInParallel ?? false,
        };
      })
    : definitions.map((definition) => {
        const stageRun = (source.stageRuns ?? []).find((run) => run.stageId === definition.id || run.stageKey === definition.stageKey);
        return {
          id: definition.id,
          sequence: definition.sequenceOrder,
          label: definition.name,
          customerLabel: definition.customerVisibilityLabel,
          state: stageRun?.status === "completed" ? "completed" as WorkflowJourneyStageState : stageRun?.status === "cancelled" ? "waived" as WorkflowJourneyStageState : "upcoming" as WorkflowJourneyStageState,
          ownerOrgCode: definition.responsibleOrgCode,
          targetDate: stageRun?.status === "completed" ? stageRun.completedAt : undefined,
          actualCompletionDate: stageRun?.completedAt,
          completionNotes: stageRun?.completionNotes,
          targetDurationDays: definition.targetDurationDays,
          minimumStatutoryDays: definition.minimumStatutoryDays,
          requiredInputs: definition.requiredInputs,
          isMilestoneGate: definition.isMilestoneGate,
          isParallel: definition.canRunInParallel,
        };
      });

  const currentByIdentity = stages.findIndex((stage) =>
    sameStage(stage.id, source.currentStageId) ||
    sameStage(stage.label, source.currentStageName) ||
    sameStage(stage.customerLabel, source.currentStageName)
  );
  const firstActive = stages.findIndex((stage) => ["current", "waiting", "blocked"].includes(stage.state));
  const firstUpcoming = stages.findIndex((stage) => stage.state === "upcoming");
  const currentStageIndex = currentByIdentity >= 0 ? currentByIdentity : firstActive >= 0 ? firstActive : firstUpcoming;

  if (tasks.length === 0 && currentStageIndex >= 0) {
    stages.forEach((stage, index) => {
      if (index < currentStageIndex && !["completed", "waived"].includes(stage.state)) stage.state = "not_recorded";
      else if (index === currentStageIndex) stage.state = source.operationalState?.includes("blocked")
        ? "blocked"
        : source.operationalState?.includes("waiting")
          ? "waiting"
          : "current";
    });
  }

  const currentStages = stages.filter((stage) => ["current", "waiting", "blocked"].includes(stage.state));
  const completedCount = stages.filter((stage) => ["completed", "waived"].includes(stage.state)).length;
  const current = currentStages[0];
  const summary = current
    ? `${current.customerLabel} · ${current.sequence} of ${stages.length}`
    : stages.length > 0
      ? `${completedCount} of ${stages.length} steps recorded`
      : "Workflow steps are not available";

  return {
    stages,
    currentStages,
    currentStageIndex: currentStageIndex >= 0 ? currentStageIndex : 0,
    completedCount,
    summary,
  };
}
