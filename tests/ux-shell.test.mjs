import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const footer = await readFile(new URL("../components/SystemVersionFooter.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const workflowJourney = await readFile(new URL("../components/cockpits/WorkflowJourney.tsx", import.meta.url), "utf8");

test("PATH shell keeps persistence health in the footer and removes sidebar noise", () => {
  assert.doesNotMatch(page, /Supabase DB/);
  assert.doesNotMatch(page, /Official filing notice/);
  assert.doesNotMatch(page, /Secondary tools/);
  assert.match(page, /aria-label="Project context"/);
  assert.doesNotMatch(footer, /Supabase Authoritative Persistence/);
  assert.match(footer, /Environment:/);
  assert.match(footer, /Operational data status is shown in the workspace/);
});

test("PATH shell uses plain work language for ordinary navigation", () => {
  assert.match(page, />My work</);
  assert.doesNotMatch(page, /title="Open authoritative project page"/);
  assert.doesNotMatch(page, />Your operational queue</);
});

test("PATH shell constrains its layout to the mobile viewport", () => {
  assert.match(styles, /box-sizing: border-box/);
  assert.match(styles, /html \{\s+max-width: 100%;\s+overflow: hidden/s);
  assert.match(styles, /body \{\s+min-width: 320px;\s+max-width: 100%;\s+overflow: hidden/s);
  assert.match(styles, /\.site-header > div,\s+\.road-stripe \+ \.site-header \+ div \{\s+width: 100%;\s+min-width: 0;/s);
  assert.match(styles, /#main-content \{\s+width: 100%;/s);
});

test("Workflow journey summary wraps instead of widening the mobile content region", () => {
  assert.match(workflowJourney, /flex flex-col items-start gap-3[^\n]*sm:flex-row/);
  assert.match(workflowJourney, /max-w-full min-w-0 whitespace-normal break-words/);
});
