import type { SupabaseClient } from "@supabase/supabase-js";

export type RouteProject = {
  id: string;
  number: string;
  name: string;
  description?: string | null;
  location?: string | { description?: string | null } | null;
  status?: string | null;
};

export type RouteWorkstream = {
  id: string;
  code: string;
  title: string;
  category: string;
  project_id: string;
  current_stage_name: string | null;
  operational_state: string;
  operational_state_label: string | null;
  waiting_reason: string | null;
  waiting_on_entity: string | null;
  forecast_target_date: string | null;
  baseline_target_date: string | null;
  regulatory_lead?: unknown;
  state_concierge?: unknown;
};

const projectColumns = "id, number, name, description, location, status";
const workstreamColumns = [
  "id", "code", "title", "category", "project_id", "current_stage_name",
  "operational_state", "operational_state_label", "waiting_reason",
  "waiting_on_entity", "forecast_target_date", "baseline_target_date",
  "regulatory_lead", "state_concierge",
].join(", ");

function decodeRouteSegment(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return "";
  }
}

export async function resolveProjectRoute(
  client: SupabaseClient,
  rawKey: string | undefined,
): Promise<RouteProject | null> {
  const key = decodeRouteSegment(rawKey);
  if (!key) return null;

  const byId = await client.from("projects").select(projectColumns).eq("id", key).maybeSingle();
  if (byId.data) return byId.data as RouteProject;

  const byNumber = await client.from("projects").select(projectColumns).eq("number", key).maybeSingle();
  if (byNumber.data) return byNumber.data as RouteProject;

  const byNumberInsensitive = await client.from("projects").select(projectColumns).ilike("number", key).maybeSingle();
  return (byNumberInsensitive.data as RouteProject | null) ?? null;
}

export async function resolveWorkstreamRoute(
  client: SupabaseClient,
  projectId: string | undefined,
  rawKey: string | undefined,
): Promise<RouteWorkstream | null> {
  const key = decodeRouteSegment(rawKey);
  if (!key) return null;

  const scoped = (query: any) =>
    projectId ? query.eq("project_id", projectId) : query;

  const byId = await scoped(client.from("workstreams").select(workstreamColumns)).eq("id", key).maybeSingle();
  if (byId.data) return byId.data as RouteWorkstream;

  const byCode = await scoped(client.from("workstreams").select(workstreamColumns)).eq("code", key).maybeSingle();
  if (byCode.data) return byCode.data as RouteWorkstream;

  const byCodeInsensitive = await scoped(client.from("workstreams").select(workstreamColumns)).ilike("code", key).maybeSingle();
  return (byCodeInsensitive.data as RouteWorkstream | null) ?? null;
}
