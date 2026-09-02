export interface BuildInfo {
  version: string;
  commitHash: string;
  commitShort: string;
  commitDate: string;
  buildDate: string;
  branch: string;
  environment: string;
  repositoryUrl: string;
}

function runtimeValue(name: string): string {
  if (typeof process !== "undefined" && process.env?.[name]) {
    return process.env[name] ?? "";
  }

  const metaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return metaEnv?.[name] ?? "";
}

const commitHash = runtimeValue("VERCEL_GIT_COMMIT_SHA") || runtimeValue("GIT_COMMIT_SHA") || "unknown";

export const BUILD_INFO: BuildInfo = {
  version: "1.1.0-itsm",
  commitHash,
  commitShort: commitHash === "unknown" ? "unknown" : commitHash.slice(0, 7),
  commitDate: runtimeValue("VERCEL_GIT_COMMIT_AUTHOR_DATE") || "unknown",
  buildDate: runtimeValue("BUILD_TIMESTAMP") || "unknown",
  branch: runtimeValue("VERCEL_GIT_COMMIT_REF") || "unknown",
  environment: runtimeValue("VERCEL_ENV") || runtimeValue("NODE_ENV") || "production",
  repositoryUrl: "https://github.com/grandpajoe1980/permit_tracker",
};
