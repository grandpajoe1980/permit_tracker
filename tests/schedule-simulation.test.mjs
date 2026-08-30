import test, { after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

const {
  applyTaskAdjustment,
  calculateScheduleSensitivity,
  compareScenarios,
  createScenarioFromWorkstreams,
  getScenarioPresets,
} = await vite.ssrLoadModule("/lib/engines/simulation-engine.ts");

const { workstreamsData } = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");


test("Simulation Engine: builds baseline and active forecast scenarios", () => {
  const scenario = createScenarioFromWorkstreams(
    "sc-test",
    "Test Forecast",
    "Test forecast scenario",
    workstreamsData,
    { isCurrentForecast: true }
  );

  assert.equal(scenario.id, "sc-test");
  assert.equal(scenario.isCurrentForecast, true);
  assert.ok(scenario.tasks.length > 0);
  assert.ok(scenario.criticalTaskIds.length > 0);
  assert.ok(scenario.criticalWorkstreamIds.length > 0);
  assert.ok(scenario.projectLaunchDate);
  assert.ok(scenario.varianceDaysFromBaseline >= 13);
});

test("Simulation Engine: perturbs critical path task and ripples launch date", () => {
  const baseScenario = createScenarioFromWorkstreams(
    "sc-base",
    "Base",
    "Base",
    workstreamsData
  );

  const initialLaunch = baseScenario.projectLaunchDate;
  // Choose task-usace-2 which is on the controlling 100-day critical path
  const criticalTaskId = baseScenario.criticalTaskIds.find((id) => id.includes("usace")) || baseScenario.criticalTaskIds[0];
  assert.ok(criticalTaskId, "Critical task should exist");

  // Adjust duration by +10 days
  const perturbed = applyTaskAdjustment(baseScenario, criticalTaskId, 10, "Engineering delay");
  assert.ok(perturbed.adjustments[criticalTaskId]);
  assert.equal(perturbed.adjustments[criticalTaskId].durationDeltaDays, 10);
  assert.notEqual(perturbed.projectLaunchDate, initialLaunch);
  assert.ok(perturbed.varianceDaysFromBaseline > baseScenario.varianceDaysFromBaseline);
});


test("Simulation Engine: perturbs non-critical task within float without shifting launch date", () => {
  const baseScenario = createScenarioFromWorkstreams(
    "sc-base",
    "Base",
    "Base",
    workstreamsData
  );

  // Find a task with float > 5 days
  const resilientTask = baseScenario.tasks.find((t) => t.floatDays > 5);
  if (resilientTask) {
    const initialLaunch = baseScenario.projectLaunchDate;
    const perturbed = applyTaskAdjustment(baseScenario, resilientTask.id, 2, "Minor administrative slip");
    
    // Changing by 2 days when float > 5 should not move the launch date
    assert.equal(perturbed.projectLaunchDate, initialLaunch);
  }
});

test("Simulation Engine: compares scenarios and generates executive delta narrative", () => {
  const baseScenario = createScenarioFromWorkstreams(
    "sc-base",
    "Live Forecast",
    "Live Forecast",
    workstreamsData
  );

  const criticalTaskId = baseScenario.criticalTaskIds.find((id) => id.includes("usace")) || baseScenario.criticalTaskIds[0];

  const targetScenario = applyTaskAdjustment(
    baseScenario,
    criticalTaskId,
    15,
    "15-day delay"
  );
  targetScenario.name = "USACE Review Extension";

  const comparison = compareScenarios(baseScenario, targetScenario);
  assert.equal(comparison.baseScenarioId, "sc-base");
  assert.ok(comparison.launchDateDeltaDays > 0);
  assert.ok(comparison.summaryNarrative.includes("results in a +"));
  assert.ok(comparison.workstreamDeltas.length > 0);
});


test("Simulation Engine: calculates schedule sensitivity and fragility rankings", () => {
  const scenario = createScenarioFromWorkstreams(
    "sc-base",
    "Base",
    "Base",
    workstreamsData
  );

  const sensitivity = calculateScheduleSensitivity(scenario);
  assert.ok(sensitivity.length > 0);
  
  // Top item should be critical path with fragility 100
  assert.equal(sensitivity[0].fragilityScore, 100);
  assert.equal(sensitivity[0].riskCategory, "critical_path");
  assert.equal(sensitivity[0].currentFloatDays, 0);

  // Bottom item should have float buffer
  const lastItem = sensitivity[sensitivity.length - 1];
  assert.ok(lastItem.currentFloatDays >= 0);
});

test("Simulation Engine: returns pre-built scenario presets for SpaceX Pecan Island", () => {
  const presets = getScenarioPresets(workstreamsData);
  assert.equal(presets.length, 4);

  const names = presets.map((p) => p.name);
  assert.ok(names.includes("Active Forecast"));
  assert.ok(names.some((n) => n.includes("USACE")));
  assert.ok(names.some((n) => n.includes("CPRA")));
  assert.ok(names.some((n) => n.includes("Tropical Storm")));
});

