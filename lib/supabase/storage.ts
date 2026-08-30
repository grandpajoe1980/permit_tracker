import { getSupabaseBrowser } from "./client";
import { insertAuditEvent, insertNotification } from "./mutations";
import type { DocumentAgencyReviewRecord, DocumentVersionRecord } from "../domain-models";

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
  versionNumber: number
): Promise<{ storagePath: string; error: Error | null }> {
  const client = getSupabaseBrowser();
  if (!client) return { storagePath: "", error: new Error("Supabase client unavailable") };

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${documentId}/v${versionNumber}/${sanitizedName}`;

  const { error } = await client.storage
    .from("path-documents")
    .upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

  if (error) {
    return { storagePath: "", error: new Error(`Storage upload failed: ${error.message}`) };
  }

  return { storagePath: path, error: null };
}

export async function getSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<{ signedUrl: string | null; error: Error | null }> {
  const client = getSupabaseBrowser();
  if (!client) return { signedUrl: null, error: new Error("Supabase client unavailable") };

  const cleanPath = storagePath
    .replace(/^supabase:\/\/storage\/(documents|path-documents)\//, "")
    .replace(/^(path-documents|documents|vault)\//, "");

  const { data, error } = await client.storage
    .from("path-documents")
    .createSignedUrl(cleanPath, expiresInSeconds);

  if (error) {
    return { signedUrl: null, error: new Error(`Failed to generate download URL: ${error.message}`) };
  }

  return { signedUrl: data.signedUrl, error: null };
}

export async function mutateUploadDocumentVersion(params: {
  documentId: string;
  documentTitle: string;
  versionNumber: number;
  versionLabel: string;
  file: File;
  uploadedByName: string;
  uploadedByOrgName: string;
  changeNotes: string;
  reviewingAgencyCodes: string[];
  projectId?: string;
  actorId?: string;
}): Promise<{ data: DocumentVersionRecord | null; error: Error | null }> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const fileBuffer = await params.file.arrayBuffer();
  const sha256Hash = await calculateSHA256(fileBuffer);

  // 1. Upload to Supabase Storage
  const { storagePath, error: uploadError } = await uploadDocumentFile(
    params.file,
    params.documentId,
    params.versionNumber
  );

  if (uploadError) {
    return { data: null, error: uploadError };
  }

  const versionId = `doc-v-${params.documentId.toLowerCase()}-v${params.versionNumber}`;
  const now = new Date().toISOString();

  // 2. Try RPC function
  const rpcPayload = {
    p_version_id: versionId,
    p_document_id: params.documentId,
    p_version_number: params.versionNumber,
    p_version_label: params.versionLabel,
    p_storage_path: storagePath,
    p_file_name: params.file.name,
    p_mime_type: params.file.type || "application/pdf",
    p_file_size_bytes: params.file.size,
    p_sha256_hash: sha256Hash,
    p_uploaded_by_name: params.uploadedByName,
    p_uploaded_by_org_name: params.uploadedByOrgName,
    p_change_notes: params.changeNotes,
    p_reviewing_agency_codes: params.reviewingAgencyCodes,
    p_project_id: params.projectId ?? null,
    p_actor_id: params.actorId ?? null,
  };

  const { data: rpcData, error: rpcError } = await client.rpc("rpc_create_document_version", rpcPayload);
  if (!rpcError && rpcData) {
    const res = rpcData as Record<string, unknown>;
    return {
      data: {
        id: versionId,
        documentId: params.documentId,
        versionNumber: params.versionNumber,
        versionLabel: params.versionLabel,
        versionTag: params.versionLabel,
        storagePath,
        storageUri: storagePath,
        fileName: params.file.name,
        mimeType: params.file.type || "application/pdf",
        fileSizeBytes: params.file.size,
        sha256Hash,
        uploadedByName: params.uploadedByName,
        uploadedByOrgName: params.uploadedByOrgName,
        changeNotes: params.changeNotes,
        changeSummary: params.changeNotes,
        isMalwareClean: true,
        status: "under_review",
        uploadedAt: now,
        agencyReviews: (res.agencyReviews as DocumentAgencyReviewRecord[]) || [],
      },
      error: null,
    };
  }

  // 3. Fallback direct PostgreSQL inserts
  const { error: verError } = await client.from("document_versions").insert({
    id: versionId,
    document_ref_id: params.documentId,
    version_number: params.versionNumber,
    version_label: params.versionLabel,
    storage_path: storagePath,
    file_name: params.file.name,
    mime_type: params.file.type || "application/pdf",
    file_size_bytes: params.file.size,
    sha256_hash: sha256Hash,
    uploaded_by_name: params.uploadedByName,
    uploaded_by_org_name: params.uploadedByOrgName,
    change_notes: params.changeNotes,
    status: "under_review",
    created_at: now,
  });

  if (verError) return { data: null, error: new Error(verError.message) };

  const reviews: DocumentAgencyReviewRecord[] = [];
  for (const agencyCode of params.reviewingAgencyCodes) {
    const revId = `rev-${versionId}-${agencyCode.toLowerCase()}`;
    await client.from("document_agency_reviews").insert({
      id: revId,
      document_version_id: versionId,
      reviewing_org_id: `org-${agencyCode.toLowerCase()}`,
      reviewing_org_code: agencyCode,
      status: "under_review",
      review_status: "under_review",
      created_at: now,
    });

    reviews.push({
      id: revId,
      documentVersionId: versionId,
      workstreamId: "",
      reviewingOrgId: `org-${agencyCode.toLowerCase()}`,
      reviewingOrgCode: agencyCode,
      reviewStatus: "under_review",
      status: "under_review",
    });
  }

  await insertAuditEvent({
    entityType: "document_version",
    entityId: versionId,
    actorName: params.uploadedByName,
    actorOrgName: params.uploadedByOrgName,
    actionType: "version_upload",
    newValue: `Uploaded ${params.documentTitle} ${params.versionLabel} (SHA: ${sha256Hash.slice(0, 10)}...)`,
    reason: params.changeNotes,
    projectId: params.projectId,
  });

  return {
    data: {
      id: versionId,
      documentId: params.documentId,
      versionNumber: params.versionNumber,
      versionLabel: params.versionLabel,
      versionTag: params.versionLabel,
      storagePath,
      storageUri: storagePath,
      fileName: params.file.name,
      mimeType: params.file.type || "application/pdf",
      fileSizeBytes: params.file.size,
      sha256Hash,
      uploadedByName: params.uploadedByName,
      uploadedByOrgName: params.uploadedByOrgName,
      changeNotes: params.changeNotes,
      changeSummary: params.changeNotes,
      isMalwareClean: true,
      status: "under_review",
      uploadedAt: now,
      agencyReviews: reviews,
    },
    error: null,
  };
}

export async function mutateReviewDocumentVersion(params: {
  versionId: string;
  agencyCode: string;
  decision: "approved" | "approved_with_conditions" | "revision_requested";
  actorName: string;
  comments: string;
}): Promise<{ success: boolean; error: Error | null }> {
  const client = getSupabaseBrowser();
  if (!client) return { success: false, error: new Error("Supabase client unavailable") };

  const rpcPayload = {
    p_version_id: params.versionId,
    p_agency_code: params.agencyCode,
    p_decision: params.decision,
    p_actor_name: params.actorName,
    p_comments: params.comments,
  };

  const { error: rpcError } = await client.rpc("rpc_review_document_version", rpcPayload);
  if (!rpcError) {
    return { success: true, error: null };
  }

  // Fallback
  const now = new Date().toISOString();
  const { error: reviewError } = await client
    .from("document_agency_reviews")
    .update({
      status: params.decision,
      review_status: params.decision === "revision_requested" ? "revisions_requested" : params.decision,
      reviewed_by_user_name: params.actorName,
      reviewed_at: now,
      decision_date: now.split("T")[0],
      comments: params.comments,
      review_comments: params.comments,
    })
    .eq("document_version_id", params.versionId)
    .eq("reviewing_org_code", params.agencyCode);

  if (reviewError) return { success: false, error: new Error(reviewError.message) };

  await insertAuditEvent({
    entityType: "document_agency_review",
    entityId: `rev-${params.versionId}-${params.agencyCode.toLowerCase()}`,
    actorName: params.actorName,
    actorOrgName: params.agencyCode,
    actionType: "agency_signoff",
    newValue: `${params.agencyCode} signed off as ${params.decision}`,
    reason: params.comments,
  });

  return { success: true, error: null };
}
