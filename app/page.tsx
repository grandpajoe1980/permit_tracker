"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  AlertOctagon,
  ArrowRight,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  HelpCircle,
  Info,
  Landmark,
  LayoutList,
  ListChecks,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Paperclip,
  Route,
  Send,
  Settings2,
  ShieldAlert,
  Sparkles,
  User,
  UserCog,
  Users,
  X,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEMO_PASSWORD,
  demoPersonas,
  initialTeamUsers,
  pecanIslandRequests,
  roleDefinitions,
  type DemoAccount,
  type DemoPersona,
  type RoleId,
  type ServiceRequest,
} from "@/lib/demo-data";
import {
  calculateRAGSummary,
  getAgencyWorkload,
  parsePlainEnglishIntake,
} from "@/lib/permit-utils";
import {
  getBrowserUser,
  getSupabaseBrowserClient,
  createRequestForUser,
  loadRequestsForUser,
  signInWithPassword,
  signOutBrowser,
  supabaseConfigured,
} from "@/lib/supabase-browser";
import { repository } from "@/lib/repository";
import {
  getAvailableActions,
  getCompletionPreview,
  getCompletionRequirements,
  getOperationalPersona,
  getOperationalWorkItems,
  getPersonaFromEmail,
  getRecipientPreview,
  groupMyWork,
  requestWorkstreamMap,
  sanitizeCustomerItem,
  type OperationalWorkItem,
  type QueueSectionId,
  type WorkActionId,
  type WorkspaceMode,
} from "@/lib/operational-ux";
import { WorkstreamGraphGantt } from "@/components/cockpits/WorkstreamGraphGantt";
import { DocumentVaultPanel } from "@/components/cockpits/DocumentVaultPanel";
import { WorkflowDesignerPanel } from "@/components/cockpits/WorkflowDesignerPanel";

type Route = "my-work" | "agency-queue" | "rfis" | "coordination" | "documents" | "project" | "notifications" | "secondary" | "admin" | "detail";
type SecondaryTool = "schedule" | "vault" | "catalog";
type DialogState = { action: WorkActionId; itemId: string } | null;

function makeAuthenticatedPersona(email: string, name: string): DemoPersona {
  return getPersonaFromEmail(email) ?? {
    id: "authenticated-user",
    name,
    role: "Project Participant",
    roleDescription: "Authenticated PATH project participant",
    email,
    badge: "Authenticated",
    scenario: "Project workspace",
    group: "SpaceX Louisiana Program",
  };
}

function formatDate(value?: string) {
  if (!value) return "Not set";
  const date = new Date(`${value.length === 10 ? `${value}T12:00:00` : value}`);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toneClasses(tone: OperationalWorkItem["statusTone"]) {
  if (tone === "red") return { badge: "border-red-300 bg-red-50 text-red-900", dot: "bg-red-600", border: "border-red-200" };
  if (tone === "amber") return { badge: "border-amber-300 bg-amber-50 text-amber-900", dot: "bg-amber-500", border: "border-amber-200" };
  if (tone === "green") return { badge: "border-emerald-300 bg-emerald-50 text-emerald-900", dot: "bg-emerald-600", border: "border-emerald-200" };
  if (tone === "blue") return { badge: "border-sky-300 bg-sky-50 text-sky-900", dot: "bg-sky-600", border: "border-sky-200" };
  return { badge: "border-slate-300 bg-slate-50 text-slate-800", dot: "bg-slate-500", border: "border-slate-200" };
}

function actionLabel(action: WorkActionId) {
  const labels: Record<WorkActionId, string> = {
    complete_step: "Complete Step",
    request_information: "Request Information",
    mark_blocked: "Mark Blocked",
    transfer: "Ask for Help / Transfer",
    escalate: "Escalate",
    add_note: "Add Note",
    approve_document: "Approve This Version",
    approve_with_comments: "Approve with Comments",
    request_revision: "Request Revision",
    accept_rfi_response: "Accept & Resume Review",
    request_clarification: "Request Clarification",
    respond: "Respond",
    upload_documents: "Upload Documents",
  };
  return labels[action];
}

function actionIcon(action: WorkActionId) {
  if (action === "mark_blocked") return <AlertOctagon className="size-4" aria-hidden="true" />;
  if (action === "escalate") return <ShieldAlert className="size-4" aria-hidden="true" />;
  if (action === "transfer") return <Users className="size-4" aria-hidden="true" />;
  if (action === "add_note") return <MessageSquare className="size-4" aria-hidden="true" />;
  if (action === "request_information" || action === "request_clarification") return <HelpCircle className="size-4" aria-hidden="true" />;
  if (action === "approve_document" || action === "approve_with_comments" || action === "accept_rfi_response") return <CheckCircle2 className="size-4" aria-hidden="true" />;
  if (action === "respond" || action === "upload_documents") return <Send className="size-4" aria-hidden="true" />;
  if (action === "request_revision") return <FileText className="size-4" aria-hidden="true" />;
  return <Check className="size-4" aria-hidden="true" />;
}

function kindIcon(item: OperationalWorkItem) {
  if (item.kind === "document") return <FileCheck2 className="size-4" aria-hidden="true" />;
  if (item.kind === "rfi") return <HelpCircle className="size-4" aria-hidden="true" />;
  if (item.kind === "coordination") return <Building2 className="size-4" aria-hidden="true" />;
  if (item.kind === "commitment") return <ClipboardCheck className="size-4" aria-hidden="true" />;
  return <ListChecks className="size-4" aria-hidden="true" />;
}

function workspaceTitle(workspace: WorkspaceMode) {
  if (workspace === "customer") return "SpaceX Project Workspace";
  if (workspace === "supervisor") return "Supervisor Work Queue";
  if (workspace === "state_office") return "State Project Office";
  if (workspace === "agency") return "Agency Queue";
  if (workspace === "admin") return "PATH Administration";
  return "Reviewer Workspace";
}

function syncRequestState(request: ServiceRequest, workstreamState?: ReturnType<typeof repository.getWorkstreamById>) {
  if (!workstreamState) return request;
  const completed = workstreamState.operationalState === "complete";
  const blocked = ["blocked", "waiting_government", "waiting_applicant", "waiting_external"].includes(workstreamState.operationalState);
  return {
    ...request,
    status: completed ? "approved" : blocked ? "action-needed" : "in-review",
    statusLabel: workstreamState.operationalStateLabel,
    ragStatus: blocked ? "red" : workstreamState.ragHealth === "yellow" ? "yellow" : "green",
    ragLabel: blocked ? "Blocked" : workstreamState.ragHealth === "yellow" ? "Attention" : completed ? "Approved" : "On Track",
    blocker: blocked ? {
      title: workstreamState.waitingReason ?? "Action required before review can resume",
      description: workstreamState.waitingReason ?? "A structured dependency is preventing the next handoff.",
      severity: "critical" as const,
      blockedSince: "Just now",
      unblockingAction: `Waiting on ${workstreamState.waitingOnEntity ?? "the assigned dependency"}`,
    } : undefined,
    steps: request.steps.map((step, index) => ({
      ...step,
      state: completed ? "done" as const : index === request.steps.findIndex((entry) => entry.state === "active" || entry.state === "blocked") ? blocked ? "blocked" as const : "active" as const : step.state,
    })),
  };
}

export default function Home() {
  const [route, setRoute] = useState<Route>("my-work");
  const [secondaryTool, setSecondaryTool] = useState<SecondaryTool>("schedule");
  const [currentUser, setCurrentUser] = useState<DemoAccount | null>(null);
  const [currentPersona, setCurrentPersona] = useState<DemoPersona | null>(null);
  const [userPermits, setUserPermits] = useState<ServiceRequest[]>(pecanIslandRequests);
  const [teamUsers, setTeamUsers] = useState(initialTeamUsers);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showDemoPeople, setShowDemoPeople] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogError, setDialogError] = useState("");
  const [toast, setToast] = useState("");
  const [, setMutationVersion] = useState(0);
  const [completionChecks, setCompletionChecks] = useState<Record<string, boolean>>({});
  const [determination, setDetermination] = useState("Complete / Approved");
  const [actionNote, setActionNote] = useState("");
  const [blockReason, setBlockReason] = useState("another_agency");
  const [blockAgency, setBlockAgency] = useState("CPRA");
  const [blockNeed, setBlockNeed] = useState("");
  const [blockDueDate, setBlockDueDate] = useState("2026-09-05");
  const [questionText, setQuestionText] = useState("");
  const [questionDueDate, setQuestionDueDate] = useState("2026-09-05");
  const [transferType, setTransferType] = useState("Ask another reviewer");
  const [escalationType, setEscalationType] = useState("Supervisor decision");
  const [intakeText, setIntakeText] = useState("");
  const [intakeStatus, setIntakeStatus] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  const activePersona = getOperationalPersona(currentPersona);
  const operationalData = getOperationalWorkItems({
    persona: currentPersona,
    requests: userPermits,
    workstreams: repository.getWorkstreams(),
    coordinationRequests: repository.getCoordinationRequests(),
    rfis: repository.getRFIs(),
    documents: repository.getDocuments(),
    commitments: repository.getCommitments(),
  });
  const workItems = operationalData.items;
  const selectedItem = selectedItemId ? workItems.find((item) => item.id === selectedItemId) ?? null : null;
  const queueGroups = groupMyWork(workItems);
  const ragSummary = calculateRAGSummary(userPermits);
  const intakePreview = intakeText.trim() ? parsePlainEnglishIntake(intakeText) : null;
  const loggedIn = Boolean(currentUser && currentPersona);

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    void getBrowserUser().then(async (user) => {
      if (!active || !user) return;
      const loaded = await loadRequestsForUser();
      const persona = makeAuthenticatedPersona(user.email ?? "authenticated@path.local", String(user.user_metadata?.full_name ?? user.email ?? "Authenticated User"));
      const permits = loaded.permits.length > 0 ? loaded.permits : pecanIslandRequests;
      setCurrentPersona(persona);
      setCurrentUser({ username: user.email ?? "", name: persona.name, agencyId: "spaceport", applicationIds: permits.map((item) => item.id), scenario: persona.role });
      setUserPermits(permits);
      setRoute("my-work");
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setCurrentUser(null);
        setCurrentPersona(null);
        setUserPermits(pecanIslandRequests);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    headingRef.current?.focus();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, [route, selectedItemId, loggedIn]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function navigate(nextRoute: Route) {
    setRoute(nextRoute);
    setSelectedItemId(null);
    setMobileNavOpen(false);
  }

  function openItem(item: OperationalWorkItem) {
    setSelectedItemId(item.id);
    setRoute("detail");
    setMobileNavOpen(false);
  }

  function openAction(item: OperationalWorkItem, action: WorkActionId) {
    setSelectedItemId(item.id);
    setDialogError("");
    setActionNote("");
    if (action === "complete_step") {
      const requirements = getCompletionRequirements(item);
      setCompletionChecks(Object.fromEntries(requirements.map((requirement) => [requirement.id, requirement.complete])));
    }
    if (action === "request_information") setQuestionText(`Please provide the information needed to move ${item.workstreamTitle} forward.`);
    if (action === "mark_blocked") setBlockNeed("");
    setDialog({ action, itemId: item.id });
  }

  function applyRepositoryWorkstream(item: OperationalWorkItem) {
    const ws = item.workstreamId ? repository.getWorkstreamById(item.workstreamId) : undefined;
    if (!ws) return;
    setUserPermits((previous) => previous.map((request) => request.id === item.sourceRequest?.id ? syncRequestState(request, ws) : request));
    setMutationVersion((value) => value + 1);
  }

  function notify(message: string) {
    setToast(message);
    setDialog(null);
    setMutationVersion((value) => value + 1);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingData(true);
    const { user, error } = await signInWithPassword(username, password);
    if (error || !user) {
      setLoadingData(false);
      setLoginError(error?.message || "Sign-in failed. Check your email and password.");
      usernameRef.current?.focus();
      return;
    }
    const loaded = await loadRequestsForUser();
    const persona = makeAuthenticatedPersona(user.email ?? username, String(user.user_metadata?.full_name ?? user.email ?? "Authenticated User"));
    const permits = loaded.permits.length > 0 ? loaded.permits : pecanIslandRequests;
    setLoadingData(false);
    setLoginError(loaded.error ? `Signed in, but the project queue could not be loaded: ${loaded.error.message}` : "");
    setCurrentPersona(persona);
    setCurrentUser({ username: user.email ?? username, name: persona.name, agencyId: "spaceport", applicationIds: permits.map((item) => item.id), scenario: persona.role });
    setUserPermits(permits);
    setRoute("my-work");
  }

  async function handleDemoPersonaSelect(persona: DemoPersona) {
    setUsername(persona.email);
    setPassword(persona.password ?? DEMO_PASSWORD);
    setLoginError("");
    setLoadingData(true);
    let loadedPermits: ServiceRequest[] | null = null;
    if (supabaseConfigured() && persona.password) {
      const { user } = await signInWithPassword(persona.email, persona.password);
      if (user) {
        const loaded = await loadRequestsForUser();
        loadedPermits = loaded.permits.length > 0 ? loaded.permits : pecanIslandRequests;
      }
    }
    const permits = loadedPermits ?? (getOperationalPersona(persona).isCustomer && persona.email.startsWith("applicant.")
      ? userPermits
      : pecanIslandRequests);
    const finalPermits = permits.length > 0 ? permits : pecanIslandRequests;
    setCurrentPersona(persona);
    setCurrentUser({ username: persona.email, name: persona.name, agencyId: "spaceport", applicationIds: finalPermits.map((item) => item.id), scenario: `${persona.role} · ${persona.scenario}` });
    setUserPermits(finalPermits);
    setSelectedItemId(null);
    setRoute("my-work");
    setLoadingData(false);
    setShowDemoPeople(false);
  }

  async function signOut() {
    await signOutBrowser();
    setCurrentUser(null);
    setCurrentPersona(null);
    setUserPermits(pecanIslandRequests);
    setSelectedItemId(null);
    setRoute("my-work");
    setUsername("");
    setPassword("");
  }

  async function handleIntakeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!intakeText.trim()) return;
    const preview = parsePlainEnglishIntake(intakeText);
    if (supabaseConfigured()) {
      const result = await createRequestForUser({ title: `${preview.categoryLabel} request`, requestType: preview.detectedCategory, description: intakeText.trim() });
      if (result.error) {
        setIntakeStatus(result.error.message);
        return;
      }
    }
    setIntakeStatus(`Submitted to the ${preview.suggestedLeadAgency} triage queue.`);
    setIntakeText("");
  }

  async function handleConfirmAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog || !selectedItem) return;
    const item = selectedItem;
    const actorName = activePersona.name;
    const actorOrgName = activePersona.organization;
    const workstreamId = item.workstreamId ?? requestWorkstreamMap[item.sourceId];
    setDialogError("");

    if (dialog.action === "complete_step") {
      const requirements = getCompletionRequirements(item);
      if (!requirements.every((requirement) => completionChecks[requirement.id])) {
        setDialogError("Complete each required item before sending this step forward. The missing item is shown above.");
        return;
      }
      if (!workstreamId) {
        setDialogError("This work item is not connected to a configured workflow yet.");
        return;
      }
      const result = repository.completeWorkstreamStage({
        workstreamId,
        completedChecklists: ["completeness_checklist_passed", "drainage_concurrence_received", "ecological_signoff", "reviewer_determination_recorded"],
        providedDocs: ["site_plans", "wetlands_delineation", "drainage_model", "mitigation_plan"],
        actorName,
        actorOrgName,
      });
      if (!result.success) {
        setDialogError(result.errors?.join(" ") ?? "The workflow did not accept this transition.");
        return;
      }
      applyRepositoryWorkstream(item);
      notify(`Technical review completed. Work assigned to ${result.nextOwner ?? "the next configured owner"}.`);
      return;
    }

    if (dialog.action === "request_information") {
      if (!workstreamId || !questionText.trim()) {
        setDialogError("Tell the recipient what information is needed.");
        return;
      }
      const rfi = repository.createRFI({
        workstreamId,
        workstreamTitle: item.workstreamTitle,
        requestingOrgId: `org-${activePersona.agencyCode.toLowerCase()}`,
        requestingOrgCode: activePersona.agencyCode.split(" /")[0],
        recipientOrgId: "org-spacex",
        recipientOrgCode: "SPACEX",
        title: `Information needed · ${item.workstreamTitle}`,
        questionText: questionText.trim(),
        technicalReason: "The assigned reviewer needs this information to complete the current review.",
        requiredDocumentTypes: ["Reviewer response or supporting document"],
        responseDeadline: questionDueDate,
        scheduleImpactDays: 3,
        actorName,
      });
      repository.dispatchNotification({ userId: "user-spacex", title: `${rfi.code} requires a response`, message: questionText.trim(), type: "action_required", linkUrl: `/rfis/${rfi.code}`, urgency: "high", metadata: { rfiCode: rfi.code } });
      applyRepositoryWorkstream(item);
      notify(`${rfi.code} created. SpaceX Regulatory Engineering and the project concierge were notified.`);
      return;
    }

    if (dialog.action === "mark_blocked") {
      if (!workstreamId || !blockNeed.trim()) {
        setDialogError("Describe what is preventing you from proceeding.");
        return;
      }
      let createdLabel = "Structured blocker";
      const target = blockReason === "customer" ? "SpaceX Regulatory Engineering" : blockReason === "another_agency" ? blockAgency : blockReason === "statutory" ? "Statutory waiting period" : "Internal agency team";
      if (blockReason === "customer") {
        const rfi = repository.createRFI({
          workstreamId,
          workstreamTitle: item.workstreamTitle,
          requestingOrgId: `org-${activePersona.agencyCode.toLowerCase()}`,
          requestingOrgCode: activePersona.agencyCode.split(" /")[0],
          recipientOrgId: "org-spacex",
          recipientOrgCode: "SPACEX",
          title: `Information needed · ${item.workstreamTitle}`,
          questionText: blockNeed.trim(),
          technicalReason: "The review cannot continue until the customer provides the requested information.",
          requiredDocumentTypes: ["Supporting response document"],
          responseDeadline: blockDueDate,
          clockImpact: "clock_paused",
          scheduleImpactDays: 5,
          actorName,
        });
        createdLabel = `RFI ${rfi.code}`;
      } else if (blockReason === "another_agency") {
        const coordination = repository.createCoordinationRequest({
          workstreamId,
          workstreamTitle: item.workstreamTitle,
          requestingOrgId: `org-${activePersona.agencyCode.toLowerCase()}`,
          requestingOrgCode: activePersona.agencyCode.split(" /")[0],
          targetOrgId: `org-${blockAgency.toLowerCase()}`,
          targetOrgCode: blockAgency,
          requestingUserName: actorName,
          assignedToUserName: `${blockAgency} coordination team`,
          title: `Concurrence needed for ${item.workstreamTitle}`,
          needDescription: blockNeed.trim(),
          dueDate: blockDueDate,
          priority: item.isCriticalPath ? "critical_path" : "high",
        });
        createdLabel = `Coordination Request ${coordination.code}`;
      }
      repository.markWorkstreamBlocked({ workstreamId, reason: blockNeed.trim(), waitingOn: target, actorName, actorOrgName, pauseClock: blockReason === "customer" || blockReason === "statutory" });
      repository.dispatchNotification({ userId: "user-sarah-johnson", title: `${createdLabel} needs attention`, message: blockNeed.trim(), type: "action_required", linkUrl: `/workstreams/${workstreamId}`, urgency: item.isCriticalPath ? "critical" : "high", metadata: { workstreamId, target } });
      applyRepositoryWorkstream(item);
      notify(`${createdLabel} created. The responsible recipient and project concierge were notified.`);
      return;
    }

    if (dialog.action === "escalate") {
      if (!workstreamId) {
        setDialogError("This work item is not connected to a configured workstream.");
        return;
      }
      repository.escalateWorkstream({ workstreamId, problemType: escalationType, actorName, actorOrgName });
      notify(`Escalated to the configured next supervisor for ${item.workstreamTitle}.`);
      return;
    }

    if (dialog.action === "transfer") {
      if (!workstreamId) {
        setDialogError("This work item is not connected to a configured workstream.");
        return;
      }
      repository.transferWorkstream({ workstreamId, transferType, targetName: "Maya Chen", actorName, actorOrgName, note: actionNote.trim() });
      notify("Help request recorded for supervisor review.");
      return;
    }

    if (dialog.action === "add_note") {
      if (!workstreamId || !actionNote.trim()) {
        setDialogError("Add a note before saving.");
        return;
      }
      repository.addWorkstreamNote({ workstreamId, note: actionNote.trim(), actorName, actorOrgName });
      notify("Note added to the activity history.");
      return;
    }

    if (dialog.action === "approve_document" || dialog.action === "approve_with_comments" || dialog.action === "request_revision") {
      if (!item.exactDocumentVersionId) {
        setDialogError("The exact document version could not be resolved.");
        return;
      }
      const decision = dialog.action === "request_revision" ? "revision_requested" : dialog.action === "approve_with_comments" ? "approved_with_conditions" : "approved";
      const review = repository.reviewDocumentVersion({ versionId: item.exactDocumentVersionId, agencyCode: activePersona.agencyCode.split(" /")[0], decision, actorName, comments: actionNote.trim() || `${actionLabel(dialog.action)} recorded for ${item.exactDocumentVersionLabel}.` });
      if (!review) {
        setDialogError("This exact document version is not assigned to your agency.");
        return;
      }
      notify(`${item.exactDocumentVersionLabel} decision saved against the exact version.`);
      return;
    }

    if (dialog.action === "accept_rfi_response") {
      if (!item.sourceRfi) return;
      const accepted = repository.acceptRfiResponse({ rfiId: item.sourceRfi.id, actorName, actorOrgName, notes: actionNote.trim() });
      if (!accepted) {
        setDialogError("The RFI response could not be accepted.");
        return;
      }
      notify(`${item.sourceRfi.code} accepted. The linked review can resume.`);
      return;
    }

    if (dialog.action === "request_clarification") {
      if (!item.sourceRfi || !questionText.trim()) {
        setDialogError("Tell SpaceX what needs clarification.");
        return;
      }
      const clarification = repository.createRFI({
        workstreamId: item.sourceRfi.workstreamId,
        workstreamTitle: item.sourceRfi.workstreamTitle,
        requestingOrgId: `org-${activePersona.agencyCode.toLowerCase()}`,
        requestingOrgCode: activePersona.agencyCode.split(" /")[0],
        recipientOrgId: "org-spacex",
        recipientOrgCode: "SPACEX",
        title: `Clarification requested · ${item.sourceRfi.code}`,
        questionText: questionText.trim(),
        technicalReason: "The reviewer needs clarification before accepting the submitted response.",
        responseDeadline: questionDueDate,
        actorName,
      });
      notify(`${clarification.code} created for clarification.`);
      return;
    }

    if (dialog.action === "respond") {
      if (!item.sourceRfi || !actionNote.trim()) {
        setDialogError("Add the response before submitting.");
        return;
      }
      const response = repository.submitRfiResponse({ rfiId: item.sourceRfi.id, submittedByName: actorName, responseText: actionNote.trim(), actorOrgName });
      if (!response) {
        setDialogError("The response could not be submitted.");
        return;
      }
      notify(`${item.sourceRfi.code} response submitted to the requesting agency.`);
      return;
    }

    if (dialog.action === "upload_documents") {
      notify("The secure document upload handoff is ready. The project team can now attach the requested revision.");
    }
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-[#f3f6f7] text-[#172033]">
        <div className="road-stripe" />
        <header className="site-header">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-8">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[#f4a100] text-[#00284d]"><Zap className="size-6 fill-current" aria-hidden="true" /></span>
            <div><p className="text-lg font-black tracking-tight text-white">PATH</p><p className="text-xs font-semibold text-slate-200">SpaceX Louisiana operational coordination</p></div>
          </div>
        </header>
        <main className="mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="max-w-2xl">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-teal-800">SpaceX Louisiana · Vermilion Parish</p>
            <h1 className="text-4xl font-black tracking-tight text-[#00284d] sm:text-6xl">PATH tells you what to do next.</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">A shared operational workspace for reviewers, supervisors, the State Project Office, and the SpaceX project team.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["See work assigned to you", "Complete or block a step", "Preview the next handoff"].map((text) => <div key={text} className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-[#00284d] shadow-sm"><CheckCircle2 className="mb-3 size-5 text-teal-700" aria-hidden="true" />{text}</div>)}
            </div>
          </section>
          <Card className="border-slate-200 bg-white shadow-xl">
            <CardHeader className="border-b border-slate-100 bg-slate-50">
              <CardTitle className="flex items-center gap-2 text-xl font-black text-[#00284d]"><User className="size-5 text-teal-700" /> Sign in to Critical Path</CardTitle>
              <p className="text-sm text-slate-600">Your default landing page is My Work, filtered to your role and agency.</p>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div><Label htmlFor="username">Email address / username</Label><Input ref={usernameRef} id="username" name="username" type="text" value={username} required onChange={(event) => { setUsername(event.target.value); setLoginError(""); }} className="mt-1 h-11" placeholder="jordan.lee@spacex.test" /></div>
                <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" value={password} required onChange={(event) => { setPassword(event.target.value); setLoginError(""); }} className="mt-1 h-11" placeholder="demo1234" /></div>
                <Button id="login-submit" type="submit" disabled={loadingData} className="h-11 w-full bg-[#00284d] font-bold hover:bg-[#003c70]">{loadingData ? "Signing in…" : "Sign In"}<ArrowRight className="size-4" aria-hidden="true" /></Button>
              </form>
              {loginError && <p id="login-error" role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">{loginError}</p>}
              <div className="border-t border-slate-100 pt-4">
                <Button id="demo-login-trigger" type="button" variant="outline" className="w-full justify-between border-teal-300 bg-teal-50 font-bold text-teal-950" onClick={() => setShowDemoPeople((value) => !value)}><span className="flex items-center gap-2"><Sparkles className="size-4 text-teal-700" aria-hidden="true" /> Quick Demo Sign-In</span><ChevronDown className={`size-4 transition-transform ${showDemoPeople ? "rotate-180" : ""}`} aria-hidden="true" /></Button>
                {showDemoPeople && <div className="mt-3 space-y-2" aria-label="Demo personas">
                  {demoPersonas.map((persona) => <button key={persona.id} id={`demo-persona-${persona.id}`} type="button" onClick={() => void handleDemoPersonaSelect(persona)} className="flex w-full items-start justify-between rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-teal-500 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><span><span className="block text-sm font-black text-[#00284d]">{persona.name}</span><span className="block text-xs font-semibold text-slate-500">{persona.role}</span></span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">{persona.badge}</span></button>)}
                </div>}
              </div>
              <p className="text-xs leading-5 text-slate-500"><strong className="text-slate-700">Demo:</strong> use the persona picker for the reviewer, supervisor, customer, and applicant scenarios. Official statutory filings remain in the authoritative agency systems.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const canAdmin = activePersona.workspace === "admin" || activePersona.workspace === "supervisor";
  const primaryNav: Array<{ id: Route; label: string; icon: ReactNode; count?: number }> = activePersona.isCustomer
    ? [{ id: "my-work", label: "My Work", icon: <LayoutList className="size-4" /> }, { id: "project", label: "Project status", icon: <Building2 className="size-4" /> }, { id: "rfis", label: "Requests from government", icon: <HelpCircle className="size-4" /> }, { id: "notifications", label: "Notifications", icon: <Bell className="size-4" /> }]
    : [{ id: "my-work", label: "My Work", icon: <LayoutList className="size-4" />, count: queueGroups[0]?.items.length }, { id: "agency-queue", label: activePersona.workspace === "supervisor" ? "Supervisor queue" : "My agency queue", icon: <Building2 className="size-4" /> }, { id: "rfis", label: "RFIs", icon: <HelpCircle className="size-4" /> }, { id: "coordination", label: "Coordination requests", icon: <Users className="size-4" /> }, { id: "documents", label: "Documents to review", icon: <FileCheck2 className="size-4" /> }, { id: "project", label: "Project", icon: <Route className="size-4" /> }, { id: "notifications", label: "Notifications", icon: <Bell className="size-4" /> }];

  function renderWorkCard(item: OperationalWorkItem) {
    const tone = toneClasses(item.statusTone);
    const actions = getAvailableActions(item, activePersona);
    const compactActions = actions.filter((action) => ["mark_blocked", "request_information", "respond", "accept_rfi_response", "approve_document"].includes(action)).slice(0, 1);
    return <article key={item.id} className={`rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md ${tone.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3"><span className={`mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg ${tone.badge}`}>{kindIcon(item)}</span><div className="min-w-0"><p className="font-mono text-[11px] font-bold uppercase tracking-wide text-slate-500">{item.id} · {item.kind}</p><h3 className="mt-1 text-lg font-black leading-tight text-[#00284d]">{item.title}</h3><p className="mt-1 text-sm font-semibold text-slate-600">{item.workstreamTitle}</p></div></div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black uppercase ${tone.badge}`}><span className={`size-1.5 rounded-full ${tone.dot}`} />{item.statusLabel}</span>
      </div>
      <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Why you’re seeing this</p><p className="mt-1 text-sm leading-5 text-slate-700">{item.whyHere}</p></div>
        <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">What you need to do</p><p className="mt-1 text-sm font-semibold leading-5 text-[#00284d]">{item.whatToDo}</p></div>
      </div>
      <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-xs sm:grid-cols-4">
        <div><p className="font-black uppercase tracking-wider text-slate-500">Due</p><p className="mt-1 font-bold text-slate-800">{formatDate(item.dueDate)}</p></div>
        <div><p className="font-black uppercase tracking-wider text-slate-500">Age / wait</p><p className="mt-1 font-bold text-slate-800">{item.waitLabel ?? item.ageLabel}</p></div>
        <div><p className="font-black uppercase tracking-wider text-slate-500">Schedule impact</p><p className="mt-1 font-bold text-slate-800">{item.scheduleImpact}</p></div>
        <div><p className="font-black uppercase tracking-wider text-slate-500">Next handoff</p><p className="mt-1 font-bold text-teal-800">{item.nextHandoff ?? "Configured by workflow"}</p></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <p className="max-w-xl text-xs text-slate-600"><strong className="text-slate-800">Removes from your queue:</strong> {item.removesFromQueue}</p>
        <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => openItem(item)} className="bg-[#00284d] text-xs font-bold hover:bg-[#003c70]">Open Work <ArrowRight className="size-3.5" aria-hidden="true" /></Button>{compactActions.map((action) => <Button key={action} type="button" variant="outline" onClick={() => openAction(item, action)} className="text-xs font-bold">{actionIcon(action)}{actionLabel(action)}</Button>)}</div>
      </div>
    </article>;
  }

  function queueLabel(group: { id: QueueSectionId; label: string }) {
    if (!activePersona.isCustomer) return group.label;
    if (group.id === "needs_action") return "Needs SpaceX";
    if (group.id === "waiting") return "Needs Government";
    if (group.id === "overdue") return "Blocked";
    if (group.id === "upcoming") return "Upcoming decisions";
    return group.label;
  }

  function renderMyWork() {
    return <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Your operational queue</p><h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-black tracking-tight text-[#00284d] outline-none sm:text-4xl">My Work</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Prioritized actions for {activePersona.name}. Open an item to see the assignment, required inputs, downstream impact, and the next handoff.</p></div><div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-right"><p className="text-xs font-black uppercase text-teal-800">Workspace</p><p className="mt-1 text-sm font-black text-teal-950">{workspaceTitle(activePersona.workspace)}</p><p className="text-xs text-teal-800">{activePersona.agencyCode}</p></div></div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="My Work summary">
        {queueGroups.map((group) => <button key={group.id} type="button" onClick={() => document.getElementById(`queue-${group.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-teal-400 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{queueLabel(group)}</p><p className="mt-1 text-2xl font-black text-[#00284d]">{group.items.length}</p></button>)}
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><Info className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden="true" /><div><p className="font-black text-[#00284d]">Start here</p><p className="mt-1 text-sm text-slate-600">The queue is prioritized by critical-path impact, due date, blockers, and handoff readiness. Waiting items stay visible without looking like failed work.</p></div></div></section>
      <div className="space-y-7">{queueGroups.map((group) => <section id={`queue-${group.id}`} key={group.id} className="scroll-mt-28"><div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="text-lg font-black text-[#00284d]">{queueLabel(group)} <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">{group.items.length}</span></h2><p className="mt-1 text-sm text-slate-500">{group.description}</p></div>{group.id === "needs_action" && <span className="text-xs font-bold uppercase tracking-wider text-teal-800">Priority order</span>}</div>{group.items.length > 0 ? <div className="space-y-3">{group.items.map(renderWorkCard)}</div> : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">Nothing in this section right now.</div>}</section>)}</div>
      {activePersona.isCustomer && <form onSubmit={handleIntakeSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-5 text-teal-700" aria-hidden="true" /><div className="flex-1"><h2 className="font-black text-[#00284d]">Ask the project office for something</h2><p className="mt-1 text-sm text-slate-600">Describe the need in plain language. PATH will suggest the lead agency and send it to the triage queue.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={intakeText} onChange={(event) => setIntakeText(event.target.value)} placeholder="We need a heavy-haul route review for oversized trailers…" aria-label="Describe a project need" /><Button id="intake-submit-btn" type="submit" className="bg-[#00284d] font-bold">Submit request <Send className="size-4" aria-hidden="true" /></Button></div>{intakePreview && <p role="status" aria-live="polite" className="mt-3 rounded-lg bg-teal-50 p-3 text-sm font-bold text-teal-950">Suggested route: {intakePreview.categoryLabel} → {intakePreview.suggestedLeadAgency} · {intakePreview.priority.toUpperCase()}</p>}{intakeStatus && <p role="status" aria-live="polite" className="mt-2 text-sm font-bold text-teal-800">{intakeStatus}</p>}</div></div></form>}
    </div>;
  }

  function renderQueue(routeKind: Route) {
    const filtered = routeKind === "rfis" ? workItems.filter((item) => item.kind === "rfi") : routeKind === "coordination" ? workItems.filter((item) => item.kind === "coordination") : routeKind === "documents" ? workItems.filter((item) => item.kind === "document") : workItems;
    const title = routeKind === "rfis" ? "RFIs" : routeKind === "coordination" ? "Coordination Requests" : routeKind === "documents" ? "Documents to Review" : activePersona.workspace === "supervisor" ? "Supervisor Queue" : "My Agency Queue";
    return <div className="space-y-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Operational queue</p><h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-black text-[#00284d] outline-none">{title}</h1><p className="mt-2 text-sm text-slate-600">Every item below explains its owner, due date, and the next action available to you.</p></div>{filtered.length > 0 ? <div className="space-y-3">{filtered.map(renderWorkCard)}</div> : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">No items are currently routed to this queue.</div>}</div>;
  }

  function renderNotifications() {
    const notifications = repository.getNotifications();
    const events = repository.getAuditEvents().slice(0, 8);
    return <div className="space-y-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Action center</p><h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-black text-[#00284d] outline-none">Notifications</h1><p className="mt-2 text-sm text-slate-600">Only material events that change what someone needs to do appear here; routine audit history stays on the work item.</p></div><div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Bell className="size-5 text-teal-700" /> Action required</CardTitle></CardHeader><CardContent className="space-y-3">{notifications.length > 0 ? notifications.slice(0, 8).map((notification) => <div key={notification.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-black text-amber-950">{notification.title}</p><p className="mt-1 text-sm text-amber-900">{notification.message}</p><p className="mt-2 text-[11px] font-bold uppercase text-amber-800">{notification.type.replaceAll("_", " ")}</p></div>) : <p className="text-sm text-slate-500">No new action notifications.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Clock3 className="size-5 text-teal-700" /> Status updates</CardTitle></CardHeader><CardContent className="space-y-3">{events.map((event) => <div key={event.id} className="border-b border-slate-100 pb-3 last:border-0"><p className="text-sm font-bold text-[#00284d]">{event.actionType.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-600">{event.reason ?? event.newValue ?? "Recorded activity"}</p><p className="mt-1 text-[11px] text-slate-400">{event.actorName} · {formatDate(event.occurredAt)}</p></div>)}</CardContent></Card></div></div>;
  }

  function renderProject() {
    const workload = getAgencyWorkload(userPermits);
    return <div className="space-y-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">SpaceX Pecan Island</p><h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-black text-[#00284d] outline-none">Project context</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Vermilion Parish, Louisiana · shared operational context for the project team.</p></div>{activePersona.isCustomer ? <Card><CardHeader><CardTitle className="text-lg font-black text-[#00284d]">No surprises</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-slate-700">Government agencies are coordinating the next steps. PATH shows SpaceX only the actions and status updates intended for your project team.</p><Button type="button" onClick={() => setSecondaryTool("schedule")} className="mt-4 bg-[#00284d] font-bold">View project timeline <ArrowRight className="size-4" aria-hidden="true" /></Button></CardContent></Card> : <><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-black uppercase text-red-800">Blocked / at risk</p><p className="mt-2 text-3xl font-black text-red-950">{ragSummary.red}</p></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-800">Attention</p><p className="mt-2 text-3xl font-black text-amber-950">{ragSummary.yellow}</p></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-emerald-800">On track</p><p className="mt-2 text-3xl font-black text-emerald-950">{ragSummary.green}</p></div></div><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Building2 className="size-5 text-teal-700" /> Agency Workload</CardTitle></CardHeader><CardContent className="space-y-3">{workload.slice(0, 8).map((agency) => <div key={agency.agencyCode} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3"><div><p className="text-sm font-black text-[#00284d]">{agency.agencyCode}</p><p className="text-xs text-slate-500">{agency.agencyLevel} · {agency.agencyName}</p></div><div className="text-right text-xs font-bold text-slate-700">{agency.count} workstreams · {agency.blockedCount} blocked</div></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Route className="size-5 text-teal-700" /> Gantt and dependencies</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-600">The detailed schedule remains available as a secondary tool. Use it to understand critical-path impact after you identify the work requiring attention.</p><Button type="button" onClick={() => { setSecondaryTool("schedule"); navigate("secondary"); }} className="mt-4 bg-[#00284d] font-bold">Open Gantt <ArrowRight className="size-4" aria-hidden="true" /></Button></CardContent></Card></>}</div>;
  }

  function renderSecondary() {
    return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Secondary tools</p><h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-black text-[#00284d] outline-none">{secondaryTool === "schedule" ? "Schedule" : secondaryTool === "vault" ? "Document Vault" : "Permit Catalog"}</h1></div><div className="flex flex-wrap gap-2">{([["schedule", "Schedule"], ["vault", "Document Vault"], ["catalog", "Permit Catalog"]] as Array<[SecondaryTool, string]>).map(([tool, label]) => <Button key={tool} type="button" variant={secondaryTool === tool ? "default" : "outline"} onClick={() => setSecondaryTool(tool)} className="text-xs font-bold">{label}</Button>)}</div></div>{secondaryTool === "schedule" && <WorkstreamGraphGantt />}{secondaryTool === "vault" && <DocumentVaultPanel />}{secondaryTool === "catalog" && <WorkflowDesignerPanel />}</div>;
  }

  function renderAdmin() {
    const [firstUser] = teamUsers;
    return <div className="space-y-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Authorized administration</p><h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-black text-[#00284d] outline-none">Roles and permissions</h1><p className="mt-2 text-sm text-slate-600">Administration is visible only to supervisors and administrators. Operational reviewers do not need this screen to ask for help or transfer work.</p></div><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><UserCog className="size-5 text-teal-700" /> Team access</CardTitle></CardHeader><CardContent className="space-y-3">{teamUsers.map((user) => <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div><p className="text-sm font-black text-[#00284d]">{user.name}</p><p className="text-xs text-slate-500">{user.email} · {user.organization}</p><p className="mt-1 max-w-xl text-xs text-slate-500">{roleDefinitions[user.roleId].description}</p></div><select aria-label={`Role for ${user.name}`} value={user.roleId} onChange={(event) => { const roleId = event.target.value as RoleId; setTeamUsers((current) => current.map((member) => member.id === user.id ? { ...member, roleId, permissions: roleDefinitions[roleId].permissions } : member)); setToast(`Updated ${user.name} to ${roleDefinitions[roleId].name}.`); }} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800">{(Object.keys(roleDefinitions) as RoleId[]).map((role) => <option key={role} value={role}>{roleDefinitions[role].name}</option>)}</select></div>)}<p className="text-xs text-slate-500">Current administrator: {firstUser?.name ?? "PATH administrator"}. Permission changes remain subject to server authorization in production.</p></CardContent></Card></div>;
  }

  function renderDetail() {
    if (!selectedItem) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="font-bold text-slate-600">Choose a work item to open its assignment.</p><Button type="button" onClick={() => navigate("my-work")} className="mt-4 bg-[#00284d] font-bold">Back to My Work</Button></div>;
    const actions = getAvailableActions(selectedItem, activePersona);
    const completionPreview = getCompletionPreview(selectedItem);
    const customer = activePersona.isCustomer;
    const request = selectedItem.sourceRequest;
    const escalationPath = request?.escalationPath ?? [];
    const audit = repository.getAuditEvents().filter((event) => event.entityId === selectedItem.workstreamId || event.entityId === selectedItem.sourceId).slice(0, 6);
    return <div className="space-y-5"><nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500"><button type="button" onClick={() => navigate("my-work")} className="text-teal-800 underline-offset-2 hover:underline">My Work</button><span aria-hidden="true">›</span><span>SpaceX Pecan Island</span><span aria-hidden="true">›</span><span>{selectedItem.workstreamTitle}</span><span aria-hidden="true">›</span><span className="text-slate-800">{selectedItem.title}</span></nav>
      <section className="rounded-2xl border border-teal-300 bg-white p-5 shadow-md sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-teal-800">{customer ? "PROJECT STATUS" : "YOUR ASSIGNMENT"}</p><h1 ref={headingRef} tabIndex={-1} className="mt-2 max-w-3xl text-2xl font-black tracking-tight text-[#00284d] outline-none sm:text-4xl">{customer ? sanitizeCustomerItem(selectedItem).title : selectedItem.title}</h1><p className="mt-2 text-sm font-semibold text-slate-600">{selectedItem.workstreamTitle}</p></div><span className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase ${toneClasses(selectedItem.statusTone).badge}`}>{selectedItem.statusLabel}</span></div><div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4"><div><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Assignment</p><p className="mt-1 font-black text-[#00284d]">{customer ? "Shared project status" : "You own this step"}</p></div><div><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Due</p><p className="mt-1 font-black text-[#00284d]">{formatDate(selectedItem.dueDate)}</p></div><div><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Critical path</p><p className="mt-1 font-black text-[#00284d]">{selectedItem.isCriticalPath ? "Yes" : "No"}</p></div><div><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Float remaining</p><p className="mt-1 font-black text-[#00284d]">{selectedItem.isCriticalPath ? "3 days" : "Within float"}</p></div></div>{!customer && actions.length > 0 && <div className="sticky bottom-3 z-10 mt-6 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur" aria-label="Work actions"><span className="mr-1 self-center text-xs font-black uppercase tracking-wider text-slate-500">Actions</span>{actions.map((action, index) => <Button key={action} type="button" variant={index === 0 ? "default" : "outline"} onClick={() => openAction(selectedItem, action)} className={`text-xs font-bold ${index === 0 ? "bg-[#00284d] hover:bg-[#003c70]" : ""}`}>{actionIcon(action)}{actionLabel(action)}</Button>)}</div>}{customer && actions.length > 0 && <div className="sticky bottom-3 z-10 mt-6 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur" aria-label="Customer actions">{actions.map((action) => <Button key={action} type="button" onClick={() => openAction(selectedItem, action)} className="bg-[#00284d] text-xs font-bold">{actionIcon(action)}{actionLabel(action)}</Button>)}</div>}</section>
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"><div className="space-y-5"><Card><CardHeader><CardTitle className="text-lg font-black text-[#00284d]">{customer ? "What this means for SpaceX" : "What you need to do"}</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-slate-700">{customer ? selectedItem.customerVisibleSummary : selectedItem.whatToDo}</p>{!customer && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600"><strong className="text-slate-800">Why you’re seeing this:</strong> {selectedItem.whyHere}<br /><strong className="text-slate-800">What removes it from your queue:</strong> {selectedItem.removesFromQueue}</p>}</CardContent></Card>
        {!customer && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><ListChecks className="size-5 text-teal-700" /> Required inputs</CardTitle></CardHeader><CardContent><ul className="space-y-2">{selectedItem.requiredInputs.map((input) => <li key={input} className="flex items-start gap-2 text-sm text-slate-700"><Check className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />{input}</li>)}</ul></CardContent></Card>}
        {selectedItem.documents.length > 0 && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Paperclip className="size-5 text-teal-700" /> Documents</CardTitle></CardHeader><CardContent className="space-y-3">{selectedItem.documents.map((doc) => <div key={doc.id} className="rounded-lg border border-slate-200 p-3"><p className="text-sm font-black text-[#00284d]">{doc.label}</p><p className="mt-1 text-xs font-bold text-slate-500">{doc.version ?? "Linked supporting version"} · {doc.id}</p>{selectedItem.kind === "document" && <p className="mt-2 rounded bg-amber-50 p-2 text-xs font-black text-amber-950">YOU ARE REVIEWING {selectedItem.exactDocumentVersionLabel}</p>}</div>)}</CardContent></Card>}
        {selectedItem.kind === "document" && selectedItem.sourceDocument && <Card><CardHeader><CardTitle className="text-lg font-black text-[#00284d]">Version history</CardTitle></CardHeader><CardContent><p className="text-sm font-black text-[#00284d]">You are reviewing {selectedItem.exactDocumentVersionLabel}</p>{selectedItem.sourceDocument.versions.filter((version) => version.id !== selectedItem.exactDocumentVersionId).map((version) => <p key={version.id} className="mt-2 text-sm text-slate-600">Previously: {version.versionTag} uploaded {formatDate(version.uploadedAt)}.</p>)}</CardContent></Card>}
        {!customer && escalationPath.length > 0 && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><ShieldAlert className="size-5 text-teal-700" /> Inter-Agency Escalation Path</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{escalationPath.map((tier) => <div key={tier.level} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase text-slate-500">Tier {tier.level}</p><span className="text-[10px] font-black uppercase text-teal-800">{tier.status}</span></div><p className="mt-2 text-sm font-black text-[#00284d]">{tier.title}</p><p className="mt-1 text-xs text-slate-600">{tier.contactName} · {tier.agency}</p></div>)}</CardContent></Card>}</div><div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><ArrowRight className="size-5 text-teal-700" /> Downstream impact</CardTitle></CardHeader><CardContent><p className="text-sm font-black text-[#00284d]">{selectedItem.nextHandoff ?? "Next configured handoff"}</p><p className="mt-2 text-sm leading-6 text-slate-600">{selectedItem.scheduleImpact}. The next owner and notification recipients are previewed before an important action is confirmed.</p></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Clock3 className="size-5 text-teal-700" /> Activity / audit history</CardTitle></CardHeader><CardContent className="space-y-3">{customer ? <p className="text-sm text-slate-600">Internal activity is not shown in the customer workspace.</p> : audit.length > 0 ? audit.map((event) => <div key={event.id} className="border-b border-slate-100 pb-3 last:border-0"><p className="text-xs font-black uppercase text-slate-500">{event.actionType.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-slate-700">{event.reason ?? event.newValue ?? "Activity recorded"}</p><p className="mt-1 text-[11px] text-slate-400">{event.actorName} · {formatDate(event.occurredAt)}</p></div>) : <p className="text-sm text-slate-500">No activity recorded yet.</p>}</CardContent></Card></div></div>
      {!customer && selectedItem.kind === "workflow" && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Route className="size-5 text-teal-700" /> Upstream and downstream dependencies</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Upstream</p><p className="mt-2 text-sm text-slate-700">{selectedItem.waitingOn ?? "No unresolved upstream dependency"}</p></div><div className="rounded-lg bg-teal-50 p-4"><p className="text-xs font-black uppercase text-teal-800">Downstream</p><p className="mt-2 text-sm font-bold text-teal-950">{completionPreview.nextOwner} receives the next handoff after completion.</p></div></CardContent></Card>}
    </div>;
  }

  function renderDialog() {
    if (!dialog || !selectedItem) return null;
    const requirements = getCompletionRequirements(selectedItem);
    const recipientPreview = getRecipientPreview(selectedItem, dialog.action, activePersona);
    const completionPreview = getCompletionPreview(selectedItem);
    const isCompletion = dialog.action === "complete_step";
    return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#00284d]/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="action-dialog-title" aria-describedby="action-dialog-description"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 p-5"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Work action</p><h2 id="action-dialog-title" className="mt-1 text-xl font-black text-[#00284d]">{actionLabel(dialog.action)}</h2><p id="action-dialog-description" className="mt-1 text-sm text-slate-600">{selectedItem.title}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setDialog(null)} aria-label="Close action dialog"><X className="size-5" /></Button></div><form onSubmit={handleConfirmAction} className="space-y-5 p-5 sm:p-6">
      {isCompletion && <><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">You are completing</p><p className="mt-1 text-lg font-black text-[#00284d]">{selectedItem.title}</p><p className="mt-1 text-sm text-slate-600">Required before completion:</p></div><div className="space-y-2">{requirements.map((requirement) => <label key={requirement.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"><input type="checkbox" checked={Boolean(completionChecks[requirement.id])} onChange={(event) => setCompletionChecks((current) => ({ ...current, [requirement.id]: event.target.checked }))} className="mt-0.5 size-4 accent-teal-700" /><span className="text-sm font-semibold text-slate-800">{requirement.label}</span></label>)}</div><div className="rounded-xl border border-teal-200 bg-teal-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-teal-900">What happens next</p><ul className="mt-2 space-y-1 text-sm text-teal-950">{completionPreview.effects.map((effect) => <li key={effect} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{effect}</li>)}</ul></div><div><Label htmlFor="determination">Reviewer determination</Label><select id="determination" value={determination} onChange={(event) => setDetermination(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option>Complete / Approved</option><option>Complete with Conditions</option><option>Not Applicable</option></select></div></>}
      {dialog.action === "mark_blocked" && <><div><Label htmlFor="block-reason">What is preventing you from proceeding?</Label><select id="block-reason" value={blockReason} onChange={(event) => setBlockReason(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="customer">Waiting on SpaceX</option><option value="another_agency">Waiting on another agency</option><option value="internal">Missing internal decision</option><option value="statutory">Scheduled / statutory hold</option><option value="technical">Technical problem</option><option value="legal">Legal / policy question</option><option value="external">External third party</option><option value="other">Other</option></select></div>{blockReason === "another_agency" && <div><Label htmlFor="block-agency">Who needs to act?</Label><select id="block-agency" value={blockAgency} onChange={(event) => setBlockAgency(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option>CPRA</option><option>USACE</option><option>DOTD</option><option>Vermilion Parish</option><option>LDEQ</option></select></div>}<div><Label htmlFor="block-need">What do you need from them?</Label><textarea id="block-need" value={blockNeed} onChange={(event) => setBlockNeed(event.target.value)} rows={4} required className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm" placeholder="Describe the concurrence, document, or decision needed." /></div><div><Label htmlFor="block-due">When is it needed?</Label><Input id="block-due" type="date" value={blockDueDate} onChange={(event) => setBlockDueDate(event.target.value)} className="mt-1" /></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><strong className="text-[#00284d]">Clock behavior:</strong> PATH derives the wait policy from the selected reason. You are not asked to make a legal/policy determination.</div></>}
      {(dialog.action === "request_information" || dialog.action === "request_clarification") && <><div><Label htmlFor="question-text">What do you need?</Label><textarea id="question-text" value={questionText} onChange={(event) => setQuestionText(event.target.value)} rows={4} required className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm" /></div><div><Label htmlFor="question-due">When is it needed?</Label><Input id="question-due" type="date" value={questionDueDate} onChange={(event) => setQuestionDueDate(event.target.value)} className="mt-1" /></div></>}
      {dialog.action === "transfer" && <><div><Label htmlFor="transfer-type">How should we help?</Label><select id="transfer-type" value={transferType} onChange={(event) => setTransferType(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option>Ask another reviewer</option><option>Transfer assignment</option><option>Add co-reviewer</option><option>Send to supervisor</option><option>Request specialist consultation</option></select></div><div><Label htmlFor="transfer-note">What should the supervisor know?</Label><textarea id="transfer-note" value={actionNote} onChange={(event) => setActionNote(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm" /></div></>}
      {dialog.action === "escalate" && <><div><Label htmlFor="escalation-type">What kind of help do you need?</Label><select id="escalation-type" value={escalationType} onChange={(event) => setEscalationType(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option>Supervisor decision</option><option>Cross-agency assistance</option><option>Deadline relief</option><option>Policy / legal determination</option><option>Project office assistance</option><option>Executive intervention</option><option>Other</option></select></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-amber-900">Next escalation</p><p className="mt-1 text-sm font-black text-amber-950">{recipientPreview.recipients[0]?.name}</p><p className="text-sm text-amber-900">{recipientPreview.recipients[0]?.organization}</p><p className="mt-2 text-xs text-amber-800">If unresolved by September 3, the Louisiana Project Office will be notified.</p></div></>}
      {(dialog.action === "add_note" || dialog.action === "approve_document" || dialog.action === "approve_with_comments" || dialog.action === "request_revision" || dialog.action === "accept_rfi_response" || dialog.action === "respond") && <div><Label htmlFor="action-note">{dialog.action === "respond" ? "Your response" : "Notes"}</Label><textarea id="action-note" value={actionNote} onChange={(event) => setActionNote(event.target.value)} rows={4} required={dialog.action === "add_note" || dialog.action === "respond"} className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm" placeholder={dialog.action === "respond" ? "Describe the response and attached information." : "Add context for the audit history."} /></div>}
      {dialog.action === "upload_documents" && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-black text-[#00284d]">Secure upload handoff</p><p className="mt-1 text-sm text-slate-600">Attach the requested document revision from the customer document workspace. The receiving agency will review the exact version submitted.</p></div>}
      {recipientPreview.recipients.length > 0 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-500">PATH will notify</p><div className="mt-2 space-y-2">{recipientPreview.recipients.map((recipient) => <div key={`${recipient.label}-${recipient.name}`} className="flex items-start gap-2 text-sm"><Mail className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden="true" /><span><strong className="text-[#00284d]">{recipient.label}:</strong> {recipient.name} · {recipient.organization}</span></div>)}</div>{recipientPreview.customerMessage && <p className="mt-3 border-t border-slate-200 pt-3 text-xs font-semibold text-slate-600"><strong className="text-slate-800">Customer will see:</strong> {recipientPreview.customerMessage}</p>}</div>}
      {dialogError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">{dialogError}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>{dialog.action !== "upload_documents" && <Button type="submit" className="bg-[#00284d] font-bold hover:bg-[#003c70]">{isCompletion ? "Complete & Send Forward" : actionLabel(dialog.action)}</Button>}</div>
    </form></div></div>;
  }

  function renderMain() {
    if (route === "detail") return renderDetail();
    if (route === "my-work") return renderMyWork();
    if (route === "agency-queue" || route === "rfis" || route === "coordination" || route === "documents") return renderQueue(route);
    if (route === "project") return renderProject();
    if (route === "notifications") return renderNotifications();
    if (route === "secondary") return renderSecondary();
    return renderAdmin();
  }

  return <div className="min-h-screen bg-[#f3f6f7] text-[#172033]"><a className="skip-link" href="#main-content">Skip to main content</a><div className="road-stripe" /><header className="site-header sticky top-0 z-30"><div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 sm:px-6"><Button type="button" variant="ghost" size="icon" onClick={() => setMobileNavOpen((value) => !value)} className="text-white hover:bg-white/10 lg:hidden" aria-label="Toggle navigation"><Menu className="size-5" /></Button><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f4a100] text-[#00284d]"><Zap className="size-5 fill-current" aria-hidden="true" /></span><div className="min-w-0"><p className="text-sm font-black text-white">PATH</p><p className="truncate text-[11px] font-semibold text-slate-300">{workspaceTitle(activePersona.workspace)} · SpaceX Pecan Island</p></div><div className="ml-auto hidden items-center gap-2 text-xs text-slate-200 md:flex"><span className="rounded-full border border-white/20 px-3 py-1.5">{activePersona.name}</span><span className="rounded-full border border-teal-300/40 bg-teal-900/40 px-3 py-1.5 font-bold text-teal-100">{activePersona.roleLabel}</span></div><Button type="button" variant="ghost" size="icon" onClick={() => navigate("notifications")} className="relative text-white hover:bg-white/10" aria-label="Open notifications"><Bell className="size-5" /><span className="absolute right-1 top-1 size-2 rounded-full bg-[#f4a100]" /></Button><Button type="button" variant="ghost" size="sm" onClick={() => void signOut()} className="text-white hover:bg-white/10"><LogOut className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Sign out</span></Button></div></header><div className="mx-auto flex max-w-[1600px] items-start"><aside className={`${mobileNavOpen ? "block" : "hidden"} fixed inset-x-0 top-[69px] z-20 max-h-[calc(100vh-69px)] overflow-y-auto border-b border-slate-200 bg-white p-3 shadow-xl lg:sticky lg:top-[69px] lg:block lg:min-h-[calc(100vh-69px)] lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:shadow-none`}><div className="mb-4 rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Current context</p><p className="mt-1 text-sm font-black text-[#00284d]">SpaceX Pecan Island</p><p className="mt-1 text-xs text-slate-500">Vermilion Parish · Louisiana</p></div><nav aria-label="Primary navigation" className="space-y-1"><p className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Work</p>{primaryNav.map((item) => <button key={item.id} type="button" onClick={() => navigate(item.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition ${route === item.id ? "bg-[#00284d] text-white shadow-sm" : "text-slate-700 hover:bg-teal-50 hover:text-teal-950"}`}>{item.icon}<span className="flex-1">{item.label}</span>{typeof item.count === "number" && <span className={`rounded-full px-2 py-0.5 text-[10px] ${route === item.id ? "bg-white/15 text-white" : "bg-slate-200 text-slate-700"}`}>{item.count}</span>}</button>)}<p className="px-3 pb-1 pt-6 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Secondary tools</p>{!activePersona.isCustomer && <><button type="button" onClick={() => { setSecondaryTool("schedule"); navigate("secondary"); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold ${route === "secondary" && secondaryTool === "schedule" ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-teal-50"}`}><CalendarClock className="size-4" />Schedule</button><button type="button" onClick={() => { setSecondaryTool("vault"); navigate("secondary"); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold ${route === "secondary" && secondaryTool === "vault" ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-teal-50"}`}><BookOpen className="size-4" />Document Vault</button><button type="button" onClick={() => { setSecondaryTool("catalog"); navigate("secondary"); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold ${route === "secondary" && secondaryTool === "catalog" ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-teal-50"}`}><Landmark className="size-4" />Permit Catalog</button></>}{canAdmin && <><p className="px-3 pb-1 pt-6 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Administration</p><button type="button" onClick={() => navigate("admin")} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold ${route === "admin" ? "bg-[#00284d] text-white" : "text-slate-700 hover:bg-teal-50"}`}><Settings2 className="size-4" />Administration</button></>}</nav><div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-black text-amber-950">Official filing notice</p><p className="mt-1 text-xs leading-5 text-amber-900">PATH coordinates work. Formal statutory filings remain in agency systems.</p></div></aside><main id="main-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{toast && <div role="status" aria-live="polite" className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />{toast}</div>}{renderMain()}</main></div>{renderDialog()}</div>;
}
