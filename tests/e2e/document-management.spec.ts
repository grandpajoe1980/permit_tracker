import { test, expect } from "@playwright/test";

test.describe("Document Storage, Search, Retrieval, and In-App Viewer System", () => {
  test("Scenario 1: Customer Document Center Search, Multi-Project Inspection, and In-App Modal Preview", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 1. Sign in as Alex Martin (SpaceX Customer / Submitter)
    const alexBtn = page.locator("#demo-persona-alex-martin");
    await alexBtn.waitFor({ state: "visible" });
    await alexBtn.click();
    await expect(page.locator("text=SpaceX Pecan Island").first()).toBeVisible();

    // 2. Navigate to Customer Document Center
    await page.click("button:has-text('Documents')");
    await expect(page.locator("text=Customer document center")).toBeVisible();
    await expect(page.locator("text=Documents & Engineering Packages")).toBeVisible();

    // 3. Verify multi-project documents are listed
    await expect(page.locator("text=LA-82 Heavy-Haul Drainage & Hydrodynamic Study").first()).toBeVisible();
    await expect(page.locator("text=Freshwater Bayou Bridge Structural Load Rating & Axle Matrix").first()).toBeVisible();
    await expect(page.locator("text=Launch Complex Wetland Delineation & Mitigation Package").first()).toBeVisible();
    await expect(page.locator("text=Industrial Deluge Water Containment & Retention Basin Report").first()).toBeVisible();

    // 4. Open In-App Document Viewer Modal for Drainage Study
    const viewButtons = page.locator("button:has-text('View & Inspect')");
    await viewButtons.first().click();

    // Assert Modal Contents
    const modal = page.locator("[role='dialog']");
    await expect(modal).toBeVisible();
    await expect(modal.locator("text=SHA-256 Cryptographic Checksum")).toBeVisible();
    await expect(modal.locator("text=Malware Clean · Verified")).toBeVisible();
    await expect(modal.locator("text=Document Content Preview & Engineering Specification")).toBeVisible();
    await expect(modal.locator("text=Interagency Review Certification Matrix")).toBeVisible();
    await expect(modal.locator("button:has-text('Download Official File')")).toBeVisible();

    // 5. Click Download Official File
    await modal.locator("button:has-text('Download Official File')").click();

    // Close Modal
    await modal.locator("button:has-text('Close Preview')").click();
    await expect(modal).not.toBeVisible();
  });

  test("Scenario 2: Government Document Vault Multi-Project Filtering and Direct Permit Navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 1. Sign in as Sam Rivera (DOTD Infrastructure Lead)
    const samBtn = page.locator("#demo-persona-sam-rivera");
    await samBtn.waitFor({ state: "visible" });
    await samBtn.click();
    await expect(page.locator("text=My Work").first()).toBeVisible();

    // 2. Navigate to Document Vault via Secondary Tools
    await page.click("button:has-text('Document Vault')");
    await expect(page.locator("text=Project Document Vault")).toBeVisible();
    await expect(page.locator("text=Single Source of Truth Document Vault")).toBeVisible();

    // 3. Search for Bridge Load Rating Package
    const searchInput = page.locator("input[placeholder*='Search by title']");
    await searchInput.fill("Bridge");
    await expect(page.locator("text=Freshwater Bayou Bridge Structural Load Rating & Axle Matrix").first()).toBeVisible();

    // 4. Clear filter and select workstream filter
    await searchInput.fill("");
    const wsSelect = page.locator("select[aria-label='Filter documents by project or workstream']");
    await wsSelect.selectOption({ label: "WS-LA82-HEAVYHAUL · LA-82 Heavy-Haul Access & Bridge Reinforcement (3)" });

    // Assert all 3 documents for LA-82 Heavy-Haul are present
    await expect(page.locator("text=LA-82 Heavy-Haul Drainage & Hydrodynamic Study").first()).toBeVisible();
    await expect(page.locator("text=Freshwater Bayou Bridge Structural Load Rating & Axle Matrix").first()).toBeVisible();
    await expect(page.locator("text=LA-82 Heavy Transport Traffic Management & Escort Protocol").first()).toBeVisible();

    // 5. Open In-App Preview from Vault
    await page.locator("button:has-text('In-App Preview & Inspection')").first().click();
    const modal = page.locator("[role='dialog']");
    await expect(modal).toBeVisible();
    await expect(modal.locator("text=SHA-256 Cryptographic Checksum")).toBeVisible();
    await modal.locator("button[aria-label='Close document viewer']").click();
    await expect(modal).not.toBeVisible();

    // 6. Navigate to Permit Detail from Work Item
    await page.click("button:has-text('My Work')");
    await page.locator("text=Open Work").first().click();

    // Verify permit detail shows Linked Documents section with packages
    await expect(page.locator("text=Project Documents & Packages")).toBeVisible();
    await expect(page.locator("button:has-text('View Document')").first()).toBeVisible();
  });
});
