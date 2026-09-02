import { redirect } from "next/navigation";
import Link from "next/link";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GlobalWorkstreamRoute({ params }: { params: Promise<{ workstreamId: string }> }) {
  const { workstreamId: rawWorkstreamId } = await params;
  const workstreamId = decodeURIComponent(rawWorkstreamId ?? "").trim();

  const client = await createRequestSupabaseClient();
  if (!client) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Supabase is not configured</h1></main>;
  const { data: user } = await client.auth.getUser();
  if (!user.user) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Sign in required</h1></main>;

  const { data: workstream } = await client
    .from("workstreams")
    .select("id, code, title, category, project_id, current_stage_name, operational_state, operational_state_label, waiting_reason, waiting_on_entity, forecast_target_date, baseline_target_date")
    .or(`id.eq."${workstreamId}",code.eq."${workstreamId}",code.ilike."${workstreamId}"`)
    .maybeSingle();

  if (!workstream) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Workstream not found</h1><p className="mt-2 text-slate-600">The requested workstream could not be resolved.</p></main>;

  if (workstream.project_id) {
    const { data: project } = await client
      .from("projects")
      .select("id, number")
      .eq("id", workstream.project_id)
      .maybeSingle();

    if (project?.number) {
      redirect(`/projects/${encodeURIComponent(project.number)}/workstreams/${encodeURIComponent(workstream.id)}`);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-teal-700">Workstream route</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-black text-slate-900">{workstream.title}</h1>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{workstream.code}</span>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {workstream.category} · {workstream.operational_state_label ?? workstream.operational_state}
        </p>
      </div>
    </main>
  );
}
