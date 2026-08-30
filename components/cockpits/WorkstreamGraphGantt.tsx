"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Flame,
  GitBranch,
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

import { InteractiveScheduleSimulator } from "./InteractiveScheduleSimulator";

export function WorkstreamGraphGantt() {
  const project = getFullProjectRecord();
  const schedule = evaluateProjectSchedule(project.workstreams);
  const [activeTab, setActiveTab] = useState<"graph" | "simulator" | "delays" | "acceleration">("graph");


  return (
    <div className="space-y-6">
      {/* Top Banner: Schedule Intelligence Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                Critical Path Execution Graph & Intelligence
              </Badge>
              <span className="text-xs font-mono text-slate-500">{project.code}</span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900">
              Project Delivery Schedule & Variance Engine
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Deterministic critical-path dependency graph, immutable baseline tracking, and delay attribution.
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
          <Button
            variant={activeTab === "simulator" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("simulator")}
            className="text-xs gap-1.5 font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Zap className="size-3.5" /> Interactive "What-If" Simulator
          </Button>
          <Button
            variant={activeTab === "graph" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("graph")}
            className="text-xs gap-1.5"
          >
            <GitBranch className="size-3.5" /> Workstream DAG & Baseline Comparison
          </Button>
          <Button
            variant={activeTab === "delays" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("delays")}
            className="text-xs gap-1.5"
          >
            <Clock3 className="size-3.5" /> Delay Taxonomy Attribution
          </Button>
          <Button
            variant={activeTab === "acceleration" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("acceleration")}
            className="text-xs gap-1.5 text-emerald-700"
          >
            <Sparkles className="size-3.5" /> Parallel Acceleration Opportunities ({schedule.accelerationOpportunities.length})
          </Button>
        </div>
      </div>

      {/* Tab: Interactive What-If Simulator */}
      {activeTab === "simulator" && (
        <InteractiveScheduleSimulator />
      )}


      {/* Tab 1: Workstream DAG & Baseline Comparison Table */}
      {activeTab === "graph" && (
        <div className="space-y-4">
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
              {project.workstreams.map((ws) => (
                <div key={ws.id} className="grid grid-cols-12 items-center px-4 py-3.5 hover:bg-slate-50/80 transition-colors text-sm">
                  <div className="col-span-4 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400 font-bold">{ws.code}</span>
                      {ws.isCriticalPath && (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] py-0">
                          Critical Path
                        </Badge>
                      )}
                    </div>
                    <div className="font-bold text-slate-900 mt-0.5">{ws.title}</div>
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

      {/* Tab 2: Delay Taxonomy Attribution Chart */}
      {activeTab === "delays" && (
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

      {/* Tab 3: Parallel Acceleration Opportunities */}
      {activeTab === "acceleration" && (
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
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
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
