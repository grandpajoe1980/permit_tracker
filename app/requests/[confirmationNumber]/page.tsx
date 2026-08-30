import Link from "next/link";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RequestRoute({ params }: { params: Promise<{ confirmationNumber: string }> }) {
  const { confirmationNumber } = await params;
  const client = await createRequestSupabaseClient();
  if (!client) return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-bold">Supabase is not configured</h1></main>;
  const { data: user } = await client.auth.getUser();
  if (!user.user) return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-bold">Sign in required</h1></main>;
  const { data: request } = await client.from("customer_requests").select("confirmation_number, title, description, request_type, status, created_at, updated_at, project_id, related_workstream_id").eq("confirmation_number", confirmationNumber).maybeSingle();
  if (!request) return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-bold">Request not found</h1><p className="mt-2 text-slate-600">This request is not available to the signed-in participant.</p></main>;

  return <main className="mx-auto max-w-3xl space-y-6 p-8"><Link href="/" className="text-sm font-bold text-teal-800 hover:underline">← Back to PATH</Link><div><p className="mt-4 text-xs font-bold uppercase tracking-wider text-teal-700">Customer request</p><h1 className="mt-2 text-3xl font-black text-slate-900">{request.title}</h1><p className="mt-2 font-mono text-sm text-slate-600">{request.confirmation_number}</p></div><section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold uppercase text-teal-900">{request.status}</span><span className="text-xs text-slate-500">Submitted {new Date(request.created_at).toLocaleDateString()}</span></div><p className="mt-5 text-sm leading-6 text-slate-700">{request.description}</p><dl className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2"><div><dt className="font-bold text-slate-500">Request type</dt><dd className="mt-1 text-slate-900">{request.request_type.replaceAll("_", " ")}</dd></div><div><dt className="font-bold text-slate-500">Last updated</dt><dd className="mt-1 text-slate-900">{new Date(request.updated_at).toLocaleDateString()}</dd></div></dl></section></main>;
}
