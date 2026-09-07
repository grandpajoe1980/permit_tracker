import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [seed, sql] = await Promise.all([
  readFile(new URL("../scripts/seed-demo-scenarios.mjs", import.meta.url), "utf8"),
  readFile(new URL("../supabase/demo-scenarios.sql", import.meta.url), "utf8"),
]);

test("scenario seed is repeatable, tagged, and non-destructive", () => {
  assert.match(seed, /PATH-DEMO-SEED-2026-09-07/);
  assert.match(seed, /upsert\(client, "workstreams"/);
  assert.match(seed, /upsert\(client, "customer_requests"/);
  assert.match(seed, /upsert\(client, "rfis"/);
  assert.match(seed, /upsert\(client, "coordination_requests"/);
  assert.doesNotMatch(seed, /\.delete\(|\.remove\(|DROP\s+TABLE|TRUNCATE/i);
  assert.doesNotMatch(sql, /DELETE\s+FROM|DROP\s+TABLE|TRUNCATE/i);
  assert.match(sql, /on conflict \(id\) do update/i);
  assert.doesNotMatch(seed, /crypto\.randomUUID\(\)/);
});

test("scenario seed covers the updated plan's linked lifecycle states", () => {
  for (const value of [
    "PATH-DEMO-REQ-INTAKE",
    "PATH-DEMO-REQ-ACTIVE",
    "PATH-DEMO-REQ-RFI",
    "PATH-DEMO-REQ-COORD",
    "PATH-DEMO-REQ-COMPLETE",
    "PATH-DEMO-RFI-WAITING",
    "PATH-DEMO-RFI-REVIEW",
    "PATH-DEMO-RFI-ACCEPTED",
    "PATH-DEMO-COORD-WAITING",
    "PATH-DEMO-COORD-RESPONDED",
    "PATH-DEMO-COORD-RESOLVED",
    "PATH-DEMO-WS-UTILITY",
    "stage_history",
    "triaged_workstream_ids",
    "attachmentVersionId",
  ]) assert.match(seed, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("scenario seed does not invent uploaded bytes", () => {
  assert.match(seed, /file_size_bytes/);
  assert.match(seed, /sha256_hash/);
  assert.match(seed, /attachment-ready/);
  assert.match(seed, /storage metadata/i);
  assert.doesNotMatch(seed, /storage\.from\(/);
});
