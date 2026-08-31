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
    await expect(pageA.getByRole("button", { name: "Open SpaceX Pecan Island" })).toBeVisible();

    // Navigate to Requests & Permits
    await pageA.click("text=Requests & permits");
    await expect(pageA.locator("text=Customer intake")).toBeVisible();

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
    await expect(pageB.getByText(requestTitle, { exact: false }).first()).toBeVisible();

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
    await expect(pageReviewer.getByRole("heading", { name: "My Work", exact: true })).toBeVisible();

    // Select a real reviewer queue card that exposes the RFI command.
    const rfiCard = pageReviewer.locator("article").filter({ hasText: "COORDINATION" }).filter({ has: pageReviewer.getByRole("button", { name: "Request Information", exact: true }) }).first();
    await expect(rfiCard).toBeVisible();
    const rfiBtn = rfiCard.getByRole("button", { name: "Request Information", exact: true });
    await expect(rfiBtn).toBeVisible();
    await rfiBtn.click();
    await pageReviewer.fill("#question-text", questionText);
    await pageReviewer.getByRole("dialog").getByRole("button", { name: "Request Information", exact: true }).click();
    await expect(pageReviewer.getByRole("dialog")).not.toBeVisible();
    const issuedRfiCard = pageReviewer.locator("article").filter({ hasText: questionText }).first();
    await expect(issuedRfiCard).toBeVisible();
    await issuedRfiCard.getByRole("button", { name: "Open Work", exact: true }).click();
    await expect(pageReviewer.getByText("Waiting on Applicant (RFI Issued)", { exact: false }).first()).toBeVisible();

    await contextReviewer.close();

    // 2. Context B: Clean SpaceX Session responds to RFI
    const contextApplicant = await browser.newContext();
    const pageApplicant = await contextApplicant.newPage();
    await pageApplicant.goto("/");
    await expect(pageApplicant.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');

    await pageApplicant.click("#demo-login-trigger");
    await pageApplicant.click("#demo-persona-alex");
    await expect(pageApplicant.getByRole("heading", { name: "My Work", exact: true })).toBeVisible();

    await pageApplicant.getByRole("button", { name: /^My actions/ }).click();
    const customerQuestion = pageApplicant.locator("article").filter({ hasText: questionText }).first();
    await expect(customerQuestion).toBeVisible();
    await customerQuestion.getByRole("button", { name: "Open Work", exact: true }).click();
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
    await expect(pageReviewerAgain.getByRole("heading", { name: "My Work", exact: true })).toBeVisible();
    const reviewerResponse = pageReviewerAgain.locator("article").filter({ hasText: responseText }).first();
    await expect(reviewerResponse).toBeVisible();
    await reviewerResponse.getByRole("button", { name: "Open Work", exact: true }).click();
    await expect(pageReviewerAgain.getByText(questionText, { exact: false }).first()).toBeVisible();
    await expect(pageReviewerAgain.getByText(responseText, { exact: false }).first()).toBeVisible();
    await pageReviewerAgain.getByRole("button", { name: "Accept & Resume Review", exact: true }).click();
    await pageReviewerAgain.getByRole("dialog").getByRole("button", { name: "Accept & Resume Review", exact: true }).click();
    await expect(pageReviewerAgain.getByRole("dialog")).not.toBeVisible();
    await expect(pageReviewerAgain.getByText("Running (Response Accepted)", { exact: false }).first()).toBeVisible();
    await contextReviewerAgain.close();
  });
});
