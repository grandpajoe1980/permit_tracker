import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const artifactDirectories = [
  ".output",
  "dist",
  ".next",
  ".vercel/output",
  "outputs",
].map((directory) => resolve(projectRoot, directory));

const textExtensions = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".html", ".css", ".map", ".txt",
]);
const jwtPattern = /\b([A-Za-z0-9_-]{20,})\.([A-Za-z0-9_-]{20,})\.([A-Za-z0-9_-]{20,})\b/g;
const supabaseSecretKeyPattern = /\bsb_secret_[A-Za-z0-9_-]{20,}\b/;

function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(path));
    else if (textExtensions.has(path.slice(path.lastIndexOf(".")).toLowerCase())) files.push(path);
  }
  return files;
}

const matches = [];
for (const directory of artifactDirectories) {
  for (const file of filesUnder(directory)) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    for (const match of content.matchAll(jwtPattern)) {
      try {
        const payload = JSON.parse(Buffer.from(match[2], "base64url").toString("utf8"));
        if (payload.role === "service_role" || payload.role === "supabase_admin") {
          matches.push(`${relative(projectRoot, file)} contains a privileged JWT payload`);
          break;
        }
      } catch {
        // Ignore ordinary dotted strings and non-JWT values.
      }
    }

    if (supabaseSecretKeyPattern.test(content)) {
      matches.push(`${relative(projectRoot, file)} contains a Supabase secret key`);
    }
  }
}

if (matches.length > 0) {
  console.error("Build artifact secret scan failed:");
  for (const match of matches) console.error(`- ${match}`);
  process.exit(1);
}

console.log("Build artifact secret scan passed.");
