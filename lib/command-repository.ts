import type { SupabaseClient } from "@supabase/supabase-js";

/** Async, actor-scoped operational repository. RLS/database RPCs enforce access. */
export class CommandRepository {
  constructor(private readonly db: SupabaseClient) {}
  async getProjectWorkstreams(projectId: string) {
    const { data, error } = await this.db.from("workstreams").select("*").eq("project_id", projectId).is("archived_at", null).order("forecast_target_date");
    if (error) throw error; return data;
  }
  async getCoordinationQueue(organizationId: string) {
    const { data, error } = await this.db.from("coordination_requests").select("*").eq("target_organization_id", organizationId).in("status", ["pending", "in_review", "objection_raised"]).order("due_date");
    if (error) throw error; return data;
  }
  async acceptRfiResponse(rfiId: string, responseId: string, reason?: string) {
    const { error } = await this.db.rpc("accept_rfi_response", { p_rfi_id: rfiId, p_response_id: responseId, p_reason: reason ?? null });
    if (error) throw error;
  }
  async createCoordinationRequest(input: Record<string, unknown>) {
    const { data, error } = await this.db.from("coordination_requests").insert(input).select().single();
    if (error) throw error; return data;
  }
}
