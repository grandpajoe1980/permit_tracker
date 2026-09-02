export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
]);

export function validateDocumentFile(file: File): Error | null {
  if (!file.name.trim()) return new Error("Choose a file with a name.");
  if (file.name.length > 180) return new Error("File names must be 180 characters or fewer.");
  if (file.size <= 0) return new Error("Empty files cannot be uploaded.");
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) return new Error("Files must be 25 MB or smaller.");
  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.type)) {
    return new Error("This file type is not supported. Upload a PDF, text, spreadsheet, document, PNG, or JPEG.");
  }
  return null;
}
