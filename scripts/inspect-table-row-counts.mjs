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
      })
  );
}

const env = { ...readEnvFile(), ...process.env };
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.legacy_service_role_key;

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const allTables = [
  "organizations",
  "customer_organizations",
  "profiles",
  "organization_memberships",
  "projects",
  "project_participants",
  "workflow_definitions",
  "workflow_stages",
  "requests",
  "case_workflows",
  "assignments",
  "documents",
  "notifications",
  "audit_events",
  "permit_types",
  "requirement_resources",
  "workflow_versions",
  "workstreams",
  "tasks",
  "task_dependencies",
  "coordination_requests",
  "rfis",
  "rfi_responses",
  "document_versions",
  "document_agency_reviews",
  "commitments",
  "decisions",
  "meetings",
  "user_profiles",
  "external_filings",
  "customer_requests",
  "workflow_transitions",
  "stage_runs",
  "workflow_checklist_items",
  "workflow_version_stages",
  "assignment_groups",
  "assignment_group_memberships",
];

const counts = {};
const samples = {};

for (const tbl of allTables) {
  try {
    const { count, error, data } = await supabase
      .from(tbl)
      .select("*", { count: "exact", head: false })
      .limit(3);
    
    if (error) {
      counts[tbl] = `Error: ${error.message}`;
    } else {
      counts[tbl] = count;
      samples[tbl] = data;
    }
  } catch (err) {
    counts[tbl] = `Exception: ${err.message}`;
  }
}

// Buckets
let bucketList = [];
try {
  const { data: bData, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) bucketList = [`Error: ${bErr.message}`];
  else {
    bucketList = bData.map(b => b.name);
    for (const b of bData) {
      const { data: files, error: fErr } = await supabase.storage.from(b.name).list();
      b.filesCount = fErr ? `Error: ${fErr.message}` : files.length;
      b.sampleFiles = files;
    }
  }
} catch (err) {
  bucketList = [`Exception: ${err.message}`];
}

const summary = {
  tableCounts: counts,
  storageBuckets: bucketList,
  sampleRows: samples,
};

fs.writeFileSync("scripts/db-current-contents.json", JSON.stringify(summary, null, 2));
console.log("Database counts summary:");
for (const [tbl, c] of Object.entries(counts)) {
  console.log(`  ${tbl.padEnd(32)}: ${c}`);
}
console.log("\nStorage Buckets:", bucketList);
