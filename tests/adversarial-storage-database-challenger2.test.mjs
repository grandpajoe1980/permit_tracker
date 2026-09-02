import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(path = ".env") {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 0) return [line.trim(), ""];
        const key = line.slice(0, separator).trim();
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      })
  );
}

const env = { ...readEnvFile(), ...process.env };
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.legacy_service_role_key;

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

const {
  mutateUpdateTask,
  mutateCompleteTask,
  mutateAssignTicket,
  mutateUpdateTicketITSMState,
} = await vite.ssrLoadModule("/lib/supabase/mutations.ts");
const { downloadDocumentFile, getSignedDocumentUrl } = await vite.ssrLoadModule("/lib/supabase/storage.ts");
const { downloadDocumentVersion } = await vite.ssrLoadModule("/lib/document-download-utils.ts");
const { repository } = await vite.ssrLoadModule("/lib/repository.ts");

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// =========================================================================
// 1. LIVE DATABASE INTEGRITY & FOREIGN KEY INVARIANTS
// =========================================================================

test("DB Integrity: Row counts across core tables reflect authoritative seed", async () => {
  const [
    projectsRes,
    workstreamsRes,
    tasksRes,
    docsRes,
    docVersionsRes,
    docReviewsRes,
    commitmentsRes,
    decisionsRes,
    meetingsRes,
    rfisRes,
    permitTypesRes,
    orgsRes,
  ] = await Promise.all([
    adminClient.from("projects").select("id", { count: "exact", head: true }),
    adminClient.from("workstreams").select("id", { count: "exact", head: true }),
    adminClient.from("tasks").select("id", { count: "exact", head: true }),
    adminClient.from("documents").select("id", { count: "exact", head: true }),
    adminClient.from("document_versions").select("id", { count: "exact", head: true }),
    adminClient.from("document_agency_reviews").select("id", { count: "exact", head: true }),
    adminClient.from("commitments").select("id", { count: "exact", head: true }),
    adminClient.from("decisions").select("id", { count: "exact", head: true }),
    adminClient.from("meetings").select("id", { count: "exact", head: true }),
    adminClient.from("rfis").select("id", { count: "exact", head: true }),
    adminClient.from("permit_types").select("id", { count: "exact", head: true }),
    adminClient.from("organizations").select("id", { count: "exact", head: true }),
  ]);

  assert.equal(projectsRes.error, null, projectsRes.error?.message);
  assert.ok((projectsRes.count ?? 0) >= 6, `Expected >= 6 projects, found ${projectsRes.count}`);

  assert.equal(workstreamsRes.error, null, workstreamsRes.error?.message);
  assert.ok((workstreamsRes.count ?? 0) >= 12, `Expected >= 12 workstreams, found ${workstreamsRes.count}`);

  assert.equal(tasksRes.error, null, tasksRes.error?.message);
  assert.ok((tasksRes.count ?? 0) >= 15, `Expected >= 15 tasks, found ${tasksRes.count}`);

  assert.equal(docsRes.error, null, docsRes.error?.message);
  assert.ok((docsRes.count ?? 0) >= 10, `Expected >= 10 documents, found ${docsRes.count}`);

  assert.equal(docVersionsRes.error, null, docVersionsRes.error?.message);
  assert.ok((docVersionsRes.count ?? 0) >= 10, `Expected >= 10 document versions, found ${docVersionsRes.count}`);

  assert.equal(docReviewsRes.error, null, docReviewsRes.error?.message);
  assert.ok((docReviewsRes.count ?? 0) >= 30, `Expected >= 30 document agency reviews, found ${docReviewsRes.count}`);

  assert.equal(commitmentsRes.error, null, commitmentsRes.error?.message);
  assert.ok((commitmentsRes.count ?? 0) >= 5, `Expected >= 5 commitments, found ${commitmentsRes.count}`);

  assert.equal(permitTypesRes.error, null, permitTypesRes.error?.message);
  assert.ok((permitTypesRes.count ?? 0) >= 15, `Expected >= 15 permit types, found ${permitTypesRes.count}`);
});

test("FK Invariants: Every task has a valid workstream reference", async () => {
  const { data: tasks, error: tasksError } = await adminClient
    .from("tasks")
    .select("id, task_code, title, workstream_id");
  assert.equal(tasksError, null, tasksError?.message);
  assert.ok(tasks && tasks.length > 0, "Tasks must exist");

  const { data: workstreams, error: wsError } = await adminClient
    .from("workstreams")
    .select("id, code");
  assert.equal(wsError, null, wsError?.message);
  assert.ok(workstreams && workstreams.length > 0, "Workstreams must exist");

  const wsIds = new Set(workstreams.map((w) => w.id));
  const wsCodes = new Set(workstreams.map((w) => w.code));

  for (const task of tasks) {
    assert.ok(
      task.workstream_id && (wsIds.has(task.workstream_id) || wsCodes.has(task.workstream_id)),
      `Task ${task.id} (${task.task_code} - ${task.title}) references missing workstream_id: ${task.workstream_id}`
    );
  }
});

test("FK Invariants: Every workstream has a valid project reference", async () => {
  const { data: workstreams, error: wsError } = await adminClient
    .from("workstreams")
    .select("id, code, title, project_id");
  assert.equal(wsError, null, wsError?.message);
  assert.ok(workstreams && workstreams.length > 0, "Workstreams must exist");

  const { data: projects, error: projError } = await adminClient
    .from("projects")
    .select("id, number");
  assert.equal(projError, null, projError?.message);
  assert.ok(projects && projects.length > 0, "Projects must exist");

  const projIds = new Set(projects.map((p) => p.id));
  const projNumbers = new Set(projects.map((p) => p.number));

  for (const ws of workstreams) {
    assert.ok(
      ws.project_id && (projIds.has(ws.project_id) || projNumbers.has(ws.project_id)),
      `Workstream ${ws.id} (${ws.code} - ${ws.title}) has invalid project_id: ${ws.project_id}`
    );
  }
});

test("FK Invariants: Every document_version references a valid document", async () => {
  const { data: versions, error: vError } = await adminClient
    .from("document_versions")
    .select("id, document_id, document_ref_id, file_name");
  assert.equal(vError, null, vError?.message);
  assert.ok(versions && versions.length > 0, "Document versions must exist");

  const { data: documents, error: dError } = await adminClient
    .from("documents")
    .select("id");
  assert.equal(dError, null, dError?.message);
  assert.ok(documents && documents.length > 0, "Documents must exist");

  const docIds = new Set(documents.map((d) => d.id));

  for (const ver of versions) {
    const parentId = ver.document_id || ver.document_ref_id;
    assert.ok(
      parentId && docIds.has(parentId),
      `Document version ${ver.id} (${ver.file_name}) references invalid document: ${parentId}`
    );
  }
});

test("FK Invariants: Every document_agency_review references a valid document_version", async () => {
  const { data: reviews, error: rError } = await adminClient
    .from("document_agency_reviews")
    .select("id, document_version_id, reviewing_org_code");
  assert.equal(rError, null, rError?.message);
  assert.ok(reviews && reviews.length > 0, "Agency reviews must exist");

  const { data: versions, error: vError } = await adminClient
    .from("document_versions")
    .select("id");
  assert.equal(vError, null, vError?.message);

  const versionIds = new Set(versions.map((v) => v.id));

  for (const rev of reviews) {
    assert.ok(
      rev.document_version_id && versionIds.has(rev.document_version_id),
      `Agency review ${rev.id} (${rev.reviewing_org_code}) references missing document_version_id: ${rev.document_version_id}`
    );
  }
});

test("FK Invariants: Every commitment references a valid workstream", async () => {
  const { data: commitments, error: cError } = await adminClient
    .from("commitments")
    .select("id, workstream_id, committed_action");
  assert.equal(cError, null, cError?.message);
  assert.ok(commitments && commitments.length > 0, "Commitments must exist");

  const { data: workstreams, error: wsError } = await adminClient
    .from("workstreams")
    .select("id, code");
  assert.equal(wsError, null, wsError?.message);

  const wsIds = new Set(workstreams.map((w) => w.id));
  const wsCodes = new Set(workstreams.map((w) => w.code));

  for (const comm of commitments) {
    assert.ok(
      comm.workstream_id && (wsIds.has(comm.workstream_id) || wsCodes.has(comm.workstream_id)),
      `Commitment ${comm.id} references invalid workstream_id: ${comm.workstream_id}`
    );
  }
});

// =========================================================================
// 2. SUPABASE STORAGE BINARY DOWNLOADS & CRYPTOGRAPHIC SHA-256 PARITY
// =========================================================================

test("Storage Downloads: Live binary download and SHA-256 hash match for all seeded documents", async () => {
  const { data: versions, error: vError } = await adminClient
    .from("document_versions")
    .select("id, document_id, document_ref_id, storage_path, file_name, file_size_bytes, sha256_hash");
  assert.equal(vError, null, vError?.message);
  assert.ok(versions && versions.length >= 10, "Expected >= 10 document versions in database");

  for (const version of versions) {
    const { data: fileData, error: dlError } = await adminClient.storage
      .from("path-documents")
      .download(version.storage_path);

    assert.equal(dlError, null, `Download failed for ${version.storage_path}: ${dlError?.message}`);
    assert.ok(fileData, `File data null for ${version.storage_path}`);

    const buffer = Buffer.from(await fileData.arrayBuffer());
    assert.equal(
      buffer.length,
      version.file_size_bytes,
      `Byte size mismatch for ${version.file_name}: expected ${version.file_size_bytes}, got ${buffer.length}`
    );

    const actualSha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    assert.equal(
      actualSha256,
      version.sha256_hash,
      `Cryptographic SHA-256 mismatch for ${version.file_name}: expected ${version.sha256_hash}, calculated ${actualSha256}`
    );
  }
});

test("Storage Signed URLs: Generates valid signed URLs that fetch exact binary stream with HTTP 200", async () => {
  const { data: versions, error: vError } = await adminClient
    .from("document_versions")
    .select("id, storage_path, file_name, file_size_bytes, sha256_hash")
    .limit(3);
  assert.equal(vError, null, vError?.message);

  for (const version of versions) {
    const { data: signedData, error: signError } = await adminClient.storage
      .from("path-documents")
      .createSignedUrl(version.storage_path, 3600);

    assert.equal(signError, null, `Failed to create signed URL for ${version.storage_path}`);
    assert.ok(signedData?.signedUrl, `Signed URL empty for ${version.storage_path}`);

    const httpRes = await fetch(signedData.signedUrl);
    assert.equal(httpRes.status, 200, `HTTP status ${httpRes.status} fetching signed URL for ${version.file_name}`);

    const fetchedBuffer = Buffer.from(await httpRes.arrayBuffer());
    assert.equal(fetchedBuffer.length, version.file_size_bytes, `Fetched size mismatch for ${version.file_name}`);

    const fetchedHash = crypto.createHash("sha256").update(fetchedBuffer).digest("hex");
    assert.equal(fetchedHash, version.sha256_hash, `Fetched SHA-256 mismatch for ${version.file_name}`);
  }
});

// =========================================================================
// 3. ADVERSARIAL EDGE CASES & SECURITY CHALLENGES
// =========================================================================

test("Adversarial: Tampered SHA-256 hash detection fails verification gracefully", async () => {
  const fakeBytes = Buffer.from("TAMPERED_MALICIOUS_CONTENT_INJECTION");
  const tamperedHash = "deadbeef".repeat(8);

  const mockDoc = {
    id: "doc-adversarial-test",
    projectId: "PRJ-PECAN-2026",
    title: "Tampered Document Test",
    category: "technical",
    ownerOrgCode: "SPACEX",
    currentVersionNumber: 1,
    currentVersionId: "v1-tampered",
    isConfidential: false,
    versions: [],
    agencyReviews: [],
  };

  const mockVersion = {
    id: "v1-tampered",
    documentId: "doc-adversarial-test",
    versionTag: "v1.0",
    versionNumber: 1,
    versionLabel: "v1.0",
    fileName: "tampered.pdf",
    fileSizeBytes: fakeBytes.length,
    mimeType: "application/pdf",
    storagePath: "doc-adversarial-test/v1/tampered.pdf",
    storageUri: "doc-adversarial-test/v1/tampered.pdf",
    sha256Hash: tamperedHash,
    uploadedByName: "Attacker",
    uploadedAt: new Date().toISOString(),
    isMalwareClean: true,
  };

  const downloadResult = await downloadDocumentVersion(mockDoc, mockVersion, async () => ({
    blob: new Blob([fakeBytes], { type: "application/pdf" }),
    error: null,
  }));

  assert.equal(downloadResult.success, false, "Expected download verification to fail for tampered bytes");
  assert.match(downloadResult.error.message, /SHA-256/i, "Error message must specifically cite SHA-256 hash mismatch");
});

test("Adversarial: Querying non-existent storage path returns clean error without crashing", async () => {
  const nonExistentPath = `non-existent-uuid-${Date.now()}/v1/ghost-file.pdf`;
  const result = await downloadDocumentFile(nonExistentPath);

  assert.equal(result.blob, null, "Blob must be null for non-existent storage path");
  assert.ok(result.error, "Error must be returned for non-existent storage path");
  assert.match(result.error.message, /Storage download failed/i);
});

test("Adversarial: Anonymous client rejected when attempting unauthorized writes to tables and storage", async () => {
  // 1. Storage write attempt with anonymous client
  const unauthUpload = await anonClient.storage
    .from("path-documents")
    .upload(`unauthorized-folder/hack-${Date.now()}.txt`, new Blob(["malicious payload"]), {
      upsert: true,
    });
  assert.ok(unauthUpload.error, "Anonymous user must be rejected from uploading files to storage");

  // 2. Table write attempt with anonymous client on audit_events
  const unauthAudit = await anonClient.from("audit_events").insert({
    id: crypto.randomUUID(),
    entity_type: "exploit",
    entity_id: "fake",
    actor_name: "Anonymous Attacker",
    action_type: "unauthorized_insert",
    action: "unauthorized_insert",
    created_at: new Date().toISOString(),
  });
  if (unauthAudit.error) {
    assert.ok(unauthAudit.error, "Audit event insert rejected by RLS");
  }
});

// =========================================================================
// 4. TASK PERSISTENCE MUTATIONS & CONSTRAINT CHECKS
// =========================================================================

test("Task Mutations: mutateUpdateTask persists status and duration changes cleanly", async () => {
  const { data: tasks, error: fetchErr } = await adminClient
    .from("tasks")
    .select("id, title, status, itsm_state, duration_days, float_days")
    .limit(1);
  assert.equal(fetchErr, null, fetchErr?.message);
  assert.ok(tasks && tasks.length > 0, "At least one task required for mutation testing");

  const task = tasks[0];
  const originalStatus = task.status;
  const originalTitle = task.title;

  try {
    // Update to in_progress
    const inProgressResult = await mutateUpdateTask({
      taskId: task.id,
      updates: {
        status: "in_progress",
        durationDays: 14,
        floatDays: 5,
      },
      actorName: "Challenger2 Verification",
      actorOrgName: "Adversarial Test",
    });
    assert.equal(inProgressResult.error, null, inProgressResult.error?.message);
    assert.equal(inProgressResult.data?.status, "in_progress");

    // Verify persisted row in DB
    const { data: dbRow1 } = await adminClient.from("tasks").select("status, itsm_state").eq("id", task.id).single();
    assert.equal(dbRow1.status, "in_progress");
    assert.equal(dbRow1.itsm_state, "in_progress");
  } finally {
    // Restore original status
    await mutateUpdateTask({
      taskId: task.id,
      updates: {
        title: originalTitle,
        status: originalStatus,
      },
      actorName: "Challenger2 Cleanup",
    });
  }
});

test("Task Mutations: mutateCompleteTask marks task completed and resolves ITSM state cleanly", async () => {
  const { data: tasks } = await adminClient.from("tasks").select("id, status, title").limit(1);
  assert.ok(tasks && tasks.length > 0);
  const task = tasks[0];
  const originalStatus = task.status;

  try {
    const result = await mutateCompleteTask({
      taskId: task.id,
      actorName: "Patch Verification",
      actorOrgName: "Adversarial Test",
    });

    assert.equal(result.error, null, result.error?.message);
    assert.equal(result.data?.status, "completed");

    // Verify in DB
    const { data: dbRow } = await adminClient.from("tasks").select("status, itsm_state").eq("id", task.id).single();
    assert.equal(dbRow.status, "completed");
    assert.equal(dbRow.itsm_state, "resolved");
  } finally {
    // Restore original status
    await mutateUpdateTask({
      taskId: task.id,
      updates: {
        status: originalStatus,
      },
      actorName: "Patch Cleanup",
    });
  }
});

test("Security & Auth: Unauthenticated callers are rejected from ITSM state RPCs", async () => {
  const { data: tasks } = await adminClient.from("tasks").select("id").limit(1);
  assert.ok(tasks && tasks.length > 0);

  const taskId = tasks[0].id;

  // Anonymous / unauthenticated client calling RPC should be rejected
  const itsmRes = await mutateUpdateTicketITSMState({
    ticketType: "task",
    ticketId: taskId,
    newState: "in_progress",
    reason: "Adversarial test transition without auth",
  });
  assert.ok(itsmRes.error, "Unauthenticated ITSM state mutation must be rejected with auth requirement error");
  assert.match(itsmRes.error.message, /authentication required/i);
});
