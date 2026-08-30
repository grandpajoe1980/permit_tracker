import Link from "next/link";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WorkflowAdministrationRoute() {
  const client = await createRequestSupabaseClient();
  if (!client) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Supabase is not configured</h1></main>;
  const { data: user } = await client.auth.getUser();
  if (!user.user) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Sign in required</h1></main>;
  const { data: adminMembership } = await client.from("organization_memberships").select("id").eq("user_id", user.user.id).eq("status", "active").in("role", ["system_admin", "organization_admin"]).limit(1).maybeSingle();
  if (!adminMembership) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Administrator access required</h1><p className="mt-2 text-slate-600">Workflow definitions are restricted to authorized administrators.</p></main>;
  const { data: versions } = await client.from("workflow_versions").select("id, workflow_id, version_number, version_label, lifecycle_status, is_active, published_at").order("workflow_id", { ascending: true }).order("version_number", { ascending: false });
  return <main className="mx-auto max-w-5xl space-y-6 p-8"><Link href="/" className="text-sm font-bold text-teal-800 hover:underline">← Back to PATH</Link><div><p className="mt-4 text-xs font-bold uppercase tracking-wider text-teal-700">Administration route</p><h1 className="mt-2 text-3xl font-black text-slate-900">Workflow versions</h1><p className="mt-2 text-sm text-slate-600">Draft and publication operations remain guarded by the server-side workflow administration RPCs.</p></div><section className="rounded-xl border border-slate-200 bg-white p-5"><div className="space-y-3">{(versions ?? []).length > 0 ? versions?.map((version) => <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"><div><p className="font-mono text-xs font-bold text-teal-800">{version.workflow_id} · {version.version_label}</p><p className="mt-1 text-sm text-slate-600">Version {version.version_number}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{version.lifecycle_status}{version.is_active ? " · active" : ""}</span></div>) : <p className="text-sm text-slate-600">No workflow versions are visible to this participant.</p>}</div></section></main>;
}
