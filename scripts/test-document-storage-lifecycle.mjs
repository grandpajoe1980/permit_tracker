import crypto from "node:crypto";
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
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      }),
  );
}

const env = { ...readEnvFile(), ...process.env };
const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? env.legacy_service_role_key;
const email = env.DOCUMENT_TEST_EMAIL ?? "alex.martin@demo.permit.local";
const password = env.DOCUMENT_TEST_PASSWORD ?? "SpaceX-Demo-2026!";

if (!url || !anonKey || !serviceKey) throw new Error("Supabase credentials are unavailable.");

const authenticated = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const signIn = await authenticated.auth.signInWithPassword({ email, password });
if (signIn.error || !signIn.data.user) {
  throw new Error(`Test sign-in failed: ${signIn.error?.message ?? "No user returned"}`);
}

const documents = await authenticated
  .from("documents")
  .select("id, project_id")
  .order("created_at", { ascending: true })
  .limit(1);
if (documents.error || !documents.data?.[0]) {
  throw new Error(`No accessible test document: ${documents.error?.message ?? "No rows"}`);
}

const document = documents.data[0];
const token = crypto.randomUUID();
const versionId = `doc-v-lifecycle-test-${token}`;
const versionNumber = 900_000_000 + Math.floor(Date.now() / 1000) % 99_999_999;
const fileName = `lifecycle-${token}.txt`;
const storagePath = `${document.id}/v${versionNumber}/${token}/${fileName}`;
const bytes = Buffer.from(`PATH document lifecycle verification ${token}\n`, "utf8");
const expectedHash = crypto.createHash("sha256").update(bytes).digest("hex");

let storageCreated = false;
let metadataCreated = false;
try {
  const upload = await authenticated.storage.from("path-documents").upload(storagePath, bytes, {
    contentType: "text/plain",
    upsert: false,
  });
  if (upload.error) throw new Error(`Authenticated upload failed: ${upload.error.message}`);
  storageCreated = true;

  const rpc = await authenticated.rpc("rpc_create_document_version", {
    p_version_id: versionId,
    p_document_id: document.id,
    p_version_number: versionNumber,
    p_version_label: `test-${versionNumber}`,
    p_storage_path: storagePath,
    p_file_name: fileName,
    p_mime_type: "text/plain",
    p_file_size_bytes: bytes.length,
    p_sha256_hash: expectedHash,
    p_uploaded_by_name: "Document Lifecycle Test",
    p_uploaded_by_org_name: "PATH Test Runner",
    p_change_notes: "Temporary upload/download verification; safe to remove.",
    p_reviewing_agency_codes: [],
    p_project_id: document.project_id,
    p_actor_id: signIn.data.user.id,
  });
  if (rpc.error) throw new Error(`Metadata RPC failed: ${rpc.error.message}`);
  metadataCreated = true;

  const download = await authenticated.storage.from("path-documents").download(storagePath);
  if (download.error || !download.data) {
    throw new Error(`Authenticated download failed: ${download.error?.message ?? "No blob"}`);
  }

  const downloadedBytes = Buffer.from(await download.data.arrayBuffer());
  const actualHash = crypto.createHash("sha256").update(downloadedBytes).digest("hex");
  if (actualHash !== expectedHash) throw new Error("Downloaded SHA-256 does not match uploaded bytes.");

  const metadata = await authenticated
    .from("document_versions")
    .select("storage_path, file_size_bytes, sha256_hash")
    .eq("id", versionId)
    .single();
  if (metadata.error || metadata.data?.storage_path !== storagePath) {
    throw new Error(`Metadata readback failed: ${metadata.error?.message ?? "Wrong path"}`);
  }

  console.log(JSON.stringify({
    authenticatedUpload: true,
    metadataWrite: true,
    authenticatedDownload: true,
    metadataReadback: true,
    bytes: downloadedBytes.length,
    sha256Match: true,
  }));
} finally {
  if (metadataCreated) {
    await admin.from("audit_events").delete().eq("entity_id", versionId);
    await admin.from("document_agency_reviews").delete().eq("document_version_id", versionId);
    await admin.from("document_versions").delete().eq("id", versionId);
  }
  if (storageCreated) {
    await admin.storage.from("path-documents").remove([storagePath]);
  }
  await authenticated.auth.signOut();
}
