import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, ws: false },
});
after(async () => vite.close());

const { filingForPermit, requestForPermit, agencyRecordUrl } = await vite.ssrLoadModule("/lib/filing-provenance.ts");

test("a permit displays its own linked PATH request when the agency handles multiple permits", () => {
  const filings = [
    { id: "f-other", permitTypeId: "permit-B", customerRequestId: "r-B", createdAt: "2026-09-22", externalRecordUrl: "https://agency.example/B" },
    { id: "f-target", permitTypeId: "permit-A", customerRequestId: "r-A", createdAt: "2026-09-20", externalRecordUrl: "https://agency.example/A" },
  ];
  const requests = [
    { id: "r-B", knownPermitTypeId: "permit-B", knownAgencyCode: "LDEQ", title: "Second authorization" },
    { id: "r-A", knownPermitTypeId: "permit-A", knownAgencyCode: "LDEQ", title: "First authorization" },
  ];
  const filing = filingForPermit("permit-A", filings);
  assert.equal(filing.id, "f-target");
  assert.equal(requestForPermit("permit-A", filing, requests)?.title, "First authorization");
  assert.equal(agencyRecordUrl(filing), "https://agency.example/A");
});

test("a filing linked to an inaccessible request does not borrow a different request's status", () => {
  const filing = { permitTypeId: "permit-A", customerRequestId: "not-visible" };
  assert.equal(requestForPermit("permit-A", filing, [{ id: "visible", knownPermitTypeId: "permit-A" }]), undefined);
  assert.equal(requestForPermit("permit-A", { permitTypeId: "permit-A" }, [{ id: "visible", knownPermitTypeId: "permit-A" }]), undefined);
});

test("an agency record link must be HTTPS, even if a stored record has a different URL scheme", () => {
  assert.equal(agencyRecordUrl({ externalRecordUrl: "javascript:alert(1)" }), undefined);
  assert.equal(agencyRecordUrl({ externalRecordUrl: "http://agency.example/case" }), undefined);
  assert.equal(agencyRecordUrl({ externalRecordUrl: "not a url" }), undefined);
});
