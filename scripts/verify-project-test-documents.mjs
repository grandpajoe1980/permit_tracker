import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function envFile() {
  if (!fs.existsSync(".env")) return {};
  return Object.fromEntries(fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((line) => line.includes("=")).map((line) => {
    const i = line.indexOf("=");
    return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, "$2")];
  }));
}

const env = { ...envFile(), ...process.env };
const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error("Supabase browser credentials are unavailable.");
const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const auth = await client.auth.signInWithPassword({
  email: env.DOCUMENT_TEST_EMAIL ?? "alex.martin@spacex.com",
  password: env.DOCUMENT_TEST_PASSWORD ?? "SpaceX-MVP-2026!",
});
if (auth.error) throw new Error(`Authenticated verification sign-in failed: ${auth.error.message}`);

const project = await client.from("projects").select("id, number, name").eq("number", "PRJ-PECAN-2026").single();
if (project.error || !project.data) throw new Error(`Project verification query failed: ${project.error?.message ?? "Not found"}`);
const versions = await client.from("document_versions").select("id, document_id, storage_path, file_name, file_size_bytes, sha256_hash, project_id").eq("project_id", project.data.id).like("file_name", "%-demo-v1.pdf").order("file_name");
if (versions.error) throw new Error(`Version verification query failed: ${versions.error.message}`);
if ((versions.data ?? []).length !== 8) throw new Error(`Expected 8 demo PDFs, found ${versions.data?.length ?? 0}.`);

const checked = [];
for (const version of versions.data ?? []) {
  const result = await client.storage.from("path-documents").download(version.storage_path);
  if (result.error || !result.data) throw new Error(`Authenticated download failed for ${version.file_name}: ${result.error?.message ?? "No blob"}`);
  const bytes = Buffer.from(await result.data.arrayBuffer());
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== version.file_size_bytes || hash !== version.sha256_hash || !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error(`Integrity check failed for ${version.file_name}.`);
  }
  checked.push({ fileName: version.file_name, bytes: bytes.length, sha256Match: true });
}

const legacy = await client.from("document_versions").select("id").in("id", ["doc-v-drainage-v11", "doc-v-drainage-v12", "doc-v-wetland-v4"]);
if (legacy.error) throw new Error(`Legacy verification query failed: ${legacy.error.message}`);
if ((legacy.data ?? []).length !== 0) throw new Error(`Legacy records remain: ${legacy.data.map((row) => row.id).join(", ")}`);
await client.auth.signOut();
console.log(JSON.stringify({ project: project.data, authenticatedDownloads: checked.length, checked, legacyRecordsRemaining: 0 }, null, 2));
