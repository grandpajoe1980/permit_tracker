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
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      }),
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
const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? env.legacy_service_role_key;
if (!url || !serviceKey) throw new Error("Supabase service credentials are unavailable.");

const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const projectResult = await client
  .from("projects")
  .select("id, number, name, description")
  .eq("number", "PRJ-PECAN-2026")
  .single();
if (projectResult.error || !projectResult.data) throw new Error(`Project lookup failed: ${projectResult.error?.message ?? "Project not found"}`);

const [orgResult, userResult] = await Promise.all([
  client.from("organizations").select("id, code, name").eq("code", "SPACEX").single(),
  client.auth.admin.listUsers({ page: 1, perPage: 100 }),
]);
if (orgResult.error || !orgResult.data) throw new Error(`SpaceX organization lookup failed: ${orgResult.error?.message ?? "Organization not found"}`);
const creator = userResult.data?.users?.find((user) => user.email === "alex.martin@demo.permit.local") ?? userResult.data?.users?.find((user) => user.email === "alex.martin@spacex.test");
if (!creator) throw new Error(`Demo creator lookup failed: ${userResult.error?.message ?? "Alex Martin was not found"}`);

const legacyIds = ["doc-v-drainage-v11", "doc-v-drainage-v12", "doc-v-wetland-v4"];
const expectedDemoNames = [
  "la82-drainage-hydrodynamic-demo-v1.pdf",
  "freshwater-bayou-bridge-load-demo-v1.pdf",
  "la82-traffic-escort-protocol-demo-v1.pdf",
  "wetland-mitigation-package-demo-v1.pdf",
  "deluge-retention-basin-report-demo-v1.pdf",
  "methane-pipeline-safety-study-demo-v1.pdf",
  "230kv-substation-single-line-demo-v1.pdf",
  "launch-flight-safety-hazard-demo-v1.pdf",
];
const existingDemoResult = await client.from("document_versions").select("id, document_id, storage_path, file_name, file_size_bytes, sha256_hash, created_at").in("file_name", expectedDemoNames).order("created_at", { ascending: true });
if (existingDemoResult.error) throw new Error(`Existing demo lookup failed: ${existingDemoResult.error.message}`);
const legacyDrainageDocumentId = "5956f54f-904b-4053-82f9-399f4718e95e";
const legacyDrainageVersions = await client.from("document_versions").select("id").eq("document_id", legacyDrainageDocumentId).limit(1);
if (legacyDrainageVersions.error) throw new Error(`Legacy document-container lookup failed: ${legacyDrainageVersions.error.message}`);
if ((legacyDrainageVersions.data ?? []).length === 0) {
  const legacyDrainageDelete = await client.from("documents").delete().eq("id", legacyDrainageDocumentId);
  if (legacyDrainageDelete.error) throw new Error(`Legacy document-container deletion failed: ${legacyDrainageDelete.error.message}`);
}
const keepByName = new Set();
const keptDemoRows = [];
for (const existing of existingDemoResult.data ?? []) {
  if (!existing.file_name || keepByName.has(existing.file_name)) {
    const removeResult = await client.storage.from("path-documents").remove([existing.storage_path]);
    if (removeResult.error && !/not found|not_found/i.test(removeResult.error.message)) throw new Error(`Duplicate storage cleanup failed: ${removeResult.error.message}`);
    await client.from("audit_events").delete().eq("entity_id", existing.id);
    const duplicateDelete = await client.from("document_versions").delete().eq("id", existing.id);
    if (duplicateDelete.error) throw new Error(`Duplicate version cleanup failed: ${duplicateDelete.error.message}`);
    if (existing.document_id) {
      const remaining = await client.from("document_versions").select("id").eq("document_id", existing.document_id).limit(1);
      if (!remaining.error && (remaining.data ?? []).length === 0) await client.from("documents").delete().eq("id", existing.document_id);
    }
  } else {
    keepByName.add(existing.file_name);
    keptDemoRows.push(existing);
  }
}
if (expectedDemoNames.every((name) => keepByName.has(name))) {
  console.log(JSON.stringify({ project: { id: projectResult.data.id, number: projectResult.data.number, name: projectResult.data.name }, removedLegacyVersionIds: legacyIds, created: keptDemoRows.map((row) => ({ documentId: row.document_id, fileName: row.file_name, storagePath: row.storage_path, bytes: row.file_size_bytes, sha256: row.sha256_hash })) }, null, 2));
  process.exit(0);
}
const legacyResult = await client.from("document_versions").select("id, storage_path").in("id", legacyIds);
if (legacyResult.error) throw new Error(`Legacy version lookup failed: ${legacyResult.error.message}`);
for (const legacy of legacyResult.data ?? []) {
  const removeResult = await client.storage.from("path-documents").remove([legacy.storage_path]);
  if (removeResult.error && !/not found|not_found/i.test(removeResult.error.message)) throw new Error(`Legacy storage cleanup failed: ${removeResult.error.message}`);
  const auditDelete = await client.from("audit_events").delete().eq("entity_id", legacy.id);
  if (auditDelete.error) throw new Error(`Legacy audit cleanup failed: ${auditDelete.error.message}`);
}
const deleteLegacy = await client.from("document_versions").delete().in("id", legacyIds);
if (deleteLegacy.error) throw new Error(`Legacy version deletion failed: ${deleteLegacy.error.message}`);

const deliverables = [
  { slug: "la82-drainage-hydrodynamic", title: "LA-82 Heavy-Haul Drainage & Hydrodynamic Study", type: "engineering_drawing", workstream: "LA-82 Heavy-Haul Access & Bridge Reinforcement", summary: "Demo baseline for storm-surge routing, culvert capacity, and heavy-haul access." },
  { slug: "freshwater-bayou-bridge-load", title: "Freshwater Bayou Bridge Structural Load Rating", type: "engineering_drawing", workstream: "LA-82 Heavy-Haul Access & Bridge Reinforcement", summary: "Demo axle matrix and bridge stress rating for launch-vehicle transport." },
  { slug: "la82-traffic-escort-protocol", title: "LA-82 Heavy Transport Traffic Escort Protocol", type: "public_safety", workstream: "LA-82 Heavy-Haul Access & Bridge Reinforcement", summary: "Demo rolling-closure, escort, and emergency access coordination plan." },
  { slug: "wetland-mitigation-package", title: "Launch Complex Wetland Delineation & Mitigation Package", type: "environmental_study", workstream: "Launch Pad A - Wetland & Coastal Authorization", summary: "Demo delineation boundaries, avoidance commitments, and mitigation assumptions." },
  { slug: "deluge-retention-basin-report", title: "Industrial Deluge Water Retention Basin Report", type: "environmental_study", workstream: "Industrial Wastewater & Launch Deluge Retention Basin", summary: "Demo containment volume, water-quality sampling, and liner design notes." },
  { slug: "methane-pipeline-safety-study", title: "Natural Gas Interconnection & Pipeline Safety Study", type: "engineering_drawing", workstream: "Liquid Methane & Gas Utility Interconnection", summary: "Demo methane route alignment, valve spacing, and cathodic-protection assumptions." },
  { slug: "230kv-substation-single-line", title: "230kV Substation Interconnection Single-Line", type: "engineering_drawing", workstream: "230kV Grid Interconnection & Substation Expansion", summary: "Demo transformer, bus, relay, and utility interconnection review package." },
  { slug: "launch-flight-safety-hazard", title: "Launch Flight Safety Hazard Analysis", type: "public_safety", workstream: "Gulf Airspace & Maritime Safety Corridor", summary: "Demo debris footprint, exclusion-zone, and multi-agency notification assumptions." },
];

const created = [];
const now = new Date().toISOString();
for (const deliverable of deliverables) {
  const documentId = crypto.randomUUID();
  const fileName = `${deliverable.slug}-demo-v1.pdf`;
  const storagePath = `${documentId}/v1/${fileName}`;
  const bytes = createPdf([
    `PATH DEMO - ${deliverable.title}`,
    `Project: ${projectResult.data.number} - ${projectResult.data.name}`,
    `Workstream: ${deliverable.workstream}`,
    "Revision: v1.0 | Status: approved for demo/testing",
    deliverable.summary,
    "This synthetic PDF is for upload/download workflow testing only.",
  ]);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");

  const documentInsert = await client.from("documents").insert({
    id: documentId,
    project_id: projectResult.data.id,
    owner_organization_id: orgResult.data.id,
    storage_path: storagePath,
    document_type: deliverable.type,
    visibility: "customer",
    version: 1,
    scan_status: "clean",
    retention_category: "project_delivery",
    created_by: creator.id,
    created_at: now,
    title: deliverable.title,
    category: deliverable.type,
    owner_org_code: "SPACEX",
    current_version_number: 1,
    is_confidential: false,
    document_ref_id: documentId,
  });
  if (documentInsert.error) throw new Error(`Document insert failed for ${fileName}: ${documentInsert.error.message}`);

  const upload = await client.storage.from("path-documents").upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
  if (upload.error) throw new Error(`Storage upload failed for ${fileName}: ${upload.error.message}`);

  const versionInsert = await client.from("document_versions").insert({
    id: `doc-v-${documentId}`,
    document_id: documentId,
    document_ref_id: documentId,
    version_number: 1,
    version_label: "v1.0",
    storage_path: storagePath,
    storage_uri: storagePath,
    file_name: fileName,
    mime_type: "application/pdf",
    sha256_hash: hash,
    file_size_bytes: bytes.length,
    uploaded_by_name: "Alex Martin",
    uploaded_by_org_name: "Space Exploration Technologies Corp. (SpaceX)",
    change_notes: "Synthetic project-specific PDF for upload/download demo testing.",
    status: "approved",
    is_malware_clean: true,
    project_id: projectResult.data.id,
    uploaded_at: now,
    created_at: now,
  });
  if (versionInsert.error) {
    await client.storage.from("path-documents").remove([storagePath]);
    await client.from("documents").delete().eq("id", documentId);
    throw new Error(`Version insert failed for ${fileName}: ${versionInsert.error.message}`);
  }
  created.push({ documentId, fileName, storagePath, bytes: bytes.length, sha256: hash });
}

console.log(JSON.stringify({
  project: { id: projectResult.data.id, number: projectResult.data.number, name: projectResult.data.name },
  removedLegacyVersionIds: legacyIds,
  created,
}, null, 2));
