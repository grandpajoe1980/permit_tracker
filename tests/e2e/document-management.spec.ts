import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

async function signInAndOpenDocuments(page: Page) {
  await page.goto("/?projectId=PRJ-PECAN-2026");
  await expect(page.locator('#login-shell')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole("button", { name: "Quick Demo Sign-In" }).click();
  await page.locator("#demo-persona-alex").last().click();
  await expect(page.getByRole("button", { name: "Project Overview", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Project Overview", exact: true }).click();
  await page.getByRole("button", { name: "Project documents", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Project Document Vault", exact: true })).toBeVisible();
}

test.describe("authoritative document Storage lifecycle", () => {
  test("uploads and downloads the exact original bytes through the site", async ({ page }, testInfo) => {
    const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const fileName = `document-lifecycle-${token}.txt`;
    const contents = Buffer.from(`PATH browser upload/download verification ${token}\n`, "utf8");

    // Each run leaves a uniquely tagged immutable version in the disposable
    // acceptance project. Do not use a service-role key to erase audit evidence.
    await signInAndOpenDocuments(page);

    await page.locator('input[type="file"]').first().setInputFiles({
      name: fileName,
      mimeType: "text/plain",
      buffer: contents,
    });

    await expect(page.getByRole("status")).toContainText("uploaded to Supabase Storage");
    testInfo.annotations.push({ type: "created-file", description: fileName });
    const versionLabel = page.getByText(fileName, { exact: true });
    await expect(versionLabel).toBeVisible();

    const versionRow = versionLabel.locator("../..");
    const downloadPromise = page.waitForEvent("download");
    await versionRow.getByRole("button", { name: "File", exact: true }).click();
    const download = await downloadPromise;
    const downloadedPath = testInfo.outputPath(fileName);
    await download.saveAs(downloadedPath);

    expect(download.suggestedFilename()).toBe(fileName);
    expect(readFileSync(downloadedPath)).toEqual(contents);
    await expect(page.getByRole("status")).toContainText(`Verified ${fileName}`);
  });

  test("downloads a project-specific seeded demo PDF", async ({ page }, testInfo) => {
    await signInAndOpenDocuments(page);

    await page.getByRole("button", { name: "Select document LA-82 Heavy-Haul Drainage & Hydrodynamic Study", exact: true }).click();
    const seededVersion = page.getByText("la82-drainage-hydrodynamic-demo-v1.pdf", { exact: true });
    await expect(seededVersion).toBeVisible();
    const seededVersionRow = seededVersion.locator("../..");
    const downloadPromise = page.waitForEvent("download");
    await seededVersionRow.getByRole("button", { name: "File", exact: true }).click();
    const download = await downloadPromise;
    const downloadedPath = testInfo.outputPath("la82-drainage-hydrodynamic-demo-v1.pdf");
    await download.saveAs(downloadedPath);

    expect(download.suggestedFilename()).toBe("la82-drainage-hydrodynamic-demo-v1.pdf");
    expect(readFileSync(downloadedPath).subarray(0, 5).toString()).toBe("%PDF-");
    await expect(page.getByRole("status")).toContainText("Verified la82-drainage-hydrodynamic-demo-v1.pdf");
  });
});
