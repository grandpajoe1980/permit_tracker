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
    await pageCustomer.getByRole("button", { name: "Back to request choices", exact: true }).click();
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
    await expect(pageResponse.getByText("Response needed", { exact: true })).toBeVisible();
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
    await pageReadBack.getByRole("searchbox", { name: "Search my requests" }).fill(requestTitle);
    await pageReadBack.getByRole("button", { name: new RegExp(requestTitle) }).click();
    await expect(pageReadBack.getByText(customerResponse, { exact: false }).first()).toBeVisible();
    await contextReadBack.close();
  });
});
