"use client";

import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  Filter,
  Flame,
  GitBranch,
  Info,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFullProjectRecord } from "@/lib/permit-utils";
import { evaluateProjectSchedule } from "@/lib/engines/schedule-engine";
import type { OperationalState, ProjectRecord, WorkstreamRecord } from "@/lib/domain-models";

import { InteractiveScheduleSimulator } from "./InteractiveScheduleSimulator";

// ====================================================================
// OPERATIONAL STATE COLOR CONFIGURATION & METADATA
// ====================================================================

export interface StateStyleConfig {
  label: string;
  shortLabel: string;
  barColor: string;
  barBorder: string;
  textColor: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  description: string;
}

export const STATE_COLOR_MAP: Record<OperationalState, StateStyleConfig> = {
  running: {
    label: "Running / Active Review",
    shortLabel: "Running",
    barColor: "bg-emerald-500 hover:bg-emerald-600",
    barBorder: "border-emerald-600",
    textColor: "text-white",
    badgeBg: "bg-emerald-100 border-emerald-300",
    badgeText: "text-emerald-900",
    dotColor: "bg-emerald-500",
    description: "Active government technical review in progress with clear milestones",
  },
  waiting_applicant: {
    label: "Waiting on SpaceX / RFI",
    shortLabel: "Waiting Applicant",
    barColor: "bg-amber-500 hover:bg-amber-600",
    barBorder: "border-amber-600",
    textColor: "text-slate-950",
    badgeBg: "bg-amber-100 border-amber-300",
    badgeText: "text-amber-950",
    dotColor: "bg-amber-500",
    description: "Paused waiting for applicant engineering drawings, calculations, or RFI response",
  },
  waiting_government: {
    label: "Waiting on Another Agency",
    shortLabel: "Interagency Wait",
    barColor: "bg-indigo-500 hover:bg-indigo-600",
    barBorder: "border-indigo-600",
    textColor: "text-white",
    badgeBg: "bg-indigo-100 border-indigo-300",
    badgeText: "text-indigo-900",
    dotColor: "bg-indigo-500",
    description: "Waiting on concurrence, consultation, or technical transfer from partner agency",
  },
  waiting_external: {
    label: "Waiting on External Utility",
    shortLabel: "External Wait",
    barColor: "bg-sky-500 hover:bg-sky-600",
    barBorder: "border-sky-600",
    textColor: "text-slate-950",
    badgeBg: "bg-sky-100 border-sky-300",
    badgeText: "text-sky-950",
    dotColor: "bg-sky-500",
    description: "Awaiting third-party utility interconnection, pipeline crossing, or railroad permit",
  },
  statutory_waiting_period: {
    label: "Statutory Notice / Public Comment",
    shortLabel: "Statutory Notice",
    barColor: "bg-purple-500 hover:bg-purple-600",
    barBorder: "border-purple-600",
    textColor: "text-white",
    badgeBg: "bg-purple-100 border-purple-300",
    badgeText: "text-purple-900",
    dotColor: "bg-purple-500",
    description: "Mandatory public comment, federal register notice, or statutory hearing window",
  },
  scheduled_hold: {
    label: "Scheduled / Administrative Hold",
    shortLabel: "Scheduled Hold",
    barColor: "bg-slate-400 hover:bg-slate-500",
    barBorder: "border-slate-500",
    textColor: "text-white",
    badgeBg: "bg-slate-100 border-slate-300",
    badgeText: "text-slate-800",
    dotColor: "bg-slate-500",
    description: "Planned statutory pause awaiting seasonal window or environmental survey",
  },
  blocked: {
    label: "Blocked / Critical Risk",
    shortLabel: "Blocked",
    barColor: "bg-rose-500 hover:bg-rose-600 animate-pulse",
    barBorder: "border-rose-700",
    textColor: "text-white",
    badgeBg: "bg-rose-100 border-rose-300",
    badgeText: "text-rose-950",
    dotColor: "bg-rose-600",
    description: "Critical blocker preventing forward progress; requires active escalation",
  },
  escalated: {
    label: "Interagency Escalation",
    shortLabel: "Escalated",
    barColor: "bg-orange-500 hover:bg-orange-600",
    barBorder: "border-orange-700",
    textColor: "text-white",
    badgeBg: "bg-orange-100 border-orange-300",
    badgeText: "text-orange-950",
    dotColor: "bg-orange-500",
    description: "Escalated to State Project Office or Cabinet Secretary for expedited resolution",
  },
  complete: {
    label: "Complete / Approved",
    shortLabel: "Complete",
    barColor: "bg-teal-600 hover:bg-teal-700",
    barBorder: "border-teal-800",
    textColor: "text-white",
    badgeBg: "bg-teal-100 border-teal-300",
    badgeText: "text-teal-950",
    dotColor: "bg-teal-600",
    description: "Permit authorization issued, conditions recorded, and statutory review closed",
  },
  cancelled: {
    label: "Cancelled / Waived",
    shortLabel: "Cancelled",
    barColor: "bg-slate-300 hover:bg-slate-400",
    barBorder: "border-slate-400",
    textColor: "text-slate-700",
    badgeBg: "bg-slate-100 border-slate-200",
    badgeText: "text-slate-600",
    dotColor: "bg-slate-400",
    description: "Workstream determination waived or superseded by alternate alignment",
  },
};

export function WorkstreamGraphGantt({
  customerSafe = false,
  onSelectWorkstream,
  onSelectProject,
  project: projectOverride,
}: {
  customerSafe?: boolean;
  onSelectWorkstream?: (workstreamId: string) => void;
  onSelectProject?: (workstreamId?: string) => void;
  project?: ProjectRecord;
}) {
  const project = projectOverride ?? getFullProjectRecord();
  const schedule = evaluateProjectSchedule(project.workstreams);
  const [activeTab, setActiveTab] = useState<"graph" | "simulator" | "delays" | "acceleration">("graph");
  const [scheduleViewMode, setScheduleViewMode] = useState<"bars" | "table">("bars");
  const [filterState, setFilterState] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hoveredWorkstreamId, setHoveredWorkstreamId] = useState<string | null>(null);

  // Timeline boundaries include the earliest baseline work and the current forecast.
  const timelineStart = useMemo(() => new Date("2026-03-01T00:00:00Z"), []);
  const timelineEnd = useMemo(() => new Date("2026-12-31T23:59:59Z"), []);
  const totalTimelineDays = useMemo(() => {
    return Math.max(1, Math.round((timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));
  }, [timelineStart, timelineEnd]);

  // Today marker (August 30, 2026)
  const todayDate = useMemo(() => new Date("2026-08-30T12:00:00Z"), []);
  const todayPositionPercent = useMemo(() => {
    const elapsed = (todayDate.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.min(100, (elapsed / totalTimelineDays) * 100));
  }, [todayDate, timelineStart, totalTimelineDays]);

  // Months header configuration
  const months = useMemo(() => [
    { label: "Mar 2026", startDay: 0, days: 31 },
    { label: "Apr 2026", startDay: 31, days: 30 },
    { label: "May 2026", startDay: 61, days: 31 },
    { label: "Jun 2026", startDay: 92, days: 30 },
    { label: "Jul 2026", startDay: 122, days: 31 },
    { label: "Aug 2026", startDay: 153, days: 31, isCurrent: true },
    { label: "Sep 2026", startDay: 184, days: 30 },
    { label: "Oct 2026", startDay: 214, days: 31 },
    { label: "Nov 2026", startDay: 245, days: 30 },
    { label: "Dec 2026", startDay: 275, days: 31 },
  ], []);

  // Helper to compute percentage position on timeline
  function getTimelinePosition(dateStr?: string): number {
    if (!dateStr) return 0;
    const date = new Date(`${dateStr}T12:00:00Z`);
    if (isNaN(date.getTime())) return 0;
    const days = (date.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.min(100, (days / totalTimelineDays) * 100));
  }

  // Filtered workstreams
  const filteredWorkstreams = useMemo(() => {
    return project.workstreams.filter((ws) => {
      if (filterState === "critical" && !ws.isCriticalPath) return false;
      if (filterState === "delayed" && ws.scheduleVarianceDays <= 0 && ws.operationalState !== "blocked") return false;
      if (filterState !== "all" && filterState !== "critical" && filterState !== "delayed" && ws.operationalState !== filterState) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          ws.code.toLowerCase().includes(query) ||
          ws.title.toLowerCase().includes(query) ||
          ws.regulatoryLead.orgCode.toLowerCase().includes(query) ||
          ws.currentStageName?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [project.workstreams, filterState, searchQuery]);

  // Counts for legend
  const stateCounts = useMemo(() => {
    const counts: Partial<Record<OperationalState, number>> = {};
    for (const ws of project.workstreams) {
      counts[ws.operationalState] = (counts[ws.operationalState] || 0) + 1;
    }
    return counts;
  }, [project.workstreams]);

  const legendStates: OperationalState[] = useMemo(() => [
    "running",
    "waiting_applicant",
    "waiting_government",
    "waiting_external",
    "statutory_waiting_period",
    "scheduled_hold",
    "blocked",
    "escalated",
    "complete",
  ], []);

  return (
    <div className="space-y-6">
      {/* Top Banner: Schedule Intelligence Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                {customerSafe ? "Customer-safe project schedule" : "Critical Path Execution Graph & Intelligence"}
              </Badge>
              {(onSelectProject || onSelectWorkstream) ? (
                <button
                  type="button"
                  onClick={() => (onSelectProject ?? onSelectWorkstream)?.("")}
                  className="text-xs font-mono text-slate-500 hover:text-indigo-600 hover:underline cursor-pointer transition-colors"
                  title="Go to project page"
                >
                  {project.code}
                </button>
              ) : (
                <span className="text-xs font-mono text-slate-500">{project.code}</span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900">
              {customerSafe ? "SpaceX project schedule" : "Project Delivery Schedule & Variance Engine"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {customerSafe
                ? "Baseline and forecast dates, dependencies, critical path indicators, and government-owned milestones. Click on any permit or schedule bar to view full details."
                : "Deterministic critical-path dependency graph, traditional schedule bars, immutable baseline tracking, and delay attribution."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center">
              <div className="text-xs font-semibold text-slate-500">Immutable Baseline</div>
              <div className="text-sm font-bold text-slate-900">{project.baselineLaunchDate}</div>
            </div>
            <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-center">
              <div className="text-xs font-semibold text-purple-700">Current Forecast</div>
              <div className="text-sm font-black text-purple-900">{project.currentForecastLaunchDate}</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-center">
              <div className="text-xs font-semibold text-rose-700">Net Project Variance</div>
              <div className="text-base font-black text-rose-900">+{project.scheduleVarianceDays} Days</div>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
          {!customerSafe && (
            <Button
              variant={activeTab === "simulator" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("simulator")}
              className="text-xs gap-1.5 font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Zap className="size-3.5" /> Interactive &quot;What-If&quot; Simulator
            </Button>
          )}
          <Button
            variant={activeTab === "graph" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("graph")}
            className="text-xs gap-1.5"
          >
            <GitBranch className="size-3.5" /> Workstream DAG & Baseline Comparison
          </Button>
          {!customerSafe && (
            <Button
              variant={activeTab === "delays" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("delays")}
              className="text-xs gap-1.5"
            >
              <Clock3 className="size-3.5" /> Delay Taxonomy Attribution
            </Button>
          )}
          {!customerSafe && (
            <Button
              variant={activeTab === "acceleration" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("acceleration")}
              className="text-xs gap-1.5 text-emerald-700"
            >
              <Sparkles className="size-3.5" /> Parallel Acceleration Opportunities ({schedule.accelerationOpportunities.length})
            </Button>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB: WORKSTREAM DAG & TRADITIONAL GANTT SCHEDULE BARS               */}
      {/* ==================================================================== */}
      {activeTab === "graph" && (
        <div className="space-y-6">
          {/* Schedule Controls & Mode Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1 mr-1">
                <Filter className="size-3.5" /> Filter:
              </span>
              <button
                type="button"
                onClick={() => setFilterState("all")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${filterState === "all" ? "bg-[#00284d] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                All Workstreams ({project.workstreams.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterState("critical")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 ${filterState === "critical" ? "bg-purple-800 text-white" : "bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100"}`}
              >
                <Flame className="size-3 text-amber-400 fill-amber-400" /> Critical Path ({project.workstreams.filter((w) => w.isCriticalPath).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterState("delayed")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 ${filterState === "delayed" ? "bg-rose-800 text-white" : "bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100"}`}
              >
                <AlertTriangle className="size-3 text-rose-600" /> Variances / Blocked ({project.workstreams.filter((w) => w.scheduleVarianceDays > 0 || w.operationalState === "blocked").length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setScheduleViewMode("bars")}
                  className={`rounded px-2.5 py-1 text-xs font-bold transition flex items-center gap-1.5 ${scheduleViewMode === "bars" ? "bg-[#00284d] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  <Calendar className="size-3.5" /> Gantt Schedule Bars
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleViewMode("table")}
                  className={`rounded px-2.5 py-1 text-xs font-bold transition flex items-center gap-1.5 ${scheduleViewMode === "table" ? "bg-[#00284d] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  <GitBranch className="size-3.5" /> DAG Metrics Table
                </button>
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search permit or agency..."
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* ================================================================ */}
          {/* OPERATIONAL STATE COLOR CODE LEGEND                              */}
          {/* ================================================================ */}
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#00284d] text-white text-[10px] font-black">i</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Gantt Schedule Bar State Legend & Visual Code
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                Click any bar or workstream row to open permit details
              </span>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-600" aria-label="Timeline horizons">
                <span className="rounded border border-dashed border-slate-400 bg-slate-100 px-2 py-1">Past / baseline history</span>
                <span className="rounded border border-emerald-600 bg-emerald-500 px-2 py-1 text-white">Current state as of today</span>
                <span className="rounded border border-dashed border-indigo-500 bg-indigo-100 px-2 py-1 text-indigo-900">Future forecast</span>
              </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5">
              {legendStates.map((state) => {
                const config = STATE_COLOR_MAP[state];
                const count = stateCounts[state] || 0;
                const isSelected = filterState === state;
                return (
                  <button
                    key={state}
                    type="button"
                    onClick={() => setFilterState(isSelected ? "all" : state)}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-left transition ${
                      isSelected
                        ? "border-teal-700 bg-teal-50/80 ring-2 ring-teal-600"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    title={`${config.label}: ${config.description}`}
                  >
                    <span className={`size-3 rounded-full shrink-0 ${config.dotColor} ring-2 ring-white shadow-sm`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-slate-800">{config.shortLabel}</div>
                      <div className="text-[10px] text-slate-500 font-semibold">{count} workstream{count !== 1 ? "s" : ""}</div>
                    </div>
                  </button>
                );
              })}

              {/* Baseline indicator representation */}
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-2">
                <span className="h-2 w-4 rounded-sm border border-slate-400 bg-slate-200 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-700">Baseline Target</div>
                  <div className="text-[10px] text-slate-500 font-semibold">Contractual Window</div>
                </div>
              </div>

              {/* Today line indicator */}
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/50 p-2">
                <span className="h-3 w-1 rounded-full bg-red-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-red-950">Today (Aug 30)</div>
                  <div className="text-[10px] text-red-700 font-semibold">Current Standup As-Of</div>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* TRADITIONAL GANTT SCHEDULE TIMELINE CHART                        */}
          {/* ================================================================ */}
          {scheduleViewMode === "bars" && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {/* Timeline Header Row */}
              <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-100/90 text-xs font-bold text-slate-700">
                {/* Left Column: Workstream Header */}
                <div className="col-span-12 md:col-span-4 p-3 border-r border-slate-200 flex items-center justify-between">
                  <span className="font-black uppercase tracking-wider text-slate-700">Workstream / Project</span>
                  <span className="text-[11px] font-semibold text-slate-500">Lead Agency & State</span>
                </div>

                {/* Right Column: Timeline Months Grid */}
                <div className="hidden md:col-span-8 md:grid grid-cols-10 relative py-2.5">
                  {months.map((month) => (
                    <div
                      key={month.label}
                      className={`text-center text-[11px] font-bold uppercase tracking-wider border-r border-slate-200 last:border-0 ${
                        month.isCurrent ? "text-red-700 bg-red-50/60 font-black" : "text-slate-600"
                      }`}
                    >
                      {month.label}
                    </div>
                  ))}

                  {/* Vertical "Today" line marker in header */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-600 z-10 pointer-events-none"
                    style={{ left: `${todayPositionPercent}%` }}
                  >
                    <span className="absolute -top-1 -translate-x-1/2 rounded bg-red-600 px-1 py-0.5 text-[9px] font-black uppercase text-white shadow">
                      Today
                    </span>
                  </div>
                </div>
              </div>

              {/* Workstream Gantt Rows */}
              <div className="divide-y divide-slate-100">
                {filteredWorkstreams.map((ws) => {
                  const stateConfig = STATE_COLOR_MAP[ws.operationalState] || STATE_COLOR_MAP.running;
                  const isHovered = hoveredWorkstreamId === ws.id;

                  // Baseline coordinates
                  const baselineLeft = getTimelinePosition(ws.baselineStartDate);

                  // Forecast coordinates
                  const forecastLeft = getTimelinePosition(ws.forecastStartDate);
                  const forecastRight = getTimelinePosition(ws.forecastTargetDate);

                  const hasSlip = ws.scheduleVarianceDays > 0;
                  const currentStart = getTimelinePosition(ws.actualStartDate ?? ws.forecastStartDate ?? ws.baselineStartDate);
                  const currentEnd = ws.operationalState === "complete"
                    ? getTimelinePosition(ws.actualCompletionDate ?? ws.forecastTargetDate)
                    : todayPositionPercent;
                  const pastEnd = Math.min(todayPositionPercent, currentStart);
                  const futureStart = ws.operationalState === "complete" ? forecastRight : Math.max(todayPositionPercent, forecastLeft);
                  const pastWidth = Math.max(1.5, pastEnd - baselineLeft);
                  const currentWidth = Math.max(1.5, currentEnd - currentStart);
                  const futureWidth = ws.operationalState === "complete" ? 0 : Math.max(1.5, forecastRight - futureStart);

                  return (
                    <div
                      key={ws.id}
                      onMouseEnter={() => setHoveredWorkstreamId(ws.id)}
                      onMouseLeave={() => setHoveredWorkstreamId(null)}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectWorkstream?.(ws.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectWorkstream?.(ws.id);
                        }
                      }}
                      className={`grid grid-cols-12 items-center transition-colors cursor-pointer ${
                        isHovered ? "bg-slate-50/90" : "hover:bg-slate-50/60"
                      }`}
                      title={`Click to open ${ws.title} (${ws.code}) details page`}
                    >
                      {/* Left Meta Column */}
                      <div className="col-span-12 md:col-span-4 p-3.5 border-r border-slate-200">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                              {ws.code}
                            </span>
                            {ws.isCriticalPath && (
                              <Badge className="bg-purple-100 text-purple-900 border-purple-200 text-[10px] py-0 font-bold flex items-center gap-0.5">
                                <Flame className="size-3 text-amber-500 fill-amber-500" /> Critical Path
                              </Badge>
                            )}
                          </div>

                          <Badge variant="outline" className="font-bold text-[11px] shrink-0">
                            {ws.regulatoryLead.orgCode}
                          </Badge>
                        </div>

                        {/* Workstream Title & Link */}
                        <div className="mt-1 flex items-center justify-between group">
                          <span className="font-bold text-slate-900 text-sm group-hover:text-teal-800 transition line-clamp-1">
                            {ws.title}
                          </span>
                          <ExternalLink className="size-3 text-slate-400 group-hover:text-teal-700 shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition" />
                        </div>

                        {/* Current Stage & State Badge */}
                        <div className="mt-1.5 flex items-center justify-between gap-2 flex-wrap text-xs">
                          <span className="text-slate-500 truncate max-w-[200px]">
                            {ws.currentStageName || "Technical Review"}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${stateConfig.badgeBg} ${stateConfig.badgeText}`}>
                            <span className={`size-1.5 rounded-full ${stateConfig.dotColor}`} />
                            {stateConfig.shortLabel}
                          </span>
                        </div>
                      </div>

                      {/* Right Timeline Column with Traditional Bars */}
                      <div className="col-span-12 md:col-span-8 p-3 relative h-[112px] flex flex-col justify-center overflow-hidden">
                        {/* Background monthly grid lines */}
                        <div className="absolute inset-0 grid grid-cols-10 pointer-events-none opacity-20">
                          {months.map((m) => (
                            <div key={m.label} className="border-r border-slate-300 h-full last:border-0" />
                          ))}
                        </div>

                        {/* Vertical "Today" line marker across row */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 z-10 pointer-events-none"
                          style={{ left: `${todayPositionPercent}%` }}
                        />

                        {/* Past / baseline history */}
                        <div className="relative w-full h-5 mb-1">
                          <div
                            className="absolute h-3.5 rounded border border-dashed border-slate-400 bg-slate-100/90 flex items-center px-1.5 text-[9px] font-mono text-slate-600 truncate transition-all"
                            style={{
                              left: `${baselineLeft}%`,
                              width: `${pastWidth}%`,
                            }}
                            title={`Baseline Schedule: ${ws.baselineStartDate} → ${ws.baselineTargetDate}`}
                          >
                            <span className="truncate opacity-80">Past / Baseline: {ws.baselineStartDate}</span>
                          </div>
                        </div>

                        {/* Current state / actual execution */}
                        <div className="relative w-full h-6 mb-1">
                          <div
                            className={`absolute h-6 rounded-md shadow-sm border ${stateConfig.barBorder} ${stateConfig.barColor} ${stateConfig.textColor} flex items-center justify-between px-2.5 text-xs font-bold transition-all transform hover:scale-[1.01] hover:shadow-md cursor-pointer`}
                            style={{
                              left: `${currentStart}%`,
                              width: `${currentWidth}%`,
                            }}
                            title={`${ws.title} (${ws.code})\nState: ${stateConfig.label}\nForecast: ${ws.forecastStartDate} → ${ws.forecastTargetDate} (${hasSlip ? `+${ws.scheduleVarianceDays}d variance` : "On Track"})\nReviewer: ${ws.regulatoryLead.assignedReviewerName} (${ws.regulatoryLead.orgCode})`}
                          >
                            <span className="truncate text-[10px] font-black drop-shadow-sm">Current: {stateConfig.shortLabel}</span>

                            {hasSlip && (
                              <span className="shrink-0 rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-mono font-black text-white ml-1">
                                +{ws.scheduleVarianceDays}d
                              </span>
                            )}
                          </div>

                        </div>

                        {/* Future state / forecast */}
                        <div className="relative w-full h-5">
                          <div
                            className={`absolute h-4 rounded-md border border-dashed ${stateConfig.barBorder} ${stateConfig.barColor} ${stateConfig.textColor} opacity-60 flex items-center px-2 text-[9px] font-bold ${futureWidth === 0 ? "hidden" : ""}`}
                            style={{ left: `${futureStart}%`, width: `${futureWidth}%` }}
                            title={`Future forecast: ${ws.forecastStartDate} -> ${ws.forecastTargetDate}${hasSlip ? ` (+${ws.scheduleVarianceDays}d variance)` : ""}`}
                          >
                            <span className="truncate">Future: {ws.forecastTargetDate}</span>
                          </div>

                          {/* Forecast Target Marker / Flag */}
                          <div
                            className="absolute top-0 text-[9px] font-mono font-black text-slate-800"
                            style={{ left: `calc(${forecastRight}% + 6px)` }}
                          >
                            {ws.forecastTargetDate}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredWorkstreams.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    <p className="font-bold">No workstreams match the selected filter or search query.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setFilterState("all"); setSearchQuery(""); }}
                      className="mt-3 text-xs font-bold"
                    >
                      Reset Filters
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* 12-COLUMN WORKSTREAM DAG & BASELINE COMPARISON TABLE             */}
          {/* ================================================================ */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="grid grid-cols-12 text-xs font-bold uppercase tracking-wider text-slate-600">
                <div className="col-span-4">Workstream / DAG Node</div>
                <div className="col-span-2 text-center">Lead Agency</div>
                <div className="col-span-2 text-center">Baseline Target</div>
                <div className="col-span-2 text-center">Current Forecast</div>
                <div className="col-span-2 text-right">Variance & Controlling Path</div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredWorkstreams.map((ws) => (
                <div
                  key={ws.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${ws.title}`}
                  onClick={() => onSelectWorkstream?.(ws.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectWorkstream?.(ws.id);
                    }
                  }}
                  className="grid grid-cols-12 items-center px-4 py-3.5 hover:bg-slate-50/80 transition-colors text-sm cursor-pointer"
                >
                  <div className="col-span-4 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400 font-bold">{ws.code}</span>
                      {ws.isCriticalPath && (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] py-0">
                          Critical Path
                        </Badge>
                      )}
                    </div>
                    <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1 group">
                      <span>{ws.title}</span>
                      <ArrowRight className="size-3 text-slate-400 group-hover:text-teal-700" />
                    </div>
                    <div className="text-xs text-slate-500">{ws.currentStageName}</div>
                  </div>

                  <div className="col-span-2 text-center">
                    <Badge variant="outline" className="font-semibold">
                      {ws.regulatoryLead.orgCode}
                    </Badge>
                  </div>

                  <div className="col-span-2 text-center text-xs font-mono text-slate-600">
                    {ws.baselineTargetDate}
                  </div>

                  <div className="col-span-2 text-center text-xs font-mono font-bold text-slate-900">
                    {ws.forecastTargetDate}
                  </div>

                  <div className="col-span-2 text-right">
                    {ws.scheduleVarianceDays > 0 ? (
                      <span className="inline-block font-mono font-bold text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                        +{ws.scheduleVarianceDays}d slip
                      </span>
                    ) : (
                      <span className="inline-block font-mono font-bold text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        On Schedule
                      </span>
                    )}
                    {ws.controllingDependencyTitle && (
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        Controlling: {ws.controllingDependencyTitle}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB: INTERACTIVE SCHEDULE SIMULATOR (GOVERNMENT)                    */}
      {/* ==================================================================== */}
      {!customerSafe && activeTab === "simulator" && (
        <InteractiveScheduleSimulator />
      )}

      {/* ==================================================================== */}
      {/* TAB: DELAY TAXONOMY ATTRIBUTION (GOVERNMENT)                         */}
      {/* ==================================================================== */}
      {!customerSafe && activeTab === "delays" && (
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">
              Schedule Variance Taxonomy Attribution
            </CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Statutory, legal, and operational breakdown explaining why schedule movement occurred. Defensible project controls record.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-700">Interagency Coordination Dependencies</span>
                  <span className="font-mono text-rose-600">13 days (46%)</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-full w-[46%]" />
                </div>
                <p className="text-[11px] text-slate-500">
                  Driven by DOTD waiting on CPRA drainage concurrence (CR-00451) for LA-82 culverts.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-700">Statutory Minimum Notice Periods</span>
                  <span className="font-mono text-indigo-600">7 days (25%)</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full w-[25%]" />
                </div>
                <p className="text-[11px] text-slate-500">
                  Statutory 30-day federal Section 404 public comment publication alignment.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-700">Public Hearing Comment Response</span>
                  <span className="font-mono text-amber-600">8 days (29%)</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full w-[29%]" />
                </div>
                <p className="text-[11px] text-slate-500">
                  LDEQ deluge retention basin 15-day post-hearing public comment resolution window.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-700">Engineering Revisions & Drawing Packages</span>
                  <span className="font-mono text-emerald-600">0 days (absorbed)</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[5%]" />
                </div>
                <p className="text-[11px] text-slate-500">
                  SpaceX engineering turnaround completed within float buffer without critical-path slip.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================================================================== */}
      {/* TAB: PARALLEL ACCELERATION OPPORTUNITIES (GOVERNMENT)                */}
      {/* ==================================================================== */}
      {!customerSafe && activeTab === "acceleration" && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                AI Schedule Optimization
              </Badge>
            </div>
            <CardTitle className="text-lg font-bold text-slate-900 mt-1">
              Parallel Review Acceleration Opportunities
            </CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Steps traditionally performed sequentially that legally and technically can proceed concurrently.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {schedule.accelerationOpportunities.map((opp) => (
              <div key={opp.workstreamId} className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">{opp.title}</h3>
                  <Badge className="bg-emerald-600 text-white font-bold text-xs">
                    Save up to {opp.potentialDaysSaved} Days
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {opp.explanation}
                </p>
                <div className="pt-2 flex justify-end">
                  <Button type="button" size="sm" disabled title="Concurrent review authorization is recorded through the governed project workflow." className="bg-slate-300 text-slate-600 text-xs font-bold shadow-none">
                    Authorize Concurrent Review Track
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
