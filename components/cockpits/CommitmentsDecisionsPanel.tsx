"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Flame,
  Gavel,
  Layers,
  MessageSquare,
  Plus,
  Scale,
  Sparkles,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFullProjectRecord } from "@/lib/permit-utils";

export function CommitmentsDecisionsPanel() {
  const project = getFullProjectRecord();
  const [activeTab, setActiveTab] = useState<"commitments" | "decisions" | "meetings">("commitments");

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-50 text-amber-800 border-amber-200">
                Institutional Memory & Accountability
              </Badge>
              <span className="text-xs text-slate-500 font-mono">Structured Commitments & Legal Determinations</span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900">
              Commitment Ledger & Decision Repository
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Transform coordination meeting promises into tracked objects and preserve legally binding decisions with statutory citations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "commitments" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("commitments")}
              className="text-xs"
            >
              <CheckCircle2 className="size-3.5 mr-1" /> Commitments ({project.commitments.length})
            </Button>
            <Button
              variant={activeTab === "decisions" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("decisions")}
              className="text-xs"
            >
              <Scale className="size-3.5 mr-1" /> Decision Logs ({project.decisions.length})
            </Button>
            <Button
              variant={activeTab === "meetings" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("meetings")}
              className="text-xs"
            >
              <Users className="size-3.5 mr-1" /> Meetings ({project.meetings.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Tab 1: Commitments Feed */}
      {activeTab === "commitments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Active Interagency & Applicant Commitments
            </h2>
            <Button type="button" size="sm" disabled title="Use the governed project action workflow to create a commitment." className="bg-slate-300 text-slate-600 font-bold text-xs gap-1.5 shadow-none">
              <Plus className="size-3.5" /> Log New Commitment
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {project.commitments.map((com) => (
              <Card key={com.id} className="border-slate-200 bg-white hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {com.id}
                      </span>
                      <Badge
                        className={
                          com.status === "on_track"
                            ? "bg-emerald-100 text-emerald-800"
                            : com.status === "at_risk"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }
                      >
                        {com.status.replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>
                    <Badge variant="outline" className="font-bold">
                      {com.committingOrgCode}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900 mt-2">
                    {com.committedAction}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Made by: <strong className="text-slate-700">{com.madeByPersonName}</strong> ({com.originContext})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg bg-amber-500/10 p-3 border border-amber-200/60 text-xs">
                    <span className="font-bold text-amber-900 block mb-0.5">Impact if missed:</span>
                    <p className="text-amber-950">{com.impactIfMissed}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <span>Promised date: <strong className="text-slate-900">{com.promisedDueDate}</strong></span>
                    {com.isCriticalPathImpact && (
                      <Badge className="bg-purple-100 text-purple-800 text-[10px]">Critical Path Impact</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Decision Logs */}
      {activeTab === "decisions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Permanent Institutional Decision Log
            </h2>
            <Button type="button" size="sm" disabled title="Decision recording is not enabled in this read-only cockpit." className="bg-slate-300 text-slate-600 font-bold text-xs gap-1.5 shadow-none">
              <Plus className="size-3.5" /> Record Decision
            </Button>
          </div>

          <div className="space-y-4">
            {project.decisions.map((dec) => (
              <div key={dec.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500">{dec.id}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-mono font-semibold text-slate-600">{dec.decisionDate}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1">{dec.title}</h3>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-500">Decision Authority</div>
                    <div className="text-xs font-bold text-slate-900">{dec.decisionMakerName}</div>
                    <div className="text-[11px] text-slate-500">{dec.decisionMakerTitle}</div>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                  {dec.decisionSummary}
                </p>

                <div className="rounded-lg bg-indigo-50/50 p-2.5 border border-indigo-100 text-xs text-indigo-900">
                  <span className="font-bold">Statutory Authority: </span>
                  <span>{dec.statutoryAuthority}</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span>Participating Orgs:</span>
                    {dec.organizationsRepresented.map((org) => (
                      <Badge key={org} variant="secondary" className="text-[10px]">
                        {org}
                      </Badge>
                    ))}
                  </div>
                  <div>
                    <span>Affected tracks: {dec.affectedWorkstreamTitles.join(", ")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Meetings & Action Conversions */}
      {activeTab === "meetings" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Interagency Meetings & Workflow Action Pipeline
            </h2>
            <Button type="button" size="sm" disabled title="Meeting note capture is not enabled in this read-only cockpit." className="bg-slate-300 text-slate-600 font-bold text-xs gap-1.5 shadow-none">
              <Plus className="size-3.5" /> Log Standup Notes
            </Button>
          </div>

          <div className="space-y-4">
            {project.meetings.map((mtg) => (
              <div key={mtg.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500">{mtg.id}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-mono font-semibold text-slate-600">{mtg.meetingDate}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1">{mtg.title}</h3>
                  </div>

                  <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">
                    {mtg.locationOrLink}
                  </Badge>
                </div>

                <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-900 block mb-1">Executive Standup Notes:</span>
                  {mtg.meetingNotes}
                </div>

                {/* Workflow Converted Objects */}
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5 text-indigo-950 font-bold">
                    <Sparkles className="size-4 text-indigo-600" />
                    <span>Converted into Live Tracking Objects:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-white text-indigo-700 border-indigo-200 font-bold">
                      {mtg.actionItemsConverted.commitmentsCreated} Commitments
                    </Badge>
                    <Badge className="bg-white text-emerald-700 border-emerald-200 font-bold">
                      {mtg.actionItemsConverted.tasksCreated} DAG Tasks
                    </Badge>
                    <Badge className="bg-white text-purple-700 border-purple-200 font-bold">
                      {mtg.actionItemsConverted.decisionsLogged} Decisions Logged
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
