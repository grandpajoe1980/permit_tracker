import Link from "next/link";
import { AdminExplorer } from "@/components/admin/AdminExplorer";

import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdministrationRoute() {
  const client = await createRequestSupabaseClient();
  if (!client) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Supabase is not configured</h1></main>;

  const { data: user } = await client.auth.getUser();
  if (!user.user) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Sign in required</h1></main>;

  const { data: adminMembership } = await client
    .from("organization_memberships")
    .select("id")
    .eq("user_id", user.user.id)
    .eq("status", "active")
    .in("role", ["system_admin", "organization_admin"])
    .limit(1)
    .maybeSingle();

  if (!adminMembership) {
    return <main className="mx-auto max-w-4xl space-y-3 p-8"><h1 className="text-2xl font-bold">Administrator access required</h1><p className="text-slate-600">PATH administration is restricted to authorized organization or system administrators.</p><Link href="/" className="inline-flex text-sm font-bold text-teal-800 hover:underline">Back to PATH</Link></main>;
  }

  return <main className="mx-auto max-w-5xl space-y-6 p-8"><Link href="/" className="text-sm font-bold text-teal-800 hover:underline">← Back to PATH</Link><div><p className="mt-4 text-xs font-bold uppercase tracking-wider text-teal-700">Admin</p><h1 className="mt-2 text-3xl font-black text-slate-900">PATH administration</h1><p className="mt-2 text-sm text-slate-600">Manage workflow templates, permit resources, agencies, roles, memberships, and project records from authorized administration tools. Each surface rechecks administrator access on the server.</p></div><section className="grid gap-4 sm:grid-cols-2"><Link href="/admin/workflows" className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-teal-400 hover:bg-teal-50"><h2 className="font-bold text-slate-900">Workflow Templates</h2><p className="mt-2 text-sm text-slate-600">Review versioned workflow definitions and their publication state.</p></Link><Link href="/?view=admin#agency-registry" className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-teal-400 hover:bg-teal-50"><h2 className="font-bold text-slate-900">Agency Registry &amp; permit resources</h2><p className="mt-2 text-sm text-slate-600">Open the organization registry, permit catalog, and workflow design tools.</p></Link><Link href="/?view=admin#admin-directory" className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-teal-400 hover:bg-teal-50"><h2 className="font-bold text-slate-900">Users, roles &amp; memberships</h2><p className="mt-2 text-sm text-slate-600">Search every loaded user profile, update project access, and manage assignment-group membership.</p></Link><Link href="/?view=admin#admin-explorer" className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-teal-400 hover:bg-teal-50"><h2 className="font-bold text-slate-900">Record inspector</h2><p className="mt-2 text-sm text-slate-600">Browse permitted projects, requests, work, documents, notifications, and audit history in read-only mode.</p></Link></section><div id="admin-explorer"><AdminExplorer /></div></main>;
}
