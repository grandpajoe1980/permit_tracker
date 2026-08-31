// ==========================================
// PATH ITSM PLATFORM - BUILD & VERSION INFO
// ==========================================

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

export const BUILD_INFO: BuildInfo = {
  version: "1.1.0-itsm",
  commitHash: "dc9c34a8e52a46c1a8e5a7b6c3e9d8f1a2b3c4d5",
  commitShort: "dc9c34a",
  commitDate: "2026-08-31 09:25:53 CDT",
  buildDate: "2026-08-31 09:26:00 CDT",
  branch: "main",
  environment: "production",
  repositoryUrl: "https://github.com/grandpajoe1980/permit_tracker",
};
