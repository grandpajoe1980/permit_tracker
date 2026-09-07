import Link from "next/link";
import { redirect } from "next/navigation";
import { buildShellPath } from "@/lib/navigation";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { resolveProjectRoute, resolveWorkstreamRoute } from "@/lib/supabase/route-resolvers";

export const dynamic = "force-dynamic";

/**
 * Copied workstream URLs are an authenticated handoff into the same Project
 * workspace used by My Work, notifications, and the client-side project view.
 */
export default async function WorkstreamRoute({ params }: { params: Promise<{ projectNumber: string; workstreamId: string }> }) {
  const { projectNumber: rawProjectNumber, workstreamId: rawWorkstreamId } = await params;
  const projectNumber = rawProjectNumber ?? "";
  const workstreamId = rawWorkstreamId ?? "";
  const client = await createRequestSupabaseClient();
  if (!client) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-bold">Supabase is not configured</h1></main>;
  const { data: user } = await client.auth.getUser();
  if (!user.user) return <main className="mx-auto max-w-4xl space-y-4 p-8"><h1 className="text-2xl font-bold">Sign in required</h1><p className="text-slate-600">Sign in to view this authorized workstream. After signing in, return to this URL to continue.</p><Link href={`/?view=project&workstream=${encodeURIComponent(workstreamId)}`} className="inline-flex text-sm font-bold text-teal-800 hover:underline">Open PATH sign-in</Link></main>;

  const project = await resolveProjectRoute(client, projectNumber);
  if (!project) return <main className="mx-auto max-w-4xl space-y-4 p-8"><h1 className="text-2xl font-bold">Project not found</h1><p className="text-slate-600">The requested project could not be found.</p><Link href="/" className="inline-flex text-sm font-bold text-teal-800 hover:underline">Back to Projects</Link></main>;
  const workstream = await resolveWorkstreamRoute(client, project.id, workstreamId);
  if (!workstream) return <main className="mx-auto max-w-4xl space-y-4 p-8"><h1 className="text-2xl font-bold">Workstream not found</h1><p className="text-slate-600">This workstream is not part of the requested authorized project.</p><div className="flex flex-wrap gap-3"><Link href={`/projects/${encodeURIComponent(project.number)}`} className="inline-flex text-sm font-bold text-teal-800 hover:underline">Back to project</Link><Link href="/" className="inline-flex text-sm font-bold text-teal-800 hover:underline">Back to Projects</Link></div></main>;

  redirect(buildShellPath("project", workstream.id));
}
