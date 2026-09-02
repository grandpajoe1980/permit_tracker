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

const { data: buckets } = await supabase.storage.listBuckets();
console.log("Buckets:", buckets);

for (const b of (buckets || [])) {
  console.log(`\n=== Files in Bucket ${b.name} ===`);
  const { data: files, error } = await supabase.storage.from(b.name).list("", { limit: 100 });
  if (error) {
    console.error(`Error listing ${b.name}:`, error.message);
  } else {
    for (const f of files) {
      console.log(`  - ${f.name} (${f.id ? 'file/dir' : 'item'}, size: ${f.metadata?.size || 'unknown'})`);
      if (f.id === null) {
        // Subdirectory
        const { data: subFiles } = await supabase.storage.from(b.name).list(f.name, { limit: 100 });
        for (const sf of (subFiles || [])) {
          console.log(`    * ${f.name}/${sf.name}`);
          if (sf.id === null) {
            const { data: subSubFiles } = await supabase.storage.from(b.name).list(`${f.name}/${sf.name}`, { limit: 100 });
            for (const ssf of (subSubFiles || [])) {
              console.log(`      + ${f.name}/${sf.name}/${ssf.name}`);
            }
          }
        }
      }
    }
  }
}

// Also check document_versions records in database
const { data: docVersions, error: dvErr } = await supabase
  .from("document_versions")
  .select("id, document_id, version_label, file_name, storage_path, sha256_hash, file_size_bytes");

console.log("\n=== document_versions in DB ===");
console.log(docVersions);
