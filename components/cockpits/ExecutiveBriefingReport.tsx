"use client";

import React, { useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileBadge,
  FileCheck2,
  FileText,
  Flame,
  Layers,
  MapPin,
  Printer,
  Scale,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFullProjectRecord } from "@/lib/permit-utils";
import { generateGovernorWeeklyBriefing } from "@/lib/engines/report-engine";

export function ExecutiveBriefingReport() {
  const project = getFullProjectRecord();
  const briefing = generateGovernorWeeklyBriefing(
    project,
    project.workstreams,
    project.commitments,
    project.decisions,
    project.coordinationRequests
  );

  const [activeReportTab, setActiveReportTab] = useState<"governor" | "flight_gate">("governor");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Print Controls */}
      <div className="rounded-2xl border border-slate-900 bg-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                Executive Leadership Briefing Series
              </Badge>
              <span className="text-xs font-mono text-slate-400">Classified: State Project Office / SpaceX Executive</span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              Governor's Weekly Megaproject Briefing
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              One-click synthesized executive intelligence, critical path slip analysis, and institutional decision log.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-white text-slate-900 hover:bg-slate-100 font-bold gap-2 text-xs h-9 shadow"
            >
              <Printer className="size-3.5" /> Print / Export PDF Briefing
            </Button>
          </div>
        </div>

        {/* View Switcher */}
        <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4">
          <Button
            size="sm"
            variant={activeReportTab === "governor" ? "default" : "outline"}
            onClick={() => setActiveReportTab("governor")}
            className={`text-xs font-bold h-7 ${
              activeReportTab === "governor"
                ? "bg-amber-600 text-white"
                : "bg-white/5 border-white/20 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <FileText className="size-3" /> Governor's One-Pager Briefing
          </Button>
          <Button
            size="sm"
            variant={activeReportTab === "flight_gate" ? "default" : "outline"}
            onClick={() => setActiveReportTab("flight_gate")}
            className={`text-xs font-bold h-7 ${
              activeReportTab === "flight_gate"
                ? "bg-amber-600 text-white"
                : "bg-white/5 border-white/20 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Zap className="size-3" /> SpaceX Flight Authorization Readiness Gate
          </Button>
        </div>
      </div>

      {/* ONE-PAGER PRINTABLE BRIEFING DOCUMENT */}
      {activeReportTab === "governor" && (
        <div className="space-y-6 print:m-0 print:p-0 print:border-none print:shadow-none">
          {/* Executive Summary Card */}
          <Card className="border-slate-300 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    State of Louisiana · Executive Project Office
                  </div>
                  <CardTitle className="text-xl font-black text-slate-900 mt-0.5">
                    {briefing.projectTitle}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Applicant: {briefing.applicantName} · Location: {briefing.parish} · Period: {briefing.reportPeriod}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[11px] uppercase font-bold text-slate-400">Launch Target</div>
                    <div className="text-lg font-mono font-black text-slate-900">
                      {briefing.currentForecastLaunchDate}
                    </div>
                  </div>
                  <Badge
                    className={
                      briefing.overallRagHealth === "green"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : briefing.overallRagHealth === "yellow"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-rose-100 text-rose-800 border-rose-300"
                    }
                  >
                    STATUS: {briefing.overallRagHealth.toUpperCase()} (+{briefing.scheduleVarianceDays}D SLIP)
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Executive Summary Text */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Executive Director Assessment
                </h3>
                <p className="text-xs text-slate-900 leading-relaxed font-medium">
                  {briefing.executiveSummaryText}
                </p>
              </div>

              {/* Grid: Bottlenecks & Decisions */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Critical Path Bottlenecks */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="size-4 text-rose-600" />
                      Critical Path Bottlenecks & Slippage
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {briefing.criticalPathBottlenecks.length} Active
                    </Badge>
                  </h3>

                  <div className="space-y-2.5">
                    {briefing.criticalPathBottlenecks.map((b) => (
                      <div
                        key={b.workstreamCode}
                        className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-slate-900">{b.title}</span>
                          <span className="font-mono text-rose-700">+{b.varianceDays}d Variance</span>
                        </div>
                        <div className="text-slate-600 text-[11px]">
                          <strong>Lead Agency:</strong> {b.leadAgency} · <strong>Escalation:</strong> Level {b.escalationLevel}
                        </div>
                        <div className="text-slate-700 text-[11px]">
                          <strong>Blocker:</strong> {b.blockerDescription}
                        </div>
                        <div className="rounded bg-rose-100/80 p-2 font-bold text-rose-950 text-[11px]">
                          <strong>Required Action:</strong> {b.requiredExecutiveAction}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* High Stakes Decisions Log */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Scale className="size-4 text-indigo-600" />
                      Statutory Legal Decisions Required
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {briefing.highStakesDecisions.length} Executed
                    </Badge>
                  </h3>

                  <div className="space-y-2.5">
                    {briefing.highStakesDecisions.map((d) => (
                      <div
                        key={d.decisionCode}
                        className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-slate-900">{d.title}</span>
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                            {(d.status || "ADOPTED").toUpperCase()}
                          </Badge>
                        </div>

                        <div className="text-slate-500 font-mono text-[10px]">
                          Authority: {d.statutoryAuthority} ({d.agency})
                        </div>
                        <p className="text-slate-700 text-[11px]">
                          {d.impact}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Interagency CR Summary & Upcoming Milestones */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 pt-2 border-t border-slate-100">
                {/* Concurrency Requests */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                    <span>Active Interagency Concurrency Requests</span>
                    <span className="text-slate-500 font-normal">
                      {briefing.interagencyConcurrenceStatus.pendingCount} Pending of {briefing.interagencyConcurrenceStatus.totalRequests}
                    </span>
                  </h3>
                  <div className="space-y-1.5">
                    {briefing.interagencyConcurrenceStatus.criticalPathRequests.map((cr) => (
                      <div
                        key={cr.code}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{cr.code}: {cr.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {cr.requestingAgency} → {cr.targetAgency}
                          </div>
                        </div>
                        <Badge className="bg-amber-600 text-white text-[10px]">
                          {cr.daysRemaining > 0 ? `${cr.daysRemaining}d Due` : "OVERDUE"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next 14 Days Milestones */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    High-Priority Milestones (Next 14 Days)
                  </h3>
                  <div className="space-y-1.5">
                    {briefing.keyMilestonesNext14Days.map((m) => (
                      <div
                        key={m.milestoneName}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      >
                        <div className="truncate max-w-[240px]">
                          <div className="font-bold text-slate-900 truncate">{m.milestoneName}</div>
                          <div className="text-[10px] text-slate-500 truncate">{m.workstreamTitle}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-slate-800">{m.targetDate}</div>
                          <div className="text-[10px] text-slate-400">{m.responsibleParty}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VIEW 2: SpaceX Flight Authorization Gate */}
      {activeReportTab === "flight_gate" && (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">
              SpaceX Pecan Island Flight Authorization Readiness Matrix
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Statutory signoff countdowns across FAA, USACE, CPRA, LDEQ, and DOTD
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">FAA Part 450</Badge>
                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">On Track</Badge>
                </div>
                <h4 className="text-sm font-bold text-slate-900">Flight Safety Analysis</h4>
                <p className="text-xs text-slate-600">Trajectory safety corridor and NOTAM airspace coordination with USCG.</p>
                <div className="text-xs font-mono font-bold text-slate-800 pt-2 border-t border-slate-200">
                  Target: 2026-11-15 (30d Float)
                </div>
              </div>

              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">DOTD Superload</Badge>
                  <Badge className="bg-rose-100 text-rose-800 text-[10px]">Blocked (CR-00451)</Badge>
                </div>
                <h4 className="text-sm font-bold text-slate-900">LA-82 Heavy-Haul Clearance</h4>
                <p className="text-xs text-slate-600">Freshwater Bayou bridge deck load certification pending CPRA culvert concurrence.</p>
                <div className="text-xs font-mono font-bold text-rose-800 pt-2 border-t border-rose-200">
                  Forecast: 2026-09-28 (+13d Slip)
                </div>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">USACE Section 404</Badge>
                  <Badge className="bg-amber-100 text-amber-800 text-[10px]">Public Notice</Badge>
                </div>
                <h4 className="text-sm font-bold text-slate-900">Clean Water Act Wetland Authorization</h4>
                <p className="text-xs text-slate-600">Mandatory 30-day federal public notice period running through Sep 9.</p>
                <div className="text-xs font-mono font-bold text-amber-800 pt-2 border-t border-amber-200">
                  Target: 2026-10-01 (10d Float)
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
