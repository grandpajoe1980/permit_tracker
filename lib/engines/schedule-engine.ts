import type {
  DelayReason,
  TaskDependencyRecord,
  TaskRecord,
  WorkstreamRecord,
} from "../domain-models";

export interface ScheduleCalculationResult {
  criticalPathTaskIds: string[];
  projectDurationDays: number;
  totalVarianceDays: number;
  controllingWorkstreamIds: string[];
  tasksWithFloat: Array<{ taskId: string; floatDays: number; isCritical: boolean }>;
  delaySummary: Record<DelayReason, number>;
  accelerationOpportunities: Array<{
    workstreamId: string;
    title: string;
    potentialDaysSaved: number;
    explanation: string;
  }>;
}

/**
 * Calculates day difference between two ISO date strings (YYYY-MM-DD)
 */
export function calculateDateDiffDays(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diffTime = end.getTime() - start.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Adds days to an ISO date string (YYYY-MM-DD)
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

/**
 * Computes critical path and schedule float across a DAG of tasks.
 */
export function solveTaskDAG(
  tasks: TaskRecord[],
  dependencies: TaskDependencyRecord[]
): {
  criticalTaskIds: Set<string>;
  taskEarlyFinish: Map<string, number>;
  taskFloat: Map<string, number>;
} {
  const taskMap = new Map<string, TaskRecord>();
  tasks.forEach((t) => taskMap.set(t.id, t));

  // Build adjacency lists
  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  tasks.forEach((t) => {
    successors.set(t.id, []);
    predecessors.set(t.id, []);
  });

  dependencies.forEach((dep) => {
    successors.get(dep.predecessorTaskId)?.push(dep.successorTaskId);
    predecessors.get(dep.successorTaskId)?.push(dep.predecessorTaskId);
  });

  // Forward Pass (Earliest Start / Earliest Finish)
  const earlyStart = new Map<string, number>();
  const earlyFinish = new Map<string, number>();

  // Helper for topological order / memoized forward pass
  function computeEarly(taskId: string): number {
    if (earlyFinish.has(taskId)) return earlyFinish.get(taskId)!;
    const preds = predecessors.get(taskId) || [];
    let maxPredFinish = 0;
    for (const predId of preds) {
      const predFinish = computeEarly(predId);
      if (predFinish > maxPredFinish) maxPredFinish = predFinish;
    }
    const duration = taskMap.get(taskId)?.durationDays ?? 5;
    const es = maxPredFinish;
    const ef = es + duration;
    earlyStart.set(taskId, es);
    earlyFinish.set(taskId, ef);
    return ef;
  }

  tasks.forEach((t) => computeEarly(t.id));

  // Find project max completion time
  let maxProjectDuration = 0;
  earlyFinish.forEach((ef) => {
    if (ef > maxProjectDuration) maxProjectDuration = ef;
  });

  // Backward Pass (Latest Start / Latest Finish)
  const lateFinish = new Map<string, number>();
  const lateStart = new Map<string, number>();

  function computeLate(taskId: string): number {
    if (lateStart.has(taskId)) return lateStart.get(taskId)!;
    const succs = successors.get(taskId) || [];
    let minSuccStart = maxProjectDuration;
    for (const succId of succs) {
      const succLateStart = computeLate(succId);
      if (succLateStart < minSuccStart) minSuccStart = succLateStart;
    }
    const duration = taskMap.get(taskId)?.durationDays ?? 5;
    const lf = minSuccStart;
    const ls = lf - duration;
    lateFinish.set(taskId, lf);
    lateStart.set(taskId, ls);
    return ls;
  }

  tasks.forEach((t) => computeLate(t.id));

  // Compute Total Float and identify Critical Path (Float <= 0)
  const taskFloat = new Map<string, number>();
  const criticalTaskIds = new Set<string>();

  tasks.forEach((t) => {
    const es = earlyStart.get(t.id) ?? 0;
    const ls = lateStart.get(t.id) ?? 0;
    const float = Math.max(0, ls - es);
    taskFloat.set(t.id, float);
    if (float === 0 || t.isCriticalPath) {
      criticalTaskIds.add(t.id);
    }
  });

  return { criticalTaskIds, taskEarlyFinish: earlyFinish, taskFloat };
}

/**
 * Aggregates delay variance by delay category across workstreams
 */
export function aggregateDelayReasons(workstreams: WorkstreamRecord[]): Record<DelayReason, number> {
  const summary: Record<DelayReason, number> = {
    applicant_information: 0,
    agency_workload: 0,
    interagency_dependency: 0,
    statutory_minimum: 0,
    public_comment: 0,
    engineering_change: 0,
    environmental_discovery: 0,
    legal_challenge: 0,
    third_party_utility: 0,
    weather: 0,
    procurement: 0,
    scheduling: 0,
    none: 0,
  };

  for (const ws of workstreams) {
    if (ws.scheduleVarianceDays > 0) {
      const reason = ws.primaryDelayReason || "other";
      summary[reason] = (summary[reason] || 0) + ws.scheduleVarianceDays;
    }
  }

  return summary;
}

/**
 * Identifies parallel acceleration opportunities in workstreams
 */
export function detectAccelerationOpportunities(
  workstreams: WorkstreamRecord[]
): Array<{
  workstreamId: string;
  title: string;
  potentialDaysSaved: number;
  explanation: string;
}> {
  const opportunities: Array<{
    workstreamId: string;
    title: string;
    potentialDaysSaved: number;
    explanation: string;
  }> = [];

  for (const ws of workstreams) {
    // Check if workstream is waiting on an interagency review that could run concurrently
    if (
      ws.operationalState === "waiting_government" &&
      ws.waitingOnEntity &&
      ws.scheduleVarianceDays >= 0
    ) {
      opportunities.push({
        workstreamId: ws.id,
        title: ws.title,
        potentialDaysSaved: Math.min(14, Math.max(5, ws.scheduleVarianceDays || 10)),
        explanation: `${ws.waitingOnEntity} coordination can proceed concurrently with current engineering review rather than sequentially.`,
      });
    }
  }

  return opportunities;
}

/**
 * Main schedule engine orchestrator
 */
export function evaluateProjectSchedule(
  workstreams: WorkstreamRecord[]
): ScheduleCalculationResult {
  const allTasks = workstreams.flatMap((ws) => ws.tasks);
  
  // Synthesize dependencies between tasks
  const dependencies: TaskDependencyRecord[] = [];
  allTasks.forEach((t) => {
    t.predecessorTaskIds.forEach((predId) => {
      dependencies.push({
        id: `dep-${predId}-${t.id}`,
        predecessorTaskId: predId,
        successorTaskId: t.id,
        dependencyType: "finish_to_start",
        gateType: "AND",
        lagDays: 0,
        isControlling: t.isCriticalPath,
      });
    });
  });

  const { criticalTaskIds, taskFloat } = solveTaskDAG(allTasks, dependencies);

  const controllingWorkstreamIds = workstreams
    .filter((ws) => ws.isCriticalPath || ws.scheduleVarianceDays > 5)
    .map((ws) => ws.id);

  const totalVarianceDays = workstreams.reduce(
    (max, ws) => Math.max(max, ws.scheduleVarianceDays),
    0
  );

  const tasksWithFloat = allTasks.map((t) => ({
    taskId: t.id,
    floatDays: taskFloat.get(t.id) ?? t.floatDays,
    isCritical: criticalTaskIds.has(t.id),
  }));

  const delaySummary = aggregateDelayReasons(workstreams);
  const accelerationOpportunities = detectAccelerationOpportunities(workstreams);

  return {
    criticalPathTaskIds: Array.from(criticalTaskIds),
    projectDurationDays: 180 + totalVarianceDays,
    totalVarianceDays,
    controllingWorkstreamIds,
    tasksWithFloat,
    delaySummary,
    accelerationOpportunities,
  };
}
