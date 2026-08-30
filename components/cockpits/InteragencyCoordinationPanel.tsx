"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Filter,
  Layers,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  UserCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getFullProjectRecord } from "@/lib/permit-utils";
import { groupIntoConsolidatedBatch } from "@/lib/engines/coordination-engine";

export function InteragencyCoordinationPanel() {
  const project = getFullProjectRecord();
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>("ALL");
  const consolidatedBatch = groupIntoConsolidatedBatch(
    project.workstreams.flatMap((ws) => ws.rfis)
  );

  const crList = project.coordinationRequests.filter((cr) => {
    if (selectedOrgFilter === "ALL") return true;
    return (
      cr.targetOrgCode === selectedOrgFilter ||
      cr.requestingOrgCode === selectedOrgFilter
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">
                Interagency Action & Concurrency Framework
              </Badge>
              <span className="text-xs text-slate-500 font-mono">CR-00xxx Protocol</span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900">
              Interagency Coordination Requests & RFI Batches
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Formal cross-agency concurrency requests and consolidated applicant RFI cycles eliminating inbox black holes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow">
              <Plus className="size-3.5" /> Create Coordination Request
            </Button>
          </div>
        </div>
      </div>

      {/* Consolidated RFI Cycle Spotlight Box */}
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-500/10 via-white to-indigo-500/5 p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-600 text-white font-bold text-xs">
                Consolidated RFI Batch Cycle
              </Badge>
              <span className="text-xs font-mono text-slate-600">{consolidatedBatch.batchId}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Unified Applicant Technical Question Staging Area
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
              Prevents piecemeal questions by staging individual agency reviewer inquiries (DOTD, CPRA, LDEQ) into one coherent, coordinated request approved by the State Lead Reviewer ({consolidatedBatch.leadReviewerName}).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-center shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500">Staged Questions</div>
              <div className="text-xl font-black text-indigo-700">{consolidatedBatch.totalQuestions}</div>
            </div>
            <Button size="sm" className="bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs gap-1.5 shadow">
              <Send className="size-3.5" /> Dispatch Consolidated Batch
            </Button>
          </div>
        </div>
      </div>

      {/* Coordination Requests (CR-00xxx) Feed */}
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Active Interagency Coordination Requests</span>
            <Badge variant="outline" className="text-xs font-mono">{crList.length}</Badge>
          </h2>

          {/* Filter by Agency */}
          <div className="flex items-center gap-1.5">
            {["ALL", "DOTD", "CPRA", "LDEQ", "VERMILION-PARISH"].map((code) => (
              <Button
                key={code}
                variant={selectedOrgFilter === code ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedOrgFilter(code)}
                className="text-xs h-7 px-2.5"
              >
                {code}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {crList.map((cr) => (
            <div
              key={cr.id}
              className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md transition-shadow space-y-3"
            >
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {cr.code}
                    </span>
                    <Badge
                      className={
                        cr.status === "concurred"
                          ? "bg-emerald-100 text-emerald-800"
                          : cr.priority === "critical_path"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }
                    >
                      {cr.status.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-bold text-slate-700">From: {cr.requestingOrgCode}</span>
                    <ArrowRight className="size-3 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">To: {cr.targetOrgCode}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{cr.title}</h3>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500">Response Due</div>
                  <div className="text-xs font-mono font-bold text-slate-900">{cr.dueDate}</div>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                {cr.needDescription}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                <div>
                  <span>Blocks: <strong className="text-slate-800">{cr.blocksWorkstreamTitle}</strong></span>
                </div>
                <div>
                  <span>Assigned Reviewer: <strong className="text-slate-800">{cr.assignedToUserName || "Pending Assignment"}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
