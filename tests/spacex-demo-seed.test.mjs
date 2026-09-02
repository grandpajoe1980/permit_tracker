import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const seed = await readFile(new URL("../scripts/seed-spacex-demo.mjs", import.meta.url), "utf8");

test("SpaceX demo seed has fictional, role-differentiated personas", () => {
  for (const persona of ["Elon Musk", "Gwynne Shotwell", "Bill Gerstenmaier", "Jeff Landry", "Susan Bourgeois"]) {
    assert.match(seed, new RegExp(persona));
  }
  assert.match(seed, /@demo\.permit\.local/);
  assert.match(seed, /demo_persona: true/);
  assert.doesNotMatch(seed, /@(?:la\.gov|spacex\.com|gmail\.com|yahoo\.com)/i);
  assert.match(seed, /fictional: true/);
});

test("SpaceX demo seed covers durable operational records with stable identifiers", () => {
  for (const table of [
    "assignment_groups",
    "assignment_group_memberships",
    "workflow_definitions",
    "workflow_stages",
    "workflow_versions",
    "workflow_version_stages",
    "workstreams",
    "tasks",
    "task_dependencies",
    "case_workflows",
    "assignments",
    "requests",
    "notifications",
    "audit_events",
  ]) {
    assert.match(seed, new RegExp(`from\\(\\"${table}\\"\\)`));
  }
  assert.match(seed, /stableUuid\(`request:/);
  assert.match(seed, /WS-AIR-TITLE-V/);
  assert.match(seed, /TASK-AIR-004.*blocked/s);
  assert.match(seed, /clock_state: stageKey === "agency_coordination" \? "paused"/);
  assert.doesNotMatch(seed, /Math\.random\(\)|crypto\.randomUUID\(\)/);
});
