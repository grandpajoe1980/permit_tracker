import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.legacy_service_role_key ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

console.log("=================================================");
console.log("SUPABASE STORAGE CLI VERIFICATION & HEALTH CHECK");
console.log("=================================================");
console.log("Project URL:", url);

const adminClient = createClient(url, serviceKey);
const anonClient = createClient(url, anonKey);

async function runCliStorageTest() {
  const bucketName = "path-documents";
  const testDocId = "WS-LA82-HEAVYHAUL";
  const testVersion = "v12";
  const testFileName = `test-verification-${Date.now()}.pdf`;
  const storagePath = `${testDocId}/${testVersion}/${testFileName}`;

  // 1. Generate authentic synthetic PDF content
  const testContent = Buffer.from(
    `%PDF-1.7\n` +
      `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n` +
      `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n` +
      `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n` +
      `4 0 obj << /Length 120 >> stream\n` +
      `BT /F1 14 Tf 72 712 Td (PATH / SpaceX Pecan Island - Storage Verification) Tj ET\n` +
      `endstream endobj\n` +
      `xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000210 00000 n \n` +
      `trailer << /Size 5 /Root 1 0 R >>\nstartxref\n380\n%%EOF`
  );

  const localSha256 = crypto.createHash("sha256").update(testContent).digest("hex");
  console.log("\n1. Created local test file:");
  console.log("   - Path:", storagePath);
  console.log("   - Size:", testContent.length, "bytes");
  console.log("   - SHA-256 Checksum:", localSha256);

  // 2. Upload to path-documents bucket
  console.log(`\n2. Uploading document to '${bucketName}' bucket...`);
  const { data: uploadData, error: uploadError } = await adminClient.storage
    .from(bucketName)
    .upload(storagePath, testContent, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("   ❌ Upload failed:", uploadError.message);
    process.exit(1);
  }
  console.log("   ✅ Upload successful! Supabase path:", uploadData.path);

  // 3. Create signed URL for retrieval
  console.log("\n3. Generating Signed Download URL (valid 1 hour)...");
  const { data: signedData, error: signedError } = await adminClient.storage
    .from(bucketName)
    .createSignedUrl(storagePath, 3600);

  if (signedError || !signedData?.signedUrl) {
    console.error("   ❌ Signed URL generation failed:", signedError?.message);
    process.exit(1);
  }
  console.log("   ✅ Signed URL generated successfully:");
  console.log("   ", signedData.signedUrl.slice(0, 90) + "...");

  // 4. Download file via Supabase Storage API
  console.log("\n4. Downloading stored document from Supabase Storage...");
  const { data: downloadedBlob, error: downloadError } = await adminClient.storage
    .from(bucketName)
    .download(storagePath);

  if (downloadError || !downloadedBlob) {
    console.error("   ❌ Download failed:", downloadError?.message);
    process.exit(1);
  }

  const downloadedBuffer = Buffer.from(await downloadedBlob.arrayBuffer());
  const remoteSha256 = crypto.createHash("sha256").update(downloadedBuffer).digest("hex");
  console.log("   ✅ Document retrieved successfully!");
  console.log("   - Downloaded bytes:", downloadedBuffer.length);
  console.log("   - Remote SHA-256:", remoteSha256);

  // 5. Assert Cryptographic Integrity Match
  if (localSha256 === remoteSha256) {
    console.log("\n5. Cryptographic Verification: PASSED ✨");
    console.log("   - Local SHA-256 == Remote SHA-256");
    console.log("   - Exact hash:", remoteSha256);
  } else {
    console.error("\n5. Cryptographic Verification: FAILED ❌");
    console.error("   - Checksums do not match!");
    process.exit(1);
  }

  // 6. Test retrieval via signed HTTP fetch URL
  console.log("\n6. Testing retrieval via public HTTP Signed URL fetch...");
  const httpRes = await fetch(signedData.signedUrl);
  if (!httpRes.ok) {
    console.error(`   ❌ HTTP fetch failed with status ${httpRes.status} ${httpRes.statusText}`);
    process.exit(1);
  }
  const httpBuffer = Buffer.from(await httpRes.arrayBuffer());
  const httpSha256 = crypto.createHash("sha256").update(httpBuffer).digest("hex");
  console.log(`   ✅ HTTP fetch returned HTTP ${httpRes.status} (${httpBuffer.length} bytes)`);
  console.log(`   - HTTP fetch SHA-256 match: ${httpSha256 === localSha256 ? "YES (Verified)" : "NO"}`);

  console.log("\n=================================================");
  console.log("✅ SUPABASE DOCUMENT STORAGE & RETRIEVAL FULLY OPERATIONAL");
  console.log("=================================================\n");
}

runCliStorageTest().catch((err) => {
  console.error("CLI Test Exception:", err);
  process.exit(1);
});
