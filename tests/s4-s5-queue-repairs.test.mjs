import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, ws: false },
});

after(async () => vite.close());

const data = await vite.ssrLoadModule("/lib/demo-data.ts");
const ux = await vite.ssrLoadModule("/lib/operational-ux.ts");
const { repository } = await vite.ssrLoadModule("/lib/repository.ts");

beforeEach(() => repository.resetE2EDemo());

test("customer work projection isolates customer requests to their submitter", () => {
  repository.createCustomerRequest({
    projectId: "proj-spacex-pecan",
    requestType: "government_help",
    title: "Alex-only intake",
    description: "Private customer intake for Alex.",
    submittedByUserId: "user-alex-martin",
    submittedByName: "Alex Martin",
    blocksActiveWork: false,
    attachmentDocumentVersionIds: [],
  });
  repository.createCustomerRequest({
    projectId: "proj-spacex-pecan",
    requestType: "government_help",
    title: "Maya-only intake",
    description: "Private customer intake for Maya.",
    submittedByUserId: "user-maya-chen",
    submittedByName: "Maya Chen",
    blocksActiveWork: false,
    attachmentDocumentVersionIds: [],
  });

  const options = (persona) => ({
    persona,
    requests: [],
    workstreams: repository.getWorkstreams(),
    coordinationRequests: [],
    rfis: [],
    documents: [],
    commitments: [],
    customerRequests: repository.getCustomerRequests(),
  });
  const alex = data.demoPersonas.find((persona) => persona.id === "alex-martin");
  const maya = data.demoPersonas.find((persona) => persona.id === "maya-chen");
  const alexRequests = ux.getOperationalWorkItems(options(alex)).items.filter((item) => item.kind === "customer_request");
  const mayaRequests = ux.getOperationalWorkItems(options(maya)).items.filter((item) => item.kind === "customer_request");

  assert.deepEqual(alexRequests.map((item) => item.title), ["Alex-only intake"]);
  assert.deepEqual(mayaRequests.map((item) => item.title), ["Maya-only intake"]);
});

test("Due soon only contains non-actionable items with a real due date", () => {
  const items = [
    { id: "no-date", kind: "document", statusLabel: "Ready", itsmState: "in_progress", requiresCurrentUserAction: false, priorityScore: 1 },
    { id: "dated", kind: "document", statusLabel: "Ready", itsmState: "in_progress", requiresCurrentUserAction: false, dueDate: "2026-09-20", priorityScore: 1 },
  ];
  const dueSoon = ux.groupMyWork(items).find((group) => group.id === "due_soon").items;
  assert.deepEqual(dueSoon.map((item) => item.id), ["dated"]);
});

test("customer restoration defaults to Home and Team Work owns its selector state", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const \[queueAgencyFilter, setQueueAgencyFilter\] = useState\("all"\)/);
  assert.match(page, /\? "customer-home" : shell\.route/);
  assert.match(page, /<CustomerRequestList requests=\{visibleCustomerRequests\}/);
});
