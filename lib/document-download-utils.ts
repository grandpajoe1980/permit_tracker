import type { DocumentRecord, DocumentVersionRecord } from "./domain-models";

export type DocumentBlobResult = {
  blob: Blob | null;
  error: Error | null;
};

export type DocumentDownloadResult = {
  success: boolean;
  error: Error | null;
};

export type DownloadDocumentBlob = (path: string) => Promise<DocumentBlobResult>;

/**
 * Dispatches a browser download from bytes that have already been retrieved.
 * The object URL remains alive long enough for browsers to hand it to their
 * background download manager.
 */
export function triggerFileDownload(blob: Blob, fileName: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.hidden = true;
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();

  window.setTimeout(() => {
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }, 60_000);
}

function normalizedStoragePath(storagePath: string): string {
  return storagePath
    .replace(/^supabase:\/\/storage\/(documents|path-documents)\//, "")
    .replace(/^(path-documents|documents)\//, "");
}

function safeFileName(version: DocumentVersionRecord): string {
  const pathName = normalizedStoragePath(version.storagePath ?? version.storageUri ?? "")
    .split("/")
    .pop();
  return (version.fileName || pathName || "document-download").replace(/[\\/:*?"<>|]/g, "_");
}

async function sha256(blob: Blob): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Downloads the exact object represented by a document version.
 *
 * There is deliberately no generated-file fallback: a missing Storage object
 * must be reported as unavailable instead of being disguised as a successful
 * official-document download.
 */
export async function downloadDocumentVersion(
  _document: DocumentRecord,
  version: DocumentVersionRecord,
  downloadBlob?: DownloadDocumentBlob,
): Promise<DocumentDownloadResult> {
  const storagePath = version.storagePath ?? version.storageUri;
  if (!storagePath) {
    return { success: false, error: new Error("This version has no Storage object path.") };
  }

  let blob: Blob | null = null;

  if (storagePath.startsWith("data:") || storagePath.startsWith("blob:")) {
    try {
      const response = await fetch(storagePath);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      blob = await response.blob();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error("The local document could not be read."),
      };
    }
  } else {
    if (!downloadBlob) {
      return { success: false, error: new Error("Supabase Storage download is unavailable.") };
    }

    const result = await downloadBlob(normalizedStoragePath(storagePath));
    if (result.error || !result.blob) {
      return {
        success: false,
        error: result.error ?? new Error("Supabase Storage returned no file data."),
      };
    }
    blob = result.blob;
  }

  if (version.fileSizeBytes > 0 && blob.size !== version.fileSizeBytes) {
    return {
      success: false,
      error: new Error(
        `Integrity check failed: expected ${version.fileSizeBytes} bytes but received ${blob.size}.`,
      ),
    };
  }

  const expectedHash = version.sha256Hash?.toLowerCase();
  if (/^[a-f0-9]{64}$/.test(expectedHash) && !/^0{64}$/.test(expectedHash)) {
    const actualHash = await sha256(blob);
    if (actualHash && actualHash !== expectedHash) {
      return {
        success: false,
        error: new Error("Integrity check failed: the downloaded file does not match its SHA-256 record."),
      };
    }
  }

  triggerFileDownload(blob, safeFileName(version));
  return { success: true, error: null };
}
