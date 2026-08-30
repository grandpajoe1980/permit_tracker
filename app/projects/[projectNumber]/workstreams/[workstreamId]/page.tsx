import Link from "next/link";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WorkstreamRoute({ params }: { params: Promise<{ projectNumber: string; workstreamId: string }> }) {
  const { projectNumber, workstreamId } = await params;
  const client = await createRequestSupabaseClient();
  if (!client) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Supabase is not configured</h1></main>;
  const { data: user } = await client.auth.getUser();
  if (!user.user) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Sign in required</h1></main>;
  const { data: project } = await client.from("projects").select("id, number, name").eq("number", projectNumber).maybeSingle();
  if (!project) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Workstream not found</h1></main>;
  const { data: workstream } = await client.from("workstreams").select("id, code, title, category, current_stage_name, operational_state, operational_state_label, waiting_reason, waiting_on_entity, forecast_target_date, baseline_target_date, regulatory_lead, state_concierge").eq("project_id", project.id).eq("id", workstreamId).maybeSingle();
  if (!workstream) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Workstream not found</h1><p className="mt-2 text-slate-600">This workstream is not part of the requested authorized project.</p></main>;

  return <main className="mx-auto max-w-5xl space-y-6 p-8"><Link href={`/projects/${encodeURIComponent(project.number)}`} className="text-sm font-bold text-teal-800 hover:underline">← Back to {project.name}</Link><div><p className="mt-4 text-xs font-bold uppercase tracking-wider text-teal-700">Workstream route</p><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black text-slate-900">{workstream.title}</h1><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{workstream.code}</span></div><p className="mt-2 text-sm text-slate-600">{workstream.category} · {workstream.operational_state_label ?? workstream.operational_state}</p></div><section className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">Current stage</h2><p className="mt-2 text-lg font-black text-teal-900">{workstream.current_stage_name ?? "Not assigned"}</p><p className="mt-3 text-sm text-slate-600">Baseline target: {workstream.baseline_target_date ?? "Not scheduled"}<br />Forecast target: {workstream.forecast_target_date ?? "Not scheduled"}</p></div><div className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">Required action</h2>{workstream.waiting_reason ? <><p className="mt-2 font-bold text-amber-900">Waiting on {workstream.waiting_on_entity ?? "a project dependency"}</p><p className="mt-1 text-sm text-slate-600">{workstream.waiting_reason}</p></> : <p className="mt-2 text-sm text-slate-600">No blocker is recorded on this workstream.</p>}</div></section></main>;
}
