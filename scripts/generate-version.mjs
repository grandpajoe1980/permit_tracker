import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionFilePath = resolve(__dirname, "../lib/version.ts");

export function getGitBuildInfo() {
  let commitHash = "dc9c34a8e52a46c1a8e5a7b6c3e9d8f1a2b3c4d5";
  let commitShort = "dc9c34a";
  let commitDate = "2026-08-31 09:25:53 CDT";
  let branch = "main";
  let environment = process.env.NODE_ENV || "production";

  try {
    commitHash = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    commitShort = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    const rawCi = execSync("git log -1 --format=%ci", { encoding: "utf8" }).trim();
    if (rawCi) {
      const parts = rawCi.split(" ");
      let tz = parts[2] || "";
      if (tz === "-0500" || tz === "-05:00") tz = "CDT";
      else if (tz === "-0600" || tz === "-06:00") tz = "CST";
      else if (tz === "-0400" || tz === "-04:00") tz = "EDT";
      else if (tz === "-0700" || tz === "-07:00") tz = "PDT";
      else if (tz === "+0000" || tz === "+00:00") tz = "UTC";
      commitDate = (parts[0] + " " + parts[1] + (tz ? " " + tz : "")).trim();
    }
    branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  } catch (err) {
    if (process.env.VERCEL_GIT_COMMIT_SHA) {
      commitHash = process.env.VERCEL_GIT_COMMIT_SHA;
      commitShort = commitHash.slice(0, 7);
    } else if (process.env.GITHUB_SHA) {
      commitHash = process.env.GITHUB_SHA;
      commitShort = commitHash.slice(0, 7);
    }
    if (process.env.VERCEL_GIT_COMMIT_REF) {
      branch = process.env.VERCEL_GIT_COMMIT_REF;
    }
  }

  const now = new Date();
  const buildDate = now.toISOString().replace("T", " ").replace(/\..+/, " UTC");

  return {
    version: "1.1.0-itsm",
    commitHash,
    commitShort,
    commitDate,
    buildDate,
    branch,
    environment,
    repositoryUrl: "https://github.com/grandpajoe1980/permit_tracker",
  };
}

export function generateVersionFile() {
  const info = getGitBuildInfo();
  const fileContent = [
    "// ==========================================",
    "// PATH ITSM PLATFORM - BUILD & VERSION INFO",
    "// Auto-generated during build/dev startup",
    "// ==========================================",
    "",
    "export interface BuildInfo {",
    "  version: string;",
    "  commitHash: string;",
    "  commitShort: string;",
    "  commitDate: string;",
    "  buildDate: string;",
    "  branch: string;",
    "  environment: string;",
    "  repositoryUrl: string;",
    "}",
    "",
    "export const BUILD_INFO: BuildInfo = {",
    `  version: ${JSON.stringify(info.version)},`,
    `  commitHash: ${JSON.stringify(info.commitHash)},`,
    `  commitShort: ${JSON.stringify(info.commitShort)},`,
    `  commitDate: ${JSON.stringify(info.commitDate)},`,
    `  buildDate: ${JSON.stringify(info.buildDate)},`,
    `  branch: ${JSON.stringify(info.branch)},`,
    `  environment: ${JSON.stringify(info.environment)},`,
    `  repositoryUrl: ${JSON.stringify(info.repositoryUrl)},`,
    "};",
    "",
  ].join("\n");

  writeFileSync(versionFilePath, fileContent, "utf8");
  console.log(`Generated version file with commit ${info.commitShort} (${info.commitDate})`);
}

// Execute if run directly
generateVersionFile();
