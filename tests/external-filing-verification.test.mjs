import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, ws: false } });
const { canVerifyExternalFiling } = await vite.ssrLoadModule("/lib/external-filing-access.ts");
const { filterExternalFilings, filingHasStatusMismatch, linkedFilingWorkstream, receiptVersionsForFiling } = await vite.ssrLoadModule("/lib/external-filing-queue.ts");
test.after(() => vite.close());

const now = new Date("2026-09-24T12:00:00.000Z");
const authority = { id: "11111111-1111-4111-8111-111111111111", code: "DOTD", name: "Louisiana DOTD" };
const filing = { id: "filing-1", authorityOrganizationId: "org-dotd" };
const membership = (role, overrides = {}) => ({
  id: "membership-1", userId: "user-1", organizationId: authority.id, role, status: "active",
  effectiveFrom: "2026-01-01T00:00:00.000Z", ...overrides,
});

test("verification affordance is limited to active authority administrators or system admins", () => {
  assert.equal(canVerifyExternalFiling(filing, [membership("organization_admin")], [authority], "user-1", now), true);
  assert.equal(canVerifyExternalFiling(filing, [membership("contributor")], [authority], "user-1", now), false);
  assert.equal(canVerifyExternalFiling(filing, [membership("organization_admin", { effectiveTo: "2026-09-24T11:59:00.000Z" })], [authority], "user-1", now), false);
  assert.equal(canVerifyExternalFiling(filing, [membership("organization_admin", { status: "suspended" })], [authority], "user-1", now), false);
  assert.equal(canVerifyExternalFiling(filing, [membership("system_admin", { organizationId: "other-org" })], [authority], "user-1", now), true);
  assert.equal(canVerifyExternalFiling(filing, [membership("organization_admin")], [{ ...authority, code: "LDEQ" }], "user-1", now), false);
});

test("filing queues separate unchecked records from status differences", () => {
  const base = { externalStatus: "submitted", statusChecks: [], lastStatusVerifiedAt: undefined };
  const unchecked = { ...base, id: "unchecked" };
  const confirmedSame = { ...base, id: "same", lastStatusVerifiedAt: "2026-09-24T10:00:00Z", statusChecks: [{ previousStatus: "submitted", verifiedStatus: "submitted" }] };
  const confirmedDifferent = { ...base, id: "different", lastStatusVerifiedAt: "2026-09-24T10:00:00Z", statusChecks: [{ previousStatus: "under_review", verifiedStatus: "submitted" }] };
  const filings = [unchecked, confirmedSame, confirmedDifferent];
  assert.deepEqual(filterExternalFilings(filings, "needs_verification").map((row) => row.id), ["unchecked"]);
  assert.deepEqual(filterExternalFilings(filings, "reconciled").map((row) => row.id), ["different"]);
  assert.equal(filterExternalFilings(filings, "all").length, 3);
  assert.equal(filingHasStatusMismatch(confirmedDifferent), true);
  assert.equal(filingHasStatusMismatch(confirmedSame), false);
});

test("filing workflow context requires an explicit workstream link in the same project", () => {
  const linkedFiling = { id: "filing-1", projectId: "project-a", workstreamId: "ws-a" };
  const sameProject = { id: "ws-a", projectId: "project-a", operationalStateLabel: "In review" };
  const otherProject = { id: "ws-a", projectId: "project-b", operationalStateLabel: "Approved" };
  assert.equal(linkedFilingWorkstream(linkedFiling, [sameProject]), sameProject);
  assert.equal(linkedFilingWorkstream(linkedFiling, [otherProject]), undefined);
  assert.equal(linkedFilingWorkstream({ ...linkedFiling, workstreamId: undefined }, [sameProject]), undefined);
});

test("receipt evidence resolves only exact linked versions in the filing project", () => {
  const filing = { id: "filing-1", projectId: "project-a", receiptDocumentVersionIds: ["receipt-v1"] };
  const correct = { id: "doc-a", projectId: "project-a", title: "Agency receipt", versions: [{ id: "receipt-v1", fileName: "receipt.pdf" }] };
  const wrongProject = { id: "doc-b", projectId: "project-b", title: "Other project", versions: [{ id: "receipt-v1", fileName: "other.pdf" }] };
  assert.deepEqual(receiptVersionsForFiling(filing, [correct, wrongProject]).map(({ document, version }) => [document.id, version.id]), [["doc-a", "receipt-v1"]]);
});

test("verification history leaves authenticated clients read-only, including no TRUNCATE", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260924073705_external_filing_status_history_least_privilege.sql", import.meta.url), "utf8");
  assert.match(migration, /revoke all on table public\.external_filing_status_checks from public, anon, authenticated/);
  assert.match(migration, /grant select on table public\.external_filing_status_checks to authenticated/);
});

test("customer-facing status distinguishes PATH entry from independently verified evidence", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const panel = await readFile(new URL("../components/admin/ExternalFilingVerificationPanel.tsx", import.meta.url), "utf8");
  const mutationSource = await readFile(new URL("../lib/supabase/mutations.ts", import.meta.url), "utf8");
  const querySource = await readFile(new URL("../lib/supabase/queries.ts", import.meta.url), "utf8");
  assert.match(page, /Authority-verified external status/);
  assert.match(page, /This PATH-entered status has not been independently verified/);
  assert.match(page, /Independent verification:/);
  assert.match(panel, /customerSafe \|\| filings\.length === 0/);
  assert.match(panel, /canVerifyExternalFiling\(filing, memberships, organizations, userId\)/);
  assert.match(panel, /type="url" pattern="https:\/\/\.\*"/);
  assert.match(panel, /Issuing authority \/ source name/);
  assert.match(panel, /Verification note/);
  assert.match(mutationSource, /rpc\("rpc_verify_external_filing_status"/);
  assert.match(querySource, /external_filing_status_checks/);
  const directUpdate = mutationSource.slice(mutationSource.indexOf("export async function mutateUpdateExternalFiling"), mutationSource.indexOf("export async function mutateVerifyExternalFilingStatus"));
  assert.doesNotMatch(directUpdate, /payload\.last_status_verified/);
  assert.doesNotMatch(directUpdate, /payload\.last_status_verification_/);
});
