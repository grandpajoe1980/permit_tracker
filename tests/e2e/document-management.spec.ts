import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

function readEnvFile(path = ".env") {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      }),
  );
}

const env = { ...readEnvFile(), ...process.env };
const admin = createClient(
  env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  env.SUPABASE_SERVICE_ROLE_KEY ?? env.legacy_service_role_key ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function signInAndOpenDocuments(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Alex Martin/ }).click();
  await expect(page.getByRole("button", { name: "Documents", exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Documents & Engineering Packages" })).toBeVisible();
}

test.describe("authoritative document Storage lifecycle", () => {
  test("uploads and downloads the exact original bytes through the site", async ({ page }, testInfo) => {
    const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const fileName = `document-lifecycle-${token}.txt`;
    const contents = Buffer.from(`PATH browser upload/download verification ${token}\n`, "utf8");

    try {
      await signInAndOpenDocuments(page);

      await page.locator("#customer-document-upload").setInputFiles({
        name: fileName,
        mimeType: "text/plain",
        buffer: contents,
      });

      await expect(page.getByRole("status")).toContainText("uploaded to Supabase Storage");
      const versionLabel = page.getByText(new RegExp(`v\\d+\\.0 · ${fileName}`));
      await expect(versionLabel).toBeVisible();

      const versionRow = versionLabel.locator("../..");
      const downloadPromise = page.waitForEvent("download");
      await versionRow.getByRole("button", { name: "Download", exact: true }).click();
      const download = await downloadPromise;
      const downloadedPath = testInfo.outputPath(fileName);
      await download.saveAs(downloadedPath);

      expect(download.suggestedFilename()).toBe(fileName);
      expect(readFileSync(downloadedPath)).toEqual(contents);
      await expect(page.getByRole("status")).toContainText(`Verified ${fileName}`);
    } finally {
      const versions = await admin
        .from("document_versions")
        .select("id, storage_path")
        .eq("file_name", fileName);
      for (const version of versions.data ?? []) {
        await admin.from("audit_events").delete().eq("entity_id", version.id);
        await admin.from("document_agency_reviews").delete().eq("document_version_id", version.id);
        await admin.from("document_versions").delete().eq("id", version.id);
        await admin.storage.from("path-documents").remove([version.storage_path]);
      }
    }
  });

  test("downloads a project-specific seeded demo PDF", async ({ page }, testInfo) => {
    await signInAndOpenDocuments(page);

    const seededVersion = page.getByText(/la82-drainage-hydrodynamic-demo-v1\.pdf/).first();
    const seededVersionRow = seededVersion.locator("../..");
    const downloadPromise = page.waitForEvent("download");
    await seededVersionRow.getByRole("button", { name: "Download", exact: true }).click();
    const download = await downloadPromise;
    const downloadedPath = testInfo.outputPath("la82-drainage-hydrodynamic-demo-v1.pdf");
    await download.saveAs(downloadedPath);

    expect(download.suggestedFilename()).toBe("la82-drainage-hydrodynamic-demo-v1.pdf");
    expect(readFileSync(downloadedPath).subarray(0, 5).toString()).toBe("%PDF-");
    await expect(page.getByRole("status")).toContainText("Verified la82-drainage-hydrodynamic-demo-v1.pdf");
  });
});
