"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  AlertOctagon,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileQuestion,
  HelpCircle,
  Info,
  Layers,
  MapPin,
  ShieldAlert,
  Sparkles,
  User,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSpaceXNoSurprisesData } from "@/lib/permit-utils";
import type { WorkstreamRecord } from "@/lib/domain-models";

interface Props {
  onSelectWorkstream?: (wsId: string) => void;
}

function formatDateUtc(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const [year, month, day] = parts;
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
}

export function SpaceXNoSurprises({ onSelectWorkstream }: Props) {
  const data = getSpaceXNoSurprisesData();
  const [selectedQuad, setSelectedQuad] = useState<"all" | "needsSpaceX" | "needsGov" | "blocked" | "milestones">("all");

  const govCommitmentsDue = data.commitments.filter(
    (c) => c.committingOrgCode !== "SPACEX" && c.status === "on_track"
  ).length;
  const spacexCommitmentsDue = data.commitments.filter(
    (c) => c.committingOrgCode === "SPACEX" && c.status === "on_track"
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Banner: No Surprises Promise & Commitment Summary */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-500/20 text-indigo-200 border-indigo-500/30">
                SpaceX Executive Delivery Cockpit
              </Badge>
              <span className="text-xs text-slate-400">Pecan Island Launch Complex Operations</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              No-Surprises Delivery Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Clear accountability for every regulatory track, commitment, RFI, and critical-path milestone.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Gov Commitments
              </div>
              <div className="text-2xl font-black text-white">{govCommitmentsDue} due</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                SpaceX Owed
              </div>
              <div className="text-2xl font-black text-amber-300">{spacexCommitmentsDue} due</div>
            </div>
          </div>
        </div>
      </div>

      {/* The 4 Quads Overview Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {/* Quad 1: Needs SpaceX */}
        <Card
          onClick={() => setSelectedQuad(selectedQuad === "needsSpaceX" ? "all" : "needsSpaceX")}
          className={`cursor-pointer transition-all hover:shadow-md border-amber-200 bg-amber-50/40 ${
            selectedQuad === "needsSpaceX" ? "ring-2 ring-amber-500 shadow-md" : ""
          }`}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Needs SpaceX
              </span>
              <Badge variant="outline" className="border-amber-300 bg-amber-100 font-bold text-amber-900">
                {data.needsSpaceX.length} Actions
              </Badge>
            </div>
            <CardTitle className="text-lg font-bold text-slate-900">
              Awaiting SpaceX Input
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-600">
              Engineering packages, drawings, or RFI responses required from SpaceX teams to maintain schedule.
            </p>
          </CardContent>
        </Card>

        {/* Quad 2: Needs Government */}
        <Card
          onClick={() => setSelectedQuad(selectedQuad === "needsGov" ? "all" : "needsGov")}
          className={`cursor-pointer transition-all hover:shadow-md border-sky-200 bg-sky-50/40 ${
            selectedQuad === "needsGov" ? "ring-2 ring-sky-500 shadow-md" : ""
          }`}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-800">
                Needs Government
              </span>
              <Badge variant="outline" className="border-sky-300 bg-sky-100 font-bold text-sky-900">
                {data.needsGovernment.length} Workstreams
              </Badge>
            </div>
            <CardTitle className="text-lg font-bold text-slate-900">
              In Agency Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-600">
              Submissions delivered by SpaceX actively being evaluated across state and federal agency staff.
            </p>
          </CardContent>
        </Card>

        {/* Quad 3: Blocked */}
        <Card
          onClick={() => setSelectedQuad(selectedQuad === "blocked" ? "all" : "blocked")}
          className={`cursor-pointer transition-all hover:shadow-md border-rose-200 bg-rose-50/40 ${
            selectedQuad === "blocked" ? "ring-2 ring-rose-500 shadow-md" : ""
          }`}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                Blocked Items
              </span>
              <Badge variant="outline" className="border-rose-300 bg-rose-100 font-bold text-rose-900">
                {data.blocked.length} Roadblocks
              </Badge>
            </div>
            <CardTitle className="text-lg font-bold text-slate-900">
              Active Schedule Blocker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-600">
              Cross-agency dependencies or technical objections impacting the critical path to launch.
            </p>
          </CardContent>
        </Card>

        {/* Quad 4: Upcoming Decisions */}
        <Card
          onClick={() => setSelectedQuad(selectedQuad === "milestones" ? "all" : "milestones")}
          className={`cursor-pointer transition-all hover:shadow-md border-emerald-200 bg-emerald-50/40 ${
            selectedQuad === "milestones" ? "ring-2 ring-emerald-500 shadow-md" : ""
          }`}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Upcoming Decisions
              </span>
              <Badge variant="outline" className="border-emerald-300 bg-emerald-100 font-bold text-emerald-900">
                {data.upcomingMilestones.length} Milestones
              </Badge>
            </div>
            <CardTitle className="text-lg font-bold text-slate-900">
              Key Project Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-600">
              Statutory notice closures, environmental determinations, and heavy-haul authorizations.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Filtered Cards Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {selectedQuad === "all" && "All Active Workstream Statuses"}
            {selectedQuad === "needsSpaceX" && "Items Awaiting SpaceX Action"}
            {selectedQuad === "needsGov" && "Items Currently With Government Agencies"}
            {selectedQuad === "blocked" && "Critical Path Blockers & Dependencies"}
            {selectedQuad === "milestones" && "Upcoming Decisions & Target Dates"}
          </h2>
          {selectedQuad !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedQuad("all")} className="text-xs">
              Show All
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {data.upcomingMilestones
            .filter((item) => {
              if (selectedQuad === "needsSpaceX") return item.workstream.operationalState === "waiting_applicant" || item.workstream.customerActionRequired !== "None";
              if (selectedQuad === "needsGov") return item.workstream.operationalState === "running" || item.workstream.operationalState === "statutory_waiting_period";
              if (selectedQuad === "blocked") return item.workstream.operationalState === "blocked" || item.workstream.scheduleVarianceDays > 5;
              return true;
            })
            .map((item) => {
              const ws = item.workstream;
              const ctx = item.context;
              const isBlocked = ws.operationalState === "blocked";
              const isActionNeeded = ws.customerActionRequired && ws.customerActionRequired !== "None";

              return (
                <div
                  key={ws.id}
                  onClick={() => onSelectWorkstream?.(ws.id)}
                  className={`group relative rounded-xl border p-5 transition-all hover:shadow-lg cursor-pointer bg-white ${
                    isBlocked
                      ? "border-rose-300 bg-rose-50/20"
                      : isActionNeeded
                      ? "border-amber-300 bg-amber-50/20"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500">{ws.code}</span>
                        <Badge
                          variant="secondary"
                          className={
                            ws.ragHealth === "red"
                              ? "bg-rose-100 text-rose-800"
                              : ws.ragHealth === "yellow"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }
                        >
                          {ws.operationalStateLabel}
                        </Badge>
                        {ws.isCriticalPath && (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                            ⚡ Critical Path
                          </Badge>
                        )}
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-medium text-slate-600">{ws.regulatoryLead.orgName}</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {ws.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Forecast Target</div>
                        <div className="text-sm font-bold text-slate-900">
                          {formatDateUtc(ws.forecastTargetDate)}
                        </div>
                        {ws.scheduleVarianceDays > 0 && (
                          <div className="text-xs font-semibold text-rose-600">
                            +{ws.scheduleVarianceDays}d variance
                          </div>
                        )}
                      </div>
                      <ChevronRight className="size-5 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>

                  {/* The 6-Question High-Impact Summary Sentence (Key Innovation) */}
                  <div className="mt-4 rounded-lg bg-slate-900 p-3.5 text-xs text-slate-200 shadow-inner">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <span className="font-semibold text-indigo-300">Currently with: </span>
                        <span>{ws.regulatoryLead.orgName} ({ws.regulatoryLead.assignedReviewerName})</span>
                      </div>
                      <div>
                        <span className="font-semibold text-indigo-300">They are doing: </span>
                        <span>{ctx.whatDoing}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-amber-300">Waiting on: </span>
                        <span>{ctx.waitingOn} ({ctx.waitingFor})</span>
                      </div>
                      <div>
                        <span className="font-semibold text-emerald-300">SpaceX action required: </span>
                        <span className={isActionNeeded ? "font-bold text-amber-300" : "text-slate-300"}>
                          {ws.customerActionRequired}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dual Ownership & Concierge Footer */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <User className="size-3.5 text-slate-400" />
                      <span>State Concierge: <strong className="text-slate-700">{ws.governmentConcierge.name}</strong> ({ws.governmentConcierge.agency})</span>
                    </div>
                    <div>
                      <span>Next milestone: <strong className="text-slate-700">{ws.nextExpectedEvent}</strong></span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
