import { spawnSync } from "node:child_process";
import "../tests/load-env.mjs";

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"],
].filter((alternatives) => !alternatives.some((name) => process.env[name]));

if (missing.length > 0) {
  console.error("Connected acceptance requires a Supabase URL and browser-safe key.");
  console.error(`Missing configuration groups: ${missing.map((alternatives) => alternatives.join(" or ")).join("; ")}`);
  process.exitCode = 1;
} else {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(executable, [
    "playwright", "test", "--project=chromium",
    "tests/e2e/supabase-persistence.spec.ts",
    "tests/e2e/document-management.spec.ts",
  ], { stdio: "inherit", env: process.env });
  process.exitCode = result.status ?? 1;
}
