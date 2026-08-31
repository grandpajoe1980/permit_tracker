import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

test("Gantt Schedule Bars [Feature]: Renders Traditional Schedule Timeline Bars with State Colors & Legend", async () => {
  const { WorkstreamGraphGantt, STATE_COLOR_MAP } = await vite.ssrLoadModule("/components/cockpits/WorkstreamGraphGantt.tsx");

  // 1. Verify STATE_COLOR_MAP contains all standard operational states
  const expectedStates = [
    "running",
    "waiting_applicant",
    "waiting_government",
    "waiting_external",
    "statutory_waiting_period",
    "scheduled_hold",
    "blocked",
    "escalated",
    "complete",
    "cancelled",
  ];

  for (const state of expectedStates) {
    assert.ok(STATE_COLOR_MAP[state], `STATE_COLOR_MAP must have entry for state '${state}'`);
    assert.ok(STATE_COLOR_MAP[state].label, `State '${state}' must have descriptive label`);
    assert.ok(STATE_COLOR_MAP[state].barColor, `State '${state}' must have barColor`);
    assert.ok(STATE_COLOR_MAP[state].dotColor, `State '${state}' must have dotColor`);
  }

  // 2. Render WorkstreamGraphGantt to static markup
  const html = renderToStaticMarkup(React.createElement(WorkstreamGraphGantt));

  // 3. Verify Gantt Header and Title
  assert.match(html, /Project Delivery Schedule &amp; Variance Engine|Project Delivery Schedule & Variance Engine/);
  assert.match(html, /Gantt Schedule Bar State Legend &amp; Visual Code|Gantt Schedule Bar State Legend & Visual Code/);

  // 4. Verify Legend contains operational states
  assert.match(html, /Running/);
  assert.match(html, /Waiting Applicant/);
  assert.match(html, /Interagency Wait/);
  assert.match(html, /Statutory Notice/);
  assert.match(html, /Baseline Target/);
  assert.match(html, /Today \([A-Za-z]{3} \d{1,2}\)/);

  // 5. Verify Timeline Month Headers
  assert.match(html, /May 2026/);
  assert.match(html, /Jun 2026/);
  assert.match(html, /Jul 2026/);
  assert.match(html, /Aug 2026/);
  assert.match(html, /Sep 2026/);
  assert.match(html, /Oct 2026/);
  assert.match(html, /Nov 2026/);
  assert.match(html, /Dec 2026/);

  // 6. Verify Workstreams and Traditional Bars Rendered
  assert.match(html, /WS-LA82-HEAVYHAUL/);
  assert.match(html, /LA-82 Heavy-Haul Access &amp; Bridge Reinforcement|LA-82 Heavy-Haul Access & Bridge Reinforcement/);
  assert.match(html, /WS-WETLANDS-PAD-A/);
  assert.match(html, /Launch Pad A – Wetland &amp; Coastal Authorization|Launch Pad A – Wetland & Coastal Authorization/);
  assert.match(html, /WS-WASTEWATER-DELUGE/);
  assert.match(html, /WS-GAS-LNG-PIPELINE/);
  assert.match(html, /WS-PUBLIC-SAFETY-AIRSPACE/);
  assert.match(html, /WS-HIGHBAY-OSFM/);
  assert.match(html, /WS-WORKFORCE-CONSORTIUM/);
  assert.match(html, /WS-PREAPP-SUBSTATION-PH2/);

  // 7. Verify Critical Path and Agency Badges
  assert.match(html, /Critical Path/);
  assert.match(html, /DOTD/);
  assert.match(html, /USACE/);
  assert.match(html, /LDEQ/);

  // 8. Verify Baseline Sub-Bars and Forecast Bars are Present
  assert.match(html, /Baseline:/);
  assert.match(html, /\+7d/);
  assert.match(html, /\+13d/);

  // 9. Verify 12-Column Table Headers
  assert.match(html, /Workstream \/ DAG Node/);
  assert.match(html, /Lead Agency/);
  assert.match(html, /Baseline Target/);
  assert.match(html, /Current Forecast/);
  assert.match(html, /Variance &amp; Controlling Path|Variance & Controlling Path/);
});

test("Gantt Schedule Bars [Customer Safe]: Renders Customer-Safe Project Schedule with Interactive Bars", async () => {
  const { WorkstreamGraphGantt } = await vite.ssrLoadModule("/components/cockpits/WorkstreamGraphGantt.tsx");

  const html = renderToStaticMarkup(React.createElement(WorkstreamGraphGantt, { customerSafe: true }));

  assert.match(html, /SpaceX project schedule/);
  assert.match(html, /Customer-safe project schedule/);
  assert.match(html, /Gantt Schedule Bar State Legend/);
  assert.match(html, /WS-LA82-HEAVYHAUL/);
  assert.match(html, /WS-WETLANDS-PAD-A/);
});
