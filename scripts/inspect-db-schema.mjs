import fs from "node:fs";

function readEnvFile(path = ".env") {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs.readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 0) return [line.trim(), ""];
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2"),
        ];
      })
  );
}

const env = { ...readEnvFile(), ...process.env };
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.legacy_service_role_key;

const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});

const doc = await res.json();
console.log("TABLES & PROPERTIES:");
for (const [name, def] of Object.entries(doc.definitions || {})) {
  console.log(`\n=== ${name} ===`);
  console.log(Object.keys(def.properties || {}).join(", "));
}
