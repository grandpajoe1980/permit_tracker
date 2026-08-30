import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

test("Document System [Multi-Project Seeding]: Every workstream has at least 1 document and LA-82 has multiple", async () => {
  const { repository } = await vite.ssrLoadModule("/lib/repository.ts");
  const documents = repository.getDocuments();
  const workstreams = repository.getWorkstreams();

  assert.ok(documents.length >= 9, `Expected at least 9 documents across projects, found ${documents.length}`);

  // Check every workstream has at least one linked document
  for (const ws of workstreams) {
    const wsDocs = repository.getDocumentsByWorkstreamId(ws.id);
    assert.ok(
      wsDocs.length >= 1,
      `Workstream ${ws.code} (${ws.title}) must have at least 1 attached document, found ${wsDocs.length}`
    );
  }

  // Check LA-82 Heavy-Haul has at least 3 documents
  const la82Docs = repository.getDocumentsByWorkstreamId("WS-LA82-HEAVYHAUL");
  assert.ok(
    la82Docs.length >= 3,
    `WS-LA82-HEAVYHAUL must have multiple documents (expected >= 3), found ${la82Docs.length}`
  );

  const titles = la82Docs.map((d) => d.title);
  assert.ok(titles.some((t) => t.includes("Drainage")), "Must contain drainage study");
  assert.ok(titles.some((t) => t.includes("Bridge")), "Must contain bridge load matrix");
  assert.ok(titles.some((t) => t.includes("Traffic")), "Must contain traffic control plan");
});

test("Document System [Cryptographic Integrity & Versions]: SHA-256 hashes and version structures", async () => {
  const { repository } = await vite.ssrLoadModule("/lib/repository.ts");
  const documents = repository.getDocuments();

  for (const doc of documents) {
    assert.ok(doc.id.startsWith("doc-"), `Document ID must start with 'doc-', got ${doc.id}`);
    assert.ok(doc.title && doc.title.length > 5, `Document must have descriptive title: ${doc.title}`);
    assert.ok(doc.versions.length >= 1, `Document ${doc.id} must have at least 1 version`);

    for (const ver of doc.versions) {
      assert.ok(ver.id.startsWith("doc-v-"), `Version ID must start with 'doc-v-', got ${ver.id}`);
      assert.match(ver.versionTag, /^v\d+(\.\d+)?$/i, `Version tag must follow vX.Y format: ${ver.versionTag}`);
      assert.equal(ver.sha256Hash.length, 64, `SHA-256 hash must be exactly 64 hex characters: ${ver.sha256Hash}`);
      assert.match(ver.sha256Hash, /^[0-9a-f]{64}$/, `SHA-256 hash must be lowercase hex string`);
      assert.ok(ver.fileSizeBytes > 0, `File size must be positive: ${ver.fileSizeBytes}`);
      assert.ok(ver.fileName.endsWith(".pdf"), `File name must have extension: ${ver.fileName}`);
      assert.equal(ver.isMalwareClean, true, `Document must be malware clean`);
    }

    for (const review of doc.agencyReviews) {
      assert.ok(review.reviewingOrgCode, `Review must have reviewing agency code: ${review.id}`);
      assert.ok(
        ["approved", "under_review", "revisions_requested", "pending"].includes(review.reviewStatus),
        `Review status must be valid domain status: ${review.reviewStatus}`
      );
    }
  }
});

test("Document System [Search & Filtering]: Search by title, agency, category, and SHA-256", async () => {
  const { repository } = await vite.ssrLoadModule("/lib/repository.ts");

  // Search by keyword in title
  const bridgeResults = repository.searchDocuments("Bridge");
  assert.ok(bridgeResults.length >= 1, "Searching 'Bridge' must return bridge load rating document");
  assert.ok(bridgeResults.some((d) => d.id === "doc-bridge-load"));

  // Search by category
  const envResults = repository.searchDocuments("", { category: "environmental_study" });
  assert.ok(envResults.length >= 3, `Expected at least 3 environmental studies, got ${envResults.length}`);

  // Search by workstream
  const usaceResults = repository.searchDocuments("", { workstreamId: "WS-WETLANDS-PAD-A" });
  assert.ok(usaceResults.length >= 1, "Must find wetland delineation for WS-WETLANDS-PAD-A");

  // Search by partial SHA-256
  const hashResults = repository.searchDocuments("1f2e3d4c5b6a7f8e");
  assert.ok(hashResults.length >= 1, "Searching partial SHA-256 must match document");
});

test("Document System [SSR Markup & Modal Invariants]: Renders Document Vault and Document Viewer Modal", async () => {
  const { repository } = await vite.ssrLoadModule("/lib/repository.ts");
  const { DocumentVaultPanel } = await vite.ssrLoadModule("/components/cockpits/DocumentVaultPanel.tsx");
  const { DocumentViewerModal } = await vite.ssrLoadModule("/components/documents/DocumentViewerModal.tsx");

  // Render Document Vault Panel
  const vaultHtml = renderToStaticMarkup(React.createElement(DocumentVaultPanel));
  assert.ok(vaultHtml.includes("Project Document Vault"), "Vault must contain header");
  assert.ok(vaultHtml.includes("Single Source of Truth Document Vault"), "Vault must contain badge");
  assert.ok(vaultHtml.includes("Search by title, file name, SHA-256 checksum"), "Vault must contain search bar");
  assert.ok(vaultHtml.includes("Drainage"), "Vault must list drainage study");
  assert.ok(vaultHtml.includes("Freshwater Bayou Bridge"), "Vault must list bridge document");
  assert.ok(vaultHtml.includes("Cross-Agency Revision Certification Matrix"), "Vault must render certification matrix");

  // Render Document Viewer Modal
  const drainageDoc = repository.getDocuments().find((d) => d.id === "doc-drainage-study");
  assert.ok(drainageDoc, "Drainage doc must exist");

  const modalHtml = renderToStaticMarkup(
    React.createElement(DocumentViewerModal, {
      document: drainageDoc,
      isOpen: true,
      onClose: () => {},
    })
  );

  assert.ok(modalHtml.includes("SHA-256 Cryptographic Checksum"), "Modal must display SHA-256 integrity section");
  assert.ok(modalHtml.includes("Malware Clean · Verified"), "Modal must show malware clean badge");
  assert.ok(modalHtml.includes(drainageDoc.versions[0].sha256Hash), "Modal must contain exact SHA-256 hash");
  assert.ok(modalHtml.includes("Download Official File"), "Modal must have download button");
  assert.ok(modalHtml.includes("Interagency Review Certification Matrix"), "Modal must show review matrix");
});
