export type AppDataMode = "production" | "demo" | "test";

/** Production is the default in a browser; fixtures are test/demo only. */
export function getAppDataMode(): AppDataMode {
  const configured = process.env.APP_DATA_MODE ?? process.env.NEXT_PUBLIC_APP_DATA_MODE;
  if (configured === "production" || configured === "demo" || configured === "test") return configured;
  // A production Node server must not quietly enable fixture fallbacks when
  // APP_DATA_MODE was omitted from its environment.
  if (process.env.NODE_ENV === "production") return "production";
  return typeof window === "undefined" ? "test" : "production";
}

export function allowsFixtureData(): boolean {
  return getAppDataMode() !== "production";
}

export function requiresSupabase(): boolean {
  return getAppDataMode() === "production";
}
