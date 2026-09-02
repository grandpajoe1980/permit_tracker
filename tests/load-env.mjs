import { existsSync, readFileSync } from "node:fs";

// The application must fail closed when runtime configuration is missing.
// Tests opt into local credentials explicitly so Vite's configFile:false test
// servers behave like the normal configured test environment.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^("|')(.*)\1$/, "$2");
    process.env[key] ??= value;
  }
}
