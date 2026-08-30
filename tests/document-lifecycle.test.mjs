import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
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

after(async () => vite.close());
const { repository } = await vite.ssrLoadModule("/lib/repository.ts");
const { CUSTOMER_ORGANIZATION_NAME } = await vite.ssrLoadModule("/lib/customer-portal.ts");

beforeEach(() => repository.resetE2EDemo());

test("document upload creates an immutable next version with a review matrix", () => {
  const document = repository.getDocuments()[0];
  const nextNumber = document.currentVersionNumber + 1;
  const version = repository.createDocumentVersion(document.id, {
    versionNumber: nextNumber,
    versionLabel: `v${nextNumber}.0`,
    storagePath: "data:text/plain;base64,UEFUSCBlMmU=",
    fileName: "customer-revision.txt",
    mimeType: "text/plain",
    fileSizeBytes: 10,
    sha256Hash: "b".repeat(64),
    uploadedByName: "Alex Martin",
    uploadedByOrgName: CUSTOMER_ORGANIZATION_NAME,
    changeNotes: "Customer revision",
    reviewingAgencyCodes: ["DOTD", "CPRA"],
  });
  assert.equal(version?.versionNumber, nextNumber);
  assert.equal(version?.status, "under_review");
  assert.equal(version?.agencyReviews?.map((review) => review.reviewingOrgCode).join(","), "DOTD,CPRA");
  assert.equal(repository.getDocuments()[0].currentVersionId, version?.id);
  assert.ok(repository.getAuditEvents().some((event) => event.entityId === version?.id && event.actionType === "version_upload"));
});

test("agency signoff changes only the selected version and resets on the next revision", () => {
  const document = repository.getDocuments()[0];
  const first = repository.createDocumentVersion(document.id, {
    versionNumber: document.currentVersionNumber + 1,
    versionLabel: "v9.0",
    storagePath: "data:text/plain;base64,QQ==",
    fileName: "v9.txt",
    mimeType: "text/plain",
    fileSizeBytes: 1,
    sha256Hash: "c".repeat(64),
    uploadedByName: "Alex Martin",
    uploadedByOrgName: CUSTOMER_ORGANIZATION_NAME,
    changeNotes: "First review cycle",
    reviewingAgencyCodes: ["DOTD", "CPRA"],
  });
  assert.ok(first);
  assert.equal(repository.reviewDocumentVersion({ versionId: first.id, agencyCode: "DOTD", decision: "approved", actorName: "Sam Rivera", comments: "DOTD approved v9.0." })?.reviewingOrgCode, "DOTD");
  const second = repository.createDocumentVersion(document.id, {
    versionNumber: 10,
    versionLabel: "v10.0",
    storagePath: "data:text/plain;base64,Qg==",
    fileName: "v10.txt",
    mimeType: "text/plain",
    fileSizeBytes: 1,
    sha256Hash: "d".repeat(64),
    uploadedByName: "Alex Martin",
    uploadedByOrgName: CUSTOMER_ORGANIZATION_NAME,
    changeNotes: "Second review cycle",
    reviewingAgencyCodes: ["DOTD", "CPRA"],
  });
  assert.equal(first.status, "under_review");
  assert.equal(first.agencyReviews?.find((review) => review.reviewingOrgCode === "DOTD")?.status, "approved");
  assert.equal(second?.status, "under_review");
  assert.ok(second?.agencyReviews?.every((review) => review.status === "under_review"));
});
