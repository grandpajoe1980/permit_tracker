import fs from "node:fs";
import crypto from "node:crypto";
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
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.LEGACY_SERVICE_ROLE_KEY || env.legacy_service_role_key;

if (!url || !key) {
  console.error("Missing SUPABASE credentials");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function runIndependentAudit() {
  console.log("=== INDEPENDENT AUDIT START ===");
  const findings = {
    database: { passed: true, details: [] },
    coverage: { passed: true, details: [] },
    storage: { passed: true, details: [] },
    navigation: { passed: true, details: [] }
  };

  // 1. Audit Database Tables and Row Counts
  const tables = [
    "organizations",
    "assignment_groups",
    "profiles",
    "organization_memberships",
    "projects",
    "permit_types",
    "requirement_resources",
    "workstreams",
    "tasks",
    "commitments",
    "project_decisions",
    "project_meetings",
    "coordination_requests",
    "coordination_request_activities",
    "rfis",
    "rfi_responses",
    "project_documents",
    "document_versions",
    "document_agency_reviews",
    "workflow_definitions",
    "workflow_stages",
    "workflow_steps",
    "audit_ledger",
    "customer_requests",
    "customer_filings",
    "interagency_coordinations",
    "statutory_catalog_links"
  ];

  console.log("\n--- Checking Table Presence and Record Counts ---");
  for (const table of tables) {
    const { data, count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      findings.database.passed = false;
      findings.database.details.push(`FAIL: Table ${table} query error: ${error.message}`);
      console.log(`[FAIL] Table ${table}: ${error.message}`);
    } else {
      findings.database.details.push(`PASS: Table ${table} has ${count} rows`);
      console.log(`[PASS] Table ${table}: ${count} rows`);
    }
  }

  // 2. Audit Projects
  console.log("\n--- Checking Seeded Projects ---");
  const { data: projects, error: projErr } = await supabase.from("projects").select("*");
  if (projErr || !projects || projects.length === 0) {
    findings.database.passed = false;
    findings.database.details.push(`FAIL: Projects query error: ${projErr?.message}`);
  } else {
    console.log(`Found ${projects.length} projects in DB:`);
    for (const p of projects) {
      console.log(`  - [${p.project_number}] ${p.name} (id: ${p.id}, status: ${p.status})`);
    }
  }

  // 3. Audit Workstreams and Tasks per Project
  console.log("\n--- Checking Workstreams & Tasks ---");
  const { data: workstreams, error: wsErr } = await supabase.from("workstreams").select("*");
  const { data: tasks, error: taskErr } = await supabase.from("tasks").select("*");
  console.log(`Total Workstreams: ${workstreams?.length || 0}, Total Tasks: ${tasks?.length || 0}`);
  
  if (!workstreams || workstreams.length === 0) {
    findings.coverage.passed = false;
    findings.coverage.details.push("FAIL: No workstreams found");
  } else {
    for (const ws of workstreams) {
      const wsTasks = (tasks || []).filter(t => t.workstream_id === ws.id);
      console.log(`  - Workstream ${ws.code} (${ws.name}): ${wsTasks.length} tasks, Project ID: ${ws.project_id}, Concierge: ${ws.state_concierge_id || 'N/A'}, Lead: ${ws.regulatory_lead_id || 'N/A'}`);
      if (!ws.project_id) {
        findings.coverage.passed = false;
        findings.coverage.details.push(`FAIL: Workstream ${ws.code} has null project_id`);
      }
    }
  }

  // 4. Audit Permit Types vs Roadmap
  console.log("\n--- Checking Permit Types ---");
  const { data: permitTypes, error: ptErr } = await supabase.from("permit_types").select("*");
  console.log(`Total Permit Types: ${permitTypes?.length || 0}`);
  const expectedPermitCodes = [
    "FAA-PART-450",
    "FAA-PART-420",
    "FAA-NEPA-EIS",
    "USACE-404-10",
    "USACE-408",
    "LDEQ-401-WQC",
    "OCM-CUP",
    "LDEQ-LPDES-DELUGE",
    "LDEQ-LAR100000",
    "LDEQ-AIR-MINORTITLEV",
    "USFWS-ESA-SEC7",
    "SHPO-NHPA-106",
    "SLO-WATERBOTTOMS",
    "CPRA-COASTAL-REVIEW",
    "LDOTD-HIGHWAY-ACCESS",
    "VERMILION-BUILDING-FLOOD",
    "FERC-NGA-SEC7",
    "PHMSA-PART-193",
    "ATF-EXPLOSIVES-MAGAZINE",
    "FAA-7480-AIRPORT",
    "FAA-7460-OBSTRUCTION",
    "LDWF-SCENIC-STREAM",
    "LDOH-SANITARY-SEWER",
    "EPA-RMP-PSM",
    "SPCC-OIL-SPILL"
  ];

  const presentCodes = new Set((permitTypes || []).map(p => p.code));
  for (const code of expectedPermitCodes) {
    if (presentCodes.has(code)) {
      findings.coverage.details.push(`PASS: Permit type ${code} present`);
    } else {
      findings.coverage.passed = false;
      findings.coverage.details.push(`FAIL: Missing permit type ${code}`);
      console.log(`[FAIL] Missing permit type: ${code}`);
    }
  }

  // 5. Audit Storage Bucket & Documents
  console.log("\n--- Checking Supabase Storage Bucket & Files ---");
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  console.log("Buckets found:", buckets?.map(b => b.name));

  // Determine bucket name
  let targetBucket = "project-documents";
  let bucketExists = buckets?.some(b => b.name === "project-documents");
  if (!bucketExists && buckets?.some(b => b.name === "path-documents")) {
    targetBucket = "path-documents";
  }
  console.log(`Auditing Storage Bucket: ${targetBucket}`);

  const { data: docVersions, error: dvErr } = await supabase.from("document_versions").select("*, project_documents(*)");
  console.log(`Total document versions in DB: ${docVersions?.length || 0}`);

  // Test downloads for each document version
  for (const docVer of docVersions || []) {
    const filePath = docVer.storage_path;
    const docMeta = docVer.project_documents;
    console.log(`Testing document: ${docMeta?.title} (File: ${docVer.file_name}, Path: ${filePath})`);
    
    // Test signed URL
    const { data: signedData, error: sErr } = await supabase.storage.from(targetBucket).createSignedUrl(filePath, 3600);
    if (sErr || !signedData?.signedUrl) {
      findings.storage.passed = false;
      findings.storage.details.push(`FAIL: Cannot create signed URL for ${filePath}: ${sErr?.message}`);
      console.log(`  [FAIL] Signed URL generation: ${sErr?.message}`);
      continue;
    }

    // Fetch from signed URL
    try {
      const resp = await fetch(signedData.signedUrl);
      if (resp.status !== 200) {
        findings.storage.passed = false;
        findings.storage.details.push(`FAIL: HTTP status ${resp.status} for ${filePath}`);
        console.log(`  [FAIL] HTTP status ${resp.status}`);
      } else {
        const buffer = Buffer.from(await resp.arrayBuffer());
        const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
        const contentType = resp.headers.get("content-type");
        const matchHash = sha256 === docVer.sha256_hash;
        console.log(`  [PASS] HTTP 200, Length: ${buffer.length} bytes, MIME: ${contentType}, SHA256 Match: ${matchHash} (${sha256.slice(0, 12)}...)`);
        if (!matchHash) {
          findings.storage.passed = false;
          findings.storage.details.push(`FAIL: Hash mismatch for ${filePath}. Expected: ${docVer.sha256_hash}, Got: ${sha256}`);
        } else {
          findings.storage.details.push(`PASS: ${docVer.file_name} downloaded successfully, 100% hash parity`);
        }
      }
    } catch (e) {
      findings.storage.passed = false;
      findings.storage.details.push(`FAIL: Download exception for ${filePath}: ${e.message}`);
      console.log(`  [FAIL] Download exception: ${e.message}`);
    }
  }

  // 6. Verify Each Project has at least 1 Document
  console.log("\n--- Checking Document per Project Coverage ---");
  const { data: projectDocs } = await supabase.from("project_documents").select("*");
  for (const p of projects || []) {
    const pDocs = (projectDocs || []).filter(d => d.project_id === p.id);
    console.log(`Project [${p.project_number}] ${p.name}: ${pDocs.length} documents`);
    if (pDocs.length === 0) {
      findings.storage.passed = false;
      findings.storage.details.push(`FAIL: Project ${p.project_number} has no documents in DB`);
    } else {
      findings.storage.details.push(`PASS: Project ${p.project_number} has ${pDocs.length} documents`);
    }
  }

  console.log("\n=== INDEPENDENT AUDIT SUMMARY ===");
  console.log("Database Structure & Records:", findings.database.passed ? "PASS" : "FAIL");
  console.log("Roadmap Coverage:", findings.coverage.passed ? "PASS" : "FAIL");
  console.log("Storage & Downloads:", findings.storage.passed ? "PASS" : "FAIL");

  fs.writeFileSync("scripts/independent-audit-results.json", JSON.stringify(findings, null, 2));
}

runIndependentAudit().catch(err => {
  console.error("Audit script failed:", err);
  process.exit(1);
});
