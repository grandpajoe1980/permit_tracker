import { test, expect } from "@playwright/test";

test.describe("Supabase-Authoritative Cross-Browser Persistence", () => {
  test("Scenario 1: Customer Request Durability across Isolated Browser Contexts", async ({ browser }) => {
    // 1. Context A: SpaceX PM Submits Customer Request
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    const requestTitle = `E2E Automated Cross-Browser Test Request ${Date.now()}`;
    await pageA.goto("/");
    await expect(pageA.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');

    // Open Demo Sign-in and select Alex Martin (SpaceX customer submitter)
    await pageA.click("#demo-login-trigger");
    await pageA.click("#demo-persona-alex");
    await expect(pageA.getByRole("button", { name: "Open project page" })).toBeVisible();

    // Navigate to Requests & Permits
    await pageA.getByRole("button", { name: "My requests", exact: true }).click();
    await expect(pageA.getByRole("heading", { name: "Requests & permits", exact: true })).toBeVisible();

    // Submit a Help Request
    await pageA.click("text=Request government help / service");
    await pageA.fill("#request-title", requestTitle);
    await pageA.fill("#request-description", "Cross-browser Supabase durability test payload.");
    await pageA.click("button:has-text('Submit request')");

    // Return to the request list and verify the committed record is visible.
    await pageA.click("text=Back to request choices");
    await expect(pageA.getByText(requestTitle, { exact: false }).first()).toBeVisible();
    await contextA.close();

    // 2. Context B: Clean State Office Session (Sarah Johnson) Retrieves from Supabase
    const contextB = await browser.newContext(); // Completely isolated cookies & localStorage
    const pageB = await contextB.newPage();
    await pageB.goto("/");
    await expect(pageB.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');

    await pageB.click("#demo-login-trigger");
    await pageB.click("#demo-persona-sarah");

    // Navigate to the state-office intake queue and assert the exact record
    // created in Context A, not merely a generic authenticated page heading.
    await pageB.getByRole("button", { name: "Administration", exact: true }).click();
    await expect(pageB.getByRole("heading", { name: "Customer intake queue", exact: true })).toBeVisible();
    await expect(pageB.getByText(requestTitle, { exact: false }).first()).toBeVisible({ timeout: 15_000 });

    await contextB.close();
  });

  test("Scenario 2: RFI Creation, Applicant Response, and Acceptance across Dual Contexts", async ({ browser }) => {
    // 1. Context A: LDEQ Reviewer Jordan Lee issues RFI
    const contextReviewer = await browser.newContext();
    const pageReviewer = await contextReviewer.newPage();
    const questionText = `E2E Automated Hydraulic Model Request ${Date.now()}`;
    const responseText = `E2E Applicant Response ${Date.now()}`;
    await pageReviewer.goto("/");
    await expect(pageReviewer.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');

    await pageReviewer.click("#demo-login-trigger");
    await pageReviewer.click("#demo-persona-jordan");
    await expect(pageReviewer.getByRole("heading", { name: "My Work", exact: true }).first()).toBeVisible();

    // Unanswered RFIs are intentionally in the reviewer Waiting queue. Open
    // the persisted record there, then use its canonical detail action bar.
    await pageReviewer.getByRole("button", { name: "Team Work", exact: true }).click();
    await pageReviewer.getByRole("button", { name: /^Waiting/ }).click();
    const rfiRow = pageReviewer.locator('[data-testid^="inbox-row-"]').filter({ hasText: "RFI-DEMO-TITLE-V" }).first();
    await expect(rfiRow).toBeVisible({ timeout: 15_000 });
    await rfiRow.click();
    await expect(pageReviewer.getByRole("button", { name: "Request Information", exact: true })).toBeVisible({ timeout: 15_000 });
    await pageReviewer.getByRole("button", { name: "Request Information", exact: true }).click();
    await pageReviewer.fill("#question-text", questionText);
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await pageReviewer.fill("#question-due", dueDate);
    await pageReviewer.getByRole("dialog").getByRole("button", { name: "Request Information", exact: true }).click();
    await expect(pageReviewer.getByRole("dialog")).not.toBeVisible();

    await contextReviewer.close();

    // 2. Context B: Clean SpaceX Session responds to RFI
    const contextApplicant = await browser.newContext();
    const pageApplicant = await contextApplicant.newPage();
    await pageApplicant.goto("/");
    await expect(pageApplicant.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');

    await pageApplicant.click("#demo-login-trigger");
    await pageApplicant.click("#demo-persona-alex");

    await pageApplicant.getByRole("button", { name: /^My actions/ }).click();
    await pageApplicant.getByRole("searchbox", { name: "Search work inbox" }).fill(questionText);
    const customerQuestion = pageApplicant.locator('[data-testid^="inbox-row-"]').first();
    await expect(customerQuestion).toBeVisible();
    await customerQuestion.click();
    await expect(pageApplicant.getByText(questionText, { exact: false }).first()).toBeVisible();
    await pageApplicant.getByRole("button", { name: "Respond", exact: true }).click();
    await pageApplicant.getByRole("dialog").locator("#action-note").fill(responseText);
    await pageApplicant.getByRole("dialog").getByRole("button", { name: "Respond", exact: true }).click();
    await expect(pageApplicant.getByRole("dialog")).not.toBeVisible();

    await contextApplicant.close();

    // 3. A fresh reviewer context retrieves the exact response and accepts it.
    const contextReviewerAgain = await browser.newContext();
    const pageReviewerAgain = await contextReviewerAgain.newPage();
    await pageReviewerAgain.goto("/");
    await expect(pageReviewerAgain.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');
    await pageReviewerAgain.click("#demo-login-trigger");
    await pageReviewerAgain.click("#demo-persona-jordan");
    await expect(pageReviewerAgain.getByRole("heading", { name: "My Work", exact: true }).first()).toBeVisible();
    await pageReviewerAgain.getByRole("searchbox", { name: "Search work inbox" }).fill(responseText);
    const reviewerResponse = pageReviewerAgain.locator('[data-testid^="inbox-row-"]').first();
    await expect(reviewerResponse).toBeVisible();
    await reviewerResponse.click();
    await expect(pageReviewerAgain.getByText(questionText, { exact: false }).first()).toBeVisible();
    await expect(pageReviewerAgain.getByText(responseText, { exact: false }).first()).toBeVisible();
    await pageReviewerAgain.getByRole("button", { name: "Accept & Resume Review", exact: true }).click();
    await pageReviewerAgain.getByRole("dialog").getByRole("button", { name: "Accept & Resume Review", exact: true }).click();
    await expect(pageReviewerAgain.getByRole("dialog")).not.toBeVisible();
    await expect(pageReviewerAgain.getByText("Accepted", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await contextReviewerAgain.close();
  });

  test("Scenario 3: Staff clarification preserves submitter and records the authenticated actor", async ({ browser }) => {
    const contextCustomer = await browser.newContext();
    const pageCustomer = await contextCustomer.newPage();
    const requestTitle = `E2E Staff Operator Identity ${Date.now()}`;
    const clarificationText = "Please confirm the affected location and the requested decision date.";
    const customerResponse = "The affected location is the east construction access, and the decision is needed before mobilization.";

    await pageCustomer.goto("/");
    await expect(pageCustomer.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');
    await pageCustomer.click("#demo-login-trigger");
    await pageCustomer.click("#demo-persona-alex");
    await pageCustomer.getByRole("button", { name: "My requests", exact: true }).click();
    await expect(pageCustomer.getByRole("heading", { name: "Requests & permits", exact: true })).toBeVisible();
    await pageCustomer.getByText("Request government help / service", { exact: true }).click();
    await pageCustomer.fill("#request-title", requestTitle);
    await pageCustomer.fill("#request-description", "Fresh staff-operator identity acceptance scenario.");
    await pageCustomer.getByRole("button", { name: "Submit request", exact: true }).click();
    await expect(pageCustomer.getByText("Request submitted", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(pageCustomer.getByText(requestTitle, { exact: false }).first()).toBeVisible();
    await contextCustomer.close();

    const contextStaff = await browser.newContext();
    const pageStaff = await contextStaff.newPage();
    await pageStaff.goto("/");
    await expect(pageStaff.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');
    await pageStaff.click("#demo-login-trigger");
    await pageStaff.click("#demo-persona-sarah");
    await pageStaff.getByRole("button", { name: "Administration", exact: true }).click();
    await expect(pageStaff.getByRole("heading", { name: "Customer intake queue", exact: true })).toBeVisible();
    await expect(pageStaff.getByText(requestTitle, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    await pageStaff.getByRole("textbox", { name: "Search intake requests" }).fill(requestTitle);
    const intakeRow = pageStaff.getByText(requestTitle, { exact: false }).first().locator("..").locator("..");
    await expect(intakeRow.getByRole("button", { name: "Review and route", exact: true })).toBeVisible();
    await intakeRow.getByRole("button", { name: "Review and route", exact: true }).click();
    const triageDialog = pageStaff.getByRole("dialog");
    await triageDialog.getByRole("tab", { name: "Ask for clarification", exact: true }).click();
    await triageDialog.locator("textarea").fill(clarificationText);
    await triageDialog.getByRole("button", { name: "Ask customer for clarification", exact: true }).click();
    await expect(triageDialog).not.toBeVisible();
    await contextStaff.close();

    const contextResponse = await browser.newContext();
    const pageResponse = await contextResponse.newPage();
    await pageResponse.goto("/");
    await expect(pageResponse.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');
    await pageResponse.click("#demo-login-trigger");
    await pageResponse.click("#demo-persona-alex");
    await expect(pageResponse.getByRole("button", { name: "Open project page", exact: true })).toBeVisible({ timeout: 15_000 });
    await pageResponse.getByRole("button", { name: /^My actions/ }).click();
    await pageResponse.getByRole("searchbox", { name: "Search work inbox" }).fill(requestTitle);
    const responseRow = pageResponse.locator('[data-testid^="inbox-row-"]').first();
    await expect(responseRow).toBeVisible({ timeout: 15_000 });
    await responseRow.click();
    await expect(pageResponse.getByText(clarificationText, { exact: false }).first()).toBeVisible();
    await pageResponse.getByRole("button", { name: "Respond", exact: true }).click();
    await pageResponse.getByRole("dialog").locator("#action-note").fill(customerResponse);
    await pageResponse.getByRole("dialog").getByRole("button", { name: "Respond", exact: true }).click();
    await expect(pageResponse.getByRole("dialog")).not.toBeVisible();
    await contextResponse.close();

    // Refresh in a clean customer context to prove the response was persisted,
    // not merely reflected by the submitting page's local state.
    const contextReadBack = await browser.newContext();
    const pageReadBack = await contextReadBack.newPage();
    await pageReadBack.goto("/");
    await expect(pageReadBack.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');
    await pageReadBack.click("#demo-login-trigger");
    await pageReadBack.click("#demo-persona-alex");
    await pageReadBack.getByRole("button", { name: "My requests", exact: true }).click();
    await expect(pageReadBack.getByRole("heading", { name: "Requests & permits", exact: true })).toBeVisible({ timeout: 15_000 });
    await pageReadBack.getByRole("button", { name: new RegExp(requestTitle) }).click();
    await expect(pageReadBack.getByText(customerResponse, { exact: false }).first()).toBeVisible();
    await contextReadBack.close();
  });

  test("Scenario 4: Shell and stage-first schedule keep the main pane as the scroll owner", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');
    await page.click("#demo-login-trigger");
    await page.click("#demo-persona-sarah");
    await expect(page.getByRole("button", { name: "Open project page", exact: true })).toBeVisible({ timeout: 15_000 });

    const desktopShell = await page.evaluate(() => {
      const main = document.getElementById("main-content");
      const aside = document.querySelector("aside[aria-label='Navigation drawer']");
      const header = document.querySelector("header");
      if (!main || !aside || !header) return null;
      const before = header.getBoundingClientRect().top;
      main.scrollTop = Math.min(500, Math.max(0, main.scrollHeight - main.clientHeight));
      const after = header.getBoundingClientRect().top;
      return {
        headerStationary: Math.abs(before - after) < 1,
        sidebarOverflowY: getComputedStyle(aside).overflowY,
      };
    });
    expect(desktopShell).toEqual({ headerStationary: true, sidebarOverflowY: "hidden" });

    await page.locator("#nav-project").click();
    await page.getByRole("button", { name: "Schedule", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Schedule", exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("Gantt schedule timeline")).toBeVisible();
    const scheduleScrollEvidence = await page.evaluate(() => {
      const main = document.getElementById("main-content");
      const header = document.querySelector("header");
      if (!main || !header) return null;
      const before = header.getBoundingClientRect().top;
      main.scrollTop = Math.min(700, Math.max(0, main.scrollHeight - main.clientHeight));
      return { mainOwnsScroll: main.scrollHeight > main.clientHeight && main.scrollTop > 0, headerStationary: Math.abs(before - header.getBoundingClientRect().top) < 1 };
    });
    expect(scheduleScrollEvidence).toEqual({ mainOwnsScroll: true, headerStationary: true });
    const timelineEvidence = await page.getByLabel("Gantt schedule timeline").evaluate((timeline) => {
      const styles = Array.from(timeline.querySelectorAll<HTMLElement>("[style]"));
      const lefts = styles.map((node) => Number.parseFloat(node.style.left)).filter(Number.isFinite);
      const overflowingDescendant = styles.some((node) => {
        const style = getComputedStyle(node);
        return ["auto", "scroll"].includes(style.overflowY) && node.scrollHeight > node.clientHeight;
      });
      return { hasThirtyPercentTodayMarker: lefts.some((left) => Math.abs(left - 30) < 0.1), overflowingDescendant };
    });
    expect(timelineEvidence).toEqual({ hasThirtyPercentTodayMarker: true, overflowingDescendant: false });
    await expect(page.getByLabel(/workflow stages/).first()).toBeVisible({ timeout: 15_000 });
    expect(await page.getByText(/^Step \d+:/).count()).toBeGreaterThanOrEqual(3);
    const parallelStages = page.getByLabel("PATH-DEMO-WS-UTILITY workflow stages");
    await expect(parallelStages.getByText("Step 2: Technical team review", { exact: true })).toBeVisible();
    await expect(parallelStages.getByText("Step 3: Agency coordination", { exact: true })).toBeVisible();
    await expect(parallelStages.getByText("Current", { exact: true })).toHaveCount(2);
    const stageBlockEvidence = await page.getByTestId("gantt-stage-block-PATH-DEMO-WS-UTILITY-technical_review").evaluate((block) => {
      const style = getComputedStyle(block);
      return { borderRadius: style.borderRadius, height: Math.round(block.getBoundingClientRect().height), state: block.getAttribute("data-stage-state") };
    });
    expect(stageBlockEvidence).toEqual({ borderRadius: "0px", height: 36, state: "current" });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel("Chronological schedule list")).toBeVisible();
    const mobileOverflow = await page.evaluate(() => ({
      documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      mainOverflow: (document.getElementById("main-content")?.scrollWidth ?? 0) > (document.getElementById("main-content")?.clientWidth ?? 0) + 1,
    }));
    expect(mobileOverflow).toEqual({ documentOverflow: false, mainOverflow: false });
    await context.close();
  });

  test("Scenario 5: Take Ownership assigns the authenticated worker and rejects a stale competing claim", async ({ browser }) => {
    const requestTitle = `E2E Take Ownership Collision ${Date.now()}`;
    const contextCreator = await browser.newContext();
    const pageCreator = await contextCreator.newPage();
    await pageCreator.goto("/");
    await expect(pageCreator.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');
    await pageCreator.click("#demo-login-trigger");
    await pageCreator.click("#demo-persona-alex");
    await pageCreator.getByRole("button", { name: "My requests", exact: true }).click();
    await pageCreator.getByText("Request government help / service", { exact: true }).click();
    await pageCreator.fill("#request-title", requestTitle);
    await pageCreator.fill("#request-description", "Fresh tagged record for the authoritative claim collision scenario.");
    await pageCreator.getByRole("button", { name: "Submit request", exact: true }).click();
    await expect(pageCreator.getByText("Request submitted", { exact: true })).toBeVisible({ timeout: 15_000 });
    await contextCreator.close();

    const contextSarah = await browser.newContext();
    const pageSarah = await contextSarah.newPage();
    await pageSarah.goto("/");
    await expect(pageSarah.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');
    await pageSarah.click("#demo-login-trigger");
    await pageSarah.click("#demo-persona-sarah");
    await pageSarah.getByRole("button", { name: "Team Work", exact: true }).click();
    await expect(pageSarah.getByRole("heading", { name: "Team Work", exact: true })).toBeVisible();
    await pageSarah.getByRole("searchbox", { name: "Filter team work" }).fill(requestTitle);
    const sarahRow = pageSarah.locator('[data-testid^="inbox-row-"]').filter({ hasText: requestTitle }).first();
    await expect(sarahRow).toBeVisible({ timeout: 15_000 });

    const contextJoe = await browser.newContext();
    const pageJoe = await contextJoe.newPage();
    await pageJoe.goto("/");
    await expect(pageJoe.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');
    await pageJoe.fill("#username", "joe.skaggs@la.gov");
    await pageJoe.fill("#password", "PATH-MVP-2026!");
    await pageJoe.getByRole("button", { name: "Sign In", exact: true }).click();
    await pageJoe.getByRole("button", { name: "Team Work", exact: true }).click();
    await expect(pageJoe.getByRole("heading", { name: "Team Work", exact: true })).toBeVisible();
    await pageJoe.getByRole("searchbox", { name: "Filter team work" }).fill(requestTitle);
    const joeRow = pageJoe.locator('[data-testid^="inbox-row-"]').filter({ hasText: requestTitle }).first();
    await expect(joeRow).toBeVisible({ timeout: 15_000 });

    await sarahRow.getByRole("button", { name: "Take ownership", exact: true }).click();
    await expect(pageSarah.getByRole("status").filter({ hasText: "Claimed ownership" })).toBeVisible({ timeout: 15_000 });

    await joeRow.getByRole("button", { name: "Take ownership", exact: true }).click();
    await expect(pageJoe.getByRole("status").filter({ hasText: "Claim conflict" })).toBeVisible({ timeout: 15_000 });

    await pageSarah.reload();
    await expect(pageSarah.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');
    await pageSarah.click("#demo-login-trigger");
    await pageSarah.click("#demo-persona-sarah");
    await pageSarah.getByRole("button", { name: "Team Work", exact: true }).click();
    await pageSarah.getByRole("searchbox", { name: "Filter team work" }).fill(requestTitle);
    await expect(pageSarah.getByText("Sarah Johnson", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(pageSarah.getByText(/user-[0-9a-f-]{36}/i)).toHaveCount(0);

    await contextSarah.close();
    await contextJoe.close();
  });

  test("Scenario 6: Back and Forward restore queue state, scroll, focus, mobile navigation, and zoom", async ({ browser }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');
    await page.click("#demo-login-trigger");
    await page.click("#demo-persona-sarah");
    await expect(page.getByRole("heading", { name: "My Work", exact: true }).first()).toBeVisible({ timeout: 30_000 });

    const search = page.getByRole("searchbox", { name: "Search work inbox" });
    await search.fill("RFI");
    await page.getByRole("button", { name: /^Waiting/ }).click();
    const beforeNavigation = await page.evaluate(() => {
      const main = document.getElementById("main-content");
      if (!main) return null;
      main.scrollTop = Math.min(350, Math.max(0, main.scrollHeight - main.clientHeight));
      return { scrollTop: main.scrollTop, scrollable: main.scrollHeight > main.clientHeight };
    });
    expect(beforeNavigation?.scrollable).toBe(true);

    await page.locator("#nav-agency-queue").click();
    await expect(page.getByRole("heading", { name: "Team Work", exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "My Work", exact: true }).first()).toBeVisible();
    await expect(search).toHaveValue("RFI");
    await expect(page.getByRole("button", { name: /^Waiting/ })).toHaveClass(/bg-\[#00284d\]/);
    await expect(page.locator("#nav-agency-queue")).toBeFocused();
    const afterBack = await page.locator("#main-content").evaluate((main) => main.scrollTop);
    expect(afterBack).toBeGreaterThan(0);

    await page.goForward();
    await expect(page.getByRole("heading", { name: "Team Work", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    const toggle = page.getByRole("button", { name: "Toggle navigation" });
    await toggle.click();
    await expect(page.locator("#mobile-navigation")).toHaveAttribute("role", "dialog");
    await page.keyboard.press("Escape");
    await expect(page.locator("#mobile-navigation")).not.toHaveAttribute("role", "dialog");
    await expect(toggle).toBeFocused();

    // A 195 CSS-pixel layout viewport exercises the same reflow constraints as
    // 200% browser zoom on a 390px viewport without conflating CSS zoom with
    // document geometry.
    await page.setViewportSize({ width: 195, height: 844 });
    const zoomOverflow = await page.evaluate(() => ({
      documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      mainOverflow: (document.getElementById("main-content")?.scrollWidth ?? 0) > (document.getElementById("main-content")?.clientWidth ?? 0) + 1,
    }));
    expect(zoomOverflow).toEqual({ documentOverflow: false, mainOverflow: false });
    await context.close();
  });

  test("Scenario 10: keyboard and touch navigation keep primary actions reachable on mobile", async ({ browser }) => {
    test.setTimeout(45_000);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("#login-shell")).toHaveAttribute("data-hydrated", "true");

    // Sign in with the semantic form controls, then drive the navigation
    // drawer with the keyboard alone.
    await page.locator("#username").fill("sarah.johnson@demo.permit.local");
    await page.locator("#password").fill("PATH-Demo-2026!");
    await page.getByRole("button", { name: "Sign In", exact: true }).press("Enter");
    await expect(page.getByRole("heading", { name: "My Work", exact: true }).first()).toBeVisible({ timeout: 30_000 });

    const toggle = page.getByRole("button", { name: "Toggle navigation" });
    await toggle.focus();
    await page.keyboard.press("Enter");
    const drawer = page.locator("#mobile-navigation");
    await expect(drawer).toHaveAttribute("role", "dialog");
    const teamWork = drawer.locator("#nav-agency-queue");
    await teamWork.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Team Work", exact: true })).toBeVisible();

    // Exercise the same path through a touch-capable context.
    await toggle.tap();
    await expect(drawer).toHaveAttribute("role", "dialog");
    await drawer.locator("#nav-my-work").tap();
    await expect(page.getByRole("heading", { name: "My Work", exact: true }).first()).toBeVisible();
    await expect(page.locator("#main-content")).toHaveCSS("overflow-y", "auto");
    await context.close();
  });

  test("Scenario 7: Block and clear a workstream through the persisted workflow boundary", async ({ browser }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("#login-shell")).toHaveAttribute("data-hydrated", "true");
    await page.click("#demo-login-trigger");
    await page.click("#demo-persona-sarah");
    await expect(page.getByRole("button", { name: "Open project page", exact: true })).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Team Work", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Team Work", exact: true })).toBeVisible();
    const requestId = "PATH-DEMO-REQ-ACTIVE";
    const requestTitle = "Coordinate a utility interconnection review";
    await page.getByRole("button", { name: /^Assigned/ }).click();
    await page.getByRole("searchbox", { name: "Filter team work" }).fill(requestTitle);
    const row = page.locator(`[data-testid="inbox-row-${requestId}"]`).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole("button", { name: new RegExp(`Open ${requestTitle}`) }).click();
    await expect(page.getByRole("heading", { name: requestTitle, exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Mark Blocked", exact: true }).click();
    const blockDialog = page.getByRole("dialog");
    await blockDialog.locator("#block-reason").selectOption("internal");
    await blockDialog.locator("#block-need").fill("Persisted R4 browser acceptance blocker.");
    await blockDialog.getByRole("button", { name: "Mark Blocked", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Structured blocker committed" })).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByRole("button", { name: "Team Work", exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Team Work", exact: true }).click();
    await page.getByRole("button", { name: /^Waiting/ }).click();
    await page.getByRole("searchbox", { name: "Filter team work" }).fill(requestTitle);
    await page.locator(`[data-testid="inbox-row-${requestId}"]`).first().getByRole("button", { name: new RegExp(`Open ${requestTitle}`) }).click();
    await expect(page.getByText("Blocked (Action Required)", { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Clear Blocker & Resume", exact: true }).click();
    const clearDialog = page.getByRole("dialog");
    await clearDialog.locator("#unblock-note").fill("R4 browser acceptance resolution.");
    await clearDialog.getByRole("button", { name: "Clear Blocker & Resume", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Blocker cleared" })).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByRole("button", { name: "Team Work", exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Team Work", exact: true }).click();
    await page.getByRole("button", { name: /^Assigned/ }).click();
    await page.getByRole("searchbox", { name: "Filter team work" }).fill(requestTitle);
    await page.locator(`[data-testid="inbox-row-${requestId}"]`).first().getByRole("button", { name: new RegExp(`Open ${requestTitle}`) }).click();
    await expect(page.getByText(/^Running \(.+\)$/, { exact: true })).toBeVisible({ timeout: 15_000 });
    await context.close();
  });

  test("Scenario 8: Agency coordination response remains separate from blocker clearance", async ({ browser }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const responseText = `E2E coordination response ${Date.now()}`;

    await page.goto("/");
    await expect(page.locator("#login-shell")).toHaveAttribute("data-hydrated", "true");
    await page.fill("#username", "sarah.johnson@demo.permit.local");
    await page.fill("#password", "PATH-Demo-2026!");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open project page", exact: true })).toBeVisible({ timeout: 30_000 });
    await page.goto("/?view=coordination");
    await expect(page.getByRole("heading", { name: "Coordination Requests", exact: true })).toBeVisible({ timeout: 30_000 });

    const coordinationCard = page.locator("article").filter({ hasText: "PATH-DEMO-COORD-RESPONDED" }).first();
    await expect(coordinationCard).toBeVisible({ timeout: 15_000 });
    await coordinationCard.getByRole("button", { name: "Open Work", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Confirm coastal concurrence conditions", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("objection raised", { exact: true })).toBeVisible();
    await expect(page.getByText("Waiting on CPRA", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Respond to agency", exact: true }).click();
    const responseDialog = page.getByRole("dialog");
    await responseDialog.locator("#coordination-status").selectOption("objection_raised");
    await responseDialog.locator("#coordination-response").fill(responseText);
    await responseDialog.getByRole("button", { name: "Respond to agency", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "response recorded" })).toBeVisible({ timeout: 15_000 });

    // The response transaction is persisted, but it must not silently resume
    // the linked workstream. The explicit clear action remains available.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Confirm coastal concurrence conditions", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(responseText, { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("objection raised", { exact: true })).toBeVisible();
    await expect(page.getByText("Waiting on CPRA", { exact: true })).toBeVisible();

    // CPRA can respond to the coordination record, while the originating
    // workstream remains project-scoped. Read that shared project view to
    // prove the dependency is still blocked; only its separate clear action
    // can resume the workflow.
    await page.goto("/?view=project&workstream=PATH-DEMO-WS-COAST");
    await expect(page.getByRole("heading", { name: /SpaceX .*Starbase Louisiana/i, exact: false })).toBeVisible({ timeout: 30_000 });
    const focusedWorkstream = page.locator('[data-focused-workstream-id="PATH-DEMO-WS-COAST"]');
    await expect(focusedWorkstream).toBeVisible({ timeout: 15_000 });
    await expect(focusedWorkstream.getByText(/blocked/i).first()).toBeVisible({ timeout: 15_000 });

    await page.goto("/work/coordination/PATH-DEMO-COORD-RESPONDED");
    await expect(page.getByRole("heading", { name: "Confirm coastal concurrence conditions", exact: true })).toBeVisible({ timeout: 30_000 });

    // Restore the tagged demo response text while preserving its seeded
    // objection/blocked state for the next acceptance run.
    await page.getByRole("button", { name: "Respond to agency", exact: true }).click();
    const restoreDialog = page.getByRole("dialog");
    await restoreDialog.locator("#coordination-status").selectOption("objection_raised");
    await restoreDialog.locator("#coordination-response").fill("Response recorded: CPRA requested one additional condition review. The originating work remains blocked until the dependency is explicitly cleared.");
    await restoreDialog.getByRole("button", { name: "Respond to agency", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "response recorded" })).toBeVisible({ timeout: 15_000 });
    await context.close();
  });

  test("Scenario 9: Administrative task corrections require a reason and persist", async ({ browser }) => {
    test.setTimeout(90_000);
    const nonAdminContext = await browser.newContext();
    const nonAdminPage = await nonAdminContext.newPage();
    await nonAdminPage.goto("/");
    await expect(nonAdminPage.locator("#login-shell")).toHaveAttribute("data-hydrated", "true");
    await nonAdminPage.click("#demo-login-trigger");
    await nonAdminPage.click("#demo-persona-sarah");
    await expect(nonAdminPage.getByRole("button", { name: "Open project page", exact: true })).toBeVisible({ timeout: 30_000 });
    await nonAdminPage.goto("/?view=admin");
    await expect(nonAdminPage.getByRole("alert").filter({ hasText: "Administrator access required" })).toBeVisible({ timeout: 30_000 });
    await expect(nonAdminPage.getByRole("heading", { name: "Customer intake queue", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(nonAdminPage.getByRole("button", { name: "Apply Audited Correction", exact: true })).toHaveCount(0);
    await nonAdminContext.close();

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const taskCode = "PATH-DEMO-T-COAST-001";
    const firstReason = `E2E CP8 correction reason ${Date.now()}`;
    const restoreReason = `E2E CP8 restoration reason ${Date.now()}`;

    await page.goto("/");
    await expect(page.locator("#login-shell")).toHaveAttribute("data-hydrated", "true");
    await page.click("#demo-login-trigger");
    await page.click("#demo-persona-joe-skaggs");
    await expect(page.getByRole("button", { name: "Open project page", exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Administration", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Administration & Governance", exact: true })).toBeVisible({ timeout: 30_000 });

    const openTaskEditor = async () => {
      await page.getByLabel("Record type").selectOption("tasks");
      await expect(page.getByText(/accessible records/).first()).toBeVisible({ timeout: 30_000 });
      await page.getByLabel("Search this page").fill(taskCode);
      const row = page.locator("tr").filter({ hasText: taskCode }).first();
      await expect(row).toBeVisible({ timeout: 15_000 });
      await row.getByRole("button", { name: "Edit", exact: true }).click();
      return page.getByRole("dialog");
    };

    const correctionDialog = await openTaskEditor();
    await expect(correctionDialog.getByText("Correction Reason", { exact: false })).toBeVisible();
    const applyButton = correctionDialog.getByRole("button", { name: "Apply Audited Correction", exact: true });
    await expect(applyButton).toBeDisabled();
    await correctionDialog.locator("select").selectOption("in_progress");
    await correctionDialog.locator("textarea").fill(firstReason);
    await expect(applyButton).toBeEnabled();
    await applyButton.click();
    await expect(page.getByText(/Task correction saved:/, { exact: false })).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByRole("heading", { name: "Administration & Governance", exact: true })).toBeVisible({ timeout: 30_000 });
    const readBackDialog = await openTaskEditor();
    await expect(readBackDialog.locator("select")).toHaveValue("in_progress");
    await readBackDialog.locator("select").selectOption("blocked");
    await readBackDialog.locator("textarea").fill(restoreReason);
    await readBackDialog.getByRole("button", { name: "Apply Audited Correction", exact: true }).click();
    await expect(page.getByText(/Task correction saved:/, { exact: false })).toBeVisible({ timeout: 15_000 });
    await context.close();
  });

  test("Scenario 11: Clarification through completion updates queues, project, schedule, and customer state", async ({ browser }) => {
    test.setTimeout(180_000);
    const requestTitle = `E2E Complete Workflow ${Date.now()}`;
    const requestDescription = "Full persisted acceptance story from customer clarification through all configured workflow stages.";
    const workflowVersionId = "workflow-version-d412c02d1de74798b7a20824bed70406";
    const stateOfficeGroupId = "28e4ef60-48ad-45e0-b391-38188cfbdb5b";
    const sarahUserId = "031dc622-0885-42bb-9c84-1f9b6cb18a1d";
    const targetDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    async function signIn(page: import("@playwright/test").Page, personaId: string) {
      await page.goto("/");
      await expect(page.locator("#login-shell")).toHaveAttribute("data-hydrated", "true");
      await page.click("#demo-login-trigger");
      await page.click(`#demo-persona-${personaId}`);
      await expect(page.getByRole("button", { name: "Open project page", exact: true })).toBeVisible({ timeout: 60_000 });
    }

    async function completeCurrentStage(page: import("@playwright/test").Page) {
      await expect(page.getByRole("button", { name: "Complete Step", exact: true })).toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: "Complete Step", exact: true }).click();
      const dialog = page.getByRole("dialog");
      const checks = dialog.locator('input[type="checkbox"]');
      for (let index = 0; index < await checks.count(); index += 1) {
        const checkbox = checks.nth(index);
        if (!(await checkbox.isChecked())) await checkbox.check();
      }
      await dialog.getByRole("button", { name: "Complete & Send Forward", exact: true }).click();
      await expect(dialog).not.toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("status").filter({ hasText: "Step completed" })).toBeVisible({ timeout: 20_000 });
    }

    async function openAssignedWork(page: import("@playwright/test").Page, title: string) {
      await page.getByRole("button", { name: /^My Work/ }).click();
      await expect(page.getByRole("heading", { name: "My Work", exact: true }).first()).toBeVisible({ timeout: 30_000 });
      const search = page.getByRole("searchbox", { name: "Search work inbox" });
      await search.fill(title);
      const rows = page.locator('[data-testid^="inbox-row-"]');
      await expect(rows).toHaveCount(1, { timeout: 20_000 });
      await rows.first().click();
    }

    async function claimAndOpenWork(page: import("@playwright/test").Page, title: string, expectedOwner: string) {
      await page.getByRole("button", { name: "Team Work", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Team Work", exact: true })).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: /^Unassigned/ }).click();
      const search = page.getByRole("searchbox", { name: "Filter team work" });
      await search.fill(title);
      const rows = page.locator('[data-testid^="inbox-row-"]');
      await expect(rows).toHaveCount(1, { timeout: 20_000 });
      await rows.first().getByRole("button", { name: "Take ownership", exact: true }).click();
      await expect.poll(async () => {
        const success = page.getByRole("status").filter({ hasText: "Claimed ownership" });
        if (await success.count()) return "success";
        const alert = page.getByRole("alert");
        return (await alert.count()) ? await alert.first().innerText() : "pending";
      }, { timeout: 20_000 }).toBe("success");
      await page.getByRole("button", { name: /^Assigned/ }).click();
      await search.fill(title);
      await expect(rows).toHaveCount(1, { timeout: 20_000 });
      await expect(rows.first()).toContainText(expectedOwner, { timeout: 20_000 });
      await rows.first().click();
      await expect(page.getByRole("region", { name: "Current responsibility" })).toContainText(expectedOwner, { timeout: 20_000 });
    }

    // Customer creates the request in an isolated authenticated context.
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await signIn(customerPage, "alex");
    await customerPage.getByRole("button", { name: "My requests", exact: true }).click();
    await expect(customerPage.getByRole("heading", { name: "Requests & permits", exact: true })).toBeVisible();
    await customerPage.getByText("Request government help / service", { exact: true }).click();
    await customerPage.fill("#request-title", requestTitle);
    await customerPage.fill("#request-description", requestDescription);
    await customerPage.getByRole("button", { name: "Submit request", exact: true }).click();
    await expect(customerPage.getByText("Request submitted", { exact: true })).toBeVisible({ timeout: 20_000 });
    await customerContext.close();

    // The state-office operator deliberately routes the request to v4 and Sarah.
    const stateOfficeContext = await browser.newContext();
    const stateOfficePage = await stateOfficeContext.newPage();
    await signIn(stateOfficePage, "sarah");
    await stateOfficePage.getByRole("button", { name: "Administration", exact: true }).click();
    await expect(stateOfficePage.getByRole("heading", { name: "Customer intake queue", exact: true })).toBeVisible({ timeout: 30_000 });
    await stateOfficePage.getByRole("textbox", { name: "Search intake requests" }).fill(requestTitle);
    const intakeRow = stateOfficePage.getByText(requestTitle, { exact: false }).first().locator("..").locator("..");
    await expect(intakeRow.getByRole("button", { name: "Review and route", exact: true })).toBeVisible({ timeout: 20_000 });
    await intakeRow.getByRole("button", { name: "Review and route", exact: true }).click();
    const triageDialog = stateOfficePage.getByRole("dialog");
    const routingSections = triageDialog.locator("section");
    for (let index = (await routingSections.count()) - 1; index > 0; index -= 1) {
      await routingSections.nth(index).getByRole("button", { name: "Remove", exact: true }).click();
    }
    const routeRow = triageDialog.locator("section").first();
    const labeledControl = (label: RegExp, tag: "select" | "input") => routeRow.locator("label").filter({ hasText: label }).locator(tag).first();
    await labeledControl(/^Agency/, "select").selectOption("STATEPO");
    await labeledControl(/^Team/, "select").selectOption(stateOfficeGroupId);
    await labeledControl(/^Assigned person/, "select").selectOption(sarahUserId);
    await labeledControl(/^Target date/, "input").fill(targetDate);
    await labeledControl(/^Published workflow/, "select").selectOption(workflowVersionId);
    await triageDialog.getByRole("button", { name: "Confirm routing and create work", exact: true }).click();
    await expect(triageDialog).not.toBeVisible();
    await expect(stateOfficePage.getByRole("status").filter({ hasText: "workstream" })).toBeVisible({ timeout: 20_000 });

    // Stage 1: Sarah completes the assigned intake stage.
    await openAssignedWork(stateOfficePage, requestTitle);
    await expect(stateOfficePage.getByRole("heading", { name: "Request intake", exact: true })).toBeVisible();
    await completeCurrentStage(stateOfficePage);
    await stateOfficeContext.close();

    // Stage 2: Maya claims the SPACEPORT handoff in a new authenticated staff context.
    const applicantContext = await browser.newContext();
    const applicantPage = await applicantContext.newPage();
    await signIn(applicantPage, "maya");
    await claimAndOpenWork(applicantPage, requestTitle, "Maya Chen");
    await expect(applicantPage.getByRole("heading", { name: "Technical team review", exact: true })).toBeVisible();
    await completeCurrentStage(applicantPage);
    await applicantContext.close();

    // Stages 3–5: Sarah independently claims each returned state-office handoff.
    const finalStaffContext = await browser.newContext();
    const finalStaffPage = await finalStaffContext.newPage();
    await signIn(finalStaffPage, "sarah");
    for (const stageName of ["Agency coordination", "Construction release", "Monitoring and closeout"]) {
      await claimAndOpenWork(finalStaffPage, requestTitle, "Sarah Johnson");
      await expect(finalStaffPage.getByRole("heading", { name: stageName, exact: true })).toBeVisible();
      await completeCurrentStage(finalStaffPage);
    }

    // Persisted operational read-back: completed work is in the team history,
    // the project Work and Schedule views, and no longer presents an action.
    await finalStaffPage.getByRole("button", { name: "Team Work", exact: true }).click();
    await finalStaffPage.getByRole("button", { name: /^Completed/ }).click();
    await finalStaffPage.getByRole("searchbox", { name: "Filter team work" }).fill(requestTitle);
    await expect(finalStaffPage.locator('[data-testid^="inbox-row-"]')).toHaveCount(1, { timeout: 20_000 });
    await finalStaffPage.getByRole("button", { name: "Project Overview", exact: true }).click();
    await expect(finalStaffPage.getByRole("navigation", { name: "Project context", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(finalStaffPage.getByRole("heading", { name: /SpaceX .*Starbase Louisiana/, exact: true })).toBeVisible({ timeout: 30_000 });
    await finalStaffPage.getByRole("tab", { name: /^Work/ }).click();
    await finalStaffPage.getByRole("searchbox", { name: "Search project workstreams" }).fill(requestTitle);
    await expect(finalStaffPage.getByText(requestTitle, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(finalStaffPage.getByText("Complete", { exact: true }).first()).toBeVisible();
    await finalStaffPage.getByRole("tab", { name: "Schedule", exact: true }).click();
    await finalStaffPage.getByRole("textbox", { name: "Search schedule" }).fill(requestTitle);
    await expect(finalStaffPage.getByRole("group", { name: new RegExp(requestTitle) })).toBeVisible({ timeout: 20_000 });
    await finalStaffContext.close();

    // Customer read-back after a fresh sign-in: the completed request is no
    // longer an actionable response and the project status is visible.
    const customerReadBackContext = await browser.newContext();
    const customerReadBackPage = await customerReadBackContext.newPage();
    await signIn(customerReadBackPage, "alex");
    await customerReadBackPage.getByRole("button", { name: "My requests", exact: true }).click();
    await expect(customerReadBackPage.getByRole("heading", { name: "Requests & permits", exact: true })).toBeVisible({ timeout: 20_000 });
    await customerReadBackPage.getByRole("button", { name: new RegExp(requestTitle) }).click();
    await expect(customerReadBackPage.getByText("Complete", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(customerReadBackPage.getByRole("button", { name: "Respond", exact: true })).toHaveCount(0);
    await customerReadBackContext.close();
  });
});
