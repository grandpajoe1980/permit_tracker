import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("document handoff does not claim an upload occurred", () => {
  const start = page.indexOf('if (dialog.action === "upload_documents")');
  const end = page.indexOf("\n    }", start);
  const uploadAction = page.slice(start, end);
  assert.match(uploadAction, /openProjectSection\("vault"\)/);
  assert.match(uploadAction, /No file was uploaded/);
  assert.match(uploadAction, /showToast\([\s\S]*, "info"\)/);
  assert.doesNotMatch(uploadAction, /notify\(/);
});

test("service request guidance uses an informational, not success, toast", () => {
  assert.match(page, /Include in your request: \$\{details\}[\s\S]*?, "info"\)/);
});
