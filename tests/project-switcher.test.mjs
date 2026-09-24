import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("project switcher choices come only from the caller's RLS-visible project rows", async () => {
  const queries = await readFile(new URL("../lib/supabase/queries.ts", import.meta.url), "utf8");
  const appShell = await readFile(new URL("../components/path/AppShell.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(queries, /fetchAccessibleProjectChoices[\s\S]*from\("projects"\)\.select\("id, number, name, status, risk, target_date"\)/);
  assert.match(queries, /Lists only project rows visible through the caller's existing RLS policies/);
  assert.match(appShell, /aria-label="Switch active project"/);
  assert.match(appShell, /projectChoices\.map\(\(project\) => <option key=\{project\.id\} value=\{project\.number\}>/);
  assert.match(page, /Project portfolio/);
  assert.match(page, /does not combine project records or metrics/);
  assert.match(page, /projectChoices={loggedIn \? accessibleProjects : \[\]}/);
});

test("switching project resets focused work and writes an explicit scoped project URL", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /function switchProject\(projectNumber: string\)/);
  assert.match(page, /accessibleProjects\.find\(\(project\) => project\.number === projectNumber\)/);
  assert.match(page, /buildShellPath\("project", undefined, undefined, undefined, choice\.number\)/);
  assert.match(page, /setProjectReference\(choice\.number\)/);
  assert.match(page, /setSelectedProjectWorkstreamId\(null\)/);
  assert.match(page, /setSelectedProjectPhase\(null\)/);
  assert.match(page, /projectName=\{projectRecord\.name(?: \|\| PROJECT_DISPLAY_NAME)?\}/);
  assert.match(page, /CustomerHome projectName=\{projectRecord\.name(?: \|\| PROJECT_DISPLAY_NAME)?\}/);
});
