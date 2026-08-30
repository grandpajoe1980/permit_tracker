import Link from "next/link";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProjectRoute({ params }: { params: Promise<{ projectNumber: string }> }) {
  const { projectNumber } = await params;
  const client = await createRequestSupabaseClient();
  if (!client) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Supabase is not configured</h1></main>;
  const { data: user } = await client.auth.getUser();
  if (!user.user) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Sign in required</h1><p className="mt-2 text-slate-600">Project records are only available to authorized participants.</p></main>;

  const { data: project, error: projectError } = await client.from("projects").select("id, number, name, description, location, status").eq("number", projectNumber).maybeSingle();
  if (projectError || !project) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Project not found</h1><p className="mt-2 text-slate-600">This project is not available to the signed-in participant.</p></main>;
  const { data: workstreams } = await client.from("workstreams").select("id, code, title, current_stage_name, operational_state, forecast_target_date").eq("project_id", project.id).order("code", { ascending: true });

  return <main className="mx-auto max-w-5xl space-y-6 p-8"><div><p className="text-xs font-bold uppercase tracking-wider text-teal-700">Project route</p><h1 className="mt-2 text-3xl font-black text-slate-900">{project.name}</h1><p className="mt-2 text-sm text-slate-600">{project.number} · {project.location ?? "Authorized project workspace"}</p></div><section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold text-slate-900">Workstreams</h2><div className="mt-4 space-y-3">{(workstreams ?? []).length > 0 ? workstreams?.map((workstream) => <Link key={workstream.id} href={`/projects/${encodeURIComponent(project.number)}/workstreams/${encodeURIComponent(workstream.id)}`} className="block rounded-lg border border-slate-200 p-4 hover:border-teal-500 hover:bg-teal-50"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs font-bold text-teal-800">{workstream.code}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{workstream.operational_state}</span></div><p className="mt-2 font-bold text-slate-900">{workstream.title}</p><p className="mt-1 text-sm text-slate-600">Current stage: {workstream.current_stage_name ?? "Not assigned"} · Forecast: {workstream.forecast_target_date ?? "Not scheduled"}</p></Link>) : <p className="text-sm text-slate-600">No authorized workstreams are currently assigned to this project.</p>}</div></section></main>;
}
