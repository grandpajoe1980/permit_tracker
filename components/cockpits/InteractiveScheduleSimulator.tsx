"use client";

import React, { useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Flame,
  GitBranch,
  Layers,
  Minus,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getFullProjectRecord } from "@/lib/permit-utils";
import {
  applyTaskAdjustment,
  calculateScheduleSensitivity,
  compareScenarios,
  createScenarioFromWorkstreams,
  getScenarioPresets,
  type ScheduleScenario,
} from "@/lib/engines/simulation-engine";

export function InteractiveScheduleSimulator() {
  const project = getFullProjectRecord();
  const presets = getScenarioPresets(project.workstreams);

  // Active base scenario (live forecast)
  const baseForecastScenario = presets[0];

  // Active simulated scenario branch
  const [currentScenario, setCurrentScenario] = useState<ScheduleScenario>(presets[0]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>(project.workstreams[0]?.tasks[0]?.id || "");
  const [simulationView, setSimulationView] = useState<"adjust" | "comparison" | "sensitivity">("adjust");
  const [promotionNotice, setPromotionNotice] = useState<string>("");

  // Calculate comparison against live forecast
  const comparison = compareScenarios(baseForecastScenario, currentScenario);
  const sensitivity = calculateScheduleSensitivity(currentScenario);

  const handleAdjustDuration = (taskId: string, deltaDays: number) => {
    const updated = applyTaskAdjustment(
      currentScenario,
      taskId,
      deltaDays,
      `User adjusted by ${deltaDays > 0 ? "+" : ""}${deltaDays} days`
    );
    setCurrentScenario(updated);
  };

  const handleSelectPreset = (preset: ScheduleScenario) => {
    setCurrentScenario(preset);
  };

  const handleResetToForecast = () => {
    setCurrentScenario(presets[0]);
  };

  const handlePromoteScenario = () => {
    setPromotionNotice(`✓ Scenario "${currentScenario.name}" promoted to Active Forecast baseline.`);
    setTimeout(() => setPromotionNotice(""), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Scenario Branch & Delta Summary */}
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-500/20 text-indigo-200 border-indigo-500/30">
                DAG Schedule Simulation & Branching Engine
              </Badge>
              <span className="text-xs text-slate-400 font-mono">Branch: {currentScenario.name}</span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              &quot;What-If&quot; Schedule Perturbation &amp; Scenario Simulator
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Drag and adjust task durations, simulate interagency review delays, and observe real-time critical-path ripple effects.
            </p>
          </div>

          {/* Key Simulation Delta Cards */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Baseline Launch
              </div>
              <div className="text-lg font-mono font-bold text-white">2026-12-01</div>
            </div>

            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-center backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Simulated Launch
              </div>
              <div className="text-xl font-mono font-black text-white">
                {currentScenario.projectLaunchDate}
              </div>
            </div>

            <div
              className={`rounded-xl border px-4 py-2.5 text-center backdrop-blur ${
                comparison.launchDateDeltaDays > 0
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                  : comparison.launchDateDeltaDays < 0
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-500/30 bg-slate-500/10 text-slate-300"
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wider">
                Scenario Delta
              </div>
              <div className="text-xl font-mono font-black">
                {comparison.launchDateDeltaDays > 0 ? `+${comparison.launchDateDeltaDays}d` : `${comparison.launchDateDeltaDays}d`}
              </div>
            </div>
          </div>
        </div>

        {/* Preset Selector Bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-300 mr-1 flex items-center gap-1">
              <GitBranch className="size-3.5" /> Scenario Presets:
            </span>
            {presets.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={currentScenario.name === p.name ? "default" : "outline"}
                onClick={() => handleSelectPreset(p)}
                className={`text-xs font-semibold h-7 ${
                  currentScenario.name === p.name
                    ? "bg-indigo-600 text-white font-bold"
                    : "bg-white/5 border-white/20 text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {p.name}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleResetToForecast}
              className="text-xs h-7 border-white/20 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white gap-1"
            >
              <RotateCcw className="size-3" /> Reset to Active Forecast
            </Button>
            <Button
              size="sm"
              onClick={handlePromoteScenario}
              className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 shadow"
            >
              <CheckCircle2 className="size-3" /> Promote Scenario
            </Button>
          </div>
        </div>
      </div>

      {promotionNotice && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-900 flex items-center justify-between">
          <span>{promotionNotice}</span>
        </div>
      )}

      {/* Simulator View Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={simulationView === "adjust" ? "default" : "outline"}
            onClick={() => setSimulationView("adjust")}
            className="text-xs font-bold gap-1.5"
          >
            <Zap className="size-3.5" /> Interactive Task Duration Adjuster
          </Button>
          <Button
            size="sm"
            variant={simulationView === "comparison" ? "default" : "outline"}
            onClick={() => setSimulationView("comparison")}
            className="text-xs font-bold gap-1.5"
          >
            <Scale className="size-3.5" /> Scenario Comparison Diff ({comparison.workstreamDeltas.filter((d) => d.deltaDays !== 0).length} Shifts)
          </Button>
          <Button
            size="sm"
            variant={simulationView === "sensitivity" ? "default" : "outline"}
            onClick={() => setSimulationView("sensitivity")}
            className="text-xs font-bold gap-1.5"
          >
            <ShieldAlert className="size-3.5" /> Schedule Sensitivity & Fragility Heatmap
          </Button>
        </div>

        <Badge variant="outline" className="font-mono text-xs">
          {Object.keys(currentScenario.adjustments).length} Tasks Perturbed
        </Badge>
      </div>

      {/* VIEW 1: Interactive Task Duration Adjuster */}
      {simulationView === "adjust" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Tasks List with Dynamic Sliders */}
          <div className="lg:col-span-8 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span>Workstream Tasks & Predecessors</span>
              <span className="text-xs font-normal text-slate-500">
                Click +/- or drag to simulate task duration shifts
              </span>
            </h2>

            <div className="space-y-3">
              {currentScenario.tasks.map((task) => {
                const ws = currentScenario.workstreams.find((w) => w.id === task.workstreamId);
                const adjustment = currentScenario.adjustments[task.id];
                const isSelected = selectedTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500 shadow-sm"
                        : task.isCriticalPath
                        ? "border-purple-200 bg-purple-50/20 hover:bg-purple-50/40"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500">{task.id}</span>
                          {task.isCriticalPath && (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] py-0">
                              ⚡ Critical Path
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] font-bold">
                            {task.assignedOrgCode}
                          </Badge>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-600">{ws?.title}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{task.title}</h3>
                      </div>

                      {/* Duration & Adjuster Controls */}
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-2">
                          <div className="text-xs text-slate-500">Duration</div>
                          <div className="text-sm font-mono font-black text-slate-900">
                            {task.durationDays} Days
                          </div>
                          {adjustment && adjustment.durationDeltaDays !== 0 && (
                            <span
                              className={`text-[10px] font-mono font-bold ${
                                adjustment.durationDeltaDays > 0 ? "text-rose-600" : "text-emerald-600"
                              }`}
                            >
                              {adjustment.durationDeltaDays > 0 ? `+${adjustment.durationDeltaDays}d` : `${adjustment.durationDeltaDays}d`}
                            </span>
                          )}
                        </div>

                        {/* Interactive Buttons */}
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAdjustDuration(task.id, -5);
                            }}
                            className="h-6 px-1.5 text-xs text-slate-700 hover:bg-white"
                          >
                            -5d
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAdjustDuration(task.id, -1);
                            }}
                            className="h-6 w-6 p-0 text-xs text-slate-700 hover:bg-white"
                          >
                            <Minus className="size-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAdjustDuration(task.id, 1);
                            }}
                            className="h-6 w-6 p-0 text-xs text-slate-700 hover:bg-white"
                          >
                            <Plus className="size-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAdjustDuration(task.id, 5);
                            }}
                            className="h-6 px-1.5 text-xs text-slate-700 hover:bg-white"
                          >
                            +5d
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Predecessors & Float Footer */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                      <div>
                        <span>
                          Predecessors:{" "}
                          <strong className="text-slate-700">
                            {task.predecessorTaskIds.length > 0
                              ? task.predecessorTaskIds.join(", ")
                              : "None (Initial Task)"}
                          </strong>
                        </span>
                      </div>
                      <div>
                        <span>
                          Total Float:{" "}
                          <strong
                            className={task.floatDays === 0 ? "text-purple-700 font-bold" : "text-slate-700"}
                          >
                            {task.floatDays} Business Days
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Live Impact Card */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="border-slate-200 bg-white shadow-sm sticky top-4">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-indigo-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Live Simulation Impact Radar
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-500">
                  Real-time recalculation of critical path and launch milestone
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-2">
                  <div className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                    Executive Narrative
                  </div>
                  <p className="text-xs text-indigo-950 leading-relaxed font-medium">
                    {comparison.summaryNarrative}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Simulated Critical Workstreams ({currentScenario.criticalWorkstreamIds.length})
                  </div>
                  <div className="space-y-1.5">
                    {currentScenario.criticalWorkstreamIds.map((wsId) => {
                      const ws = currentScenario.workstreams.find((w) => w.id === wsId);
                      return (
                        <div
                          key={wsId}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-purple-100 bg-purple-50/40 text-xs"
                        >
                          <span className="font-bold text-purple-950 truncate max-w-[180px]">
                            {ws?.title}
                          </span>
                          <Badge className="bg-purple-600 text-white text-[10px]">
                            {ws?.regulatoryLead.orgCode}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {comparison.newlyCriticalWorkstreamIds.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1">
                      <AlertTriangle className="size-3.5 text-amber-600" /> Newly Critical Workstreams:
                    </div>
                    <ul className="list-disc list-inside text-amber-950 space-y-0.5">
                      {comparison.newlyCriticalWorkstreamIds.map((id) => (
                        <li key={id}>{currentScenario.workstreams.find((w) => w.id === id)?.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* VIEW 2: Scenario Comparison Diff Table */}
      {simulationView === "comparison" && (
        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-slate-900">
              Scenario Variance & Milestone Comparison Table
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Comparing &quot;{baseForecastScenario.name}&quot; vs. &quot;{currentScenario.name}&quot;
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              <div className="grid grid-cols-12 px-5 py-3 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                <div className="col-span-4">Workstream</div>
                <div className="col-span-2 text-center">Lead Agency</div>
                <div className="col-span-2 text-center">Forecast Target</div>
                <div className="col-span-2 text-center">Simulated Target</div>
                <div className="col-span-2 text-right">Delta & Critical State</div>
              </div>

              {comparison.workstreamDeltas.map((delta) => (
                <div key={delta.workstreamId} className="grid grid-cols-12 items-center px-5 py-3.5 hover:bg-slate-50/60 transition-colors text-xs">
                  <div className="col-span-4 pr-4">
                    <div className="font-bold text-slate-900">{delta.workstreamTitle}</div>
                    <div className="font-mono text-[11px] text-slate-400">{delta.workstreamCode}</div>
                  </div>

                  <div className="col-span-2 text-center">
                    <Badge variant="outline">{delta.leadAgencyCode}</Badge>
                  </div>

                  <div className="col-span-2 text-center font-mono text-slate-600">
                    {delta.baseTargetDate}
                  </div>

                  <div className="col-span-2 text-center font-mono font-bold text-slate-900">
                    {delta.simulatedTargetDate}
                  </div>

                  <div className="col-span-2 text-right">
                    {delta.deltaDays !== 0 ? (
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-mono font-bold ${
                          delta.deltaDays > 0
                            ? "bg-rose-50 text-rose-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {delta.deltaDays > 0 ? `+${delta.deltaDays}d slip` : `${delta.deltaDays}d gain`}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-mono">No Change</span>
                    )}
                    {delta.isNowCritical && (
                      <div className="text-[10px] font-bold text-purple-700 mt-0.5">
                        ⚡ Critical Path
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* VIEW 3: Schedule Sensitivity & Fragility Heatmap */}
      {simulationView === "sensitivity" && (
        <div className="space-y-4">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-900">
                Schedule Vulnerability & Critical Path Fragility Ranking
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Evaluates which workstreams have the lowest float and would immediately slip project launch if disrupted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sensitivity.map((item) => (
                <div
                  key={item.workstreamId}
                  className={`p-4 rounded-xl border transition-all ${
                    item.riskCategory === "critical_path"
                      ? "border-purple-300 bg-purple-50/30"
                      : item.riskCategory === "high_risk"
                      ? "border-rose-300 bg-rose-50/20"
                      : item.riskCategory === "moderate_risk"
                      ? "border-amber-200 bg-amber-50/10"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500">{item.workstreamCode}</span>
                        <Badge
                          className={
                            item.riskCategory === "critical_path"
                              ? "bg-purple-100 text-purple-800"
                              : item.riskCategory === "high_risk"
                              ? "bg-rose-100 text-rose-800"
                              : item.riskCategory === "moderate_risk"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }
                        >
                          {item.riskCategory.replace("_", " ").toUpperCase()}
                        </Badge>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{item.workstreamTitle}</h4>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-500">Total Float Buffer</div>
                      <div className="text-base font-mono font-black text-slate-900">
                        {item.currentFloatDays} Days
                      </div>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-slate-600 bg-white/80 p-2.5 rounded border border-slate-100">
                    {item.impactExplanation}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
