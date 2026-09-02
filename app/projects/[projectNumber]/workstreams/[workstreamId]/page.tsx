import Link from "next/link";
import { WorkflowJourney } from "@/components/cockpits/WorkflowJourney";
import { workflowStageRowToDomain } from "@/lib/supabase/mappings";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { resolveProjectRoute, resolveWorkstreamRoute } from "@/lib/supabase/route-resolvers";

export const dynamic = "force-dynamic";

export default async function WorkstreamRoute({ params }: { params: Promise<{ projectNumber: string; workstreamId: string }> }) {
  const { projectNumber: rawProjectNumber, workstreamId: rawWorkstreamId } = await params;
  const projectNumber = rawProjectNumber ?? "";
  const workstreamId = rawWorkstreamId ?? "";
  const client = await createRequestSupabaseClient();
  if (!client) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Supabase is not configured</h1></main>;
  const { data: user } = await client.auth.getUser();
  if (!user.user) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Sign in required</h1></main>;

  const project = await resolveProjectRoute(client, projectNumber);
  if (!project) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Project not found</h1><p className="mt-2 text-slate-600">The requested project could not be found.</p></main>;
  const workstream = await resolveWorkstreamRoute(client, project.id, workstreamId);
  if (!workstream) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Workstream not found</h1><p className="mt-2 text-slate-600">This workstream is not part of the requested authorized project.</p></main>;
  // The resolver applies the project scope equivalent to .eq("project_id", project.id).

  const [{ data: taskRows }, { data: stageRows }, { data: stageRunRows }] = await Promise.all([
    client.from("tasks").select("id, title, status, assigned_org_code, assigned_user_name, forecast_due_date, baseline_due_date, actual_completion_date, duration_days, is_milestone, stage_id").eq("workstream_id", workstream.id).order("task_code", { ascending: true }),
    workstream.workflow_version_id
      ? client.from("workflow_version_stages").select("*").eq("workflow_version_id", workstream.workflow_version_id).order("sequence_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    client.from("stage_runs").select("id, stage_id, stage_key, status, started_at, completed_at, completion_notes").eq("workstream_id", workstream.id).order("started_at", { ascending: true }),
  ]);

  const journeySource = {
    id: workstream.id,
    currentStageId: workstream.current_stage_id ?? undefined,
    currentStageName: workstream.current_stage_name ?? undefined,
    workflowVersionId: workstream.workflow_version_id ?? undefined,
    permitTypeId: workstream.permit_type_id ?? undefined,
    operationalState: workstream.operational_state,
    waitingReason: workstream.waiting_reason ?? undefined,
    waitingOnEntity: workstream.waiting_on_entity ?? undefined,
    baselineTargetDate: workstream.baseline_target_date ?? undefined,
    forecastTargetDate: workstream.forecast_target_date ?? undefined,
    tasks: (taskRows ?? []).map((task) => ({
      id: String(task.id),
      title: String(task.title ?? "Workflow step"),
      status: task.status,
      assignedOrgCode: task.assigned_org_code ?? undefined,
      assignedUserName: task.assigned_user_name ?? undefined,
      forecastDueDate: task.forecast_due_date ?? undefined,
      baselineDueDate: task.baseline_due_date ?? undefined,
      actualCompletionDate: task.actual_completion_date ?? undefined,
      durationDays: task.duration_days ?? undefined,
      isMilestone: task.is_milestone ?? false,
      stageId: task.stage_id ?? undefined,
    })),
    stages: (stageRows ?? []).map((stage) => workflowStageRowToDomain(stage)),
    stageRuns: (stageRunRows ?? []).map((run) => ({
      id: String(run.id),
      stageId: run.stage_id ?? undefined,
      stageKey: run.stage_key ?? undefined,
      status: String(run.status ?? "active"),
      startedAt: run.started_at ?? undefined,
      completedAt: run.completed_at ?? undefined,
      completionNotes: run.completion_notes ?? undefined,
    })),
  };

  return <main className="mx-auto max-w-5xl space-y-6 p-8">
    <Link href={`/projects/${encodeURIComponent(project.number)}`} className="text-sm font-bold text-teal-800 hover:underline">Back to {project.name}</Link>
    <div><p className="mt-4 text-xs font-bold uppercase tracking-wider text-teal-700">Workstream route</p><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black text-slate-900">{workstream.title}</h1><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{workstream.code}</span></div><p className="mt-2 text-sm text-slate-600">{workstream.category} · {workstream.operational_state_label ?? workstream.operational_state}</p></div>
    <section className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">Current stage</h2><p className="mt-2 text-lg font-black text-teal-900">{workstream.current_stage_name ?? "Not assigned"}</p><p className="mt-3 text-sm text-slate-600">Baseline target: {workstream.baseline_target_date ?? "Not scheduled"}<br />Forecast target: {workstream.forecast_target_date ?? "Not scheduled"}</p></div><div className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">Required action</h2>{workstream.waiting_reason ? <><p className="mt-2 font-bold text-amber-900">Waiting on {workstream.waiting_on_entity ?? "a project dependency"}</p><p className="mt-1 text-sm text-slate-600">{workstream.waiting_reason}</p></> : <p className="mt-2 text-sm text-slate-600">No blocker is recorded on this workstream.</p>}</div></section>
    <WorkflowJourney source={journeySource} customerSafe={false} />
  </main>;
}
