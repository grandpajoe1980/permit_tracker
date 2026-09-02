import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";
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

const { downloadDocumentVersion } = await vite.ssrLoadModule("/lib/document-download-utils.ts");
const { resolveWorkItemDocuments } = await vite.ssrLoadModule("/lib/document-work-item-utils.ts");
const { documentRowToDomain, documentVersionRowToDomain } = await vite.ssrLoadModule("/lib/supabase/mappings.ts");

function records(overrides = {}) {
  const bytes = Buffer.from("official document bytes");
  const version = {
    id: "version-1",
    documentId: "document-1",
    versionTag: "v1.0",
    versionNumber: 1,
    versionLabel: "v1.0",
    fileName: "official-notes.md",
    fileSizeBytes: bytes.length,
    mimeType: "text/markdown",
    storagePath: "vault/project/official-notes.md",
    storageUri: "vault/project/official-notes.md",
    sha256Hash: crypto.createHash("sha256").update(bytes).digest("hex"),
    uploadedByName: "Test User",
    uploadedAt: new Date(0).toISOString(),
    isMalwareClean: true,
    ...overrides,
  };
  const document = {
    id: "document-1",
    projectId: "project-1",
    title: "Official Notes",
    category: "technical",
    ownerOrgCode: "PATH",
    currentVersionNumber: 1,
    currentVersionId: version.id,
    isConfidential: false,
    versions: [version],
    agencyReviews: [],
  };
  return { bytes, document, version };
}

test("download reports a missing Storage object instead of manufacturing a replacement", async () => {
  const { document, version } = records();
  let requestedPath = "";
  const result = await downloadDocumentVersion(document, version, async (path) => {
    requestedPath = path;
    return { blob: null, error: new Error("Object not found") };
  });

  assert.equal(requestedPath, "vault/project/official-notes.md");
  assert.equal(result.success, false);
  assert.match(result.error.message, /Object not found/);
});

test("download accepts exact Storage bytes and rejects a SHA-256 mismatch", async () => {
  const { bytes, document, version } = records();
  const success = await downloadDocumentVersion(document, version, async () => ({
    blob: new Blob([bytes], { type: version.mimeType }),
    error: null,
  }));
  assert.equal(success.success, true);

  const mismatch = await downloadDocumentVersion(
    document,
    { ...version, sha256Hash: "a".repeat(64) },
    async () => ({ blob: new Blob([bytes]), error: null }),
  );
  assert.equal(mismatch.success, false);
  assert.match(mismatch.error.message, /SHA-256/);
});

test("document mapping joins versions by database UUID and derives the real latest version", () => {
  const mappedVersions = [
    documentVersionRowToDomain({
      id: "v4",
      document_id: "document-uuid",
      document_ref_id: "legacy-document-id",
      version_number: 4,
      version_label: "v4.0",
      storage_path: "document-uuid/v4/file.pdf",
    }),
    documentVersionRowToDomain({
      id: "v2",
      document_ref_id: "document-uuid",
      version_number: 2,
      version_label: "v2.0",
      storage_path: "document-uuid/v2/file.pdf",
    }),
  ];

  assert.equal(mappedVersions[0].documentId, "document-uuid");
  const document = documentRowToDomain({
    id: "document-uuid",
    current_version_number: 1,
    version: 4,
  }, mappedVersions);
  assert.equal(document.currentVersionNumber, 4);
  assert.equal(document.currentVersionId, "v4");
});

test("review work items resolve attachments to the authoritative document and exact version", () => {
  const { document, version } = records();
  const item = {
    id: "document-1:version-1:DOTD",
    sourceId: version.id,
    kind: "document",
    title: "Review v1.0 · Official Notes",
    projectName: "Project",
    workstreamTitle: "Wetlands review",
    whyHere: "",
    whatToDo: "",
    removesFromQueue: "",
    ageLabel: "",
    scheduleImpact: "",
    statusLabel: "",
    statusTone: "amber",
    priorityScore: 1,
    isCriticalPath: true,
    ownerName: "Test User",
    ownerOrganization: "PATH",
    requiredInputs: [],
    documents: [{ id: version.id, label: document.title, version: version.versionTag }],
    sourceDocument: document,
    exactDocumentVersionId: version.id,
    exactDocumentVersionLabel: version.versionTag,
  };

  const resolved = resolveWorkItemDocuments(item, [document]);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].id, document.id);
  assert.equal(resolved[0].versions[0].id, version.id);
  assert.equal(resolved[0].versions[0].storagePath, version.storagePath);
});
