import Link from "next/link";
import { redirect } from "next/navigation";
import { buildDetailShellPath, buildWorkItemPath, parseWorkItemPath } from "@/lib/navigation";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function decodeSegment(value: string | undefined) {
  try {
    return decodeURIComponent(value ?? "").trim();
  } catch {
    return (value ?? "").trim();
  }
}

/**
 * Canonical authenticated handoff for a focused work item. The client workspace
 * owns the hydrated record view; this route only validates the URL shape and
 * makes authentication/deep-link recovery explicit before handing off.
 */
export default async function WorkItemRoute({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind: rawKind, id: rawId } = await params;
  const kind = decodeSegment(rawKind);
  const id = decodeSegment(rawId);
  const path = buildWorkItemPath(kind, id);

  if (!parseWorkItemPath(path)) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-teal-700">PATH work item</p>
        <h1 className="text-2xl font-black text-slate-900">Work item not found</h1>
        <p className="text-slate-600">The requested work item link is not valid or is no longer available.</p>
        <Link href="/" className="inline-flex text-sm font-bold text-teal-800 hover:underline">Back to PATH</Link>
      </main>
    );
  }

  const client = await createRequestSupabaseClient();
  if (!client) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <h1 className="text-2xl font-black text-slate-900">Workspace unavailable</h1>
        <p className="text-slate-600">PATH could not connect to its authorized workspace. Try again later or contact support.</p>
        <Link href="/" className="inline-flex text-sm font-bold text-teal-800 hover:underline">Back to PATH</Link>
      </main>
    );
  }

  const { data: user } = await client.auth.getUser();
  if (!user.user) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-teal-700">PATH work item</p>
        <h1 className="text-2xl font-black text-slate-900">Sign in required</h1>
        <p className="text-slate-600">Sign in to open this authorized work item. After sign-in, PATH returns you to the requested record.</p>
        <Link href={`/?returnTo=${encodeURIComponent(path)}`} className="inline-flex text-sm font-bold text-teal-800 hover:underline">Open PATH sign-in</Link>
      </main>
    );
  }

  redirect(buildDetailShellPath(kind, id));
}
