"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  Filter,
  Flame,
  GitBranch,
  Layers,
  List,
  Sparkles,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFullProjectRecord } from "@/lib/permit-utils";
import { repository } from "@/lib/repository";
import { evaluateProjectSchedule } from "@/lib/engines/schedule-engine";
import type { OperationalState, ProjectRecord, TaskRecord } from "@/lib/domain-models";
import { asOfDateTime } from "@/lib/time";
import { buildWorkflowJourney } from "@/lib/workflow-journey";
import { InteractiveScheduleSimulator } from "./InteractiveScheduleSimulator";

function displayDate(value?: string) {
  if (!value) return "Not scheduled";
  const date = new Date(`${value.length === 10 ? `${value}T12:00:00` : value}`);
  return Number.isNaN(date.valueOf()) ? "Not scheduled" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

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

const STAGE_COLOR_CLASSES = [
  "bg-sky-500 border-sky-700 text-white",
  "bg-teal-500 border-teal-700 text-white",
  "bg-violet-500 border-violet-700 text-white",
  "bg-amber-400 border-amber-600 text-slate-950",
  "bg-rose-500 border-rose-700 text-white",
];

export function WorkstreamGraphGantt({
  customerSafe = false,
  onSelectWorkstream,
  onSelectProject,
  onSelectTask,
  project: projectOverride,
  asOfDate,
  focusedWorkstreamId,
  focusedPhase,
}: {
  customerSafe?: boolean;
  onSelectWorkstream?: (workstreamId: string) => void;
  onSelectProject?: (workstreamId?: string) => void;
  onSelectTask?: (taskId: string) => void;
  project?: ProjectRecord;
  asOfDate?: string | Date;
  focusedWorkstreamId?: string;
  focusedPhase?: string;
}) {
  const project = projectOverride ?? getFullProjectRecord();
  const schedule = evaluateProjectSchedule(project.workstreams);
  const [activeTab, setActiveTab] = useState<"graph" | "advanced">("graph");
  const [advancedSection, setAdvancedSection] = useState<"simulator" | "delays" | "acceleration">("simulator");
  const [scheduleViewMode, setScheduleViewMode] = useState<"bars" | "list" | "table">("bars");
  const [filterState, setFilterState] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hoveredWorkstreamId, setHoveredWorkstreamId] = useState<string | null>(null);
  // The schedule is stage-first: each persisted workflow stage is visible on
  // first render, while the control still lets a user collapse a workstream's
  // detail lanes when they need a shorter view.
  const [expandedWorkstreamIds, setExpandedWorkstreamIds] = useState<Set<string>>(
    () => new Set(project.workstreams.map((workstream) => workstream.id)),
  );
  const [zoom, setZoom] = useState<"day" | "week" | "month">("week");
  const [fitProject, setFitProject] = useState(false);
  const todayDate = useMemo(() => asOfDateTime(asOfDate), [asOfDate]);

  useEffect(() => {
    if (!focusedPhase || !focusedWorkstreamId) return;
    const frame = window.requestAnimationFrame(() => {
      setExpandedWorkstreamIds((previous) => {
        const next = new Set(previous);
        next.add(focusedWorkstreamId);
        return next;
      });
      window.requestAnimationFrame(() => {
        document.getElementById(`phase-${encodeURIComponent(focusedPhase)}`)?.scrollIntoView({ block: "center", behavior: "auto" });
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedPhase, focusedWorkstreamId]);

  function openWorkstream(workstream: ProjectRecord["workstreams"][number]) {
    if (onSelectWorkstream) {
      onSelectWorkstream(workstream.id);
      return;
    }

    if (typeof window !== "undefined") {
      window.location.assign(`/workstreams/${encodeURIComponent(workstream.code || workstream.id)}`);
    }
  }

  const toggleExpand = (wsId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedWorkstreamIds((prev) => {
      const next = new Set(prev);
      if (next.has(wsId)) next.delete(wsId);
      else next.add(wsId);
      return next;
    });
  };

  // Timeline boundaries include the earliest baseline work and the current forecast.
  const timelineStart = useMemo(() => {
    const dates = [project.baselineLaunchDate, ...project.workstreams.flatMap((ws) => [ws.baselineStartDate, ws.baselineTargetDate])]
      .filter(Boolean)
      .map((value) => new Date(`${value}T00:00:00Z`).getTime());
    const earliest = Math.min(...dates);
    return new Date(Number.isFinite(earliest) ? earliest : todayDate.getTime());
  }, [project, todayDate]);

  const timelineEnd = useMemo(() => {
    const dates = [project.currentForecastLaunchDate, ...project.workstreams.flatMap((ws) => [ws.forecastTargetDate, ws.baselineTargetDate])]
      .filter(Boolean)
      .map((value) => new Date(`${value}T23:59:59Z`).getTime());
    const latest = Math.max(...dates);
    return new Date(Number.isFinite(latest) ? latest : todayDate.getTime());
  }, [project, todayDate]);

  const totalTimelineDays = useMemo(() => {
    return Math.max(1, Math.round((timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));
  }, [timelineStart, timelineEnd]);

  // Today marker is injected for deterministic tests and defaults to the current date.
  const todayPositionPercent = useMemo(() => {
    const elapsed = (todayDate.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.min(100, (elapsed / totalTimelineDays) * 100));
  }, [todayDate, timelineStart, totalTimelineDays]);

  // The chart fits its selected range in the available plot. Today is a visual
  // marker, not an instruction to scroll a hidden internal viewport.
  const todayDisplayPercent = fitProject ? todayPositionPercent : 30;

  // Month segments are derived from the actual persisted schedule range
  const months = useMemo(() => {
    const segments: Array<{ label: string; days: number; isCurrent: boolean }> = [];
    const cursor = new Date(Date.UTC(timelineStart.getUTCFullYear(), timelineStart.getUTCMonth(), 1));
    const end = timelineEnd.getTime();
    const formatter = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    while (cursor.getTime() <= end) {
      const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      const visibleStart = Math.max(timelineStart.getTime(), cursor.getTime());
      const visibleEnd = Math.min(end, monthEnd.getTime());
      segments.push({
        label: formatter.format(cursor),
        days: Math.max(1, Math.ceil((visibleEnd - visibleStart) / (1000 * 60 * 60 * 24))),
        isCurrent: cursor.getUTCFullYear() === todayDate.getUTCFullYear() && cursor.getUTCMonth() === todayDate.getUTCMonth(),
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return segments;
  }, [timelineStart, timelineEnd, todayDate]);

  const monthGridTemplate = months.map((month) => `${month.days}fr`).join(" ");

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

  // Chronological list projection for mobile and screen readers
  const chronologicalItems = useMemo(() => {
    interface ChronoRow {
      id: string;
      workstreamId: string;
      workstreamCode: string;
      workstreamTitle: string;
      taskTitle?: string;
      taskId?: string;
      agency: string;
      dateLabel: string;
      sortTime: number;
      isScheduled: boolean;
      state: OperationalState;
      stateLabel: string;
      isCriticalPath: boolean;
      varianceDays: number;
      canonicalHref: string;
    }

    const items: ChronoRow[] = [];

    for (const ws of filteredWorkstreams) {
      const wsDate = ws.actualCompletionDate ?? ws.forecastTargetDate ?? ws.baselineTargetDate;
      const wsTime = wsDate ? new Date(wsDate).getTime() : Infinity;
      items.push({
        id: `ws-${ws.id}`,
        workstreamId: ws.id,
        workstreamCode: ws.code,
        workstreamTitle: ws.title,
        agency: ws.regulatoryLead.orgCode,
        dateLabel: wsDate ? displayDate(wsDate) : "Not scheduled",
        sortTime: Number.isFinite(wsTime) ? wsTime : Infinity,
        isScheduled: Boolean(wsDate),
        state: ws.operationalState,
        stateLabel: ws.operationalStateLabel || ws.operationalState,
        isCriticalPath: ws.isCriticalPath,
        varianceDays: ws.scheduleVarianceDays,
        canonicalHref: `/workstreams/${encodeURIComponent(ws.code || ws.id)}`,
      });

      if (ws.tasks) {
        for (const task of ws.tasks) {
          const taskDate = task.actualCompletionDate ?? task.forecastDueDate ?? task.baselineDueDate;
          const taskTime = taskDate ? new Date(taskDate).getTime() : Infinity;
          const taskState: OperationalState = task.status === "completed"
            ? "complete"
            : task.status === "blocked"
              ? "blocked"
              : task.status === "in_progress"
                ? "running"
                : task.status === "waiting"
                  ? "waiting_applicant"
                  : "scheduled_hold";
          items.push({
            id: `task-${task.id}`,
            workstreamId: ws.id,
            workstreamCode: ws.code,
            workstreamTitle: ws.title,
            taskTitle: task.title,
            taskId: task.id,
            agency: task.assignedOrgCode || ws.regulatoryLead.orgCode,
            dateLabel: taskDate ? displayDate(taskDate) : "Not scheduled",
            sortTime: Number.isFinite(taskTime) ? taskTime : Infinity,
            isScheduled: Boolean(taskDate),
            state: taskState,
            stateLabel: task.status.replace("_", " "),
            isCriticalPath: task.isCriticalPath,
            varianceDays: 0,
            canonicalHref: `/work/task/${encodeURIComponent(task.id)}`,
          });
        }
      }
    }

    return items.sort((a, b) => a.sortTime - b.sortTime);
  }, [filteredWorkstreams]);

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
              {customerSafe ? "SpaceX project schedule" : "Project Delivery Schedule & Schedule analysis"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {customerSafe
                ? "Baseline and forecast dates, related schedule items, timeline health, and government-owned milestones. Click on any permit or schedule bar to view full details."
                : "Deterministic critical-path dependency graph, traditional schedule bars, immutable baseline tracking, and delay attribution."}
            </p>
          </div>

          <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-3">
            <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-left sm:w-auto sm:text-center">
              <div className="text-xs font-semibold text-slate-500">Immutable Baseline</div>
              <div className="text-sm font-bold text-slate-900">{displayDate(project.baselineLaunchDate)}</div>
            </div>
            <div className="w-full rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-left sm:w-auto sm:text-center">
              <div className="text-xs font-semibold text-purple-700">Current Forecast</div>
              <div className="text-sm font-black text-purple-900">{displayDate(project.currentForecastLaunchDate)}</div>
            </div>
            <div className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-left sm:w-auto sm:text-center">
              <div className="text-xs font-semibold text-rose-700">Net Project Variance</div>
              <div className="text-base font-black text-rose-900">+{project.scheduleVarianceDays} Days</div>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div role="tablist" aria-label="Schedule views" className="mt-6 grid gap-2 border-b border-slate-200 pb-2 sm:flex sm:flex-wrap sm:items-center">
          <Button
            id="schedule-tab-graph"
            role="tab"
            aria-selected={activeTab === "graph"}
            aria-controls="schedule-panel-graph"
            variant={activeTab === "graph" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("graph")}
            className="w-full justify-start whitespace-normal text-left text-xs sm:w-auto font-bold"
          >
            <GitBranch className="size-3.5" /> {customerSafe ? "Project timeline & baseline" : "Workstream DAG & Baseline Comparison"}
          </Button>
          {!customerSafe && (
            <Button
              id="schedule-tab-advanced"
              role="tab"
              aria-selected={activeTab === "advanced"}
              aria-controls="schedule-panel-advanced"
              variant={activeTab === "advanced" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("advanced")}
              className="w-full justify-start whitespace-normal text-left text-xs font-bold sm:w-auto text-indigo-700 hover:text-indigo-800"
              title="Advanced Analysis (Delay Taxonomy Attribution, Parallel Acceleration Opportunities)"
            >
              <Zap className="size-3.5" /> Advanced Analysis
              <span className="sr-only"> (Delay Taxonomy Attribution, Parallel Acceleration Opportunities)</span>
            </Button>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB: WORKSTREAM DAG & SCHEDULE TIMELINE                              */}
      {/* ==================================================================== */}
      {activeTab === "graph" && (
        <div id="schedule-panel-graph" role="tabpanel" aria-labelledby="schedule-tab-graph" tabIndex={0} className="space-y-6">
          {/* Schedule Controls & Mode Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1 mr-1">
                <Filter className="size-3.5" /> Filter:
              </span>
              <button
                type="button"
                aria-pressed={filterState === "all"}
                onClick={() => setFilterState("all")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${filterState === "all" ? "bg-[#00284d] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                All Workstreams ({project.workstreams.length})
              </button>
              <button
                type="button"
                aria-pressed={filterState === "critical"}
                onClick={() => setFilterState("critical")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 ${filterState === "critical" ? "bg-purple-800 text-white" : "bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100"}`}
              >
                <Flame className="size-3 text-amber-400 fill-amber-400" /> {customerSafe ? "Priority sequence" : "Critical Path"} ({project.workstreams.filter((w) => w.isCriticalPath).length})
              </button>
              <button
                type="button"
                aria-pressed={filterState === "delayed"}
                onClick={() => setFilterState("delayed")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 ${filterState === "delayed" ? "bg-rose-800 text-white" : "bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100"}`}
              >
                <AlertTriangle className="size-3 text-rose-600" /> Variances / Blocked ({project.workstreams.filter((w) => w.scheduleVarianceDays > 0 || w.operationalState === "blocked").length})
              </button>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
              <div className="flex w-full items-center rounded-lg border border-slate-200 bg-slate-50 p-1 sm:w-auto">
                <button
                  type="button"
                  aria-pressed={scheduleViewMode === "bars"}
                  onClick={() => setScheduleViewMode("bars")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2.5 py-1 text-center text-xs font-bold transition whitespace-normal sm:flex-none ${scheduleViewMode === "bars" ? "bg-[#00284d] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  <Calendar className="size-3.5" /> Gantt Schedule Bars
                </button>
                <button
                  type="button"
                  aria-pressed={scheduleViewMode === "list"}
                  onClick={() => setScheduleViewMode("list")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2.5 py-1 text-center text-xs font-bold transition whitespace-normal sm:flex-none ${scheduleViewMode === "list" ? "bg-[#00284d] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  <List className="size-3.5" /> Chronological List
                </button>
                <button
                  type="button"
                  aria-pressed={scheduleViewMode === "table"}
                  onClick={() => setScheduleViewMode("table")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2.5 py-1 text-center text-xs font-bold transition whitespace-normal sm:flex-none ${scheduleViewMode === "table" ? "bg-[#00284d] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  <GitBranch className="size-3.5" /> {customerSafe ? "Schedule metrics" : "DAG Metrics Table"}
                </button>
              </div>

              <input
                type="text"
                aria-label="Search schedule"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search permit or agency..."
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none sm:w-auto sm:py-1.5"
              />
              <div className="grid w-full grid-cols-2 gap-1 sm:flex sm:w-auto" aria-label="Schedule controls">
                <Button type="button" variant="outline" size="sm" onClick={() => { setZoom("day"); setFitProject(false); }} aria-pressed={zoom === "day"}>Day</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { setZoom("week"); setFitProject(false); }} aria-pressed={zoom === "week"}>Week</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { setZoom("month"); setFitProject(false); }} aria-pressed={zoom === "month"}>Month</Button>
                <Button
                  type="button"
                  variant={fitProject ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFitProject(true);
                  }}
                >
                  Fit project
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFitProject(false);
                  }}
                >Today</Button>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* OPERATIONAL STATE COLOR CODE LEGEND                              */}
          {/* ================================================================ */}
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
            <div className="flex flex-col items-start gap-2 border-b border-slate-200 pb-2.5 mb-3 sm:flex-row sm:items-center sm:justify-between">
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
                    aria-pressed={isSelected}
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
                  <div className="truncate text-xs font-bold text-red-950">Today ({todayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })})</div>
                  <div className="text-[10px] text-red-700 font-semibold">Current Standup As-Of</div>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* CHRONOLOGICAL LIST VIEW (MOBILE & SCREEN READER SAFE)             */}
          {/* ================================================================ */}
          <div
            className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 ${
              scheduleViewMode === "list" ? "block" : "block md:hidden"
            }`}
            role="list"
            aria-label="Chronological schedule list"
          >
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-sm font-black text-slate-900">Chronological Schedule Events</h3>
                <p className="text-xs text-slate-500">Accessible sequence ordered by target milestones and forecast dates. Usable on all devices without horizontal overflow.</p>
              </div>

              {chronologicalItems.map((item) => {
                const config = STATE_COLOR_MAP[item.state] || STATE_COLOR_MAP.running;
                return (
                  <div
                    key={item.id}
                    role="listitem"
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/80 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-mono font-bold text-slate-500">{item.workstreamCode}</span>
                        <Badge variant="outline" className="text-[10px] font-bold">{item.agency}</Badge>
                        {item.isCriticalPath && (
                          <Badge className="bg-purple-100 text-purple-900 border-purple-200 text-[10px] py-0 font-bold flex items-center gap-0.5">
                            <Flame className="size-2.5 text-amber-500 fill-amber-500" /> Critical
                          </Badge>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${config.badgeBg} ${config.badgeText}`}>
                          <span className={`size-1.5 rounded-full ${config.dotColor}`} />
                          {item.stateLabel}
                        </span>
                      </div>

                      <div className="mt-1">
                        <Link
                          href={item.canonicalHref}
                          className="font-bold text-slate-900 text-sm hover:text-teal-800 hover:underline inline-flex items-center gap-1"
                        >
                          {item.taskTitle ? `${item.workstreamTitle} → ${item.taskTitle}` : item.workstreamTitle}
                          <ExternalLink className="size-3 text-slate-400 shrink-0" />
                        </Link>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-center shrink-0 text-xs">
                      <span className="font-mono font-bold text-slate-700">
                        {item.isScheduled ? item.dateLabel : <span className="text-slate-400 italic">Not scheduled</span>}
                      </span>
                      {!item.isScheduled && (
                        <Link href="/admin/workflows" className="text-[10px] text-teal-700 hover:underline font-bold">
                          Configure
                        </Link>
                      )}
                      {item.varianceDays > 0 && (
                        <span className="font-mono text-rose-600 font-bold text-[10px]">
                          +{item.varianceDays}d slip
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {chronologicalItems.length === 0 && (
                <div className="p-6 text-center text-slate-500 text-xs font-bold">
                  No schedule items found.
                </div>
              )}
            </div>

          {/* ================================================================ */}
          {/* TRADITIONAL GANTT SCHEDULE TIMELINE CHART                        */}
          {/* ================================================================ */}
          <div className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${scheduleViewMode === "bars" ? "hidden md:block" : "hidden"}`}>
              <div tabIndex={0} aria-label="Gantt schedule timeline">
                  {/* Timeline Header Row */}
                  <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-100/90 text-xs font-bold text-slate-700">
                    {/* Left Column: Workstream Header */}
                    <div className="col-span-12 md:col-span-4 p-3 border-r border-slate-200 flex items-center justify-between">
                      <span className="font-black uppercase tracking-wider text-slate-700">Workstream / Project</span>
                      <span className="text-[11px] font-semibold text-slate-500">Lead Agency & State</span>
                    </div>

                    {/* Right Column: Timeline Months Grid */}
                    <div className="hidden md:col-span-8 md:grid relative py-3" style={{ gridTemplateColumns: monthGridTemplate }}>
                      {months.map((month) => (
                        <div
                          key={month.label}
                          className={`text-center text-sm font-bold uppercase tracking-wider border-r border-slate-200 last:border-0 ${
                            month.isCurrent ? "text-red-700 bg-red-50/60 font-black" : "text-slate-600"
                          }`}
                        >
                          {month.label}
                        </div>
                      ))}

                      {/* Vertical "Today" line marker in header */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-600 z-10 pointer-events-none"
                        style={{ left: `${todayDisplayPercent}%` }}
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
                      const isExpanded = expandedWorkstreamIds.has(ws.id);

                      // Forecast coordinates
                      const forecastLeft = getTimelinePosition(ws.forecastStartDate);
                      const forecastRight = getTimelinePosition(ws.forecastTargetDate);

                      const hasSlip = ws.scheduleVarianceDays > 0;
                      const workflowTemplates = repository.getWorkflowTemplates();
                      const workflowTemplate = workflowTemplates.find((template) => template.permitTypeId === ws.permitTypeId);
                      const workflowVersion = ws.workflowVersionId
                        ? workflowTemplates.flatMap((template) => template.versions).find((version) => version.id === ws.workflowVersionId)
                        : workflowTemplate?.versions.find((version) => version.status === "published") ?? workflowTemplate?.versions[0];
                      const workflowStages = workflowVersion?.stages ?? [];
                      const journey = buildWorkflowJourney({ ...ws, stages: workflowStages, tasks: ws.tasks, stageRuns: ws.stageRuns }, workflowTemplates);
                      const stageRows = workflowStages.map((stage, index) => {
                        const stageRun = (ws.stageRuns ?? []).find((run) => run.stageId === stage.id || run.stageKey === stage.stageKey);
                        const stageJourney = journey.stages.find((candidate) => candidate.id === stage.id);
                        const stageTasks = ws.tasks.filter((task) => task.stageId === stage.id || task.stageId === stage.stageKey);
                        const stageStartDates = stageTasks.flatMap((task) => [task.forecastStartDate, task.baselineStartDate].filter(Boolean) as string[]).sort();
                        const stageEndDates = stageTasks.flatMap((task) => [task.actualCompletionDate, task.forecastDueDate, task.baselineDueDate].filter(Boolean) as string[]).sort();
                        const stageStart = stageRun?.startedAt?.slice(0, 10) ?? stageStartDates[0];
                        const stageEnd = stageRun?.completedAt?.slice(0, 10) ?? stageEndDates[stageEndDates.length - 1];
                        const hasStageDates = Boolean(stageStart && stageEnd);
                        const stageLeft = hasStageDates ? getTimelinePosition(stageStart) : 0;
                        const stageRight = hasStageDates ? getTimelinePosition(stageEnd) : 0;
                        const stageWidth = Math.max(1.5, stageRight - stageLeft);
                        const stageState = stageJourney?.state === "completed" ? "Completed" : stageJourney?.state === "blocked" ? "Blocked" : stageJourney?.state === "waiting" ? "Waiting" : stageJourney?.state === "current" ? "Current" : stageJourney?.state === "not_recorded" ? "Not recorded" : stageJourney?.state === "waived" ? "Waived" : "Upcoming";
                        return { stage, index, stageJourney, stageStart, stageEnd, hasStageDates, stageLeft, stageWidth, stageState };
                      });

                      return (
                        <div key={ws.id} className="divide-y divide-slate-50">
                          {/* Top-Level Workstream Row */}
                          <div
                            onMouseEnter={() => setHoveredWorkstreamId(ws.id)}
                            onMouseLeave={() => setHoveredWorkstreamId(null)}
                            role="group"
                            aria-label={`${ws.code}: ${ws.title}. Current stage ${ws.currentStageName || "Not configured"}. Owner ${ws.regulatoryLead.assignedReviewerName || "Unassigned"}.`}
                            onClick={(event) => {
                              if ((event.target as HTMLElement).closest("a,button")) return;
                              openWorkstream(ws);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openWorkstream(ws);
                              }
                            }}
                            tabIndex={0}
                            className={`grid grid-cols-12 items-center transition-colors cursor-pointer ${
                              isHovered ? "bg-slate-50/90" : "hover:bg-slate-50/60"
                            }`}
                            title={`Click to open ${ws.title} (${ws.code}) details page`}
                          >
                            {/* Left Meta Column */}
                            <div className="col-span-12 border-b border-slate-200 p-3.5 md:col-span-4 md:border-b-0 md:border-r">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={(e) => toggleExpand(ws.id, e)}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    aria-expanded={isExpanded}
                                    aria-label={isExpanded ? `Collapse ${ws.code} stages and tasks` : `Expand ${ws.code} stages and tasks`}
                                    className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition"
                                    title={isExpanded ? "Collapse workflow stages/tasks" : "Expand workflow stages/tasks"}
                                  >
                                    {isExpanded ? <ChevronDown className="size-3.5 text-teal-800" /> : <ChevronRight className="size-3.5" />}
                                  </button>
                                  <span className="font-mono text-xs font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {ws.code}
                                  </span>
                                  {ws.isCriticalPath && (
                                    <Badge className="bg-purple-100 text-purple-900 border-purple-200 text-[10px] py-0 font-bold flex items-center gap-0.5">
                                      <Flame className="size-3 text-amber-500 fill-amber-500" /> {customerSafe ? "Priority sequence" : "Critical Path"}
                                    </Badge>
                                  )}
                                </div>

                                <Badge variant="outline" className="font-bold text-[11px] shrink-0">
                                  {ws.regulatoryLead.orgCode}
                                </Badge>
                              </div>

                              {/* Workstream Title & Link */}
                              <div className="mt-1 flex items-center justify-between group">
                                <Link
                                  href={`/workstreams/${encodeURIComponent(ws.code || ws.id)}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-bold text-slate-900 text-base group-hover:text-teal-800 transition line-clamp-1"
                                >
                                  {ws.title}
                                </Link>
                                <ExternalLink className="size-3 text-slate-400 group-hover:text-teal-700 shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition" />
                              </div>

                              {/* Current Stage & State Badge */}
                              <div className="mt-1.5 flex items-center justify-between gap-2 flex-wrap text-xs">
                                <Link
                                  href={`/workstreams/${encodeURIComponent(ws.code || ws.id)}?phase=${encodeURIComponent(ws.currentStageName || "phase")}#phase-${encodeURIComponent(ws.currentStageName || "phase")}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-slate-500 truncate max-w-[200px] hover:text-teal-800 hover:underline"
                                  title="Open stage anchor"
                                >
                                  {ws.currentStageName || "Technical Review"}
                                </Link>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${stateConfig.badgeBg} ${stateConfig.badgeText}`}>
                                  <span className={`size-1.5 rounded-full ${stateConfig.dotColor}`} />
                                  {stateConfig.shortLabel}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-[11px] text-slate-500" title={`Current owner: ${ws.regulatoryLead.assignedReviewerName}`}>
                                Owner: {ws.regulatoryLead.assignedReviewerName || "Unassigned"} · {ws.regulatoryLead.orgCode}
                              </p>
                            </div>

                            {/* Right timeline column: the stage lanes below are the source of truth. */}
                            <div className="col-span-12 relative flex min-h-[112px] flex-col justify-center overflow-hidden border-t border-slate-100 p-3 md:col-span-8 md:border-t-0">
                              {/* Background monthly grid lines */}
                              <div className="absolute inset-0 grid pointer-events-none opacity-20" style={{ gridTemplateColumns: monthGridTemplate }}>
                                {months.map((m) => (
                                  <div key={m.label} className="border-r border-slate-300 h-full last:border-0" />
                                ))}
                              </div>

                              {/* Vertical "Today" line marker across row */}
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 z-10 pointer-events-none"
                                style={{ left: `${todayDisplayPercent}%` }}
                              />

                              <div className="relative flex h-10 w-full items-center">
                                <div
                                  className={`absolute h-9 rounded-none border px-3 text-base font-bold shadow-sm ${stateConfig.barBorder} ${stateConfig.barColor} ${stateConfig.textColor} flex items-center cursor-pointer`}
                                  style={{ left: `${forecastLeft}%`, width: `${Math.max(1.5, forecastRight - forecastLeft)}%` }}
                                  title={`${ws.title} (${ws.code})\nState: ${stateConfig.label}\nForecast: ${displayDate(ws.forecastStartDate)} → ${displayDate(ws.forecastTargetDate)}${hasSlip ? `\nSlip: +${ws.scheduleVarianceDays} days` : ""}`}
                                >
                                  <span className="truncate">{workflowStages.length > 0 ? `${workflowStages.length} stages · ${stateConfig.shortLabel}` : stateConfig.shortLabel}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Stages and Tasks Sub-Rows */}
                          {isExpanded && workflowStages.length > 0 && (
                            <div className="bg-white divide-y divide-slate-100 border-l-4 border-sky-500" aria-label={`${ws.code} workflow stages`}>
                              {stageRows.map(({ stage, index, stageStart, stageEnd, hasStageDates, stageLeft, stageWidth, stageState }) => {
                                return (
                                  <div key={stage.id} id={`phase-${encodeURIComponent(stage.name)}`} className="grid grid-cols-12 items-center bg-sky-50/30">
                                    <div className="col-span-12 p-3 pl-8 md:col-span-4 md:border-r">
                                      <Link
                                        href={`/workstreams/${encodeURIComponent(ws.code || ws.id)}?phase=${encodeURIComponent(stage.name)}#phase-${encodeURIComponent(stage.name)}`}
                                        onClick={(event) => event.stopPropagation()}
                                        className="text-base font-bold text-slate-800 hover:text-teal-800 hover:underline"
                                      >
                                        Step {stage.sequenceOrder}: {customerSafe ? stage.customerVisibilityLabel : stage.name}
                                      </Link>
                                      <p className="mt-0.5 text-xs text-slate-500">{customerSafe ? "Workflow milestone" : `${stage.responsibleOrgCode} · ${stage.targetDurationDays} day target`}</p>
                                    </div>
                                    <div className="col-span-12 relative flex min-h-[52px] items-center overflow-hidden p-3 md:col-span-8">
                                      <div className="absolute inset-0 grid pointer-events-none opacity-15" style={{ gridTemplateColumns: monthGridTemplate }}>
                                        {months.map((month) => <div key={month.label} className="border-r border-slate-300 last:border-0" />)}
                                      </div>
                                      {hasStageDates ? (
                                        <div
                                          data-testid={`gantt-stage-block-${ws.code}-${stage.stageKey}`}
                                          data-stage-state={stageState.toLowerCase().replaceAll(" ", "-")}
                                          className={`absolute h-9 rounded-none border px-2 text-sm font-bold shadow-sm ${STAGE_COLOR_CLASSES[index % STAGE_COLOR_CLASSES.length]}`}
                                          style={{ left: `${stageLeft}%`, width: `${stageWidth}%` }}
                                          title={`${stage.name}: ${displayDate(stageStart)} → ${displayDate(stageEnd)}`}
                                        >
                                          <span className="truncate">{stage.name}</span>
                                        </div>
                                      ) : (
                                        <span className="relative text-sm italic text-slate-500">Not scheduled</span>
                                      )}
                                      <span className="relative ml-auto text-xs font-black uppercase tracking-wide text-slate-600">{stageState}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {isExpanded && ws.tasks && ws.tasks.length > 0 && (
                            <div className="bg-slate-50/70 divide-y divide-slate-100 border-l-4 border-teal-600">
                              {ws.tasks.map((task: TaskRecord) => {
                                const hasDates = Boolean(task.baselineStartDate || task.baselineDueDate || task.forecastStartDate || task.forecastDueDate || task.actualCompletionDate);
                                const isTaskComplete = task.status === "completed";
                                const taskBarColor = isTaskComplete
                                  ? "bg-teal-500 border-teal-600 text-white"
                                  : task.status === "blocked"
                                    ? "bg-rose-500 border-rose-600 text-white"
                                    : task.status === "in_progress"
                                      ? "bg-emerald-500 border-emerald-600 text-white"
                                      : task.status === "waiting"
                                        ? "bg-amber-500 border-amber-600 text-slate-900"
                                        : "bg-slate-300 border-slate-400 text-slate-800";

                                const taskBaselineLeft = task.baselineStartDate ? getTimelinePosition(task.baselineStartDate) : undefined;
                                const taskBaselineRight = task.baselineDueDate ? getTimelinePosition(task.baselineDueDate) : undefined;
                                const taskForecastLeft = task.forecastStartDate ? getTimelinePosition(task.forecastStartDate) : undefined;
                                const taskForecastRight = task.forecastDueDate ? getTimelinePosition(task.forecastDueDate) : undefined;
                                const taskActualRight = task.actualCompletionDate ? getTimelinePosition(task.actualCompletionDate) : undefined;

                                const taskBarLeft = taskForecastLeft ?? taskBaselineLeft ?? 0;
                                const taskBarEnd = taskActualRight ?? taskForecastRight ?? taskBaselineRight ?? (taskBarLeft + 3);
                                const taskBarWidth = Math.max(1.5, taskBarEnd - taskBarLeft);

                                return (
                                  <div
                                    key={task.id}
                                    className="grid grid-cols-12 items-center hover:bg-slate-100/70 transition-colors"
                                  >
                                    {/* Sub-row left metadata */}
                                    <div className="col-span-12 p-3 pl-8 md:col-span-4 border-r border-slate-200">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <Link
                                          href={`/work/task/${encodeURIComponent(task.id)}`}
                                          className="text-xs font-bold text-slate-900 hover:text-teal-800 hover:underline flex items-center gap-1"
                                        >
                                          <Layers className="size-3 text-slate-400" />
                                          <span>{task.title}</span>
                                          <ExternalLink className="size-2.5 text-slate-400" />
                                        </Link>
                                      </div>
                                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                                        <Badge variant="outline" className="text-[9px] py-0">{task.assignedOrgCode || "Gov"}</Badge>
                                        <span className="font-semibold uppercase">{task.status.replace("_", " ")}</span>
                                        {task.isCriticalPath && (
                                          <span className="text-purple-700 font-bold">Critical</span>
                                        )}
                                        {task.predecessorTaskIds?.length === 0 && (
                                          <span className="text-sky-700 font-bold">Parallel start</span>
                                        )}
                                      </div>
                                      <div className="mt-0.5 text-[10px] text-slate-500">
                                        {hasDates ? (
                                          <span>Due: {displayDate(task.forecastDueDate || task.baselineDueDate)}</span>
                                        ) : (
                                          <span>Schedule: <span className="italic text-slate-400">Not scheduled</span> <Link href={`/admin/workflows?template=${ws.permitTypeId || "all"}`} className="text-teal-700 hover:underline font-bold">Configure</Link></span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Sub-row right timeline bar */}
                                    <div className="col-span-12 relative flex h-10 flex-col justify-center overflow-hidden border-t border-slate-100 p-2 md:col-span-8 md:border-t-0">
                                      {/* Background monthly grid lines */}
                                      <div className="absolute inset-0 grid pointer-events-none opacity-15" style={{ gridTemplateColumns: monthGridTemplate }}>
                                        {months.map((m) => (
                                          <div key={m.label} className="border-r border-slate-300 h-full last:border-0" />
                                        ))}
                                      </div>

                                      {/* Today line */}
                                      <div
                                        className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 z-10 pointer-events-none"
                                        style={{ left: `${todayDisplayPercent}%` }}
                                      />

                                      {hasDates ? (
                                        <div className="relative w-full h-5">
                                          <Link
                                            href={`/work/task/${encodeURIComponent(task.id)}`}
                                            className={`absolute h-4 rounded border text-[9px] font-bold px-1.5 flex items-center truncate ${taskBarColor} shadow-xs hover:shadow-sm cursor-pointer`}
                                            style={{
                                              left: `${taskBarLeft}%`,
                                              width: `${taskBarWidth}%`,
                                            }}
                                            title={`Task: ${task.title}\nStatus: ${task.status}\nAssigned: ${task.assignedUserName || task.assignedOrgCode || "Gov"}`}
                                          >
                                            <span className="truncate">{task.title}</span>
                                          </Link>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2 text-[11px] text-slate-400 italic px-2">
                                          <span>Not scheduled</span>
                                          <Link href={`/admin/workflows?template=${ws.permitTypeId || "all"}`} className="text-teal-700 hover:underline text-[10px] not-italic font-bold">
                                            Configure schedule
                                          </Link>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
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
            </div>

          {/* ================================================================ */}
          {/* 12-COLUMN WORKSTREAM DAG & BASELINE COMPARISON TABLE             */}
          {/* ================================================================ */}
          <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm ${scheduleViewMode === "table" ? "" : "hidden"}`}>
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="hidden grid-cols-12 text-xs font-bold uppercase tracking-wider text-slate-600 md:grid">
                <div className="col-span-4">{customerSafe ? "Workstream" : "Workstream / Dependencies"}</div>
                <div className="col-span-2 text-center">Lead Agency</div>
                <div className="col-span-2 text-center">Baseline Target</div>
                <div className="col-span-2 text-center">Current Forecast</div>
                <div className="col-span-2 text-right">{customerSafe ? "Variance & related schedule" : "Variance & Controlling Path"}</div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredWorkstreams.map((ws) => (
                <div
                  key={ws.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${ws.title}`}
                  onClick={() => openWorkstream(ws)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openWorkstream(ws);
                    }
                  }}
                  className="grid cursor-pointer gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-slate-50/80 md:grid-cols-12 md:items-center"
                >
                  <div className="md:col-span-4 md:pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400 font-bold">{ws.code}</span>
                      {ws.isCriticalPath && (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] py-0">
                          {customerSafe ? "Priority sequence" : "Critical Path"}
                        </Badge>
                      )}
                    </div>
                    <div className="font-bold text-slate-900 mt-0.5 flex items-center gap-1 group">
                      <span>{ws.title}</span>
                      <ArrowRight className="size-3 text-slate-400 group-hover:text-teal-700" />
                    </div>
                    <div className="text-xs text-slate-500">{ws.currentStageName}</div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2 md:col-span-2 md:block md:border-t-0 md:pt-0 md:text-center">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 md:hidden">Lead agency</span>
                    <Badge variant="outline" className="font-semibold">
                      {ws.regulatoryLead.orgCode}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2 md:col-span-2 md:block md:border-t-0 md:pt-0 md:text-center">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 md:hidden">Baseline target</span>
                    {ws.baselineTargetDate}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2 md:col-span-2 md:block md:border-t-0 md:pt-0 md:text-center">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 md:hidden">Current forecast</span>
                    {ws.forecastTargetDate}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2 md:col-span-2 md:block md:border-t-0 md:pt-0 md:text-right">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 md:hidden">Variance</span>
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
      {/* TAB: ADVANCED ANALYSIS (SIMULATOR, DELAYS, ACCELERATION)             */}
      {/* ==================================================================== */}
      {!customerSafe && activeTab === "advanced" && (
        <div id="schedule-panel-advanced" role="tabpanel" aria-labelledby="schedule-tab-advanced" tabIndex={0} className="space-y-6">
          {/* Advanced Sub-Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            <Button
              type="button"
              variant={advancedSection === "simulator" ? "default" : "outline"}
              size="sm"
              onClick={() => setAdvancedSection("simulator")}
              className="text-xs font-bold"
            >
              <Zap className="size-3.5" /> What-If Simulator
            </Button>
            <Button
              type="button"
              variant={advancedSection === "delays" ? "default" : "outline"}
              size="sm"
              onClick={() => setAdvancedSection("delays")}
              className="text-xs font-bold"
            >
              <Clock3 className="size-3.5" /> Delay Taxonomy Attribution
            </Button>
            <Button
              type="button"
              variant={advancedSection === "acceleration" ? "default" : "outline"}
              size="sm"
              onClick={() => setAdvancedSection("acceleration")}
              className="text-xs font-bold"
            >
              <Sparkles className="size-3.5" /> Parallel Acceleration ({schedule.accelerationOpportunities.length})
            </Button>
          </div>

          {/* Sub-view: Simulator */}
          {advancedSection === "simulator" && (
            <InteractiveScheduleSimulator />
          )}

          {/* Sub-view: Delay Taxonomy */}
          {advancedSection === "delays" && (
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
                      <span className="font-mono text-slate-600">Impact not calculated</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-slate-300 h-full w-full" />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      No recorded dependency impact is available for this project view.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-700">Statutory Minimum Notice Periods</span>
                      <span className="font-mono text-slate-600">Impact not calculated</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-slate-300 h-full w-full" />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Statutory 30-day federal Section 404 public comment publication alignment.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-700">Public Hearing Comment Response</span>
                      <span className="font-mono text-slate-600">Impact not calculated</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-slate-300 h-full w-full" />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      LDEQ deluge retention basin 15-day post-hearing public comment resolution window.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-700">Engineering Revisions & Drawing Packages</span>
                      <span className="font-mono text-slate-600">No recorded impact</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-slate-300 h-full w-full" />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      SpaceX engineering turnaround completed within float buffer without critical-path slip.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sub-view: Acceleration Opportunities */}
          {advancedSection === "acceleration" && (
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
      )}
    </div>
  );
}
