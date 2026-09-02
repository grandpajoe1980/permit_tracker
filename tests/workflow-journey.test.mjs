import assert from "node:assert/strict";
import test, { after } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});
after(async () => vite.close());

test("builds an ordered past-now-next journey from workstream tasks", async () => {
  const { buildWorkflowJourney } = await vite.ssrLoadModule("/lib/workflow-journey.ts");
  const { workstreamsData } = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");
  const workstream = workstreamsData.find((candidate) => candidate.code === "WS-LA82-HEAVYHAUL");
  const journey = buildWorkflowJourney(workstream);

  assert.equal(journey.stages.length, 4);
  assert.equal(journey.stages[0].state, "completed");
  assert.equal(journey.stages[1].state, "current");
  assert.equal(journey.stages[2].state, "blocked");
  assert.equal(journey.stages[3].state, "upcoming");
  assert.equal(journey.completedCount, 1);
  assert.match(journey.summary, /2 of 4|Culvert 14B/);
});

test("does not invent completed history when only workflow definitions exist", async () => {
  const { buildWorkflowJourney } = await vite.ssrLoadModule("/lib/workflow-journey.ts");
  const source = { id: "ws-1", currentStageName: "Technical review", operationalState: "running", permitTypeId: "permit-1" };
  const templates = [{
    id: "template-1",
    permitTypeId: "permit-1",
    name: "Permit workflow",
    activeVersionNumber: 1,
    versions: [{
      id: "version-1", templateId: "template-1", versionNumber: 1, status: "published",
      stages: [
        { id: "s1", workflowVersionId: "version-1", stageKey: "intake", name: "Intake", customerVisibilityLabel: "Application received", sequenceOrder: 1, responsibleOrgId: "state", responsibleOrgCode: "STATE", targetDurationDays: 2, minimumStatutoryDays: 0, requiredInputs: [], completionRequirements: [], permittedTransitions: ["review"], canRunInParallel: false, isMilestoneGate: false },
        { id: "s2", workflowVersionId: "version-1", stageKey: "review", name: "Technical review", customerVisibilityLabel: "Technical review", sequenceOrder: 2, responsibleOrgId: "agency", responsibleOrgCode: "AGENCY", targetDurationDays: 5, minimumStatutoryDays: 0, requiredInputs: [], completionRequirements: [], permittedTransitions: ["complete"], canRunInParallel: false, isMilestoneGate: true },
      ],
    }],
  }];
  const journey = buildWorkflowJourney(source, templates);
  assert.equal(journey.stages[0].state, "not_recorded");
  assert.equal(journey.stages[1].state, "current");
});

test("renders role-safe full journey and hides internal assignees for customers", async () => {
  const { WorkflowJourney } = await vite.ssrLoadModule("/components/cockpits/WorkflowJourney.tsx");
  const source = {
    id: "ws-1",
    currentStageName: "Technical review",
    operationalState: "running",
    tasks: [
      { id: "s1", title: "Intake validation", status: "completed", assignedOrgCode: "STATE", assignedUserName: "Internal Reviewer" },
      { id: "s2", title: "Technical review", status: "in_progress", assignedOrgCode: "DOTD", assignedUserName: "Internal Reviewer" },
    ],
  };
  const html = renderToStaticMarkup(React.createElement(WorkflowJourney, { source, customerSafe: true }));
  assert.match(html, /What happened, what is happening, what happens next/);
  assert.match(html, /Workflow journey/);
  assert.match(html, /Technical review/);
  assert.doesNotMatch(html, /Internal Reviewer/);
});
