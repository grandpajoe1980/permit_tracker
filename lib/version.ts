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

const processBuildEnv: Record<string, string | undefined> = typeof process !== "undefined"
  ? {
      VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
      VERCEL_GIT_COMMIT_AUTHOR_DATE: process.env.VERCEL_GIT_COMMIT_AUTHOR_DATE,
      VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
      VERCEL_ENV: process.env.VERCEL_ENV,
      BUILD_TIMESTAMP: process.env.BUILD_TIMESTAMP,
    }
  : {};

const metaEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

function runtimeValue(name: string): string {
  return processBuildEnv[name] || metaEnv?.[name] || "";
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
