import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, ws: false, watch: null },
});

after(async () => {
  await vite.close();
});

test("Checkpoint 10: the superseded first-use guide is absent", async () => {
  const shellSource = await readFile(new URL("../components/path/AppShell.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(shellSource, /FirstUseGuide|Welcome to PATH|Key Controls Guide|First-use guide/);
});

test("Checkpoint 10: AppShell provides 44px touch targets and persona-selector ID", async () => {
  const { AppShell } = await vite.ssrLoadModule("/components/path/AppShell.tsx");

  const mockPersona = {
    id: "jordan-lee",
    name: "Jordan Lee",
    email: "jordan.lee@deq.louisiana.gov",
    role: "staff",
    roleLabel: "LDEQ Lead Reviewer",
    workspace: "operations",
    isCustomer: false,
    isAdmin: false,
    permissions: ["review", "rfi"],
  };

  const mockNav = [
    { id: "my-work", label: "My Work", icon: React.createElement("span", null, "icon"), count: 3 },
    { id: "team-work", label: "Team Work", icon: React.createElement("span", null, "icon"), count: 5 },
    { id: "schedule", label: "Schedule", icon: React.createElement("span", null, "icon") },
  ];

  const html = renderToStaticMarkup(
    React.createElement(
      AppShell,
      {
        activePersona: mockPersona,
        currentRoute: "my-work",
        primaryNav: mockNav,
        canAdmin: true,
        unreadNotifications: 2,
        onNavigate: () => {},
        onOpenProject: () => {},
        onSignOut: () => {},
      },
      React.createElement("div", { id: "child-content" }, "Work items")
    )
  );

  // 1. Short PATH title & project context
  assert.match(html, />PATH</);
  assert.match(html, /Starbase Louisiana Launch Complex/);

  // 2. Profile identity button with ID persona-selector and touch sizing
  assert.match(html, /id="persona-selector"/);
  assert.match(html, /aria-label="Open profile"/);
  assert.match(html, /Jordan Lee/);

  // 3. Nav rail IDs remain addressable
  assert.match(html, /id="nav-my-work"/);
  assert.match(html, /id="nav-team-work"/);
  assert.match(html, /id="nav-schedule"/);
  assert.match(html, /id="nav-admin"/);

  // 4. 44px touch target classes in header buttons
  assert.match(html, /min-h-\[44px\]/);
  assert.match(html, /min-w-\[44px\]/);

  // 5. Keyboard accessibility & Escape key listener
  const appShellSource = await readFile(new URL("../components/path/AppShell.tsx", import.meta.url), "utf8");
  assert.match(appShellSource, /Escape/);
  assert.match(appShellSource, /hamburgerRef/);
  assert.match(appShellSource, /hidden rounded-full[^\n]*sm:inline/);
});

test("Checkpoint 10: globals.css enforces reduced motion, coarse pointer 44px targets, visible focus, and mobile viewport constraints", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  // Reduced motion
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);

  // Coarse pointer 44px touch targets
  assert.match(css, /@media\s*\(pointer:\s*coarse\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /min-width:\s*44px/);

  // Accessible focus-visible ring
  assert.match(css, /:focus-visible/);
  assert.match(css, /outline:\s*2px solid #007c7c/);

  // Mobile viewport constraints on html & body
  assert.match(css, /html\s*\{[^}]*max-width:\s*100%/);
  assert.match(css, /html\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css, /body\s*\{[^}]*max-width:\s*100%/);
  assert.match(css, /body\s*\{[^}]*overflow:\s*hidden/);
});

test("Checkpoint 10: WorkInboxRow and WorkInboxView render icons with status, calm typography, and safe counts", async () => {
  const { WorkInboxRow } = await vite.ssrLoadModule("/components/path/work/WorkInboxRow.tsx");
  const { WorkInboxView } = await vite.ssrLoadModule("/components/path/work/WorkInboxView.tsx");

  const completedItem = {
    id: "TASK-001",
    kind: "task",
    title: "Air Quality Modeling Review",
    statusLabel: "Completed",
    statusTone: "green",
    ownerName: "Jordan Lee",
    isCriticalPath: false,
    workstreamTitle: "Title V Air Permit",
  };

  const rowHtml = renderToStaticMarkup(
    React.createElement(WorkInboxRow, {
      item: completedItem,
      onOpen: () => {},
    })
  );

  // Never rely on color alone: checkmark icon renders alongside Completed label
  assert.match(rowHtml, /Completed/);
  assert.match(rowHtml, /<svg[^>]*class="[^"]*text-emerald-700[^"]*"/);

  // View renders without reference errors on dueSoonItems / tab counts
  const mockGroups = [
    { id: "needs_action", label: "Needs my action", items: [completedItem] },
    { id: "due_soon", label: "Due soon", items: [] },
    { id: "waiting", label: "Waiting", items: [] },
    { id: "recently_completed", label: "Completed", items: [completedItem] },
  ];

  const viewHtml = renderToStaticMarkup(
    React.createElement(WorkInboxView, {
      groups: mockGroups,
      onOpenItem: () => {},
    })
  );

  assert.match(viewHtml, /Needs my action/);
  assert.match(viewHtml, /Due soon \(0\)/);
  assert.match(viewHtml, /Showing 1 items/);
});

test("Checkpoint 10: Concise outcome receipt 'Response sent — Jordan is next' is defined in application actions", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(pageSource, /Response sent — \$\{nextReviewer\} is next\./);
});
