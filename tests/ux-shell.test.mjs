import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const footer = await readFile(new URL("../components/SystemVersionFooter.tsx", import.meta.url), "utf8");

test("PATH shell keeps persistence health in the footer and removes sidebar noise", () => {
  assert.doesNotMatch(page, /Supabase DB/);
  assert.doesNotMatch(page, /Official filing notice/);
  assert.match(page, /!activePersona\.isCustomer && <p[^>]*>Secondary tools/);
  assert.match(footer, /Supabase Authoritative Persistence/);
  assert.match(footer, /Environment:/);
  assert.match(footer, /Health: Connected/);
});

test("PATH shell uses plain work language for ordinary navigation", () => {
  assert.match(page, />My work</);
  assert.doesNotMatch(page, /title="Open authoritative project page"/);
  assert.doesNotMatch(page, />Your operational queue</);
});
