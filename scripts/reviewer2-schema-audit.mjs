import fs from "node:fs";
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

async function run() {
  console.log("=== SCHEMA TABLES AUDIT ===");
  const tableNames = [
    "organizations",
    "customer_organizations",
    "assignment_groups",
    "profiles",
    "organization_memberships",
    "workflow_definitions",
    "workflow_stages",
    "permit_types",
    "requirement_resources",
    "projects",
    "project_participants",
    "workstreams",
    "tasks",
    "task_dependencies",
    "stage_runs",
    "documents",
    "document_versions",
    "document_agency_reviews",
    "commitments",
    "decisions",
    "meetings",
    "coordination_requests",
    "rfis",
    "rfi_responses",
    "requests",
    "customer_requests",
    "external_filings",
    "case_workflows",
    "assignments",
    "notifications",
    "audit_events",
    "preapp_projects",
    "preapp_study_checklist",
    "preapp_notes",
    "legacy_permits",
    "legacy_inspections",
    "legacy_audit_logs",
  ];

  console.log(`Checking existence and row count for ${tableNames.length} known tables:`);
  let tablesFound = 0;
  for (const t of tableNames) {
    const { count, error } = await client.from(t).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`  ❌ ${t}: ERROR - ${error.message}`);
    } else {
      tablesFound++;
      console.log(`  ✅ ${t}: ${count} rows`);
    }
  }
  console.log(`Total accessible tables: ${tablesFound} / ${tableNames.length}`);

  console.log("\n=== 6 PROJECTS AUDIT ===");
  const { data: projs } = await client.from("projects").select("id, number, name, project_type, status, risk");
  for (const p of projs || []) {
    console.log(`  [${p.number}] ${p.name} | Type: ${p.project_type} | Risk: ${p.risk} | ID: ${p.id}`);
  }

  console.log("\n=== PERMIT TYPES AUDIT ===");
  const { data: pts } = await client.from("permit_types").select("id, code, name, category, responsible_org_code");
  console.log(`Found ${pts?.length} permit types:`);
  for (const pt of pts || []) {
    console.log(`  [${pt.code}] (${pt.category}) ${pt.name} -> Org: ${pt.responsible_org_code}`);
  }

  console.log("\n=== AUTH USERS AUDIT ===");
  const { data: users } = await client.auth.admin.listUsers();
  console.log(`Found ${users?.users?.length} auth users:`);
  for (const u of users?.users || []) {
    console.log(`  ${u.email} (id: ${u.id})`);
  }
}

run().catch(console.error);
