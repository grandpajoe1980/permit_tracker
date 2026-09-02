"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import {
  AlertOctagon,
  ArrowRight,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  Gauge,
  HelpCircle,
  Info,
  Landmark,
  LayoutList,
  ListChecks,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  MapPin,
  Paperclip,
  Pencil,
  Phone,
  Route,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  UserCog,
  UserRound,
  Users,
  X,
  UploadCloud,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { AdminDirectory } from "@/components/admin/AdminDirectory";
import { DocumentViewerModal } from "@/components/documents/DocumentViewerModal";
import type { CustomerRequestRecord, DocumentRecord, DocumentVersionRecord, ITSMState } from "@/lib/domain-models";
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
import { allowsFixtureData } from "@/lib/data-mode";
import { membershipRoleForRoleId, teamUsersFromMemberships } from "@/lib/admin-users";
import { downloadDocumentFile, mutateUploadDocumentVersion } from "@/lib/supabase/storage";
import { resolveWorkItemDocuments } from "@/lib/document-work-item-utils";
import { downloadDocumentVersion } from "@/lib/document-download-utils";
import {
  canUserModifyItem,
  canUserPerformAction,
  getAvailableActions,
  getCompletionPreview,
  getCompletionRequirements,
  getOperationalPersona,
  getOperationalWorkItems,
  getPersonaFromEmail,
  getRecipientPreview,
  groupMyWork,
  isAdministrator,
  requestWorkstreamMap,
  sanitizeCustomerItem,
  type OperationalWorkItem,
  type QueueSectionId,
  type WorkActionId,
  type WorkspaceMode,
} from "@/lib/operational-ux";
import {
  CUSTOMER_ORGANIZATION_NAME,
  customerVisibleProfiles,
  filingModeLabel,
  getProjectOverview,
  projectProfiles,
  type ProjectOverview,
} from "@/lib/customer-portal";
import { WorkstreamGraphGantt } from "@/components/cockpits/WorkstreamGraphGantt";
import { DocumentVaultPanel } from "@/components/cockpits/DocumentVaultPanel";
import { WorkflowDesignerPanel } from "@/components/cockpits/WorkflowDesignerPanel";
import { ProjectOverviewPage } from "@/components/cockpits/ProjectOverviewPage";
import { WorkflowMiniStepper } from "@/components/cockpits/WorkflowJourney";
import { SystemVersionFooter } from "@/components/SystemVersionFooter";
import { TicketWorkflowEditor } from "@/components/cockpits/TicketWorkflowEditor";

type Route = "my-work" | "agency-queue" | "rfis" | "coordination" | "documents" | "project" | "notifications" | "secondary" | "admin" | "detail" | "requests" | "schedule" | "contacts" | "help" | "profile";
type SecondaryTool = "schedule" | "vault" | "catalog";
type DialogState = { action: WorkActionId; itemId: string } | null;

function userIdForPersona(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : id.startsWith("user-") ? id : `user-${id}`;
}

function makeAuthenticatedPersona(email: string, name: string, userId?: string): DemoPersona {
  const membership = userId ? repository.getOrganizationMemberships().find((entry) => entry.userId === userId && entry.status === "active") : undefined;
  const profile = userId ? repository.getProfileByUserId(userId) : undefined;
  if (membership?.role === "organization_admin" || membership?.role === "system_admin") {
    return {
      id: userId ?? "authenticated-user",
      name: profile?.fullName ?? name,
      role: "Program Administrator",
      roleDescription: "Organization-scoped PATH administrator",
      email,
      badge: "Administrator",
      scenario: "Organization administration",
      group: "Louisiana Governor's Office of Major Projects & Delivery",
      organization: profile?.organizationName,
    };
  }
  if (membership?.role === "supervisor") {
    return {
      id: userId ?? "authenticated-user",
      name: profile?.fullName ?? name,
      role: "Agency Supervisor",
      roleDescription: "Authenticated PATH supervisor",
      email,
      badge: "Supervisor",
      scenario: "Agency operations",
      group: "Louisiana Governor's Office of Major Projects & Delivery",
      organization: profile?.organizationName,
    };
  }
  return getPersonaFromEmail(email) ?? {
    id: userId ?? "authenticated-user",
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
    update_status: "Update Status",
    advance_stage: "Advance to Next Stage",
    request_information: "Request Information",
    mark_blocked: "Mark Blocked",
    clear_blocker: "Clear Blocker & Resume",
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
  if (action === "clear_blocker") return <CheckCircle2 className="size-4" aria-hidden="true" />;
  if (action === "escalate") return <ShieldAlert className="size-4" aria-hidden="true" />;
  if (action === "transfer") return <Users className="size-4" aria-hidden="true" />;
  if (action === "add_note") return <MessageSquare className="size-4" aria-hidden="true" />;
  if (action === "request_information" || action === "request_clarification") return <HelpCircle className="size-4" aria-hidden="true" />;
  if (action === "approve_document" || action === "approve_with_comments" || action === "accept_rfi_response") return <CheckCircle2 className="size-4" aria-hidden="true" />;
  if (action === "respond" || action === "upload_documents") return <Send className="size-4" aria-hidden="true" />;
  if (action === "request_revision") return <FileText className="size-4" aria-hidden="true" />;
  if (action === "update_status") return <ClipboardCheck className="size-4" aria-hidden="true" />;
  if (action === "advance_stage") return <ArrowRight className="size-4" aria-hidden="true" />;
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

function persistedTeamUsers() {
  return teamUsersFromMemberships(repository.getProfiles(), repository.getOrganizationMemberships(), repository.getOrganizations());
}

function demoPersonaDomId(persona: DemoPersona) {
  const ids: Record<string, string> = { "alex-martin": "alex", "maya-chen": "maya", "sarah-johnson": "sarah", "jordan-lee": "jordan" };
  return ids[persona.id] ?? persona.id;
}

function syncRequestState(request: ServiceRequest, workstreamState?: ReturnType<typeof repository.getWorkstreamById>): ServiceRequest {
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
  } as ServiceRequest;
}

function CustomerRequestTriageQueue({
  requests,
  onTriage,
}: {
  requests: CustomerRequestRecord[];
  onTriage: (request: CustomerRequestRecord) => void;
}) {
  const pending = requests.filter((request) => request.status !== "in_progress" && request.status !== "resolved");
  if (pending.length === 0) return null;
  return <Card className="mb-6 border-amber-200 bg-amber-50/60"><CardHeader><CardTitle className="text-lg font-black text-[#00284d]">Customer intake queue</CardTitle><p className="text-sm text-slate-600">Create a linked workstream only after the request is confirmed in the database.</p></CardHeader><CardContent className="space-y-3">{pending.slice(0, 8).map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3"><div><p className="text-sm font-black text-[#00284d]">{request.confirmationNumber} · {request.title}</p><p className="mt-1 text-xs text-slate-600">{request.requestType.replaceAll("_", " ")} · {request.submittedByName}</p></div><Button type="button" size="sm" onClick={() => onTriage(request)} className="bg-[#00284d] text-xs font-bold">Create workstream</Button></div>)}</CardContent></Card>;
}

export default function Home() {
  const [route, setRoute] = useState<Route>("my-work");
  const [secondaryTool, setSecondaryTool] = useState<SecondaryTool>("schedule");
  const [currentUser, setCurrentUser] = useState<DemoAccount | null>(null);
  const [currentPersona, setCurrentPersona] = useState<DemoPersona | null>(null);
  const [userPermits, setUserPermits] = useState<ServiceRequest[]>(allowsFixtureData() ? pecanIslandRequests : []);
  const [teamUsers, setTeamUsers] = useState(() => {
    if (!allowsFixtureData()) return [] as typeof initialTeamUsers;
    if (typeof window === "undefined") return initialTeamUsers;
    try {
      const saved = window.localStorage.getItem("path-admin-team-users-v1");
      return saved ? JSON.parse(saved) as typeof initialTeamUsers : initialTeamUsers;
    } catch {
      return initialTeamUsers;
    }
  });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedProjectWorkstreamId, setSelectedProjectWorkstreamId] = useState<string | null>(null);
  const [showDemoPeople, setShowDemoPeople] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [hydrated, setHydrated] = useState(false);
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
  const [statusUpdate, setStatusUpdate] = useState("in_progress");
  const [queueSearch, setQueueSearch] = useState("");
  const [queueKind, setQueueKind] = useState("all");
  const [queueState, setQueueState] = useState("all");
  const [queueGroup, setQueueGroup] = useState("all");
  const [intakeText, setIntakeText] = useState("");
  const [intakeFile, setIntakeFile] = useState<File | null>(null);
  const [intakeStatus, setIntakeStatus] = useState("");
  const [requestCenterMode, setRequestCenterMode] = useState<"menu" | "permit" | "service" | "escalation">("menu");
  const [selectedCatalogPermitId, setSelectedCatalogPermitId] = useState("cat-usace-404");
  const [requestTitle, setRequestTitle] = useState("");
  const [requestOutcome, setRequestOutcome] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [requestFile, setRequestFile] = useState<File | null>(null);
  const [requestFileInputKey, setRequestFileInputKey] = useState(0);
  const [requestArea, setRequestArea] = useState("Pecan Island Launch Complex");
  const [requestDate, setRequestDate] = useState("");
  const [requestAgency, setRequestAgency] = useState("");
  const [requestBlocksWork, setRequestBlocksWork] = useState(false);
  const [externalReference, setExternalReference] = useState("");
  const [externalRecordUrl, setExternalRecordUrl] = useState("");
  const [externalStatus, setExternalStatus] = useState("submitted");
  const [profileStatus, setProfileStatus] = useState("");
  const [profileDraft, setProfileDraft] = useState({ displayTitle: "", organizationalUnit: "", workEmail: "", officePhone: "", mobilePhone: "", officeLocation: "", preferredContactMethod: "email" as "email" | "phone" | "text" | "teams", availabilityStatus: "available" as "available" | "limited" | "out_of_office" });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("saved");
  const [lastSavedTime, setLastSavedTime] = useState<string>("");
  const [viewerModalDoc, setViewerModalDoc] = useState<DocumentRecord | null>(null);
  const [viewerModalVer, setViewerModalVer] = useState<DocumentVersionRecord | undefined>(undefined);
  const usernameRef = useRef<HTMLInputElement>(null);
  const demoHydrationRef = useRef<Promise<void> | null>(null);

  const activePersona = getOperationalPersona(currentPersona);
  const operationalData = getOperationalWorkItems({
    persona: currentPersona,
    requests: userPermits,
    workstreams: repository.getWorkstreams(),
    coordinationRequests: repository.getCoordinationRequests(),
    rfis: repository.getRFIs(),
    documents: repository.getDocuments(),
    commitments: repository.getCommitments(),
    customerRequests: repository.getCustomerRequests(),
  });
  const workItems = operationalData.items;
  const activeQueueItems = workItems.filter((item) => {
    const query = queueSearch.trim().toLowerCase();
    const matchesSearch = !query || [item.id, item.title, item.workstreamTitle, item.ownerName, item.ownerOrganization, item.assignmentGroupName, item.statusLabel].filter(Boolean).some((value) => value?.toLowerCase().includes(query));
    const matchesKind = queueKind === "all" || item.kind === queueKind;
    const matchesState = queueState === "all" || item.itsmState === queueState;
    const matchesGroup = queueGroup === "all" || item.assignmentGroupId === queueGroup;
    return matchesSearch && matchesKind && matchesState && matchesGroup;
  });
  const selectedItem = selectedItemId ? workItems.find((item) => item.id === selectedItemId) ?? null : null;
  const queueGroups = groupMyWork(activeQueueItems);
  const ragSummary = calculateRAGSummary(userPermits);
  const intakePreview = intakeText.trim() ? parsePlainEnglishIntake(intakeText) : null;
  const loggedIn = Boolean(currentUser && currentPersona);
  const projectRecord = repository.getProject();
  const projectOverview: ProjectOverview = getProjectOverview(projectRecord, repository.getWorkstreams(), repository.getCustomerRequests(), repository.getExternalFilings());
  const currentProfile = repository.getProfileByUserId(userIdForPersona(activePersona.id)) ?? (allowsFixtureData() ? projectProfiles.find((profile) => profile.fullName === activePersona.name) : undefined);

  function profileDraftForPersona(persona: DemoPersona) {
    const operational = getOperationalPersona(persona);
    const profile = repository.getProfileByUserId(userIdForPersona(operational.id)) ?? (allowsFixtureData() ? projectProfiles.find((entry) => entry.fullName === operational.name) : undefined);
    return profile ? {
      displayTitle: profile.displayTitle,
      organizationalUnit: profile.organizationalUnit ?? "",
      workEmail: profile.workEmail,
      officePhone: profile.officePhone ?? "",
      mobilePhone: profile.mobilePhone ?? "",
      officeLocation: profile.officeLocation ?? "",
      preferredContactMethod: profile.preferredContactMethod,
      availabilityStatus: profile.availabilityStatus,
    } : profileDraft;
  }

  useEffect(() => {
    let active = true;
    const hydrationFrame = window.requestAnimationFrame(() => {
      if (active) setHydrated(true);
    });
    const client = getSupabaseBrowserClient();

    if (!client) return;
    void getBrowserUser().then(async (user) => {
      if (!active || !user) return;
      await repository.hydrateFromSupabase();
      if (!allowsFixtureData()) setTeamUsers(persistedTeamUsers());
      const loaded = await loadRequestsForUser();
      const persona = makeAuthenticatedPersona(user.email ?? "authenticated@path.local", String(user.user_metadata?.full_name ?? user.email ?? "Authenticated User"), user.id);
      const permits = loaded.permits.length > 0 || !allowsFixtureData() ? loaded.permits : pecanIslandRequests;
      setCurrentPersona(persona);
      setProfileDraft(profileDraftForPersona(persona));
      setCurrentUser({ username: user.email ?? "", name: persona.name, agencyId: "spaceport", applicationIds: permits.map((item) => item.id), scenario: persona.role });
      setUserPermits(permits);
      setRoute("my-work");
    });
    const { data: listener } = client.auth.onAuthStateChange((event: string, session: { user?: { email?: string | null; user_metadata?: Record<string, unknown> } } | null) => {
      if (event === "SIGNED_OUT") {
        setCurrentUser(null);
        setCurrentPersona(null);
        setUserPermits(allowsFixtureData() ? pecanIslandRequests : []);
      }
    });
    return () => {
      active = false;
      window.cancelAnimationFrame(hydrationFrame);
      listener.subscription.unsubscribe();
    };
  }, []);

  // Supabase Realtime multi-browser synchronization
  useEffect(() => {
    if (!loggedIn) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;

    const channel = client
      .channel("public-db-realtime-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        async () => {
          await repository.hydrateFromSupabase();
          if (!allowsFixtureData()) setTeamUsers(persistedTeamUsers());
          setMutationVersion((v) => v + 1);
          setLastSavedTime(new Date().toLocaleTimeString());
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [loggedIn]);

  useEffect(() => {
    if (!allowsFixtureData() || typeof window === "undefined") return;
    window.localStorage.setItem("path-admin-team-users-v1", JSON.stringify(teamUsers));
  }, [teamUsers]);

  useEffect(() => {
    if (!loggedIn) return;
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
    if (nextRoute !== "project") setSelectedProjectWorkstreamId(null);
    setMobileNavOpen(false);
  }

  function openProject(workstreamId?: string) {
    setSelectedItemId(null);
    setSelectedProjectWorkstreamId(workstreamId ?? null);
    setRoute("project");
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
    if (action === "update_status") {
      const currentState = item.sourceWorkstream?.itsmState;
      setStatusUpdate(item.kind === "commitment" ? "on_track" : item.kind === "coordination" ? "pending" : currentState === "pending_customer" || currentState === "pending_agency" || currentState === "blocked" ? "on_hold" : currentState === "resolved" || currentState === "closed" ? "fulfilled" : currentState === "submitted" || currentState === "triaged" ? "pending_review" : currentState ?? "in_progress");
    }
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
    await repository.hydrateFromSupabase();
    if (!allowsFixtureData()) setTeamUsers(persistedTeamUsers());
    const loaded = await loadRequestsForUser();
    const persona = makeAuthenticatedPersona(user.email ?? username, String(user.user_metadata?.full_name ?? user.email ?? "Authenticated User"), user.id);
    const permits = loaded.permits.length > 0 || !allowsFixtureData() ? loaded.permits : pecanIslandRequests;
    setLoadingData(false);
    setLoginError(loaded.error ? `Signed in, but the project queue could not be loaded: ${loaded.error.message}` : "");
    setCurrentPersona(persona);
    setProfileDraft(profileDraftForPersona(persona));
    setCurrentUser({ username: user.email ?? username, name: persona.name, agencyId: "spaceport", applicationIds: permits.map((item) => item.id), scenario: persona.role });
    setUserPermits(permits);
    setRoute("my-work");
  }

  async function handleDemoPersonaSelect(persona: DemoPersona) {
    setUsername(persona.email);
    setPassword(persona.password ?? DEMO_PASSWORD);
    setLoginError("");
    setLoadingData(false);
    // Remote hydration runs after the route changes so the demo picker remains responsive.
    const permits = (getOperationalPersona(persona).isCustomer && persona.email.startsWith("applicant.")
      ? userPermits
      : allowsFixtureData() ? pecanIslandRequests : []);
    const finalPermits = permits;
    setCurrentPersona(persona);
    setProfileDraft(profileDraftForPersona(persona));
    setCurrentUser({ username: persona.email, name: persona.name, agencyId: "spaceport", applicationIds: finalPermits.map((item) => item.id), scenario: `${persona.role} · ${persona.scenario}` });
    setUserPermits(permits);
    setSelectedItemId(null);
    setRoute("my-work");
    setLoadingData(false);
    setShowDemoPeople(false);
    const demoPassword = persona.password;
    if (supabaseConfigured() && demoPassword) {
      demoHydrationRef.current = (async () => {
        const { user, error } = await signInWithPassword(persona.email, demoPassword);
        if (error || !user) {
          setLoginError(error?.message ?? "Demo authentication failed. No production data was loaded.");
          return;
        }
        await repository.hydrateFromSupabase();
        const loaded = await loadRequestsForUser();
        const hydratedPermits = loaded.permits.length > 0 || !allowsFixtureData() ? loaded.permits : pecanIslandRequests;
        setUserPermits(hydratedPermits);
        setCurrentUser((current) => current ? { ...current, applicationIds: hydratedPermits.map((item) => item.id) } : current);
      })();
    }
  }

  async function signOut() {
    await signOutBrowser();
    setCurrentUser(null);
    setCurrentPersona(null);
    setUserPermits(allowsFixtureData() ? pecanIslandRequests : []);
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
      const result = await createRequestForUser({ title: `${preview.categoryLabel} request`, requestType: preview.detectedCategory, description: intakeText.trim(), file: intakeFile ?? undefined });
      if (result.error) {
        setIntakeStatus(result.error.message);
        return;
      }
    }
    setIntakeStatus(`Submitted to the ${preview.suggestedLeadAgency} triage queue.`);
    setIntakeText("");
    setIntakeFile(null);
    setRequestFile(null);
    setRequestFileInputKey((value) => value + 1);
  }

  async function triageCustomerRequest(request: CustomerRequestRecord) {
    const requestText = `${request.title} ${request.description}`.toLowerCase();
    const workstreamPlan = requestText.includes("heavy-haul") || requestText.includes("wetland") || requestText.includes("coastal")
      ? [
          ["DOTD", "Louisiana Department of Transportation and Development", "DOTD Road Access"],
          ["CPRA", "Coastal Protection and Restoration Authority", "CPRA Coastal Review"],
          ["USACE", "US Army Corps of Engineers (New Orleans District)", "USACE Wetlands Coordination"],
        ]
      : [[request.knownAgencyCode ?? "STATEPO", request.knownAgencyCode ?? "Louisiana Governor's Office of Major Projects & Delivery", request.title]];
    const baseCode = request.confirmationNumber.replace(/[^A-Z0-9]+/gi, "-").slice(-14);
    const result = await repository.triageCustomerRequestPersisted({
      requestId: request.id,
      workstreams: workstreamPlan.map(([orgCode, orgName, title]) => ({
        code: `WS-${orgCode}-${baseCode}`,
        title,
        category: request.requestType,
        permitTypeId: request.knownPermitTypeId,
        leadOrgCode: orgCode,
        leadOrgName: orgName,
      })),
    });
    if (result.error || !result.data) {
      setToast(`Triage failed: ${result.error?.message ?? "the database did not confirm the workstreams"}`);
      return;
    }
    setToast(`${workstreamPlan.length} workstream${workstreamPlan.length === 1 ? "" : "s"} created from ${request.confirmationNumber}.`);
    setMutationVersion((value) => value + 1);
  }

  function actorUserId() {
    return userIdForPersona(activePersona.id);
  }

  async function submitCustomerRequest(event: FormEvent<HTMLFormElement>, requestType: "permit_authorization" | "government_help" | "project_question" | "blocker_coordination" | "escalation") {
    event.preventDefault();
    if (!requestDescription.trim() && !requestTitle.trim()) return;
    if (demoHydrationRef.current) await demoHydrationRef.current;
    const inferredServiceType = requestTitle === "Project question" ? "project_question" : requestTitle === "Project blocker or coordination problem" ? "blocker_coordination" : requestTitle === "Concierge help" ? "concierge" : "government_help";
    const effectiveRequestType = requestType === "government_help" && requestCenterMode === "service" ? inferredServiceType : requestType;
    const selectedPermit = repository.getCatalog().find((permit) => permit.id === selectedCatalogPermitId);
    const requestResult = await repository.createCustomerRequestPersisted({
      projectId: projectRecord.id,
      requestType: effectiveRequestType,
      title: requestTitle.trim() || selectedPermit?.name || "Customer project request",
      description: requestDescription.trim() || requestOutcome.trim() || "Customer request submitted through PATH.",
      requestedOutcome: requestOutcome.trim() || undefined,
      locationOrAffectedArea: requestArea.trim() || undefined,
      desiredDate: requestDate || undefined,
      scheduleImportance: requestBlocksWork ? "critical" : "normal",
      knownAgencyCode: requestAgency || selectedPermit?.responsibleOrgCode,
      knownPermitTypeId: effectiveRequestType === "permit_authorization" ? selectedCatalogPermitId : undefined,
      submittedByUserId: actorUserId(),
      submittedByName: activePersona.name,
      relatedWorkstreamId: selectedPermit?.responsibleOrgCode === "CPRA" ? "WS-WETLANDS-PAD-A" : undefined,
      blocksActiveWork: requestBlocksWork,
      attachmentDocumentVersionIds: [],
      attachmentFile: requestFile ?? undefined,
    });
    if (requestResult.error || !requestResult.data) {
      setToast(`Request could not be saved: ${requestResult.error?.message ?? "the database did not confirm the submission"}`);
      return;
    }
    const request = requestResult.data;
    if (effectiveRequestType === "permit_authorization" && selectedPermit?.filingMode === "EXTERNAL_PORTAL") {
      const filingResult = await repository.createExternalFilingPersisted({
        projectId: projectRecord.id,
        workstreamId: request.relatedWorkstreamId ?? "WS-WETLANDS-PAD-A",
        permitTypeId: selectedPermit.id,
        authorityOrganizationId: selectedPermit.responsibleOrgId,
        authorityOrganizationName: selectedPermit.agencyContactName ? `${selectedPermit.responsibleOrgCode} · ${selectedPermit.agencyContactName}` : selectedPermit.responsibleOrgCode,
        filingMethod: selectedPermit.filingMode,
        officialPortalUrl: selectedPermit.officialFilingUrl,
        externalReferenceNumber: externalReference.trim() || undefined,
        externalRecordUrl: externalRecordUrl.trim() || undefined,
        externalStatus: externalStatus as "submitted" | "under_review" | "additional_information" | "approved" | "denied" | "closed" | "not_started" | "draft",
        submittedAt: requestDate || new Date().toISOString().slice(0, 10),
        submittedByUserId: actorUserId(),
        submittedByName: activePersona.name,
        lastStatusVerifiedAt: new Date().toISOString().slice(0, 10),
        lastStatusVerifiedBy: activePersona.name,
        authoritativeSystemName: selectedPermit.responsibleOrgCode,
        notes: "Manually tracked in PATH; the agency system remains authoritative.",
        receiptDocumentVersionIds: [],
      });
      if (filingResult.error) {
        setToast(`${request.confirmationNumber} was saved, but the external filing tracker could not be saved: ${filingResult.error.message}`);
        return;
      }
    }
    setRequestTitle("");
    setRequestOutcome("");
    setRequestDescription("");
    setRequestFile(null);
    setIntakeFile(null);
    setRequestFileInputKey((value) => value + 1);
    setExternalReference("");
    setExternalRecordUrl("");
    setRequestCenterMode("menu");
    setToast(`${request.confirmationNumber} submitted. The State Project Office triage queue was notified.`);
    setMutationVersion((value) => value + 1);
  }

  async function saveCustomerDraft() {
    if (!requestDescription.trim() && !requestTitle.trim()) return;
    const selectedPermit = repository.getCatalog().find((permit) => permit.id === selectedCatalogPermitId);
    const requestType = requestCenterMode === "escalation" ? "escalation" : requestTitle === "Project question" ? "project_question" : requestTitle === "Project blocker or coordination problem" ? "blocker_coordination" : requestTitle === "Concierge help" ? "concierge" : "government_help";
    const requestResult = await repository.createCustomerRequestPersisted({
      projectId: projectRecord.id,
      requestType,
      title: requestTitle.trim() || selectedPermit?.name || "Customer project request",
      description: requestDescription.trim() || requestOutcome.trim() || "Customer request draft.",
      requestedOutcome: requestOutcome.trim() || undefined,
      locationOrAffectedArea: requestArea.trim() || undefined,
      desiredDate: requestDate || undefined,
      scheduleImportance: requestBlocksWork ? "critical" : "normal",
      knownAgencyCode: requestAgency || selectedPermit?.responsibleOrgCode,
      knownPermitTypeId: undefined,
      submittedByUserId: actorUserId(),
      submittedByName: activePersona.name,
      relatedWorkstreamId: selectedPermit?.responsibleOrgCode === "CPRA" ? "WS-WETLANDS-PAD-A" : undefined,
      blocksActiveWork: requestBlocksWork,
      attachmentDocumentVersionIds: [],
      attachmentFile: requestFile ?? undefined,
      status: "draft",
    });
    if (requestResult.error || !requestResult.data) {
      setToast(`Draft could not be saved: ${requestResult.error?.message ?? "the database did not confirm the draft"}`);
      return;
    }
    const request = requestResult.data;
    setRequestFile(null);
    setIntakeFile(null);
    setRequestFileInputKey((value) => value + 1);
    setRequestCenterMode("menu");
    setToast(`${request.confirmationNumber} saved as a draft.`);
    setMutationVersion((value) => value + 1);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentProfile) return;
    setSaveStatus("saving");
    const result = await repository.updateProfilePersisted({ userId: currentProfile.userId, actorUserId: actorUserId(), updates: profileDraft, isAdmin: activePersona.workspace === "admin" });
    if (result.error || !result.data) {
      setSaveStatus("error");
      setProfileStatus(result.error?.message ?? "Only your own contact fields can be edited from this profile view.");
      return;
    }
    setSaveStatus("saved");
    setProfileStatus("Profile saved. Your updated contact details are now available to authorized project participants.");
    setToast("Profile updated.");
    setMutationVersion((value) => value + 1);
  }

  async function downloadVersion(documentId: string, versionId?: string) {
    const document = repository.getDocuments().find((entry) => entry.id === documentId);
    const version = (versionId ? document?.versions.find((entry) => entry.id === versionId) : null) ?? document?.versions[0];
    if (!document || !version) return;
    setSaveStatus("saving");
    const result = await downloadDocumentVersion(document, version, downloadDocumentFile);
    if (!result.success) {
      setSaveStatus("error");
      setToast(`Download failed: ${result.error?.message ?? "the document could not be retrieved"}`);
      return;
    }
    /* legacy fallback intentionally disabled
      const content = [
        `================================================================================`,
        `STATE OF LOUISIANA · EXECUTIVE PROJECT OFFICE · PATH VERIFIED DOCUMENT PACKAGE`,
        `================================================================================`,
        `Document Title: ${document.title}`,
        `File Name: ${version.fileName || "document.pdf"}`,
        `Version: ${version.versionTag || `v${document.currentVersionNumber}.0`}`,
        `Category: ${document.category.replaceAll("_", " ")}`,
        `Owner Organization: ${document.ownerOrgCode}`,
        `Uploaded By: ${version.uploadedByName} on ${formatDate(version.uploadedAt)}`,
        `SHA-256 Checksum: ${version.sha256Hash || "VERIFIED"}`,
        `Security Classification: Official Megaproject Record`,
        `--------------------------------------------------------------------------------`,
        `Interagency Review Certifications:`,
        ...(document.agencyReviews && document.agencyReviews.length > 0
          ? document.agencyReviews.map((r) => `  - ${r.reviewingOrgCode}: ${r.reviewStatus.toUpperCase()} (Reviewer: ${r.reviewedByName ?? r.reviewedByUserName ?? "Assigned Engineer"})`)
          : ["  - Verified by State Project Office"]),
        `================================================================================`,
      ].join("\n");
      const fallbackBlob = new Blob([content], { type: version.mimeType || "text/plain" });
      // The fallback blob was removed; a download is valid only after Storage verification.
      result = { success: true, error: null };
    }
    */
    setSaveStatus("saved");
    setToast(`Verified ${version.fileName} and started the download.`);
  }

  async function uploadProjectRevision(documentId: string, event: ChangeEvent<HTMLInputElement>, uploadedByOrgName = CUSTOMER_ORGANIZATION_NAME) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (demoHydrationRef.current) await demoHydrationRef.current;
    const document = repository.getDocuments().find((entry) => entry.id === documentId);
    if (!document) {
      setSaveStatus("error");
      setToast("Upload failed: the selected document is no longer available.");
      event.target.value = "";
      return;
    }
    setSaveStatus("saving");
    try {
      const versionNumber = document.currentVersionNumber + 1;
      const res = await mutateUploadDocumentVersion({
        documentId: document.id,
        documentTitle: document.title,
        versionNumber,
        versionLabel: `v${versionNumber}.0`,
        file,
        uploadedByName: activePersona.name,
        uploadedByOrgName,
        changeNotes: "Revision uploaded through the PATH document center.",
        reviewingAgencyCodes: ["DOTD", "CPRA"],
        projectId: document.projectId,
        actorId: actorUserId(),
      });

      if (res.data) {
        repository.createDocumentVersion(document.id, {
          id: res.data.id,
          versionNumber: res.data.versionNumber ?? versionNumber,
          versionLabel: res.data.versionLabel ?? `v${versionNumber}.0`,
          storagePath: res.data.storagePath || "",
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSizeBytes: file.size,
          sha256Hash: res.data.sha256Hash,
          uploadedByName: activePersona.name,
          uploadedByOrgName,
          changeNotes: "Revision uploaded through the PATH document center.",
          reviewingAgencyCodes: ["DOTD", "CPRA"],
        });
        setToast(`${res.data.versionLabel} uploaded to Supabase Storage. Agency review assignments were reset.`);
        setSaveStatus("saved");
        setLastSavedTime(new Date().toLocaleTimeString());
        setMutationVersion((value) => value + 1);
      } else {
        throw res.error ?? new Error("Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setSaveStatus("error");
      setToast(`Failed to upload document to Supabase Storage: ${err instanceof Error ? err.message : "unknown storage error"}`);
    }
    event.target.value = "";
  }

  async function uploadCustomerRevision(event: ChangeEvent<HTMLInputElement>) {
    const documentId = repository.getDocuments()[0]?.id;
    if (!documentId) return;
    await uploadProjectRevision(documentId, event, CUSTOMER_ORGANIZATION_NAME);
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
        notify(`${item.title} completed successfully.`);
        return;
      }
      const result = await repository.completeWorkstreamStagePersisted({
        workstreamId,
        completedChecklists: ["completeness_checklist_passed", "drainage_concurrence_received", "ecological_signoff", "public_comment_closed", "comment_response_package", "executive_director_signature", "reviewer_determination_recorded"],
        providedDocs: ["site_plans", "wetlands_delineation", "drainage_model", "mitigation_plan", "public_notice_text", "final_order_doc"],
        actorName,
        actorOrgName,
      });
      if (!result.success) {
        setDialogError(result.error?.message ?? "The workflow did not accept this transition.");
        return;
      }
      applyRepositoryWorkstream(item);
      notify(`Technical review completed. The next configured stage is ${result.nextStageName ?? "the next workflow stage"}.`);
      return;
    }

    if (dialog.action === "clear_blocker") {
      if (!workstreamId) {
        setDialogError("This work item is not connected to a configured workstream.");
        return;
      }
      const clearResult = await repository.clearWorkstreamBlockerPersisted({
        workstreamId,
        resolutionNotes: actionNote.trim(),
        actorName,
        actorOrgName,
      });
      if (clearResult.error || !clearResult.data) {
        setDialogError(clearResult.error?.message ?? "The blocker was not confirmed as cleared by the database.");
        return;
      }
      applyRepositoryWorkstream(item);
      notify(`Blocker cleared. ${item.workstreamTitle} has resumed active review.`);
      return;
    }

    if (dialog.action === "request_information") {
      if (!workstreamId || !questionText.trim()) {
        setDialogError("Tell the recipient what information is needed.");
        return;
      }
      const rfiResult = await repository.createRFIPersisted({
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
      if (rfiResult.error || !rfiResult.data) {
        setDialogError(rfiResult.error?.message ?? "The RFI was not confirmed by the database.");
        return;
      }
      const rfi = rfiResult.data;
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
        const rfiResult = await repository.createRFIPersisted({
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
        if (rfiResult.error || !rfiResult.data) {
          setDialogError(rfiResult.error?.message ?? "The RFI was not confirmed by the database.");
          return;
        }
        createdLabel = `RFI ${rfiResult.data.code}`;
      } else if (blockReason === "another_agency") {
        const coordination = await repository.createCoordinationRequestPersisted({
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
        if (coordination.error || !coordination.data) {
          setDialogError(coordination.error?.message ?? "The coordination request was not confirmed by the database.");
          return;
        }
        createdLabel = `Coordination Request ${coordination.data.code}`;
      }
      const blockedResult = await repository.markWorkstreamBlockedPersisted({ workstreamId, reason: blockNeed.trim(), waitingOn: target, actorName, actorOrgName, pauseClock: blockReason === "customer" || blockReason === "statutory" });
      if (blockedResult.error || !blockedResult.data) {
        setDialogError(blockedResult.error?.message ?? "The blocker was not confirmed by the database.");
        return;
      }
      applyRepositoryWorkstream(item);
      notify(`${createdLabel} committed. The blocker and supporting record are now part of the project history.`);
      return;
    }

    if (dialog.action === "escalate") {
      if (activePersona.isCustomer) {
        const escalationResult = await repository.createCustomerRequestPersisted({
          projectId: projectRecord.id,
          requestType: "escalation",
          title: `Escalation request · ${item.workstreamTitle}`,
          description: actionNote.trim() || `${escalationType} requested for ${item.workstreamTitle}.`,
          requestedOutcome: escalationType,
          locationOrAffectedArea: projectRecord.locationDescription,
          scheduleImportance: item.isCriticalPath ? "critical" : "normal",
          knownAgencyCode: item.ownerOrganization,
          submittedByUserId: actorUserId(),
          submittedByName: activePersona.name,
          relatedWorkstreamId: workstreamId,
          blocksActiveWork: item.isCriticalPath,
          attachmentDocumentVersionIds: [],
        });
        if (escalationResult.error || !escalationResult.data) {
          setDialogError(escalationResult.error?.message ?? "The escalation was not confirmed by the database.");
          return;
        }
        notify(`${escalationResult.data.confirmationNumber} submitted. The project office will acknowledge the escalation.`);
        return;
      }
      if (!workstreamId) {
        setDialogError("This work item is not connected to a configured workstream.");
        return;
      }
      const escalationResult = await repository.escalateWorkstreamPersisted({ workstreamId, problemType: escalationType, actorName, actorOrgName });
      if (!escalationResult.success) {
        setDialogError(escalationResult.error?.message ?? "The escalation was not confirmed by the database.");
        return;
      }
      notify(`Escalated to the configured next supervisor for ${item.workstreamTitle}.`);
      return;
    }

    if (dialog.action === "transfer") {
      if (!workstreamId) {
        setDialogError("This work item is not connected to a configured workstream.");
        return;
      }
      const transferResult = await repository.transferWorkstreamPersisted({ workstreamId, transferType, targetName: "Maya Chen", actorName, actorOrgName, note: actionNote.trim() });
      if (!transferResult.success) {
        setDialogError(transferResult.error?.message ?? "The transfer request was not confirmed by the database.");
        return;
      }
      notify("Help request recorded for supervisor review.");
      return;
    }

    if (dialog.action === "add_note") {
      if (!workstreamId || !actionNote.trim()) {
        setDialogError("Add a note before saving.");
        return;
      }
      const noteResult = await repository.addWorkstreamNotePersisted({ workstreamId, note: actionNote.trim(), actorName, actorOrgName });
      if (!noteResult.success) {
        setDialogError(noteResult.error?.message ?? "The note was not confirmed by the database.");
        return;
      }
      notify("Note added to the activity history.");
      return;
    }

    if (dialog.action === "update_status") {
      const statusLabel = statusUpdate.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
      if (item.kind === "workflow" || item.kind === "task" || item.kind === "customer_request") {
        const ticketType = item.kind === "workflow" ? "workstream" : item.kind;
        const ticketId = item.kind === "workflow" ? workstreamId : item.sourceId;
        if (!ticketId) {
          setDialogError("This item is not connected to an authoritative ticket record.");
          return;
        }
        const targetState: ITSMState = statusUpdate === "on_hold" ? "pending_agency" : statusUpdate === "pending_review" ? "triaged" : statusUpdate === "fulfilled" ? "resolved" : statusUpdate === "cancelled" ? "closed" : statusUpdate as ITSMState;
        const result = await repository.updateTicketITSMStatePersisted({
          ticketType,
          ticketId,
          targetState,
          actorName,
          actorUserId: actorUserId(),
          reason: actionNote.trim() || `Status changed to ${statusLabel}.`,
          pauseReason: ["pending_customer", "pending_agency", "blocked"].includes(targetState) ? actionNote.trim() || undefined : undefined,
        });
        if (result.error || !result.data) {
          setDialogError(result.error?.message ?? "The status change was not confirmed by the database.");
          return;
        }
        if (item.kind !== "customer_request") applyRepositoryWorkstream(item);
        notify(`Status updated to "${statusLabel}" for ${item.title}.`);
        return;
      }

      if (item.kind === "commitment") {
        const commitmentNewStatus = statusUpdate === "fulfilled" ? "fulfilled" as const : statusUpdate === "cancelled" ? "missed" as const : statusUpdate === "on_hold" ? "at_risk" as const : "on_track" as const;
        repository.updateCommitmentStatus(item.sourceId, commitmentNewStatus, actorName);
        notify(`Status updated to "${statusLabel}" for ${item.title}.`);
        return;
      }

      setDialogError("Coordination request status changes must be recorded through its response action.");
      return;
    }

    if (dialog.action === "advance_stage") {
      if (!workstreamId) {
        setDialogError("This work item is not connected to a configured workstream.");
        return;
      }
      const result = await repository.completeWorkstreamStagePersisted({
        workstreamId,
        completedChecklists: ["completeness_checklist_passed", "reviewer_determination_recorded"],
        providedDocs: ["required_documents_verified"],
        actorName,
        actorOrgName,
      });
      if (!result.success) {
        setDialogError(result.error?.message ?? "The workflow did not accept this transition.");
        return;
      }
      applyRepositoryWorkstream(item);
      notify(`Stage advanced. The next configured stage is ${result.nextStageName ?? "the next workflow stage"}.`);
      return;
    }

    if (dialog.action === "approve_document" || dialog.action === "approve_with_comments" || dialog.action === "request_revision") {
      if (!item.exactDocumentVersionId) {
        setDialogError("The exact document version could not be resolved.");
        return;
      }
      const decision = dialog.action === "request_revision" ? "revision_requested" : dialog.action === "approve_with_comments" ? "approved_with_conditions" : "approved";
      const review = await repository.reviewDocumentVersionPersisted({ versionId: item.exactDocumentVersionId, agencyCode: activePersona.agencyCode.split(" /")[0], decision, actorName, comments: actionNote.trim() || `${actionLabel(dialog.action)} recorded for ${item.exactDocumentVersionLabel}.` });
      if (!review.success) {
        setDialogError(review.error?.message ?? "The exact document version is not assigned to your agency.");
        return;
      }
      notify(`${item.exactDocumentVersionLabel} decision saved against the exact version.`);
      return;
    }

    if (dialog.action === "accept_rfi_response") {
      if (!item.sourceRfi) return;
      const accepted = await repository.acceptRfiResponsePersisted({ rfiId: item.sourceRfi.id, actorName, actorOrgName, notes: actionNote.trim() });
      if (!accepted.success) {
        setDialogError(accepted.error?.message ?? "The RFI response could not be accepted.");
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
      const clarificationResult = await repository.createRFIPersisted({
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
      if (clarificationResult.error || !clarificationResult.data) {
        setDialogError(clarificationResult.error?.message ?? "The clarification RFI was not confirmed by the database.");
        return;
      }
      notify(`${clarificationResult.data.code} created for clarification.`);
      return;
    }

    if (dialog.action === "respond") {
      if (!item.sourceRfi || !actionNote.trim()) {
        setDialogError("Add the response before submitting.");
        return;
      }
      const response = await repository.submitRfiResponsePersisted({ rfiId: item.sourceRfi.id, submittedByName: actorName, responseText: actionNote.trim(), actorOrgName });
      if (response.error || !response.data) {
        setDialogError(response.error?.message ?? "The response could not be submitted.");
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
      <div id="login-shell" data-hydrated={hydrated ? "true" : "false"} className="min-h-screen bg-[#f3f6f7] text-[#172033]">
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
                <div><Label htmlFor="username">Email address / username</Label><Input ref={usernameRef} id="username" name="username" type="text" value={username} required onChange={(event) => { setUsername(event.target.value); setLoginError(""); }} className="mt-1 h-11" placeholder="jordan.lee@la.gov" /></div>
                <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" value={password} required onChange={(event) => { setPassword(event.target.value); setLoginError(""); }} className="mt-1 h-11" placeholder="demo1234" /></div>
                <Button id="login-submit" type="submit" disabled={loadingData} className="h-11 w-full bg-[#00284d] font-bold hover:bg-[#003c70]">{loadingData ? "Signing in…" : "Sign In"}<ArrowRight className="size-4" aria-hidden="true" /></Button>
              </form>
              {loginError && <p id="login-error" role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">{loginError}</p>}
              <div className="border-t border-slate-100 pt-4">
                <Button id="demo-login-trigger" type="button" variant="outline" className="w-full justify-between border-teal-300 bg-teal-50 font-bold text-teal-950" onClick={() => setShowDemoPeople((value) => !value)}><span className="flex items-center gap-2"><Sparkles className="size-4 text-teal-700" aria-hidden="true" /> Quick Demo Sign-In</span><ChevronDown className={`size-4 transition-transform ${showDemoPeople ? "rotate-180" : ""}`} aria-hidden="true" /></Button>
                {showDemoPeople && <div className="mt-3 space-y-2" aria-label="Demo personas">
                  {demoPersonas.map((persona) => <button key={persona.id} id={`demo-persona-${demoPersonaDomId(persona)}`} type="button" onClick={() => void handleDemoPersonaSelect(persona)} className="flex w-full items-start justify-between rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-teal-500 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><span><span className="block text-sm font-black text-[#00284d]">{persona.name}</span><span className="block text-xs font-semibold text-slate-500">{persona.role}</span></span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">{persona.badge}</span></button>)}
                </div>}
              </div>
              <p className="text-xs leading-5 text-slate-500"><strong className="text-slate-700">Demo:</strong> use the persona picker for the reviewer, supervisor, customer, and applicant scenarios. Official statutory filings remain in the authoritative agency systems.</p>
            </CardContent>
          </Card>
        </main>
        <SystemVersionFooter />
      </div>
    );
  }

  const canAdmin = activePersona.workspace === "admin" || activePersona.workspace === "supervisor" || activePersona.workspace === "state_office";
  const primaryNav: Array<{ id: Route; label: string; icon: ReactNode; count?: number }> = activePersona.isCustomer
    ? [{ id: "project", label: "Home / Project overview", icon: <Building2 className="size-4" /> }, { id: "my-work", label: "My actions", icon: <LayoutList className="size-4" />, count: queueGroups[0]?.items.length }, { id: "requests", label: "Requests & permits", icon: <FilePlus2 className="size-4" /> }, { id: "schedule", label: "Schedule", icon: <CalendarClock className="size-4" /> }, { id: "documents", label: "Documents", icon: <FileCheck2 className="size-4" /> }, { id: "contacts", label: "Contacts", icon: <Users className="size-4" /> }, { id: "help", label: "Help & escalation", icon: <ShieldAlert className="size-4" /> }, { id: "notifications", label: "Notifications", icon: <Bell className="size-4" /> }]
    : [{ id: "my-work", label: "My Work", icon: <LayoutList className="size-4" />, count: queueGroups[0]?.items.length }, { id: "agency-queue", label: activePersona.workspace === "supervisor" ? "Supervisor queue" : "My agency queue", icon: <Building2 className="size-4" /> }, { id: "rfis", label: "RFIs", icon: <HelpCircle className="size-4" /> }, { id: "coordination", label: "Coordination requests", icon: <Users className="size-4" /> }, { id: "documents", label: "Documents to review", icon: <FileCheck2 className="size-4" /> }, { id: "project", label: "Project", icon: <Route className="size-4" /> }, { id: "notifications", label: "Notifications", icon: <Bell className="size-4" /> }];

  function renderWorkCard(item: OperationalWorkItem) {
    const tone = toneClasses(item.statusTone);
    const actions = getAvailableActions(item, activePersona);
    const compactActions = actions.filter((action) => ["mark_blocked", "request_information", "respond", "accept_rfi_response", "approve_document"].includes(action)).slice(0, 1);
    const assignmentGroupLabel = item.assignmentGroupName ?? (item.ownerOrganization === "DOTD"
      ? "DOTD Heavy-Haul & Bridges"
      : item.ownerOrganization === "LDEQ"
      ? "LDEQ Water Quality"
      : item.ownerOrganization === "CPRA"
      ? "CPRA Coastal Use & Mitigation"
      : item.ownerOrganization === "VERMILION"
      ? "Vermilion Parish Permitting"
      : item.ownerOrganization === "OSFM"
      ? "OSFM Safety & Cryogenics"
      : "State Office Triage Queue");
    const priorityLabel = item.priority ?? (item.isCriticalPath ? "P1" : "P3");

    return <article key={item.id} className={`rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md ${tone.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className={`mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg ${tone.badge}`}>{kindIcon(item)}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] font-bold">
              <span className="text-slate-500">{item.id} · {item.kind}</span>
              {!activePersona.isCustomer && <span className="rounded bg-teal-50 border border-teal-200 px-1.5 py-0.2 text-[10px] font-sans font-bold text-teal-800">
                Group: {assignmentGroupLabel}
              </span>}
              <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.2 text-[10px] font-sans font-bold text-slate-700">
                Customer: SpaceX
              </span>
              <span className={`rounded px-1.5 py-0.2 text-[10px] font-sans font-black ${item.isCriticalPath ? "bg-red-100 text-red-800 border border-red-200" : "bg-blue-50 text-blue-800 border border-blue-200"}`}>
                {priorityLabel} {item.isCriticalPath ? "Critical Path" : "Standard"}
              </span>
            </div>
            <h3 className="mt-1 text-lg font-black leading-tight text-[#00284d]">{item.title}</h3>
            <button type="button" onClick={(e) => { e.stopPropagation(); openProject(item.workstreamId); }} className="mt-1 text-sm font-semibold text-slate-600 hover:text-teal-800 hover:underline text-left cursor-pointer transition-colors" title="View in project page">{item.workstreamTitle}</button>
            {item.sourceWorkstream && <WorkflowMiniStepper source={item.sourceWorkstream} templates={repository.getWorkflowTemplates()} customerSafe={activePersona.isCustomer} />}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black uppercase ${tone.badge}`}><span className={`size-1.5 rounded-full ${tone.dot}`} />{item.statusLabel}</span>
      </div>
      <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Why you’re seeing this</p><p className="mt-1 text-sm leading-5 text-slate-700">{item.whyHere}</p></div>
        <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">What you need to do</p><p className="mt-1 text-sm font-semibold leading-5 text-[#00284d]">{item.whatToDo}</p></div>
      </div>
      {item.sourceRfi && <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-800"><p><strong>{activePersona.isCustomer ? "Exact request" : "RFI question"}:</strong> {item.sourceRfi.questionText}</p>{!activePersona.isCustomer && item.sourceRfi.responses?.filter((response) => response.responseText).map((response) => <p key={response.id} className="border-t border-slate-200 pt-2"><strong>Exact applicant response:</strong> {response.responseText}</p>)}</div>}
      <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-xs sm:grid-cols-4">
        <div><p className="font-black uppercase tracking-wider text-slate-500">Due</p><p className="mt-1 font-bold text-slate-800">{formatDate(item.dueDate)}</p></div>
        <div><p className="font-black uppercase tracking-wider text-slate-500">Age / wait</p><p className="mt-1 font-bold text-slate-800">{item.waitLabel ?? item.ageLabel}</p></div>
        <div><p className="font-black uppercase tracking-wider text-slate-500">Schedule impact</p><p className="mt-1 font-bold text-slate-800">{item.scheduleImpact}</p></div>
        <div><p className="font-black uppercase tracking-wider text-slate-500">Next handoff</p><p className="mt-1 font-bold text-teal-800">{item.nextHandoff ?? "Configured by workflow"}</p></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <p className="max-w-xl text-xs text-slate-600"><strong className="text-slate-800">Removes from your queue:</strong> {item.removesFromQueue}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => openItem(item)} className="bg-[#00284d] text-xs font-bold hover:bg-[#003c70]">
            Open Work & Workflow <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" onClick={() => openProject(item.workstreamId)} className="text-xs font-bold text-teal-800 hover:bg-teal-50" title="Open project page">
            <Building2 className="size-3.5 mr-1" /> Project
          </Button>
          {compactActions.map((action) => {
            const isActionPermitted = isAdministrator(activePersona) || canUserPerformAction(item, action, activePersona);
            return isActionPermitted ? (
              <Button key={action} type="button" variant="outline" onClick={() => openAction(item, action)} className="text-xs font-bold">
                {actionIcon(action)}{actionLabel(action)}
              </Button>
            ) : (
              <Button
                key={action}
                type="button"
                variant="outline"
                disabled={true}
                title="Action disabled: Requires Administrator authority or item assignment."
                className="text-xs font-bold opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200"
              >
                {actionIcon(action)}{actionLabel(action)}
              </Button>
            );
          })}
        </div>
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

  function renderQueueFilters() {
    const groups = repository.getAssignmentGroups();
    const hasFilters = Boolean(queueSearch || queueKind !== "all" || queueState !== "all" || queueGroup !== "all");
    return <section aria-label="Queue filters" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))] lg:grid-cols-[minmax(0,1.8fr)_repeat(3,minmax(0,1fr))]"><div><Label htmlFor="queue-search">Search work</Label><Input id="queue-search" value={queueSearch} onChange={(event) => setQueueSearch(event.target.value)} placeholder="Ticket, title, owner, or agency" className="mt-1" /></div><div><Label htmlFor="queue-kind">Type</Label><select id="queue-kind" value={queueKind} onChange={(event) => setQueueKind(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"><option value="all">All work types</option><option value="workflow">Workflow</option><option value="task">Task</option><option value="customer_request">Customer request</option><option value="rfi">RFI</option><option value="coordination">Coordination</option><option value="document">Document</option><option value="commitment">Commitment</option></select></div><div><Label htmlFor="queue-state">ITSM state</Label><select id="queue-state" value={queueState} onChange={(event) => setQueueState(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"><option value="all">All states</option>{(["draft", "submitted", "triaged", "in_progress", "pending_customer", "pending_agency", "blocked", "resolved", "closed"] as ITSMState[]).map((state) => <option key={state} value={state}>{state.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}</option>)}</select></div>{!activePersona.isCustomer && <div><Label htmlFor="queue-group">Assignment group</Label><select id="queue-group" value={queueGroup} onChange={(event) => setQueueGroup(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"><option value="all">All assignment groups</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>}</div>{hasFilters && <Button type="button" variant="ghost" onClick={() => { setQueueSearch(""); setQueueKind("all"); setQueueState("all"); setQueueGroup("all"); }} className="mt-3 px-0 text-xs font-bold text-teal-800 hover:bg-transparent hover:text-teal-950">Clear filters</Button>}</section>;
  }

  function renderMyWork() {
    return <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Your operational queue</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#00284d] outline-none sm:text-4xl">My Work</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Prioritized actions for {activePersona.name}. Open an item to inspect the assignment, modify workflow stages, see required inputs, and preview handoffs.</p>
        </div>
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-right">
          <p className="text-xs font-black uppercase text-teal-800">Workspace & Agency</p>
          <p className="mt-1 text-sm font-black text-teal-950">{workspaceTitle(activePersona.workspace)}</p>
          <p className="text-xs font-bold text-teal-800">{activePersona.agencyCode}</p>
         </div>
      </div>
      {renderQueueFilters()}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="My Work summary">
        {queueGroups.map((group) => <button key={group.id} type="button" onClick={() => document.getElementById(`queue-${group.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-teal-400 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{queueLabel(group)}</p><p className="mt-1 text-2xl font-black text-[#00284d]">{group.items.length}</p></button>)}
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><Info className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden="true" /><div><p className="font-black text-[#00284d]">Start here</p><p className="mt-1 text-sm text-slate-600">The queue is prioritized by critical-path impact, due date, blockers, and handoff readiness. Waiting items stay visible without looking like failed work.</p></div></div></section>
      <div className="space-y-7">{queueGroups.map((group) => <section id={`queue-${group.id}`} key={group.id} className="scroll-mt-28"><div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="text-lg font-black text-[#00284d]">{queueLabel(group)} <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">{group.items.length}</span></h2><p className="mt-1 text-sm text-slate-500">{group.description}</p></div>{group.id === "needs_action" && <span className="text-xs font-bold uppercase tracking-wider text-teal-800">Priority order</span>}</div>{group.items.length > 0 ? <div className="space-y-3">{group.items.map(renderWorkCard)}</div> : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">Nothing in this section right now.</div>}</section>)}</div>
      {activePersona.isCustomer && <form onSubmit={handleIntakeSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 size-5 text-teal-700" aria-hidden="true" /><div className="flex-1"><h2 className="font-black text-[#00284d]">Ask the project office for something</h2><p className="mt-1 text-sm text-slate-600">Describe the need in plain language. PATH will suggest the lead agency and send it to the triage queue.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={intakeText} onChange={(event) => setIntakeText(event.target.value)} placeholder="We need a heavy-haul route review for oversized trailers…" aria-label="Describe a project need" /><Button id="intake-submit-btn" type="submit" className="bg-[#00284d] font-bold">Submit request <Send className="size-4" aria-hidden="true" /></Button></div>{intakePreview && <p role="status" aria-live="polite" className="mt-3 rounded-lg bg-teal-50 p-3 text-sm font-bold text-teal-950">Suggested route: {intakePreview.categoryLabel} → {intakePreview.suggestedLeadAgency} · {intakePreview.priority.toUpperCase()}</p>}{intakeStatus && <p role="status" aria-live="polite" className="mt-2 text-sm font-bold text-teal-800">{intakeStatus}</p>}</div></div></form>}
    </div>;
  }

  function renderQueue(routeKind: Route) {
    const filtered = routeKind === "rfis" ? activeQueueItems.filter((item) => item.kind === "rfi") : routeKind === "coordination" ? activeQueueItems.filter((item) => item.kind === "coordination") : routeKind === "documents" ? activeQueueItems.filter((item) => item.kind === "document") : activeQueueItems;
    const title = routeKind === "rfis" ? "RFIs" : routeKind === "coordination" ? "Coordination Requests" : routeKind === "documents" ? "Documents to Review" : activePersona.workspace === "supervisor" ? "Supervisor Queue" : "My Agency Queue";
    return <div className="space-y-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Operational queue</p><h1 className="mt-2 text-3xl font-black text-[#00284d] outline-none">{title}</h1><p className="mt-2 text-sm text-slate-600">Every item below explains its owner, due date, and the next action available to you.</p></div>{renderQueueFilters()}{filtered.length > 0 ? <div className="space-y-3">{filtered.map(renderWorkCard)}</div> : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">No items are currently routed to this queue.</div>}</div>;
  }

  function renderCustomerOverview() {
    const filings = repository.getExternalFilings();
    const catalog = repository.getCatalog();
    return <div className="space-y-6">
      <section className="rounded-2xl border border-teal-300 bg-white p-6 shadow-md sm:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-teal-800">Customer project command center</p><button type="button" onClick={() => openProject()} className="mt-2 text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-lg" title="Open authoritative project page"><h1 className="max-w-4xl text-3xl font-black tracking-tight text-[#00284d] group-hover:text-teal-900 group-hover:underline sm:text-4xl">SpaceX Pecan Island Launch Complex</h1></button><p className="mt-2 text-sm font-semibold text-slate-600">{projectRecord.code} · {projectRecord.locationDescription}</p></div><div className="flex items-center gap-2"><span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-black uppercase text-amber-900">Overall health · {projectOverview.healthLabel}</span><Button type="button" size="sm" onClick={() => openProject()} className="bg-[#00284d] hover:bg-[#003c70] text-xs font-bold gap-1.5"><Building2 className="size-3.5" /> Project Page</Button></div></div><div className="mt-7 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-5"><div><p className="text-[11px] font-black uppercase text-slate-500">Project stage</p><p className="mt-1 text-sm font-black text-[#00284d]">{projectOverview.stage}</p></div><div><p className="text-[11px] font-black uppercase text-slate-500">Baseline launch</p><p className="mt-1 text-sm font-black text-[#00284d]">{formatDate(projectOverview.baseline)}</p></div><div><p className="text-[11px] font-black uppercase text-slate-500">Current forecast</p><p className="mt-1 text-sm font-black text-[#00284d]">{formatDate(projectOverview.forecast)}</p></div><div><p className="text-[11px] font-black uppercase text-slate-500">Variance</p><p className="mt-1 text-sm font-black text-rose-700">+{projectOverview.varianceDays} days</p></div><div><p className="text-[11px] font-black uppercase text-slate-500">Location</p><p className="mt-1 text-sm font-black text-[#00284d]">{projectRecord.parish}, Louisiana</p></div></div></section>
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base font-black text-[#00284d]"><Gauge className="size-4 text-teal-700" /> Schedule summary</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-600">{projectOverview.criticalPathCount} critical-path workstreams · {projectOverview.blockedWorkstreamCount} waiting or blocked</p><p className="mt-3 text-sm font-black text-[#00284d]">Next milestone: {projectOverview.nextMilestone.title}</p><p className="mt-1 text-xs text-slate-500">{formatDate(projectOverview.nextMilestone.date)} · {projectOverview.nextMilestone.owner}</p><Button type="button" onClick={() => navigate("schedule")} className="mt-4 w-full bg-[#00284d] text-xs font-bold">Open Schedule <ArrowRight className="size-3.5" /></Button></CardContent></Card>{projectOverview.customerActions.map((action) => <Card key={action.label}><CardHeader><CardTitle className="text-base font-black text-[#00284d]">{action.label}</CardTitle></CardHeader><CardContent><p className="text-3xl font-black text-teal-800">{action.count}</p><p className="mt-1 text-xs text-slate-500">{action.detail}</p><Button type="button" variant="outline" onClick={() => navigate(action.label.includes("Documents") ? "documents" : "requests")} className="mt-4 w-full text-xs font-bold">View details</Button></CardContent></Card>)}</section>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Building2 className="size-5 text-teal-700" /> Government workstreams</CardTitle><p className="text-sm text-slate-600">Customer-visible stage, next milestone, owner, and whether SpaceX action is required.</p></CardHeader><CardContent className="space-y-3">{projectOverview.governmentActions.map((action) => <button key={action.title} type="button" onClick={() => openProject(action.id)} className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-teal-500 hover:bg-teal-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 group cursor-pointer"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black text-[#00284d] group-hover:text-teal-900">{action.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">{action.agency} · {action.stage}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${action.customerAction.toLowerCase() !== "none" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{action.customerAction.toLowerCase() !== "none" ? "SpaceX action" : "Government-led"}</span></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600"><span>Target {formatDate(action.targetDate)}</span><span>Next: {action.stage}</span><span className="ml-auto font-bold text-teal-800 group-hover:underline">View in project →</span></div></button>)}</CardContent></Card><div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><ShieldAlert className="size-5 text-amber-700" /> Critical path and blockers</CardTitle></CardHeader><CardContent className="space-y-3">{projectOverview.blockers.length > 0 ? projectOverview.blockers.map((blocker) => <div key={blocker.title} className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-black text-amber-950">{blocker.title}</p><p className="mt-1 text-xs text-amber-900">Responsible: {blocker.owner} · {blocker.impact}</p><p className="mt-1 text-xs text-amber-800">Expected resolution: {blocker.expectedResolution}</p></div>) : <p className="text-sm text-slate-600">No active blockers are reported.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><CalendarDays className="size-5 text-teal-700" /> Upcoming events and decisions</CardTitle></CardHeader><CardContent className="space-y-3">{projectOverview.upcomingEvents.length > 0 ? projectOverview.upcomingEvents.map((event) => <div key={`${event.type}-${event.title}`} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0"><div className="rounded-lg bg-teal-50 p-2 text-center text-[10px] font-black uppercase text-teal-800">{formatDate(event.date)}</div><div><p className="text-sm font-black text-[#00284d]">{event.title}</p><p className="mt-1 text-xs text-slate-500">{event.type} · {event.detail}</p></div></div>) : <p className="text-sm text-slate-600">No upcoming events have been published.</p>}</CardContent></Card></div></div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><FileText className="size-5 text-teal-700" /> Permit and authorization portfolio</CardTitle><p className="text-sm text-slate-600">PATH workflow status and authoritative external filing status are shown separately.</p></CardHeader><CardContent className="space-y-3">{catalog.map((permit) => { const filing = filings.find((entry) => entry.permitTypeId === permit.id); const request = userPermits.find((entry) => entry.leadAgencyCode.includes(permit.responsibleOrgCode)); return <div key={permit.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-black text-[#00284d]">{permit.name}</p><p className="mt-1 text-xs font-semibold text-slate-500">{permit.responsibleOrgCode} · {request?.title ?? "Catalog authorization"} · {filingModeLabel(permit.filingMode)}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-700">PATH: {request?.statusLabel ?? "Not started"}</span></div><div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-4"><span>External ref: <strong>{filing?.externalReferenceNumber ?? "Not recorded"}</strong></span><span>External status: <strong>{filing?.externalStatus?.replaceAll("_", " ") ?? "Not filed"}</strong></span><span>Submitted: <strong>{formatDate(filing?.submittedAt)}</strong></span><span>Decision target: <strong>{formatDate(request?.targetDate)}</strong></span></div><div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs"><p className="font-black uppercase tracking-wider text-slate-500">Verified resources</p><div className="mt-2 flex flex-wrap gap-2">{(permit.resources ?? []).slice(0, 3).map((resource) => <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer" className="font-bold text-teal-800 underline-offset-2 hover:underline">{resource.resourceName} · {resource.versionTag}</a>)}</div></div><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => { setSelectedCatalogPermitId(permit.id); setRequestCenterMode("permit"); navigate("requests"); }} className="text-xs font-bold">Open permit details</Button>{permit.officialFilingUrl && <a href={permit.officialFilingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">Official filing site <ExternalLink className="size-3.5" /></a>}</div></div>; })}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><UserRound className="size-5 text-teal-700" /> Project contacts</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Your State concierge, lead agencies, SpaceX team, and customer-visible reviewers are in one directory.</p><Button type="button" onClick={() => navigate("contacts")} className="bg-[#00284d] text-xs font-bold">Open Contact Directory</Button></CardContent></Card>
    </div>;
  }

  function renderCustomerRequestCenter() {
    const catalog = repository.getCatalog();
    const permit = catalog.find((entry) => entry.id === selectedCatalogPermitId) ?? catalog[0];
    // The request repository is already scoped by Supabase RLS; production
    // auth ids are UUIDs while demo personas use stable fixture ids.
    const recent = repository.getCustomerRequests();
    const choice = (label: string, detail: string, icon: ReactNode, onClick: () => void) => <button type="button" onClick={onClick} className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-teal-400 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><span className="flex size-10 items-center justify-center rounded-lg bg-teal-50 text-teal-800">{icon}</span><span className="mt-4 block text-base font-black text-[#00284d]">{label}</span><span className="mt-1 block text-sm leading-6 text-slate-600">{detail}</span></button>;
    return <div className="space-y-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Customer intake</p><h1 className="mt-2 text-3xl font-black text-[#00284d] outline-none">Requests & permits</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Start with the outcome you need. PATH creates a trackable request, routes it to the State Project Office, and keeps authoritative agency filings clearly identified.</p></div>{requestCenterMode === "menu" && <><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{choice("Submit / track a permit or authorization", "Select an authorization, review prerequisites and official resources, then create a PATH tracking record.", <FilePlus2 className="size-5" />, () => setRequestCenterMode("permit"))}{choice("Request government help / service", "Tell the project office the service or outcome you need, including date and schedule impact.", <HelpCircle className="size-5" />, () => { setRequestTitle("Government service request"); setRequestCenterMode("service"); })}{choice("Ask a project question", "Send a structured question to the project office with the context needed for a useful answer.", <MessageSquare className="size-5" />, () => { setRequestTitle("Project question"); setRequestCenterMode("service"); })}{choice("Report a blocker / coordination problem", "Identify what is blocked, who may need to act, and the date that matters.", <AlertOctagon className="size-5" />, () => { setRequestTitle("Project blocker or coordination problem"); setRequestBlocksWork(true); setRequestCenterMode("service"); })}{choice("Request escalation", "Ask for assistance when a critical-path risk or delayed dependency needs project-office attention.", <ShieldAlert className="size-5" />, () => setRequestCenterMode("escalation"))}{choice("I'm not sure what I need", "Use the PATH concierge to describe the situation in plain English and receive a suggested route.", <Sparkles className="size-5" />, () => { setRequestCenterMode("service"); setRequestTitle("Concierge help"); })}</div><Card><CardHeader><CardTitle className="text-lg font-black text-[#00284d]">Track my PATH requests</CardTitle></CardHeader><CardContent className="space-y-3">{recent.length > 0 ? recent.map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div><p className="text-sm font-black text-[#00284d]">{request.confirmationNumber} · {request.title}</p><p className="mt-1 text-xs text-slate-500">{request.status.replaceAll("_", " ")} · {request.description}</p></div><span className="text-xs font-bold text-teal-800">{formatDate(request.updatedAt)}</span></div>) : <p className="text-sm text-slate-600">No requests submitted from this profile yet.</p>}</CardContent></Card></>}{requestCenterMode === "permit" && permit && <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-lg font-black text-[#00284d]">Permit / authorization submission wizard</CardTitle><p className="mt-1 text-sm text-slate-600">Step 2 of 6 · Choose the authorization from the verified catalog.</p></div><Button type="button" variant="outline" onClick={() => setRequestCenterMode("menu")} className="text-xs font-bold">Back to request choices</Button></div></CardHeader><CardContent className="space-y-5"><div><Label htmlFor="permit-catalog">Authorization or permit</Label><select id="permit-catalog" value={permit.id} onChange={(event) => setSelectedCatalogPermitId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">{catalog.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.responsibleOrgCode}</option>)}</select></div><div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><div><p className="text-xs font-black uppercase text-slate-500">What triggers it</p><p className="mt-1 text-slate-700">{permit.triggerExplanation}</p></div><div><p className="text-xs font-black uppercase text-slate-500">Expected duration</p><p className="mt-1 text-slate-700">{permit.expectedLeadTimeDays} days · statutory minimum {permit.minimumStatutoryDays} days</p></div><div><p className="text-xs font-black uppercase text-slate-500">Prerequisites</p><p className="mt-1 text-slate-700">{permit.prerequisites.join(" · ")}</p></div><div><p className="text-xs font-black uppercase text-slate-500">Agency contact</p><p className="mt-1 text-slate-700">{permit.agencyContactName ?? permit.responsibleOrgCode} · {permit.agencyContactEmail ?? "Contact through official portal"}</p></div></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-black text-amber-950">Filing method: {filingModeLabel(permit.filingMode)}</p><p className="mt-1 text-sm leading-6 text-amber-900">{permit.filingMode === "EXTERNAL_PORTAL" ? `This application is submitted in the authoritative ${permit.responsibleOrgCode} system. PATH will track it as part of the SpaceX project.` : "PATH will show the next supported submission step before filing."}</p>{permit.officialFilingUrl && <a href={permit.officialFilingUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#00284d] px-3 py-2 text-xs font-bold text-white">Open official filing site <ExternalLink className="size-3.5" /></a>}</div><form onSubmit={(event) => submitCustomerRequest(event, "permit_authorization")} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="permit-request-title">PATH tracking title</Label><Input id="permit-request-title" value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} placeholder={permit.name} required /></div><div><Label htmlFor="permit-submission-date">Submission date</Label><Input id="permit-submission-date" type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} /></div></div><div><Label htmlFor="permit-request-description">Supporting context and requested outcome</Label><textarea id="permit-request-description" value={requestDescription} onChange={(event) => setRequestDescription(event.target.value)} rows={4} required className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm" placeholder="Describe the project scope, filing intent, and any known prerequisites." /></div>{permit.filingMode === "EXTERNAL_PORTAL" && <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="external-reference">External case / application number</Label><Input id="external-reference" value={externalReference} onChange={(event) => setExternalReference(event.target.value)} placeholder="Enter after filing" /></div><div><Label htmlFor="external-record-url">External record URL</Label><Input id="external-record-url" type="url" value={externalRecordUrl} onChange={(event) => setExternalRecordUrl(event.target.value)} placeholder="https://..." /></div><div><Label htmlFor="external-status">Authoritative external status</Label><select id="external-status" value={externalStatus} onChange={(event) => setExternalStatus(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="additional_information">Additional information requested</option></select></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">PATH does not scrape or synchronize this system. Status is manually verified by a project participant.</div></div>}<Button type="submit" className="bg-[#00284d] font-bold">Create PATH tracking record <Send className="size-4" /></Button></form></CardContent></Card>}{(requestCenterMode === "service" || requestCenterMode === "escalation") && <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-lg font-black text-[#00284d]">{requestCenterMode === "escalation" ? "Request escalation / assistance" : "Project help request"}</CardTitle><p className="mt-1 text-sm text-slate-600">Complete the structured intake so the right team can respond without a follow-up round trip.</p></div><Button type="button" variant="outline" onClick={() => setRequestCenterMode("menu")} className="text-xs font-bold">Back to request choices</Button></div></CardHeader><CardContent><form onSubmit={(event) => submitCustomerRequest(event, requestCenterMode === "escalation" ? "escalation" : "government_help")} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="request-title">Request title</Label><Input id="request-title" value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} placeholder="What do you need?" required /></div><div><Label htmlFor="request-agency">Known agency (optional)</Label><Input id="request-agency" value={requestAgency} onChange={(event) => setRequestAgency(event.target.value)} placeholder="DOTD, CPRA, LDEQ..." /></div><div><Label htmlFor="request-outcome">Requested outcome</Label><Input id="request-outcome" value={requestOutcome} onChange={(event) => setRequestOutcome(event.target.value)} placeholder="A decision, meeting, review, or referral" /></div><div><Label htmlFor="request-date">Desired date</Label><Input id="request-date" type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} /></div></div><div><Label htmlFor="request-area">Location / affected area</Label><Input id="request-area" value={requestArea} onChange={(event) => setRequestArea(event.target.value)} /></div><div><Label htmlFor="request-description">Describe the situation</Label><textarea id="request-description" value={requestDescription} onChange={(event) => setRequestDescription(event.target.value)} rows={5} required className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm" placeholder={requestCenterMode === "escalation" ? "Describe the critical-path risk, delayed dependency, or assistance needed." : "Include the context the project office needs to respond."} /></div><label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3"><input type="checkbox" checked={requestBlocksWork} onChange={(event) => setRequestBlocksWork(event.target.checked)} className="mt-1 size-4 accent-teal-700" /><span><span className="block text-sm font-bold text-[#00284d]">This blocks active project work</span><span className="block text-xs text-slate-500">Use this to help triage urgency; PATH will not infer a legal determination.</span></span></label><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={saveCustomerDraft}>Save draft</Button><Button type="submit" className="bg-[#00284d] font-bold">Submit request <Send className="size-4" /></Button></div></form></CardContent></Card>}</div>;
  }

  function renderCustomerDocuments() {
    const documents = repository.getDocuments();
    return <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Customer document center</p>
          <h1 className="mt-2 text-3xl font-black text-[#00284d] outline-none">Documents & Engineering Packages</h1>
          <p className="mt-2 text-sm text-slate-600">Upload new immutable revisions, download verified packages, inspect cryptographic SHA-256 hashes, and track interagency certifications.</p>
        </div>
        <label htmlFor="customer-document-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#00284d] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#003c70]">
          <UploadCloud className="size-4" /> Upload new revision
          <input id="customer-document-upload" type="file" className="sr-only" onChange={(event) => void uploadCustomerRevision(event)} />
        </label>
      </div>

      <div className="space-y-4">
        {documents.map((document) => {
          const latestVer = document.versions[0];
          const approvedReviews = document.agencyReviews.filter((r) => r.reviewStatus === "approved");
          return (
            <Card key={document.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-black text-[#00284d]">{document.title}</CardTitle>
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-black uppercase text-teal-800 border border-teal-200">
                        {latestVer?.versionTag ?? `v${document.currentVersionNumber}.0`}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {document.category.replaceAll("_", " ")} · {document.ownerOrgCode} · {document.versions.length} immutable version(s)
                      {document.workstreamTitle && ` · ${document.workstreamTitle}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setViewerModalDoc(document);
                        setViewerModalVer(latestVer);
                      }}
                      className="bg-[#00284d] hover:bg-[#003c70] text-white text-xs font-bold gap-1.5"
                    >
                      <Eye className="size-3.5" /> View & Inspect
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void downloadVersion(document.id, latestVer?.id || "")}
                      className="text-xs font-bold gap-1.5"
                    >
                      <Download className="size-3.5" /> Download
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <ShieldCheck className="size-4 text-emerald-600" />
                    <span className="text-slate-700">SHA-256: {latestVer?.sha256Hash?.slice(0, 20)}…</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">{approvedReviews.length}/{document.agencyReviews.length} Agency Certifications</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {document.versions.map((version) => (
                    <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 bg-white">
                      <div>
                        <p className="text-sm font-black text-[#00284d]">{version.versionTag} · {version.fileName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Uploaded {formatDate(version.uploadedAt)} by {version.uploadedByName} · {(version.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setViewerModalDoc(document);
                            setViewerModalVer(version);
                          }}
                          className="text-xs font-bold text-teal-800 hover:bg-teal-50"
                        >
                          <Eye className="size-3.5 mr-1" /> View
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void downloadVersion(document.id, version.id)}
                          className="text-xs font-bold"
                        >
                          <Download className="size-3.5 mr-1" /> Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>;
  }

  function renderContacts() {
    const profiles = activePersona.isCustomer ? customerVisibleProfiles() : projectProfiles.filter((profile) => profile.isActive);
    return <div className="space-y-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Project team</p><h1 className="mt-2 text-3xl font-black text-[#00284d] outline-none">Contacts and my profile</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Contact details and project responsibilities are data-driven. Customer-visible contacts exclude internal-only administrators and notes.</p></div><div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Users className="size-5 text-teal-700" /> Project contact directory</CardTitle></CardHeader><CardContent className="space-y-3">{profiles.map((profile) => <div key={profile.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-black text-[#00284d]">{profile.fullName}</p><p className="mt-1 text-xs font-bold text-teal-800">{profile.displayTitle}</p><p className="mt-1 text-xs text-slate-600">{profile.organizationName} · {profile.organizationalUnit}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-700">{profile.projectRole}</span></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600"><a href={`mailto:${profile.workEmail}`} className="font-bold text-teal-800 hover:underline">{profile.workEmail}</a>{profile.officePhone && <a href={`tel:${profile.officePhone}`} className="inline-flex items-center gap-1"><Phone className="size-3.5" />{profile.officePhone}</a>}<span>{profile.availabilityStatus.replaceAll("_", " ")}</span></div></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Pencil className="size-5 text-teal-700" /> My profile</CardTitle><p className="text-sm text-slate-600">You can edit your contact details. Organization membership, roles, capabilities, and visibility remain administrator-controlled.</p></CardHeader><CardContent>{currentProfile ? <form onSubmit={saveProfile} className="space-y-4"><div className="rounded-lg bg-slate-50 p-3"><p className="text-sm font-black text-[#00284d]">{currentProfile.fullName}</p><p className="mt-1 text-xs text-slate-600">{currentProfile.organizationName} · {currentProfile.projectRole}</p></div><div><Label htmlFor="profile-title">Professional / display title</Label><Input id="profile-title" value={profileDraft.displayTitle} onChange={(event) => setProfileDraft((current) => ({ ...current, displayTitle: event.target.value }))} /></div><div><Label htmlFor="profile-unit">Organizational unit / division</Label><Input id="profile-unit" value={profileDraft.organizationalUnit} onChange={(event) => setProfileDraft((current) => ({ ...current, organizationalUnit: event.target.value }))} /></div><div><Label htmlFor="profile-email">Work email</Label><Input id="profile-email" type="email" value={profileDraft.workEmail} onChange={(event) => setProfileDraft((current) => ({ ...current, workEmail: event.target.value }))} required /></div><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="profile-office-phone">Office phone</Label><Input id="profile-office-phone" value={profileDraft.officePhone} onChange={(event) => setProfileDraft((current) => ({ ...current, officePhone: event.target.value }))} /></div><div><Label htmlFor="profile-mobile-phone">Mobile phone (optional)</Label><Input id="profile-mobile-phone" value={profileDraft.mobilePhone} onChange={(event) => setProfileDraft((current) => ({ ...current, mobilePhone: event.target.value }))} /></div></div><div><Label htmlFor="profile-location">Office / location</Label><Input id="profile-location" value={profileDraft.officeLocation} onChange={(event) => setProfileDraft((current) => ({ ...current, officeLocation: event.target.value }))} /></div><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="profile-contact-method">Preferred contact method</Label><select id="profile-contact-method" value={profileDraft.preferredContactMethod} onChange={(event) => setProfileDraft((current) => ({ ...current, preferredContactMethod: event.target.value as typeof current.preferredContactMethod }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="email">Email</option><option value="phone">Phone</option><option value="text">Text</option><option value="teams">Teams</option></select></div><div><Label htmlFor="profile-availability">Availability</Label><select id="profile-availability" value={profileDraft.availabilityStatus} onChange={(event) => setProfileDraft((current) => ({ ...current, availabilityStatus: event.target.value as typeof current.availabilityStatus }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="available">Available</option><option value="limited">Limited</option><option value="out_of_office">Out of office</option></select></div></div><Button type="submit" className="bg-[#00284d] font-bold">Save profile</Button>{profileStatus && <p role="status" className="text-sm font-bold text-teal-800">{profileStatus}</p>}</form> : <p className="text-sm text-slate-600">No profile is configured for this persona.</p>}</CardContent></Card></div></div>;
  }

  function renderHelp() {
    return <div className="space-y-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Customer assistance</p><h1 className="mt-2 text-3xl font-black text-[#00284d] outline-none">Help and escalation</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Use a structured request when a normal project question is not enough. A PATH confirmation number lets you track the response through acknowledgement and resolution.</p></div><div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardTitle className="text-base font-black text-[#00284d]">State concierge</CardTitle></CardHeader><CardContent><p className="text-sm font-black">Sarah Johnson</p><p className="mt-1 text-xs text-slate-600">State Project Manager · Louisiana Governor&apos;s Office of Major Projects &amp; Delivery</p><a href="mailto:sarah.johnson@la.gov" className="mt-3 inline-block text-xs font-bold text-teal-800">sarah.johnson@la.gov</a></CardContent></Card><Card><CardHeader><CardTitle className="text-base font-black text-[#00284d]">Request assistance</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-600">Ask for help, report a blocker, or request a project-office response.</p><Button type="button" onClick={() => { setRequestCenterMode("service"); navigate("requests"); }} className="mt-4 bg-[#00284d] text-xs font-bold">Start help request</Button></CardContent></Card><Card><CardHeader><CardTitle className="text-base font-black text-[#00284d]">Critical-path escalation</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-600">For delayed government dependencies or schedule risk requiring acknowledgement.</p><Button type="button" onClick={() => { setRequestCenterMode("escalation"); navigate("requests"); }} className="mt-4 bg-amber-700 text-xs font-bold hover:bg-amber-800">Request escalation</Button></CardContent></Card></div><Card><CardHeader><CardTitle className="text-lg font-black text-[#00284d]">What happens after submission</CardTitle></CardHeader><CardContent><ol className="grid gap-3 text-sm text-slate-700 sm:grid-cols-4"><li><strong>1. Submitted</strong><br />PATH issues a confirmation.</li><li><strong>2. Triaged</strong><br />The State Project Office routes the request.</li><li><strong>3. Acknowledged</strong><br />A project participant records the next action.</li><li><strong>4. Resolved</strong><br />You receive a customer-safe update.</li></ol></CardContent></Card></div>;
  }

  function renderNotifications() {
    const notifications = repository.getNotifications();
    const events = repository.getAuditEvents().slice(0, 8);
    return <div className="space-y-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Action center</p><h1 className="mt-2 text-3xl font-black text-[#00284d] outline-none">Notifications</h1><p className="mt-2 text-sm text-slate-600">Only material events that change what someone needs to do appear here; routine audit history stays on the work item.</p></div><div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Bell className="size-5 text-teal-700" /> Action required</CardTitle></CardHeader><CardContent className="space-y-3">{notifications.length > 0 ? notifications.slice(0, 8).map((notification) => <div key={notification.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-black text-amber-950">{notification.title}</p><p className="mt-1 text-sm text-amber-900">{notification.message}</p><p className="mt-2 text-[11px] font-bold uppercase text-amber-800">{notification.type.replaceAll("_", " ")}</p></div>) : <p className="text-sm text-slate-500">No new action notifications.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Clock3 className="size-5 text-teal-700" /> Status updates</CardTitle></CardHeader><CardContent className="space-y-3">{events.map((event) => <div key={event.id} className="border-b border-slate-100 pb-3 last:border-0"><p className="text-sm font-bold text-[#00284d]">{event.actionType.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-600">{event.reason ?? event.newValue ?? "Recorded activity"}</p><p className="mt-1 text-[11px] text-slate-400">{event.actorName} · {formatDate(event.occurredAt)}</p></div>)}</CardContent></Card></div></div>;
  }

  function renderLegacyProject() {
    if (activePersona.isCustomer) return renderCustomerOverview();
    const workload = getAgencyWorkload(userPermits);
    return <div className="space-y-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">SpaceX Pecan Island</p><h1 className="mt-2 text-3xl font-black text-[#00284d] outline-none">Project context</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Vermilion Parish, Louisiana · shared operational context for the project team.</p></div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-xs font-black uppercase text-red-800">Blocked / at risk</p><p className="mt-2 text-3xl font-black text-red-950">{ragSummary.red}</p></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase text-amber-800">Attention</p><p className="mt-2 text-3xl font-black text-amber-950">{ragSummary.yellow}</p></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-emerald-800">On track</p><p className="mt-2 text-3xl font-black text-emerald-950">{ragSummary.green}</p></div></div><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Building2 className="size-5 text-teal-700" /> Agency Workload</CardTitle></CardHeader><CardContent className="space-y-3">{workload.slice(0, 8).map((agency) => <div key={agency.agencyCode} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3"><div><p className="text-sm font-black text-[#00284d]">{agency.agencyCode}</p><p className="text-xs text-slate-500">{agency.agencyLevel} · {agency.agencyName}</p></div><div className="text-right text-xs font-bold text-slate-700">{agency.count} workstreams · {agency.blockedCount} blocked</div></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Route className="size-5 text-teal-700" /> Gantt and dependencies</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-600">Open the schedule to review the critical path, baseline, forecast, and agency dependencies.</p><Button type="button" onClick={() => { setSecondaryTool("schedule"); navigate("secondary"); }} className="mt-4 bg-[#00284d] font-bold">Open Gantt <ArrowRight className="size-4" aria-hidden="true" /></Button></CardContent></Card></div>;
  }

  function renderProject() {
    return <ProjectOverviewPage project={projectRecord} customerSafe={activePersona.isCustomer} workflowTemplates={repository.getWorkflowTemplates()} focusedWorkstreamId={selectedProjectWorkstreamId} onFocusWorkstream={setSelectedProjectWorkstreamId} onOpenSchedule={() => { setSecondaryTool("schedule"); navigate("secondary"); }} />;
  }

  function renderSecondary() {
    return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Government tools</p><h1 className="mt-2 text-3xl font-black text-[#00284d] outline-none">{secondaryTool === "schedule" ? "Schedule" : secondaryTool === "vault" ? "Document Vault" : "Permit Catalog"}</h1></div><div className="flex flex-wrap gap-2">{([["schedule", "Schedule"], ["vault", "Document Vault"], ["catalog", "Permit Catalog"]] as Array<[SecondaryTool, string]>).map(([tool, label]) => <Button key={tool} type="button" variant={secondaryTool === tool ? "default" : "outline"} onClick={() => setSecondaryTool(tool)} className="text-xs font-bold">{label}</Button>)}</div></div>{secondaryTool === "schedule" && <WorkstreamGraphGantt project={projectRecord} onSelectWorkstream={(workstreamId) => openProject(workstreamId)} />}{secondaryTool === "vault" && <DocumentVaultPanel project={projectRecord} onUploadRevision={(documentId, event) => void uploadProjectRevision(documentId, event, activePersona.organization)} onDownloadDocument={(docId, verId) => void downloadVersion(docId, verId)} onSelectWorkstream={(workstreamId) => openProject(workstreamId)} />}{secondaryTool === "catalog" && <WorkflowDesignerPanel catalog={repository.getCatalog()} organizations={repository.getOrganizations()} templates={repository.getWorkflowTemplates()} />}</div>;
  }

  function renderAdmin() {
    const [firstUser] = teamUsers;
    if (activePersona.workspace === "state_office") return <div className="space-y-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">State project office</p><h1 className="mt-2 text-3xl font-black text-[#00284d] outline-none">Customer intake queue</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Review persisted customer requests, confirm the request details, and create the appropriate linked workstream(s) from the authorized project office queue.</p></div><CustomerRequestTriageQueue requests={repository.getCustomerRequests()} onTriage={(request) => void triageCustomerRequest(request)} /></div>;
    if (activePersona.workspace === "admin") return <div className="space-y-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Authorized administration</p><h1 className="mt-2 text-3xl font-black text-[#00284d] outline-none">Participants, profiles, and roles</h1><p className="mt-2 text-sm text-slate-600">Manage role assignment, participant activation, customer visibility, workstream responsibility, and profile fields from one audited directory.</p></div><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><UserCog className="size-5 text-teal-700" /> Team access and project participants</CardTitle></CardHeader><CardContent><AdminDirectory teamUsers={teamUsers} roleDefinitions={roleDefinitions} repository={repository} actorUserId={actorUserId()} onRoleChange={async (userId, roleId) => { const user = teamUsers.find((member) => member.id === userId); if (!user?.organizationId) { if (!allowsFixtureData()) { setToast("This team member has no organization membership to update."); return; } setTeamUsers((current) => current.map((member) => member.id === userId ? { ...member, roleId, permissions: roleDefinitions[roleId].defaultPermissions } : member)); setToast(`Updated ${user?.name ?? "user"} to ${roleDefinitions[roleId].name}.`); return; } const result = await repository.setOrganizationMemberRolePersisted({ userId, organizationId: user.organizationId, role: membershipRoleForRoleId(roleId) }); if (result.error) { setToast(`Role update failed: ${result.error.message}`); return; } setTeamUsers((current) => current.map((member) => member.id === userId ? { ...member, roleId, permissions: roleDefinitions[roleId].defaultPermissions } : member)); setToast(`Updated ${user.name} to ${roleDefinitions[roleId].name}.`); }} onMutation={(message) => { setToast(message); setMutationVersion((value) => value + 1); }} /></CardContent></Card>{repository.getCustomerRequests().length > 0 && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><ShieldAlert className="size-5 text-amber-700" /> Customer request triage</CardTitle><p className="text-sm text-slate-600">Submitted customer requests are visible for government-side follow-up.</p></CardHeader><CardContent className="space-y-3">{repository.getCustomerRequests().slice(0, 8).map((request) => <div key={request.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-black text-amber-950">{request.confirmationNumber} · {request.title}</p><p className="mt-1 text-xs text-amber-900">{request.requestType.replaceAll("_", " ")} · {request.description}</p><span className="mt-2 inline-block rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase text-amber-900">{request.status}</span></div>)}</CardContent></Card>}<p className="text-xs text-slate-500">Current administrator: {firstUser?.name ?? "PATH administrator"}. Admin profile and participant changes persist in this browser demo and are audit logged.</p></div>;
    return <div className="space-y-6"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Authorized administration</p><h1 className="mt-2 text-3xl font-black text-[#00284d] outline-none">Participants, profiles, and roles</h1><p className="mt-2 text-sm text-slate-600">Administrators can manage project participation, profile visibility, roles, workstream responsibility, and access. Ordinary users can edit only their own contact fields.</p></div><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><UserCog className="size-5 text-teal-700" /> Team access and project participants</CardTitle></CardHeader><CardContent className="space-y-3">{teamUsers.map((user) => { const profile = repository.getProfileByUserId(user.id); const participant = repository.getParticipants().find((entry) => entry.userId === user.id); return <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div><p className="text-sm font-black text-[#00284d]">{user.name} {user.name === "Joe Skaggs" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase text-amber-900">Space Czar</span>}</p><p className="text-xs font-bold text-teal-800">{profile?.displayTitle ?? user.displayTitle ?? roleDefinitions[user.roleId].name}</p><p className="text-xs text-slate-500">{profile?.workEmail ?? user.workEmail ?? user.email} · {profile?.organizationName ?? user.organization}</p><p className="mt-1 max-w-xl text-xs text-slate-500">{profile?.organizationalUnit ?? user.organizationalUnit ?? user.agency} · {participant?.workstreamIds.length ?? 0} assigned workstream(s)</p></div><select aria-label={`Role for ${user.name}`} value={user.roleId} onChange={(event) => { const roleId = event.target.value as RoleId; setTeamUsers((current) => current.map((member) => member.id === user.id ? { ...member, roleId, permissions: roleDefinitions[roleId].defaultPermissions } : member)); setToast(`Updated ${user.name} to ${roleDefinitions[roleId].name}.`); }} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800">{(Object.keys(roleDefinitions) as RoleId[]).map((role) => <option key={role} value={role}>{roleDefinitions[role].name}</option>)}</select></div>; })}<p className="text-xs text-slate-500">Current administrator: {firstUser?.name ?? "PATH administrator"}. Joe Skaggs · joe.skaggs@la.gov · Louisiana Economic Development (LED) · Space Czar.</p></CardContent></Card>{repository.getCustomerRequests().length > 0 && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><ShieldAlert className="size-5 text-amber-700" /> Customer request triage</CardTitle><p className="text-sm text-slate-600">Escalations, blockers, service requests, and permit tracking records submitted by SpaceX appear here for government-side follow-up.</p></CardHeader><CardContent className="space-y-3">{repository.getCustomerRequests().slice(0, 8).map((request) => <div key={request.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3"><div><p className="text-sm font-black text-amber-950">{request.confirmationNumber} · {request.title}</p><p className="mt-1 text-xs text-amber-900">{request.requestType.replaceAll("_", " ")} · {request.description}</p><p className="mt-1 text-xs text-amber-800">{request.submittedByName} · {request.locationOrAffectedArea ?? "Project-wide"}</p></div><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase text-amber-900">{request.status}</span></div>)}</CardContent></Card>}</div>;
  }

  function renderDetail() {
    if (!selectedItem) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="font-bold text-slate-600">Choose a work item to open its assignment.</p><Button type="button" onClick={() => navigate("my-work")} className="mt-4 bg-[#00284d] font-bold">Back to My Work</Button></div>;
    const actions = getAvailableActions(selectedItem, activePersona);
    const completionPreview = getCompletionPreview(selectedItem);
    const customer = activePersona.isCustomer;
    const request = selectedItem.sourceRequest;
    const escalationPath = request?.escalationPath ?? [];
    const audit = repository.getAuditEvents().filter((event) => event.entityId === selectedItem.workstreamId || event.entityId === selectedItem.sourceId).slice(0, 6);

    const linkedWorkstream = selectedItem.workstreamId ? repository.getWorkstreamById(selectedItem.workstreamId) : undefined;
    const docsToDisplay = resolveWorkItemDocuments(selectedItem, repository.getDocuments());

    return <div className="space-y-5"><nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500"><button type="button" onClick={() => navigate("my-work")} className="text-teal-800 underline-offset-2 hover:underline">My Work</button><span aria-hidden="true">›</span><button type="button" onClick={() => openProject()} className="text-teal-800 underline-offset-2 hover:underline font-bold" title="Go to SpaceX Pecan Island project page">SpaceX Pecan Island</button><span aria-hidden="true">›</span><button type="button" onClick={() => openProject(selectedItem.workstreamId)} className="text-teal-800 underline-offset-2 hover:underline" title="View workstream on project page">{selectedItem.workstreamTitle}</button><span aria-hidden="true">›</span><span className="text-slate-800">{selectedItem.title}</span></nav>
      <section className="rounded-2xl border border-teal-300 bg-white p-5 shadow-md sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-teal-800">{customer ? "PROJECT STATUS" : "YOUR ASSIGNMENT"}</p><h1 className="mt-2 max-w-3xl text-2xl font-black tracking-tight text-[#00284d] outline-none sm:text-4xl">{customer ? sanitizeCustomerItem(selectedItem).title : selectedItem.title}</h1><button type="button" onClick={() => openProject(selectedItem.workstreamId)} className="mt-2 text-sm font-semibold text-slate-600 hover:text-teal-800 hover:underline text-left cursor-pointer transition-colors" title="View workstream on project page">{selectedItem.workstreamTitle}</button></div><div className="flex items-center gap-2"><span className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase ${toneClasses(selectedItem.statusTone).badge}`}>{selectedItem.statusLabel}</span><Button type="button" variant="outline" size="sm" onClick={() => openProject(selectedItem.workstreamId)} className="text-xs font-bold text-teal-800 border-teal-300 hover:bg-teal-50 gap-1.5"><Building2 className="size-3.5" /> Project Page</Button></div></div><div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4"><div><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Assignment</p><p className="mt-1 font-black text-[#00284d]">{customer ? "Shared project status" : "You own this step"}</p></div><div><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Due</p><p className="mt-1 font-black text-[#00284d]">{formatDate(selectedItem.dueDate)}</p></div><div><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Critical path</p><p className="mt-1 font-black text-[#00284d]">{selectedItem.isCriticalPath ? "Yes" : "No"}</p></div><div><p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Float remaining</p><p className="mt-1 font-black text-[#00284d]">{selectedItem.isCriticalPath ? "3 days" : "Within float"}</p></div></div>{!customer && actions.length > 0 && <div className="sticky bottom-3 z-10 mt-6 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur" aria-label="Work actions"><span className="mr-1 self-center text-xs font-black uppercase tracking-wider text-slate-500">Actions</span>{actions.map((action, index) => {
        const isActionPermitted = isAdministrator(activePersona) || canUserPerformAction(selectedItem, action, activePersona);
        return isActionPermitted ? (
          <Button key={action} type="button" variant={index === 0 ? "default" : "outline"} onClick={() => openAction(selectedItem, action)} className={`text-xs font-bold ${index === 0 ? "bg-[#00284d] hover:bg-[#003c70]" : ""}`}>{actionIcon(action)}{actionLabel(action)}</Button>
        ) : (
          <Button key={action} type="button" variant="outline" disabled={true} title="Action disabled: Requires Administrator authority or item assignment." className="text-xs font-bold opacity-40 cursor-not-allowed bg-slate-200 text-slate-500 border-slate-300 shadow-none hover:bg-slate-200">{actionIcon(action)}{actionLabel(action)}</Button>
        );
      })}</div>}{customer && actions.length > 0 && <div className="sticky bottom-3 z-10 mt-6 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur" aria-label="Customer actions">{actions.map((action) => {
        const isActionPermitted = isAdministrator(activePersona) || canUserPerformAction(selectedItem, action, activePersona);
        return isActionPermitted ? (
          <Button key={action} type="button" onClick={() => openAction(selectedItem, action)} className="bg-[#00284d] text-xs font-bold">{actionIcon(action)}{actionLabel(action)}</Button>
        ) : (
          <Button key={action} type="button" disabled={true} title="Action disabled: Awaiting government response." className="bg-slate-200 text-slate-400 text-xs font-bold opacity-50 cursor-not-allowed">{actionIcon(action)}{actionLabel(action)}</Button>
        );
      })}</div>}</section>
       <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"><div className="space-y-5"><Card><CardHeader><CardTitle className="text-lg font-black text-[#00284d]">{customer ? "What this means for SpaceX" : "What you need to do"}</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-slate-700">{customer ? selectedItem.customerVisibleSummary : selectedItem.whatToDo}</p>{!customer && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600"><strong className="text-slate-800">Why you’re seeing this:</strong> {selectedItem.whyHere}<br /><strong className="text-slate-800">What removes it from your queue:</strong> {selectedItem.removesFromQueue}</p>}</CardContent></Card>{linkedWorkstream && <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950"><strong>Linked workstream state:</strong> {linkedWorkstream.operationalStateLabel}</p>}{selectedItem.sourceRfi && <Card><CardHeader><CardTitle className="text-lg font-black text-[#00284d]">{customer ? "Exact information requested" : "RFI record"}</CardTitle></CardHeader><CardContent className="space-y-3"><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">{selectedItem.sourceRfi.code} · Question</p><p className="mt-1 text-sm leading-6 text-slate-700">{selectedItem.sourceRfi.questionText}</p></div>{selectedItem.sourceRfi.responses?.filter((response) => response.responseText).map((response) => <div key={response.id} className="rounded-lg border border-teal-200 bg-teal-50 p-3"><p className="text-xs font-black uppercase tracking-wider text-teal-800">Applicant response</p><p className="mt-1 text-sm leading-6 text-teal-950">{response.responseText}</p></div>)}</CardContent></Card>}
        {!customer && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><ListChecks className="size-5 text-teal-700" /> Required inputs</CardTitle></CardHeader><CardContent><ul className="space-y-2">{selectedItem.requiredInputs.map((input) => <li key={input} className="flex items-start gap-2 text-sm text-slate-700"><Check className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />{input}</li>)}</ul></CardContent></Card>}
        {docsToDisplay.length > 0 && <Card><CardHeader><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Paperclip className="size-5 text-teal-700" /> Project Documents & Packages ({docsToDisplay.length})</CardTitle></div></CardHeader><CardContent className="space-y-3">{docsToDisplay.map((doc) => { const latestVer = doc.versions[0]; return <div key={doc.id} className="rounded-xl border border-slate-200 p-4 bg-white space-y-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex items-center gap-2"><p className="text-sm font-black text-[#00284d]">{doc.title}</p><span className="rounded bg-teal-50 border border-teal-200 px-1.5 py-0.5 text-[10px] font-mono font-bold text-teal-800">{latestVer?.versionTag || `v${doc.currentVersionNumber}.0`}</span></div><p className="mt-1 text-xs text-slate-500">{doc.category.replace(/_/g, " ")} · {doc.ownerOrgCode} · {doc.versions.length} revision(s)</p></div><div className="flex items-center gap-2"><Button type="button" size="sm" onClick={() => { setViewerModalDoc(doc as DocumentRecord); setViewerModalVer(latestVer); }} className="bg-[#00284d] hover:bg-[#003c70] text-white text-xs font-bold gap-1 shadow-xs"><Eye className="size-3.5" /> View Document</Button><Button type="button" variant="outline" size="sm" onClick={() => void downloadVersion(doc.id, latestVer?.id || "")} className="text-xs font-bold gap-1"><Download className="size-3.5" /> Download</Button></div></div>{latestVer && <div className="rounded-lg bg-slate-50 p-2.5 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2 font-mono"><span className="text-[11px] truncate max-w-sm">SHA-256: {latestVer.sha256Hash.slice(0, 16)}…</span><span className="text-[11px] text-slate-500 font-sans">Uploaded by {latestVer.uploadedByName}</span></div>}</div>; })}</CardContent></Card>}
        {selectedItem.kind === "document" && selectedItem.sourceDocument && <Card><CardHeader><CardTitle className="text-lg font-black text-[#00284d]">Version history</CardTitle></CardHeader><CardContent><p className="text-sm font-black text-[#00284d]">You are reviewing {selectedItem.exactDocumentVersionLabel}</p>{selectedItem.sourceDocument.versions.filter((version) => version.id !== selectedItem.exactDocumentVersionId).map((version) => <p key={version.id} className="mt-2 text-sm text-slate-600">Previously: {version.versionTag} uploaded {formatDate(version.uploadedAt)}.</p>)}</CardContent></Card>}
        {!customer && escalationPath.length > 0 && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><ShieldAlert className="size-5 text-teal-700" /> Inter-Agency Escalation Path</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{escalationPath.map((tier) => <div key={tier.level} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase text-slate-500">Tier {tier.level}</p><span className="text-[10px] font-black uppercase text-teal-800">{tier.status}</span></div><p className="mt-2 text-sm font-black text-[#00284d]">{tier.title}</p><p className="mt-1 text-xs text-slate-600">{tier.contactName} · {tier.agency}</p></div>)}</CardContent></Card>}</div><div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><ArrowRight className="size-5 text-teal-700" /> Downstream impact</CardTitle></CardHeader><CardContent><p className="text-sm font-black text-[#00284d]">{selectedItem.nextHandoff ?? "Next configured handoff"}</p><p className="mt-2 text-sm leading-6 text-slate-600">{selectedItem.scheduleImpact}. The next owner and notification recipients are previewed before an important action is confirmed.</p></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Clock3 className="size-5 text-teal-700" /> Activity / audit history</CardTitle></CardHeader><CardContent className="space-y-3">{customer ? <p className="text-sm text-slate-600">Internal activity is not shown in the customer workspace.</p> : audit.length > 0 ? audit.map((event) => <div key={event.id} className="border-b border-slate-100 pb-3 last:border-0"><p className="text-xs font-black uppercase text-slate-500">{event.actionType.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-slate-700">{event.reason ?? event.newValue ?? "Activity recorded"}</p><p className="mt-1 text-[11px] text-slate-400">{event.actorName} · {formatDate(event.occurredAt)}</p></div>) : <p className="text-sm text-slate-500">No activity recorded yet.</p>}</CardContent></Card></div></div>
      {!customer && selectedItem.kind === "workflow" && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]"><Route className="size-5 text-teal-700" /> Upstream and downstream dependencies</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Upstream</p><p className="mt-2 text-sm text-slate-700">{selectedItem.waitingOn ?? "No unresolved upstream dependency"}</p></div><div className="rounded-lg bg-teal-50 p-4"><p className="text-xs font-black uppercase text-teal-800">Downstream</p><p className="mt-2 text-sm font-bold text-teal-950">{completionPreview.nextOwner} receives the next handoff after completion.</p></div></CardContent></Card>}
       {(selectedItem.kind === "workflow" || selectedItem.kind === "task" || selectedItem.kind === "customer_request") && <TicketWorkflowEditor key={selectedItem.id} item={selectedItem} persona={activePersona} onWorkflowUpdated={() => setMutationVersion((v) => v + 1)} />}
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
      {dialog.action === "clear_blocker" && <><div><p className="text-xs font-black uppercase tracking-wider text-teal-800">Clear Blocker & Resume</p><p className="mt-1 text-lg font-black text-[#00284d]">Resume active review for {selectedItem.workstreamTitle}</p><p className="mt-1 text-sm text-slate-600">The blocker will be removed, the review clock will resume, and project participants will be notified.</p></div><div><Label htmlFor="unblock-note">Resolution notes (optional)</Label><textarea id="unblock-note" value={actionNote} onChange={(event) => setActionNote(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm" placeholder="Concurrence received / dependency resolved..." /></div></>}
      {dialog.action === "update_status" && <><div><p className="text-xs font-black uppercase tracking-wider text-teal-800">Update Status</p><p className="mt-1 text-lg font-black text-[#00284d]">{selectedItem.title}</p><p className="mt-1 text-sm text-slate-600">Select the new status for this {selectedItem.kind === "commitment" ? "commitment" : "work item"}. The change will be recorded in the audit history and visible to all project participants.</p></div><div><Label htmlFor="status-update">New status</Label><select id="status-update" value={statusUpdate} onChange={(event) => setStatusUpdate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="in_progress">In Progress — Actively being worked</option><option value="pending_review">Pending Review — Awaiting reviewer decision</option><option value="on_hold">On Hold — Paused, waiting on external dependency</option><option value="fulfilled">Fulfilled / Completed — Deliverable received or action done</option><option value="cancelled">Cancelled — No longer applicable</option></select></div><div><Label htmlFor="status-note">Notes (optional)</Label><textarea id="status-note" value={actionNote} onChange={(event) => setActionNote(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm" placeholder="Describe why this status is changing and any relevant context." /></div><div className="rounded-xl border border-teal-200 bg-teal-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-teal-900">What happens</p><ul className="mt-2 space-y-1 text-sm text-teal-950"><li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Update the ticket status to the selected state</li><li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Record an audit event with your name and notes</li><li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Notify project participants of the status change</li>{statusUpdate === "fulfilled" && <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Move the item to the completed queue</li>}</ul></div></>}
      {dialog.action === "advance_stage" && <><div><p className="text-xs font-black uppercase tracking-wider text-teal-800">Advance to Next Stage</p><p className="mt-1 text-lg font-black text-[#00284d]">{selectedItem.title}</p><p className="mt-1 text-sm text-slate-600">This will close the current workflow stage and advance the workstream to the next configured stage. The next owner will be notified.</p></div><div className="rounded-xl border border-teal-200 bg-teal-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-teal-900">What happens next</p><ul className="mt-2 space-y-1 text-sm text-teal-950">{completionPreview.effects.map((effect) => <li key={effect} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{effect}</li>)}</ul></div><div><Label htmlFor="advance-note">Notes (optional)</Label><textarea id="advance-note" value={actionNote} onChange={(event) => setActionNote(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm" placeholder="Add context for the handoff to the next stage owner." /></div></>}
      {dialog.action === "mark_blocked" && <><div><Label htmlFor="block-reason">What is preventing you from proceeding?</Label><select id="block-reason" value={blockReason} onChange={(event) => setBlockReason(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="customer">Waiting on SpaceX</option><option value="another_agency">Waiting on another agency</option><option value="internal">Missing internal decision</option><option value="statutory">Scheduled / statutory hold</option><option value="technical">Technical problem</option><option value="legal">Legal / policy question</option><option value="external">External third party</option><option value="other">Other</option></select></div>{blockReason === "another_agency" && <div><Label htmlFor="block-agency">Who needs to act?</Label><select id="block-agency" value={blockAgency} onChange={(event) => setBlockAgency(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option>CPRA</option><option>USACE</option><option>DOTD</option><option>Vermilion Parish</option><option>LDEQ</option></select></div>}<div><Label htmlFor="block-need">What do you need from them?</Label><textarea id="block-need" value={blockNeed} onChange={(event) => setBlockNeed(event.target.value)} rows={4} required className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm" placeholder="Describe the concurrence, document, or decision needed." /></div><div><Label htmlFor="block-due">When is it needed?</Label><Input id="block-due" type="date" value={blockDueDate} onChange={(event) => setBlockDueDate(event.target.value)} className="mt-1" /></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><strong className="text-[#00284d]">Clock behavior:</strong> PATH derives the wait policy from the selected reason. You are not asked to make a legal/policy determination.</div></>}
      {(dialog.action === "request_information" || dialog.action === "request_clarification") && <><div><Label htmlFor="question-text">What do you need?</Label><textarea id="question-text" value={questionText} onChange={(event) => setQuestionText(event.target.value)} rows={4} required className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm" /></div><div><Label htmlFor="question-due">When is it needed?</Label><Input id="question-due" type="date" value={questionDueDate} onChange={(event) => setQuestionDueDate(event.target.value)} className="mt-1" /></div></>}
      {dialog.action === "transfer" && <><div><Label htmlFor="transfer-type">How should we help?</Label><select id="transfer-type" value={transferType} onChange={(event) => setTransferType(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option>Ask another reviewer</option><option>Transfer assignment</option><option>Add co-reviewer</option><option>Send to supervisor</option><option>Request specialist consultation</option></select></div><div><Label htmlFor="transfer-note">What should the supervisor know?</Label><textarea id="transfer-note" value={actionNote} onChange={(event) => setActionNote(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm" /></div></>}
      {dialog.action === "escalate" && <><div><Label htmlFor="escalation-type">What kind of help do you need?</Label><select id="escalation-type" value={escalationType} onChange={(event) => setEscalationType(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option>Supervisor decision</option><option>Cross-agency assistance</option><option>Deadline relief</option><option>Policy / legal determination</option><option>Project office assistance</option><option>Executive intervention</option><option>Other</option></select></div>{activePersona.isCustomer && <div><Label htmlFor="escalation-note">Describe the risk or assistance needed</Label><textarea id="escalation-note" value={actionNote} onChange={(event) => setActionNote(event.target.value)} rows={4} required className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm" placeholder="Tell the project office what is delayed, why it matters, and what outcome would help." /></div>}<div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-amber-900">Next escalation</p><p className="mt-1 text-sm font-black text-amber-950">{recipientPreview.recipients[0]?.name}</p><p className="text-sm text-amber-900">{recipientPreview.recipients[0]?.organization}</p><p className="mt-2 text-xs text-amber-800">If unresolved by September 3, the Louisiana Project Office will be notified.</p></div></>}
      {(dialog.action === "add_note" || dialog.action === "approve_document" || dialog.action === "approve_with_comments" || dialog.action === "request_revision" || dialog.action === "accept_rfi_response" || dialog.action === "respond") && <div><Label htmlFor="action-note">{dialog.action === "respond" ? "Your response" : "Notes"}</Label><textarea id="action-note" value={actionNote} onChange={(event) => setActionNote(event.target.value)} rows={4} required={dialog.action === "add_note" || dialog.action === "respond"} className="mt-1 w-full rounded-md border border-slate-300 p-3 text-sm" placeholder={dialog.action === "respond" ? "Describe the response and attached information." : "Add context for the audit history."} /></div>}
      {dialog.action === "upload_documents" && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-black text-[#00284d]">Secure upload handoff</p><p className="mt-1 text-sm text-slate-600">Attach the requested document revision from the customer document workspace. The receiving agency will review the exact version submitted.</p></div>}
      {recipientPreview.recipients.length > 0 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-500">PATH will notify</p><div className="mt-2 space-y-2">{recipientPreview.recipients.map((recipient) => <div key={`${recipient.label}-${recipient.name}`} className="flex items-start gap-2 text-sm"><Mail className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden="true" /><span><strong className="text-[#00284d]">{recipient.label}:</strong> {recipient.name} · {recipient.organization}</span></div>)}</div>{recipientPreview.customerMessage && <p className="mt-3 border-t border-slate-200 pt-3 text-xs font-semibold text-slate-600"><strong className="text-slate-800">Customer will see:</strong> {recipientPreview.customerMessage}</p>}</div>}
      {dialogError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">{dialogError}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>{dialog.action !== "upload_documents" && <Button type="submit" className="bg-[#00284d] font-bold hover:bg-[#003c70]">{isCompletion ? "Complete & Send Forward" : actionLabel(dialog.action)}</Button>}</div>
    </form></div></div>;
  }

  function renderMain() {
    if (route === "detail") return renderDetail();
    if (route === "my-work") return <><div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><Label htmlFor="request-attachment">Supporting attachment for your next request (optional)</Label><Input key={requestFileInputKey} id="request-attachment" type="file" onChange={(event) => { const file = event.target.files?.[0] ?? null; setRequestFile(file); setIntakeFile(file); }} className="mt-1 cursor-pointer" /><p className="mt-1 text-xs text-slate-500">The selected file is attached when you submit from My Work or Requests & permits.</p></div>{renderMyWork()}</>;
    if (route === "agency-queue" || route === "rfis" || route === "coordination" || route === "documents") return activePersona.isCustomer && route === "documents" ? renderCustomerDocuments() : renderQueue(route);
    if (route === "project") return renderProject();
    if (route === "requests") return <><div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><Label htmlFor="request-attachment-requests">Supporting attachment for your next request (optional)</Label><Input key={requestFileInputKey} id="request-attachment-requests" type="file" onChange={(event) => { const file = event.target.files?.[0] ?? null; setRequestFile(file); setIntakeFile(file); }} className="mt-1 cursor-pointer" /><p className="mt-1 text-xs text-slate-500">The selected file is attached when you submit a permit or service request.</p></div>{renderCustomerRequestCenter()}</>;
    if (route === "schedule") return <div className="space-y-5"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Customer schedule</p><h1 className="mt-2 text-3xl font-black text-[#00284d] outline-none">Schedule</h1><p className="mt-2 text-sm text-slate-600">Read-only project delivery schedule for SpaceX. Internal government notes and control actions are not shown.</p></div><WorkstreamGraphGantt project={projectRecord} customerSafe onSelectWorkstream={(workstreamId) => openProject(workstreamId)} /></div>;
    if (route === "contacts" || route === "profile") return renderContacts();
    if (route === "help") return renderHelp();
    if (route === "notifications") return renderNotifications();
    if (route === "secondary") return renderSecondary();
    return <>{canAdmin && <CustomerRequestTriageQueue requests={repository.getCustomerRequests()} onTriage={(request) => void triageCustomerRequest(request)} />}{renderAdmin()}</>;
  }

  return <div className="min-h-screen bg-[#f3f6f7] text-[#172033] flex flex-col justify-between"><a className="skip-link" href="#main-content">Skip to main content</a><div className="road-stripe" /><header className="site-header sticky top-0 z-30"><div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 sm:px-6"><Button type="button" variant="ghost" size="icon" onClick={() => setMobileNavOpen((value) => !value)} className="text-white hover:bg-white/10 lg:hidden" aria-label="Toggle navigation"><Menu className="size-5" /></Button><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f4a100] text-[#00284d]"><Zap className="size-5 fill-current" aria-hidden="true" /></span><div className="min-w-0"><p className="text-sm font-black text-white">PATH</p><button type="button" onClick={() => openProject()} className="truncate text-left text-[11px] font-semibold text-slate-300 hover:text-white hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300 cursor-pointer" title="Go to SpaceX Pecan Island project page">{workspaceTitle(activePersona.workspace)} · SpaceX Pecan Island</button></div><div className="ml-auto hidden items-center gap-2 text-xs text-slate-200 md:flex"><span className="flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-950/60 px-3 py-1 font-bold text-emerald-200" title="State committed directly to Supabase PostgreSQL & Storage"><span className="size-2 rounded-full bg-emerald-400" />Supabase DB {lastSavedTime ? `· ${lastSavedTime}` : "· Connected"}</span><span className="rounded-full border border-white/20 px-3 py-1.5">{activePersona.name}</span><span className="rounded-full border border-teal-300/40 bg-teal-900/40 px-3 py-1.5 font-bold text-teal-100">{activePersona.roleLabel}</span></div><Button type="button" variant="ghost" size="icon" onClick={() => navigate("notifications")} className="relative text-white hover:bg-white/10" aria-label="Open notifications"><Bell className="size-5" /><span className="absolute right-1 top-1 size-2 rounded-full bg-[#f4a100]" /></Button><Button type="button" variant="ghost" size="sm" onClick={() => void signOut()} className="text-white hover:bg-white/10"><LogOut className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Sign out</span></Button></div></header><div className="mx-auto flex max-w-[1600px] items-start flex-1 w-full"><aside className={`${mobileNavOpen ? "block" : "hidden"} fixed inset-x-0 top-[69px] z-20 max-h-[calc(100vh-69px)] overflow-y-auto border-b border-slate-200 bg-white p-3 shadow-xl lg:sticky lg:top-[69px] lg:block lg:min-h-[calc(100vh-69px)] lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:shadow-none`}><button type="button" onClick={() => openProject()} className="group mb-4 w-full rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-left transition hover:border-teal-400 hover:bg-teal-50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 cursor-pointer" aria-label="Open SpaceX Pecan Island project page" title="Open SpaceX Pecan Island project page"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500 group-hover:text-teal-800">Current context</p><ArrowRight className="size-3 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-700" aria-hidden="true" /></div><p className="mt-1 text-sm font-black text-[#00284d] group-hover:text-teal-950">SpaceX Pecan Island</p><p className="mt-1 text-xs text-slate-500 group-hover:text-teal-900">Vermilion Parish · Louisiana</p></button><nav aria-label="Primary navigation" className="space-y-1"><p className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Work</p>{primaryNav.map((item) => <button key={item.id} type="button" onClick={() => navigate(item.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition ${route === item.id ? "bg-[#00284d] text-white shadow-sm" : "text-slate-700 hover:bg-teal-50 hover:text-teal-950"}`}>{item.icon}<span className="flex-1">{item.label}</span>{typeof item.count === "number" && <span className={`rounded-full px-2 py-0.5 text-[10px] ${route === item.id ? "bg-white/15 text-white" : "bg-slate-200 text-slate-700"}`}>{item.count}</span>}</button>)}<p className="px-3 pb-1 pt-6 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Secondary tools</p>{!activePersona.isCustomer && <><button type="button" onClick={() => { setSecondaryTool("schedule"); navigate("secondary"); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold ${route === "secondary" && secondaryTool === "schedule" ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-teal-50"}`}><CalendarClock className="size-4" />Schedule</button><button type="button" onClick={() => { setSecondaryTool("vault"); navigate("secondary"); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold ${route === "secondary" && secondaryTool === "vault" ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-teal-50"}`}><BookOpen className="size-4" />Document Vault</button><button type="button" onClick={() => { setSecondaryTool("catalog"); navigate("secondary"); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold ${route === "secondary" && secondaryTool === "catalog" ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-teal-50"}`}><Landmark className="size-4" />Permit Catalog</button></>}{canAdmin && <><p className="px-3 pb-1 pt-6 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Administration</p><button type="button" onClick={() => navigate("admin")} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold ${route === "admin" ? "bg-[#00284d] text-white" : "text-slate-700 hover:bg-teal-50"}`}><Settings2 className="size-4" />Administration</button></>}</nav><div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-black text-amber-950">Official filing notice</p><p className="mt-1 text-xs leading-5 text-amber-900">PATH coordinates work. Formal statutory filings remain in agency systems.</p></div></aside><main id="main-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{toast && <div role="status" aria-live="polite" className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />{toast}</div>}{renderMain()}</main></div><SystemVersionFooter />{renderDialog()}{viewerModalDoc && <DocumentViewerModal document={viewerModalDoc} version={viewerModalVer} isOpen={Boolean(viewerModalDoc)} onClose={() => { setViewerModalDoc(null); setViewerModalVer(undefined); }} onDownload={(docId, verId) => void downloadVersion(docId, verId)} />}</div>;
}
