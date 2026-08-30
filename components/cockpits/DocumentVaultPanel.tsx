"use client";

import React, { useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  FileText,
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

export function DocumentVaultPanel({ onUploadRevision }: { onUploadRevision?: (event: React.ChangeEvent<HTMLInputElement>) => void }) {
  const project = getFullProjectRecord();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string>(project.documents[0]?.id || "");
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = project.documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedDoc = project.documents.find((d) => d.id === selectedDocId) || project.documents[0];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                Single Source of Truth Document Vault
              </Badge>
              <span className="text-xs text-slate-500 font-mono">Immutable Revisions & Agency Matrices</span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900">
              Project Document Vault
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Upload heavy packages once. Every agency reviews and certifies the exact immutable revision.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onUploadRevision ? <>
              <Button type="button" size="sm" onClick={() => uploadInputRef.current?.click()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow">
                <UploadCloud className="size-3.5" /> Upload New Revision
              </Button>
              <input ref={uploadInputRef} type="file" className="sr-only" onChange={onUploadRevision} />
            </> : <Button type="button" size="sm" disabled title="Open this panel from the authenticated project workspace to upload a revision." className="bg-slate-300 text-slate-600 font-bold text-xs gap-1.5 shadow-none">
              <UploadCloud className="size-3.5" /> Upload New Revision
            </Button>}
          </div>
        </div>
      </div>

      {/* Main Grid: Document List & Detail View */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Document List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              placeholder="Search engineering packages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="space-y-2">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  doc.id === selectedDoc?.id
                    ? "border-emerald-500 bg-emerald-50/40 shadow-sm"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-500">
                    Current: v{doc.currentVersionNumber}.0
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {doc.ownerOrgCode}
                  </Badge>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-1">{doc.title}</h3>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <History className="size-3 text-slate-400" />
                  <span>{doc.versions.length} immutable revisions logged</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Version History & Multi-Agency Review Matrix */}
        <div className="lg:col-span-7">
          {selectedDoc && (
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <Badge className="bg-slate-900 text-white font-mono text-xs">
                    {selectedDoc.ownerOrgCode} OWNER
                  </Badge>
                  <span className="text-xs text-slate-400 font-mono">ID: {selectedDoc.id}</span>
                </div>
                <CardTitle className="text-lg font-bold text-slate-900 mt-1">
                  {selectedDoc.title}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Active in {selectedDoc.agencyReviews.length} interagency review tracks
                </CardDescription>
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
                    <History className="size-4 text-emerald-600" /> Immutable Version Ledger
                  </h4>
                  <div className="space-y-3">
                    {selectedDoc.versions.map((ver) => (
                      <div key={ver.id} className="rounded-xl border border-slate-200 p-4 bg-white space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-emerald-600 text-white font-mono font-bold text-xs">
                              {ver.versionTag}
                            </Badge>
                            <span className="text-xs font-bold text-slate-900">{ver.fileName}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {(ver.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100">
                          {ver.changeSummary || "Standard package update."}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                          <span>Uploaded by: <strong className="text-slate-700">{ver.uploadedByName}</strong></span>
                          <span className="font-mono text-slate-400 truncate max-w-xs">SHA-256: {ver.sha256Hash.slice(0, 16)}…</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
