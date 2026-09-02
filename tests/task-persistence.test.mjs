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

after(async () => {
  await vite.close();
});

test("Supabase Task and Workstream Persistence: updates and persists to database", async () => {
  const { isSupabaseConfigured } = await vite.ssrLoadModule("/lib/supabase/client.ts");
  const { repository } = await vite.ssrLoadModule("/lib/repository.ts");

  assert.equal(isSupabaseConfigured(), true, "Supabase must be configured in all runtime modes");

  const hydrated = await repository.hydrateFromSupabase("PRJ-PECAN-2026");
  assert.equal(hydrated, true, "Hydration from Supabase must succeed");

  const workstreams = repository.getWorkstreams();
  assert.ok(workstreams.length > 0, "Workstreams must be present");

  const ws = workstreams[0];
  assert.ok(ws, "Primary workstream must exist");

  if (ws.tasks && ws.tasks.length > 0) {
    const task = ws.tasks[0];
    const updateResult = await repository.updateTaskPersisted({
      taskId: task.id,
      updates: {
        title: task.title,
        status: "in_progress",
      },
      actorName: "Test Automation",
    });
    assert.equal(updateResult.error, null, "Task update must commit without error");

  }
});
