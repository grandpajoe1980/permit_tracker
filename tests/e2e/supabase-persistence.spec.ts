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
});
