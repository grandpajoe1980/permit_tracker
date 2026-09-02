import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { resolve } from "node:path";
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

test("shared Supabase client contains no service-role fallback or credential", async () => {
  const [clientSource, browserSource, viteSource] = await Promise.all([
    readFile(resolve(root, "lib/supabase/client.ts"), "utf8"),
    readFile(resolve(root, "lib/supabase-browser.ts"), "utf8"),
    readFile(resolve(root, "vite.config.ts"), "utf8"),
  ]);

  for (const source of [clientSource, browserSource, viteSource]) {
    assert.doesNotMatch(source, /service_role/i);
    assert.doesNotMatch(source, /eyJ[A-Za-z0-9_-]{20,}/);
  }

  assert.match(clientSource, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(clientSource, /process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(clientSource, /runtimeEnv\("NEXT_PUBLIC_SUPABASE_URL"\)/);
  assert.doesNotMatch(clientSource, /runtimeEnv\("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"\)/);
  assert.doesNotMatch(clientSource, /import\.meta\.env/);
});

test("document validation rejects unsafe and oversized uploads", async () => {
  const storageValidation = await vite.ssrLoadModule("/lib/supabase/storage-validation.ts");
  assert.equal(storageValidation.validateDocumentFile(new File(["ok"], "evidence.pdf", { type: "application/pdf" })), null);
  assert.match(storageValidation.validateDocumentFile(new File([""], "empty.pdf", { type: "application/pdf" }))?.message ?? "", /Empty/);
  assert.match(storageValidation.validateDocumentFile(new File(["ok"], "evidence.exe", { type: "application/x-msdownload" }))?.message ?? "", /not supported/);
});

test("forward read-policy migration closes anonymous access and covers Storage updates", async () => {
  const source = await readFile(resolve(root, "supabase/migrations/20260902211835_reconcile_read_policies.sql"), "utf8");
  assert.match(source, /REVOKE ALL ON TABLE public\.%I FROM public, anon/);
  assert.match(source, /CREATE POLICY projects_read_authenticated/);
  assert.match(source, /CREATE POLICY document_versions_read_authenticated/);
  assert.match(source, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage\.objects TO authenticated/);
  assert.match(source, /CREATE POLICY path_documents_update_authenticated/);
});
