import { test, expect } from "@playwright/test";

const BAYOU_PROJECT = "PRJ-BAYOU-2026";
const PECAN_PROJECT = "PRJ-PECAN-2026";
const ARIS_EMAIL = process.env.PATH_BAYOU_CUSTOMER_EMAIL ?? "aris.thorne@demo.permit.local";
const ARIS_PASSWORD = process.env.PATH_BAYOU_CUSTOMER_PASSWORD ?? "SpaceX-Demo-2026!";

async function openLogin(page: import("@playwright/test").Page, projectNumber: string) {
  await page.goto(`/?projectId=${encodeURIComponent(projectNumber)}`);
  await expect(page.locator("#login-shell")).toHaveAttribute("data-hydrated", "true");
}

async function signInAsDemoPersona(page: import("@playwright/test").Page, personaId: "alex" | "sarah") {
  await page.click("#demo-login-trigger");
  await page.click(`#demo-persona-${personaId}`);
}

test.describe("Connected project access isolation", () => {
  test.setTimeout(120_000);

  test("Aris lands only in Bayou even when opening a SpaceX project link, at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLogin(page, PECAN_PROJECT);
    await page.getByLabel("Email address / username").fill(ARIS_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(ARIS_PASSWORD);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`[?&]projectId=${BAYOU_PROJECT}(?:&|$)`), { timeout: 30_000 });
    await expect(page.locator("header").getByText("Bayou Horizon Materials Campus", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What do you need help with?", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("combobox", { name: "Current project" })).toHaveCount(0);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
    await expect(page.getByText(/Starbase Louisiana Launch Complex|PRJ-PECAN-2026/, { exact: false })).toHaveCount(0);
  });

  test("Alex can select SpaceX projects but Bayou is not in his project list", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openLogin(page, PECAN_PROJECT);
    await signInAsDemoPersona(page, "alex");

    const projects = page.getByRole("combobox", { name: "Current project" });
    await expect(projects).toBeVisible({ timeout: 30_000 });
    await expect(projects.locator('option[value="PRJ-PECAN-2026"]')).toHaveCount(1);
    await expect(projects.locator('option[value="PRJ-BAYOU-2026"]')).toHaveCount(0);
  });

  test("Sarah sees both customer projects, switches cleanly, and can switch at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openLogin(page, PECAN_PROJECT);
    await signInAsDemoPersona(page, "sarah");

    const projects = page.getByRole("combobox", { name: "Current project" });
    await expect(projects).toBeVisible({ timeout: 30_000 });
    await expect(projects).toHaveValue(PECAN_PROJECT);
    await expect(projects.locator('option[value="PRJ-PECAN-2026"]')).toHaveCount(1);
    await expect(projects.locator('option[value="PRJ-BAYOU-2026"]')).toHaveCount(1);

    await page.reload();
    await expect(page.getByRole("combobox", { name: "Current project" })).toHaveValue(PECAN_PROJECT, { timeout: 30_000 });

    await page.getByRole("button", { name: "Team Work", exact: true }).click();
    const teamFilter = page.getByRole("searchbox", { name: "Filter team work" });
    await expect(teamFilter).toBeVisible();
    await teamFilter.fill("cross-project-filter-check");
    await expect(teamFilter).toHaveValue("cross-project-filter-check");

    await projects.selectOption(BAYOU_PROJECT);
    await expect(projects).toHaveValue(BAYOU_PROJECT, { timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`[?&]projectId=${BAYOU_PROJECT}(?:&|$)`));
    await page.getByRole("button", { name: "Team Work", exact: true }).click();
    await expect(page.getByRole("searchbox", { name: "Filter team work" })).toHaveValue("");

    await page.getByRole("button", { name: "Project Overview", exact: true }).click();
    const main = page.locator("#main-content");
    await expect(main.getByRole("heading", { name: "Bayou Horizon Materials Campus", exact: true })).toBeVisible();
    await expect(main.getByText("Starbase Louisiana Launch Complex", { exact: false })).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileOverflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth > window.innerWidth + 1,
      main: (document.getElementById("main-content")?.scrollWidth ?? 0) > (document.getElementById("main-content")?.clientWidth ?? 0) + 1,
    }));
    expect(mobileOverflow).toEqual({ document: false, main: false });

    await projects.selectOption(PECAN_PROJECT);
    await expect(projects).toHaveValue(PECAN_PROJECT, { timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`[?&]projectId=${PECAN_PROJECT}(?:&|$)`));
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await expect(page.getByRole("button", { name: "Team Work", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Team Work", exact: true }).click();
    await expect(page.getByRole("searchbox", { name: "Filter team work" })).toHaveValue("");
  });
});
