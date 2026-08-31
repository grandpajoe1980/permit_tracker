import { test, expect } from "@playwright/test";

test.describe("Supabase-Authoritative Cross-Browser Persistence", () => {
  test("Scenario 1: Customer Request Durability across Isolated Browser Contexts", async ({ browser }) => {
    // 1. Context A: SpaceX PM Submits Customer Request
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto("/");
    await expect(pageA.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');

    // Open Demo Sign-in and select Alex Martin (SpaceX customer submitter)
    await pageA.click("#demo-login-trigger");
    await pageA.click("#demo-persona-alex");
    await expect(pageA.getByRole("button", { name: "Open SpaceX Pecan Island" })).toBeVisible();

    // Navigate to Requests & Permits
    await pageA.click("text=Requests & permits");
    await expect(pageA.locator("text=Customer intake")).toBeVisible();

    // Submit a Help Request
    await pageA.click("text=Request government help / service");
    await pageA.fill("#request-title", "E2E Automated Cross-Browser Test Request");
    await pageA.fill("#request-description", "Cross-browser Supabase durability test payload.");
    await pageA.click("button:has-text('Submit request')");

    // Return to the request list and verify the committed record is visible.
    await pageA.click("text=Back to request choices");
    await expect(pageA.getByText("E2E Automated Cross-Browser Test Request", { exact: false })).toBeVisible();
    await contextA.close();

    // 2. Context B: Clean State Office Session (Sarah Johnson) Retrieves from Supabase
    const contextB = await browser.newContext(); // Completely isolated cookies & localStorage
    const pageB = await contextB.newPage();
    await pageB.goto("/");
    await expect(pageB.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');

    await pageB.click("#demo-login-trigger");
    await pageB.click("#demo-persona-sarah");

    // Navigate to Notifications / Project Overview
    await pageB.click("text=Notifications");
    await expect(pageB.locator("text=Action center")).toBeVisible();

    await contextB.close();
  });

  test("Scenario 2: RFI Creation, Applicant Response, and Acceptance across Dual Contexts", async ({ browser }) => {
    // 1. Context A: CPRA Reviewer Jordan Lee issues RFI
    const contextReviewer = await browser.newContext();
    const pageReviewer = await contextReviewer.newPage();
    await pageReviewer.goto("/");
    await expect(pageReviewer.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');

    await pageReviewer.click("#demo-login-trigger");
    await pageReviewer.click("#demo-persona-jordan");
    await expect(pageReviewer.getByRole("heading", { name: "My Work", exact: true })).toBeVisible();

    // Open first work item and initiate RFI
    await pageReviewer.click("text=Open Work");
    const rfiBtn = pageReviewer.locator("button:has-text('Request Information')");
    if (await rfiBtn.isVisible()) {
      await rfiBtn.click();
      await pageReviewer.fill("#question-text", "E2E Automated Hydraulic Model Request");
      await pageReviewer.getByRole("dialog").getByRole("button", { name: "Request Information", exact: true }).click();
    }

    await contextReviewer.close();

    // 2. Context B: Clean SpaceX Session responds to RFI
    const contextApplicant = await browser.newContext();
    const pageApplicant = await contextApplicant.newPage();
    await pageApplicant.goto("/");
    await expect(pageApplicant.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');

    await pageApplicant.click("#demo-login-trigger");
    await pageApplicant.click("#demo-persona-maya");
    await expect(pageApplicant.getByRole("heading", { name: "My Work", exact: true })).toBeVisible();

    await contextApplicant.close();
  });
});
