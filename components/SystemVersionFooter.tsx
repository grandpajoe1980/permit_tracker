"use client";

import React from "react";
import { BUILD_INFO } from "@/lib/version";
import { PRODUCT_NAME, PROGRAM_SUBTITLE } from "@/lib/product-copy";
import { GitCommit, Clock3, ShieldCheck, ExternalLink } from "lucide-react";

export function SystemVersionFooter() {
  return (
    <footer
      aria-label="System version and build status"
      className="mt-16 border-t border-slate-200 bg-slate-100/90 py-5 text-slate-600 transition-colors backdrop-blur-sm"
    >
      <div className="mx-auto flex w-full min-w-0 max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 sm:px-6 lg:px-10 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5 font-bold text-[#00284d]">
            <ShieldCheck className="size-4 text-teal-700" />
            <span>{PRODUCT_NAME}</span>
            <span className="rounded-md bg-teal-100 border border-teal-300 px-2 py-0.5 font-mono text-[11px] font-black text-teal-950">
              v{BUILD_INFO.version}
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-slate-600">
            <GitCommit className="size-3.5 text-slate-400" />
            <span>Commit:</span>
            {BUILD_INFO.commitHash && BUILD_INFO.commitHash !== "unknown" ? (
              <a
                href={`${BUILD_INFO.repositoryUrl}/commit/${BUILD_INFO.commitHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-teal-800 underline-offset-2 hover:underline hover:text-teal-950 inline-flex items-center gap-0.5"
                title="View git commit on GitHub"
              >
                {BUILD_INFO.commitShort}
                <ExternalLink className="size-2.5 opacity-70" />
              </a>
            ) : (
              <span className="font-sans text-slate-500 font-medium">Build identity unavailable</span>
            )}
          </div>

          {BUILD_INFO.commitDate && BUILD_INFO.commitDate !== "unknown" && (
            <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
              <Clock3 className="size-3.5 text-slate-400" />
              <span>Committed: {BUILD_INFO.commitDate}</span>
            </div>
          )}
        </div>

        <div className="flex w-full flex-wrap items-center justify-start gap-3 sm:w-auto sm:justify-end">
          <span className="text-slate-500 text-[11px]">Operational data status is shown in the workspace.</span>
          <span className="text-slate-400 hidden md:inline">|</span>
          <span className="text-slate-500 text-[11px]">{PROGRAM_SUBTITLE}</span>
          <span className="text-slate-500 text-[11px]">Environment: {BUILD_INFO.environment ?? "production"}</span>
        </div>
      </div>
    </footer>
  );
}
