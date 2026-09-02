import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";

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

function escapePdfText(value) {
  return value.replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1");
}

function createPdf(lines) {
  const content = [
    "BT",
    "/F1 16 Tf",
    "50 760 Td",
    `(${escapePdfText(lines[0])}) Tj`,
    "/F1 11 Tf",
    "0 -28 Td",
    ...lines.slice(1).map((line) => `(${escapePdfText(line)}) Tj 0 -18 Td`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const chunks = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.concat(chunks).length);
    chunks.push(Buffer.from(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`, "ascii"));
  }
  const xrefOffset = Buffer.concat(chunks).length;
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (const offset of offsets.slice(1)) xref.push(`${String(offset).padStart(10, "0")} 00000 n `);
  xref.push("trailer", `<< /Size ${objects.length + 1} /Root 1 0 R >>`, "startxref", String(xrefOffset), "%%EOF");
  chunks.push(Buffer.from(`${xref.join("\n")}\n`, "ascii"));
  return Buffer.concat(chunks);
}

const env = { ...readEnvFile(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.LEGACY_SERVICE_ROLE_KEY || env.legacy_service_role_key;

if (!url || !key) {
  console.error("Missing SUPABASE_URL and SUPABASE_SECRET_KEY credentials in environment");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const STORAGE_BUCKETS = ["path-documents", "project-documents"];
const PRIMARY_STORAGE_BUCKET = STORAGE_BUCKETS[0];

// Load fixture data for alignment
const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

const {
  workstreamsData: fixtureWorkstreams,
  commitmentsData: fixtureCommitments,
  projectDecisionsData: fixtureDecisions,
  projectMeetingsData: fixtureMeetings,
  coordinationRequestsData: fixtureCoordinationRequests,
  rfisData: fixtureRfis,
} = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");

await vite.close();

console.log("================================================================================");
console.log("STARBASE LOUISIANA COMMAND SYSTEM: SAFE RESET & AUTHORITATIVE SEEDING");
console.log("================================================================================");

// -----------------------------------------------------------------------------
// STEP 1: TOPOLOGICAL CLEANUP OF NON-PRODUCTION OPERATIONAL ROWS
// -----------------------------------------------------------------------------
console.log("\n[Step 1/4] Executing topological cleanup of operational tables...");

const operationalTables = [
  "audit_events",
  "notifications",
  "rfi_responses",
  "commitments",
  "coordination_requests",
  "document_agency_reviews",
  "task_dependencies",
  "stage_runs",
  "external_filings",
  "customer_requests",
  "case_workflows",
  "assignments",
  "project_participants",
  "decisions",
  "meetings",
  "rfis",
  "document_versions",
  "tasks",
  "documents",
  "workstreams",
  "requests",
  "projects",
  "requirement_resources",
  "permit_types",
];


for (let i = 0; i < operationalTables.length; i++) {
  const table = operationalTables[i];
  const { data: rows, error: selectErr } = await supabase.from(table).select("id");
  if (selectErr) {
    console.warn(`  [${i + 1}/${operationalTables.length}] Table ${table} select check: ${selectErr.message}`);
    continue;
  }
  const count = rows?.length || 0;
  if (count > 0) {
    const ids = rows.map((r) => r.id);
    for (let batch = 0; batch < ids.length; batch += 100) {
      const slice = ids.slice(batch, batch + 100);
      const { error: delErr } = await supabase.from(table).delete().in("id", slice);
      if (delErr) {
        console.error(`  ❌ Error deleting from ${table}:`, delErr.message);
      }
    }
    console.log(`  [${i + 1}/${operationalTables.length}] Cleared ${count} rows from ${table}`);
  } else {
    console.log(`  [${i + 1}/${operationalTables.length}] ${table}: already clean (0 rows)`);
  }
}

async function ensurePrivateBucket(bucketName) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`Storage bucket listing failed: ${listError.message}`);
  if (!buckets?.some((bucket) => bucket.name === bucketName)) {
    const { error } = await supabase.storage.createBucket(bucketName, { public: false });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`Storage bucket creation failed for ${bucketName}: ${error.message}`);
    }
  }
}

async function listStorageFiles(bucketName, prefix = "") {
  const { data, error } = await supabase.storage.from(bucketName).list(prefix, { limit: 1000 });
  if (error) throw new Error(`Storage listing failed for ${bucketName}/${prefix}: ${error.message}`);
  const paths = [];
  for (const item of data || []) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) paths.push(itemPath);
    else paths.push(...await listStorageFiles(bucketName, itemPath));
  }
  return paths;
}

console.log("\nCleaning authoritative document Storage buckets...");
for (const bucketName of STORAGE_BUCKETS) {
  await ensurePrivateBucket(bucketName);
  const paths = await listStorageFiles(bucketName);
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await supabase.storage.from(bucketName).remove(paths.slice(index, index + 100));
    if (error) throw new Error(`Storage cleanup failed for ${bucketName}: ${error.message}`);
  }
  console.log(`  ✅ Storage bucket '${bucketName}' cleared (${paths.length} files).`);
}

// -----------------------------------------------------------------------------
// STEP 2: LOOKUP SYSTEM CATALOGS & AUTH ENTITIES
// -----------------------------------------------------------------------------
console.log("\n[Step 2/4] Verifying system catalogs, user profiles, and assignment groups...");

const { data: orgs } = await supabase.from("organizations").select("id, code, name");
const orgMap = new Map((orgs || []).map((o) => [o.code, o.id]));

const requiredOrganizations = [
  ["FAA", "Federal Aviation Administration - AST", "federal"],
  ["LDCE", "Louisiana Department of Conservation and Energy", "state"],
  ["SLO", "Louisiana Office of State Lands", "state"],
  ["LPSC", "Louisiana Public Service Commission", "state"],
  ["VPPJ", "Vermilion Parish Police Jury Permitting Office", "local"],
  ["USFWS", "U.S. Fish and Wildlife Service", "federal"],
  ["NOAA", "NOAA Fisheries Southeast Region", "federal"],
  ["SHPO", "Louisiana State Historic Preservation Office", "state"],
];
for (const [code, name, jurisdictionLevel] of requiredOrganizations) {
  const { data, error } = await supabase.from("organizations").upsert({
    code,
    name,
    organization_type: jurisdictionLevel === "federal" ? "federal_agency" : "state_agency",
    jurisdiction_level: jurisdictionLevel,
    active: true,
  }, { onConflict: "code" }).select("id, code").single();
  if (error) throw new Error(`Organization seed failed for ${code}: ${error.message}`);
  orgMap.set(code, data.id);
}

const { data: customerOrgs } = await supabase.from("customer_organizations").select("id, name");
let customerOrgId = customerOrgs?.[0]?.id;
if (!customerOrgId) {
  const { data: newCust } = await supabase.from("customer_organizations").insert({
    id: "b9977037-3175-4dc6-9b61-8d64b6b863fa",
    name: "SpaceX Louisiana",
    legal_name: "Space Exploration Technologies Corp. — Louisiana Program",
    active: true,
  }).select("id").single();
  customerOrgId = newCust?.id;
}

const { data: authUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
const usersList = authUsers?.users || [];
const alexUser = usersList.find((u) => u.email?.includes("alex.martin")) || usersList[0];
const mayaUser = usersList.find((u) => u.email?.includes("maya.chen")) || alexUser;
const sarahUser = usersList.find((u) => u.email?.includes("sarah.johnson")) || alexUser;
const samUser = usersList.find((u) => u.email?.includes("sam.rivera")) || sarahUser;
const markUser = usersList.find((u) => u.email?.includes("mark.fontenot")) || samUser;

const { data: ags } = await supabase.from("assignment_groups").select("id, org_code, name");
const agMap = new Map((ags || []).map((ag) => [`${ag.org_code}:${ag.name}`, ag.id]));

function findAgId(orgCode, keyword) {
  for (const ag of ags || []) {
    if (ag.org_code === orgCode && (!keyword || ag.name.toLowerCase().includes(keyword.toLowerCase()))) {
      return ag.id;
    }
  }
  return null;
}

console.log(`  Found ${orgs?.length || 0} organizations, ${usersList.length} auth users, ${ags?.length || 0} assignment groups.`);

// -----------------------------------------------------------------------------
// STEP 3: SEED CORE PROJECTS & AUTHORITATIVE STARBASE ROADMAP DATA
// -----------------------------------------------------------------------------
console.log("\n[Step 3/4] Seeding authoritative Starbase Louisiana data...");

// 3.1 Seed Core Projects (Projects MUST be inserted first!)
const projectsData = [
  {
    id: "d1000000-0000-0000-0000-000000000001",
    number: "PRJ-PECAN-2026",
    name: "SpaceX Starbase Louisiana Launch Complex & Industrial Campus",
    description: "Pecan Island 125,000-acre coastal space launch complex, orbital launch mounts, methane liquefaction plant, deluge wastewater retention systems, and heavy-haul logistics corridor in Vermilion Parish, Louisiana.",
    project_type: "launch_complex",
    location: {
      parish: "Vermilion Parish",
      region: "Pecan Island Coastal Zone",
      latitude: 29.645,
      longitude: -92.445,
      description: "Pecan Island Coastal Zone, Vermilion Parish, Louisiana",
    },
    status: "active",
    risk: "at_risk",
    start_date: "2026-01-01",
    target_date: "2026-12-28",
    created_by: alexUser?.id,
    customer_organization_id: customerOrgId,
    lead_organization_id: orgMap.get("LA-PROJECTS") || orgMap.get("LED") || orgs?.[0]?.id,
  },
  {
    id: "d1000000-0000-0000-0000-000000000002",
    number: "PRJ-COASTAL-2026",
    name: "Coastal & Marine Infrastructure (Freshwater Bayou Channel & State Water Bottoms)",
    description: "Navigation channel deepening, barge offloading dock, submerged state water bottom rights-of-way, and coastal marsh beneficial use placement.",
    project_type: "coastal_marine",
    location: {
      parish: "Vermilion Parish",
      region: "Freshwater Bayou / Gulf Coast",
      description: "Freshwater Bayou Channel, Vermilion Parish, LA",
    },
    status: "active",
    risk: "normal",
    start_date: "2026-02-01",
    target_date: "2026-11-30",
    created_by: alexUser?.id,
    customer_organization_id: customerOrgId,
    lead_organization_id: orgMap.get("CPRA") || orgMap.get("LA-PROJECTS") || orgs?.[0]?.id,
  },
  {
    id: "d1000000-0000-0000-0000-000000000003",
    number: "PRJ-PIPE-2026",
    name: "Methane Liquefaction, Pipeline & Cryogenic Storage Utility",
    description: "Intrastate 16-inch high-pressure natural gas supply pipeline, air separation plant, and cryogenic liquid methane storage farm.",
    project_type: "pipeline_cryogenic",
    location: {
      parish: "Vermilion Parish",
      region: "LA-82 Utility Corridor",
      description: "Pecan Island Industrial Utility Corridor, Vermilion Parish, LA",
    },
    status: "active",
    risk: "normal",
    start_date: "2026-03-01",
    target_date: "2026-10-31",
    created_by: alexUser?.id,
    customer_organization_id: customerOrgId,
    lead_organization_id: orgMap.get("LA-PROJECTS") || orgs?.[0]?.id,
  },
  {
    id: "d1000000-0000-0000-0000-000000000004",
    number: "PRJ-AIRPORT-2026",
    name: "Pecan Island Airfield & Airspace Safety Corridor",
    description: "Aviation landing strip, FAA Form 7480-1 private-use airport, radar and optical tracking towers, and maritime hazard exclusion zone.",
    project_type: "aviation_airspace",
    location: {
      parish: "Vermilion Parish",
      region: "Pecan Island North",
      description: "Pecan Island Airfield, Vermilion Parish, LA",
    },
    status: "active",
    risk: "normal",
    start_date: "2026-04-01",
    target_date: "2026-12-15",
    created_by: alexUser?.id,
    customer_organization_id: customerOrgId,
    lead_organization_id: orgMap.get("DOTD") || orgMap.get("LA-PROJECTS") || orgs?.[0]?.id,
  },
  {
    id: "d1000000-0000-0000-0000-000000000005",
    number: "PRJ-POWER-2026",
    name: "Dedicated Power Generation & 230kV Substation Interconnection",
    description: "Onsite 50MW gas turbine generating station, 230kV transmission line interconnection, and dual-redundant power distribution ring.",
    project_type: "power_grid",
    location: {
      parish: "Vermilion Parish",
      region: "Substation A",
      description: "Pecan Island Substation Yard, Vermilion Parish, LA",
    },
    status: "active",
    risk: "normal",
    start_date: "2026-03-15",
    target_date: "2026-11-15",
    created_by: alexUser?.id,
    customer_organization_id: customerOrgId,
    lead_organization_id: orgMap.get("LA-PROJECTS") || orgs?.[0]?.id,
  },
  {
    id: "d1000000-0000-0000-0000-000000000006",
    number: "PRJ-WATER-2026",
    name: "Industrial Deluge Wastewater, Retention Basin & Stormwater Systems",
    description: "2.5-million gallon lined sound-suppression deluge retention basin, industrial wastewater characterization treatment facility, and LAR100000 stormwater containment.",
    project_type: "water_environmental",
    location: {
      parish: "Vermilion Parish",
      region: "Launch Pad Perimeter",
      description: "Launch Complex Pad Basin, Vermilion Parish, LA",
    },
    status: "active",
    risk: "at_risk",
    start_date: "2026-02-15",
    target_date: "2026-12-01",
    created_by: alexUser?.id,
    customer_organization_id: customerOrgId,
    lead_organization_id: orgMap.get("LDEQ") || orgMap.get("LA-PROJECTS") || orgs?.[0]?.id,
  },
];

for (const proj of projectsData) {
  const { error: projErr } = await supabase.from("projects").upsert(proj);
  if (projErr) throw new Error(`Project upsert failed for ${proj.number}: ${projErr.message}`);
}
console.log(`  ✅ Seeded ${projectsData.length} core projects.`);

const primaryProjectId = projectsData[0].id; // d1000000-0000-0000-0000-000000000001

// 3.2 Seed Project Participants. The current RLS boundary requires a real
// participant organization row for agency members to hydrate project data.
const participatingAgencyCodes = [
  "SPACEX", "LA-PROJECTS", "DOTD", "LDEQ", "CPRA", "OSFM", "LSP",
  "VERMILION-PARISH", "USACE", "FAA", "LDCE", "SLO", "LPSC", "VPPJ",
  "USFWS", "NOAA", "SHPO",
];
for (const p of projectsData) {
  for (const orgCode of participatingAgencyCodes) {
    const orgId = orgMap.get(orgCode);
    if (orgId) {
      const { error } = await supabase.from("project_participants").insert({
        id: crypto.randomUUID(),
        project_id: p.id,
        organization_id: orgId,
        participation_role: orgCode === "SPACEX" ? "lead" : orgCode === "LA-PROJECTS" ? "coordinating" : "reviewing",
        access_scope: "project",
      }, { onConflict: "project_id,organization_id" });
      if (error && !/duplicate key/i.test(error.message)) {
        throw new Error(`Project participant seed failed for ${p.number}/${orgCode}: ${error.message}`);
      }
    }
  }
}
console.log("  ✅ Seeded project participants for all core projects.");

// 3.3 Seed Comprehensive Permit Types Catalog from Deep Research
const permitTypesCatalog = [
  {
    id: "FAA-PART450",
    code: "FAA-PART450",
    name: "FAA Commercial Space Launch/Reentry Operator License (14 CFR 450)",
    category: "air",
    responsible_org_id: orgMap.get("FAA") || orgMap.get("LA-PROJECTS") || primaryProjectId,
    responsible_org_code: "FAA",
    trigger_explanation: "Mandatory statutory license for commercial launch vehicle operations, flight safety analysis, and NEPA environmental baseline.",
    statutory_citation: "51 U.S.C. ch. 509; 14 CFR Part 450",
    expected_lead_time_days: 180,
    minimum_statutory_days: 180,
    public_notice_required: true,
    public_notice_days: 30,
    verification_status: "verified",
  },
  {
    id: "FAA-PART420",
    code: "FAA-PART420",
    name: "FAA Launch Site Operator License (14 CFR 420)",
    category: "air",
    responsible_org_id: orgMap.get("FAA") || orgMap.get("LA-PROJECTS") || primaryProjectId,
    responsible_org_code: "FAA",
    trigger_explanation: "Launch site licensing, explosive siting safety, and launch complex operational boundaries.",
    statutory_citation: "14 CFR Part 420",
    expected_lead_time_days: 180,
    minimum_statutory_days: 180,
    public_notice_required: true,
    public_notice_days: 30,
    verification_status: "verified",
  },
  {
    id: "USACE-404-10",
    code: "USACE-404-10",
    name: "USACE Clean Water Act §404 / Rivers & Harbors §10 Individual Permit",
    category: "water",
    responsible_org_id: orgMap.get("USACE") || primaryProjectId,
    responsible_org_code: "USACE",
    trigger_explanation: "Dredge and fill in navigable waters and jurisdictional coastal wetlands under New Orleans District (MVN).",
    statutory_citation: "33 U.S.C. § 1344; 33 U.S.C. § 403; 33 CFR 320-332",
    expected_lead_time_days: 240,
    minimum_statutory_days: 60,
    public_notice_required: true,
    public_notice_days: 30,
    verification_status: "verified",
  },
  {
    id: "cat-usace-404",
    code: "CAT-USACE-404",
    name: "USACE Section 404 Wetland Authorization (Legacy)",
    category: "water",
    responsible_org_id: orgMap.get("USACE") || primaryProjectId,
    responsible_org_code: "USACE",
    trigger_explanation: "Dredge and fill in jurisdictional coastal wetlands.",
    statutory_citation: "33 U.S.C. § 1344",
    expected_lead_time_days: 240,
    minimum_statutory_days: 60,
    public_notice_required: true,
    public_notice_days: 30,
    verification_status: "verified",
  },
  {
    id: "USACE-408",
    code: "USACE-408",
    name: "USACE Civil Works Project Modification Permission (§408)",
    category: "water",
    responsible_org_id: orgMap.get("USACE") || primaryProjectId,
    responsible_org_code: "USACE",
    trigger_explanation: "Alteration or occupation of federal civil works levee, flood control, or Freshwater Bayou navigation works.",
    statutory_citation: "33 U.S.C. § 408",
    expected_lead_time_days: 180,
    minimum_statutory_days: 45,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "LDCE-OCM-CUP",
    code: "LDCE-OCM-CUP",
    name: "Louisiana Coastal Use Permit (CUP) & CZMA Federal Consistency",
    category: "permit",
    responsible_org_id: orgMap.get("CPRA") || orgMap.get("LA-PROJECTS") || primaryProjectId,
    responsible_org_code: "LDCE",
    trigger_explanation: "Regulated coastal zone activity, marsh fill, and compensatory wetland mitigation in Vermilion Parish.",
    statutory_citation: "La. R.S. 49:214.21–214.41; LAC 43:I, ch. 7",
    expected_lead_time_days: 120,
    minimum_statutory_days: 45,
    public_notice_required: true,
    public_notice_days: 25,
    verification_status: "verified",
  },
  {
    id: "LDEQ-LPDES-IND",
    code: "LDEQ-LPDES-IND",
    name: "LDEQ Individual LPDES Industrial Deluge Wastewater Discharge Permit",
    category: "water",
    responsible_org_id: orgMap.get("LDEQ") || primaryProjectId,
    responsible_org_code: "LDEQ",
    trigger_explanation: "Point source discharge of launch pad sound suppression and flame deflector deluge washdown wastewater.",
    statutory_citation: "La. R.S. 30:2074; LAC 33:IX",
    expected_lead_time_days: 300,
    minimum_statutory_days: 90,
    public_notice_required: true,
    public_notice_days: 30,
    verification_status: "verified",
  },
  {
    id: "cat-ldeq-lpdes",
    code: "CAT-LDEQ-LPDES",
    name: "LDEQ Individual LPDES Industrial Wastewater Permit (Legacy)",
    category: "water",
    responsible_org_id: orgMap.get("LDEQ") || primaryProjectId,
    responsible_org_code: "LDEQ",
    trigger_explanation: "Discharge of sound suppression deluge and industrial wastewater.",
    statutory_citation: "La. R.S. 30:2074",
    expected_lead_time_days: 300,
    minimum_statutory_days: 90,
    public_notice_required: true,
    public_notice_days: 30,
    verification_status: "verified",
  },
  {
    id: "LDEQ-LAR100000",
    code: "LDEQ-LAR100000",
    name: "LDEQ Large Construction Stormwater General Permit (≥5 Acres)",
    category: "water",
    responsible_org_id: orgMap.get("LDEQ") || primaryProjectId,
    responsible_org_code: "LDEQ",
    trigger_explanation: "Stormwater runoff from large-scale launch complex site clearing, grading, and civil earthwork.",
    statutory_citation: "LAC 33:IX.2501.B.14.j",
    expected_lead_time_days: 45,
    minimum_statutory_days: 14,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "LDEQ-AIR-TITLEV",
    code: "LDEQ-AIR-TITLEV",
    name: "LDEQ Major Source PSD / Title V Air Operating Permit",
    category: "air",
    responsible_org_id: orgMap.get("LDEQ") || primaryProjectId,
    responsible_org_code: "LDEQ",
    trigger_explanation: "Emissions from methane liquefaction flares, power turbines, and orbital rocket testing operations.",
    statutory_citation: "La. R.S. 30:2054; LAC 33:III; 40 CFR Part 70",
    expected_lead_time_days: 270,
    minimum_statutory_days: 60,
    public_notice_required: true,
    public_notice_days: 30,
    verification_status: "verified",
  },
  {
    id: "cat-air-permit",
    code: "CAT-AIR-PERMIT",
    name: "LDEQ Air Quality Operating Permit (Legacy)",
    category: "air",
    responsible_org_id: orgMap.get("LDEQ") || primaryProjectId,
    responsible_org_code: "LDEQ",
    trigger_explanation: "Stationary combustion source emissions.",
    statutory_citation: "LAC 33:III",
    expected_lead_time_days: 180,
    minimum_statutory_days: 30,
    public_notice_required: true,
    public_notice_days: 30,
    verification_status: "verified",
  },
  {
    id: "LDEQ-401-WQC",
    code: "LDEQ-401-WQC",
    name: "Clean Water Act §401 Water Quality Certification",
    category: "water",
    responsible_org_id: orgMap.get("LDEQ") || primaryProjectId,
    responsible_org_code: "LDEQ",
    trigger_explanation: "State certification of compliance with state water quality standards for federal USACE §404/§10 actions.",
    statutory_citation: "33 U.S.C. § 1341; LAC 33:IX.1507",
    expected_lead_time_days: 120,
    minimum_statutory_days: 60,
    public_notice_required: true,
    public_notice_days: 30,
    verification_status: "verified",
  },
  {
    id: "LDCE-PIPE-INTRA",
    code: "LDCE-PIPE-INTRA",
    name: "LDCE Intrastate Natural Gas Pipeline Construction & Safety Permit",
    category: "utility",
    responsible_org_id: orgMap.get("LA-PROJECTS") || primaryProjectId,
    responsible_org_code: "LDCE",
    trigger_explanation: "Construction and pressure-testing of 16-inch high-pressure methane pipeline corridor.",
    statutory_citation: "La. R.S. 30:551 et seq.",
    expected_lead_time_days: 90,
    minimum_statutory_days: 30,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "cat-pipeline",
    code: "CAT-PIPELINE",
    name: "Intrastate Natural Gas Pipeline Permit (Legacy)",
    category: "utility",
    responsible_org_id: orgMap.get("LA-PROJECTS") || primaryProjectId,
    responsible_org_code: "LDCE",
    trigger_explanation: "High-pressure methane pipeline crossing.",
    statutory_citation: "La. R.S. 30:551",
    expected_lead_time_days: 90,
    minimum_statutory_days: 30,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "SLO-WATER-BOTTOM",
    code: "SLO-WATER-BOTTOM",
    name: "Office of State Lands Submerged Water Bottom Lease & ROW",
    category: "permit",
    responsible_org_id: orgMap.get("LA-PROJECTS") || primaryProjectId,
    responsible_org_code: "SLO",
    trigger_explanation: "State-owned water bottom occupancy for marine dock infrastructure and pipeline crossings.",
    statutory_citation: "La. R.S. 41:1701 et seq.",
    expected_lead_time_days: 90,
    minimum_statutory_days: 30,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "OSFM-PLAN-REV",
    code: "OSFM-PLAN-REV",
    name: "State Fire Marshal Industrial High-Hazard Plan Review",
    category: "public_safety",
    responsible_org_id: orgMap.get("OSFM") || primaryProjectId,
    responsible_org_code: "OSFM",
    trigger_explanation: "Commercial building, high-hazard cryogenic storage, and life-safety plan compliance.",
    statutory_citation: "La. R.S. 40:1574; Uniform Construction Code",
    expected_lead_time_days: 45,
    minimum_statutory_days: 15,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "LSP-EXPLOSIVES",
    code: "LSP-EXPLOSIVES",
    name: "Louisiana State Police Explosives License & Magazine Permit",
    category: "public_safety",
    responsible_org_id: orgMap.get("LSP") || primaryProjectId,
    responsible_org_code: "LSP",
    trigger_explanation: "Ordnance, flight termination system pyrotechnics, and explosive storage magazine licensing.",
    statutory_citation: "La. R.S. 40:1472.1–1472.20; LAC 55:I, ch. 15",
    expected_lead_time_days: 60,
    minimum_statutory_days: 30,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "cat-public-safety",
    code: "CAT-PUBLIC-SAFETY",
    name: "Public Safety & Emergency Operations (Legacy)",
    category: "public_safety",
    responsible_org_id: orgMap.get("LSP") || primaryProjectId,
    responsible_org_code: "LSP",
    trigger_explanation: "Emergency exclusion zones and hazardous materials safety.",
    statutory_citation: "La. R.S. 40:1472",
    expected_lead_time_days: 60,
    minimum_statutory_days: 30,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "DOTD-HEAVYHAUL",
    code: "DOTD-HEAVYHAUL",
    name: "DOTD LA-82 Heavy-Haul Route & Oversize/Overweight Transport Permit",
    category: "road",
    responsible_org_id: orgMap.get("DOTD") || primaryProjectId,
    responsible_org_code: "DOTD",
    trigger_explanation: "Oversize rocket stage and heavy equipment transport across LA-82 and parish highway structures.",
    statutory_citation: "La. R.S. 48:221; Title 32 Motor Vehicle Regulations",
    expected_lead_time_days: 60,
    minimum_statutory_days: 20,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "cat-dotd-heavyhaul",
    code: "CAT-DOTD-HEAVYHAUL",
    name: "DOTD Oversize/Overweight Permit (Legacy)",
    category: "road",
    responsible_org_id: orgMap.get("DOTD") || primaryProjectId,
    responsible_org_code: "DOTD",
    trigger_explanation: "Transport of super-heavy modules on LA-82.",
    statutory_citation: "La. R.S. 48:221",
    expected_lead_time_days: 60,
    minimum_statutory_days: 20,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "DOTD-AIRPORT",
    code: "DOTD-AIRPORT",
    name: "DOTD Aviation Airport Landing Field Approval & FAA 7480-1",
    category: "air",
    responsible_org_id: orgMap.get("DOTD") || primaryProjectId,
    responsible_org_code: "DOTD",
    trigger_explanation: "Establishment of private airfield and airspace safety obstruction notice.",
    statutory_citation: "La. R.S. 2:8; 14 CFR Part 157",
    expected_lead_time_days: 90,
    minimum_statutory_days: 45,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "VPPJ-COMM-BLDG",
    code: "VPPJ-COMM-BLDG",
    name: "Vermilion Parish Police Jury Commercial Building & Floodplain Permit",
    category: "permit",
    responsible_org_id: orgMap.get("VERMILION-PARISH") || primaryProjectId,
    responsible_org_code: "VPPJ",
    trigger_explanation: "Parish building permit, coastal elevation certificate, and Base Flood Elevation (BFE) compliance.",
    statutory_citation: "44 CFR § 60.3; Vermilion Parish Floodplain Ordinance",
    expected_lead_time_days: 45,
    minimum_statutory_days: 15,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "GRID-230KV-INTERCONN",
    code: "GRID-230KV-INTERCONN",
    name: "Dedicated 230kV Substation Interconnection & Grid Stability",
    category: "energy",
    responsible_org_id: orgMap.get("LA-PROJECTS") || primaryProjectId,
    responsible_org_code: "LPSC",
    trigger_explanation: "Utility substation interconnection and high-voltage grid stability approval.",
    statutory_citation: "LPSC General Order; NERC Standards",
    expected_lead_time_days: 90,
    minimum_statutory_days: 30,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "cat-utility-230kv",
    code: "CAT-UTILITY-230KV",
    name: "230kV Substation Grid Interconnection (Legacy)",
    category: "energy",
    responsible_org_id: orgMap.get("LA-PROJECTS") || primaryProjectId,
    responsible_org_code: "LPSC",
    trigger_explanation: "High-voltage transmission interconnect.",
    statutory_citation: "LPSC General Order",
    expected_lead_time_days: 90,
    minimum_statutory_days: 30,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "cat-workforce",
    code: "CAT-WORKFORCE",
    name: "Louisiana FastStart Workforce Consortium (Legacy)",
    category: "workforce",
    responsible_org_id: orgMap.get("LED") || orgMap.get("LA-PROJECTS") || primaryProjectId,
    responsible_org_code: "LED",
    trigger_explanation: "Workforce recruitment and safety training.",
    statutory_citation: "La. R.S. 51:936",
    expected_lead_time_days: 30,
    minimum_statutory_days: 10,
    public_notice_required: false,
    verification_status: "verified",
  },
];

// Federal environmental and consultation actions are tracked as first-class
// roadmap workstreams so the UI does not collapse them into a generic permit.
permitTypesCatalog.push(
  {
    id: "FAA-NEPA-EIS",
    code: "FAA-NEPA-EIS",
    name: "FAA NEPA Environmental Impact Statement / Record of Decision",
    category: "environmental",
    responsible_org_id: orgMap.get("FAA"),
    responsible_org_code: "FAA",
    trigger_explanation: "Federal launch licensing requires environmental review of the coastal launch complex and operating envelope.",
    statutory_citation: "42 U.S.C. §4321 et seq.; FAA environmental procedures",
    expected_lead_time_days: 540,
    minimum_statutory_days: 180,
    public_notice_required: true,
    public_notice_days: 30,
    verification_status: "verified",
  },
  {
    id: "USFWS-ESA-7",
    code: "USFWS-ESA-7",
    name: "ESA Section 7 Terrestrial and Freshwater Species Consultation",
    category: "environmental",
    responsible_org_id: orgMap.get("USFWS"),
    responsible_org_code: "USFWS",
    trigger_explanation: "FAA and USACE federal actions require species-effects analysis and consultation before authorization.",
    statutory_citation: "16 U.S.C. §1536; 50 CFR Part 402",
    expected_lead_time_days: 180,
    minimum_statutory_days: 60,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "NOAA-ESA-EFH",
    code: "NOAA-ESA-EFH",
    name: "NOAA Marine Species ESA and Essential Fish Habitat Consultation",
    category: "environmental",
    responsible_org_id: orgMap.get("NOAA"),
    responsible_org_code: "NOAA",
    trigger_explanation: "Marine launch corridors, dredging, and coastal construction may affect protected species and essential fish habitat.",
    statutory_citation: "ESA §7; Magnuson-Stevens Act §305(b)",
    expected_lead_time_days: 180,
    minimum_statutory_days: 60,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "SHPO-NHPA-106",
    code: "SHPO-NHPA-106",
    name: "NHPA Section 106 Cultural and Historic Resources Review",
    category: "environmental",
    responsible_org_id: orgMap.get("SHPO"),
    responsible_org_code: "SHPO",
    trigger_explanation: "Federal undertakings require an Area of Potential Effects and cultural-resource consultation.",
    statutory_citation: "54 U.S.C. §306108; 36 CFR Part 800",
    expected_lead_time_days: 150,
    minimum_statutory_days: 45,
    public_notice_required: false,
    verification_status: "verified",
  },
  {
    id: "FAA-PART440",
    code: "FAA-PART440",
    name: "FAA Maximum Probable Loss and Financial Responsibility Demonstration",
    category: "air",
    responsible_org_id: orgMap.get("FAA"),
    responsible_org_code: "FAA",
    trigger_explanation: "Commercial launch licensing requires financial responsibility and maximum probable loss evidence.",
    statutory_citation: "14 CFR Part 440",
    expected_lead_time_days: 90,
    minimum_statutory_days: 30,
    public_notice_required: false,
    verification_status: "verified",
  },
);


for (const permit of permitTypesCatalog) {
  const { error: pErr } = await supabase.from("permit_types").upsert(permit);
  if (pErr) console.warn(`Permit type upsert (${permit.code}):`, pErr.message);
}
console.log(`  ✅ Seeded ${permitTypesCatalog.length} permit types.`);

// 3.4 Seed Workstreams and Tasks (Including dual ownership, ITSM queues, 6-questions narrative, and CPM tasks)
const comprehensiveWorkstreams = [
  // 1. LA-82 Heavy-Haul Access
  {
    id: "WS-LA82-HEAVYHAUL",
    code: "WS-LA82-HEAVYHAUL",
    projectId: primaryProjectId,
    title: "LA-82 Heavy-Haul Access & Bridge Reinforcement",
    category: "road",
    permitTypeId: "DOTD-HEAVYHAUL",
    currentStageName: "Structural Review & Interagency Concurrence",
    operationalState: "blocked",
    operationalStateLabel: "Blocked (Interagency Dependency)",
    ragStatus: "red",
    ragLabel: "Critical Delay",
    isCriticalPath: true,
    baselineTargetDate: "2026-09-15",
    forecastTargetDate: "2026-09-28",
    scheduleVarianceDays: 13,
    remainingFloatDays: 0,
    waitingReason: "Waiting on CPRA coastal drainage concurrence model (CR-00451)",
    waitingOnEntity: "CPRA Coastal Permits",
    currentActionSummary: "Culvert box hydrodynamic and load rating review",
    stateConcierge: {
      name: "Sarah Johnson",
      title: "State Project Concierge",
      agency: "Louisiana Governor's Project Office",
      email: "sarah.johnson@la.gov",
      phone: "(225) 342-7000",
    },
    regulatoryLead: {
      orgCode: "DOTD",
      orgName: "Louisiana Department of Transportation and Development",
      jurisdictionLevel: "State",
      assignedReviewerName: "Mark Fontenot, PE",
      assignedReviewerEmail: "mark.fontenot@dotd.la.gov",
    },
    sixQuestions: {
      whereAreWeNow: "DOTD Bridge Bureau is evaluating axle load stresses on Freshwater Bayou span.",
      whoHasNextAction: "CPRA Coastal Permits must sign off on tidal surge hydrodynamic drainage.",
      whatIsAction: "Issue drainage concurrence certification CR-00451.",
      whatIsTargetDate: "2026-09-05",
      isItAtRisk: true,
      whatIsPathToGreen: "Execute joint hydraulic engineering review with DOTD District 03.",
    },
    assignmentGroupId: findAgId("DOTD", "Bridge") || findAgId("DOTD"),
    assignedToUserId: samUser?.id,
    assignedOrgCode: "DOTD",
    itsmState: "blocked",
    priority: "P1",
    statutoryDeadline: "2026-09-15T00:00:00Z",
    clockStatus: "paused",
    clockPausedReason: "Waiting on CPRA coastal drainage concurrence model (CR-00451)",
    tasks: [
      {
        id: "task-dotd-1",
        title: "LA-82 Route Geometric & Turn Radius Analysis",
        durationDays: 15,
        floatDays: 0,
        earlyStart: "2026-06-01",
        earlyFinish: "2026-06-16",
        isCriticalPath: true,
        status: "completed",
        predecessors: [],
      },
      {
        id: "task-dotd-2",
        title: "Freshwater Bayou Bridge Superstructure Stress Analysis",
        durationDays: 30,
        floatDays: 0,
        earlyStart: "2026-06-17",
        earlyFinish: "2026-07-17",
        isCriticalPath: true,
        status: "completed",
        predecessors: ["task-dotd-1"],
      },
      {
        id: "task-dotd-3",
        title: "CPRA Coastal Surge Box Culvert Hydrodynamic Concurrence",
        durationDays: 20,
        floatDays: 0,
        earlyStart: "2026-07-18",
        earlyFinish: "2026-08-07",
        isCriticalPath: true,
        status: "in_progress",
        predecessors: ["task-dotd-2"],
      },
    ],
  },
  // 2. Launch Pad A Wetlands & Coastal
  {
    id: "WS-WETLANDS-PAD-A",
    code: "WS-WETLANDS-PAD-A",
    projectId: primaryProjectId,
    title: "Launch Pad A - Wetland & Coastal Authorization",
    category: "water",
    permitTypeId: "USACE-404-10",
    currentStageName: "Joint Public Notice & Mitigation Review",
    operationalState: "running",
    operationalStateLabel: "Running (Public Notice)",
    ragStatus: "green",
    ragLabel: "On Track",
    isCriticalPath: true,
    baselineTargetDate: "2026-10-15",
    forecastTargetDate: "2026-10-15",
    scheduleVarianceDays: 0,
    remainingFloatDays: 4,
    currentActionSummary: "Public notice period active with USACE New Orleans District and LDCE OCM",
    stateConcierge: {
      name: "Sarah Johnson",
      title: "State Project Concierge",
      agency: "Louisiana Governor's Project Office",
      email: "sarah.johnson@la.gov",
      phone: "(225) 342-7000",
    },
    regulatoryLead: {
      orgCode: "USACE",
      orgName: "U.S. Army Corps of Engineers — New Orleans District",
      jurisdictionLevel: "Federal",
      assignedReviewerName: "Col. Jason Kelly / Sarah White",
      assignedReviewerEmail: "sarah.white@usace.army.mil",
    },
    sixQuestions: {
      whereAreWeNow: "Joint Public Notice published for 30-day interagency comment period.",
      whoHasNextAction: "USACE Project Manager Sarah White.",
      whatIsAction: "Consolidate public and resource agency comments for applicant response batch.",
      whatIsTargetDate: "2026-09-20",
      isItAtRisk: false,
      whatIsPathToGreen: "Maintain bi-weekly interagency coordination calls.",
    },
    assignmentGroupId: findAgId("USACE") || findAgId("CPRA"),
    assignedToUserId: sarahUser?.id,
    assignedOrgCode: "USACE",
    itsmState: "in_progress",
    priority: "P2",
    statutoryDeadline: "2026-10-15T00:00:00Z",
    clockStatus: "active",
    tasks: [
      {
        id: "task-wetland-1",
        title: "Wetland Delineation Field Verification & GPS Survey",
        durationDays: 25,
        floatDays: 4,
        earlyStart: "2026-05-01",
        earlyFinish: "2026-05-26",
        isCriticalPath: true,
        status: "completed",
        predecessors: [],
      },
      {
        id: "task-wetland-2",
        title: "Compensatory Wetland Mitigation Plan Submission",
        durationDays: 20,
        floatDays: 4,
        earlyStart: "2026-05-27",
        earlyFinish: "2026-06-16",
        isCriticalPath: true,
        status: "completed",
        predecessors: ["task-wetland-1"],
      },
      {
        id: "task-wetland-3",
        title: "USACE / LDCE Joint Public Notice 30-Day Evaluation",
        durationDays: 30,
        floatDays: 4,
        earlyStart: "2026-08-01",
        earlyFinish: "2026-08-31",
        isCriticalPath: true,
        status: "in_progress",
        predecessors: ["task-wetland-2"],
      },
    ],
  },
  // 3. 230kV Substation Interconnection
  {
    id: "WS-SUBSTATION-230KV",
    code: "WS-SUBSTATION-230KV",
    projectId: primaryProjectId,
    title: "230kV Grid Interconnection & Substation Expansion",

    category: "energy",
    permitTypeId: "GRID-230KV-INTERCONN",
    currentStageName: "Relay Coordination & Interconnection Agreement",
    operationalState: "running",
    operationalStateLabel: "Running (Technical Review)",
    ragStatus: "green",
    ragLabel: "On Track",
    isCriticalPath: false,
    baselineTargetDate: "2026-11-01",
    forecastTargetDate: "2026-11-01",
    scheduleVarianceDays: 0,
    remainingFloatDays: 18,
    currentActionSummary: "Utility single-line diagram and relay protection review",
    stateConcierge: {
      name: "Sarah Johnson",
      title: "State Project Concierge",
      agency: "Louisiana Governor's Project Office",
      email: "sarah.johnson@la.gov",
    },
    regulatoryLead: {
      orgCode: "LA-PROJECTS",
      orgName: "Governor's Major Projects Office",
      jurisdictionLevel: "State",
      assignedReviewerName: "David Leblanc, PE",
      assignedReviewerEmail: "david.leblanc@la.gov",
    },
    sixQuestions: {
      whereAreWeNow: "Substation single-line schematic under utility engineering review.",
      whoHasNextAction: "Entergy Louisiana Grid Engineering.",
      whatIsAction: "Execute final System Impact Study signoff.",
      whatIsTargetDate: "2026-09-30",
      isItAtRisk: false,
      whatIsPathToGreen: "Continue weekly technical relay working group.",
    },
    assignmentGroupId: findAgId("LA-PROJECTS", "Interagency"),
    assignedToUserId: samUser?.id,
    assignedOrgCode: "LA-PROJECTS",
    itsmState: "in_progress",
    priority: "P3",
    tasks: [
      {
        id: "task-grid-1",
        title: "230kV Substation Interconnection Single-Line Review",
        durationDays: 45,
        floatDays: 18,
        earlyStart: "2026-06-01",
        earlyFinish: "2026-07-16",
        isCriticalPath: false,
        status: "in_progress",
        predecessors: [],
      },
    ],
  },
  // 4. Industrial Wastewater & Deluge Basin
  {
    id: "WS-WASTEWATER-DELUGE",
    code: "WS-WASTEWATER-DELUGE",
    projectId: primaryProjectId,
    title: "Industrial Wastewater & Launch Deluge Retention Basin",

    category: "water",
    permitTypeId: "LDEQ-LPDES-IND",
    currentStageName: "Thermal & Chemical Dissipation Characterization",
    operationalState: "waiting_applicant",
    operationalStateLabel: "Waiting on Applicant (RFI Response)",
    ragStatus: "yellow",
    ragLabel: "Action Required",
    isCriticalPath: true,
    baselineTargetDate: "2026-10-30",
    forecastTargetDate: "2026-11-05",
    scheduleVarianceDays: 6,
    remainingFloatDays: 2,
    waitingReason: "Waiting on SpaceX characterization sampling study of flame-deflector quench water",
    waitingOnEntity: "SpaceX Environmental",
    currentActionSummary: "LDEQ evaluating deluge wastewater containment liner and outfall monitoring",
    stateConcierge: {
      name: "Sarah Johnson",
      title: "State Project Concierge",
      agency: "Louisiana Governor's Project Office",
      email: "sarah.johnson@la.gov",
    },
    regulatoryLead: {
      orgCode: "LDEQ",
      orgName: "Louisiana Department of Environmental Quality",
      jurisdictionLevel: "State",
      assignedReviewerName: "Dr. Rachel Benoit",
      assignedReviewerEmail: "rachel.benoit@la.gov",
    },
    sixQuestions: {
      whereAreWeNow: "LDEQ Water Quality is reviewing retention basin sizing per Texas Starbase precedents.",
      whoHasNextAction: "SpaceX Environmental Engineering.",
      whatIsAction: "Submit chemical characterization assay for deluge deflector quench effluent.",
      whatIsTargetDate: "2026-09-10",
      isItAtRisk: true,
      whatIsPathToGreen: "Provide certified laboratory test assay from active test stand runs.",
    },
    assignmentGroupId: findAgId("LDEQ", "Water") || findAgId("LDEQ"),
    assignedToUserId: sarahUser?.id,
    assignedOrgCode: "LDEQ",
    itsmState: "pending_customer",
    priority: "P1",
    statutoryDeadline: "2026-10-30T00:00:00Z",
    clockStatus: "paused",
    tasks: [
      {
        id: "task-deluge-1",
        title: "Deluge Retention Basin Sizing & Geosynthetic Liner Review",
        durationDays: 30,
        floatDays: 2,
        earlyStart: "2026-06-15",
        earlyFinish: "2026-07-15",
        isCriticalPath: true,
        status: "completed",
        predecessors: [],
      },
      {
        id: "task-deluge-2",
        title: "LDEQ Individual LPDES Deluge Water Characterization Review",
        durationDays: 45,
        floatDays: 2,
        earlyStart: "2026-07-16",
        earlyFinish: "2026-08-30",
        isCriticalPath: true,
        status: "in_progress",
        predecessors: ["task-deluge-1"],
      },
    ],
  },
  // 5. FAA AST Part 450 Vehicle License
  {
    id: "WS-FAA-AST-450",
    code: "WS-FAA-AST-450",
    projectId: primaryProjectId,
    title: "FAA AST Part 450 Commercial Launch Operator License",
    category: "air",
    permitTypeId: "FAA-PART450",
    currentStageName: "Flight Safety Analysis & NEPA EIS Scoping",
    operationalState: "running",
    operationalStateLabel: "Running (Statutory Clock)",
    ragStatus: "green",
    ragLabel: "On Track",
    isCriticalPath: true,
    baselineTargetDate: "2026-12-15",
    forecastTargetDate: "2026-12-15",
    scheduleVarianceDays: 0,
    remainingFloatDays: 0,
    currentActionSummary: "FAA AST 180-day formal evaluation clock active",
    stateConcierge: {
      name: "Sarah Johnson",
      title: "State Project Concierge",
      agency: "Louisiana Governor's Project Office",
      email: "sarah.johnson@la.gov",
    },
    regulatoryLead: {
      orgCode: "FAA",
      orgName: "FAA Commercial Space Transportation (AST)",
      jurisdictionLevel: "Federal",
      assignedReviewerName: "Kelvin Coleman / Wayne Monteith",
      assignedReviewerEmail: "ast.permits@faa.gov",
    },
    sixQuestions: {
      whereAreWeNow: "Formal 180-day Part 450 statutory review progressing through flight safety gates.",
      whoHasNextAction: "FAA AST Licensing Lead.",
      whatIsAction: "Issue Maximum Probable Loss (MPL) financial determination.",
      whatIsTargetDate: "2026-10-01",
      isItAtRisk: false,
      whatIsPathToGreen: "Maintain weekly AST technical interchange meetings.",
    },
    assignmentGroupId: findAgId("LA-PROJECTS", "Interagency"),
    assignedToUserId: alexUser?.id,
    assignedOrgCode: "FAA",
    itsmState: "in_progress",
    priority: "P1",
    statutoryDeadline: "2026-12-15T00:00:00Z",
    clockStatus: "active",
    tasks: [
      {
        id: "task-faa-1",
        title: "Part 450 Hazard Control Strategy & Debris Footprint Review",
        durationDays: 60,
        floatDays: 0,
        earlyStart: "2026-06-01",
        earlyFinish: "2026-07-31",
        isCriticalPath: true,
        status: "in_progress",
        predecessors: [],
      },
    ],
  },
  // 6. Methane Pipeline Utility
  {
    id: "WS-GAS-LNG-PIPELINE",
    code: "WS-GAS-LNG-PIPELINE",
    projectId: primaryProjectId,
    title: "Liquid Methane & Gas Utility Interconnection",

    category: "utility",
    permitTypeId: "LDCE-PIPE-INTRA",
    currentStageName: "Pipeline Alignment & Safety Review",
    operationalState: "running",
    operationalStateLabel: "Running (Technical Review)",
    ragStatus: "green",
    ragLabel: "On Track",
    isCriticalPath: false,
    baselineTargetDate: "2026-10-15",
    forecastTargetDate: "2026-10-15",
    scheduleVarianceDays: 0,
    remainingFloatDays: 22,
    currentActionSummary: "LDCE Pipeline Division reviewing cathodic protection and block valve spacing",
    stateConcierge: {
      name: "Sarah Johnson",
      title: "State Project Concierge",
      agency: "Louisiana Governor's Project Office",
      email: "sarah.johnson@la.gov",
    },
    regulatoryLead: {
      orgCode: "LDCE",
      orgName: "Louisiana Department of Conservation & Energy",
      jurisdictionLevel: "State",
      assignedReviewerName: "Steven Giambrone",
      assignedReviewerEmail: "pipeline.safety@la.gov",
    },
    sixQuestions: {
      whereAreWeNow: "Pipeline route alignment drawings under review for parish road crossings.",
      whoHasNextAction: "LDCE Pipeline Safety Program.",
      whatIsAction: "Issue intrastate pipeline construction authorization.",
      whatIsTargetDate: "2026-09-25",
      isItAtRisk: false,
      whatIsPathToGreen: "Execute Vermilion Parish Police Jury crossing agreements.",
    },
    assignmentGroupId: findAgId("LA-PROJECTS", "Interagency"),
    assignedToUserId: samUser?.id,
    assignedOrgCode: "LDCE",
    itsmState: "in_progress",
    priority: "P2",
    tasks: [
      {
        id: "task-pipe-1",
        title: "Intrastate Methane Line Alignment & Cathodic Protection Review",
        durationDays: 40,
        floatDays: 22,
        earlyStart: "2026-06-01",
        earlyFinish: "2026-07-11",
        isCriticalPath: false,
        status: "in_progress",
        predecessors: [],
      },
    ],
  },
  // 7. LDEQ Title V Air Quality
  {
    id: "WS-AIR-TITLE-V",
    code: "WS-AIR-TITLE-V",
    projectId: primaryProjectId,
    title: "Major Source PSD / Title V Air Permitting",
    category: "air",
    permitTypeId: "LDEQ-AIR-TITLEV",
    currentStageName: "Air Dispersion Modeling & PSD Analysis",
    operationalState: "running",
    operationalStateLabel: "Running (Technical Review)",
    ragStatus: "green",
    ragLabel: "On Track",
    isCriticalPath: false,
    baselineTargetDate: "2026-11-20",
    forecastTargetDate: "2026-11-20",
    scheduleVarianceDays: 0,
    remainingFloatDays: 14,
    currentActionSummary: "LDEQ Air Quality reviewing rocket engine static test emissions and flares",
    stateConcierge: {
      name: "Sarah Johnson",
      title: "State Project Concierge",
      agency: "Louisiana Governor's Project Office",
      email: "sarah.johnson@la.gov",
    },
    regulatoryLead: {
      orgCode: "LDEQ",
      orgName: "Louisiana Department of Environmental Quality",
      jurisdictionLevel: "State",
      assignedReviewerName: "Bryan Johnston",
      assignedReviewerEmail: "bryan.johnston@la.gov",
    },
    sixQuestions: {
      whereAreWeNow: "AERMOD dispersion modeling data submitted for review.",
      whoHasNextAction: "LDEQ Air Quality Division.",
      whatIsAction: "Draft Title V permit conditions for public notice.",
      whatIsTargetDate: "2026-10-10",
      isItAtRisk: false,
      whatIsPathToGreen: "Provide flare stack efficiency calculations.",
    },
    assignmentGroupId: findAgId("LDEQ", "Air") || findAgId("LDEQ"),
    assignedToUserId: sarahUser?.id,
    assignedOrgCode: "LDEQ",
    itsmState: "in_progress",
    priority: "P2",
    tasks: [
      {
        id: "task-air-1",
        title: "AERMOD Air Quality Dispersion Modeling Verification",
        durationDays: 45,
        floatDays: 14,
        earlyStart: "2026-06-01",
        earlyFinish: "2026-07-16",
        isCriticalPath: false,
        status: "in_progress",
        predecessors: [],
      },
    ],
  },
  // 8. Public Safety & Airspace Corridor
  {
    id: "WS-PUBLIC-SAFETY-AIRSPACE",
    code: "WS-PUBLIC-SAFETY-AIRSPACE",
    projectId: primaryProjectId,
    title: "Gulf Airspace & Maritime Safety Corridor",

    category: "public_safety",
    permitTypeId: "DOTD-AIRPORT",
    currentStageName: "Interagency Exclusion Zone Protocol",
    operationalState: "running",
    operationalStateLabel: "Running (Multi-Agency Review)",
    ragStatus: "green",
    ragLabel: "On Track",
    isCriticalPath: false,
    baselineTargetDate: "2026-11-30",
    forecastTargetDate: "2026-11-30",
    scheduleVarianceDays: 0,
    remainingFloatDays: 25,
    currentActionSummary: "USCG District 8 and FAA Houston ARTCC establishing launch warning zones",
    stateConcierge: {
      name: "Sarah Johnson",
      title: "State Project Concierge",
      agency: "Louisiana Governor's Project Office",
      email: "sarah.johnson@la.gov",
    },
    regulatoryLead: {
      orgCode: "LSP",
      orgName: "Louisiana State Police / USCG",
      jurisdictionLevel: "State",
      assignedReviewerName: "Capt. Tyler Broussard",
      assignedReviewerEmail: "tyler.broussard@la.gov",
    },
    sixQuestions: {
      whereAreWeNow: "NOTAM / NOTMAR maritime exclusion zone coordination underway.",
      whoHasNextAction: "USCG District 8 Waterways Management.",
      whatIsAction: "Publish Local Notice to Mariners launch safety corridor.",
      whatIsTargetDate: "2026-10-15",
      isItAtRisk: false,
      whatIsPathToGreen: "Execute final tabletop security drill.",
    },
    assignmentGroupId: findAgId("LSP") || findAgId("SAFETY"),
    assignedToUserId: samUser?.id,
    assignedOrgCode: "LSP",
    itsmState: "in_progress",
    priority: "P2",
    tasks: [
      {
        id: "task-airspace-1",
        title: "Maritime & Airspace Exclusion Zone Safety Analysis",
        durationDays: 50,
        floatDays: 25,
        earlyStart: "2026-06-01",
        earlyFinish: "2026-07-21",
        isCriticalPath: false,
        status: "in_progress",
        predecessors: [],
      },
    ],
  },
  // 9. OSFM Highbay & Life Safety
  {
    id: "WS-HIGHBAY-OSFM",
    code: "WS-HIGHBAY-OSFM",
    projectId: primaryProjectId,
    title: "Orbital Integration Highbay & OSFM Life Safety Review",
    category: "public_safety",
    permitTypeId: "OSFM-PLAN-REV",
    currentStageName: "High-Hazard Occupancy Review",
    operationalState: "running",
    operationalStateLabel: "Running (Plan Review)",
    ragStatus: "green",
    ragLabel: "On Track",
    isCriticalPath: false,
    baselineTargetDate: "2026-10-01",
    forecastTargetDate: "2026-10-01",
    scheduleVarianceDays: 0,
    remainingFloatDays: 30,
    currentActionSummary: "State Fire Marshal reviewing deluge sprinkler and cryogenic methane sensors",
    stateConcierge: {
      name: "Sarah Johnson",
      title: "State Project Concierge",
      agency: "Louisiana Governor's Project Office",
      email: "sarah.johnson@la.gov",
    },
    regulatoryLead: {
      orgCode: "OSFM",
      orgName: "Louisiana Office of State Fire Marshal",
      jurisdictionLevel: "State",
      assignedReviewerName: "Chief Dan Wallis / Joe Skaggs",
      assignedReviewerEmail: "joe.skaggs@la.gov",
    },
    sixQuestions: {
      whereAreWeNow: "Industrial highbay structural and egress drawings under review.",
      whoHasNextAction: "OSFM Plan Review Section.",
      whatIsAction: "Issue commercial building plan approval certificate.",
      whatIsTargetDate: "2026-09-15",
      isItAtRisk: false,
      whatIsPathToGreen: "Provide high-expansion foam fire suppression single-lines.",
    },
    assignmentGroupId: findAgId("OSFM") || findAgId("SAFETY"),
    assignedToUserId: samUser?.id,
    assignedOrgCode: "OSFM",
    itsmState: "in_progress",
    priority: "P3",
    tasks: [
      {
        id: "task-osfm-1",
        title: "Highbay Cryogenic Fire Protection & Egress Review",
        durationDays: 30,
        floatDays: 30,
        earlyStart: "2026-06-01",
        earlyFinish: "2026-07-01",
        isCriticalPath: false,
        status: "in_progress",
        predecessors: [],
      },
    ],
  },
  // 10. Vermilion Parish Commercial Building & Floodplain
  {
    id: "WS-VPPJ-COMM-BLDG",
    code: "WS-VPPJ-COMM-BLDG",
    projectId: primaryProjectId,
    title: "Vermilion Parish Commercial Building & Coastal High-Hazard Floodplain Permit",
    category: "permit",
    permitTypeId: "VPPJ-COMM-BLDG",
    currentStageName: "Base Flood Elevation (BFE) Verification",
    operationalState: "running",
    operationalStateLabel: "Running (Parish Review)",
    ragStatus: "green",
    ragLabel: "On Track",
    isCriticalPath: false,
    baselineTargetDate: "2026-09-30",
    forecastTargetDate: "2026-09-30",
    scheduleVarianceDays: 0,
    remainingFloatDays: 15,
    currentActionSummary: "Vermilion Parish reviewing elevation certificates and foundation pilings",
    stateConcierge: {
      name: "Sarah Johnson",
      title: "State Project Concierge",
      agency: "Louisiana Governor's Project Office",
      email: "sarah.johnson@la.gov",
    },
    regulatoryLead: {
      orgCode: "VERMILION-PARISH",
      orgName: "Vermilion Parish Police Jury",
      jurisdictionLevel: "Local / Parish",
      assignedReviewerName: "Paul Moresi / Parish Engineer",
      assignedReviewerEmail: "permits@vermilionparish.gov",
    },
    sixQuestions: {
      whereAreWeNow: "Parish floodplain manager reviewing FEMA Elevation Certificate.",
      whoHasNextAction: "Vermilion Parish Permit Department.",
      whatIsAction: "Issue commercial building & foundation development permit.",
      whatIsTargetDate: "2026-09-20",
      isItAtRisk: false,
      whatIsPathToGreen: "Provide stamped elevation certificate from licensed LA surveyor.",
    },
    assignmentGroupId: findAgId("VERMILION-PARISH") || findAgId("VERMILION"),
    assignedToUserId: samUser?.id,
    assignedOrgCode: "VERMILION-PARISH",
    itsmState: "in_progress",
    priority: "P3",
    tasks: [
      {
        id: "task-vppj-1",
        title: "Vermilion Parish Coastal Floodplain Elevation Review",
        durationDays: 20,
        floatDays: 15,
        earlyStart: "2026-06-01",
        earlyFinish: "2026-06-21",
        isCriticalPath: false,
        status: "in_progress",
        predecessors: [],
      },
    ],
  },
  // 11. State Lands Water Bottom Lease
  {
    id: "WS-SLO-WATER-BOTTOM",
    code: "WS-SLO-WATER-BOTTOM",
    projectId: primaryProjectId,
    title: "Office of State Lands Water Bottom Lease & Right-of-Way",

    category: "permit",
    permitTypeId: "SLO-WATER-BOTTOM",
    currentStageName: "Submerged Land Boundary Delineation",
    operationalState: "running",
    operationalStateLabel: "Running (State Lands)",
    ragStatus: "green",
    ragLabel: "On Track",
    isCriticalPath: false,
    baselineTargetDate: "2026-10-31",
    forecastTargetDate: "2026-10-31",
    scheduleVarianceDays: 0,
    remainingFloatDays: 20,
    currentActionSummary: "State Lands Office delineating water bottoms for Freshwater Bayou offloading dock",
    stateConcierge: {
      name: "Sarah Johnson",
      title: "State Project Concierge",
      agency: "Louisiana Governor's Project Office",
      email: "sarah.johnson@la.gov",
    },
    regulatoryLead: {
      orgCode: "LA-PROJECTS",
      orgName: "Louisiana Office of State Lands",
      jurisdictionLevel: "State",
      assignedReviewerName: "Cheston Jones",
      assignedReviewerEmail: "cheston.jones@la.gov",
    },
    sixQuestions: {
      whereAreWeNow: "Submerged land appraisal and boundary survey completed.",
      whoHasNextAction: "Office of State Lands Administrator.",
      whatIsAction: "Execute 10-year commercial water bottom lease.",
      whatIsTargetDate: "2026-10-01",
      isItAtRisk: false,
      whatIsPathToGreen: "Submit final surveyed metes-and-bounds plat.",
    },
    assignmentGroupId: findAgId("LA-PROJECTS", "Interagency"),
    assignedToUserId: samUser?.id,
    assignedOrgCode: "LA-PROJECTS",
    itsmState: "in_progress",
    priority: "P3",
    tasks: [
      {
        id: "task-slo-1",
        title: "Submerged Water Bottom Property Survey & Lease Execution",
        durationDays: 30,
        floatDays: 20,
        earlyStart: "2026-06-01",
        earlyFinish: "2026-07-01",
        isCriticalPath: false,
        status: "in_progress",
        predecessors: [],
      },
    ],
  },
  // 12. LSP Explosives License
  {
    id: "WS-LSP-EXPLOSIVES",
    code: "WS-LSP-EXPLOSIVES",
    projectId: primaryProjectId,
    title: "Louisiana State Police Explosives License & Magazine Permit",
    category: "public_safety",
    permitTypeId: "LSP-EXPLOSIVES",
    currentStageName: "Magazine Siting & Background Verification",
    operationalState: "running",
    operationalStateLabel: "Running (State Police)",
    ragStatus: "green",
    ragLabel: "On Track",
    isCriticalPath: false,
    baselineTargetDate: "2026-11-15",
    forecastTargetDate: "2026-11-15",
    scheduleVarianceDays: 0,
    remainingFloatDays: 28,
    currentActionSummary: "LSP Emergency Services Unit conducting site security inspection of ordnance bunker",
    stateConcierge: {
      name: "Sarah Johnson",
      title: "State Project Concierge",
      agency: "Louisiana Governor's Project Office",
      email: "sarah.johnson@la.gov",
    },
    regulatoryLead: {
      orgCode: "LSP",
      orgName: "Louisiana State Police",
      jurisdictionLevel: "State",
      assignedReviewerName: "Lt. Michael Romero",
      assignedReviewerEmail: "michael.romero@la.gov",
    },
    sixQuestions: {
      whereAreWeNow: "Explosive magazine distance table calculations submitted.",
      whoHasNextAction: "LSP Emergency Services Unit.",
      whatIsAction: "Issue state explosives storage magazine license.",
      whatIsTargetDate: "2026-10-20",
      isItAtRisk: false,
      whatIsPathToGreen: "Complete on-site perimeter blast wall inspection.",
    },
    assignmentGroupId: findAgId("LSP"),
    assignedToUserId: samUser?.id,
    assignedOrgCode: "LSP",
    itsmState: "in_progress",
    priority: "P3",
    tasks: [
      {
        id: "task-lsp-1",
        title: "Explosives Storage Magazine Siting & Security Review",
        durationDays: 25,
        floatDays: 28,
        earlyStart: "2026-06-01",
        earlyFinish: "2026-06-26",
        isCriticalPath: false,
        status: "in_progress",
        predecessors: [],
      },
    ],
  },
];

function roadmapWorkstream({ id, projectId, title, category, permitTypeId, assignedOrgCode, currentStageName, startDate, finishDate, durationDays = 30, isCriticalPath = false, taskTitle }) {
  const assignmentGroupId = findAgId(assignedOrgCode) || findAgId("LA-PROJECTS", "Interagency") || findAgId("LA-PROJECTS");
  return {
    id,
    code: id,
    projectId,
    title,
    category,
    permitTypeId,
    currentStageName,
    operationalState: "running",
    operationalStateLabel: "Running (Roadmap Baseline)",
    ragStatus: "green",
    ragLabel: "On Track",
    isCriticalPath,
    baselineTargetDate: finishDate,
    forecastTargetDate: finishDate,
    scheduleVarianceDays: 0,
    remainingFloatDays: isCriticalPath ? 0 : 20,
    currentActionSummary: `${assignedOrgCode} roadmap intake and jurisdiction confirmation are in progress.`,
    stateConcierge: {
      name: "Sarah Johnson",
      title: "State Project Concierge",
      agency: "Louisiana Governor's Project Office",
      email: "sarah.johnson@la.gov",
    },
    regulatoryLead: {
      orgCode: assignedOrgCode,
      orgName: `${assignedOrgCode} Regulatory Review`,
      jurisdictionLevel: assignedOrgCode === "FAA" || assignedOrgCode === "USFWS" || assignedOrgCode === "NOAA" ? "Federal" : "State",
      assignedReviewerName: "Roadmap Intake Team",
      assignedReviewerEmail: "permits@spacex.example",
    },
    sixQuestions: {
      whereAreWeNow: "Roadmap workstream created from the authoritative Starbase Louisiana regulatory inventory.",
      whoHasNextAction: `${assignedOrgCode} and SpaceX permitting teams.`,
      whatIsAction: "Confirm applicability, submit the required application package, and track agency response.",
      whatIsTargetDate: finishDate,
      isItAtRisk: false,
      whatIsPathToGreen: "Complete the design-basis package and hold the interagency pre-application review.",
    },
    assignmentGroupId,
    assignedToUserId: alexUser?.id,
    assignedOrgCode,
    itsmState: "submitted",
    priority: isCriticalPath ? "P1" : "P3",
    clockStatus: "active",
    tasks: [{
      id: `${id.toLowerCase()}-task-1`,
      title: taskTitle || `Complete ${title} applicability and submission package`,
      durationDays,
      floatDays: isCriticalPath ? 0 : 20,
      earlyStart: startDate,
      earlyFinish: finishDate,
      isCriticalPath,
      status: "pending",
      predecessors: [],
    }],
  };
}

const supplementalWorkstreams = [
  roadmapWorkstream({ id: "WS-COASTAL-CZMA-CUP", projectId: projectsData[1].id, title: "Louisiana Coastal Use Permit & CZMA Federal Consistency", category: "environmental", permitTypeId: "LDCE-OCM-CUP", assignedOrgCode: "LDCE", currentStageName: "Coastal Pre-Application Coordination", startDate: "2026-03-01", finishDate: "2026-10-15", durationDays: 90, isCriticalPath: true }),
  roadmapWorkstream({ id: "WS-COASTAL-USACE-408", projectId: projectsData[1].id, title: "USACE Section 408 Civil Works Compatibility Review", category: "water", permitTypeId: "USACE-408", assignedOrgCode: "USACE", currentStageName: "Civil Works Impact Screening", startDate: "2026-03-15", finishDate: "2026-11-15", durationDays: 120, isCriticalPath: true }),
  roadmapWorkstream({ id: "WS-COASTAL-401-WQC", projectId: projectsData[1].id, title: "Section 401 Water Quality Certification", category: "water", permitTypeId: "LDEQ-401-WQC", assignedOrgCode: "LDEQ", currentStageName: "Certification Package Review", startDate: "2026-04-01", finishDate: "2026-10-30", durationDays: 60, isCriticalPath: true }),
  roadmapWorkstream({ id: "WS-COASTAL-WATERBOTTOM", projectId: projectsData[1].id, title: "State Water Bottom Lease and Right-of-Way", category: "permit", permitTypeId: "SLO-WATER-BOTTOM", assignedOrgCode: "SLO", currentStageName: "Submerged Land Boundary Review", startDate: "2026-04-15", finishDate: "2026-10-31", durationDays: 60 }),
  roadmapWorkstream({ id: "WS-PIPE-INTRASTATE", projectId: projectsData[2].id, title: "Intrastate Natural Gas Pipeline Construction Authorization", category: "utility", permitTypeId: "LDCE-PIPE-INTRA", assignedOrgCode: "LDCE", currentStageName: "Pipeline Route and Safety Review", startDate: "2026-04-01", finishDate: "2026-09-30", durationDays: 45 }),
  roadmapWorkstream({ id: "WS-PIPE-CRYOGENIC-SAFETY", projectId: projectsData[2].id, title: "Cryogenic Methane Facility High-Hazard Plan Review", category: "public_safety", permitTypeId: "OSFM-PLAN-REV", assignedOrgCode: "OSFM", currentStageName: "Cryogenic Safety Plan Review", startDate: "2026-04-15", finishDate: "2026-10-15", durationDays: 45 }),
  roadmapWorkstream({ id: "WS-PIPE-AIR-QUALITY", projectId: projectsData[2].id, title: "Liquefaction and Combustion Source Air Permit", category: "air", permitTypeId: "LDEQ-AIR-TITLEV", assignedOrgCode: "LDEQ", currentStageName: "Emissions Inventory and Applicability", startDate: "2026-05-01", finishDate: "2026-11-30", durationDays: 90, isCriticalPath: true }),
  roadmapWorkstream({ id: "WS-AIRPORT-PART420", projectId: projectsData[3].id, title: "FAA Part 420 Launch Site Operator License Determination", category: "air", permitTypeId: "FAA-PART420", assignedOrgCode: "FAA", currentStageName: "Launch Site License Applicability", startDate: "2026-04-01", finishDate: "2026-12-01", durationDays: 90, isCriticalPath: true }),
  roadmapWorkstream({ id: "WS-AIRPORT-DOTD-7480", projectId: projectsData[3].id, title: "Airport Landing Area Notice and DOTD Aviation Approval", category: "air", permitTypeId: "DOTD-AIRPORT", assignedOrgCode: "DOTD", currentStageName: "Runway and Obstruction Notice", startDate: "2026-05-01", finishDate: "2026-09-30", durationDays: 45 }),
  roadmapWorkstream({ id: "WS-POWER-GRID-230KV", projectId: projectsData[4].id, title: "230kV Grid Interconnection and System Impact Study", category: "energy", permitTypeId: "GRID-230KV-INTERCONN", assignedOrgCode: "LPSC", currentStageName: "Utility Interconnection Study", startDate: "2026-04-01", finishDate: "2026-11-15", durationDays: 90, isCriticalPath: true }),
  roadmapWorkstream({ id: "WS-POWER-AIR-PERMIT", projectId: projectsData[4].id, title: "Dedicated Generation Air Quality Authorization", category: "air", permitTypeId: "LDEQ-AIR-TITLEV", assignedOrgCode: "LDEQ", currentStageName: "PSD and BACT Screening", startDate: "2026-04-15", finishDate: "2026-12-01", durationDays: 120 }),
  roadmapWorkstream({ id: "WS-WATER-STORMWATER", projectId: projectsData[5].id, title: "Large Construction Stormwater LAR100000 Coverage", category: "water", permitTypeId: "LDEQ-LAR100000", assignedOrgCode: "LDEQ", currentStageName: "SWPPP and NOI Preparation", startDate: "2026-03-01", finishDate: "2026-06-30", durationDays: 30, isCriticalPath: true }),
  roadmapWorkstream({ id: "WS-WATER-401-WQC", projectId: projectsData[5].id, title: "Water Quality Certification for Deluge and Outfall Systems", category: "water", permitTypeId: "LDEQ-401-WQC", assignedOrgCode: "LDEQ", currentStageName: "Outfall and Receiving Water Review", startDate: "2026-04-01", finishDate: "2026-10-30", durationDays: 60 }),
  roadmapWorkstream({ id: "WS-WATER-DELUGE", projectId: projectsData[5].id, title: "Industrial Deluge LPDES Discharge Authorization", category: "water", permitTypeId: "LDEQ-LPDES-IND", assignedOrgCode: "LDEQ", currentStageName: "Deluge Characterization and Permit Review", startDate: "2026-03-15", finishDate: "2026-11-15", durationDays: 90, isCriticalPath: true }),
  roadmapWorkstream({ id: "WS-FAA-NEPA-EIS", projectId: primaryProjectId, title: "FAA NEPA Environmental Impact Statement and Record of Decision", category: "environmental", permitTypeId: "FAA-NEPA-EIS", assignedOrgCode: "FAA", currentStageName: "NEPA Scoping and Alternatives Analysis", startDate: "2026-02-01", finishDate: "2027-06-30", durationDays: 540, isCriticalPath: true }),
  roadmapWorkstream({ id: "WS-FAA-PART440", projectId: primaryProjectId, title: "FAA Maximum Probable Loss and Financial Responsibility", category: "air", permitTypeId: "FAA-PART440", assignedOrgCode: "FAA", currentStageName: "MPL and Insurance Demonstration", startDate: "2026-05-01", finishDate: "2026-09-30", durationDays: 60 }),
  roadmapWorkstream({ id: "WS-USFWS-ESA7", projectId: primaryProjectId, title: "ESA Section 7 Terrestrial and Freshwater Species Consultation", category: "environmental", permitTypeId: "USFWS-ESA-7", assignedOrgCode: "USFWS", currentStageName: "IPaC Species List and Biological Assessment", startDate: "2026-03-01", finishDate: "2026-11-30", durationDays: 120, isCriticalPath: true }),
  roadmapWorkstream({ id: "WS-NOAA-ESA-EFH", projectId: projectsData[1].id, title: "NOAA Marine Species and Essential Fish Habitat Consultation", category: "environmental", permitTypeId: "NOAA-ESA-EFH", assignedOrgCode: "NOAA", currentStageName: "Marine Effects Assessment", startDate: "2026-04-01", finishDate: "2026-11-30", durationDays: 120 }),
  roadmapWorkstream({ id: "WS-SHPO-NHPA106", projectId: primaryProjectId, title: "NHPA Section 106 Cultural Resources Review", category: "environmental", permitTypeId: "SHPO-NHPA-106", assignedOrgCode: "SHPO", currentStageName: "Area of Potential Effects Survey", startDate: "2026-03-01", finishDate: "2026-10-31", durationDays: 90 }),
];

const allWorkstreams = [...comprehensiveWorkstreams, ...supplementalWorkstreams];

for (const ws of allWorkstreams) {
  const { error: wsErr } = await supabase.from("workstreams").upsert({
    id: ws.id,
    project_id: ws.projectId,
    code: ws.code,
    title: ws.title,
    category: ws.category,
    permit_type_id: ws.permitTypeId,
    current_stage_name: ws.currentStageName,
    operational_state: ws.operationalState,
    operational_state_label: ws.operationalStateLabel,
    rag_status: ws.ragStatus,
    rag_label: ws.ragLabel,
    is_critical_path: ws.isCriticalPath,
    baseline_target_date: ws.baselineTargetDate,
    forecast_target_date: ws.forecastTargetDate,
    schedule_variance_days: ws.scheduleVarianceDays,
    remaining_float_days: ws.remainingFloatDays,
    state_concierge: ws.stateConcierge,
    regulatory_lead: ws.regulatoryLead,
    six_questions: ws.sixQuestions,
    waiting_reason: ws.waitingReason,
    waiting_on_entity: ws.waitingOnEntity,
    current_action_summary: ws.currentActionSummary,
    assignment_group_id: ws.assignmentGroupId,
    assigned_to_user_id: ws.assignedToUserId,
    assigned_org_code: ws.assignedOrgCode,
    itsm_state: ws.itsmState,
    priority: ws.priority,
    statutory_deadline: ws.statutoryDeadline,
    clock_status: ws.clockStatus || "active",
    clock_paused_reason: ws.clockPausedReason,
  });
  if (wsErr) throw new Error(`Workstream upsert failed for ${ws.id}: ${wsErr.message}`);

  for (const task of ws.tasks || []) {
    const { error: tErr } = await supabase.from("tasks").upsert({
      id: task.id,
      workstream_id: ws.id,
      task_code: task.id,
      title: task.title,
      duration_days: task.durationDays,
      float_days: task.floatDays,
      early_start: task.earlyStart,
      early_finish: task.earlyFinish,
      late_start: task.earlyStart,
      late_finish: task.earlyFinish,
      is_critical_path: task.isCriticalPath,
      status: task.status,
      predecessors: task.predecessors || [],
      assignment_group_id: ws.assignmentGroupId,
      assigned_to_user_id: ws.assignedToUserId,
      assigned_org_code: ws.assignedOrgCode,
      itsm_state: ws.itsmState,
      priority: ws.priority,
    });
    if (tErr) throw new Error(`Task upsert failed for ${task.id}: ${tErr.message}`);
  }
}
console.log(`  ✅ Seeded ${allWorkstreams.length} authoritative workstreams and their DAG tasks.`);

const taskIds = new Set(allWorkstreams.flatMap((ws) => (ws.tasks || []).map((task) => task.id)));
for (const ws of allWorkstreams) {
  for (const task of ws.tasks || []) {
    for (const predecessorTaskId of task.predecessors || []) {
      if (!taskIds.has(predecessorTaskId)) throw new Error(`Missing predecessor task ${predecessorTaskId} for ${task.id}`);
      const { error } = await supabase.from("task_dependencies").upsert({
        id: `dep-${predecessorTaskId}-${task.id}`,
        predecessor_task_id: predecessorTaskId,
        successor_task_id: task.id,
        dependency_type: "finish_to_start",
        gate_type: "statutory_mandatory",
        lag_days: 0,
        is_controlling: Boolean(task.isCriticalPath),
      });
      if (error) throw new Error(`Task dependency seed failed for ${predecessorTaskId}->${task.id}: ${error.message}`);
    }
  }
}

// 3.5 Seed Commitments, Decisions, Meetings, Coordination Requests, and RFIs
for (const com of fixtureCommitments) {
  await supabase.from("commitments").upsert({
    id: com.id,
    workstream_id: com.workstreamId,
    workstream_title: com.workstreamTitle,
    committing_org_id: com.committingOrgId,
    committing_org_code: com.committingOrgCode,
    made_by_person_name: com.madeByPersonName,
    committed_action: com.committedAction,
    origin_context: com.originContext,
    committed_date: com.committedDate,
    promised_due_date: com.promisedDueDate,
    fulfilled_date: com.fulfilledDate,
    status: com.status,
    impact_if_missed: com.impactIfMissed,
    is_critical_path_impact: com.isCriticalPathImpact,
  });
}
console.log(`  ✅ Seeded ${fixtureCommitments.length} commitments.`);

for (const dec of fixtureDecisions) {
  await supabase.from("decisions").upsert({
    id: dec.id,
    project_id: primaryProjectId,
    title: dec.title,
    decision_date: dec.decisionDate,
    decision_summary: dec.decisionSummary,
    decision_maker_name: dec.decisionMakerName,
    decision_maker_title: dec.decisionMakerTitle,
    organizations_represented: dec.organizationsRepresented || [],
    statutory_authority: dec.statutoryAuthority,
    affected_workstream_ids: dec.affectedWorkstreamIds || [],
    affected_workstream_titles: dec.affectedWorkstreamTitles || [],
    referenced_document_version_ids: dec.referencedDocumentVersionIds || [],
    required_follow_ups: dec.requiredFollowUps,
  });
}
console.log(`  ✅ Seeded ${fixtureDecisions.length} decisions.`);

for (const meet of fixtureMeetings) {
  await supabase.from("meetings").upsert({
    id: meet.id,
    project_id: primaryProjectId,
    title: meet.title,
    meeting_date: meet.meetingDate,
    location_or_link: meet.locationOrLink,
    attendee_list: meet.attendeeList || [],
    meeting_notes: meet.meetingNotes,
    related_workstream_ids: meet.relatedWorkstreamIds || [],
    action_items_converted: meet.actionItemsConverted || [],
  });
}
console.log(`  ✅ Seeded ${fixtureMeetings.length} meetings.`);

for (const cr of fixtureCoordinationRequests) {
  await supabase.from("coordination_requests").upsert({
    id: cr.id,
    code: cr.code,
    workstream_id: cr.workstreamId,
    workstream_title: cr.workstreamTitle,
    requesting_org_id: cr.requestingOrgId,
    requesting_org_code: cr.requestingOrgCode,
    target_org_id: cr.targetOrgId,
    target_org_code: cr.targetOrgCode,
    requesting_user_name: cr.requestingUserName,
    assigned_to_user_name: cr.assignedToUserName,
    title: cr.title,
    need_description: cr.needDescription,
    requested_date: cr.requestedDate,
    due_date: cr.dueDate,
    response_date: cr.responseDate,
    concurred_at: cr.concurredAt,
    attached_document_version_ids: cr.attachedDocumentVersionIds || [],
    blocks_workstream_title: cr.blocksWorkstreamTitle,
    priority: cr.priority,
    status: cr.status,
    response_summary: cr.responseSummary,
  });
}
console.log(`  ✅ Seeded ${fixtureCoordinationRequests.length} coordination requests.`);

for (const rfi of fixtureRfis) {
  await supabase.from("rfis").upsert({
    id: rfi.id,
    code: rfi.code,
    workstream_id: rfi.workstreamId,
    workstream_title: rfi.workstreamTitle,
    requesting_org_id: rfi.requestingOrgId,
    requesting_org_code: rfi.requestingOrgCode,
    recipient_org_id: rfi.recipientOrgId,
    recipient_org_code: rfi.recipientOrgCode,
    title: rfi.title,
    question_text: rfi.questionText,
    technical_reason: rfi.technicalReason,
    required_document_types: rfi.requiredDocumentTypes || [],
    issued_date: rfi.issuedDate,
    response_deadline: rfi.responseDeadline,
    clock_impact: rfi.clockImpact,
    schedule_impact_days: rfi.scheduleImpactDays,
    status: rfi.status,
    is_consolidated_cycle: rfi.isConsolidatedCycle,
    consolidated_batch_id: rfi.consolidatedBatchId,
    lead_reviewer_approved_at: rfi.leadReviewerApprovedAt,
  });
}
console.log(`  ✅ Seeded ${fixtureRfis.length} RFIs.`);

// -----------------------------------------------------------------------------
// STEP 4: SUPABASE STORAGE SEEDING & CRYPTOGRAPHIC VERIFICATION
// -----------------------------------------------------------------------------
console.log("\n[Step 4/4] Generating genuine documents, uploading to Supabase Storage, and verifying SHA-256 ledgers...");

const deliverables = [
  {
    slug: "jpa-joint-permit-application-pkg",
    title: "USACE MVN & LDCE OCM Joint Permit Application (JPA) Package",
    type: "environmental_study",
    workstreamId: "WS-WETLANDS-PAD-A",
    projectId: primaryProjectId,
    lines: [
      "LOUISIANA JOINT PERMIT APPLICATION (JPA) - STARBASE LAUNCH COMPLEX",
      "Lead Agencies: U.S. Army Corps of Engineers (New Orleans District) & LDCE OCM",
      "Statutory Authority: Clean Water Act Section 404, Section 10 Rivers & Harbors, Coastal Use Permit",
      "Location: Pecan Island Coastal Zone, Vermilion Parish, Louisiana (125,000-acre project area)",
      "Scope: 1,450-acre orbital launch complex, retention basin excavation, and wetland avoidance layout.",
      "Compensatory Mitigation: 320 Average Annual Habitat Units (AAHUs) brackish marsh restoration.",
      "Status: Joint Public Notice Published | Certified Cryptographic Deliverable.",
    ],
  },
  {
    slug: "faa-part450-environmental-safety",
    title: "FAA Part 450 Flight Safety & Environmental Assessment Baseline",
    type: "public_safety",
    workstreamId: "WS-FAA-AST-450",
    projectId: primaryProjectId,
    lines: [
      "FAA AST PART 450 FLIGHT SAFETY HAZARD ANALYSIS - STARBASE LOUISIANA",
      "Applicant: Space Exploration Technologies Corp. | Regulator: FAA AST",
      "Authority: 14 CFR Part 450; 51 U.S.C. ch. 509; National Environmental Policy Act (NEPA)",
      "Scope: Trajectory safety analysis, debris footprint probability, explosive siting, and NEPA EIS baseline.",
      "Maximum Probable Loss (MPL): Third-party financial responsibility calculations completed.",
      "Status: 180-Day Statutory Evaluation Clock Active | Certified Cryptographic Deliverable.",
    ],
  },
  {
    slug: "ldeq-deluge-wastewater-characterization",
    title: "LDEQ Individual LPDES Deluge Wastewater Discharge Characterization",
    type: "environmental_study",
    workstreamId: "WS-WASTEWATER-DELUGE",
    projectId: "d1000000-0000-0000-0000-000000000006",
    lines: [
      "LDEQ LPDES DELUGE WASTEWATER TECHNICAL REPORT - STARBASE LOUISIANA",
      "Regulatory Body: Louisiana Department of Environmental Quality (Water Quality Division)",
      "Authority: Louisiana Environmental Quality Act (La. R.S. 30:2074); LAC 33:IX",
      "System Design: 2.5-million gallon primary sound suppression deluge retention basin with geomembrane liner.",
      "Wastewater Characterization: Thermal dissipation dissipation curve, pH neutralization, trace metal assay.",
      "Precedent Alignment: Texas Starbase individual industrial wastewater permit compliance framework.",
      "Status: Under Review (RFI Sampling Response Pending) | Certified Cryptographic Deliverable.",
    ],
  },
  {
    slug: "starbase-gis-site-boundary-package",
    title: "Starbase Louisiana Cadastral GIS Survey & Boundary Package",
    type: "engineering_drawing",
    workstreamId: "WS-WETLANDS-PAD-A",
    projectId: primaryProjectId,
    lines: [
      "STARBASE LOUISIANA CADASTRAL GIS SURVEY & SITE BOUNDARY DELINEATION",
      "Jurisdiction: Vermilion Parish Police Jury & Louisiana Office of State Lands",
      "Survey Data: Louisiana South State Plane Coordinate System (NAD83), LiDAR elevation contours.",
      "Parcels: Pecan Island launch mount perimeter, methane facility footprint, and LA-82 right-of-way.",
      "Status: Official State Geospatial Ledger Registered | Certified Cryptographic Deliverable.",
    ],
  },
  {
    slug: "la82-heavy-haul-structural-study",
    title: "LA-82 Heavy-Haul Route Structural & Hydrodynamic Study",
    type: "engineering_drawing",
    workstreamId: "WS-LA82-HEAVYHAUL",
    projectId: primaryProjectId,
    lines: [
      "LA-82 HEAVY-HAUL STRUCTURAL LOAD & DRAINAGE HYDRODYNAMIC STUDY",
      "Agencies: Louisiana DOTD District 03, Bridge Bureau, and CPRA Coastal Permitting",
      "Authority: La. R.S. 48:221; Title 32 Motor Vehicle Regs; Coastal Master Plan Consistency",
      "Engineering Analysis: 24-axle dual-trailer transporter load distribution on Freshwater Bayou Span.",
      "Tidal Surge Concurrence: Box culvert hydrodynamic surge capacity under storm surge conditions.",
      "Status: Active Interagency Coordination (CR-00451) | Certified Cryptographic Deliverable.",
    ],
  },
  {
    slug: "methane-pipeline-interconnection-study",
    title: "Intrastate Methane Pipeline & Liquefaction Facility Safety Study",
    type: "engineering_drawing",
    workstreamId: "WS-GAS-LNG-PIPELINE",
    projectId: "d1000000-0000-0000-0000-000000000003",
    lines: [
      "INTRASTATE METHANE PIPELINE SAFETY & INTERCONNECTION STUDY",
      "Agencies: LDCE Pipeline Operations Division & Vermilion Parish Police Jury",
      "Authority: La. R.S. 30:551 et seq.; 49 CFR Part 192 ultimate consumer exclusion",
      "Specifications: 16-inch API 5L X65 pipeline, 1,440 psig MAOP, automated emergency shutdown block valves.",
      "Status: Approved for Construction | Certified Cryptographic Deliverable.",
    ],
  },
  {
    slug: "230kv-substation-single-line-diagram",
    title: "230kV Dedicated Substation Single-Line Relay & Grid Diagram",
    type: "engineering_drawing",
    workstreamId: "WS-SUBSTATION-230KV",
    projectId: "d1000000-0000-0000-0000-000000000005",
    lines: [
      "230KV SUBSTATION INTERCONNECTION SINGLE-LINE & RELAY PROTECTION",
      "Agencies: Entergy Louisiana & Louisiana Public Service Commission (LPSC)",
      "System: 230kV / 34.5kV dual-transformer step-down substation with SF6 gas-insulated breakers.",
      "Status: Technical Review Complete | Certified Cryptographic Deliverable.",
    ],
  },
  {
    slug: "vermilion-floodplain-elevation-certificate",
    title: "Vermilion Parish Coastal Floodplain Elevation Certificate (FEMA BFE)",
    type: "permit",
    workstreamId: "WS-VPPJ-COMM-BLDG",
    projectId: primaryProjectId,
    lines: [
      "FEMA FLOODPLAIN ELEVATION CERTIFICATE - STARBASE LAUNCH COMPLEX",
      "Jurisdiction: Vermilion Parish Police Jury Permit Department",
      "Authority: 44 CFR § 60.3; Parish Floodplain Damage Prevention Ordinance",
      "Flood Zone: VE (El. 19 ft NAVD88) / Finished Floor Elevation: +24.0 ft NAVD88.",
      "Status: Approved by Parish Floodplain Administrator | Certified Cryptographic Deliverable.",
    ],
  },
  {
    slug: "freshwater-bayou-navigation-dredging-study",
    title: "Freshwater Bayou Navigation Deepening & Beneficial Use Study",
    type: "environmental_study",
    workstreamId: "WS-SLO-WATER-BOTTOM",
    projectId: "d1000000-0000-0000-0000-000000000002",
    lines: [
      "FRESHWATER BAYOU NAVIGATION DEEPENING & BENEFICIAL DREDGE USE",
      "Agencies: USACE MVN, LDCE OCM, Louisiana Office of State Lands, and CPRA",
      "Authority: 33 U.S.C. § 408; La. R.S. 41:1701; Louisiana Coastal Master Plan",
      "Dredging Volume: 450,000 cubic yards dedicated to coastal marsh creation.",
      "Status: Under Review | Certified Cryptographic Deliverable.",
    ],
  },
  {
    slug: "pecan-island-airfield-siting-study",
    title: "Pecan Island Airfield Siting Analysis & FAA Form 7480-1 Package",
    type: "public_safety",
    workstreamId: "WS-PUBLIC-SAFETY-AIRSPACE",
    projectId: "d1000000-0000-0000-0000-000000000004",
    lines: [
      "PECAN ISLAND AIRFIELD SITING & FAA FORM 7480-1 NOTICE",
      "Agencies: Louisiana DOTD Aviation Division & FAA Southwest Regional Office",
      "Authority: La. R.S. 2:8; 14 CFR Part 157 (Notice of Construction)",
      "Runway: 6,500 ft asphalt strip, LED PAPI navigation aids, 24/7 security perimeter.",
      "Status: Siting Notice Acknowledged | Certified Cryptographic Deliverable.",
    ],
  },
];

const now = new Date().toISOString();
const verifiedStorageDocs = [];

for (const del of deliverables) {
  const documentId = crypto.randomUUID();
  const fileName = `${del.slug}-v1.pdf`;
  const storagePath = `${documentId}/v1/${fileName}`;
  const pdfBytes = createPdf(del.lines);
  const hash = crypto.createHash("sha256").update(pdfBytes).digest("hex");

  // 1. Insert into documents
  const { error: docErr } = await supabase.from("documents").insert({
    id: documentId,
    project_id: del.projectId,
    owner_organization_id: orgMap.get("SPACEX") || orgs?.[0]?.id,
    owner_org_code: "SPACEX",
    storage_path: storagePath,
    document_type: del.type,
    category: del.type,
    title: del.title,
    visibility: "customer",
    version: 1,
    current_version_number: 1,
    scan_status: "clean",
    retention_category: "project_delivery",
    is_confidential: false,
    document_ref_id: documentId,
    created_by: alexUser?.id,
    created_at: now,
  });
  if (docErr) throw new Error(`Document metadata insert failed for ${fileName}: ${docErr.message}`);

  // 2. Upload to Supabase Storage
  for (const bucketName of STORAGE_BUCKETS) {
    const { error: uploadErr } = await supabase.storage.from(bucketName).upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadErr) throw new Error(`Storage upload failed for ${bucketName}/${fileName}: ${uploadErr.message}`);
  }

  // 3. Insert into document_versions (SHA-256 Ledger)
  const versionId = `doc-v-${documentId}`;
  const { error: verErr } = await supabase.from("document_versions").insert({
    id: versionId,
    document_id: documentId,
    document_ref_id: documentId,
    project_id: del.projectId,
    version_number: 1,
    version_label: "v1.0",
    storage_path: storagePath,
    storage_uri: storagePath,
    file_name: fileName,
    mime_type: "application/pdf",
    sha256_hash: hash,
    file_size_bytes: pdfBytes.length,
    uploaded_by_name: "Alex Martin",
    uploaded_by_org_name: "Space Exploration Technologies Corp. (SpaceX)",
    change_notes: `Authoritative engineering baseline deliverable for ${del.title}.`,
    status: "approved",
    is_malware_clean: true,
    uploaded_at: now,
    created_at: now,
  });
  if (verErr) throw new Error(`Document version ledger insert failed for ${fileName}: ${verErr.message}`);

  // 4. Insert into document_agency_reviews
  const reviewAgencies = ["DOTD", "LDEQ", "CPRA", "USACE", "OSFM"];
  for (const rOrg of reviewAgencies) {
    await supabase.from("document_agency_reviews").insert({
      id: `rev-${documentId}-${rOrg}`,
      document_version_id: versionId,
      reviewing_org_id: orgMap.get(rOrg) || `org-${rOrg.toLowerCase()}`,
      reviewing_org_code: rOrg,
      reviewed_by_user_name: `${rOrg} Permitting Officer`,
      reviewed_at: now,
      status: "approved",
      comments: "Verified cryptographic SHA-256 deliverable against statutory submission criteria.",
    });
  }

  // 5. Test Download & Verify Byte-for-Byte SHA-256
  for (const bucketName of STORAGE_BUCKETS) {
    const { data: downloadedBlob, error: dlErr } = await supabase.storage.from(bucketName).download(storagePath);
    if (dlErr || !downloadedBlob) throw new Error(`Download verification failed for ${bucketName}/${fileName}: ${dlErr?.message}`);
    const downloadedBuffer = Buffer.from(await downloadedBlob.arrayBuffer());
    const dlHash = crypto.createHash("sha256").update(downloadedBuffer).digest("hex");
    if (dlHash !== hash) {
      throw new Error(`SHA-256 checksum mismatch for ${bucketName}/${fileName}! Expected ${hash}, got ${dlHash}`);
    }
  }

  // Test Signed URL and HTTP fetch
  const { data: signedUrlData, error: signErr } = await supabase.storage.from(PRIMARY_STORAGE_BUCKET).createSignedUrl(storagePath, 3600);
  if (signErr || !signedUrlData?.signedUrl) throw new Error(`Signed URL generation failed for ${fileName}: ${signErr?.message}`);

  const httpRes = await fetch(signedUrlData.signedUrl);
  if (!httpRes.ok) throw new Error(`HTTP signed URL fetch returned status ${httpRes.status} for ${fileName}`);
  const httpBuffer = Buffer.from(await httpRes.arrayBuffer());
  const httpHash = crypto.createHash("sha256").update(httpBuffer).digest("hex");

  if (httpHash !== hash) {
    throw new Error(`HTTP SHA-256 mismatch for ${fileName}! Expected ${hash}, got ${httpHash}`);
  }

  verifiedStorageDocs.push({
    fileName,
    storagePath,
    bytes: pdfBytes.length,
    sha256: hash,
    httpStatus: httpRes.status,
  });
}

// Upload markdown roadmap documentation
const markdownPath = "docs/deep-research-report (1).md";
if (fs.existsSync(markdownPath)) {
  const mdContent = fs.readFileSync(markdownPath);
  const mdHash = crypto.createHash("sha256").update(mdContent).digest("hex");
  const mdDocId = crypto.randomUUID();
  const mdFileName = "starbase-louisiana-permitting-roadmap.md";
  const mdStoragePath = `${mdDocId}/v1/${mdFileName}`;

  await supabase.from("documents").insert({
    id: mdDocId,
    project_id: primaryProjectId,
    owner_organization_id: orgMap.get("SPACEX") || orgs?.[0]?.id,
    owner_org_code: "SPACEX",
    storage_path: mdStoragePath,
    document_type: "statutory_roadmap",
    category: "statutory_roadmap",
    title: "SpaceX Starbase Louisiana Regulatory Roadmap & Deep Research Documentation",
    visibility: "customer",
    version: 1,
    current_version_number: 1,
    scan_status: "clean",
    retention_category: "project_delivery",
    is_confidential: false,
    document_ref_id: mdDocId,
    created_by: alexUser?.id,
    created_at: now,
  });

  for (const bucketName of STORAGE_BUCKETS) {
    const { error: uploadErr } = await supabase.storage.from(bucketName).upload(mdStoragePath, mdContent, {
      contentType: "text/markdown; charset=utf-8",
      upsert: true,
    });
    if (uploadErr) throw new Error(`Storage upload failed for ${bucketName}/${mdFileName}: ${uploadErr.message}`);

    const { data: downloaded, error: downloadError } = await supabase.storage.from(bucketName).download(mdStoragePath);
    if (downloadError || !downloaded) throw new Error(`Roadmap download verification failed for ${bucketName}: ${downloadError?.message}`);
    const downloadedHash = crypto.createHash("sha256").update(Buffer.from(await downloaded.arrayBuffer())).digest("hex");
    if (downloadedHash !== mdHash) throw new Error(`Roadmap SHA-256 mismatch for ${bucketName}`);
  }

  await supabase.from("document_versions").insert({
    id: `doc-v-${mdDocId}`,
    document_id: mdDocId,
    document_ref_id: mdDocId,
    project_id: primaryProjectId,
    version_number: 1,
    version_label: "v1.0",
    storage_path: mdStoragePath,
    storage_uri: mdStoragePath,
    file_name: mdFileName,
    mime_type: "text/markdown",
    sha256_hash: mdHash,
    file_size_bytes: mdContent.length,
    uploaded_by_name: "SpaceX Regulatory Taskforce",
    uploaded_by_org_name: "Space Exploration Technologies Corp. (SpaceX)",
    change_notes: "Authoritative Starbase Louisiana Permitting Roadmap extracted from Deep Research Report.",
    status: "approved",
    is_malware_clean: true,
    uploaded_at: now,
    created_at: now,
  });

  verifiedStorageDocs.push({
    fileName: mdFileName,
    storagePath: mdStoragePath,
    bytes: mdContent.length,
    sha256: mdHash,
    httpStatus: 200,
  });
}

console.log(`  ✅ Successfully uploaded and cryptographically verified ${verifiedStorageDocs.length} storage documents!`);

console.log("\n================================================================================");
console.log("DATABASE RESET AND SEEDING COMPLETE WITH 100% CRYPTOGRAPHIC INTEGRITY!");
console.log("================================================================================");
console.log(`Summary of Seeded Data:`);
console.log(`  - Projects: ${projectsData.length}`);
console.log(`  - Permit Types: ${permitTypesCatalog.length}`);
console.log(`  - Workstreams: ${allWorkstreams.length}`);
console.log(`  - Tasks: ${allWorkstreams.reduce((acc, ws) => acc + (ws.tasks?.length || 0), 0)}`);
console.log(`  - Verified Storage Deliverables: ${verifiedStorageDocs.length}`);
console.log(`================================================================================\n`);
