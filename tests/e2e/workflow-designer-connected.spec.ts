import { expect, test, type Locator, type Page } from "@playwright/test";

const PECAN_PROJECT = "PRJ-PECAN-2026";
const SPACEPORT_WORKFLOW = /spaceport_request/i;
const JOE_EMAIL = process.env.PATH_WORKFLOW_ADMIN_EMAIL ?? "joe.skaggs@la.gov";
const JOE_PASSWORD = process.env.PATH_WORKFLOW_ADMIN_PASSWORD ?? "PATH-MVP-2026!";

async function nativeSelectOptions(select: Locator) {
  return select.evaluate((element) => Array.from((element as HTMLSelectElement).options).map((option) => ({
    value: option.value,
    label: option.label?.trim() || option.text.replace(/\s+/g, " ").trim(),
    disabled: option.disabled,
    selected: option.selected,
  })));
}

async function openPecan(page: Page) {
  page.setDefaultTimeout(20_000);
  await page.goto(`/?projectId=${PECAN_PROJECT}`);
  await expect(page.locator("#login-shell")).toHaveAttribute("data-hydrated", "true");
}

async function latestWorkflowOption(select: Locator) {
  const options = await nativeSelectOptions(select);
  const matches = options
    .filter((option) => !option.disabled && SPACEPORT_WORKFLOW.test(`${option.label} ${option.value}`))
    .map((option) => ({ ...option, version: Number(option.label.match(/v\s*(\d+)/i)?.[1] ?? 0) }))
    .sort((left, right) => right.version - left.version);
  // A selected eligible version may be the only option when the select is scoped
  // to a single template. Keep that value usable even if the browser's label
  // property differs from its visible option text.
  const selectedSpaceport = options.find((option) => option.selected && !option.disabled && SPACEPORT_WORKFLOW.test(`${option.label} ${option.value}`));
  const chosen = matches[0] ?? selectedSpaceport;
  expect(chosen, `Pecan should expose the published SPACEPORT workflow versions; found: ${JSON.stringify(options)}`).toBeDefined();
  return chosen!.value;
}

async function inputIndexWithValue(inputs: Locator, value: string) {
  return inputs.evaluateAll((elements, expected) => elements.findIndex((element) => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element.value === expected;
    return false;
  }), value);
}

async function expectInputValue(inputs: Locator, value: string) {
  const index = await inputIndexWithValue(inputs, value);
  expect(index, `Expected an input with value "${value}"`).toBeGreaterThanOrEqual(0);
  await expect(inputs.nth(index)).toHaveValue(value);
}

async function selectSpaceportTemplate(designer: Locator) {
  const templateSelect = designer.getByRole("combobox", { name: "Workflow template" });
  if (await templateSelect.count()) {
    const options = await nativeSelectOptions(templateSelect);
    const spaceport = options.find((option) => SPACEPORT_WORKFLOW.test(option.label));
    expect(spaceport, "The template selector should include Pecan's SPACEPORT workflow").toBeDefined();
    await templateSelect.selectOption(spaceport!.value);
  } else {
    await expect(designer.getByRole("heading", { name: SPACEPORT_WORKFLOW })).toBeVisible();
  }
}

test.describe("Connected published workflow intake and routing", () => {
  test.setTimeout(180_000);

  test("Joe publishes a conditional SPACEPORT workflow and Alex receives a durable routed receipt", async ({ browser }) => {
    const suffix = Date.now().toString(36);
    const routeQuestion = "E2E project category";
    const followUpQuestion = "E2E facility detail";
    const routeAnswer = "Route to SPACEPORT";
    const routeRuleName = "E2E SPACEPORT route";
    const noticeTitle = "E2E routing notice";
    const noticeBody = "PATH routed this acceptance request to the SPACEPORT review team.";
    const requestTitle = `E2E published workflow request ${suffix}`;
    const followUpAnswer = `Bayou-style test payload ${suffix}`;

    // Joe configures the existing template that is visible to the Pecan project.
    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const adminPage = await adminContext.newPage();
    await openPecan(adminPage);
    await adminPage.getByLabel("Email address / username").fill(JOE_EMAIL);
    await adminPage.getByLabel("Password", { exact: true }).fill(JOE_PASSWORD);
    await adminPage.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(adminPage.getByRole("button", { name: "Administration", exact: true })).toBeVisible({ timeout: 30_000 });
    await adminPage.getByRole("button", { name: "Administration", exact: true }).click();

    const designer = adminPage.locator("#agency-registry");
    await expect(designer.getByRole("heading", { name: "Workflow Designer & Permit Catalog", exact: true })).toBeVisible({ timeout: 30_000 });
    await selectSpaceportTemplate(designer);

    const createDraft = designer.getByRole("button", { name: /^Create Draft v/ });
    if (await createDraft.count()) {
      await createDraft.click();
      await expect(designer.getByText(/^Editing Draft v\d+\.0$/)).toBeVisible({ timeout: 30_000 });
    } else {
      // Reuse an interrupted acceptance draft without discarding it.
      await expect(designer.getByText(/^Editing Draft v\d+\.0$/)).toBeVisible();
    }

    await designer.getByRole("tab", { name: /^Customer questions/ }).click();
    let questionInputs = designer.getByLabel("Customer-facing question");
    let routeQuestionIndex = await inputIndexWithValue(questionInputs, routeQuestion);
    if (routeQuestionIndex < 0) {
      await designer.getByRole("button", { name: "Add customer question", exact: true }).click();
      questionInputs = designer.getByLabel("Customer-facing question");
      routeQuestionIndex = await questionInputs.count() - 1;
    }
    const routeQuestionInput = questionInputs.nth(routeQuestionIndex);
    const routeQuestionSection = routeQuestionInput.locator("xpath=ancestor::section[1]");
    await routeQuestionInput.fill(routeQuestion);
    await routeQuestionSection.getByLabel("Answer type").selectOption("single_choice");
    await routeQuestionSection.getByRole("textbox", { name: /Choice options/ }).fill(`${routeAnswer}\nNo`);
    await routeQuestionSection.getByRole("checkbox", { name: "Required question" }).check();
    const routeQuestionKey = (await routeQuestionSection.locator("code").textContent())?.trim();
    expect(routeQuestionKey).toBeTruthy();

    questionInputs = designer.getByLabel("Customer-facing question");
    let followUpIndex = await inputIndexWithValue(questionInputs, followUpQuestion);
    if (followUpIndex < 0) {
      await designer.getByRole("button", { name: "Add customer question", exact: true }).click();
      questionInputs = designer.getByLabel("Customer-facing question");
      followUpIndex = await questionInputs.count() - 1;
    }
    const followUpInput = questionInputs.nth(followUpIndex);
    const followUpSection = followUpInput.locator("xpath=ancestor::section[1]");
    await followUpInput.fill(followUpQuestion);
    await followUpSection.getByRole("checkbox", { name: "Required question" }).check();
    if (await followUpSection.getByLabel("Condition source").count() === 0) {
      await followUpSection.getByRole("button", { name: "Add show condition", exact: true }).click();
    }
    const showConditionRemovers = followUpSection.getByRole("button", { name: "Remove condition", exact: true });
    while (await showConditionRemovers.count() > 1) await showConditionRemovers.last().click();
    await followUpSection.getByLabel("Condition source").first().selectOption("answer");
    await followUpSection.getByLabel("Question for condition").first().selectOption({ label: routeQuestion });
    await followUpSection.getByLabel("Condition match").first().selectOption("equals");
    await followUpSection.getByLabel("Matching answer").first().fill(routeAnswer);

    await designer.getByRole("tab", { name: /^Routing/ }).click();
    let routeRuleInputs = designer.getByLabel(/^Routing rule \d+ name$/);
    let routeRuleIndex = await inputIndexWithValue(routeRuleInputs, routeRuleName);
    if (routeRuleIndex < 0) {
      await designer.getByRole("button", { name: "Add routing rule", exact: true }).click();
      routeRuleInputs = designer.getByLabel(/^Routing rule \d+ name$/);
      routeRuleIndex = await routeRuleInputs.count() - 1;
    }
    const routeRuleInput = routeRuleInputs.nth(routeRuleIndex);
    const routeRuleSection = routeRuleInput.locator("xpath=ancestor::section[1]");
    await routeRuleInput.fill(routeRuleName);
    if (await routeRuleSection.getByLabel("Condition source").count() === 0) {
      await routeRuleSection.getByRole("button", { name: "Add condition", exact: true }).click();
    }
    const ruleConditionRemovers = routeRuleSection.getByRole("button", { name: "Remove condition", exact: true });
    while (await ruleConditionRemovers.count() > 1) await ruleConditionRemovers.last().click();
    await routeRuleSection.getByLabel("Condition source").first().selectOption("answer");
    await routeRuleSection.getByLabel("Question for condition").first().selectOption({ label: routeQuestion });
    await routeRuleSection.getByLabel("Condition match").first().selectOption("equals");
    await routeRuleSection.getByLabel("Matching answer").first().fill(routeAnswer);

    // Give the acceptance rule highest precedence over any existing rules.
    for (let index = routeRuleIndex; index > 0; index -= 1) {
      await designer.getByRole("button", { name: "Move routing rule up" }).nth(index).click();
    }
    await designer.getByRole("checkbox", { name: "Enable automatic routing" }).check();

    const prioritizedRuleSection = designer.getByLabel(/^Routing rule \d+ name$/).first().locator("xpath=ancestor::section[1]");
    const routeWorkflowSelect = prioritizedRuleSection.getByRole("combobox", { name: "Workflow version", exact: true });
    const latestWorkflowVersion = await latestWorkflowOption(routeWorkflowSelect);
    await routeWorkflowSelect.selectOption(latestWorkflowVersion);
    await expect(routeWorkflowSelect).toHaveValue(latestWorkflowVersion);
    const leadAgencySelect = prioritizedRuleSection.getByRole("combobox", { name: "Lead agency", exact: true });
    const spaceportOption = (await nativeSelectOptions(leadAgencySelect))
      .find((option) => option.value.toUpperCase() === "SPACEPORT")?.value ?? "";
    expect(spaceportOption, "SPACEPORT must be an available Pecan lead agency").toBe("SPACEPORT");
    await leadAgencySelect.selectOption(spaceportOption);
    const assignmentTeam = prioritizedRuleSection.getByRole("combobox", { name: /Assignment team/ });
    const spaceportTeamValue = (await nativeSelectOptions(assignmentTeam))
      .find((option) => !option.disabled && /SpaceX Regulatory Affairs/i.test(option.label))?.value ?? "";
    expect(spaceportTeamValue, "The SPACEPORT intake team should be available for routing").not.toBe("");
    await assignmentTeam.selectOption(spaceportTeamValue);
    await expect(assignmentTeam).toHaveValue(spaceportTeamValue);

    await designer.getByRole("tab", { name: /^Stage paths & notices/ }).click();
    let noticeTitleInputs = designer.getByLabel("Notice title", { exact: true });
    let noticeIndex = await inputIndexWithValue(noticeTitleInputs, noticeTitle);
    if (noticeIndex < 0) {
      await designer.getByRole("button", { name: "Add in-app notice", exact: true }).click();
      noticeTitleInputs = designer.getByLabel("Notice title", { exact: true });
      noticeIndex = await noticeTitleInputs.count() - 1;
    }
    const noticeTitleInput = noticeTitleInputs.nth(noticeIndex);
    const noticeCard = noticeTitleInput.locator("xpath=ancestor::div[contains(@class, 'rounded-xl')][1]");
    await noticeTitleInput.fill(noticeTitle);
    await noticeCard.locator("textarea").first().fill(noticeBody);
    const recipientsSelect = noticeCard.locator("label").filter({ hasText: /^Recipients/ }).locator("select");
    await recipientsSelect.selectOption("both");
    await expect(recipientsSelect).toHaveValue("both");

    await designer.getByRole("button", { name: "Save Draft", exact: true }).click();
    await expect(designer.getByRole("status").filter({ hasText: "Draft changes saved to the database." })).toBeVisible({ timeout: 30_000 });

    // Reload to prove the draft can be reopened from Supabase before validation/publish.
    await adminPage.reload();
    await expect(adminPage.locator("#login-shell")).toHaveAttribute("data-hydrated", "true");
    await adminPage.getByRole("button", { name: "Administration", exact: true }).click();
    const reopenedDesigner = adminPage.locator("#agency-registry");
    await expect(reopenedDesigner.getByRole("heading", { name: "Workflow Designer & Permit Catalog", exact: true })).toBeVisible({ timeout: 30_000 });
    await selectSpaceportTemplate(reopenedDesigner);
    await expect(reopenedDesigner.getByText(/^Editing Draft v\d+\.0$/)).toBeVisible();
    await reopenedDesigner.getByRole("tab", { name: /^Customer questions/ }).click();
    const reopenedQuestions = reopenedDesigner.getByLabel("Customer-facing question");
    await expectInputValue(reopenedQuestions, routeQuestion);
    await expectInputValue(reopenedQuestions, followUpQuestion);
    await reopenedDesigner.getByRole("tab", { name: /^Routing/ }).click();
    const reopenedRuleNames = reopenedDesigner.getByLabel(/^Routing rule \d+ name$/);
    await expect.poll(() => reopenedRuleNames.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))).toContain(routeRuleName);
    await reopenedDesigner.getByRole("tab", { name: /^Stage paths & notices/ }).click();
    await expectInputValue(reopenedDesigner.getByLabel("Notice title", { exact: true }), noticeTitle);
    await expect(reopenedDesigner.getByRole("textbox", { name: "Message", exact: true })).toHaveValue(noticeBody);

    await reopenedDesigner.getByRole("button", { name: "Validate", exact: true }).click();
    await expect(reopenedDesigner.getByText(/Validation passed for draft v\d+\.0/)).toBeVisible({ timeout: 30_000 });
    await reopenedDesigner.getByRole("button", { name: "Review & Publish", exact: true }).click();
    const publishDialog = reopenedDesigner.getByRole("dialog");
    await expect(publishDialog.getByRole("heading", { name: "Pre-Publish Workflow Version Review", exact: true })).toBeVisible();
    await publishDialog.getByRole("button", { name: /^Confirm & Publish Version v/ }).click();
    await expect(reopenedDesigner.getByText(/Workflow published as v\d+\.0!/)).toBeVisible({ timeout: 30_000 });
    await adminContext.close();

    // Alex's separate session submits against the latest visible published version.
    const customerContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const customerPage = await customerContext.newPage();
    await openPecan(customerPage);
    await customerPage.click("#demo-login-trigger");
    await customerPage.click("#demo-persona-alex");
    await expect(customerPage.getByRole("button", { name: "My requests", exact: true })).toBeVisible({ timeout: 30_000 });
    await customerPage.getByRole("button", { name: "My requests", exact: true }).click();
    await expect(customerPage.getByRole("heading", { name: "Requests & permits", exact: true })).toBeVisible();
    await customerPage.getByText("Submit / track a permit or authorization", { exact: true }).click();

    const intakeWorkflowSelect = customerPage.getByLabel("Intake workflow", { exact: true });
    if (await intakeWorkflowSelect.count()) {
      await intakeWorkflowSelect.selectOption(await latestWorkflowOption(intakeWorkflowSelect));
    }
    const intakeForm = customerPage.locator("section[data-workflow-version-id]");
    await expect(intakeForm).toBeVisible({ timeout: 30_000 });
    const submittedWorkflowVersionId = await intakeForm.getAttribute("data-workflow-version-id");
    expect(submittedWorkflowVersionId).toBeTruthy();
    const customerRouteQuestion = intakeForm.getByLabel(routeQuestion, { exact: false });
    await expect(customerRouteQuestion).toBeVisible();
    await expect(intakeForm.getByLabel(followUpQuestion, { exact: false })).toHaveCount(0);
    await customerRouteQuestion.selectOption({ label: routeAnswer });
    const customerFollowUp = intakeForm.getByLabel(followUpQuestion, { exact: false });
    await expect(customerFollowUp).toBeVisible();
    await customerFollowUp.fill(followUpAnswer);

    await customerPage.getByLabel("PATH tracking title", { exact: true }).fill(requestTitle);
    await customerPage.getByLabel("Supporting context and requested outcome", { exact: true }).fill("Connected acceptance for conditional intake, published routing, and persistent receipt.");

    const createRequestResponse = customerPage.waitForResponse((response) =>
      response.request().method() === "POST" && /\/rpc\/rpc_create_customer_request(?:\?|$)/.test(response.url()),
    );
    await customerPage.getByRole("button", { name: "Submit request", exact: true }).click();
    const requestResponse = await createRequestResponse;
    const requestResponseBody = await requestResponse.json() as unknown;
    expect(requestResponse.ok(), `Request RPC returned ${requestResponse.status()}: ${JSON.stringify(requestResponseBody)}`).toBeTruthy();
    expect(requestResponseBody && typeof requestResponseBody === "object" && !Array.isArray(requestResponseBody), `Request RPC returned an unexpected payload: ${JSON.stringify(requestResponseBody)}`).toBeTruthy();
    const persistedRequest = requestResponseBody as {
      intake_workflow_version_id?: string;
      intake_answers?: Record<string, string | boolean>;
      auto_route_receipt?: { status?: string; leadOrgCode?: string; leadOrgName?: string; workstreamCode?: string; assignmentGroupId?: string; destinationWorkflowVersionId?: string };
    };
    expect(
      persistedRequest.intake_workflow_version_id,
      `Successful request RPC omitted the intake workflow ID. Response keys: ${Object.keys(persistedRequest).join(", ")}; body: ${JSON.stringify(requestResponseBody)}`,
    ).toBe(submittedWorkflowVersionId);
    expect(persistedRequest.intake_answers?.[routeQuestionKey!]).toBe(routeAnswer);
    expect(Object.values(persistedRequest.intake_answers ?? {})).toContain(followUpAnswer);
    expect(persistedRequest.auto_route_receipt?.status).toBe("routed");
    expect(persistedRequest.auto_route_receipt?.leadOrgCode).toBe("SPACEPORT");
    expect(persistedRequest.auto_route_receipt?.leadOrgName).toBe("SpaceX Project Delivery");
    expect(persistedRequest.auto_route_receipt?.workstreamCode).toMatch(/^REQ-PATH-/);
    expect(persistedRequest.auto_route_receipt?.assignmentGroupId).toBeTruthy();
    expect(submittedWorkflowVersionId).not.toBe(latestWorkflowVersion);
    expect(persistedRequest.auto_route_receipt?.destinationWorkflowVersionId).toBe(submittedWorkflowVersionId);

    await expect(customerPage.getByText("Request submitted", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(customerPage.getByText(requestTitle, { exact: true })).toBeVisible();
    await expect(customerPage.getByText(/Automatically routed to SpaceX Project Delivery as REQ-PATH-/i)).toBeVisible();
    await expect(customerPage.getByText(/Status: .*Automatically routed/)).toBeVisible();
    await customerPage.getByRole("button", { name: "Open notifications", exact: true }).click();
    await expect(customerPage.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
    await expect(customerPage.getByText(noticeTitle, { exact: true }).first()).toBeVisible({ timeout: 30_000 });

    // The routed receipt and configured notice both remain available after a clean page refresh.
    await customerPage.reload();
    await expect(customerPage.locator("#login-shell")).toHaveAttribute("data-hydrated", "true");
    await customerPage.getByRole("button", { name: "Home", exact: true }).click();
    const requestHistory = customerPage.locator('section[aria-label="Recent request updates"]');
    const persistedRequestCard = requestHistory.getByRole("button").filter({ hasText: requestTitle });
    await expect(persistedRequestCard).toBeVisible({ timeout: 30_000 });
    await expect(persistedRequestCard).toContainText(/Routed to SpaceX Project Delivery/i);
    await customerPage.getByRole("button", { name: "Open notifications", exact: true }).click();
    await expect(customerPage.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
    await expect(customerPage.getByText(noticeTitle, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await expect(customerPage.getByText("customer request auto routed", { exact: true }).first()).toBeVisible();
    await expect(customerPage.getByText(`Matched published workflow rule ${routeRuleName}`, { exact: true }).first()).toBeVisible();
    await customerContext.close();
  });
});
