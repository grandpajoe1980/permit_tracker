"use client";

import React, { useRef, useState, useMemo } from "react";
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
  Filter,
  History,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getFullProjectRecord } from "@/lib/permit-utils";
import type { DocumentRecord, DocumentVersionRecord } from "@/lib/domain-models";
import { DocumentViewerModal } from "@/components/documents/DocumentViewerModal";

export function DocumentVaultPanel({
  onUploadRevision,
  onDownloadDocument,
  onSelectWorkstream,
}: {
  onUploadRevision?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadDocument?: (documentId: string, versionId: string) => void;
  onSelectWorkstream?: (workstreamId: string) => void;
}) {
  const project = getFullProjectRecord();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWorkstreamFilter, setSelectedWorkstreamFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [selectedDocId, setSelectedDocId] = useState<string>(project.documents[0]?.id || "");
  const [previewingDoc, setPreviewingDoc] = useState<DocumentRecord | null>(null);
  const [previewingVersion, setPreviewingVersion] = useState<DocumentVersionRecord | undefined>(undefined);
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);

  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return project.documents.filter((doc) => {
      if (selectedWorkstreamFilter !== "all" && doc.workstreamId !== selectedWorkstreamFilter && !doc.agencyReviews.some((r) => r.workstreamId === selectedWorkstreamFilter)) {
        return false;
      }
      if (selectedCategoryFilter !== "all" && doc.category !== selectedCategoryFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchCategory = doc.category.toLowerCase().includes(q);
        const matchOwner = doc.ownerOrgCode.toLowerCase().includes(q);
        const matchWs = (doc.workstreamTitle || "").toLowerCase().includes(q);
        const matchVersions = doc.versions.some(
          (v) =>
            v.fileName.toLowerCase().includes(q) ||
            v.versionTag.toLowerCase().includes(q) ||
            v.sha256Hash.toLowerCase().includes(q) ||
            (v.uploadedByName || "").toLowerCase().includes(q) ||
            (v.changeSummary || "").toLowerCase().includes(q)
        );
        return matchTitle || matchCategory || matchOwner || matchWs || matchVersions;
      }
      return true;
    });
  }, [project.documents, searchTerm, selectedWorkstreamFilter, selectedCategoryFilter]);

  const selectedDoc =
    project.documents.find((d) => d.id === selectedDocId) ||
    filteredDocs[0] ||
    project.documents[0];

  function handleCopyHash(hash: string, id: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(hash);
      setCopiedHashId(id);
      setTimeout(() => setCopiedHashId(null), 2500);
    }
  }

  function handleDownload(documentId: string, versionId: string) {
    if (onDownloadDocument) {
      onDownloadDocument(documentId, versionId);
    } else {
      const doc = project.documents.find((d) => d.id === documentId);
      const ver = doc?.versions.find((v) => v.id === versionId) || doc?.versions[0];
      const payload = `PATH SECURE VAULT DOWNLOAD\n==============================\nTitle: ${doc?.title}\nVersion: ${ver?.versionTag}\nFile: ${ver?.fileName}\nSHA-256: ${ver?.sha256Hash}\nTimestamp: ${ver?.uploadedAt}\n`;
      const blob = new Blob([payload], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = ver?.fileName || `${doc?.title || "document"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 font-bold">
                Single Source of Truth Document Vault
              </Badge>
              <span className="text-xs text-slate-500 font-mono">
                {project.documents.length} Packages · Immutable Revisions & SHA-256 Hashes
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900">
              Project Document Vault
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Upload heavy packages once. Every agency reviews and certifies the exact immutable revision.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onUploadRevision ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => uploadInputRef.current?.click()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow"
                >
                  <UploadCloud className="size-3.5" /> Upload New Revision
                </Button>
                <input ref={uploadInputRef} type="file" className="sr-only" onChange={onUploadRevision} />
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled
                title="Open this panel from the authenticated project workspace to upload a revision."
                className="bg-slate-300 text-slate-600 font-bold text-xs gap-1.5 shadow-none"
              >
                <UploadCloud className="size-3.5" /> Upload New Revision
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          {/* Free Text Search */}
          <div className="relative md:col-span-6">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              placeholder="Search by title, file name, SHA-256 checksum, or uploader..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          {/* Project / Workstream Filter */}
          <div className="md:col-span-3">
            <select
              aria-label="Filter documents by project or workstream"
              value={selectedWorkstreamFilter}
              onChange={(e) => setSelectedWorkstreamFilter(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-teal-600 focus:outline-none"
            >
              <option value="all">All Projects & Workstreams ({project.documents.length})</option>
              {project.workstreams.map((ws) => {
                const count = project.documents.filter(
                  (d) => d.workstreamId === ws.id || d.agencyReviews.some((r) => r.workstreamId === ws.id)
                ).length;
                return (
                  <option key={ws.id} value={ws.id}>
                    {ws.code} · {ws.title} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Category Filter */}
          <div className="md:col-span-3">
            <select
              aria-label="Filter documents by category"
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-teal-600 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="engineering_drawing">Engineering Drawings & Models</option>
              <option value="environmental_study">Environmental & Wetland Studies</option>
              <option value="public_safety">Public Safety & Corridor Plans</option>
              <option value="contract_agreement">Contract Agreements & MOUs</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Reset */}
        {(searchTerm || selectedWorkstreamFilter !== "all" || selectedCategoryFilter !== "all") && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-600">
            <span>
              Showing <strong>{filteredDocs.length}</strong> of {project.documents.length} packages
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setSelectedWorkstreamFilter("all");
                setSelectedCategoryFilter("all");
              }}
              className="font-bold text-teal-800 hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Document List & Detail View */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Document List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="space-y-2.5">
            {filteredDocs.map((doc) => {
              const isSelected = doc.id === selectedDoc?.id;
              const latestVer = doc.versions[0];
              const approvedCount = doc.agencyReviews.filter((r) => r.reviewStatus === "approved").length;

              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-500"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className="bg-slate-900 text-white font-mono text-[10px] py-0">
                        {doc.ownerOrgCode}
                      </Badge>
                      <span className="font-mono text-xs font-bold text-slate-600">
                        v{doc.currentVersionNumber}.0
                      </span>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        approvedCount === doc.agencyReviews.length && doc.agencyReviews.length > 0
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      }`}
                    >
                      {approvedCount}/{doc.agencyReviews.length} Approved
                    </Badge>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mt-1.5 line-clamp-1">{doc.title}</h3>

                  {doc.workstreamTitle && (
                    <div className="text-[11px] font-semibold text-teal-800 mt-0.5 truncate">
                      {doc.workstreamTitle}
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
                    <span className="flex items-center gap-1">
                      <History className="size-3 text-slate-400" />
                      {doc.versions.length} revision{doc.versions.length !== 1 ? "s" : ""}
                    </span>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPreviewingDoc(doc);
                          setPreviewingVersion(latestVer);
                        }}
                        className="h-7 px-2 text-xs font-bold text-teal-800 hover:bg-teal-50 gap-1"
                        title="View document in modal"
                      >
                        <Eye className="size-3.5" /> View
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(doc.id, latestVer?.id || "")}
                        className="h-7 px-2 text-xs font-bold text-slate-700 hover:bg-slate-100 gap-1"
                        title="Download file"
                      >
                        <Download className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredDocs.length === 0 && (
              <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
                <FileText className="size-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-sm">No documents match your query.</p>
                <p className="text-xs text-slate-400 mt-1">Try selecting another project or clearing your search.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Version History & Multi-Agency Review Matrix */}
        <div className="lg:col-span-7">
          {selectedDoc ? (
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-slate-900 text-white font-mono text-xs">
                      {selectedDoc.ownerOrgCode} OWNER
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">
                      {selectedDoc.category.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">ID: {selectedDoc.id}</span>
                </div>

                <CardTitle className="text-lg font-bold text-slate-900 mt-1">
                  {selectedDoc.title}
                </CardTitle>

                {selectedDoc.workstreamTitle && (
                  <CardDescription className="text-xs font-semibold text-teal-800 flex items-center justify-between">
                    <span>Project: {selectedDoc.workstreamTitle}</span>
                    {onSelectWorkstream && selectedDoc.workstreamId && (
                      <button
                        type="button"
                        onClick={() => onSelectWorkstream(selectedDoc.workstreamId!)}
                        className="text-xs font-bold text-teal-800 hover:underline flex items-center gap-1"
                      >
                        Open Permit <ExternalLink className="size-3" />
                      </button>
                    )}
                  </CardDescription>
                )}

                {/* Primary Actions on Selected Document */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setPreviewingDoc(selectedDoc);
                      setPreviewingVersion(selectedDoc.versions[0]);
                    }}
                    className="bg-[#00284d] hover:bg-[#003c70] text-white font-bold text-xs gap-1.5 shadow"
                  >
                    <Eye className="size-3.5" /> In-App Preview & Inspection
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(selectedDoc.id, selectedDoc.versions[0]?.id || "")}
                    className="font-bold text-xs gap-1.5"
                  >
                    <Download className="size-3.5" /> Download Latest (v{selectedDoc.currentVersionNumber}.0)
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-6">
                {/* Multi-Agency Review Matrix */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-indigo-600" /> Cross-Agency Revision Certification Matrix
                  </h4>
                  <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                    {selectedDoc.agencyReviews.map((rev) => (
                      <div key={rev.id} className="p-3.5 flex items-center justify-between text-xs bg-slate-50/50">
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{rev.reviewingOrgCode}</span>
                            <Badge
                              className={
                                rev.reviewStatus === "approved"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }
                            >
                              {rev.reviewStatus === "approved" ? "Approved" : "Under Review"}
                            </Badge>
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            Reviewer: {rev.reviewedByName || "Assigned Team"}
                          </div>
                          {rev.reviewComments && (
                            <p className="text-[11px] text-slate-600 italic mt-1 bg-white p-2 rounded border border-slate-100">
                              &quot;{rev.reviewComments}&quot;
                            </p>
                          )}
                        </div>
                        {rev.decisionDate && (
                          <div className="text-right text-[11px] text-slate-400 font-mono">
                            Approved: {rev.decisionDate}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Immutable Version Ledger */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                    <History className="size-4 text-emerald-600" /> Immutable Version Ledger ({selectedDoc.versions.length})
                  </h4>
                  <div className="space-y-3">
                    {selectedDoc.versions.map((ver) => (
                      <div key={ver.id} className="rounded-xl border border-slate-200 p-4 bg-white space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-emerald-600 text-white font-mono font-bold text-xs">
                              {ver.versionTag}
                            </Badge>
                            <span className="text-xs font-bold text-slate-900">{ver.fileName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 font-mono">
                              {(ver.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPreviewingDoc(selectedDoc);
                                setPreviewingVersion(ver);
                              }}
                              className="h-6 px-2 text-[10px] font-bold"
                            >
                              <Eye className="size-3 mr-1" /> View
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownload(selectedDoc.id, ver.id)}
                              className="h-6 px-2 text-[10px] font-bold"
                            >
                              <Download className="size-3 mr-1" /> File
                            </Button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100">
                          {ver.changeSummary || "Standard package update."}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                          <span>Uploaded by: <strong className="text-slate-700">{ver.uploadedByName}</strong></span>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-slate-500 truncate max-w-xs">
                              SHA-256: {ver.sha256Hash.slice(0, 16)}…
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyHash(ver.sha256Hash, ver.id)}
                              className="text-teal-700 hover:text-teal-900 font-bold ml-1"
                              title="Copy full SHA-256 hash"
                            >
                              {copiedHashId === ver.id ? "Copied" : "Copy"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              Select a document to inspect its version ledger and multi-agency certifications.
            </div>
          )}
        </div>
      </div>

      {/* In-App Document Viewer Modal */}
      {previewingDoc && (
        <DocumentViewerModal
          document={previewingDoc}
          version={previewingVersion}
          isOpen={Boolean(previewingDoc)}
          onClose={() => {
            setPreviewingDoc(null);
            setPreviewingVersion(undefined);
          }}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}
