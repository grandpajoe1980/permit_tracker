"use client";

import React, { useEffect, useState } from "react";
import { BUILD_INFO } from "@/lib/version";
import { PRODUCT_NAME, PROGRAM_SUBTITLE } from "@/lib/product-copy";
import { GitCommit, Clock3, ShieldCheck, ExternalLink } from "lucide-react";

export function SystemVersionFooter() {
  // Keep the server render and the first client render identical. Build
  // metadata may differ between the SSR runtime and the browser bundle, and
  // the health endpoint is intentionally resolved only after mount.
  const [mounted, setMounted] = useState(false);
  const [runtimeCommit, setRuntimeCommit] = useState("");

  useEffect(() => {
    let active = true;
    const mountFrame = window.requestAnimationFrame(() => setMounted(true));
    void fetch("/api/health", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ commitFull?: string }> : null)
      .then((payload) => {
        if (active && payload?.commitFull) setRuntimeCommit(payload.commitFull);
      })
      .catch(() => {
        // The footer remains useful with build-time metadata when health is unavailable.
      });
    return () => {
      active = false;
      window.cancelAnimationFrame(mountFrame);
    };
  }, []);

  const commitHash = mounted ? runtimeCommit || BUILD_INFO.commitHash : "unknown";
  const commitShort = commitHash === "unknown" ? "unknown" : commitHash.slice(0, 7);

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
            {commitHash && commitHash !== "unknown" ? (
              <a
                href={`${BUILD_INFO.repositoryUrl}/commit/${commitHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-teal-800 underline-offset-2 hover:underline hover:text-teal-950 inline-flex items-center gap-0.5"
                title="View git commit on GitHub"
              >
                {commitShort}
                <ExternalLink className="size-2.5 opacity-70" />
              </a>
            ) : (
              <span className="font-sans text-slate-500 font-medium">Build identity unavailable</span>
            )}
          </div>

          {mounted && BUILD_INFO.commitDate && BUILD_INFO.commitDate !== "unknown" && (
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
