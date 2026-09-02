import vinext from "vinext";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async ({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const runtimeEnv = { ...fileEnv, ...process.env };
  const publicSupabaseUrl =
    runtimeEnv.NEXT_PUBLIC_SUPABASE_URL || runtimeEnv.SUPABASE_URL || "";
  const publicSupabaseKey =
    runtimeEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    runtimeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    runtimeEnv.SUPABASE_ANON_KEY ||
    "";
  const publicEnvDefines = {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(publicSupabaseUrl),
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicSupabaseKey),
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(publicSupabaseKey),
    "process.env.SUPABASE_URL": JSON.stringify(publicSupabaseUrl),
    "process.env.SUPABASE_ANON_KEY": JSON.stringify(publicSupabaseKey),
    "process.env.APP_DATA_MODE": JSON.stringify(runtimeEnv.APP_DATA_MODE ?? runtimeEnv.NEXT_PUBLIC_APP_DATA_MODE ?? "production"),
    "process.env.NEXT_PUBLIC_APP_DATA_MODE": JSON.stringify(runtimeEnv.NEXT_PUBLIC_APP_DATA_MODE ?? runtimeEnv.APP_DATA_MODE ?? "production"),
    "process.env.VERCEL_GIT_COMMIT_SHA": JSON.stringify(runtimeEnv.VERCEL_GIT_COMMIT_SHA || runtimeEnv.GIT_COMMIT_SHA || ""),
    "process.env.VERCEL_GIT_COMMIT_AUTHOR_DATE": JSON.stringify(runtimeEnv.VERCEL_GIT_COMMIT_AUTHOR_DATE || ""),
    "process.env.VERCEL_GIT_COMMIT_REF": JSON.stringify(runtimeEnv.VERCEL_GIT_COMMIT_REF || ""),
    "process.env.VERCEL_ENV": JSON.stringify(runtimeEnv.VERCEL_ENV || ""),
    "process.env.BUILD_TIMESTAMP": JSON.stringify(runtimeEnv.BUILD_TIMESTAMP || new Date().toISOString()),
  };
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Vercel is the canonical runtime. Cloudflare support is opt-in so it cannot
  // silently change local builds or the deployment contract.
  if (runtimeEnv.PATH_RUNTIME !== "cloudflare") {
    return {
      define: publicEnvDefines,
      server: {
        host: "0.0.0.0",
        ...(isCodexSeatbeltSandbox
          ? { watch: { useFsEvents: false, usePolling: true } }
          : {}),
      },
      plugins: [vinext(), nitro()],
    };
  }

  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    define: publicEnvDefines,
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
