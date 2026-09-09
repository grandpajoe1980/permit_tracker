"use client";

import React, { useState, useMemo } from "react";
import type { OperationalWorkItem, QueueGroup } from "@/lib/operational-ux";
import { WorkInboxRow } from "./WorkInboxRow";

export interface WorkInboxViewProps {
  groups: QueueGroup[];
  onOpenItem: (item: OperationalWorkItem) => void;
  title?: string;
  subtitle?: string;
  activeTab?: "needs_action" | "waiting" | "recently_completed";
  onActiveTabChange?: (tab: "needs_action" | "waiting" | "recently_completed") => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

const EMPTY_ITEMS: OperationalWorkItem[] = [];

export function WorkInboxView({
  groups,
  onOpenItem,
  title = "My Work",
  subtitle = "Prioritized operational actions assigned to you.",
  activeTab: controlledActiveTab,
  onActiveTabChange,
  searchQuery: controlledSearchQuery,
  onSearchQueryChange,
}: WorkInboxViewProps) {
  const [now] = useState(() => Date.now());
  const [localActiveTab, setLocalActiveTab] = useState<"needs_action" | "waiting" | "recently_completed">("needs_action");
  const [filterDueSoon, setFilterDueSoon] = useState(false);
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedKind, setSelectedKind] = useState<string>("all");
  const activeTab = controlledActiveTab ?? localActiveTab;
  const searchQuery = controlledSearchQuery ?? localSearchQuery;
  const setActiveTab = (tab: "needs_action" | "waiting" | "recently_completed") => {
    onActiveTabChange?.(tab);
    if (controlledActiveTab === undefined) setLocalActiveTab(tab);
  };
  const setSearchQuery = (query: string) => {
    onSearchQueryChange?.(query);
    if (controlledSearchQuery === undefined) setLocalSearchQuery(query);
  };

  const needsActionItems = groups.find((g) => g.id === "needs_action")?.items ?? EMPTY_ITEMS;
  const dueSoonItems = groups.find((g) => g.id === "due_soon")?.items ?? EMPTY_ITEMS;
  const waitingItems = groups.find((g) => g.id === "waiting")?.items ?? EMPTY_ITEMS;
  const completedItems = groups.find((g) => g.id === "recently_completed")?.items ?? EMPTY_ITEMS;

  const tabItems = useMemo(() => {
    if (activeTab === "needs_action") {
      let items = [...needsActionItems];
      if (filterDueSoon) {
        items = [...items, ...dueSoonItems];
      }
      return items;
    }
    if (activeTab === "waiting") return waitingItems;
    return completedItems;
  }, [activeTab, filterDueSoon, needsActionItems, dueSoonItems, waitingItems, completedItems]);

  const filteredItems = useMemo(() => {
    let result = tabItems;
    if (filterOverdue) {
      result = result.filter((item) => {
        if (!item.dueDate) return false;
        const d = new Date(`${item.dueDate}T12:00:00`).valueOf();
        return d < now;
      });
    }
    if (selectedKind !== "all") {
      result = result.filter((item) => item.kind === selectedKind);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) => [
          item.title,
          item.id,
          item.workstreamTitle,
          item.sourceRfi?.questionText,
          ...(item.sourceRfi?.responses ?? []).map((response) => response.responseText),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    return result;
  }, [tabItems, filterOverdue, selectedKind, searchQuery, now]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Operational inbox</p>
          <h1 className="mt-1 text-2xl font-black text-[#00284d] sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterDueSoon((prev) => !prev)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition border ${
              filterDueSoon
                ? "bg-amber-100 text-amber-900 border-amber-300"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            Due soon ({dueSoonItems.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterOverdue((prev) => !prev)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition border ${
              filterOverdue
                ? "bg-red-100 text-red-900 border-red-300"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            Overdue
          </button>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Filters {showAdvancedFilters ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {showAdvancedFilters && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">Type:</span>
            <select
              value={selectedKind}
              onChange={(e) => setSelectedKind(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 font-semibold"
            >
              <option value="all">All Types</option>
              <option value="task">Task</option>
              <option value="workflow">Workflow</option>
              <option value="rfi">RFI</option>
              <option value="coordination">Coordination</option>
              <option value="document">Document</option>
              <option value="customer_request">Customer Request</option>
            </select>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("needs_action")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
            activeTab === "needs_action"
              ? "bg-[#00284d] text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <span>Needs my action</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
              activeTab === "needs_action" ? "bg-white/20 text-white" : "bg-white text-slate-700"
            }`}
          >
            {needsActionItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("waiting")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
            activeTab === "waiting"
              ? "bg-[#00284d] text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <span>Waiting</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
              activeTab === "waiting" ? "bg-white/20 text-white" : "bg-white text-slate-700"
            }`}
          >
            {waitingItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("recently_completed")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
            activeTab === "recently_completed"
              ? "bg-[#00284d] text-white shadow-xs"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <span>Completed</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
              activeTab === "recently_completed" ? "bg-white/20 text-white" : "bg-white text-slate-700"
            }`}
          >
            {completedItems.length}
          </span>
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <input
            type="search"
            aria-label="Search work inbox"
            placeholder="Search work inbox..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs placeholder:text-slate-400 focus:border-teal-500 focus:outline-none"
          />
          <p className="text-left text-xs font-bold text-slate-500 sm:shrink-0 sm:text-right">
            Showing {filteredItems.length} items
          </p>
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            <p className="text-sm font-semibold text-slate-800">
              {activeTab === "needs_action"
                ? "No items requiring your action."
                : activeTab === "waiting"
                ? "No items currently waiting on external response."
                : "No completed items in recent history."}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {searchQuery.trim() || filterOverdue || filterDueSoon || selectedKind !== "all"
                ? "Try clearing your search or adjusting filters."
                : "Your inbox is completely up to date."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item) => (
              <WorkInboxRow key={item.id} item={item} onOpen={onOpenItem} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
