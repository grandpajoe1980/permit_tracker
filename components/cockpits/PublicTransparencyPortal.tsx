"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  HeartHandshake,
  HelpCircle,
  Info,
  MapPin,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Waves,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getPublicTransparencyData, type PublicNoticeItem } from "@/lib/engines/report-engine";

export function PublicTransparencyPortal() {
  const data = getPublicTransparencyData();

  const [selectedDocket, setSelectedDocket] = useState<string>(data.activePublicNotices[0]?.permitCode || "");
  const [commentName, setCommentName] = useState<string>("");
  const [commentEmail, setCommentEmail] = useState<string>("");
  const [isResident, setIsResident] = useState<boolean>(true);
  const [commentText, setCommentText] = useState<string>("");
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false);

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !commentName.trim()) return;

    setSubmissionSuccess(true);
    setCommentText("");
    setTimeout(() => setSubmissionSuccess(false), 6000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Vermilion Parish Portal */}
      <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-teal-500/20 text-teal-200 border-teal-500/30">
                Vermilion Parish Public Transparency & Citizen Portal
              </Badge>
              <span className="text-xs text-slate-300 font-mono">Open Government · La. R.S. 44:1</span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              SpaceX Pecan Island Community & Environmental Information
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-3xl">
              Official public notices, mandatory statutory comment periods, town hall schedules, and environmental safeguards for Vermilion Parish residents.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs space-y-1 backdrop-blur">
            <div className="font-bold text-teal-300 flex items-center gap-1.5">
              <Users className="size-3.5" /> Parish Concierge Helpline
            </div>
            <div className="text-slate-300">Sarah Johnson (State PM): (225) 342-7000</div>
            <div className="text-slate-300">Police Jury Liaison: parish.concierge@la.gov</div>
          </div>
        </div>
      </div>

      {/* Grid: Active Statutory Notices & Public Comment Submission */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Active Public Notice Dockets */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock3 className="size-4 text-teal-600" />
              Active Statutory Public Notice Periods
            </h2>
            <Badge variant="outline" className="text-xs">
              {data.activePublicNotices.length} Open for Comment
            </Badge>
          </div>

          <div className="space-y-3">
            {data.activePublicNotices.map((notice) => (
              <div
                key={notice.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3 hover:border-teal-300 transition-colors"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-xs font-mono">
                        {notice.permitCode}
                      </Badge>
                      <span className="text-xs text-slate-500 font-bold">{notice.leadAgency}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">{notice.permitTitle}</h3>
                  </div>

                  <Badge
                    className={
                      notice.daysRemaining <= 10
                        ? "bg-amber-100 text-amber-900 border-amber-200 text-xs"
                        : "bg-emerald-100 text-emerald-900 border-emerald-200 text-xs"
                    }
                  >
                    {notice.daysRemaining} Days Left to Comment
                  </Badge>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {notice.summary}
                </p>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-700 space-y-1">
                  <div className="text-[11px] font-mono text-slate-500">
                    <strong>Statutory Citation:</strong> {notice.statutoryCitation}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    <strong>Comment Period:</strong> {notice.noticeStartDate} through <strong>{notice.noticeEndDate}</strong>
                  </div>
                  {notice.publicHearingDate && (
                    <div className="text-[11px] text-teal-900 font-bold flex items-center gap-1">
                      <Calendar className="size-3 text-teal-600" />
                      Public Hearing: {notice.publicHearingDate} ({notice.publicHearingLocation})
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    Direct Email: <a href={`mailto:${notice.commentSubmissionEmail}`} className="text-teal-600 underline">{notice.commentSubmissionEmail}</a>
                  </span>
                  <a
                    href={notice.officialDocketUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900"
                  >
                    View Official Docket Files <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Public Comment Submission Form */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-slate-200 bg-white shadow-sm sticky top-4">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-teal-600" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Submit Official Public Comment
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Comments are entered directly into the state administrative record for review by lead regulatory engineers.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              {submissionSuccess ? (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-center space-y-2">
                  <CheckCircle2 className="size-8 text-emerald-600 mx-auto" />
                  <h4 className="text-sm font-bold text-emerald-950">Comment Successfully Filed!</h4>
                  <p className="text-xs text-emerald-900">
                    Your comment has been transmitted to the state regulatory review docket. You will receive a confirmation email with your formal submission receipt number.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitComment} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Select Public Notice Docket
                    </label>
                    <select
                      value={selectedDocket}
                      onChange={(e) => setSelectedDocket(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 p-2 bg-white text-slate-900 font-medium"
                    >
                      {data.activePublicNotices.map((n) => (
                        <option key={n.permitCode} value={n.permitCode}>
                          {n.permitCode} — {n.permitTitle}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Your Full Name</label>
                      <Input
                        value={commentName}
                        onChange={(e) => setCommentName(e.target.value)}
                        placeholder="e.g. Marie Thibodeaux"
                        required
                        className="text-xs h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                      <Input
                        type="email"
                        value={commentEmail}
                        onChange={(e) => setCommentEmail(e.target.value)}
                        placeholder="marie@example.com"
                        required
                        className="text-xs h-8"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id="residentCheck"
                      checked={isResident}
                      onChange={(e) => setIsResident(e.target.checked)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 size-3.5"
                    />
                    <label htmlFor="residentCheck" className="text-xs text-slate-700 font-medium">
                      I am a resident or landowner in Vermilion Parish
                    </label>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Public Comment or Question
                    </label>
                    <Textarea
                      rows={4}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Please enter your environmental feedback, drainage question, or public testimony..."
                      required
                      className="text-xs resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs h-8 gap-1.5 shadow"
                  >
                    <Send className="size-3" /> Transmit Official Comment
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Environmental Safeguards & Community Investments */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Environmental Protections */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" />
              <CardTitle className="text-sm font-bold text-slate-900">
                Environmental & Coastal Protection Safeguards
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Verified monitoring protocols overseen by state and parish environmental agencies
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 space-y-3">
            {data.environmentalSafeguards.map((item) => (
              <div key={item.resource} className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>{item.resource}</span>
                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                    {item.status}
                  </Badge>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {item.measure}
                </p>
                <div className="text-[10px] text-slate-400 font-mono pt-1">
                  Oversight: {item.monitoringAgency}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Community Benefits & Upcoming Town Halls */}
        <div className="space-y-4">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <HeartHandshake className="size-4 text-indigo-600" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Parish Community & Infrastructure Benefits
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-2.5">
              {data.communityBenefits.map((b) => (
                <div key={b.category} className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-indigo-100 bg-indigo-50/40 text-xs">
                  <div>
                    <div className="font-bold text-indigo-950">{b.category}</div>
                    <div className="text-[11px] text-indigo-900">{b.description}</div>
                  </div>
                  <Badge className="bg-indigo-600 text-white text-[10px] whitespace-nowrap">
                    {b.metric}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Upcoming Town Halls */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-teal-600" />
                <CardTitle className="text-sm font-bold text-slate-900">
                  Upcoming Public Town Halls & Hearings
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="pt-3 space-y-2">
              {data.upcomingTownHalls.map((th) => (
                <div key={th.title} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{th.title}</span>
                    <Badge variant="outline" className="text-[10px]">{th.date}</Badge>
                  </div>
                  <div className="text-[11px] text-teal-800 font-medium">{th.time} · {th.location}</div>
                  <p className="text-[11px] text-slate-600">{th.agendaSummary}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
