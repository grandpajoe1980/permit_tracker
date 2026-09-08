"use client";

import React, { useState, useMemo } from "react";
import type { OperationalWorkItem } from "@/lib/operational-ux";
import { groupTeamWork, type TeamWorkSectionId } from "@/lib/operational-ux";
import { WorkInboxRow } from "./WorkInboxRow";

export interface TeamWorkViewProps {
  items: OperationalWorkItem[];
  teamOptions: Array<{ id: string; name: string }>;
  selectedTeamId?: string;
  onSelectTeam?: (teamId: string) => void;
  onOpenItem: (item: OperationalWorkItem) => void;
  onTakeOwnership?: (item: OperationalWorkItem) => Promise<void> | void;
  canTakeOwnership?: boolean;
}

export function TeamWorkView({
  items,
  teamOptions,
  selectedTeamId = "all",
  onSelectTeam,
  onOpenItem,
  onTakeOwnership,
  canTakeOwnership = true,
}: TeamWorkViewProps) {
  const [activeTab, setActiveTab] = useState<TeamWorkSectionId>("unassigned");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredByTeam = useMemo(() => {
    if (!selectedTeamId || selectedTeamId === "all") return items;
    return items.filter(
      (item) =>
        item.assignmentGroupId === selectedTeamId ||
        item.ownerOrganization === selectedTeamId
    );
  }, [items, selectedTeamId]);

  const groups = useMemo(() => groupTeamWork(filteredByTeam), [filteredByTeam]);

  const currentGroup = groups.find((g) => g.id === activeTab) || groups[0];

  const visibleItems = useMemo(() => {
    if (!searchQuery.trim()) return currentGroup.items;
    const query = searchQuery.toLowerCase();
    return currentGroup.items.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query) ||
        item.ownerName.toLowerCase().includes(query) ||
        item.workstreamTitle.toLowerCase().includes(query)
    );
  }, [currentGroup, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Operational team workbench</p>
          <h1 className="mt-1 text-2xl font-black text-[#00284d] sm:text-3xl">Team Work</h1>
          <p className="mt-1 text-sm text-slate-600">
            Monitor and claim work across authorized project teams and agencies.
          </p>
        </div>

        {teamOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="team-select" className="text-xs font-bold text-slate-600">Team:</label>
            <select
              id="team-select"
              value={selectedTeamId}
              onChange={(e) => onSelectTeam?.(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-teal-500 focus:outline-none"
            >
              <option value="all">All Teams ({items.length})</option>
              {teamOptions.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setActiveTab(group.id)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === group.id
                ? "bg-[#00284d] text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>{group.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                activeTab === group.id ? "bg-white/20 text-white" : "bg-white text-slate-700"
              }`}
            >
              {group.items.length}
            </span>
          </button>
        ))}
      </div>

      {/* Search and item list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <input
            type="search"
            placeholder={`Filter ${currentGroup.label.toLowerCase()} items...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs placeholder:text-slate-400 focus:border-teal-500 focus:outline-none"
          />
          <p className="text-xs font-bold text-slate-500 shrink-0">
            Showing {visibleItems.length} of {currentGroup.items.length} items
          </p>
        </div>

        {visibleItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500 text-sm">
            No {currentGroup.label.toLowerCase()} items in this team queue.
          </div>
        ) : (
          <div className="space-y-2">
            {visibleItems.map((item) => (
              <WorkInboxRow
                key={item.id}
                item={item}
                onOpen={onOpenItem}
                onClaim={onTakeOwnership}
                canClaim={canTakeOwnership && activeTab === "unassigned"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
