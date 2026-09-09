import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
const vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
after(() => vite.close());
const { layoutGanttStages } = await vite.ssrLoadModule("/lib/gantt-stage-layout.ts");

test("undated stages abut recorded steps with configured duration or a ten-day default", () => {
  const result = layoutGanttStages([
    { id: "a", start: "2026-09-01", end: "2026-09-05", durationDays: 5 },
    { id: "b", durationDays: 3 },
    { id: "c" },
  ], "2026-09-01");
  assert.deepEqual(result.map(({ start, end }) => [start, end]), [
    ["2026-09-01", "2026-09-05"], ["2026-09-06", "2026-09-08"], ["2026-09-09", "2026-09-18"],
  ]);
  assert.equal(result[0].estimated, false);
  assert.equal(result[1].estimated, true);
});

test("explicit zero leaves that stage and all successors unscheduled without changing inputs", () => {
  const input = [{ id: "a", durationDays: 2 }, { id: "b", durationDays: 0 }, { id: "c", durationDays: 4 }];
  const original = structuredClone(input);
  const result = layoutGanttStages(input, "2026-09-01");
  assert.equal(result[0].end, "2026-09-02");
  assert.equal(result[1].start, undefined);
  assert.equal(result[2].start, undefined);
  assert.deepEqual(input, original);
});

test("overlap chains staircase down while adjacent dates share the top track", () => {
  const result = layoutGanttStages([
    { id: "a", start: "2026-09-01", end: "2026-09-04" },
    { id: "b", start: "2026-09-03", end: "2026-09-06" },
    { id: "c", start: "2026-09-05", end: "2026-09-08" },
    { id: "d", durationDays: 2 },
  ], "2026-09-01");
  assert.deepEqual(result.map((row) => row.lane), [0, 1, 2, 0]);
  assert.equal(result[3].start, "2026-09-09");
});

test("in-progress stage keeps its start and gets its configured demo finish", () => {
  const result = layoutGanttStages([{ id: "a", start: "2026-09-05", durationDays: 4 }, { id: "b", durationDays: null }], "2026-09-01");
  assert.equal(result[0].end, "2026-09-08");
  assert.equal(result[1].start, "2026-09-09");
  assert.equal(result[1].end, "2026-09-18");
});
