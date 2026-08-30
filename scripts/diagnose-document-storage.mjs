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

const env = { ...readEnvFile(), ...process.env };
const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.legacy_service_role_key;

if (!url || !serviceKey) {
  throw new Error("Supabase service credentials are unavailable.");
}

const client = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const [buckets, versions, documents, rootObjects] = await Promise.all([
  client.storage.listBuckets(),
  client
    .from("document_versions")
    .select("id, document_id, document_ref_id, storage_path, file_name, file_size_bytes, sha256_hash, created_at")
    .order("created_at", { ascending: false })
    .limit(1000),
  client.from("documents").select("*").limit(1000),
  client.storage.from("path-documents").list("", {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  }),
]);

const downloads = [];
for (const version of versions.data ?? []) {
  const result = await client.storage.from("path-documents").download(version.storage_path);
  if (result.error || !result.data) {
    downloads.push({
      storagePath: version.storage_path,
      error: result.error?.message ?? "No blob returned",
    });
    continue;
  }

  const buffer = Buffer.from(await result.data.arrayBuffer());
  downloads.push({
    storagePath: version.storage_path,
    bytes: buffer.length,
    expectedBytes: version.file_size_bytes,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    expectedSha256: version.sha256_hash,
  });
}

console.log(JSON.stringify({
  bucket: buckets.data?.find(({ name }) => name === "path-documents") ?? null,
  bucketError: buckets.error?.message ?? null,
  versionError: versions.error?.message ?? null,
  versionCount: versions.data?.length ?? 0,
  versions: versions.data ?? [],
  documentError: documents.error?.message ?? null,
  documentCount: documents.data?.length ?? 0,
  documents: documents.data ?? [],
  rootListError: rootObjects.error?.message ?? null,
  rootObjects: rootObjects.data ?? [],
  downloads,
}, null, 2));
