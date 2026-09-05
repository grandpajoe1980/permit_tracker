"use client";

import type { ReactNode } from "react";

type CustomerHomeProps = {
  projectName: string;
  onSubmitRequest: () => void;
  children: ReactNode;
};

/** Shared customer-home frame keeps the primary next action above project detail. */
export function CustomerHome({ projectName, onSubmitRequest, children }: CustomerHomeProps) {
  return (
    <div data-path-customer-home="true" className="space-y-6">
      <section className="rounded-2xl bg-[#00284d] p-6 text-white shadow-md sm:p-8" aria-label="Start a request">
        <p className="text-sm font-semibold text-teal-200">{projectName}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">What do you need help with?</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-200">Request a permit, government service, or help moving your project forward.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={onSubmitRequest} className="rounded-lg bg-[#f4a100] px-6 py-3 text-base font-bold text-[#00284d] hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Submit a Request</button>
          <a href="/?view=catalog" className="rounded-lg border border-white/40 px-5 py-3 font-bold hover:bg-white/10">Browse Services &amp; Permits</a>
        </div>
      </section>
      {children}
    </div>
  );
}
