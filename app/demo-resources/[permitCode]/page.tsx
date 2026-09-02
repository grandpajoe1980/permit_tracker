import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DemoResourceRoute({ params }: { params: Promise<{ permitCode: string }> }) {
  const { permitCode } = await params;
  const code = decodeURIComponent(permitCode ?? "").trim().toUpperCase();
  const title = code ? `${code} internal demo guide` : "Internal demo guide";
  return <main className="mx-auto max-w-3xl space-y-6 p-8"><Link href="/" className="text-sm font-bold text-teal-800 hover:underline">← Back to PATH</Link><section className="rounded-2xl border border-amber-300 bg-amber-50 p-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-900">PATH demo resource</p><h1 className="mt-2 text-3xl font-black text-slate-900">{title}</h1><p className="mt-3 text-sm leading-6 text-amber-950">This is an internal, fictional demonstration guide for configuring a PATH request. It is not an official government form, filing receipt, or legal instruction.</p></section><section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-black text-slate-900">Suggested submission checklist</h2><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700"><li>Confirm the project scope, location, and requested decision.</li><li>Attach the plans, maps, technical narrative, and supporting records requested by the responsible agency.</li><li>Submit the formal application through the agency’s authoritative system when one is listed in PATH.</li><li>Record the agency confirmation number in the PATH request so the project team can track the handoff.</li></ol><p className="mt-5 text-xs text-slate-500">Demo code: {code || "UNSPECIFIED"} · Source: PATH internal demonstration content</p></section></main>;
}
