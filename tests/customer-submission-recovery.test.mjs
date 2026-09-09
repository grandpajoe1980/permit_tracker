import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, mutations, repository, migration, recovery] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/supabase/mutations.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/repository.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260907165524_customer_request_filing_recovery.sql", import.meta.url), "utf8"),
  readFile(new URL("../lib/customer-submission-recovery.ts", import.meta.url), "utf8"),
]);

test("customer submission keeps one request identity and retries only failed filing tracking", () => {
  const submit = page.slice(page.indexOf("async function submitCustomerRequest"), page.indexOf("async function saveCustomerDraft"));
  assert.match(submit, /submissionIdentity: \{ id: recovery\.requestId, confirmationNumber: recovery\.confirmationNumber \}/);
  assert.match(submit, /writeCustomerSubmissionRecovery\(requestRecovery\)/);
  assert.match(submit, /retryPendingExternalFiling/);
  assert.match(page, /disabled=\{isSubmittingRequest\}/);
  assert.doesNotMatch(submit, /responsibleOrgCode === "CPRA"/);
  assert.doesNotMatch(submit, /WS-WETLANDS-PAD-A/);
});

test("external filing persistence is RPC-owned, request-linked, and deterministic", () => {
  const mutation = mutations.slice(mutations.indexOf("export async function mutateCreateExternalFiling"), mutations.indexOf("export async function mutateUpdateExternalFiling"));
  assert.match(mutation, /rpc\("rpc_create_external_filing"/);
  assert.match(mutation, /p_customer_request_id: params\.customerRequestId/);
  assert.doesNotMatch(mutation, /from\("external_filings"\)\.insert/);
  assert.match(repository, /id: params\.id \?\? `external-filing-\$\{crypto\.randomUUID\(\)\}`/);
});

test("database filing recovery has both idempotency boundaries and a restricted RPC", () => {
  assert.match(migration, /add column if not exists customer_request_id text/);
  assert.match(migration, /alter column workstream_id drop not null/);
  assert.match(migration, /external_filings_customer_request_permit_key/);
  assert.match(migration, /where id = p_id/);
  assert.match(migration, /where customer_request_id = p_customer_request_id/);
  assert.match(migration, /revoke execute on function public\.rpc_create_external_filing/);
  assert.match(migration, /grant execute on function public\.rpc_create_external_filing/);
});

test("recovery metadata uses session storage as a browser hint without replacing database idempotency", () => {
  assert.match(recovery, /path-customer-submission-recovery-v1/);
  assert.match(recovery, /requestFingerprint/);
  assert.match(recovery, /The database RPCs\s+\/\/ still provide server-side idempotency/);
});
