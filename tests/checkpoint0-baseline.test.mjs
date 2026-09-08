import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const footerSource = await readFile(
  new URL("../components/SystemVersionFooter.tsx", import.meta.url),
  "utf8"
);
const viteSource = await readFile(
  new URL("../vite.config.ts", import.meta.url),
  "utf8"
);
const baselineReport = await readFile(
  new URL("../docs/BASELINE_REPORT.md", import.meta.url),
  "utf8"
);

test("SystemVersionFooter handles unavailable build identity safely", () => {
  // Footer must guard against unknown commit hash and render 'Build identity unavailable'
  assert.match(footerSource, /Build identity unavailable/);
  assert.match(footerSource, /BUILD_INFO\.commitHash !== "unknown"/);
  assert.match(footerSource, /BUILD_INFO\.commitHash && BUILD_INFO\.commitHash !== "unknown"\s*\?\s*\(/);
});

test("vite.config.ts resolves git commit metadata dynamically when env vars are missing", () => {
  assert.match(viteSource, /git rev-parse HEAD/);
  assert.match(viteSource, /git log -1 --format=%cI/);
});

test("baseline report records local and origin SHAs, Supabase ref, and acceptance IDs", () => {
  assert.match(baselineReport, /Local HEAD SHA/);
  assert.match(baselineReport, /Origin main SHA/);
  assert.match(baselineReport, /fpxghydxawjnduqeyhch/);
  assert.match(baselineReport, /PATH-DEMO-REQ-INTAKE/);
  assert.match(baselineReport, /WS-AIR-TITLE-V/);
});
