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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
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

const mappings = await vite.ssrLoadModule("/lib/supabase/mappings.ts");
const queries = await vite.ssrLoadModule("/lib/supabase/queries.ts");
const storage = await vite.ssrLoadModule("/lib/supabase/storage.ts");
const { repository } = await vite.ssrLoadModule("/lib/repository.ts");

test("Supabase Mappings: workstreamRowToDomain and domainToWorkstreamRow bidirectional fidelity", () => {
  const row = {
    id: "ws-test-01",
    project_id: "PRJ-PECAN-2026",
    code: "WS-TEST-HAUL",
    title: "Test Heavy Haul",
    category: "road",
    category_label: "ROAD",
    permit_type_id: "cat-dotd-heavyhaul",
    current_stage_name: "Route Survey",
    operational_state: "waiting_applicant",
    operational_state_label: "Waiting on Applicant",
    rag_status: "yellow",
    is_critical_path: true,
    baseline_start_date: "2026-08-01",
    baseline_target_date: "2026-09-01",
    forecast_start_date: "2026-08-05",
    forecast_target_date: "2026-09-08",
    schedule_variance_days: 7,
    waiting_reason: "Awaiting axle loading specs.",
    waiting_on_entity: "SPACEX",
    current_action_summary: "Reviewing bridge capacities.",
    escalation_level: 1,
    state_concierge: { name: "Sarah Johnson", email: "sarah.johnson@la.gov", agency: "Project Office" },
    regulatory_lead: { orgCode: "DOTD", orgName: "DOTD", jurisdictionLevel: "State", assignedReviewerName: "Sam Rivera", assignedReviewerEmail: "sam.rivera@la.gov" },
  };

  const domain = mappings.workstreamRowToDomain(row);
  assert.equal(domain.code, "WS-TEST-HAUL");
  assert.equal(domain.operationalState, "waiting_applicant");
  assert.equal(domain.ragHealth, "yellow");
  assert.equal(domain.isCriticalPath, true);
  assert.equal(domain.scheduleVarianceDays, 7);
  assert.equal(domain.regulatoryLead.orgCode, "DOTD");

  const backRow = mappings.domainToWorkstreamRow(domain);
  assert.equal(backRow.code, "WS-TEST-HAUL");
  assert.equal(backRow.operational_state, "waiting_applicant");
  assert.equal(backRow.rag_status, "yellow");
  assert.equal(backRow.schedule_variance_days, 7);
});

test("Supabase Mappings: customerRequestRowToDomain converts snake_case to domain model", () => {
  const row = {
    id: "req-001",
    confirmation_number: "PATH-2026-0001",
    project_id: "PRJ-PECAN-2026",
    request_type: "permit_authorization",
    title: "USACE Section 404 Dredge & Fill",
    description: "Permit authorization tracking for wetlands dredging.",
    requested_outcome: "Formal Verification",
    blocks_active_work: true,
    status: "submitted",
    attachment_document_version_ids: ["doc-v1", "doc-v2"],
    created_at: "2026-08-25T10:00:00Z",
    updated_at: "2026-08-25T10:00:00Z",
  };

  const domain = mappings.customerRequestRowToDomain(row);
  assert.equal(domain.confirmationNumber, "PATH-2026-0001");
  assert.equal(domain.requestType, "permit_authorization");
  assert.equal(domain.blocksActiveWork, true);
  assert.equal(domain.status, "submitted");
  assert.deepEqual(domain.attachmentDocumentVersionIds, ["doc-v1", "doc-v2"]);
});

test("Supabase Mappings: rfiRowToDomain converts RFI and nested responses", () => {
  const rfiRow = {
    id: "rfi-01",
    code: "RFI-2026-0042",
    workstream_id: "WS-WETLANDS-PAD-A",
    workstream_title: "USACE / CPRA Joint Dredge & Fill",
    requesting_org_id: "org-cpra",
    requesting_org_code: "CPRA",
    recipient_org_id: "org-spacex",
    recipient_org_code: "SPACEX",
    title: "Culvert Cross-Section Hydraulic Model",
    question_text: "Please provide the 100-year storm event hydraulic model.",
    technical_reason: "Hydraulic impact assessment required by statute.",
    required_document_types: ["Hydraulic Modeling Report"],
    issued_date: "2026-08-20",
    response_deadline: "2026-09-02",
    clock_impact: "pauses_clock",
    schedule_impact_days: 5,
    status: "submitted_by_applicant",
    is_consolidated_cycle: false,
  };

  const respRow = {
    id: "resp-01",
    rfi_id: "rfi-01",
    submitted_by_user_name: "Maya Chen",
    response_text: "Attached is HEC-RAS 2D model report.",
    attached_document_version_ids: ["doc-v-hecras-v1"],
    submitted_date: "2026-08-26",
    review_status: "under_review",
  };

  const domainResp = mappings.rfiResponseRowToDomain(respRow);
  const domainRfi = mappings.rfiRowToDomain(rfiRow, [domainResp]);

  assert.equal(domainRfi.code, "RFI-2026-0042");
  assert.equal(domainRfi.requestingOrgCode, "CPRA");
  assert.equal(domainRfi.responses.length, 1);
  assert.equal(domainRfi.responses[0].submittedByName, "Maya Chen");
  assert.equal(domainRfi.responses[0].reviewDecision, "under_review");
});

test("Supabase Storage: calculateSHA256 generates valid 64-character hex hash", async () => {
  const encoder = new TextEncoder();
  const buffer = encoder.encode("SpaceX Pecan Island Launch Complex Engineering Plans v8.0");
  const hash = await storage.calculateSHA256(buffer.buffer);
  assert.equal(typeof hash, "string");
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("Supabase Live Database: verifies live tables on project zomzacaxwqfwjstkxbpv", async () => {
  if (!supabaseUrl || !supabaseKey) {
    console.warn("Skipping live Supabase assertion (credentials missing in environment)");
    return;
  }

  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const [wsRes, permitRes, docRes, profRes] = await Promise.all([
    client.from("workstreams").select("code, title, operational_state").limit(5),
    client.from("permit_types").select("code, name").limit(5),
    client.from("documents").select("title, category").limit(5),
    client.from("user_profiles").select("full_name, work_email").limit(5),
  ]);

  assert.equal(wsRes.error, null, wsRes.error?.message);
  assert.ok(wsRes.data.length > 0, "Expected workstreams in Supabase PostgreSQL");

  assert.equal(permitRes.error, null, permitRes.error?.message);
  assert.ok(permitRes.data.length > 0, "Expected permit_types in Supabase PostgreSQL");

  assert.equal(docRes.error, null, docRes.error?.message);
  assert.ok(docRes.data.length > 0, "Expected documents in Supabase PostgreSQL");

  assert.equal(profRes.error, null, profRes.error?.message);
  assert.ok(profRes.data.length > 0, "Expected user_profiles in Supabase PostgreSQL");
});

test("Supabase Hydration: repository.hydrateFromSupabase populates domain records from PostgreSQL", async () => {
  const success = await repository.hydrateFromSupabase();
  assert.equal(success, true);
  const workstreams = repository.getWorkstreams();
  assert.ok(workstreams.length >= 9, "Expected 9+ workstreams hydrated from Supabase");
  const catalog = repository.getCatalog();
  assert.ok(catalog.length >= 3, "Expected 3+ permit types hydrated from Supabase");
});
