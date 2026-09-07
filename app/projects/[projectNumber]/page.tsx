import Link from "next/link";
import { redirect } from "next/navigation";
import { buildShellPath } from "@/lib/navigation";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { resolveProjectRoute } from "@/lib/supabase/route-resolvers";

export const dynamic = "force-dynamic";

/** Canonical authenticated handoff for copied project URLs. */
export default async function ProjectRoute({ params }: { params: Promise<{ projectNumber: string }> }) {
  const { projectNumber: rawProjectNumber } = await params;
  const projectNumber = rawProjectNumber ?? "";
  const client = await createRequestSupabaseClient();
  if (!client) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Supabase is not configured</h1></main>;
  const { data: user } = await client.auth.getUser();
  if (!user.user) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Sign in required</h1><p className="mt-2 text-slate-600">Project records are only available to authorized participants.</p><Link href={`/?view=project`} className="mt-4 inline-flex text-sm font-bold text-teal-800 hover:underline">Open PATH sign-in</Link></main>;

  const project = await resolveProjectRoute(client, projectNumber);
  if (!project) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Project not found</h1><p className="mt-2 text-slate-600">This project is not available to the signed-in participant.</p><Link href="/" className="mt-4 inline-flex text-sm font-bold text-teal-800 hover:underline">Back to Projects</Link></main>;

  redirect(buildShellPath("project"));
}
