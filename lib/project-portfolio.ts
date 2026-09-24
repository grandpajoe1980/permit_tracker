export interface ProjectWorkstreamCounts {
  open: number;
  blocked: number;
  waiting: number;
  completed: number;
}

export function summarizeProjectWorkstreams(
  rows: ReadonlyArray<{ project_id: unknown; operational_state: unknown }>,
  allowedProjectIds: ReadonlyArray<string>,
): Record<string, ProjectWorkstreamCounts> {
  const allowed = new Set(allowedProjectIds);
  const summaries: Record<string, ProjectWorkstreamCounts> = Object.fromEntries(
    allowedProjectIds.map((projectId) => [projectId, { open: 0, blocked: 0, waiting: 0, completed: 0 }]),
  );

  for (const row of rows) {
    const projectId = String(row.project_id ?? "");
    if (!allowed.has(projectId)) continue;
    const counts = summaries[projectId];
    const state = String(row.operational_state ?? "");
    if (state === "complete") {
      counts.completed += 1;
      continue;
    }
    if (state === "cancelled") continue;
    counts.open += 1;
    if (state === "blocked" || state === "escalated") counts.blocked += 1;
    else if (state.startsWith("waiting_") || state === "scheduled_hold" || state === "statutory_waiting_period") counts.waiting += 1;
  }
  return summaries;
}
