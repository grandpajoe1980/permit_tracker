"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type CustomerHomeProps = {
  projectName: string;
  onSubmitRequest: () => void;
  onViewRequests?: () => void;
  children: ReactNode;
};

/** Shared customer-home frame keeps the primary next action above project detail. */
export function CustomerHome({ projectName, onSubmitRequest, onViewRequests, children }: CustomerHomeProps) {
  return (
    <div data-path-customer-home="true" className="space-y-6">
      <section className="rounded-2xl bg-[#00284d] p-5 text-white shadow-md sm:p-8" aria-label="Start a request">
        <p className="text-sm font-semibold text-teal-200">{projectName}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">What do you need help with?</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-200">Request a permit, government service, or help moving your project forward. After you submit, the project office routes it to the right team and you can track the next step here.</p>
        <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap sm:gap-3">
          <button type="button" onClick={onSubmitRequest} className="w-full rounded-lg bg-[#f4a100] px-6 py-3 text-base font-bold text-[#00284d] hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-auto">Submit a Request</button>
          {onViewRequests && <button type="button" onClick={onViewRequests} className="w-full rounded-lg border border-white/40 px-5 py-3 font-bold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-auto">View My Requests</button>}
          <Link href="/?view=catalog" className="w-full rounded-lg border border-white/40 px-5 py-3 text-center font-bold hover:bg-white/10 sm:w-auto">Browse Services &amp; Permits</Link>
        </div>
      </section>
      {children}
    </div>
  );
}
