import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "https://zomzacaxwqfwjstkxbpv.supabase.co";
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.LEGACY_SERVICE_ROLE_KEY || env.legacy_service_role_key;

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

const mutations = await vite.ssrLoadModule("/lib/supabase/mutations.ts");
const queries = await vite.ssrLoadModule("/lib/supabase/queries.ts");
const storage = await vite.ssrLoadModule("/lib/supabase/storage.ts");

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

test("E2E Durability Flow: Dual-User Customer Request Propagation & Audit Verification", async () => {
  const reqId = `test-req-${Date.now()}`;
  const confirmationNumber = `PATH-2026-TEST-${Math.floor(Math.random() * 10000)}`;

  // 1. User A (SpaceX PM Maya Chen) creates a customer request
  const { data: created, error: createErr } = await mutations.mutateCreateCustomerRequest({
    id: reqId,
    confirmationNumber,
    projectId: "PRJ-PECAN-2026",
    requestType: "government_help",
    title: "E2E Test: Heavy-Haul State Route Assistance",
    description: "Testing cross-session Supabase PostgreSQL data propagation.",
    requestedOutcome: "DOTD Route Concurrence",
    submittedByName: "Maya Chen",
    blocksActiveWork: true,
    status: "submitted",
    attachmentDocumentVersionIds: [],
  });

  assert.equal(createErr, null, createErr?.message);
  assert.ok(created);
  assert.equal(created.confirmationNumber, confirmationNumber);

  // 2. Direct PostgreSQL assertion on live table
  const { data: dbRows, error: dbErr } = await supabase
    .from("customer_requests")
    .select("*")
    .eq("confirmation_number", confirmationNumber);

  assert.equal(dbErr, null);
  assert.equal(dbRows.length, 1);
  assert.equal(dbRows[0].title, "E2E Test: Heavy-Haul State Route Assistance");

  // 3. User B (State PM Sarah Johnson) in a clean isolated session queries requests
  const requests = await queries.fetchCustomerRequests("PRJ-PECAN-2026");
  const found = requests.find((r) => r.confirmationNumber === confirmationNumber);
  assert.ok(found, "User B should retrieve the persisted request from Supabase");
  assert.equal(found.blocksActiveWork, true);

  // 4. Verify audit ledger record exists in Supabase PostgreSQL
  const { data: auditRows } = await supabase
    .from("audit_events")
    .select("*")
    .eq("entity_id", confirmationNumber);

  assert.ok(auditRows.length > 0, "Audit event must be committed to Supabase");
  assert.equal(auditRows[0].action_type, "customer_request_submitted");

  // Cleanup test record
  await supabase.from("customer_requests").delete().eq("id", reqId);
  await supabase.from("audit_events").delete().eq("entity_id", confirmationNumber);
});

test("E2E Durability Flow: RFI Lifecycle & Workstream State Machine in PostgreSQL", async () => {
  const rfiId = `test-rfi-${Date.now()}`;
  const rfiCode = `RFI-2026-TEST-${Math.floor(Math.random() * 10000)}`;

  // 1. CPRA Reviewer Jordan Lee creates RFI on WS-WETLANDS-PAD-A
  const { data: rfi, error: rfiErr } = await mutations.mutateCreateRFI({
    id: rfiId,
    code: rfiCode,
    workstreamId: "WS-WETLANDS-PAD-A",
    workstreamTitle: "USACE / CPRA Joint Dredge & Fill",
    requestingOrgId: "org-cpra",
    requestingOrgCode: "CPRA",
    recipientOrgId: "org-spacex",
    recipientOrgCode: "SPACEX",
    title: "Culvert Cross-Section Hydraulic Model",
    questionText: "Please provide the updated 100-year storm event analysis.",
    technicalReason: "Required for coastal drainage review.",
    responseDeadline: "2026-09-15",
    clockImpact: "pauses_clock",
    scheduleImpactDays: 5,
    actorName: "Jordan Lee",
  });

  assert.equal(rfiErr, null, rfiErr?.message);
  assert.ok(rfi);

  // 2. Assert workstream operational_state paused in Supabase
  const { data: wsData } = await supabase
    .from("workstreams")
    .select("operational_state, waiting_reason")
    .eq("code", "WS-WETLANDS-PAD-A")
    .single();

  assert.equal(wsData.operational_state, "waiting_applicant");

  // 3. SpaceX PM Maya Chen submits response
  const respId = `test-resp-${Date.now()}`;
  const { data: resp, error: respErr } = await mutations.mutateSubmitRFIResponse({
    id: respId,
    rfiId,
    rfiCode,
    submittedByName: "Maya Chen",
    responseText: "Hydraulic model uploaded with 100-year rainfall calibration.",
    actorOrgName: "SpaceX",
    attachedDocumentVersionIds: [],
  });

  assert.equal(respErr, null, respErr?.message);
  assert.ok(resp);

  // 4. CPRA Reviewer accepts response and resumes review
  const { data: accepted, error: acceptErr } = await mutations.mutateAcceptRFIResponse({
    rfiId,
    rfiCode,
    workstreamId: "WS-WETLANDS-PAD-A",
    actorName: "Jordan Lee",
    actorOrgName: "CPRA",
    notes: "Hydraulic parameters validated against NOAA Atlas 14.",
  });

  assert.equal(acceptErr, null, acceptErr?.message);
  assert.ok(accepted?.success);

  // 5. Assert workstream returned to running
  const { data: wsResumed } = await supabase
    .from("workstreams")
    .select("operational_state")
    .eq("code", "WS-WETLANDS-PAD-A")
    .single();

  assert.equal(wsResumed.operational_state, "running");

  // Cleanup test records
  await supabase.from("rfi_responses").delete().eq("id", respId);
  await supabase.from("rfis").delete().eq("id", rfiId);
  await supabase.from("audit_events").delete().eq("entity_id", rfiCode);
});

test("E2E Durability Flow: Multi-Agency Document Review Signoff in PostgreSQL", async () => {
  const versionId = `test-doc-v-${Date.now()}`;

  // 1. Create parent document version first to satisfy foreign key
  await supabase.from("document_versions").insert({
    id: versionId,
    document_ref_id: "doc-drainage-01",
    version_number: 99,
    version_label: "v99.0",
    storage_path: `doc-drainage-01/v99/test.pdf`,
    file_name: "test.pdf",
    mime_type: "application/pdf",
    file_size_bytes: 1024,
    sha256_hash: "a".repeat(64),
    uploaded_by_name: "Maya Chen",
    uploaded_by_org_name: "SpaceX",
    change_notes: "E2E foreign key test version",
    status: "under_review",
    created_at: new Date().toISOString(),
  });

  // 2. Create document agency review row
  const { error: insErr } = await supabase.from("document_agency_reviews").insert([
    {
      id: `rev-${versionId}-cpra`,
      document_version_id: versionId,
      reviewing_org_id: "org-cpra",
      reviewing_org_code: "CPRA",
      status: "under_review",
      review_status: "under_review",
      created_at: new Date().toISOString(),
    },
  ]);
  assert.equal(insErr, null, insErr?.message);

  // 3. Jordan Lee (CPRA) signs off as approved
  const { success, error: signoffErr } = await storage.mutateReviewDocumentVersion({
    versionId,
    agencyCode: "CPRA",
    decision: "approved",
    actorName: "Jordan Lee",
    comments: "E2E review signoff passed without exception.",
  });

  assert.equal(signoffErr, null, signoffErr?.message);
  assert.equal(success, true);

  // 4. Verify in PostgreSQL table
  const { data: reviewRow } = await supabase
    .from("document_agency_reviews")
    .select("*")
    .eq("id", `rev-${versionId}-cpra`)
    .single();

  assert.ok(reviewRow);
  assert.equal(reviewRow.status, "approved");
  assert.equal(reviewRow.reviewed_by_user_name, "Jordan Lee");

  // Cleanup
  await supabase.from("document_agency_reviews").delete().eq("id", `rev-${versionId}-cpra`);
  await supabase.from("document_versions").delete().eq("id", versionId);
  await supabase.from("audit_events").delete().eq("entity_id", `rev-${versionId}-cpra`);
});
