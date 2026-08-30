"use client";

import React from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Layers,
  Plus,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getFullProjectRecord } from "@/lib/permit-utils";

export function PreApplicationReadinessPanel() {
  const project = getFullProjectRecord();
  const preAppWorkstream = project.workstreams.find((ws) => ws.readinessChecklist);
  const checklist = preAppWorkstream?.readinessChecklist;

  if (!checklist || !preAppWorkstream) return null;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">
                Pre-Application Acceleration Workspace
              </Badge>
              <span className="text-xs text-slate-500 font-mono">Filing Readiness: {checklist.overallReadinessPercent}%</span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900">
              Pre-Application Coordination & Readiness Checklist
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Identify required engineering packages, environmental surveys, and consultation tracks before formal statutory clocks begin.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center">
              <div className="text-xs font-semibold text-emerald-800">Filing Readiness Score</div>
              <div className="text-2xl font-black text-emerald-900">{checklist.overallReadinessPercent}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Checklist Card */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="font-mono text-xs">
              {preAppWorkstream.code}
            </Badge>
            <span className="text-xs text-slate-500">
              Target Formal Filing Date: <strong className="text-slate-900">{checklist.targetFilingDate}</strong>
            </span>
          </div>
          <CardTitle className="text-lg font-bold text-slate-900 mt-2">
            {preAppWorkstream.title}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            State Concierge: <strong className="text-slate-700">{preAppWorkstream.governmentConcierge.name}</strong> · Lead Agency: <strong className="text-slate-700">{preAppWorkstream.regulatoryLead.orgName}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-5 space-y-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 text-xs text-emerald-900 flex items-center justify-between">
            <div>
              <strong className="font-bold">Acceleration Principle: </strong>
              The fastest permit review is the one submitted with complete, verified prerequisite packages the first time.
            </div>
            <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 shadow">
              <Send className="size-3.5" /> Submit Complete Application
            </Button>
          </div>

          <div className="space-y-3">
            {checklist.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{item.itemName}</h4>
                    <Badge
                      className={
                        item.status === "ready"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.status === "underway"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }
                    >
                      {item.status.toUpperCase()}
                    </Badge>
                  </div>
                  {item.notes && <p className="text-xs text-slate-500">{item.notes}</p>}
                </div>

                <div className="text-right text-xs">
                  <span className="text-slate-400">Assigned: </span>
                  <strong className="text-slate-700">{item.assignedParty}</strong>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
