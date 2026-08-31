import { getSupabaseBrowser } from "./client";

export async function calculateSHA256(buffer: ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const hashBuffer = await subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return "0".repeat(64);
}

export async function uploadDocumentFile(
  file: File,
  documentId: string,
  versionNumber: number,
  uploadId = crypto.randomUUID(),
): Promise<{ storagePath: string; error: Error | null }> {
  const client = getSupabaseBrowser();
  if (!client) return { storagePath: "", error: new Error("Supabase client unavailable") };

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${documentId}/v${versionNumber}/${uploadId}/${sanitizedName}`;
  const { error } = await client.storage.from("path-documents").upload(path, file, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });

  if (error) return { storagePath: "", error: new Error(`Storage upload failed: ${error.message}`) };
  return { storagePath: path, error: null };
}
