import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the catalog's animation and scrolling utilities", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /scroll-fade-reveal-b/);
  assert.match(css, /mask-image:/);
  assert.match(css, /tw-shimmer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("renders all 8 specialized delivery cockpits via SSR static markup asserting key UI structures", async () => {
  // 1. SpaceXNoSurprises
  const { SpaceXNoSurprises } = await vite.ssrLoadModule("/components/cockpits/SpaceXNoSurprises.tsx");
  const htmlNoSurprises = renderToStaticMarkup(React.createElement(SpaceXNoSurprises));
  assert.match(htmlNoSurprises, /No-Surprises Delivery Dashboard/);
  assert.match(htmlNoSurprises, /SpaceX Executive Delivery Cockpit/);
  assert.match(htmlNoSurprises, /Needs SpaceX/);
  assert.match(htmlNoSurprises, /Needs Government/);
  assert.match(htmlNoSurprises, /Blocked Items/);
  assert.match(htmlNoSurprises, /Upcoming Decisions/);
  assert.match(htmlNoSurprises, /Currently with:/);
  assert.match(htmlNoSurprises, /They are doing:/);
  assert.match(htmlNoSurprises, /Waiting on:/);
  assert.match(htmlNoSurprises, /SpaceX action required:/);
  assert.match(htmlNoSurprises, /State Concierge:/);
  assert.match(htmlNoSurprises, /Sarah Johnson/);
  assert.match(htmlNoSurprises, /WS-LA82-HEAVYHAUL/);
  assert.match(htmlNoSurprises, /Sep 28, 2026/);

  // 2. DailyCommandCenter
  const { DailyCommandCenter } = await vite.ssrLoadModule("/components/cockpits/DailyCommandCenter.tsx");
  const htmlDaily = renderToStaticMarkup(React.createElement(DailyCommandCenter));
  assert.match(htmlDaily, /Daily Coordination Command Center/);
  assert.match(htmlDaily, /Morning Standup Radar/);
  assert.match(htmlDaily, /Sunday, August 30, 2026/);
  assert.match(htmlDaily, /Start Coordination Review/);
  assert.match(htmlDaily, /New Blockers/);
  assert.match(htmlDaily, /Overdue Commitments/);
  assert.match(htmlDaily, /Active Coordination Exceptions/);
  assert.match(htmlDaily, /CR-00451/);
  assert.match(htmlDaily, /COM-003/);

  // 3. WorkstreamGraphGantt
  const { WorkstreamGraphGantt } = await vite.ssrLoadModule("/components/cockpits/WorkstreamGraphGantt.tsx");
  const htmlGantt = renderToStaticMarkup(React.createElement(WorkstreamGraphGantt));
  assert.match(htmlGantt, /Project Delivery Schedule &amp; Variance Engine|Project Delivery Schedule & Variance Engine/);
  assert.match(htmlGantt, /Critical Path Execution Graph/);
  assert.match(htmlGantt, /\+13 Days/);
  assert.match(htmlGantt, /2026-12-15/);
  assert.match(htmlGantt, /2026-12-28/);
  assert.match(htmlGantt, /WS-LA82-HEAVYHAUL/);

  // 4. InteragencyCoordinationPanel
  const { InteragencyCoordinationPanel } = await vite.ssrLoadModule("/components/cockpits/InteragencyCoordinationPanel.tsx");
  const htmlCoordination = renderToStaticMarkup(React.createElement(InteragencyCoordinationPanel));
  assert.match(htmlCoordination, /Interagency Action &amp; Concurrency Framework|Interagency Action & Concurrency Framework/);
  assert.match(htmlCoordination, /Consolidated RFI Batch Cycle/);
  assert.match(htmlCoordination, /CR-00451/);
  assert.match(htmlCoordination, /CR-00452/);
  assert.match(htmlCoordination, /CR-00453/);
  assert.match(htmlCoordination, /Dispatch Consolidated Batch/);

  // 5. DocumentVaultPanel
  const { DocumentVaultPanel } = await vite.ssrLoadModule("/components/cockpits/DocumentVaultPanel.tsx");
  const htmlVault = renderToStaticMarkup(React.createElement(DocumentVaultPanel));
  assert.match(htmlVault, /Project Document Vault/);
  assert.match(htmlVault, /Single Source of Truth Document Vault/);
  assert.match(htmlVault, /Cross-Agency Revision Certification Matrix/);
  assert.match(htmlVault, /Immutable Version Ledger/);
  assert.match(htmlVault, /SHA-256/);
  assert.match(htmlVault, /LA-82 Heavy-Haul Drainage/);

  // 6. CommitmentsDecisionsPanel
  const { CommitmentsDecisionsPanel } = await vite.ssrLoadModule("/components/cockpits/CommitmentsDecisionsPanel.tsx");
  const htmlCommitments = renderToStaticMarkup(React.createElement(CommitmentsDecisionsPanel));
  assert.match(htmlCommitments, /Institutional Memory &amp; Accountability|Institutional Memory & Accountability/);
  assert.match(htmlCommitments, /COM-001/);
  assert.match(htmlCommitments, /COM-002/);
  assert.match(htmlCommitments, /Impact if missed/);
  assert.match(htmlCommitments, /Jean-Paul Guidry/);

  // 7. WorkflowDesignerPanel
  const { WorkflowDesignerPanel } = await vite.ssrLoadModule("/components/cockpits/WorkflowDesignerPanel.tsx");
  const htmlWorkflow = renderToStaticMarkup(React.createElement(WorkflowDesignerPanel));
  assert.match(htmlWorkflow, /Workflow Designer &amp; Permit Catalog|Workflow Designer & Permit Catalog/);
  assert.match(htmlWorkflow, /Coastal Use Permit Standard Review/);
  assert.match(htmlWorkflow, /v4/);
  assert.match(htmlWorkflow, /CPRA/);

  // 8. PreApplicationReadinessPanel
  const { PreApplicationReadinessPanel } = await vite.ssrLoadModule("/components/cockpits/PreApplicationReadinessPanel.tsx");
  const htmlReadiness = renderToStaticMarkup(React.createElement(PreApplicationReadinessPanel));
  assert.match(htmlReadiness, /Pre-Application Acceleration Workspace/);
  assert.match(htmlReadiness, /86%/);
  assert.match(htmlReadiness, /230kV Substation Expansion Phase II/);
  assert.match(htmlReadiness, /Electrical Engineering Single-Line Drawings/);
  assert.match(htmlReadiness, /Acceleration Principle/);

  // 9. ExecutiveBriefingReport
  const { ExecutiveBriefingReport } = await vite.ssrLoadModule("/components/cockpits/ExecutiveBriefingReport.tsx");
  const htmlBriefing = renderToStaticMarkup(React.createElement(ExecutiveBriefingReport));
  assert.match(htmlBriefing, /Governor&#x27;s Weekly Megaproject Briefing|Governor's Weekly Megaproject Briefing/);
  assert.match(htmlBriefing, /Print \/ Export PDF Briefing/);
  assert.match(htmlBriefing, /Critical Path Bottlenecks &amp; Slippage|Critical Path Bottlenecks/);

  // 10. PublicTransparencyPortal
  const { PublicTransparencyPortal } = await vite.ssrLoadModule("/components/cockpits/PublicTransparencyPortal.tsx");
  const htmlPublic = renderToStaticMarkup(React.createElement(PublicTransparencyPortal));
  assert.match(htmlPublic, /Vermilion Parish Public Transparency &amp; Citizen Portal|Vermilion Parish Public Transparency/);
  assert.match(htmlPublic, /Active Statutory Public Notice Periods/);
  assert.match(htmlPublic, /Submit Official Public Comment/);
});

