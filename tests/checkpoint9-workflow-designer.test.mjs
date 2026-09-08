import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, ws: false },
});

after(async () => {
  await vite.close();
});

test("Checkpoint 9: TicketWorkflowEditor clearly labels live editing as This work item", async () => {
  const { TicketWorkflowEditor } = await vite.ssrLoadModule("/components/cockpits/TicketWorkflowEditor.tsx");
  const { repository } = await vite.ssrLoadModule("/lib/repository.ts");
  const ws = repository.getWorkstreamById("WS-LA82-HEAVYHAUL");
  assert.ok(ws);
  ws.workflowVersionId = "wv-coastal-v4";

  const mockItem = {
    id: "item-1",
    kind: "workflow",
    title: ws.title,
    workstreamId: ws.id,
    sourceId: ws.id,
  };

  const persona = {
    id: "admin-1",
    name: "Admin User",
    email: "admin@state.gov",
    role: "admin",
    roleId: "admin",
    workspace: "admin",
    permissions: ["admin", "edit_workflow", "manage_roles"],
  };

  const html = renderToStaticMarkup(React.createElement(TicketWorkflowEditor, { item: mockItem, persona }));

  // Asserts "This work item" badge and label
  assert.match(html, /This work item/);
  assert.match(html, /This work item: Workflow &amp; Stage DAG|This work item: Workflow & Stage DAG/);
  assert.match(html, /Pinned to/);
  assert.match(html, /Administration &gt; Workflows|Administration > Workflows/);
});

test("Checkpoint 9: WorkflowDesignerPanel renders dynamic version numbers and no hardcoded v4/v5 guardrail", async () => {
  const { WorkflowDesignerPanel } = await vite.ssrLoadModule("/components/cockpits/WorkflowDesignerPanel.tsx");
  const source = await readFile(new URL("../components/cockpits/WorkflowDesignerPanel.tsx", import.meta.url), "utf8");

  const html = renderToStaticMarkup(React.createElement(WorkflowDesignerPanel));

  // Must render dynamic published version
  assert.match(html, /Published v4\.0/);
  assert.match(html, /Create Draft v5\.0/);

  // Must NOT have static hardcoded string "assigned version (v4)" or "draft version (v5)"
  assert.doesNotMatch(source, /assigned version \(v4\)/);
  assert.doesNotMatch(source, /draft version \(v5\)/);

  // Must have dynamic template expressions
  assert.match(source, /assigned version \(v\{activeVersion\.versionNumber\}\.0\)/);
  assert.match(source, /draft version \(v\{nextVersionNumber\}\.0\)/);
});

test("Checkpoint 9: draft lifecycle handlers use the consolidated draft state setter", async () => {
  const source = await readFile(new URL("../components/cockpits/WorkflowDesignerPanel.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /setDraftVersionId\(/);
  assert.doesNotMatch(source, /setDraftStages\(/);
  assert.match(source, /persistDraftChanges\(clonedStages, newDraftId\)/);
  assert.match(source, /setDraftState\(\{ draftVersionId: null, draftStages: \[\] \}\)/);
});

test("Checkpoint 9: validateWorkflowDraft catches unreachable stages, cycles, missing owners, and SLA violations", async () => {
  const { validateWorkflowDraft } = await vite.ssrLoadModule("/lib/engines/workflow-engine.ts");

  // Valid workflow baseline
  const validStages = [
    {
      id: "s1",
      workflowVersionId: "v-test",
      stageKey: "intake",
      name: "Intake Review",
      customerVisibilityLabel: "Intake",
      sequenceOrder: 1,
      responsibleOrgId: "DOTD",
      responsibleOrgCode: "DOTD",
      targetDurationDays: 5,
      minimumStatutoryDays: 0,
      requiredInputs: ["application_form"],
      completionRequirements: ["Verify application"],
      permittedTransitions: ["technical_review"],
      canRunInParallel: false,
      isMilestoneGate: false,
    },
    {
      id: "s2",
      workflowVersionId: "v-test",
      stageKey: "technical_review",
      name: "Technical Review",
      customerVisibilityLabel: "Technical Review",
      sequenceOrder: 2,
      responsibleOrgId: "LDEQ",
      responsibleOrgCode: "LDEQ",
      targetDurationDays: 14,
      minimumStatutoryDays: 5,
      requiredInputs: ["engineering_plans"],
      completionRequirements: ["Engineering signoff"],
      permittedTransitions: ["complete"],
      canRunInParallel: false,
      isMilestoneGate: true,
    },
  ];

  const validResult = validateWorkflowDraft({ stages: validStages });
  assert.equal(validResult.valid, true);
  assert.equal(validResult.errors.length, 0);

  // 1. Missing owner
  const missingOwnerStages = JSON.parse(JSON.stringify(validStages));
  missingOwnerStages[0].responsibleOrgCode = "";
  const missingOwnerResult = validateWorkflowDraft({ stages: missingOwnerStages });
  assert.equal(missingOwnerResult.valid, false);
  assert.ok(missingOwnerResult.errors.some((e) => e.includes("missing an owning agency")));

  // 2. SLA target less than statutory minimum
  const slaViolationStages = JSON.parse(JSON.stringify(validStages));
  slaViolationStages[1].targetDurationDays = 3;
  slaViolationStages[1].minimumStatutoryDays = 10;
  const slaResult = validateWorkflowDraft({ stages: slaViolationStages });
  assert.equal(slaResult.valid, false);
  assert.ok(slaResult.errors.some((e) => e.includes("cannot be less than mandatory statutory minimum")));

  // 3. Milestone gate with no completion criteria
  const gateViolationStages = JSON.parse(JSON.stringify(validStages));
  gateViolationStages[1].completionRequirements = [];
  const gateResult = validateWorkflowDraft({ stages: gateViolationStages });
  assert.equal(gateResult.valid, false);
  assert.ok(gateResult.errors.some((e) => e.includes("no completion criteria configured")));

  // 4. Unreachable stage
  const unreachableStages = [
    ...validStages,
    {
      id: "s3",
      workflowVersionId: "v-test",
      stageKey: "isolated_stage",
      name: "Orphan Stage",
      customerVisibilityLabel: "Orphan",
      sequenceOrder: 3,
      responsibleOrgId: "CPRA",
      responsibleOrgCode: "CPRA",
      targetDurationDays: 7,
      minimumStatutoryDays: 0,
      requiredInputs: [],
      completionRequirements: ["Done"],
      permittedTransitions: ["complete"],
      canRunInParallel: false,
      isMilestoneGate: false,
    },
  ];
  // Note: validStages[0] transitions to technical_review, which transitions to complete.
  // isolated_stage is never referenced by intake or technical_review!
  const unreachableResult = validateWorkflowDraft({ stages: unreachableStages });
  assert.equal(unreachableResult.valid, false);
  assert.ok(unreachableResult.unreachableStages.includes("isolated_stage"));
  assert.ok(unreachableResult.errors.some((e) => e.includes("unreachable from the initial workflow stage")));

  // 5. Prohibited cycle with no path to completion
  const cyclicStages = [
    {
      id: "c1",
      workflowVersionId: "v-test",
      stageKey: "loop_a",
      name: "Loop A",
      customerVisibilityLabel: "Loop A",
      sequenceOrder: 1,
      responsibleOrgId: "DOTD",
      responsibleOrgCode: "DOTD",
      targetDurationDays: 5,
      minimumStatutoryDays: 0,
      requiredInputs: [],
      completionRequirements: ["ok"],
      permittedTransitions: ["loop_b"],
      canRunInParallel: false,
      isMilestoneGate: false,
    },
    {
      id: "c2",
      workflowVersionId: "v-test",
      stageKey: "loop_b",
      name: "Loop B",
      customerVisibilityLabel: "Loop B",
      sequenceOrder: 2,
      responsibleOrgId: "LDEQ",
      responsibleOrgCode: "LDEQ",
      targetDurationDays: 5,
      minimumStatutoryDays: 0,
      requiredInputs: [],
      completionRequirements: ["ok"],
      permittedTransitions: ["loop_a"], // Points back to loop_a without any exit to complete!
      canRunInParallel: false,
      isMilestoneGate: false,
    },
  ];
  const cyclicResult = validateWorkflowDraft({ stages: cyclicStages });
  assert.equal(cyclicResult.valid, false);
  assert.ok(cyclicResult.cyclicStages.length > 0);
  assert.ok(cyclicResult.errors.some((e) => e.includes("Prohibited cycle detected")));
});

test("Checkpoint 9 Gate: Save/reopen draft, observe validation failure, correct it, publish, create new work, verify existing instance remains pinned", async () => {
  const { repository } = await vite.ssrLoadModule("/lib/repository.ts");

  const templates = repository.getWorkflowTemplates();
  assert.ok(templates.length > 0);
  const targetTemplate = templates[0];
  const initialActiveVerNumber = targetTemplate.activeVersionNumber;
  const initialActiveVersion = targetTemplate.versions.find((v) => v.status === "published");
  assert.ok(initialActiveVersion);
  const oldVersionId = initialActiveVersion.id;

  // Step 1: Create an existing workstream pinned to the current version
  const existingWsResult = await repository.createWorkstreamFromRequestPersisted({
    requestId: "req-gate-1",
    code: "WS-GATE-OLD",
    title: "Existing Case Prior To New Workflow",
    category: "coastal",
    permitTypeId: targetTemplate.id,
    workflowVersionId: oldVersionId,
  });
  assert.ok(existingWsResult.data);
  const existingWorkstreamId = existingWsResult.data.workstreamId;
  const existingWorkstream = repository.getWorkstreamById(existingWorkstreamId);
  assert.equal(existingWorkstream?.workflowVersionId, oldVersionId);

  // Step 2: Create a draft version
  const draftResult = await repository.createWorkflowDraftPersisted({
    templateId: targetTemplate.id,
    changeSummary: "Authoring revised SLA and checklist standards",
  });
  assert.ok(draftResult.data);
  const draftVersionId = draftResult.data.draftVersionId;
  const newExpectedVersionNumber = draftResult.data.versionNumber;

  // Verify reopening retrieves the exact draft
  const reopenedDraft = repository.getWorkflowDraft(targetTemplate.id);
  assert.ok(reopenedDraft);
  assert.equal(reopenedDraft.id, draftVersionId);
  assert.equal(reopenedDraft.status, "draft");

  // Step 3: Introduce an invalid stage into the draft and observe validation failure
  const decisionStage = reopenedDraft.stages.find((s) => s.stageKey === "decision");
  if (decisionStage) {
    decisionStage.permittedTransitions = ["faulty_stage", "issued", "denied"];
  }

  const invalidStage = {
    id: `${draftVersionId}-invalid`,
    workflowVersionId: draftVersionId,
    stageKey: "faulty_stage",
    name: "Faulty Stage With Violation",
    customerVisibilityLabel: "Faulty",
    sequenceOrder: reopenedDraft.stages.length + 1,
    responsibleOrgId: "DOTD",
    responsibleOrgCode: "DOTD",
    targetDurationDays: 2, // Violates minimum statutory!
    minimumStatutoryDays: 10,
    requiredInputs: [],
    completionRequirements: ["Verify"],
    permittedTransitions: ["complete"],
    canRunInParallel: false,
    isMilestoneGate: false,
  };
  await repository.addWorkflowDraftStagePersisted({
    templateId: targetTemplate.id,
    draftVersionId,
    stage: invalidStage,
  });

  const failedValidation = await repository.validateWorkflowDraftPersisted({
    templateId: targetTemplate.id,
    draftVersionId,
  });
  assert.equal(failedValidation.valid, false);
  assert.ok(failedValidation.errors.length > 0);

  // Step 4: Correct the invalid stage
  const correctedStage = {
    ...invalidStage,
    targetDurationDays: 14, // Fixed: 14 >= 10
  };
  await repository.updateWorkflowDraftStagePersisted({
    templateId: targetTemplate.id,
    draftVersionId,
    stage: correctedStage,
  });

  const passedValidation = await repository.validateWorkflowDraftPersisted({
    templateId: targetTemplate.id,
    draftVersionId,
  });
  assert.equal(passedValidation.valid, true, `Expected valid after correction but got: ${passedValidation.errors.join(", ")}`);

  // Step 5: Publish the draft version atomically
  const publishResult = await repository.publishWorkflowVersionPersisted({
    templateId: targetTemplate.id,
    draftVersionId,
    actorName: "PATH Lead Administrator",
  });
  assert.ok(publishResult.data);
  assert.equal(publishResult.data.status, "published");
  assert.equal(publishResult.data.versionNumber, newExpectedVersionNumber);
  assert.equal(targetTemplate.activeVersionNumber, newExpectedVersionNumber);

  // Check audit log for workflow_published
  const auditEvents = repository.getAuditEvents();
  const publishAudit = auditEvents.find((e) => e.actionType === "workflow_published" && e.entityId === draftVersionId);
  assert.ok(publishAudit, "Audit event workflow_published must be recorded");

  // Step 6: Create new work on the new version
  const newWsResult = await repository.createWorkstreamFromRequestPersisted({
    requestId: "req-gate-2",
    code: "WS-GATE-NEW",
    title: "New Case Post Workflow Publication",
    category: "coastal",
    permitTypeId: targetTemplate.id,
    // workflowVersionId omitted: must automatically pick up the newly published active version!
  });
  assert.ok(newWsResult.data);
  const newWorkstream = repository.getWorkstreamById(newWsResult.data.workstreamId);
  assert.ok(newWorkstream);
  assert.equal(newWorkstream.workflowVersionId, draftVersionId, "New workstream must execute on newly published version");

  // Step 7: Verify that the existing prior workstream remains pinned to old version
  const verifiedExistingWs = repository.getWorkstreamById(existingWorkstreamId);
  assert.ok(verifiedExistingWs);
  assert.equal(verifiedExistingWs.workflowVersionId, oldVersionId, "Existing workstream must remain pinned to old version");
  assert.notEqual(verifiedExistingWs.workflowVersionId, newWorkstream.workflowVersionId);
});
