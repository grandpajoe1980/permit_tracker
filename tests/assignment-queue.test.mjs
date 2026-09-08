import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, ws: false },
});
after(async () => vite.close());

const ux = await vite.ssrLoadModule("/lib/operational-ux.ts");
const data = await vite.ssrLoadModule("/lib/demo-data.ts");

test("task assignment metadata drives personal ownership instead of agency membership", () => {
  const sam = data.demoPersonas.find((persona) => persona.id === "sam-rivera");
  const jordan = data.demoPersonas.find((persona) => persona.id === "jordan-lee");
  const samItems = ux.getOperationalWorkItems({ persona: sam }).items;
  const jordanItems = ux.getOperationalWorkItems({ persona: jordan }).items;
  assert.equal(samItems.find((item) => item.sourceId === "TASK-T001")?.assignedUserId, "user-sam-rivera");
  assert.equal(jordanItems.find((item) => item.sourceId === "TASK-T003")?.assignedUserId, "user-jordan-lee");
  assert.notEqual(samItems.find((item) => item.sourceId === "TASK-T001")?.assignedUserId, "user-jordan-lee");
});

test("agency queue and My Work can use the same source without duplicating a primary bucket", () => {
  const sam = data.demoPersonas.find((persona) => persona.id === "sam-rivera");
  const items = ux.getOperationalWorkItems({ persona: sam }).items;
  const groups = ux.groupMyWork(items);
  const occurrences = new Map();
  for (const group of groups) {
    for (const item of group.items) occurrences.set(item.id, (occurrences.get(item.id) ?? 0) + 1);
  }
  assert.ok(items.some((item) => item.requiresCurrentUserAction === true));
  assert.ok([...occurrences.values()].every((count) => count === 1));
});

test("Jordan's Needs my action contains only executable work", () => {
  const jordan = data.demoPersonas.find((p) => p.id === "jordan-lee");
  const items = ux.getOperationalWorkItems({ persona: jordan }).items;
  const groups = ux.groupMyWork(items);
  const needsAction = groups.find((g) => g.id === "needs_action");
  assert.ok(needsAction, "Needs my action group must exist");
  assert.ok(needsAction.items.length > 0, "Jordan has executable actions");
  for (const item of needsAction.items) {
    assert.equal(
      item.requiresCurrentUserAction,
      true,
      `Item ${item.id} in Needs my action must require current user action`
    );
  }
});

test("Team Work groups correctly into Unassigned, Assigned, Waiting, Completed", () => {
  const jordan = data.demoPersonas.find((p) => p.id === "jordan-lee");
  const items = ux.getOperationalWorkItems({ persona: jordan }).items;
  const teamGroups = ux.groupTeamWork(items);
  assert.deepEqual(
    teamGroups.map((g) => g.id),
    ["unassigned", "assigned", "waiting", "completed"]
  );
  const totalInGroups = teamGroups.reduce((acc, g) => acc + g.items.length, 0);
  assert.equal(totalInGroups, items.length, "All team work items must be accounted for");

  // Every unassigned item has no assignedUserId
  const unassigned = teamGroups.find((g) => g.id === "unassigned");
  for (const item of unassigned.items) {
    assert.equal(Boolean(item.assignedUserId), false, "Unassigned items must not have assigned user");
  }
});

test("Atomic Take ownership handles concurrent claim collision", async () => {
  const { repository } = await vite.ssrLoadModule("/lib/repository.ts");
  repository.resetE2EDemo();

  const ws = repository.getWorkstreams().find((w) => w.tasks && w.tasks.length > 0);
  assert.ok(ws, "Must have workstream with tasks");
  const task = ws.tasks[0];
  task.assignedUserId = undefined;
  task.assignedUserName = undefined;

  // User A claims the unassigned task
  const claimA = repository.claimTicket({
    ticketType: "task",
    ticketId: task.id,
    expectedPreviousUserId: null,
    userId: "user-jordan-lee",
    actorName: "Jordan Lee",
  });
  assert.equal(claimA.success, true, "First claim should succeed");
  assert.equal(claimA.ticket?.assignedToUserId, "user-jordan-lee");

  // User B attempts to claim the same task expecting it to be unassigned
  const claimB = repository.claimTicket({
    ticketType: "task",
    ticketId: task.id,
    expectedPreviousUserId: null,
    userId: "user-sam-rivera",
    actorName: "Sam Rivera",
  });
  assert.equal(claimB.success, false, "Concurrent claim should fail");
  assert.equal(claimB.conflict, true, "Should report conflict");
  assert.match(claimB.error?.message ?? "", /Claim conflict/i);
});

test("Profile route is reloadable with user parameter", async () => {
  const { parseShellPath } = await vite.ssrLoadModule("/lib/navigation.ts");
  const parsed = parseShellPath(new URL("https://path.local/?view=profile&userId=user-jordan-lee"));
  assert.equal(parsed.route, "profile");
  assert.equal(parsed.userId, "user-jordan-lee");
});
