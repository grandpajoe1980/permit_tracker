import fs from "node:fs";
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
      }),
  );
}

const env = { ...readEnvFile(), ...process.env };
const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey =
  env.SUPABASE_SERVICE_ROLE_KEY ?? env.legacy_service_role_key;

if (!url || !serviceKey) {
  throw new Error(
    "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const restResponse = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
});
const restDocument = restResponse.ok ? await restResponse.json() : null;
const restPaths = Object.keys(restDocument?.paths ?? {});

const listedBefore = await supabase.storage.listBuckets();
if (listedBefore.error) {
  throw new Error(`Storage read failed: ${listedBefore.error.message}`);
}

const probeBucket = `path-connection-probe-${Date.now().toString(36)}`;
const created = await supabase.storage.createBucket(probeBucket, {
  public: false,
});
if (created.error) {
  throw new Error(`Storage write failed: ${created.error.message}`);
}

let deleted = false;
try {
  const listedAfter = await supabase.storage.listBuckets();
  if (listedAfter.error) {
    throw new Error(`Storage read-after-write failed: ${listedAfter.error.message}`);
  }
  if (!listedAfter.data.some(({ name }) => name === probeBucket)) {
    throw new Error("Storage write was not visible in the subsequent read.");
  }
} finally {
  const removed = await supabase.storage.deleteBucket(probeBucket);
  deleted = !removed.error;
  if (removed.error) {
    throw new Error(
      `Probe cleanup failed for ${probeBucket}: ${removed.error.message}`,
    );
  }
}

console.log(
  JSON.stringify({
    restRead: restResponse.ok,
    exposedRestPaths: restPaths,
    storageRead: true,
    storageWrite: true,
    storageCleanup: deleted,
    exposedTableCount: Math.max(0, restPaths.length - 1),
  }),
);
