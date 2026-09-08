"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  ListChecks,
  Mail,
  Paperclip,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ProjectRecord, WorkstreamRecord, WorkflowTemplateRecord } from "@/lib/domain-models";
import { WorkstreamGraphGantt, STATE_COLOR_MAP } from "./WorkstreamGraphGantt";
import { WorkstreamTruthSummary } from "./WorkstreamTruthSummary";
import { WorkflowJourney, WorkflowMiniStepper } from "./WorkflowJourney";
import { projectProfiles } from "@/lib/customer-portal";

function formatDate(value?: string) {
  if (!value) return "Not set";
  const date = new Date(`${value.length === 10 ? `${value}T12:00:00` : value}`);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export type ProjectTab = "overview" | "work" | "schedule" | "documents" | "people";

function WorkstreamSummary({
  workstream,
  focused,
  workflowTemplates,
  customerSafe,
  onOpen,
}: {
  workstream: WorkstreamRecord;
  focused: boolean;
  workflowTemplates: WorkflowTemplateRecord[];
  customerSafe: boolean;
  onOpen: (workstreamId: string) => void;
}) {
  const state = STATE_COLOR_MAP[workstream.operationalState] ?? {
    shortLabel: workstream.operationalStateLabel,
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-800",
  };
  return (
    <button
      type="button"
      onClick={() => onOpen(workstream.id)}
      aria-label={`Open project page for ${workstream.title}`}
      data-workstream-id={workstream.id}
      aria-current={focused ? "page" : undefined}
      className={`block w-full rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 cursor-pointer ${
        focused ? "border-teal-600 bg-teal-50 ring-2 ring-teal-200" : "border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50/40"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] font-black text-slate-500">{workstream.code}</p>
          <p className="mt-1 text-sm font-black text-[#00284d]">{workstream.title}</p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${state.badgeBg} ${state.badgeText}`}>
          {state.shortLabel}
        </span>
      </div>
      <WorkstreamTruthSummary workstream={workstream} templates={workflowTemplates} customerSafe={customerSafe} />
      <WorkflowMiniStepper source={workstream} templates={workflowTemplates} customerSafe={customerSafe} />
    </button>
  );
}

function FocusedWorkstreamWorkspace({
  project,
  workstream,
  workflowTemplates,
  customerSafe,
  onBack,
}: {
  project: ProjectRecord;
  workstream: WorkstreamRecord;
  workflowTemplates: WorkflowTemplateRecord[];
  customerSafe: boolean;
  onBack: () => void;
}) {
  const documents = project.documents.filter(
    (document) =>
      document.workstreamId === workstream.id ||
      document.agencyReviews?.some((review) => review.workstreamId === workstream.id)
  );
  const audit = project.auditLedger.filter((event) => event.entityId === workstream.id).slice(0, 5);
  const activeVersion = workflowTemplates
    .flatMap((template) => template.versions)
    .find((version) => version.id === workstream.workflowVersionId);
  const stages = activeVersion?.stages ?? [];

  return (
    <Card
      className="border-teal-400 bg-white shadow-md"
      aria-label={`Workstream workspace: ${workstream.title}`}
      data-focused-workstream-id={workstream.id}
      tabIndex={-1}
    >
      <CardHeader className="border-b border-slate-100 bg-teal-50/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Workstream workspace</p>
            <CardTitle className="mt-1 text-2xl font-black text-[#00284d]">{workstream.title}</CardTitle>
            <p className="mt-1 font-mono text-xs font-bold text-slate-500">
              {workstream.code} · {workstream.assignmentGroupName ?? workstream.regulatoryLead.orgName}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onBack} className="text-xs font-bold">
            Back to Projects
          </Button>
        </div>
        <WorkstreamTruthSummary workstream={workstream} templates={workflowTemplates} customerSafe={customerSafe} />
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-teal-900">Customer-facing expectation</p>
            <p className="mt-2 text-sm font-bold text-teal-950">{workstream.customerActionRequired}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-slate-600">Dependencies</p>
            <p className="mt-2 text-sm text-slate-800">
              {workstream.controllingDependencyTitle ??
                (workstream.tasks.flatMap((task) => task.predecessorTaskIds).length
                  ? `${workstream.tasks.flatMap((task) => task.predecessorTaskIds).length} predecessor task link(s)`
                  : "No unresolved dependency recorded.")}
            </p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="size-4 text-teal-700" /> Tasks and configured stages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {workstream.tasks.length > 0 ? (
                workstream.tasks.map((task) => (
                  <div key={task.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                    <div>
                      <p className="font-bold text-slate-800">{task.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {task.assignedOrgCode} · {task.assignedUserName ?? "Unassigned"}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-700">
                      {task.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">No tasks are currently visible for this workstream.</p>
              )}
              {stages.length > 0 && (
                <p className="border-t border-slate-100 pt-3 text-xs text-slate-600">
                  {stages.length} configured workflow stage(s) in the pinned version.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Paperclip className="size-4 text-teal-700" /> Documents, decisions, and activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {documents.length > 0 ? (
                documents.map((document) => (
                  <p key={document.id} className="rounded-lg border border-slate-200 p-3 font-bold text-slate-800">
                    {document.title}
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      {document.versions[0]?.status?.replaceAll("_", " ") ?? "Recorded package"}
                    </span>
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-600">No workstream documents are currently visible.</p>
              )}
              <p className="border-t border-slate-100 pt-3 text-xs text-slate-600">
                {project.decisions.length} project decision(s) · {audit.length} recent workstream event(s) · {workstream.rfis.length} information request(s)
              </p>
            </CardContent>
          </Card>
        </div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Selected from DAG / Gantt</p>
        <WorkflowJourney source={workstream} templates={workflowTemplates} customerSafe={customerSafe} />
      </CardContent>
    </Card>
  );
}

export function ProjectOverviewPage({
  project,
  customerSafe = false,
  workflowTemplates = [],
  focusedWorkstreamId,
  onFocusWorkstream,
  onOpenSchedule,
}: {
  project: ProjectRecord;
  customerSafe?: boolean;
  workflowTemplates?: WorkflowTemplateRecord[];
  focusedWorkstreamId?: string | null;
  onFocusWorkstream: (workstreamId: string | null) => void;
  onOpenSchedule: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");
  const [workSearch, setWorkSearch] = useState("");
  const [workHealthFilter, setWorkHealthFilter] = useState<string>("all");
  const [workSort, setWorkSort] = useState<string>("code");

  const focused = project.workstreams.find(
    (workstream) =>
      workstream.id === focusedWorkstreamId ||
      workstream.code === focusedWorkstreamId ||
      workstream.code.toLowerCase() === focusedWorkstreamId?.toLowerCase()
  );

  const completeCount = project.workstreams.filter((workstream) => workstream.operationalState === "complete").length;
  const blockedCount = project.workstreams.filter(
    (workstream) => workstream.operationalState === "blocked" || workstream.ragHealth === "red"
  ).length;
  const attentionCount = project.workstreams.filter((workstream) => workstream.ragHealth === "yellow").length;
  const onTrackCount = project.workstreams.length - blockedCount - attentionCount;

  const attentionWorkstream =
    project.workstreams.find(
      (workstream) =>
        workstream.operationalState === "blocked" ||
        workstream.ragHealth === "red" ||
        workstream.operationalState === "waiting_government" ||
        workstream.operationalState === "waiting_applicant" ||
        workstream.operationalState === "waiting_external"
    ) ?? project.workstreams.find((workstream) => workstream.ragHealth === "yellow");

  const activeWorkstream =
    project.workstreams.find((workstream) => workstream.operationalState === "running") ??
    project.workstreams.find(
      (workstream) =>
        workstream.operationalState === "waiting_government" ||
        workstream.operationalState === "waiting_applicant" ||
        workstream.operationalState === "waiting_external"
    ) ??
    project.workstreams.find((workstream) => workstream.operationalState !== "complete");

  const nextWorkstream = [...project.workstreams]
    .filter((workstream) => workstream.operationalState !== "complete")
    .sort((left, right) => (left.forecastTargetDate ?? "9999-12-31").localeCompare(right.forecastTargetDate ?? "9999-12-31"))[0];

  const topBlockers = project.workstreams
    .filter((workstream) => workstream.operationalState === "blocked" || workstream.ragHealth === "red")
    .slice(0, 4);

  const nextMilestones = [...project.workstreams]
    .filter((workstream) => workstream.operationalState !== "complete" && workstream.nextExpectedEvent)
    .sort((left, right) => (left.forecastTargetDate ?? "9999-12-31").localeCompare(right.forecastTargetDate ?? "9999-12-31"))
    .slice(0, 4);

  useEffect(() => {
    if (!focused) return;
    window.requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-focused-workstream-id="${focused.id}"]`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    );
  }, [focused]);

  const filteredWorkstreams = useMemo(() => {
    let list = [...project.workstreams];
    const query = workSearch.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (ws) =>
          ws.title.toLowerCase().includes(query) ||
          ws.code.toLowerCase().includes(query) ||
          ws.regulatoryLead.orgName.toLowerCase().includes(query) ||
          ws.regulatoryLead.orgCode.toLowerCase().includes(query) ||
          ws.currentActionSummary.toLowerCase().includes(query)
      );
    }
    if (workHealthFilter === "blocked") {
      list = list.filter((ws) => ws.operationalState === "blocked" || ws.ragHealth === "red");
    } else if (workHealthFilter === "attention") {
      list = list.filter((ws) => ws.ragHealth === "yellow");
    } else if (workHealthFilter === "on_track") {
      list = list.filter((ws) => ws.ragHealth === "green");
    } else if (workHealthFilter === "complete") {
      list = list.filter((ws) => ws.operationalState === "complete");
    }
    if (workSort === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (workSort === "variance") {
      list.sort((a, b) => (b.scheduleVarianceDays ?? 0) - (a.scheduleVarianceDays ?? 0));
    } else if (workSort === "forecast") {
      list.sort((a, b) => (a.forecastTargetDate ?? "9999").localeCompare(b.forecastTargetDate ?? "9999"));
    } else {
      list.sort((a, b) => a.code.localeCompare(b.code));
    }
    return list;
  }, [project.workstreams, workSearch, workHealthFilter, workSort]);

  const previewWorkstreams = useMemo(() => {
    return project.workstreams.filter((ws) => ws.operationalState !== "complete").slice(0, 4);
  }, [project.workstreams]);

  const statusSentence =
    project.overallRagHealth === "red"
      ? `${project.name} is currently at risk with ${blockedCount} blocked workstream(s), forecasting a +${project.scheduleVarianceDays}-day variance to baseline launch.`
      : project.overallRagHealth === "yellow"
      ? `${project.name} requires watch with ${attentionCount} workstream(s) on attention, forecasting a +${project.scheduleVarianceDays}-day variance to baseline launch.`
      : `${project.name} is progressing on track toward target launch on ${formatDate(project.currentForecastLaunchDate)}.`;

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <section className="rounded-2xl border border-teal-300 bg-white p-6 shadow-md sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-800">
              {customerSafe ? "Customer project page" : "Authoritative project page"}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#00284d] sm:text-4xl">{project.name}</h1>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {project.code} · {project.locationDescription}
            </p>
          </div>
          <Badge className="border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-black uppercase text-amber-900">
            {project.overallRagHealth === "red" ? "At risk" : project.overallRagHealth === "yellow" ? "Attention" : "On track"}
          </Badge>
        </div>
        <div className="mt-7 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-[11px] font-black uppercase text-slate-500">Baseline launch</p>
            <p className="mt-1 text-sm font-black text-[#00284d]">{formatDate(project.baselineLaunchDate)}</p>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase text-slate-500">Current forecast</p>
            <p className="mt-1 text-sm font-black text-[#00284d]">{formatDate(project.currentForecastLaunchDate)}</p>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase text-slate-500">Variance</p>
            <p className="mt-1 text-sm font-black text-rose-700">+{project.scheduleVarianceDays} days</p>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase text-slate-500">Workstreams</p>
            <p className="mt-1 text-sm font-black text-[#00284d]">
              {completeCount}/{project.workstreams.length} complete
            </p>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase text-slate-500">Location</p>
            <p className="mt-1 text-sm font-black text-[#00284d]">{project.parish}, Louisiana</p>
          </div>
        </div>
      </section>

      {/* Focused Workstream Workspace (if active) */}
      {focused && (
        <FocusedWorkstreamWorkspace
          project={project}
          workstream={focused}
          workflowTemplates={workflowTemplates}
          customerSafe={customerSafe}
          onBack={() => onFocusWorkstream(null)}
        />
      )}
      {focusedWorkstreamId && !focused && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-lg font-black text-amber-950">Workstream not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-900">
              The linked workstream is not part of the authorized project data currently loaded. Return to Projects and choose a valid workstream.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => onFocusWorkstream(null)}
              className="mt-4 border-amber-400 font-bold text-amber-950"
            >
              Back to Projects
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Project Navigation Tabs */}
      <nav aria-label="Project tabs" className="flex border-b border-slate-200 bg-white px-4 rounded-xl shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-3 text-sm font-bold transition border-b-2 cursor-pointer ${
            activeTab === "overview"
              ? "border-teal-700 text-[#00284d]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("work")}
          className={`px-4 py-3 text-sm font-bold transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === "work"
              ? "border-teal-700 text-[#00284d]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Work
          <span className="rounded-full bg-slate-100 px-2 py-0.2 text-xs font-semibold text-slate-600">
            {project.workstreams.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("schedule")}
          className={`px-4 py-3 text-sm font-bold transition border-b-2 cursor-pointer ${
            activeTab === "schedule"
              ? "border-teal-700 text-[#00284d]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Schedule
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("documents")}
          className={`px-4 py-3 text-sm font-bold transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === "documents"
              ? "border-teal-700 text-[#00284d]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Documents
          <span className="rounded-full bg-slate-100 px-2 py-0.2 text-xs font-semibold text-slate-600">
            {project.documents.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("people")}
          className={`px-4 py-3 text-sm font-bold transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === "people"
              ? "border-teal-700 text-[#00284d]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          People
          <span className="rounded-full bg-slate-100 px-2 py-0.2 text-xs font-semibold text-slate-600">
            {project.participants?.length ?? 0}
          </span>
        </button>
      </nav>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Plain-Language Status Sentence */}
          <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4">
            <p className="text-sm font-semibold text-[#00284d]">
              <strong className="font-black text-teal-900">Executive status: </strong>
              {statusSentence}
            </p>
          </div>

          {/* Key summaries: Ownership, Clickable Health Counts, Records */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-black text-[#00284d]">
                  <Building2 className="size-4 text-teal-700" /> Project ownership
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-[11px] font-black uppercase text-slate-500">Applicant</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("people")}
                    className="mt-1 font-bold text-teal-900 hover:underline cursor-pointer text-left"
                  >
                    {project.applicantOrgCode} (SpaceX)
                  </button>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase text-slate-500">State lead</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("people")}
                    className="mt-1 font-bold text-teal-900 hover:underline cursor-pointer text-left"
                  >
                    {project.leadStateAgencyCode} · {project.stateProjectManagerName}
                  </button>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase text-slate-500">Customer program manager</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("people")}
                    className="mt-1 font-bold text-teal-900 hover:underline cursor-pointer text-left"
                  >
                    {project.customerProgramManagerName}
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Clickable Delivery Health (filters Work tab) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-black text-[#00284d]">Delivery health</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("work");
                    setWorkHealthFilter("blocked");
                  }}
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-left transition hover:border-red-400 hover:bg-red-100/60 cursor-pointer"
                  title="Filter to at-risk workstreams in Work tab"
                >
                  <p className="text-[10px] font-black uppercase text-red-800">At risk</p>
                  <p className="mt-1 text-2xl font-black text-red-950">{blockedCount}</p>
                  <span className="text-[10px] font-bold text-red-700">Filter work →</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("work");
                    setWorkHealthFilter("attention");
                  }}
                  className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-left transition hover:border-amber-400 hover:bg-amber-100/60 cursor-pointer"
                  title="Filter to attention workstreams in Work tab"
                >
                  <p className="text-[10px] font-black uppercase text-amber-800">Attention</p>
                  <p className="mt-1 text-2xl font-black text-amber-950">{attentionCount}</p>
                  <span className="text-[10px] font-bold text-amber-700">Filter work →</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("work");
                    setWorkHealthFilter("on_track");
                  }}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-left transition hover:border-emerald-400 hover:bg-emerald-100/60 cursor-pointer"
                  title="Filter to on-track workstreams in Work tab"
                >
                  <p className="text-[10px] font-black uppercase text-emerald-800">On track</p>
                  <p className="mt-1 text-2xl font-black text-emerald-950">{onTrackCount}</p>
                  <span className="text-[10px] font-bold text-emerald-700">Filter work →</span>
                </button>
              </CardContent>
            </Card>

            {/* Canonical Records Links */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-black text-[#00284d]">Project records</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveTab("documents")}
                  className="flex items-center gap-2 text-left font-semibold text-teal-900 hover:underline cursor-pointer"
                >
                  <FileCheck2 className="size-4 text-teal-700" />
                  <strong>{project.documents.length}</strong> document packages →
                </button>
                <p>
                  <CheckCircle2 className="mr-2 inline size-4 text-teal-700" />
                  <strong>{project.commitments.length}</strong> commitments
                </p>
                <p>
                  <CalendarClock className="mr-2 inline size-4 text-teal-700" />
                  <strong>{project.decisions.length}</strong> decisions
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("people")}
                  className="flex items-center gap-2 text-left font-semibold text-teal-900 hover:underline cursor-pointer"
                >
                  <Users className="size-4 text-teal-700" />
                  <strong>{project.participants?.length ?? 0}</strong> participants →
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Project Right Now (Preserves test contract) */}
          <section aria-label="Project right now" className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Project right now</p>
              <h2 className="mt-1 text-xl font-black text-[#00284d]">What happened, what is happening, and what comes next</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                aria-label={attentionWorkstream ? `Open workstream workspace for ${attentionWorkstream.title}` : "No workstream needs attention"}
                disabled={!attentionWorkstream}
                onClick={() => attentionWorkstream && onFocusWorkstream(attentionWorkstream.id)}
                className="rounded-xl border border-rose-200 bg-white p-4 text-left transition hover:border-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-default disabled:hover:border-rose-200"
              >
                <p className="text-[11px] font-black uppercase text-rose-800">Needs attention</p>
                {attentionWorkstream ? (
                  <>
                    <p className="mt-2 text-sm font-black text-[#00284d]">{attentionWorkstream.title}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {attentionWorkstream.waitingReason ?? attentionWorkstream.currentActionSummary}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-slate-600">Nothing is blocked.</p>
                )}
              </button>
              <button
                type="button"
                aria-label={activeWorkstream ? `Open workstream workspace for ${activeWorkstream.title}` : "All workstreams are complete"}
                disabled={!activeWorkstream}
                onClick={() => activeWorkstream && onFocusWorkstream(activeWorkstream.id)}
                className="rounded-xl border border-teal-200 bg-white p-4 text-left transition hover:border-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-default disabled:hover:border-teal-200"
              >
                <p className="text-[11px] font-black uppercase text-teal-800">Happening now</p>
                {activeWorkstream ? (
                  <>
                    <p className="mt-2 text-sm font-black text-[#00284d]">{activeWorkstream.title}</p>
                    <p className="mt-1 text-xs text-slate-600">{activeWorkstream.currentActionSummary}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-slate-600">All workstreams are complete.</p>
                )}
              </button>
              <button
                type="button"
                aria-label={nextWorkstream ? `Open workstream workspace for ${nextWorkstream.title}` : "Project is complete"}
                disabled={!nextWorkstream}
                onClick={() => nextWorkstream && onFocusWorkstream(nextWorkstream.id)}
                className="rounded-xl border border-sky-200 bg-white p-4 text-left transition hover:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-default disabled:hover:border-sky-200"
              >
                <p className="text-[11px] font-black uppercase text-sky-800">Next milestone</p>
                {nextWorkstream ? (
                  <>
                    <p className="mt-2 text-sm font-black text-[#00284d]">{nextWorkstream.title}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {nextWorkstream.nextExpectedEvent} · {formatDate(nextWorkstream.forecastTargetDate)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-slate-600">Project complete.</p>
                )}
              </button>
            </div>
          </section>

          {/* Top Blockers & Next Milestones */}
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-black text-[#00284d]">
                  <ShieldAlert className="size-4 text-rose-600" /> Critical path and blockers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topBlockers.length > 0 ? (
                  topBlockers.map((ws) => (
                    <div key={ws.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-black text-amber-950">{ws.title}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onFocusWorkstream(ws.id)}
                          className="h-6 px-2 text-[11px] font-bold text-amber-900 hover:bg-amber-100"
                        >
                          View →
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-amber-900">
                        Responsible: {ws.waitingOnEntity ?? ws.regulatoryLead.orgName} · {ws.scheduleVarianceDays > 0 ? `${ws.scheduleVarianceDays}d variance` : "Critical path"}
                      </p>
                      <p className="mt-1 text-xs text-amber-800">
                        Reason: {ws.waitingReason ?? ws.currentActionSummary}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-600">No active workstream blockers reported.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-black text-[#00284d]">
                  <CalendarClock className="size-4 text-teal-700" /> Upcoming milestones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {nextMilestones.length > 0 ? (
                  nextMilestones.map((ws) => (
                    <div key={ws.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5 last:border-0">
                      <div>
                        <p className="text-sm font-bold text-[#00284d]">{ws.nextExpectedEvent}</p>
                        <p className="text-xs text-slate-500">
                          {ws.title} · {ws.regulatoryLead.orgName}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-800">
                          {formatDate(ws.forecastTargetDate)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-600">All milestones recorded are complete.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Short Work Preview (Not the full 23 workstream list!) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-[#00284d]">Active work preview</CardTitle>
                <p className="text-xs text-slate-500">A snapshot of primary active workstreams. Open the Work tab for full search, filters, and all records.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("work")}
                className="text-xs font-bold gap-1"
              >
                View all {project.workstreams.length} <ArrowRight className="size-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {previewWorkstreams.map((workstream) => (
                  <WorkstreamSummary
                    key={workstream.id}
                    workstream={workstream}
                    workflowTemplates={workflowTemplates}
                    customerSafe={customerSafe}
                    onOpen={onFocusWorkstream}
                    focused={
                      workstream.id === focusedWorkstreamId ||
                      workstream.code === focusedWorkstreamId ||
                      workstream.code.toLowerCase() === focusedWorkstreamId?.toLowerCase()
                    }
                  />
                ))}
              </div>
              <div className="mt-4 border-t border-slate-100 pt-3 text-center">
                <Button
                  type="button"
                  onClick={() => setActiveTab("work")}
                  className="bg-[#00284d] hover:bg-[#003c70] text-xs font-bold"
                >
                  Go to Work tab ({project.workstreams.length} total workstreams) →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Work (Houses all 23 workstream cards with search/filter/sort) */}
      {activeTab === "work" && (
        <section aria-label="Workstreams and current state" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Project execution detail</p>
              <h2 className="mt-1 text-2xl font-black text-[#00284d]">Workstreams and current state</h2>
              <p className="mt-1 text-sm text-slate-600">
                Each row opens the in-app workstream workspace and shows the completed steps, current step, and next handoff.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={onOpenSchedule} className="text-xs font-bold gap-1.5">
              Open full schedule <ArrowRight className="size-3.5" />
            </Button>
          </div>

          {/* Search, Health filter, and Sort toolbar */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
              <Input
                type="search"
                placeholder="Search by workstream name, code, or agency..."
                value={workSearch}
                onChange={(e) => setWorkSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Health:</span>
              {(["all", "blocked", "attention", "on_track", "complete"] as const).map((filterVal) => (
                <button
                  key={filterVal}
                  type="button"
                  onClick={() => setWorkHealthFilter(filterVal)}
                  className={`rounded-md px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                    workHealthFilter === filterVal
                      ? "bg-[#00284d] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {filterVal === "all"
                    ? "All"
                    : filterVal === "blocked"
                    ? "At risk"
                    : filterVal === "attention"
                    ? "Attention"
                    : filterVal === "on_track"
                    ? "On track"
                    : "Complete"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Sort:</span>
              <select
                value={workSort}
                onChange={(e) => setWorkSort(e.target.value)}
                className="h-7 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-700"
              >
                <option value="code">Code</option>
                <option value="title">Title</option>
                <option value="variance">Schedule variance</option>
                <option value="forecast">Target date</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Showing {filteredWorkstreams.length} of {project.workstreams.length} workstreams.
          </p>

          {/* Grid of Workstream Cards */}
          <div className="grid gap-3 md:grid-cols-2">
            {filteredWorkstreams.map((workstream) => (
              <WorkstreamSummary
                key={workstream.id}
                workstream={workstream}
                workflowTemplates={workflowTemplates}
                customerSafe={customerSafe}
                onOpen={onFocusWorkstream}
                focused={
                  workstream.id === focusedWorkstreamId ||
                  workstream.code === focusedWorkstreamId ||
                  workstream.code.toLowerCase() === focusedWorkstreamId?.toLowerCase()
                }
              />
            ))}
          </div>
          {filteredWorkstreams.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              No workstreams match the search or filter criteria.
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setWorkSearch("");
                  setWorkHealthFilter("all");
                }}
                className="mt-3 block mx-auto text-xs font-bold"
              >
                Reset filters
              </Button>
            </div>
          )}
        </section>
      )}

      {/* Tab: Schedule */}
      {activeTab === "schedule" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]">
              <CalendarClock className="size-5 text-teal-700" /> Project timeline and dependencies
            </CardTitle>
            <p className="text-sm text-slate-600">
              Historical baseline, current state, and future forecast are shown together.
            </p>
          </CardHeader>
          <CardContent className="p-0 sm:p-2">
            <WorkstreamGraphGantt project={project} customerSafe={customerSafe} onSelectWorkstream={onFocusWorkstream} />
          </CardContent>
        </Card>
      )}

      {/* Tab: Documents */}
      {activeTab === "documents" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]">
              <FileCheck2 className="size-5 text-teal-700" /> Project Document Packages
            </CardTitle>
            <p className="text-sm text-slate-600">
              Authoritative document packages with verified versions and interagency reviews.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {project.documents.map((doc) => {
              const latestVer = doc.versions.find((v) => v.versionNumber === doc.currentVersionNumber) ?? doc.versions[0];
              return (
                <div key={doc.id} className="rounded-xl border border-slate-200 p-4 bg-white flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-black text-[#00284d] text-sm">{doc.title}</p>
                      <span className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                        {latestVer?.versionTag ?? "v1.0"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Category: {doc.category.replaceAll("_", " ")} · Owner: {doc.ownerOrgCode} · {doc.versions.length} version(s)
                    </p>
                    {latestVer?.sha256Hash && (
                      <p className="mt-1 font-mono text-[10px] text-slate-400">
                        SHA-256: {latestVer.sha256Hash.slice(0, 24)}…
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                    {doc.agencyReviews.length} agency review(s)
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Tab: People */}
      {activeTab === "people" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]">
              <Users className="size-5 text-teal-700" /> Project Directory & Participants
            </CardTitle>
            <p className="text-sm text-slate-600">
              SpaceX team leads, State concierges, and regulatory agency reviewers.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {(project.participants ?? []).map((participant) => {
                const profile = projectProfiles.find((p) => p.userId === participant.userId);
                return (
                  <div key={participant.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-[#00284d] text-sm">{profile?.fullName ?? participant.projectRole}</p>
                        <p className="text-xs font-semibold text-slate-600">{participant.projectRole}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{participant.organizationName}</p>
                      </div>
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800 uppercase">
                        {participant.visibilityScope}
                      </span>
                    </div>
                    {profile?.workEmail && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 border-t border-slate-100 pt-2">
                        <Mail className="size-3 text-teal-700" />
                        <span>{profile.workEmail}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
