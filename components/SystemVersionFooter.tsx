"use client";

import React from "react";
import { BUILD_INFO } from "@/lib/version";
import { GitBranch, GitCommit, Clock3, Database, ShieldCheck, ExternalLink } from "lucide-react";

export function SystemVersionFooter() {
  return (
    <footer
      aria-label="System version and build status"
      className="mt-16 border-t border-slate-200 bg-slate-100/90 py-5 text-slate-600 transition-colors backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 sm:px-6 lg:px-10 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5 font-bold text-[#00284d]">
            <ShieldCheck className="size-4 text-teal-700" />
            <span>PATH ITSM & Permitting Platform</span>
            <span className="rounded-md bg-teal-100 border border-teal-300 px-2 py-0.5 font-mono text-[11px] font-black text-teal-950">
              v{BUILD_INFO.version}
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-slate-600">
            <GitCommit className="size-3.5 text-slate-400" />
            <span>Commit:</span>
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
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
            <Clock3 className="size-3.5 text-slate-400" />
            <span>Committed: {BUILD_INFO.commitDate}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-900 shadow-2xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <Database className="size-3 text-emerald-700" />
            <span>Supabase Authoritative Persistence</span>
          </div>
          <span className="text-slate-400 hidden md:inline">|</span>
          <span className="text-slate-500 text-[11px]">
            SpaceX Louisiana Operations · Vermilion Parish
          </span>
        </div>
      </div>
    </footer>
  );
}
