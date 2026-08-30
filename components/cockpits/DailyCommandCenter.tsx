"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Flame,
  MessageSquare,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDailyCommandCenterExceptions } from "@/lib/permit-utils";
import { runDailySlaEscalationScan, type SlaScanResult } from "@/lib/engines/sla-worker";

interface DailyCommandCenterProps {
  onSelectProject?: (workstreamId?: string) => void;
  onSelectWorkstream?: (wsId: string) => void;
}

export function DailyCommandCenter({ onSelectProject, onSelectWorkstream }: DailyCommandCenterProps = {}) {
  const exceptions = getDailyCommandCenterExceptions();
  const [reviewActive, setReviewActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [reviewedItems, setReviewedItems] = useState<Set<number>>(new Set());
  const [slaScanResult, setSlaScanResult] = useState<SlaScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleTriggerSlaScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const result = runDailySlaEscalationScan();
      setSlaScanResult(result);
      setIsScanning(false);
    }, 400);
  };


  // Build the list of human-attention items for the morning standup
  const reviewQueue = [
    {
      id: "item-1",
      workstreamId: "WS-LA82-HEAVYHAUL",
      category: "Blocker Intervention",
      badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
      title: "LA-82 Heavy-Haul: CPRA Drainage Concurrence (CR-00451)",
      description: "DOTD cannot issue superload bridge reinforcement permit until CPRA signs off on Culvert 14B hydrodynamic model. +13 days schedule variance on Critical Path.",
      owner: "Jean-Paul Guidry (CPRA) & Mark Fontenot (DOTD)",
      action: "Convene rapid technical clearance call between DOTD and CPRA coastal hydraulics engineers.",
      buttonLabel: "Send Joint Agency Meeting Invite",
    },
    {
      id: "item-2",
      workstreamId: "WS-WETLANDS-PAD-A",
      category: "Overdue Commitment",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
      title: "USACE Section 404 Completeness Letter (COM-003)",
      description: "USACE committed on Aug 24 to issue formal completeness determination by Sep 2. Delineation GIS was uploaded Aug 29 and approved.",
      owner: "Martin Breaux (USACE New Orleans District)",
      action: "Prompt USACE Regulatory PM to issue formal letter to trigger 30-day federal public notice publication.",
      buttonLabel: "Dispatch Status Reminder",
    },
    {
      id: "item-3",
      workstreamId: "WS-LA82-HEAVYHAUL",
      category: "Applicant RFI Response",
      badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
      title: "SpaceX Rev 9 Axle Load Distribution Drawings (RFI-2026-0042)",
      description: "SpaceX engineering submitted revised axle spacing drawings for dual-trailer transport across Freshwater Bayou Bridge. Ready for DOTD Bridge Bureau signoff.",
      owner: "Mark Fontenot, PE (DOTD)",
      action: "Review SpaceX drawing package and accept response to resume permit clock.",
      buttonLabel: "Accept RFI & Resume Review Clock",
    },
    {
      id: "item-4",
      workstreamId: "WS-WASTEWATER-DELUGE",
      category: "Escalation Tier 2",
      badgeClass: "bg-purple-100 text-purple-800 border-purple-200",
      title: "LDEQ Deluge Basin Public Hearing Comments (WS-WASTEWATER-DELUGE)",
      description: "15-day post-hearing public comment closure window completes Sep 4. Draft LPDES permit ready for interagency dispatch.",
      owner: "Dr. Rachel Benoit (LDEQ Water Permits)",
      action: "Confirm water quality responses and transmit draft permit to EPA Region 6 liaison.",
      buttonLabel: "Authorize Draft Permit Release",
    },
  ];

  const currentItem = reviewQueue[currentStepIndex];

  const handleMarkAction = () => {
    setReviewedItems((prev) => new Set(prev).add(currentStepIndex));
    if (currentStepIndex < reviewQueue.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      setReviewActive(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Exception Counter & Quick Start Review Button */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-rose-50 text-rose-700 border-rose-200">
                Morning Standup Radar
              </Badge>
              <span className="text-xs text-slate-500 font-mono">
                Sunday, August 30, 2026
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900">
              Daily Coordination Command Center
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {reviewQueue.length} exceptions require human attention today across state and federal agencies.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={isScanning}
              onClick={handleTriggerSlaScan}
              className="border-indigo-200 bg-indigo-50/50 text-indigo-900 hover:bg-indigo-100 text-xs font-bold gap-1.5 h-9"
            >
              <RotateCcw className={`size-3.5 ${isScanning ? "animate-spin" : ""}`} />
              {isScanning ? "Evaluating SLAs..." : "Run Midnight SLA Escalation Scan"}
            </Button>

            {!reviewActive ? (
              <Button
                onClick={() => {
                  setReviewActive(true);
                  setCurrentStepIndex(0);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 font-bold text-white shadow-md gap-2 h-9 text-xs"
              >
                <Play className="size-3.5 fill-white" />
                Start Coordination Review
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setReviewActive(false)}
                className="gap-1 text-xs h-9"
              >
                Exit Stepper
              </Button>
            )}
          </div>
        </div>

        {/* SLA Scan Result Banner */}
        {slaScanResult && (
          <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/80 p-4 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-indigo-950">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-indigo-600" />
                Automated SLA Worker Scan Complete ({new Date(slaScanResult.scanTimestamp).toLocaleTimeString()})
              </span>
              <Badge className="bg-indigo-200 text-indigo-900 border-indigo-300">
                {slaScanResult.evaluatedWorkstreamsCount} Workstreams Evaluated
              </Badge>
            </div>
            <p className="text-indigo-900">
              Scanned all active workstreams against statutory review clocks and 5-tier escalation policies.{" "}
              <strong>{slaScanResult.newlyEscalatedCount}</strong> newly escalated items,{" "}
              <strong>{slaScanResult.executiveAlertsCount}</strong> executive intervention alerts generated.
            </p>
          </div>
        )}


        {/* Morning Exception Stats Matrix */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-center">
            <div className="text-xs font-semibold text-rose-800">New Blockers</div>
            <div className="mt-1 text-2xl font-black text-rose-900">{exceptions.blockerCount}</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-center">
            <div className="text-xs font-semibold text-amber-800">Overdue Commitments</div>
            <div className="mt-1 text-2xl font-black text-amber-900">{exceptions.overdueCommitmentCount}</div>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 text-center">
            <div className="text-xs font-semibold text-indigo-800">RFI Responses</div>
            <div className="mt-1 text-2xl font-black text-indigo-900">1</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-center">
            <div className="text-xs font-semibold text-emerald-800">Approvals Done</div>
            <div className="mt-1 text-2xl font-black text-emerald-900">3</div>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 text-center">
            <div className="text-xs font-semibold text-sky-800">Deadlines &lt; 7d</div>
            <div className="mt-1 text-2xl font-black text-sky-900">{exceptions.nearDeadlineCount}</div>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 text-center">
            <div className="text-xs font-semibold text-purple-800">Critical Path Slips</div>
            <div className="mt-1 text-2xl font-black text-purple-900">1</div>
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3 text-center">
            <div className="text-xs font-semibold text-orange-800">Agency Escalations</div>
            <div className="mt-1 text-2xl font-black text-orange-900">{exceptions.escalationCount}</div>
          </div>
        </div>
      </div>

      {/* Interactive "Start Coordination Review" Guided Stepper Mode */}
      {reviewActive && currentItem && (
        <Card className="border-indigo-300 bg-gradient-to-br from-indigo-50/50 via-white to-indigo-50/30 shadow-lg">
          <CardHeader className="border-b border-indigo-100 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={currentItem.badgeClass}>{currentItem.category}</Badge>
                <span className="text-xs font-semibold text-indigo-700">
                  Exception {currentStepIndex + 1} of {reviewQueue.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {reviewQueue.map((_, idx) => (
                  <div
                    key={idx}
                    className={`size-2.5 rounded-full transition-colors ${
                      idx === currentStepIndex
                        ? "bg-indigo-600 ring-2 ring-indigo-300"
                        : reviewedItems.has(idx)
                        ? "bg-emerald-500"
                        : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
            </div>
            <CardTitle className="text-xl font-bold text-slate-900 mt-2">
              {currentItem.title}
            </CardTitle>
            <CardDescription className="text-slate-600 text-sm">
              Accountable Owners: <strong className="text-slate-800">{currentItem.owner}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="rounded-lg bg-white p-4 border border-slate-200 text-sm text-slate-700 leading-relaxed shadow-sm">
              {currentItem.description}
            </div>

            <div className="rounded-lg bg-indigo-900/10 border border-indigo-200 p-4 text-xs">
              <span className="font-bold text-indigo-900 uppercase tracking-wider block mb-1">
                Recommended Action:
              </span>
              <p className="text-indigo-950 font-medium">{currentItem.action}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentStepIndex === 0}
                  onClick={() => setCurrentStepIndex(currentStepIndex - 1)}
                  className="text-xs gap-1"
                >
                  <ChevronLeft className="size-3.5" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentStepIndex === reviewQueue.length - 1}
                  onClick={() => setCurrentStepIndex(currentStepIndex + 1)}
                  className="text-xs gap-1"
                >
                  Next <ChevronRight className="size-3.5" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleMarkAction}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow"
                >
                  <CheckCircle2 className="size-3.5" />
                  {currentItem.buttonLabel}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exception Action Cards List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span>Active Coordination Exceptions</span>
          <Badge variant="outline" className="text-xs font-mono">
            {reviewQueue.length} items
          </Badge>
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {reviewQueue.map((item, idx) => (
            <Card key={item.id} className="border-slate-200 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge className={item.badgeClass}>{item.category}</Badge>
                  {reviewedItems.has(idx) && (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-xs">
                      <CheckCircle2 className="size-3" /> Reviewed
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base font-bold text-slate-900 mt-2">
                  <button
                    type="button"
                    onClick={() => (onSelectWorkstream ?? onSelectProject)?.(item.workstreamId)}
                    className="text-left hover:text-indigo-600 hover:underline cursor-pointer transition-colors"
                    title="View workstream on project page"
                  >
                    {item.title}
                  </button>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {item.owner}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.description}
                </p>
                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => (onSelectWorkstream ?? onSelectProject)?.(item.workstreamId)}
                    className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                  >
                    View on project page →
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReviewActive(true);
                      setCurrentStepIndex(idx);
                    }}
                    className="text-xs text-slate-700 hover:text-indigo-600 font-semibold gap-1"
                  >
                    Open Review <ArrowRight className="size-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
