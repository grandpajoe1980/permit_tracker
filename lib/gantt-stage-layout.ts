const DAY = 86_400_000;

export interface GanttStageInput {
  id: string;
  start?: string;
  end?: string;
  durationDays?: number | null;
}

function timestamp(value?: string) {
  if (!value) return undefined;
  const parsed = Date.parse(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Display-only demo forecast. Never writes estimated dates back to workflow history. */
export function layoutGanttStages(stages: GanttStageInput[], anchor: string) {
  let cursor = timestamp(anchor);
  let unscheduled = false;
  const intervals: Array<{ start: number; end: number; lane: number }> = [];
  return stages.map((stage) => {
    if (stage.durationDays === 0) unscheduled = true;
    if (unscheduled) return { id: stage.id, start: undefined, end: undefined, estimated: false, lane: 0 };
    const recordedStart = timestamp(stage.start);
    const recordedEnd = timestamp(stage.end);
    const duration = Number.isFinite(stage.durationDays) && stage.durationDays! > 0 ? stage.durationDays! : 10;
    const start = recordedStart ?? (recordedEnd === undefined ? cursor : recordedEnd - (duration - 1) * DAY);
    const end = recordedEnd !== undefined && start !== undefined && recordedEnd >= start
      ? recordedEnd + DAY
      : start === undefined ? undefined : start + duration * DAY;
    if (start === undefined || end === undefined) return { id: stage.id, start: undefined, end: undefined, estimated: false, lane: 0 };
    // An overlapping interval steps below every intersecting predecessor.
    // This preserves the staircase rather than alternating between reused lanes.
    const overlaps = intervals.filter((item) => item.start < end && item.end > start);
    const lane = overlaps.length ? Math.max(...overlaps.map((item) => item.lane)) + 1 : 0;
    intervals.push({ start, end, lane });
    cursor = Math.max(...intervals.map((item) => item.end));
    return {
      id: stage.id,
      start: new Date(start).toISOString().slice(0, 10),
      end: new Date(end - DAY).toISOString().slice(0, 10),
      estimated: recordedStart === undefined || recordedEnd === undefined,
      lane,
    };
  });
}
