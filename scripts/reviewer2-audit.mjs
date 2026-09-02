import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(path = ".env") {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs.readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 0) return [line.trim(), ""];
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      }),
  );
}

const env = { ...readEnvFile(), ...process.env };
const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.legacy_service_role_key;

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("================================================================================");
  console.log("REVIEWER 2: EXHAUSTIVE DATABASE, SCHEMA & STORAGE AUDIT");
  console.log("================================================================================");

  // 1. Check Auth Users
  const { data: usersData, error: usersErr } = await client.auth.admin.listUsers({ page: 1, perPage: 100 });
  const users = usersData?.users || [];
  console.log(`\n1. AUTH USERS: ${users.length} users found (Error: ${usersErr?.message || "none"})`);
  for (const u of users) {
    console.log(`   - ${u.email} (ID: ${u.id})`);
  }

  // 2. Check Organizations & Assignment Groups
  const { data: orgs, error: orgsErr } = await client.from("organizations").select("id, code, name");
  console.log(`\n2. ORGANIZATIONS: ${orgs?.length || 0} rows found (Error: ${orgsErr?.message || "none"})`);
  for (const o of orgs || []) {
    console.log(`   - [${o.code}] ${o.name} (${o.id})`);
  }

  const { data: ags, error: agsErr } = await client.from("assignment_groups").select("id, org_code, name, agency_type");
  console.log(`\n3. ASSIGNMENT GROUPS: ${ags?.length || 0} rows found (Error: ${agsErr?.message || "none"})`);
  for (const ag of ags || []) {
    console.log(`   - [${ag.org_code}] ${ag.name} (type: ${ag.agency_type}, ID: ${ag.id})`);
  }

  // 4. Check Projects
  const { data: projects, error: projErr } = await client.from("projects").select("*").order("number");
  console.log(`\n4. PROJECTS: ${projects?.length || 0} rows found (Error: ${projErr?.message || "none"})`);
  for (const p of projects || []) {
    console.log(`   - [${p.number}] ${p.name} (Type: ${p.project_type}, Status: ${p.status}, ID: ${p.id})`);
  }

  // 5. Check Permit Types
  const { data: permitTypes, error: ptErr } = await client.from("permit_types").select("*").order("code");
  console.log(`\n5. PERMIT TYPES: ${permitTypes?.length || 0} rows found (Error: ${ptErr?.message || "none"})`);
  for (const pt of permitTypes || []) {
    console.log(`   - [${pt.code}] ${pt.name} (Cat: ${pt.category}, Org: ${pt.responsible_org_code})`);
  }

  // 6. Check Workstreams
  const { data: workstreams, error: wsErr } = await client.from("workstreams").select("*").order("code");
  console.log(`\n6. WORKSTREAMS: ${workstreams?.length || 0} rows found (Error: ${wsErr?.message || "none"})`);
  for (const ws of workstreams || []) {
    console.log(`   - [${ws.code}] ${ws.title}`);
    console.log(`     Project ID: ${ws.project_id}`);
    console.log(`     Permit Type: ${ws.permit_type_id} | State: ${ws.operational_state} | RAG: ${ws.rag_status}`);
    console.log(`     Concierge: ${ws.state_concierge?.name} | Reg Lead: ${ws.regulatory_lead?.orgCode} - ${ws.regulatory_lead?.assignedReviewerName}`);
    console.log(`     6-Q Target Date: ${ws.six_questions?.whatIsTargetDate} | At Risk: ${ws.six_questions?.isItAtRisk}`);
  }

  // 7. Check Tasks
  const { data: tasks, error: tasksErr } = await client.from("tasks").select("*").order("id");
  console.log(`\n7. TASKS: ${tasks?.length || 0} rows found (Error: ${tasksErr?.message || "none"})`);
  for (const t of tasks || []) {
    console.log(`   - [${t.id}] ${t.title} (WS: ${t.workstream_id}, Dur: ${t.duration_days}d, Float: ${t.float_days}d, CP: ${t.is_critical_path}, Status: ${t.status})`);
  }

  // 8. Check Commitments, Decisions, Meetings, CRs, RFIs
  const { count: commCount } = await client.from("commitments").select("*", { count: "exact", head: true });
  const { count: decCount } = await client.from("decisions").select("*", { count: "exact", head: true });
  const { count: meetCount } = await client.from("meetings").select("*", { count: "exact", head: true });
  const { count: crCount } = await client.from("coordination_requests").select("*", { count: "exact", head: true });
  const { count: rfiCount } = await client.from("rfis").select("*", { count: "exact", head: true });
  const { count: revCount } = await client.from("document_agency_reviews").select("*", { count: "exact", head: true });

  console.log(`\n8. INTERAGENCY & COORDINATION OBJECTS:`);
  console.log(`   - Commitments: ${commCount}`);
  console.log(`   - Decisions: ${decCount}`);
  console.log(`   - Meetings: ${meetCount}`);
  console.log(`   - Coordination Requests: ${crCount}`);
  console.log(`   - RFIs: ${rfiCount}`);
  console.log(`   - Document Agency Reviews: ${revCount}`);

  // 9. Storage & Document Versions Cryptographic Audit
  console.log(`\n9. STORAGE & CRYPTOGRAPHIC VERIFICATION:`);
  const { data: docVersions, error: dvErr } = await client.from("document_versions").select("*").order("created_at");
  console.log(`   Found ${docVersions?.length || 0} document versions in ledger.`);

  let allHashesValid = true;
  let allDownloadsValid = true;

  for (const v of docVersions || []) {
    const { data: blob, error: dlErr } = await client.storage.from("path-documents").download(v.storage_path);
    if (dlErr || !blob) {
      console.error(`   ❌ Failed to download ${v.storage_path}: ${dlErr?.message}`);
      allDownloadsValid = false;
      continue;
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    const actualHash = crypto.createHash("sha256").update(buf).digest("hex");
    const isHashMatch = actualHash === v.sha256_hash;
    const isSizeMatch = buf.length === v.file_size_bytes;
    const isPdf = v.mime_type === "application/pdf" ? buf.toString("ascii", 0, 8).includes("%PDF-") : true;

    if (!isHashMatch || !isSizeMatch || !isPdf) {
      allHashesValid = false;
    }

    const { data: sData } = await client.storage.from("path-documents").createSignedUrl(v.storage_path, 60);
    let httpOk = false;
    if (sData?.signedUrl) {
      const res = await fetch(sData.signedUrl);
      httpOk = res.ok;
    }

    console.log(`   - [${v.file_name}]`);
    console.log(`     Size: ${buf.length} bytes (Expected: ${v.file_size_bytes}) -> ${isSizeMatch ? "MATCH" : "MISMATCH"}`);
    console.log(`     SHA-256: ${actualHash}`);
    console.log(`     Ledger Hash: ${v.sha256_hash} -> ${isHashMatch ? "MATCH" : "MISMATCH"}`);
    console.log(`     PDF Structure Valid: ${isPdf} | Signed URL HTTP 200: ${httpOk}`);
  }

  console.log(`\nStorage Parity Summary: Downloads: ${allDownloadsValid ? "ALL PASSED" : "FAILED"}, Hashes: ${allHashesValid ? "ALL MATCHED" : "MISMATCH"}`);
}

main().catch(err => { console.error("Audit Error:", err); process.exit(1); });
