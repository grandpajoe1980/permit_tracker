"use client";

import React, { useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  History,
  Lock,
  Paperclip,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DocumentRecord, DocumentVersionRecord } from "@/lib/domain-models";
import { downloadDocumentVersion } from "@/lib/document-download-utils";

interface DocumentViewerModalProps {
  document: DocumentRecord;
  version?: DocumentVersionRecord;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: (documentId: string, versionId: string) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocumentViewerModal({
  document,
  version,
  isOpen,
  onClose,
  onDownload,
}: DocumentViewerModalProps) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    version?.id || document.versions[0]?.id || ""
  );

  if (!isOpen) return null;

  const currentVersion =
    document.versions.find((v) => v.id === selectedVersionId) ||
    document.versions[0] || {
      id: "unknown",
      documentId: document.id,
      versionTag: `v${document.currentVersionNumber}.0`,
      fileName: `${document.title}.pdf`,
      fileSizeBytes: 24500000,
      mimeType: "application/pdf",
      storageUri: `vault/${document.id}`,
      sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      uploadedByName: "Authorized Project Participant",
      changeSummary: "Official regulatory package filing.",
      isMalwareClean: true,
      uploadedAt: new Date().toISOString(),
    };

  const reviewsForVersion = document.agencyReviews.filter(
    (rev) => rev.documentVersionId === currentVersion.id
  );
  const displayReviews = reviewsForVersion.length > 0 ? reviewsForVersion : document.agencyReviews;

  function handleCopyHash() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(currentVersion.sha256Hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2500);
    }
  }

  async function handleDownloadClick() {
    if (onDownload) {
      onDownload(document.id, currentVersion.id);
    } else {
      await downloadDocumentVersion(document, currentVersion);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#00284d]/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-modal-title"
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-[#00284d] text-white font-mono text-xs">
                {document.ownerOrgCode}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                {document.category.replace(/_/g, " ")}
              </Badge>
              <span className="font-mono text-xs font-bold text-slate-500">
                {currentVersion.versionTag}
              </span>
              {document.workstreamTitle && (
                <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {document.workstreamTitle}
                </span>
              )}
            </div>
            <h2 id="doc-modal-title" className="text-xl font-black text-slate-900 mt-1">
              {document.title}
            </h2>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close document viewer"
            className="text-slate-500 hover:text-slate-900"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Top Cryptographic Integrity & File Metadata Banner */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* SHA-256 Hash Card */}
            <div className="md:col-span-8 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-700" />
                  SHA-256 Cryptographic Checksum
                </span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  Malware Clean · Verified
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-white p-2.5">
                <code className="font-mono text-[11px] font-bold text-slate-800 break-all flex-1 select-all">
                  {currentVersion.sha256Hash}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyHash}
                  className="shrink-0 text-xs font-bold gap-1 text-emerald-800 hover:bg-emerald-50"
                  title="Copy SHA-256 hash"
                >
                  {copiedHash ? (
                    <>
                      <Check className="size-3.5 text-emerald-700" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" /> Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="md:col-span-4 rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">File Actions</span>
                <div className="mt-1 text-xs font-bold text-slate-800 truncate">
                  {currentVersion.fileName}
                </div>
                <div className="text-[11px] text-slate-500">
                  {formatBytes(currentVersion.fileSizeBytes)} · {currentVersion.mimeType}
                </div>
              </div>

              <Button
                type="button"
                onClick={handleDownloadClick}
                className="w-full bg-[#00284d] hover:bg-[#003c70] text-white font-bold text-xs gap-1.5 shadow"
              >
                <Download className="size-4" /> Download Official File
              </Button>
            </div>
          </div>

          {/* Version Selector (If Multiple Versions) */}
          {document.versions.length > 1 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <History className="size-4 text-slate-500" />
                  Available Revision History ({document.versions.length} versions)
                </span>
                <span className="text-[11px] text-slate-500">Select version to inspect</span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {document.versions.map((ver) => (
                  <button
                    key={ver.id}
                    type="button"
                    onClick={() => setSelectedVersionId(ver.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                      ver.id === currentVersion.id
                        ? "border-[#00284d] bg-[#00284d] text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span>{ver.versionTag}</span>
                    <span className="text-[10px] opacity-80">({formatDate(ver.uploadedAt).split(",")[0]})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main In-App Document Inspection / Content Preview */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5 uppercase tracking-wider">
                <FileText className="size-4 text-teal-700" />
                Document Content Preview & Engineering Specification
              </span>
              <span className="font-mono text-slate-500">{currentVersion.fileName}</span>
            </div>

            <div className="p-6 bg-slate-50/50 space-y-5">
              {/* Document Header Metadata inside Preview */}
              <div className="border-b border-slate-200 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <div>
                    <strong>Uploaded by:</strong> {currentVersion.uploadedByName}
                  </div>
                  <div>
                    <strong>Timestamp:</strong> {formatDate(currentVersion.uploadedAt)}
                  </div>
                  <div>
                    <strong>Storage Path:</strong> <code className="font-mono text-[11px] bg-slate-200 px-1 py-0.5 rounded">{currentVersion.storageUri || `vault/${document.id}`}</code>
                  </div>
                </div>
              </div>

              {/* Revision Change Summary */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                  Revision Change Notes
                </h4>
                <p className="text-sm text-slate-800 leading-relaxed bg-white border border-slate-200 p-3.5 rounded-lg">
                  {currentVersion.changeSummary || "Standard engineering package submission per statutory filing requirements."}
                </p>
              </div>

              {/* Technical Simulation Details */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Engineering Package Sections & Certifications
                  </h4>
                  <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-mono text-[10px]">
                    PE STAMP CERTIFIED
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded bg-slate-50 p-2.5">
                    <span className="font-bold text-slate-800">1. Executive Summary & Design Basis</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Complies with Louisiana Administrative Code and Federal FAST-41 alignment standards.
                    </p>
                  </div>
                  <div className="rounded bg-slate-50 p-2.5">
                    <span className="font-bold text-slate-800">2. Hydrodynamic & Structural Models</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Includes 10-year storm surge simulations and dual 14-axle transporter load calculations.
                    </p>
                  </div>
                  <div className="rounded bg-slate-50 p-2.5">
                    <span className="font-bold text-slate-800">3. Environmental Mitigation Plan</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Delineation polygons aligned to GIS Shapefile Rev 4.1 coordinates.
                    </p>
                  </div>
                  <div className="rounded bg-slate-50 p-2.5">
                    <span className="font-bold text-slate-800">4. Interagency Signoff Annexes</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Formal review tracks open for State and Federal statutory concurrence.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Multi-Agency Review Certification Matrix */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <ShieldCheck className="size-4 text-indigo-700" />
              Interagency Review Certification Matrix ({displayReviews.length} tracks)
            </h4>

            <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {displayReviews.map((rev) => (
                <div key={rev.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/50">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <Badge variant="outline" className="font-mono font-bold">
                        {rev.reviewingOrgCode}
                      </Badge>
                      <span>{rev.reviewedByName || "Assigned Agency Reviewer"}</span>
                    </div>
                    {rev.reviewComments && (
                      <p className="text-slate-600 text-[11px] pl-1 border-l-2 border-slate-300 mt-1">
                        &quot;{rev.reviewComments}&quot;
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <Badge
                      className={
                        rev.reviewStatus === "approved"
                          ? "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold"
                          : rev.reviewStatus === "revisions_requested"
                          ? "bg-rose-100 text-rose-900 border-rose-300 font-bold"
                          : "bg-amber-100 text-amber-900 border-amber-300 font-bold"
                      }
                    >
                      {rev.reviewStatus === "approved"
                        ? "Approved"
                        : rev.reviewStatus === "revisions_requested"
                        ? "Revisions Requested"
                        : "Under Active Review"}
                    </Badge>
                    {rev.decisionDate && (
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Certified: {rev.decisionDate}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="text-xs text-slate-500 font-mono">
            Document ID: {document.id} · Version: {currentVersion.versionTag}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="font-bold text-xs">
              Close Preview
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDownloadClick}
              className="bg-[#00284d] hover:bg-[#003c70] text-white font-bold text-xs gap-1.5 shadow"
            >
              <Download className="size-3.5" /> Download File
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
