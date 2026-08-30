import type {
  DelayReason,
  TaskDependencyRecord,
  TaskRecord,
  WorkstreamRecord,
} from "../domain-models";
import {
  addDaysToDate,
  calculateDateDiffDays,
  solveTaskDAG,
} from "./schedule-engine";

export interface SimulatedTaskAdjustment {
  taskId: string;
  originalDurationDays: number;
  simulatedDurationDays: number;
  durationDeltaDays: number;
  reason?: string;
}

export interface ScheduleScenario {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  isBaseline: boolean;
  isCurrentForecast: boolean;
  workstreams: WorkstreamRecord[];
  tasks: TaskRecord[];
  dependencies: TaskDependencyRecord[];
  projectStartDate: string;
  projectLaunchDate: string;
  totalDurationDays: number;
  varianceDaysFromBaseline: number;
  criticalTaskIds: string[];
  criticalWorkstreamIds: string[];
  adjustments: Record<string, SimulatedTaskAdjustment>;
}

export interface ScenarioComparison {
  baseScenarioId: string;
  targetScenarioId: string;
  targetScenarioName: string;
  launchDateDeltaDays: number; // Positive = delayed, negative = accelerated
  baseLaunchDate: string;
  simulatedLaunchDate: string;
  newlyCriticalWorkstreamIds: string[];
  resolvedCriticalWorkstreamIds: string[];
  workstreamDeltas: Array<{
    workstreamId: string;
    workstreamCode: string;
    workstreamTitle: string;
    leadAgencyCode: string;
    baseTargetDate: string;
    simulatedTargetDate: string;
    deltaDays: number;
    wasCritical: boolean;
    isNowCritical: boolean;
    floatDeltaDays: number;
  }>;
  summaryNarrative: string;
}

export interface SensitivityRiskItem {
  workstreamId: string;
  workstreamCode: string;
  workstreamTitle: string;
  currentFloatDays: number;
  isCritical: boolean;
  fragilityScore: number; // 100 = 0 float (slips launch immediately), 0 = 30+ days float
  riskCategory: "critical_path" | "high_risk" | "moderate_risk" | "resilient";
  impactExplanation: string;
}

/**
 * Deep clones workstreams, tasks, and dependencies
 */
function cloneWorkstreamData(workstreams: WorkstreamRecord[]) {
  const clonedWorkstreams: WorkstreamRecord[] = JSON.parse(JSON.stringify(workstreams));
  const allTasks = clonedWorkstreams.flatMap((ws) => ws.tasks);
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

  return { clonedWorkstreams, allTasks, dependencies };
}

/**
 * Builds a fresh ScheduleScenario from workstream data
 */
export function createScenarioFromWorkstreams(
  id: string,
  name: string,
  description: string,
  workstreams: WorkstreamRecord[],
  options: { isBaseline?: boolean; isCurrentForecast?: boolean } = {}
): ScheduleScenario {
  const { clonedWorkstreams, allTasks, dependencies } = cloneWorkstreamData(workstreams);
  const { criticalTaskIds, taskFloat } = solveTaskDAG(allTasks, dependencies);

  // Update tasks with calculated float and critical flags
  allTasks.forEach((t) => {
    t.floatDays = taskFloat.get(t.id) ?? t.floatDays;
    t.isCriticalPath = criticalTaskIds.has(t.id);
  });

  const criticalWorkstreamIds = clonedWorkstreams
    .filter((ws) => ws.tasks.some((t) => criticalTaskIds.has(t.id)) || ws.isCriticalPath)
    .map((ws) => ws.id);

  const projectStartDate = "2026-06-01";
  const baselineLaunchDate = "2026-12-15";
  const projectLaunchDate = options.isBaseline ? "2026-12-15" : "2026-12-28";
  const totalDurationDays = calculateDateDiffDays(projectStartDate, projectLaunchDate);
  const varianceDaysFromBaseline = calculateDateDiffDays(baselineLaunchDate, projectLaunchDate);

  return {
    id,
    name,
    description,
    createdAt: new Date().toISOString(),
    isBaseline: Boolean(options.isBaseline),
    isCurrentForecast: Boolean(options.isCurrentForecast),
    workstreams: clonedWorkstreams,
    tasks: allTasks,
    dependencies,
    projectStartDate,
    projectLaunchDate,
    totalDurationDays,
    varianceDaysFromBaseline,
    criticalTaskIds: Array.from(criticalTaskIds),
    criticalWorkstreamIds,
    adjustments: {},
  };
}

/**
 * Perturbs a task in the scenario and cascades downstream adjustments through the DAG
 */
export function applyTaskAdjustment(
  scenario: ScheduleScenario,
  taskId: string,
  durationDeltaDays: number,
  reason?: string
): ScheduleScenario {
  // Deep clone scenario for immutability
  const cloned = createScenarioFromWorkstreams(
    scenario.id,
    scenario.name,
    scenario.description,
    scenario.workstreams,
    {
      isBaseline: scenario.isBaseline,
      isCurrentForecast: scenario.isCurrentForecast,
    }
  );

  cloned.projectLaunchDate = scenario.projectLaunchDate;
  cloned.varianceDaysFromBaseline = scenario.varianceDaysFromBaseline;
  cloned.adjustments = { ...scenario.adjustments };

  const targetTask = cloned.tasks.find((t) => t.id === taskId);
  if (!targetTask) return cloned;

  const originalDuration = targetTask.durationDays;
  const newDuration = Math.max(1, originalDuration + durationDeltaDays);
  const actualDelta = newDuration - originalDuration;

  targetTask.durationDays = newDuration;

  cloned.adjustments[taskId] = {
    taskId,
    originalDurationDays: originalDuration,
    simulatedDurationDays: newDuration,
    durationDeltaDays: actualDelta,
    reason: reason || "Simulated duration adjustment",
  };

  // Re-solve DAG with updated durations
  const baseDAG = solveTaskDAG(scenario.tasks, scenario.dependencies);
  const newDAG = solveTaskDAG(cloned.tasks, cloned.dependencies);

  let oldMaxDuration = 0;
  baseDAG.taskEarlyFinish.forEach((ef) => {
    if (ef > oldMaxDuration) oldMaxDuration = ef;
  });

  let newMaxDuration = 0;
  newDAG.taskEarlyFinish.forEach((ef) => {
    if (ef > newMaxDuration) newMaxDuration = ef;
  });

  const projectDurationDelta = newMaxDuration - oldMaxDuration;

  // Update tasks with new metrics
  cloned.tasks.forEach((t) => {
    t.floatDays = newDAG.taskFloat.get(t.id) ?? t.floatDays;
    t.isCriticalPath = newDAG.criticalTaskIds.has(t.id);
  });

  cloned.criticalTaskIds = Array.from(newDAG.criticalTaskIds);

  if (projectDurationDelta !== 0) {
    cloned.projectLaunchDate = addDaysToDate(cloned.projectLaunchDate, projectDurationDelta);
  }

  // Update workstream forecast dates based on task adjustments
  cloned.workstreams.forEach((ws) => {
    const wsTasks = cloned.tasks.filter((t) => t.workstreamId === ws.id);
    if (wsTasks.length > 0) {
      ws.isCriticalPath = wsTasks.some((t) => newDAG.criticalTaskIds.has(t.id));
      if (wsTasks.some((t) => t.id === taskId)) {
        ws.forecastTargetDate = addDaysToDate(ws.forecastTargetDate, actualDelta);
        ws.scheduleVarianceDays = Math.max(
          0,
          calculateDateDiffDays(ws.baselineTargetDate, ws.forecastTargetDate)
        );
      }
    }
  });


  cloned.criticalWorkstreamIds = cloned.workstreams
    .filter((ws) => ws.isCriticalPath)
    .map((ws) => ws.id);

  cloned.totalDurationDays = calculateDateDiffDays(
    cloned.projectStartDate,
    cloned.projectLaunchDate
  );

  const baselineLaunchDate = "2026-12-15";
  cloned.varianceDaysFromBaseline = calculateDateDiffDays(
    baselineLaunchDate,
    cloned.projectLaunchDate
  );

  return cloned;
}


/**
 * Compares two scenarios and generates a comprehensive delta report
 */
export function compareScenarios(
  baseScenario: ScheduleScenario,
  targetScenario: ScheduleScenario
): ScenarioComparison {
  const launchDelta = calculateDateDiffDays(
    baseScenario.projectLaunchDate,
    targetScenario.projectLaunchDate
  );

  const baseCriticalSet = new Set(baseScenario.criticalWorkstreamIds);
  const targetCriticalSet = new Set(targetScenario.criticalWorkstreamIds);

  const newlyCriticalWorkstreamIds = targetScenario.criticalWorkstreamIds.filter(
    (id) => !baseCriticalSet.has(id)
  );
  const resolvedCriticalWorkstreamIds = baseScenario.criticalWorkstreamIds.filter(
    (id) => !targetCriticalSet.has(id)
  );

  const workstreamDeltas = targetScenario.workstreams.map((tWs) => {
    const bWs = baseScenario.workstreams.find((w) => w.id === tWs.id) || tWs;
    const deltaDays = calculateDateDiffDays(
      bWs.forecastTargetDate || bWs.baselineTargetDate,
      tWs.forecastTargetDate || tWs.baselineTargetDate
    );

    const bTasks = baseScenario.tasks.filter((t) => t.workstreamId === bWs.id);
    const tTasks = targetScenario.tasks.filter((t) => t.workstreamId === tWs.id);

    const bMinFloat = bTasks.length > 0 ? Math.min(...bTasks.map((t) => t.floatDays)) : 0;
    const tMinFloat = tTasks.length > 0 ? Math.min(...tTasks.map((t) => t.floatDays)) : 0;

    return {
      workstreamId: tWs.id,
      workstreamCode: tWs.code,
      workstreamTitle: tWs.title,
      leadAgencyCode: tWs.regulatoryLead.orgCode,
      baseTargetDate: bWs.forecastTargetDate || bWs.baselineTargetDate,
      simulatedTargetDate: tWs.forecastTargetDate || tWs.baselineTargetDate,
      deltaDays,
      wasCritical: baseCriticalSet.has(tWs.id),
      isNowCritical: targetCriticalSet.has(tWs.id),
      floatDeltaDays: tMinFloat - bMinFloat,
    };
  });

  let summaryNarrative = "";
  if (launchDelta > 0) {
    summaryNarrative = `Scenario "${targetScenario.name}" results in a +${launchDelta} day slip to project launch (Forecast: ${targetScenario.projectLaunchDate}).`;
    if (newlyCriticalWorkstreamIds.length > 0) {
      summaryNarrative += ` ${newlyCriticalWorkstreamIds.length} workstream(s) flipped onto the critical path.`;
    }
  } else if (launchDelta < 0) {
    summaryNarrative = `Scenario "${targetScenario.name}" accelerates project launch by ${Math.abs(launchDelta)} days (New Target: ${targetScenario.projectLaunchDate}).`;
  } else {
    summaryNarrative = `Scenario "${targetScenario.name}" maintains current launch target date (${targetScenario.projectLaunchDate}) by absorbing changes within float buffers.`;
  }

  return {
    baseScenarioId: baseScenario.id,
    targetScenarioId: targetScenario.id,
    targetScenarioName: targetScenario.name,
    launchDateDeltaDays: launchDelta,
    baseLaunchDate: baseScenario.projectLaunchDate,
    simulatedLaunchDate: targetScenario.projectLaunchDate,
    newlyCriticalWorkstreamIds,
    resolvedCriticalWorkstreamIds,
    workstreamDeltas,
    summaryNarrative,
  };
}

/**
 * Evaluates schedule sensitivity and identifies fragile workstreams
 */
export function calculateScheduleSensitivity(
  scenario: ScheduleScenario
): SensitivityRiskItem[] {
  return scenario.workstreams.map((ws) => {
    const wsTasks = scenario.tasks.filter((t) => t.workstreamId === ws.id);
    const isCritical = scenario.criticalWorkstreamIds.includes(ws.id) || ws.isCriticalPath;
    const minFloat = wsTasks.length > 0
      ? Math.min(...wsTasks.map((t) => t.floatDays))
      : (isCritical ? 0 : 45);

    let fragilityScore = 0;
    let riskCategory: SensitivityRiskItem["riskCategory"] = "resilient";
    let impactExplanation = "Has ample float buffer; delays will not impact launch.";

    if (isCritical || minFloat === 0) {
      fragilityScore = 100;
      riskCategory = "critical_path";
      impactExplanation = "Zero float on controlling critical path. Every 1 day of slip directly delays launch.";
    } else if (minFloat <= 3) {
      fragilityScore = 85;
      riskCategory = "high_risk";
      impactExplanation = `Near-critical path with only ${minFloat} days float. A minor slip will flip this onto the critical path.`;
    } else if (minFloat <= 10) {
      fragilityScore = 50;
      riskCategory = "moderate_risk";
      impactExplanation = `${minFloat} days float buffer available before becoming critical.`;
    } else {
      fragilityScore = 15;
      riskCategory = "resilient";
      impactExplanation = `${minFloat} days float buffer. Highly resilient to operational variance.`;
    }

    return {
      workstreamId: ws.id,
      workstreamCode: ws.code,
      workstreamTitle: ws.title,
      currentFloatDays: isCritical ? 0 : minFloat,
      isCritical,
      fragilityScore,
      riskCategory,
      impactExplanation,
    };
  }).sort((a, b) => b.fragilityScore - a.fragilityScore);
}


/**
 * Returns pre-built realistic "What-If" scenarios for SpaceX Pecan Island
 */
export function getScenarioPresets(baseWorkstreams: WorkstreamRecord[]): ScheduleScenario[] {
  const baseForecast = createScenarioFromWorkstreams(
    "scenario-active-forecast",
    "Active Forecast",
    "Current live forecast incorporating +13d LA-82 variance.",
    baseWorkstreams,
    { isCurrentForecast: true }
  );

  // Preset 1: USACE Public Comment 15-day extension
  const usaceTask = baseForecast.tasks.find((t) => t.workstreamId === "WS-WETLANDS-PAD-A" && t.status !== "completed");
  const preset1 = applyTaskAdjustment(
    createScenarioFromWorkstreams(
      "preset-usace-extension",
      "USACE Public Notice Extension (+15d)",
      "Simulates federal public comment extension requested by environmental stakeholders.",
      baseWorkstreams
    ),
    usaceTask?.id || "task-usace-2",
    15,
    "Federal 15-day public comment extension"
  );

  // Preset 2: CPRA Drainage Fast-Track (-10 days)
  const cpraTask = baseForecast.tasks.find((t) => t.workstreamId === "WS-LA82-HEAVYHAUL" && t.id === "task-dotd-3");
  const preset2 = applyTaskAdjustment(
    createScenarioFromWorkstreams(
      "preset-cpra-fasttrack",
      "CPRA Drainage Fast-Track (-10d)",
      "Simulates dedicated multi-agency engineering sprint resolving Culvert 14B hydrodynamic concurrence in 5 days instead of 15.",
      baseWorkstreams
    ),
    cpraTask?.id || "task-dotd-3",
    -10,
    "Expedited joint CPRA/DOTD coastal engineering clearance"
  );

  // Preset 3: Tropical Storm Work Stoppage (+12 days)
  const padATask = baseForecast.tasks.find((t) => t.workstreamId === "WS-WETLANDS-PAD-A");
  const preset3 = applyTaskAdjustment(
    createScenarioFromWorkstreams(
      "preset-tropical-storm",
      "Gulf Coast Tropical Storm Hold (+12d)",
      "Simulates coastal evacuation and post-storm site inspection across all outdoor civil construction workstreams.",
      baseWorkstreams
    ),
    padATask?.id || "task-usace-1",
    12,
    "Gulf Coast weather hold and site recertification"
  );

  return [baseForecast, preset1, preset2, preset3];
}
