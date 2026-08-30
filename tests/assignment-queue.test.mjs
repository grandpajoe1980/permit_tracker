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
  server: { middlewareMode: true },
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
