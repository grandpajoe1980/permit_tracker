"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock3,
  Edit3,
  ExternalLink,
  FilePlus2,
  FileText,
  Filter,
  Flame,
  Globe2,
  GraduationCap,
  HardHat,
  HelpCircle,
  Info,
  KeyRound,
  Landmark,
  Layers,
  Lightbulb,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Maximize2,
  Phone,
  Plus,
  Printer,
  Radio,
  Route,
  Save,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  TrendingUp,
  Truck,
  User,
  UserCheck,
  UserCog,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  DEMO_PASSWORD,
  demoPersonas,
  initialTeamUsers,
  pecanIslandRequests,
  requestCategories,
  roleDefinitions,
  type DemoAccount,
  type DemoPersona,
  type JurisdictionLevel,
  type PermissionKey,
  type PermitRecord,
  type PermitStatus,
  type RAGStatus,
  type RequestCategory,
  type RoleId,
  type ServiceRequest,
  type StepState,
  type TeamUser,
} from "@/lib/demo-data";
import {
  calculateRAGSummary,
  firstName,
  getAgencyWorkload,
  getPermitsForPersona,
  getUpcomingDeadlines,
  parsePlainEnglishIntake,
  permitProgress,
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
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

type View = "portal" | "detail" | "admin";

function categoryIcon(category: RequestCategory) {
  switch (category) {
    case "road":
      return <Truck className="size-4" aria-hidden="true" />;
    case "utility":
      return <Zap className="size-4" aria-hidden="true" />;
    case "public_safety":
      return <ShieldCheck className="size-4" aria-hidden="true" />;
    case "workforce":
      return <GraduationCap className="size-4" aria-hidden="true" />;
    case "community":
      return <Users className="size-4" aria-hidden="true" />;
    case "permit":
    default:
      return <FileText className="size-4" aria-hidden="true" />;
  }
}

function categoryBadgeClasses(category: RequestCategory) {
  switch (category) {
    case "road":
      return "border-amber-400 bg-amber-50 text-amber-900";
    case "utility":
      return "border-cyan-400 bg-cyan-50 text-cyan-900";
    case "public_safety":
      return "border-indigo-400 bg-indigo-50 text-indigo-900";
    case "workforce":
      return "border-emerald-400 bg-emerald-50 text-emerald-900";
    case "community":
      return "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-900";
    case "permit":
    default:
      return "border-teal-400 bg-teal-50 text-teal-900";
  }
}

function jurisdictionBadgeClasses(level: JurisdictionLevel) {
  switch (level) {
    case "Federal":
      return "border-indigo-400 bg-indigo-100 text-indigo-950 font-bold";
    case "State":
      return "border-teal-400 bg-teal-100 text-teal-950 font-bold";
    case "Local / Parish":
      return "border-emerald-400 bg-emerald-100 text-emerald-950 font-bold";
    case "Utility / Regional":
      return "border-cyan-400 bg-cyan-100 text-cyan-950 font-bold";
    default:
      return "border-slate-300 bg-slate-100 text-slate-900 font-bold";
  }
}

function ragBadgeClasses(rag: RAGStatus) {
  if (rag === "red") return "border-red-500 bg-red-50 text-red-900 font-bold";
  if (rag === "yellow") return "border-amber-400 bg-amber-50 text-amber-900 font-bold";
  return "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold";
}

function stepIcon(state: StepState) {
  if (state === "done") return <Check className="size-3.5" aria-hidden="true" />;
  if (state === "blocked") return <AlertOctagon className="size-3.5" aria-hidden="true" />;
  if (state === "hearing") return <Landmark className="size-3.5" aria-hidden="true" />;
  if (state === "active") return <Circle className="size-3.5 fill-current" aria-hidden="true" />;
  return <Circle className="size-3.5" aria-hidden="true" />;
}

function stepClasses(state: StepState) {
  if (state === "done") return "border-emerald-700 bg-emerald-700 text-white";
  if (state === "active") return "border-teal-700 bg-teal-50 text-teal-800 ring-4 ring-teal-100";
  if (state === "blocked") return "border-red-700 bg-red-700 text-white ring-4 ring-red-100";
  if (state === "hearing") return "border-violet-700 bg-violet-50 text-violet-800 ring-4 ring-violet-100";
  return "border-slate-300 bg-white text-slate-400";
}

function PathLogo() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#f4a100] text-[#00284d] shadow-sm">
      <Zap className="size-6 fill-current" aria-hidden="true" />
    </span>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Home() {
  const [view, setView] = useState<View>("portal");
  const [currentUser, setCurrentUser] = useState<DemoAccount | null>(null);
  const [selectedPermitId, setSelectedPermitId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({ "TASK-T001": true });

  // Filter States
  const [statusFilter, setStatusFilter] = useState<"all" | "green" | "yellow" | "red" | "critical">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Login Form State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loadingData, setLoadingData] = useState(false);

  // Requests Data & Team Roles State
  const [userPermits, setUserPermits] = useState<ServiceRequest[]>(pecanIslandRequests);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>(initialTeamUsers);
  const [adminFeedback, setAdminFeedback] = useState<string>("");

  // Workflow Editor State (for the active request)
  const [isEditingFlow, setIsEditingFlow] = useState(false);
  const [newStepPhase, setNewStepPhase] = useState("Phase 3 · Inter-Agency Clearance");
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepMeta, setNewStepMeta] = useState("Target: Next 30 Days");
  const [newStepState, setNewStepState] = useState<StepState>("future");

  // Blocker Modal Form State
  const [showBlockerModal, setShowBlockerModal] = useState(false);
  const [blockerTitle, setBlockerTitle] = useState("");
  const [blockerDescription, setBlockerDescription] = useState("");
  const [blockerUnblockingAction, setBlockerUnblockingAction] = useState("");

  // Plain-English Intake State
  const [intakeText, setIntakeText] = useState("");
  const [requestMessage, setRequestMessage] = useState("");

  const headingRef = useRef<HTMLHeadingElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const hasMountedRef = useRef(false);

  const selectedPermit = selectedPermitId
    ? userPermits.find((permit) => permit.id === selectedPermitId) ?? null
    : null;

  const intakePreview = intakeText.trim()
    ? parsePlainEnglishIntake(intakeText)
    : null;

  // Find permissions of current user
  const loggedInTeamUser = teamUsers.find(
    (u) => u.email.toLowerCase() === currentUser?.username.toLowerCase()
  );
  const userRole = loggedInTeamUser ? loggedInTeamUser.roleId : "admin";
  const userPermissions = loggedInTeamUser ? loggedInTeamUser.permissions : roleDefinitions.admin.defaultPermissions;

  const canManageRoles = userPermissions.includes("manage_roles") || userRole === "admin";
  const canEditWorkflow = userPermissions.includes("edit_workflow") || userRole === "admin";

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    void getBrowserUser().then(async (user) => {
      if (!active || !user) return;
      const { permits } = await loadRequestsForUser();
      if (!active) return;
      const activePermits = permits.length > 0 ? permits : pecanIslandRequests;
      setCurrentUser({
        username: user.email ?? "",
        name: String(user.user_metadata?.full_name ?? user.email ?? "SpaceX Project Lead"),
        agencyId: "spaceport",
        applicationIds: activePermits.map((permit) => permit.id),
        scenario: "SpaceX Louisiana Program Lead",
      });
      setUserPermits(activePermits);
    });
    const { data: listener } = client.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === "SIGNED_OUT" || !session?.user) {
          setCurrentUser(null);
          setUserPermits(pecanIslandRequests);
        }
      }
    );
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    headingRef.current?.focus();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, [view, selectedPermitId]);

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
    setLoadingData(false);
    if (loaded.error) {
      setLoginError(`Signed in, but requests could not be loaded: ${loaded.error.message}`);
      return;
    }
    setLoginError("");
    const finalPermits = loaded.permits.length > 0 ? loaded.permits : pecanIslandRequests;
    const account: DemoAccount = {
      username: user.email ?? "",
      name: String(user.user_metadata?.full_name ?? user.email ?? "SpaceX Project Lead"),
      agencyId: "spaceport",
      applicationIds: finalPermits.map((permit) => permit.id),
      scenario: "SpaceX Louisiana Program Workspace",
    };
    setCurrentUser(account);
    setUserPermits(finalPermits);
    setSelectedPermitId(null);
  }

  async function handleDemoPersonaSelect(persona: DemoPersona) {
    const personaPassword = persona.password ?? DEMO_PASSWORD;
    setUsername(persona.email);
    setPassword(personaPassword);
    setLoginError("");
    setLoadingData(true);

    if (supabaseConfigured() && persona.password) {
      const { user, error } = await signInWithPassword(persona.email, personaPassword);
      if (!error && user) {
        const loaded = await loadRequestsForUser();
        setLoadingData(false);
        if (!loaded.error) {
          const finalPermits = loaded.permits.length > 0 ? loaded.permits : pecanIslandRequests;
          const account: DemoAccount = {
            username: user.email ?? persona.email,
            name: String(user.user_metadata?.full_name ?? persona.name),
            agencyId: "spaceport",
            applicationIds: finalPermits.map((permit) => permit.id),
            scenario: persona.role,
          };
          setCurrentUser(account);
          setUserPermits(finalPermits);
          setSelectedPermitId(null);
          return;
        }
      }
    }

    setLoadingData(false);
    const personaPermits = getPermitsForPersona(persona);
    const account: DemoAccount = {
      username: persona.email,
      name: persona.name,
      agencyId: "spaceport",
      applicationIds: personaPermits.map((p) => p.id),
      scenario: `${persona.role} · ${persona.scenario}`,
    };
    setCurrentUser(account);
    setUserPermits(personaPermits);
    setSelectedPermitId(null);
  }

  function openPermit(permitId: string) {
    setSelectedPermitId(permitId);
    setIsEditingFlow(false);
    setView("detail");
  }

  function toggleCardExpanded(permitId: string) {
    setExpandedCards((prev) => ({
      ...prev,
      [permitId]: !prev[permitId],
    }));
  }

  async function signOut() {
    await signOutBrowser();
    setCurrentUser(null);
    setSelectedPermitId(null);
    setUsername("");
    setPassword("");
    setLoginError("");
    setUserPermits(pecanIslandRequests);
    setView("portal");
  }

  // Admin Permission Handlers
  function handleUpdateUserRole(userId: string, newRoleId: RoleId) {
    const roleDef = roleDefinitions[newRoleId];
    setTeamUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? {
              ...user,
              roleId: newRoleId,
              permissions: [...roleDef.defaultPermissions],
            }
          : user
      )
    );
    setAdminFeedback(`✓ Updated role for user to "${roleDef.name}"`);
    setTimeout(() => setAdminFeedback(""), 4000);
  }

  function handleToggleUserPermission(userId: string, permKey: PermissionKey) {
    setTeamUsers((prev) =>
      prev.map((user) => {
        if (user.id !== userId) return user;
        const has = user.permissions.includes(permKey);
        const updated = has
          ? user.permissions.filter((p) => p !== permKey)
          : [...user.permissions, permKey];
        return { ...user, permissions: updated };
      })
    );
  }

  // Workflow Flow Editing Handlers
  function handleAdvanceWorkflow(requestId: string) {
    setUserPermits((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        const activeIdx = req.steps.findIndex((s) => s.state === "active" || s.state === "blocked");
        if (activeIdx === -1) return req;

        const updatedSteps = req.steps.map((step, idx) => {
          if (idx === activeIdx) return { ...step, state: "done" as StepState };
          if (idx === activeIdx + 1) return { ...step, state: "active" as StepState };
          return step;
        });

        const isCompleted = activeIdx + 1 >= req.steps.length;
        return {
          ...req,
          steps: updatedSteps,
          status: isCompleted ? "approved" : "in-review",
          statusLabel: isCompleted ? "Approved · Completed" : `In Progress · Step ${activeIdx + 2}`,
          ragStatus: "green",
          ragLabel: isCompleted ? "Approved" : "On Track",
          blocker: undefined,
        };
      })
    );
  }

  function handleUpdateStepState(requestId: string, stepIndex: number, newState: StepState) {
    setUserPermits((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        const updatedSteps = req.steps.map((step, idx) =>
          idx === stepIndex ? { ...step, state: newState } : step
        );
        return {
          ...req,
          steps: updatedSteps,
          ragStatus: newState === "blocked" ? "red" : newState === "hearing" ? "yellow" : req.ragStatus,
        };
      })
    );
  }

  function handleAddStep(requestId: string) {
    if (!newStepTitle.trim()) return;
    const newStep = {
      phase: newStepPhase,
      title: newStepTitle.trim(),
      meta: newStepMeta.trim() || "Milestone Stage",
      state: newStepState,
    };

    setUserPermits((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        return {
          ...req,
          steps: [...req.steps, newStep],
        };
      })
    );

    setNewStepTitle("");
    setNewStepMeta("Target: Next 30 Days");
  }

  function handleDeleteStep(requestId: string, stepIndex: number) {
    setUserPermits((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        return {
          ...req,
          steps: req.steps.filter((_, idx) => idx !== stepIndex),
        };
      })
    );
  }

  function handleAddBlockerSubmit(requestId: string) {
    if (!blockerTitle.trim()) return;
    setUserPermits((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        const updatedSteps = req.steps.map((step) =>
          step.state === "active" ? { ...step, state: "blocked" as StepState } : step
        );
        return {
          ...req,
          ragStatus: "red",
          ragLabel: "Blocked",
          status: "action-needed",
          statusLabel: `Blocked: ${blockerTitle.trim()}`,
          blocker: {
            title: blockerTitle.trim(),
            description: blockerDescription.trim() || "Action required before review can resume.",
            severity: "critical",
            blockedSince: "Just now",
            unblockingAction: blockerUnblockingAction.trim() || "Submit requested documentation to lead agency.",
          },
          steps: updatedSteps,
        };
      })
    );
    setShowBlockerModal(false);
    setBlockerTitle("");
    setBlockerDescription("");
    setBlockerUnblockingAction("");
  }

  function handleResolveBlocker(requestId: string) {
    setUserPermits((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        const updatedSteps = req.steps.map((step) =>
          step.state === "blocked" ? { ...step, state: "active" as StepState } : step
        );
        return {
          ...req,
          ragStatus: "green",
          ragLabel: "On Track",
          status: "in-review",
          statusLabel: "Active Review Resumed",
          blocker: undefined,
          steps: updatedSteps,
        };
      })
    );
  }

  function handleReassignAgency(requestId: string, agencyName: string, agencyCode: string, level: JurisdictionLevel) {
    setUserPermits((prev) =>
      prev.map((req) => {
        if (req.id !== requestId) return req;
        return {
          ...req,
          leadAgency: agencyName,
          leadAgencyCode: agencyCode,
          agencyLevel: level,
        };
      })
    );
  }

  async function handleIntakeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!intakeText.trim()) return;

    const triage = parsePlainEnglishIntake(intakeText);
    setRequestMessage("Routing request to Louisiana Inter-Agency Liaison triage queue…");

    const newTaskId = `TASK-T00${userPermits.length + 1}`;
    const newServiceReq: ServiceRequest = {
      id: newTaskId,
      title: triage.extractedTitle,
      type: `${triage.categoryLabel} Service Request`,
      category: triage.detectedCategory,
      categoryLabel: triage.categoryLabel,
      applicant: currentUser?.name || "SpaceX Louisiana Program Lead",
      organization: "Space Exploration Technologies Corp.",
      leadAgency: triage.suggestedLeadAgency,
      leadAgencyCode: triage.suggestedLeadAgencyCode,
      agencyLevel: triage.suggestedAgencyLevel,
      submitted: new Date().toLocaleDateString(undefined, { dateStyle: "long" }),
      targetDate: new Date(Date.now() + triage.estimatedDays * 86400000).toLocaleDateString(undefined, { dateStyle: "long" }),
      currentDay: 1,
      totalDays: triage.estimatedDays,
      status: "in-review",
      statusLabel: "Routed to Liaison Triage Queue",
      ragStatus: triage.isCriticalPathCandidate ? "yellow" : "green",
      ragLabel: triage.isCriticalPathCandidate ? "Triage · Critical Path" : "Triage · Normal",
      isCriticalPath: triage.isCriticalPathCandidate,
      owner: {
        name: "Jean-Paul Guidry",
        title: "Inter-Agency Liaison Officer",
        agency: "Louisiana Governor's Major Project Task Force",
        email: "jp.guidry@gov.la.gov",
        phone: "(225) 342-7000",
      },
      contact: {
        name: "Governor's Major Project Liaison Office",
        email: "liaison@gov.la.gov",
        phone: "(225) 342-7000",
      },
      escalationPath: [
        {
          level: 1,
          title: "Intake Triage Lead",
          contactName: "Jean-Paul Guidry",
          contactEmail: "jp.guidry@gov.la.gov",
          contactPhone: "(225) 342-7000",
          agency: "Governor's Office",
          status: "engaged",
        },
      ],
      gantt: {
        startMonth: 6,
        endMonth: 12,
        progressMonth: 6,
        phases: [
          { name: "Intake & Triage", startMonth: 6, endMonth: 7, state: "done" },
          { name: "Agency Technical Review", startMonth: 7, endMonth: 9, state: "active" },
          { name: "Inter-Agency Execution", startMonth: 9, endMonth: 12, state: "future" },
        ],
      },
      steps: [
        { phase: "Phase 1 · Intake & Triage", title: "Plain-English Need Parsed & Routed", meta: `Submitted · ${new Date().toLocaleDateString(undefined, { dateStyle: "long" })}`, state: "done" },
        { phase: "Phase 2 · Lead Agency Assignment", title: `Assigned to ${triage.suggestedLeadAgencyCode} (${triage.suggestedAgencyLevel})`, meta: "In progress · Liaison reviewing jurisdiction", state: "active" },
        { phase: "Phase 3 · Statutory Guidance", title: "Official Filing Guidance Packet", meta: triage.statutoryNotice, state: "future" },
        { phase: "Phase 4 · Inter-Agency Execution", title: "Joint Review & Delivery", meta: `Target: Day ${triage.estimatedDays}`, state: "future" },
      ],
      nextSteps: [
        {
          title: "Liaison Jurisdiction Review",
          body: `Liaison team will coordinate initial intake call with ${triage.suggestedLeadAgencyCode} within 48 hours.`,
          due: "Next 48 hours",
          responsibleParty: "State Liaison Team",
        },
      ],
      officialFilingNotice: triage.statutoryNotice,
    };

    if (supabaseConfigured()) {
      await createRequestForUser({
        title: triage.extractedTitle,
        requestType: triage.detectedCategory,
        description: intakeText.trim(),
      });
    }

    setUserPermits([newServiceReq, ...userPermits]);
    setIntakeText("");
    setRequestMessage(`✓ Request ${newTaskId} submitted and routed to ${triage.suggestedLeadAgencyCode} (${triage.suggestedAgencyLevel}) queue.`);
    setTimeout(() => setRequestMessage(""), 7000);
  }

  // Filtered requests
  const filteredPermits = userPermits.filter((permit) => {
    const matchesCategory =
      selectedCategory === "all" || permit.category === selectedCategory;

    let matchesStatus = true;
    if (statusFilter === "green") matchesStatus = permit.ragStatus === "green";
    else if (statusFilter === "yellow") matchesStatus = permit.ragStatus === "yellow";
    else if (statusFilter === "red") matchesStatus = permit.ragStatus === "red";
    else if (statusFilter === "critical") matchesStatus = permit.isCriticalPath;

    const matchesSearch =
      !searchQuery.trim() ||
      permit.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      permit.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      permit.leadAgency.toLowerCase().includes(searchQuery.toLowerCase()) ||
      permit.agencyLevel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      permit.statusLabel.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesStatus && matchesSearch;
  });

  const ragSummary = calculateRAGSummary(userPermits);
  const agencyWorkload = getAgencyWorkload(userPermits);
  const upcomingDeadlines = getUpcomingDeadlines(userPermits);
  const activeBlockers = userPermits.filter((p) => p.ragStatus === "red" && p.blocker);

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-950">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      {/* Clean Global Header */}
      <header className="site-header print-hide border-b border-slate-800 bg-[#001f3d] text-white">
        <div className="mx-auto flex min-h-18 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            className="group flex items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
            onClick={() => {
              setView("portal");
              setSelectedPermitId(null);
            }}
            aria-label="Critical Path Home"
          >
            <PathLogo />
            <span>
              <span className="block text-xl font-black tracking-wide text-white">
                Critical Path
              </span>
              <span className="block text-xs text-slate-300">
                SpaceX Louisiana · Pecan Island Project Operations & Permitting
              </span>
            </span>
          </button>

          <div className="flex items-center gap-3">
            {/* Admin Permissions Tab Button */}
            {currentUser && canManageRoles && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView(view === "admin" ? "portal" : "admin")}
                className={`border-white/30 text-xs font-bold ${
                  view === "admin"
                    ? "bg-amber-400 text-[#00284d] hover:bg-amber-300"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <UserCog className="mr-1.5 size-3.5" />
                {view === "admin" ? "Exit Admin" : "Manage Roles & Permissions"}
              </Button>
            )}

            {currentUser ? (
              /* Account Dropdown in Top Right */
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="inline-flex items-center gap-2.5 border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-amber-400 font-black text-xs text-[#00284d]">
                      {currentUser.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                    <div className="text-left hidden sm:block">
                      <p className="text-xs font-bold leading-none text-white">{currentUser.name}</p>
                      <p className="text-[10px] text-amber-300 mt-0.5 leading-none">{currentUser.scenario.split("·")[0]}</p>
                    </div>
                    <ChevronDown className="size-4 text-white/70" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 rounded-xl border-slate-200 bg-white p-2 shadow-2xl">
                  <DropdownMenuLabel className="px-3 py-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">Signed In User</p>
                    <p className="text-sm font-black text-[#00284d]">{currentUser.name}</p>
                    <p className="text-xs text-slate-600">{currentUser.username}</p>
                    <Badge variant="outline" className="mt-1.5 border-teal-700 bg-teal-50 text-teal-900 text-[10px] font-bold">
                      {currentUser.scenario}
                    </Badge>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Switch Demo Persona
                  </div>
                  {demoPersonas.slice(0, 5).map((persona) => (
                    <DropdownMenuItem
                      key={persona.id}
                      className="cursor-pointer text-xs font-medium text-slate-800 hover:bg-teal-50"
                      onClick={() => handleDemoPersonaSelect(persona)}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span>{persona.name}</span>
                        <span className="text-[10px] text-slate-500">{persona.badge}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    id="logout"
                    className="cursor-pointer text-xs font-bold text-red-600 hover:bg-red-50"
                    onClick={signOut}
                  >
                    <LogOut className="mr-2 size-3.5" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Badge className="border border-white/20 bg-white/10 text-white text-xs">
                Public Access Portal
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* ========================================================================= */}
        {/* VIEW: ADMIN / USER ROLES & PERMISSIONS MANAGEMENT                         */}
        {/* ========================================================================= */}
        {view === "admin" && (
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView("portal")}
                  className="text-xs font-bold text-slate-600 mb-2"
                >
                  <ArrowLeft className="mr-1 size-3.5" /> Back to Project Operations
                </Button>
                <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-black text-[#00284d]">
                  Access Control, User Roles & Permissions Management
                </h1>
                <p className="text-xs text-slate-600">
                  Assign administrative, technical reviewer, and contractor roles. Modify granular permissions and approval authority.
                </p>
              </div>

              {adminFeedback && (
                <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-bold text-xs px-3 py-1">
                  {adminFeedback}
                </Badge>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
              {/* Team User List & Role Matrix */}
              <div className="space-y-4">
                {teamUsers.map((user) => {
                  const currentRole = roleDefinitions[user.roleId];
                  return (
                    <Card key={user.id} className="border border-slate-200 bg-white shadow-xs p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-[#00284d]">{user.name}</span>
                            <Badge variant="outline" className="text-[10px] font-bold border-teal-600 bg-teal-50 text-teal-900">
                              {currentRole.badge}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">{user.email} · {user.organization} ({user.agency})</p>
                        </div>

                        {/* Change Role Selector */}
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`role-select-${user.id}`} className="text-xs font-bold text-slate-600 whitespace-nowrap">
                            Role:
                          </Label>
                          <select
                            id={`role-select-${user.id}`}
                            value={user.roleId}
                            onChange={(e) => handleUpdateUserRole(user.id, e.target.value as RoleId)}
                            className="rounded-lg border border-slate-300 bg-white p-1.5 text-xs font-bold text-slate-800 shadow-xs focus:border-teal-700"
                          >
                            {(Object.keys(roleDefinitions) as RoleId[]).map((rId) => (
                              <option key={rId} value={rId}>
                                {roleDefinitions[rId].name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Granular Permissions Checkboxes */}
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Granular Workflow Permissions
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                          {[
                            ["manage_roles", "Manage Team Roles"],
                            ["edit_workflow", "Edit Workflow & Steps"],
                            ["submit_requests", "Submit Plain-English Needs"],
                            ["add_blockers", "Flag Project Blockers"],
                            ["resolve_blockers", "Resolve Active Blockers"],
                            ["escalate_liaison", "Escalate to Liaison Desk"],
                            ["reassign_agency", "Reassign Review Agency"],
                          ].map(([key, label]) => {
                            const pKey = key as PermissionKey;
                            const isChecked = user.permissions.includes(pKey);
                            return (
                              <label
                                key={pKey}
                                className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition ${
                                  isChecked
                                    ? "border-teal-300 bg-teal-50/70 text-teal-950 font-semibold"
                                    : "border-slate-200 bg-white text-slate-500"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleUserPermission(user.id, pKey)}
                                  className="size-3.5 rounded text-teal-700 focus:ring-teal-700"
                                />
                                <span className="text-[11px] select-none">{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Role Descriptions Summary */}
              <Card className="border border-slate-200 bg-white shadow-xs p-5 space-y-3 h-fit">
                <CardTitle className="text-sm font-black text-[#00284d] flex items-center gap-1.5">
                  <Shield className="size-4 text-teal-700" /> Standard Role Hierarchy
                </CardTitle>
                <div className="space-y-3 text-xs">
                  {(Object.keys(roleDefinitions) as RoleId[]).map((rId) => {
                    const def = roleDefinitions[rId];
                    return (
                      <div key={rId} className="border-b border-slate-100 pb-2">
                        <p className="font-bold text-[#00284d]">{def.name}</p>
                        <p className="text-[11px] text-slate-600 leading-snug mt-0.5">{def.description}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW: MAIN PORTAL (Interactive Dashboard + Inline Login if logged out)    */}
        {/* ========================================================================= */}
        {view === "portal" && (
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 space-y-8">
            {/* Header / Project Intro */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="outline" className="border-teal-700 bg-teal-50 text-teal-900 font-bold uppercase tracking-wider text-[10px]">
                    SpaceX Louisiana Spaceport
                  </Badge>
                  <span className="text-xs text-slate-500 font-mono">PRJ-PECAN-2026</span>
                </div>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-3xl font-black tracking-tight text-[#00284d] outline-none sm:text-4xl"
                >
                  Pecan Island Project Operations & Permitting
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Real-time multi-agency status, critical path Gantt schedule, active blockers, and escalation paths.
                </p>
              </div>

              {/* Clickable Total Count */}
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-bold shadow-xs transition ${
                  statusFilter === "all"
                    ? "border-teal-700 bg-teal-50 text-teal-950 ring-2 ring-teal-700"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                <Layers className="size-4 text-teal-700" />
                <span>{userPermits.length} Total Requests</span>
              </button>
            </div>

            {/* =================================================================== */}
            {/* INLINE SIGN-IN BOX (Directly on first page when not logged in)      */}
            {/* =================================================================== */}
            {!currentUser && (
              <Card className="border-2 border-teal-700/30 bg-white shadow-md overflow-hidden">
                <div className="h-1.5 bg-[#00284d]" />
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-5 sm:px-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg font-black text-[#00284d] flex items-center gap-2">
                        <LockKeyhole className="size-4 text-teal-700" /> Sign In to Critical Path
                      </CardTitle>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Access authorized SpaceX Louisiana filings, submit requests, and manage project workflows.
                      </p>
                    </div>

                    {/* Quick Demo Persona Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          id="demo-login-trigger"
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-teal-600/40 bg-teal-50 text-teal-900 font-bold hover:bg-teal-100"
                        >
                          <Sparkles className="mr-1.5 size-3.5 text-teal-700" />
                          Quick Demo Sign-In
                          <ChevronDown className="ml-1 size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-84 max-h-[80vh] overflow-y-auto rounded-xl border-slate-200 bg-white p-2 shadow-2xl">
                        <DropdownMenuLabel className="px-3 py-1.5 text-xs font-bold uppercase text-slate-500">
                          Select Persona to Auto-Login
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <div className="px-3 py-1 text-[11px] font-bold text-teal-900 uppercase">SpaceX Louisiana Team</div>
                        {demoPersonas
                          .filter((p) => p.group === "SpaceX Louisiana Program")
                          .map((persona) => (
                            <DropdownMenuItem
                              key={persona.id}
                              id={`demo-persona-${persona.id}`}
                              className="cursor-pointer flex flex-col items-start gap-0.5 p-2 rounded hover:bg-teal-50"
                              onClick={() => handleDemoPersonaSelect(persona)}
                            >
                              <div className="flex w-full justify-between items-center text-xs font-bold text-[#00284d]">
                                <span>{persona.name}</span>
                                <Badge variant="outline" className="text-[10px]">{persona.badge}</Badge>
                              </div>
                              <span className="text-[11px] text-slate-500">{persona.role}</span>
                            </DropdownMenuItem>
                          ))}
                        <DropdownMenuSeparator />
                        <div className="px-3 py-1 text-[11px] font-bold text-slate-500 uppercase">Applicant Scenarios</div>
                        {demoPersonas
                          .filter((p) => p.group === "Applicant Scenarios")
                          .map((persona) => (
                            <DropdownMenuItem
                              key={persona.id}
                              id={`demo-persona-${persona.id}`}
                              className="cursor-pointer flex flex-col items-start gap-0.5 p-2 rounded hover:bg-slate-100"
                              onClick={() => handleDemoPersonaSelect(persona)}
                            >
                              <div className="flex w-full justify-between items-center text-xs font-bold text-[#00284d]">
                                <span>{persona.name}</span>
                                <Badge variant="outline" className="text-[10px]">{persona.badge}</Badge>
                              </div>
                              <span className="text-[11px] text-slate-500">{persona.role}</span>
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="p-5 sm:px-6">
                  <form onSubmit={handleLogin} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
                    <div>
                      <Label htmlFor="username" className="text-xs font-bold text-slate-700">Email Address / Username</Label>
                      <Input
                        ref={usernameRef}
                        id="username"
                        name="username"
                        type="text"
                        placeholder="e.g. alex.martin@spacex.test"
                        value={username}
                        required
                        onChange={(e) => {
                          setUsername(e.target.value);
                          setLoginError("");
                        }}
                        className="mt-1 h-10 text-xs"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password" className="text-xs font-bold text-slate-700">Password</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="demo1234 or persona password"
                        value={password}
                        required
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setLoginError("");
                        }}
                        className="mt-1 h-10 text-xs"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        id="login-submit"
                        type="submit"
                        disabled={loadingData}
                        className="h-10 w-full bg-[#00284d] font-bold text-white hover:bg-[#003c70]"
                      >
                        {loadingData ? "Signing in…" : "Sign In"}
                        <ArrowRight className="ml-1.5 size-4" />
                      </Button>
                    </div>
                  </form>

                  {loginError && (
                    <p id="login-error" role="alert" className="mt-3 rounded-md bg-red-50 p-2.5 text-xs font-bold text-red-800 border border-red-200">
                      {loginError}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* =================================================================== */}
            {/* 1. CLICKABLE PROJECT HEALTH STATUS METRICS                          */}
            {/* =================================================================== */}
            <section aria-label="Project Health Metrics">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                {/* 🟢 On Track */}
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === "green" ? "all" : "green")}
                  className={`rounded-xl border p-4 text-left shadow-xs transition hover:scale-[1.01] ${
                    statusFilter === "green"
                      ? "border-emerald-600 bg-emerald-100 ring-2 ring-emerald-600"
                      : "border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">🟢 On Track</span>
                    <CheckCircle2 className="size-4 text-emerald-700" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-emerald-950 sm:text-3xl">
                    {ragSummary.green}
                  </div>
                  <p className="mt-0.5 text-[11px] text-emerald-800">Click to filter on-track items</p>
                </button>

                {/* 🟡 Action / Hearings */}
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === "yellow" ? "all" : "yellow")}
                  className={`rounded-xl border p-4 text-left shadow-xs transition hover:scale-[1.01] ${
                    statusFilter === "yellow"
                      ? "border-amber-600 bg-amber-100 ring-2 ring-amber-600"
                      : "border-amber-300 bg-amber-50/80 hover:bg-amber-100/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-900">🟡 Action / Hearings</span>
                    <AlertTriangle className="size-4 text-amber-700" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-amber-950 sm:text-3xl">
                    {ragSummary.yellow}
                  </div>
                  <p className="mt-0.5 text-[11px] text-amber-800">Click to filter action needed</p>
                </button>

                {/* 🔴 Blocked */}
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === "red" ? "all" : "red")}
                  className={`rounded-xl border p-4 text-left shadow-xs transition hover:scale-[1.01] ${
                    statusFilter === "red"
                      ? "border-red-600 bg-red-100 ring-2 ring-red-600"
                      : "border-red-300 bg-red-50/90 hover:bg-red-100/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-red-900">🔴 Blocked</span>
                    <AlertOctagon className="size-4 text-red-700 animate-pulse" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-red-950 sm:text-3xl">
                    {ragSummary.red}
                  </div>
                  <p className="mt-0.5 text-[11px] text-red-800">Click to filter active blockers</p>
                </button>

                {/* ⚡ Critical Path */}
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === "critical" ? "all" : "critical")}
                  className={`rounded-xl border p-4 text-left shadow-xs transition hover:scale-[1.01] ${
                    statusFilter === "critical"
                      ? "border-indigo-600 bg-indigo-100 ring-2 ring-indigo-600"
                      : "border-indigo-300 bg-indigo-50/80 hover:bg-indigo-100/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">⚡ Critical Path</span>
                    <Zap className="size-4 text-indigo-700" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-indigo-950 sm:text-3xl">
                    {ragSummary.criticalPathCount}
                  </div>
                  <p className="mt-0.5 text-[11px] text-indigo-800">Click to filter launch drivers</p>
                </button>
              </div>
            </section>

            {/* Active Filter Banner */}
            {statusFilter !== "all" && (
              <div className="flex items-center justify-between rounded-lg bg-slate-200 px-4 py-2 text-xs font-bold text-slate-800">
                <span>
                  Filtering by:{" "}
                  <strong className="text-[#00284d] uppercase">
                    {statusFilter === "critical" ? "⚡ Critical Path Items" : `${statusFilter.toUpperCase()} Status`}
                  </strong>{" "}
                  ({filteredPermits.length} items found)
                </span>
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className="inline-flex items-center text-teal-800 hover:text-teal-950 underline font-semibold"
                >
                  <X className="mr-1 size-3.5" /> Clear filter
                </button>
              </div>
            )}

            {/* =================================================================== */}
            {/* 2. ONLY BLOCKERS SHOWN SPOTLIGHT                                    */}
            {/* =================================================================== */}
            {activeBlockers.length > 0 && (
              <section aria-label="Active Project Blockers">
                <div className="rounded-xl border-2 border-red-500 bg-red-50/90 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-md bg-red-600 text-white font-bold">
                        <AlertOctagon className="size-4" />
                      </span>
                      <h2 className="text-base font-black text-red-950 uppercase tracking-wide">
                        Active Project Blockers ({activeBlockers.length})
                      </h2>
                    </div>
                    <Badge className="border border-red-600 bg-red-600 text-white font-bold text-xs">
                      Escalated to Level 2 State Liaison
                    </Badge>
                  </div>

                  {activeBlockers.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg bg-white p-4 border border-red-200 shadow-xs space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black bg-red-100 text-red-900 px-2 py-0.5 rounded border border-red-300">
                            {item.id}
                          </span>
                          <strong className="text-sm font-black text-[#00284d]">{item.title}</strong>
                          <Badge variant="outline" className={jurisdictionBadgeClasses(item.agencyLevel)}>
                            {item.agencyLevel}
                          </Badge>
                        </div>
                        <span className="text-xs font-semibold text-red-800">
                          Blocked: {item.blocker?.blockedSince}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed">{item.blocker?.description}</p>

                      <div className="rounded bg-red-50/70 p-2.5 border border-red-200 text-xs text-red-900 font-semibold flex items-center gap-2">
                        <ArrowRight className="size-4 text-red-600 shrink-0" />
                        <span><strong>Unblocking Action:</strong> {item.blocker?.unblockingAction}</span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                        <span>Lead Agency: <strong className="text-slate-900">{item.leadAgency}</strong></span>
                        <div className="flex items-center gap-2">
                          {canEditWorkflow && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResolveBlocker(item.id)}
                              className="h-8 border-emerald-500 bg-emerald-50 text-emerald-950 font-bold hover:bg-emerald-100"
                            >
                              <Check className="mr-1 size-3.5 text-emerald-700" /> Resolve Blocker
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPermit(item.id)}
                            className="h-8 border-red-300 bg-red-50 text-red-950 font-bold hover:bg-red-100"
                          >
                            View Blocker & Escalation Path
                            <ChevronRight className="ml-1 size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* =================================================================== */}
            {/* 3. INTERACTIVE GANTT TIMELINE CHART (Government Side Phases)        */}
            {/* =================================================================== */}
            <Card className="border border-slate-200 bg-white shadow-xs overflow-hidden">
              <CardHeader className="border-b border-slate-100 p-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base font-black text-[#00284d] flex items-center gap-2">
                      <BarChart3 className="size-4 text-teal-700" /> Government Operations & Permitting Gantt Timeline (2024)
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Visual multi-agency phase progression, active review windows, and critical path timeline
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                    <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-emerald-600" /> Completed</span>
                    <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-teal-600" /> Active</span>
                    <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-red-600" /> Blocked</span>
                    <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-slate-300" /> Future</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-5 overflow-x-auto">
                <div className="min-w-[700px] space-y-3">
                  {/* Month Columns Header */}
                  <div className="grid grid-cols-[220px_repeat(12,1fr)] gap-1 border-b border-slate-200 pb-2 text-[11px] font-bold text-slate-500 uppercase">
                    <span>Task / Permit</span>
                    {MONTHS.map((month, idx) => (
                      <span key={month} className={`text-center ${idx === 5 ? "text-teal-800 font-extrabold bg-teal-50 rounded" : ""}`}>
                        {month}
                      </span>
                    ))}
                  </div>

                  {/* Gantt Rows */}
                  {userPermits.map((item) => {
                    const gantt = item.gantt || { startMonth: 1, endMonth: 9, progressMonth: 5.5, phases: [] };
                    return (
                      <div
                        key={item.id}
                        onClick={() => openPermit(item.id)}
                        className="group grid grid-cols-[220px_repeat(12,1fr)] gap-1 items-center rounded-lg p-1.5 hover:bg-slate-50 cursor-pointer transition border border-transparent hover:border-slate-200"
                      >
                        {/* Task Title & ID */}
                        <div className="pr-2 truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold text-slate-600">{item.id}</span>
                            {item.isCriticalPath && <span className="text-[10px] text-amber-700 font-black">⚡</span>}
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 ${jurisdictionBadgeClasses(item.agencyLevel)}`}>
                              {item.agencyLevel}
                            </Badge>
                          </div>
                          <p className="text-xs font-bold text-[#00284d] truncate group-hover:text-teal-800">
                            {item.title}
                          </p>
                        </div>

                        {/* 12-Month Bar Grid */}
                        <div className="col-span-12 grid grid-cols-12 gap-1 h-7 items-center relative bg-slate-100/70 rounded-md p-1">
                          {/* Current Date Line (Mid-June) */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-teal-700/60 z-10"
                            style={{ left: "45.8%" }}
                            title="Current Project Milestone (June 2024)"
                          />

                          {/* Phase Spans */}
                          {gantt.phases.map((phase) => {
                            const colStart = phase.startMonth;
                            const span = Math.max(1, phase.endMonth - phase.startMonth);
                            return (
                              <div
                                key={phase.name}
                                style={{
                                  gridColumnStart: colStart,
                                  gridColumnEnd: `span ${span}`,
                                }}
                                className={`h-5 rounded text-[10px] font-bold flex items-center justify-center truncate px-1 text-white shadow-xs ${
                                  phase.state === "done"
                                    ? "bg-emerald-600"
                                    : phase.state === "active"
                                      ? "bg-teal-700 ring-2 ring-teal-200"
                                      : phase.state === "blocked"
                                        ? "bg-red-600 animate-pulse ring-2 ring-red-200"
                                        : phase.state === "hearing"
                                          ? "bg-amber-500"
                                          : "bg-slate-300 text-slate-700"
                                }`}
                                title={`${phase.name} (Month ${phase.startMonth}–${phase.endMonth})`}
                              >
                                {phase.name}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* =================================================================== */}
            {/* 4. CROSS-AGENCY WORKLOAD & UPCOMING DEADLINES                       */}
            {/* =================================================================== */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Agency Workload Breakdown */}
              <Card className="border border-slate-200 bg-white shadow-xs">
                <CardHeader className="border-b border-slate-100 pb-3.5 pt-5 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-extrabold text-[#00284d] flex items-center gap-2">
                      <Building2 className="size-4 text-teal-700" /> Agency Workload & Reviewing Level
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] text-slate-600">
                      {agencyWorkload.length} Agencies
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">Cross-agency operational case loads & jurisdictional tiers</p>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                  {agencyWorkload.map((agency) => (
                    <div key={agency.agencyCode} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-[#00284d] flex items-center gap-1.5">
                          <strong>{agency.agencyCode}</strong>
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${jurisdictionBadgeClasses(agency.agencyLevel)}`}>
                            {agency.agencyLevel}
                          </Badge>
                          <span className="text-slate-500 font-normal truncate max-w-[150px] sm:max-w-xs">{agency.agencyName}</span>
                        </span>
                        <span className="flex items-center gap-2 font-mono">
                          {agency.blockedCount > 0 && (
                            <span className="text-red-700 font-bold text-[10px] bg-red-50 border border-red-200 rounded px-1.5">
                              {agency.blockedCount} blocked
                            </span>
                          )}
                          <span className="text-slate-700">{agency.count} item{agency.count === 1 ? "" : "s"}</span>
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
                        <div
                          className="h-full bg-teal-700"
                          style={{ width: `${(agency.onTrackCount / agency.count) * 100}%` }}
                        />
                        {agency.blockedCount > 0 && (
                          <div
                            className="h-full bg-red-600"
                            style={{ width: `${(agency.blockedCount / agency.count) * 100}%` }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Upcoming Milestones & Decision Deadlines */}
              <Card className="border border-slate-200 bg-white shadow-xs">
                <CardHeader className="border-b border-slate-100 pb-3.5 pt-5 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-extrabold text-[#00284d] flex items-center gap-2">
                      <Calendar className="size-4 text-teal-700" /> Upcoming Decision Deadlines
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] text-slate-600">
                      Next 30–60 Days
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">Statutory and milestone targets on active critical path</p>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                  {upcomingDeadlines.map((deadline) => (
                    <div
                      key={deadline.requestId}
                      onClick={() => openPermit(deadline.requestId)}
                      className="group flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-100 p-2.5 transition hover:border-teal-300 hover:bg-slate-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-[11px] font-bold text-slate-700">{deadline.requestId}</span>
                          <span className="text-[11px] font-bold text-teal-900 bg-teal-50 px-1.5 rounded">{deadline.agencyCode}</span>
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${jurisdictionBadgeClasses(deadline.agencyLevel)}`}>
                            {deadline.agencyLevel}
                          </Badge>
                          {deadline.isCriticalPath && (
                            <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 px-1.5 rounded">⚡ Critical</span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-[#00284d] truncate group-hover:text-teal-800">{deadline.requestTitle}</p>
                        <p className="text-[11px] text-slate-500 truncate">{deadline.milestoneTitle}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="block font-mono text-xs font-bold text-slate-900">{deadline.targetDate}</span>
                        <Badge variant="outline" className={`text-[10px] mt-0.5 ${ragBadgeClasses(deadline.ragStatus)}`}>
                          {deadline.ragStatus.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* =================================================================== */}
            {/* 5. SPACEX PLAIN-ENGLISH INTAKE & LIAISON TRIAGE                     */}
            {/* =================================================================== */}
            <Card className="overflow-hidden border-2 border-teal-700/30 bg-white shadow-md">
              <div className="h-2 bg-gradient-to-r from-teal-700 via-amber-400 to-[#00284d]" />
              <CardHeader className="bg-slate-50/80 px-6 py-5 border-b border-slate-200">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-teal-800 text-white shadow-xs">
                      <FilePlus2 className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-black text-[#00284d]">
                        Submit a Plain-English Government Service or Infrastructure Need
                      </CardTitle>
                      <p className="text-xs text-slate-600">
                        Inter-agency liaison triage automatically identifies jurisdiction, suggests lead agency, and routes the request.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-teal-700 bg-teal-50 text-teal-900 font-bold text-xs">
                    Liaison Triage Active
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                {/* Sample Prompt Chips */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-600 flex items-center gap-1">
                    <Lightbulb className="size-3.5 text-amber-500" /> Try example needs:
                  </span>
                  {[
                    "Heavy-haul bridge reinforcement on LA-82 for rocket booster transport",
                    "Need 230kV high-capacity electrical transmission line for cryogenic facility",
                    "Airspace NOTAM safety corridor and FCC radio spectrum clearance",
                    "Aerospace welding and NDT technician workforce training program with SLCC",
                    "Pecan Island residential drinking water well testing protocol",
                  ].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setIntakeText(example)}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 transition hover:border-teal-400 hover:bg-teal-50 hover:text-teal-900"
                    >
                      {example.slice(0, 42)}…
                    </button>
                  ))}
                </div>

                <form onSubmit={handleIntakeSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="intake-description" className="sr-only">
                      Describe your government service or permit need in plain English
                    </label>
                    <textarea
                      id="intake-description"
                      rows={3}
                      value={intakeText}
                      onChange={(e) => setIntakeText(e.target.value)}
                      placeholder="Describe what your project team needs from Louisiana state or parish government in plain English..."
                      required
                      className="w-full rounded-lg border border-slate-300 bg-white p-3.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-hidden focus:ring-2 focus:ring-teal-700/20"
                    />
                  </div>

                  {/* Live Heuristic Triage Preview Box */}
                  {intakePreview && (
                    <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 space-y-3 animate-in fade-in-50 duration-200">
                      <div className="flex items-center justify-between text-xs font-bold text-teal-950">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="size-4 text-teal-700" /> Automatic Triage Analysis
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge className={categoryBadgeClasses(intakePreview.detectedCategory)}>
                            {intakePreview.categoryLabel}
                          </Badge>
                          <Badge className={jurisdictionBadgeClasses(intakePreview.suggestedAgencyLevel)}>
                            {intakePreview.suggestedAgencyLevel}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 text-xs text-slate-800">
                        <div>
                          <span className="text-slate-500 block">Suggested Lead Agency:</span>
                          <strong className="text-[#00284d]">{intakePreview.suggestedLeadAgency}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Critical Path & Priority:</span>
                          <strong>
                            {intakePreview.isCriticalPathCandidate ? "⚡ Critical Path Candidate" : "Standard Review"} · {intakePreview.priority.toUpperCase()}
                          </strong>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 border-t border-teal-200/60 pt-2 flex items-start gap-1.5">
                        <Info className="size-3.5 shrink-0 text-teal-800 mt-0.5" />
                        <span><strong>Statutory Guidance:</strong> {intakePreview.statutoryNotice}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button
                      id="intake-submit-btn"
                      type="submit"
                      disabled={!intakeText.trim()}
                      className="bg-[#00284d] text-white font-bold hover:bg-[#003c70]"
                    >
                      <Send className="mr-2 size-4" />
                      Submit to Liaison Triage Queue
                    </Button>

                    {requestMessage && (
                      <p role="status" aria-live="polite" className="text-sm font-bold text-teal-900 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-lg">
                        {requestMessage}
                      </p>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* =================================================================== */}
            {/* 6. ALL PERMITS & SERVICE REQUEST MATRIX (Expandable + Drilldown)    */}
            {/* =================================================================== */}
            <section aria-labelledby="matrix-heading" className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 id="matrix-heading" className="text-xl font-black text-[#00284d]">
                    Project Service Requests & Permits ({filteredPermits.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Showing all tracked items with expandable inline summaries and dedicated detail pages
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
                  <Input
                    placeholder="Search requests, agencies, IDs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs"
                    aria-label="Filter requests matrix"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-2 pt-1" role="tablist" aria-label="Filter by Request Category">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    selectedCategory === "all"
                      ? "bg-[#00284d] text-white shadow-xs"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Layers className="size-3.5" />
                  All ({userPermits.length})
                </button>

                {(Object.keys(requestCategories) as RequestCategory[]).map((cat) => {
                  const count = userPermits.filter((p) => p.category === cat).length;
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        active
                          ? "bg-[#00284d] text-white shadow-xs"
                          : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {categoryIcon(cat)}
                      {requestCategories[cat].shortLabel} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Request Cards Grid (Expandable & Clickable) */}
              <div className="space-y-3 pt-2">
                {filteredPermits.map((permit) => {
                  const progress = permitProgress(permit);
                  const isExpanded = Boolean(expandedCards[permit.id]);
                  return (
                    <div
                      key={permit.id}
                      id={`request-card-${permit.id}`}
                      className="rounded-xl border border-slate-200 bg-white shadow-xs transition hover:border-teal-500 overflow-hidden"
                    >
                      {/* Top Summary Bar */}
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-black text-[#00284d] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {permit.id}
                            </span>
                            <Badge variant="outline" className={`text-[11px] ${categoryBadgeClasses(permit.category)}`}>
                              {categoryIcon(permit.category)}
                              <span className="ml-1">{permit.categoryLabel}</span>
                            </Badge>
                            <Badge variant="outline" className={`text-[11px] ${jurisdictionBadgeClasses(permit.agencyLevel)}`}>
                              {permit.agencyLevel}
                            </Badge>
                            <Badge variant="outline" className={`text-[11px] ${ragBadgeClasses(permit.ragStatus)}`}>
                              {permit.ragLabel}
                            </Badge>
                            {permit.isCriticalPath && (
                              <span className="inline-flex items-center text-[10px] font-extrabold text-amber-900 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5">
                                ⚡ Critical Path
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-extrabold text-[#00284d]">
                            {permit.title}
                          </h3>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>Reviewing Agency: <strong className="text-slate-800">{permit.leadAgency}</strong></span>
                            <span>Owner: <strong className="text-slate-800">{permit.owner.name}</strong></span>
                            <span>Target: <strong className="text-slate-800">{permit.targetDate}</strong></span>
                          </div>
                        </div>

                        {/* Right: Progress & Toggle / Drilldown */}
                        <div className="flex items-center gap-3 sm:w-64 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                          <div className="w-28 sm:w-32 space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-600">
                              <span>Day {permit.currentDay}/{permit.totalDays}</span>
                              <span>{progress}%</span>
                            </div>
                            <Progress
                              value={progress}
                              className={`h-1.5 ${
                                permit.ragStatus === "red"
                                  ? "[&_[data-slot=progress-indicator]]:bg-red-600"
                                  : permit.ragStatus === "yellow"
                                    ? "[&_[data-slot=progress-indicator]]:bg-amber-500"
                                    : "[&_[data-slot=progress-indicator]]:bg-teal-700"
                              }`}
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleCardExpanded(permit.id)}
                              className="h-8 px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                              aria-label={isExpanded ? "Collapse summary" : "Expand summary"}
                            >
                              {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPermit(permit.id)}
                              className="h-8 px-2.5 text-xs font-bold border-teal-600/30 text-[#00284d] hover:bg-teal-50"
                            >
                              Detail <ArrowRight className="ml-1 size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Inline Details & Quick Flow Editing */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5 space-y-4 animate-in fade-in-50 duration-200">
                          {/* Blocker alert if present */}
                          {permit.blocker && (
                            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-950 space-y-1">
                              <div className="flex items-center justify-between">
                                <p className="font-bold flex items-center gap-1.5">
                                  <AlertOctagon className="size-3.5 text-red-600" /> Blocker: {permit.blocker.title}
                                </p>
                                {canEditWorkflow && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleResolveBlocker(permit.id)}
                                    className="h-7 text-xs border-emerald-500 bg-emerald-50 text-emerald-950 font-bold hover:bg-emerald-100"
                                  >
                                    <Check className="mr-1 size-3 text-emerald-700" /> Resolve Blocker
                                  </Button>
                                )}
                              </div>
                              <p>{permit.blocker.description}</p>
                              <p className="font-semibold text-red-900">Unblocking action: {permit.blocker.unblockingAction}</p>
                            </div>
                          )}

                          {/* 5-Phase Steps Summary */}
                          <div className="grid gap-2 sm:grid-cols-5 text-xs">
                            {permit.steps.map((step, idx) => (
                              <div
                                key={step.title}
                                className={`p-2 rounded border text-center ${
                                  step.state === "done"
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                                    : step.state === "active"
                                      ? "border-teal-400 bg-teal-50 text-teal-950 ring-1 ring-teal-300 font-bold"
                                      : step.state === "blocked"
                                        ? "border-red-300 bg-red-50 text-red-950 font-bold"
                                        : "border-slate-200 bg-white text-slate-600"
                                }`}
                              >
                                <span className="block text-[10px] text-slate-500 font-mono">Step {idx + 1}</span>
                                <span className="block font-semibold truncate" title={step.title}>{step.title}</span>
                              </div>
                            ))}
                          </div>

                          {/* Quick Stage Controls if user has edit_workflow permission */}
                          {canEditWorkflow && (
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                              <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Sliders className="size-3 text-teal-700" /> Quick Flow Actions:
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAdvanceWorkflow(permit.id)}
                                className="h-7 text-xs border-teal-600 bg-teal-50 text-teal-950 font-bold hover:bg-teal-100"
                              >
                                <Check className="mr-1 size-3" /> Advance Next Stage
                              </Button>

                              {!permit.blocker && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedPermitId(permit.id);
                                    setShowBlockerModal(true);
                                  }}
                                  className="h-7 text-xs border-red-300 bg-red-50 text-red-900 font-bold hover:bg-red-100"
                                >
                                  <AlertOctagon className="mr-1 size-3" /> Flag Blocker
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openPermit(permit.id)}
                                className="h-7 text-xs font-semibold text-slate-700 hover:bg-slate-200 ml-auto"
                              >
                                Full Flow Editor & Milestones <ChevronRight className="ml-1 size-3" />
                              </Button>
                            </div>
                          )}

                          {/* Assigned State Owner */}
                          <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-200 pt-2 text-slate-600">
                            <span>
                              Assigned Owner: <strong className="text-slate-900">{permit.owner.name}</strong> ({permit.owner.title}, {permit.owner.agency})
                            </span>
                            <Button
                              size="sm"
                              onClick={() => openPermit(permit.id)}
                              className="bg-[#00284d] text-white font-bold h-7 text-xs hover:bg-[#003c70]"
                            >
                              Open Full Dedicated Page <ChevronRight className="ml-1 size-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredPermits.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
                    <Filter className="mx-auto size-8 text-slate-400 mb-2" />
                    <p className="font-bold text-slate-700">No requests found matching your filter</p>
                    <p className="text-xs mt-1">Try selecting a different status or category above.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW: DEDICATED DETAIL PAGE (Single Permit / Workflow Editor)             */}
        {/* ========================================================================= */}
        {view === "detail" && selectedPermit && (
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
            {/* Top Navigation, Print Trigger, and Flow Editor Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-4 print-hide">
              <Button
                type="button"
                variant="outline"
                onClick={() => setView("portal")}
                className="font-bold text-[#00284d]"
              >
                <ArrowLeft className="mr-2 size-4" />
                Back to Operations Overview
              </Button>

              <div className="flex items-center gap-2">
                {canEditWorkflow && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditingFlow(!isEditingFlow)}
                    className={`font-bold text-xs ${
                      isEditingFlow
                        ? "bg-amber-400 text-[#00284d] border-amber-500 hover:bg-amber-300"
                        : "border-teal-700 bg-teal-50 text-teal-950 hover:bg-teal-100"
                    }`}
                  >
                    <Edit3 className="mr-1.5 size-3.5" />
                    {isEditingFlow ? "Close Flow Editor" : "Edit Request Workflow & Stages"}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.print()}
                  className="border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  <Printer className="mr-2 size-4" />
                  Print Executive Summary
                </Button>
              </div>
            </div>

            {/* Request Header Card */}
            <Card className="overflow-hidden border-slate-200 bg-white shadow-md">
              <div
                className={`h-2 ${
                  selectedPermit.ragStatus === "red"
                    ? "bg-red-600"
                    : selectedPermit.ragStatus === "yellow"
                      ? "bg-amber-500"
                      : "bg-teal-700"
                }`}
              />
              <CardHeader className="p-6 sm:p-8 border-b border-slate-100 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-black bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded text-[#00284d]">
                      {selectedPermit.id}
                    </span>
                    <Badge variant="outline" className={`text-xs ${categoryBadgeClasses(selectedPermit.category)}`}>
                      {categoryIcon(selectedPermit.category)}
                      <span className="ml-1">{selectedPermit.categoryLabel}</span>
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${jurisdictionBadgeClasses(selectedPermit.agencyLevel)}`}>
                      {selectedPermit.agencyLevel}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${ragBadgeClasses(selectedPermit.ragStatus)}`}>
                      {selectedPermit.ragLabel}
                    </Badge>
                    {selectedPermit.isCriticalPath && (
                      <span className="inline-flex items-center text-xs font-black text-amber-950 bg-amber-200 border border-amber-400 rounded px-2 py-0.5">
                        ⚡ CRITICAL PATH DRIVER
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-500">
                    Submitted {selectedPermit.submitted} · Target: {selectedPermit.targetDate}
                  </span>
                </div>

                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-2xl font-black text-[#00284d] outline-none sm:text-3xl"
                >
                  {selectedPermit.title}
                </h1>

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 pt-1">
                  <p>
                    Applicant: <strong>{selectedPermit.applicant}</strong> ({selectedPermit.organization}) · Reviewing Agency: <strong>{selectedPermit.leadAgency}</strong>
                  </p>

                  {/* Reassign Agency quick select if user can reassign */}
                  {canEditWorkflow && isEditingFlow && (
                    <div className="flex items-center gap-2 bg-slate-50 border p-2 rounded-lg text-xs">
                      <span className="font-bold text-slate-700">Reassign Level:</span>
                      <select
                        value={selectedPermit.agencyLevel}
                        onChange={(e) =>
                          handleReassignAgency(
                            selectedPermit.id,
                            selectedPermit.leadAgency,
                            selectedPermit.leadAgencyCode,
                            e.target.value as JurisdictionLevel
                          )
                        }
                        className="rounded border border-slate-300 p-1 font-bold text-xs"
                      >
                        <option value="Federal">Federal</option>
                        <option value="State">State</option>
                        <option value="Local / Parish">Local / Parish</option>
                        <option value="Utility / Regional">Utility / Regional</option>
                      </select>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-8 space-y-8">
                {/* WORKFLOW EDITING TOOLBAR (When Flow Editor is active) */}
                {isEditingFlow && (
                  <div className="rounded-xl border-2 border-teal-600 bg-teal-50/70 p-5 space-y-4 shadow-sm animate-in fade-in-50 duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-200 pb-3">
                      <div className="flex items-center gap-2">
                        <Edit3 className="size-4 text-teal-800" />
                        <h2 className="font-black text-sm text-[#00284d] uppercase">
                          Interactive Request Flow & Milestone Editor
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAdvanceWorkflow(selectedPermit.id)}
                          className="h-8 text-xs bg-teal-800 text-white font-bold hover:bg-teal-900"
                        >
                          <Check className="mr-1.5 size-3.5" /> Advance to Next Stage
                        </Button>
                        {!selectedPermit.blocker ? (
                          <Button
                            size="sm"
                            onClick={() => setShowBlockerModal(true)}
                            className="h-8 text-xs bg-red-600 text-white font-bold hover:bg-red-700"
                          >
                            <AlertOctagon className="mr-1.5 size-3.5" /> Flag Blocker
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleResolveBlocker(selectedPermit.id)}
                            className="h-8 text-xs bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                          >
                            <Check className="mr-1.5 size-3.5" /> Resolve Blocker
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Add New Milestone Step Form */}
                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-bold text-teal-950 uppercase">Add New Milestone / Review Step</p>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <Input
                          placeholder="Phase (e.g. Phase 3 · Technical Review)"
                          value={newStepPhase}
                          onChange={(e) => setNewStepPhase(e.target.value)}
                          className="h-9 text-xs bg-white"
                        />
                        <Input
                          placeholder="Step Title (e.g. USACE Joint Sign-off)"
                          value={newStepTitle}
                          onChange={(e) => setNewStepTitle(e.target.value)}
                          className="h-9 text-xs bg-white"
                        />
                        <Input
                          placeholder="Meta / Date (e.g. Target: July 20)"
                          value={newStepMeta}
                          onChange={(e) => setNewStepMeta(e.target.value)}
                          className="h-9 text-xs bg-white"
                        />
                        <div className="flex gap-2">
                          <select
                            value={newStepState}
                            onChange={(e) => setNewStepState(e.target.value as StepState)}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-800 h-9"
                          >
                            <option value="future">Future</option>
                            <option value="active">Active</option>
                            <option value="done">Done</option>
                            <option value="hearing">Hearing</option>
                            <option value="blocked">Blocked</option>
                          </select>
                          <Button
                            size="sm"
                            type="button"
                            onClick={() => handleAddStep(selectedPermit.id)}
                            className="h-9 bg-[#00284d] text-white font-bold hover:bg-[#003c70]"
                          >
                            <Plus className="size-4" /> Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 1. Blocker & Escalation Banner (if applicable) */}
                {selectedPermit.blocker && (
                  <div className="rounded-xl border-2 border-red-500 bg-red-50 p-5 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-red-950 font-black text-base">
                        <AlertOctagon className="size-5 text-red-600" />
                        <span>{selectedPermit.blocker.title}</span>
                      </div>
                      {canEditWorkflow && (
                        <Button
                          size="sm"
                          onClick={() => handleResolveBlocker(selectedPermit.id)}
                          className="bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700"
                        >
                          <Check className="mr-1.5 size-3.5" /> Resolve Blocker & Resume
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-slate-800">{selectedPermit.blocker.description}</p>
                    <div className="rounded-lg bg-white p-3 border border-red-200 text-xs text-red-900 font-semibold flex items-center gap-2">
                      <ArrowRight className="size-4 text-red-600 shrink-0" />
                      <span><strong>Unblocking Action:</strong> {selectedPermit.blocker.unblockingAction}</span>
                    </div>
                  </div>
                )}

                {/* 2. Escalation Path Hierarchy */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#00284d] flex items-center gap-2">
                    <TrendingUp className="size-4 text-teal-700" /> Inter-Agency Escalation Path
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {selectedPermit.escalationPath.map((tier) => (
                      <div
                        key={tier.level}
                        className={`rounded-lg p-3.5 border transition ${
                          tier.status === "escalated"
                            ? "border-red-400 bg-red-50/80 shadow-xs"
                            : tier.status === "engaged"
                              ? "border-teal-400 bg-teal-50/80 shadow-xs"
                              : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span className="text-slate-500">Tier {tier.level}</span>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[10px] uppercase font-extrabold ${
                              tier.status === "escalated"
                                ? "bg-red-600 text-white"
                                : tier.status === "engaged"
                                  ? "bg-teal-700 text-white"
                                  : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {tier.status}
                          </span>
                        </div>
                        <p className="font-bold text-xs text-[#00284d]">{tier.title}</p>
                        <p className="text-xs text-slate-700 font-medium mt-0.5">{tier.contactName}</p>
                        <p className="text-[11px] text-slate-500 font-mono mt-1">{tier.contactPhone}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. 5-Phase Timeline & Step State Modifiers */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#00284d] flex items-center gap-2">
                      <Route className="size-4 text-teal-700" /> Review & Execution Milestones ({selectedPermit.steps.length} Steps)
                    </h2>
                    {canEditWorkflow && !isEditingFlow && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditingFlow(true)}
                        className="text-xs font-bold text-teal-800 hover:bg-teal-50"
                      >
                        <Edit3 className="mr-1 size-3.5" /> Edit Steps
                      </Button>
                    )}
                  </div>

                  <ol className="relative border-l-2 border-slate-200 ml-3 space-y-6">
                    {selectedPermit.steps.map((step, index) => (
                      <li key={step.title} className="ml-6 relative">
                        <span
                          className={`absolute -left-9 flex size-6 items-center justify-center rounded-full text-xs font-bold ${stepClasses(
                            step.state
                          )}`}
                        >
                          {stepIcon(step.state)}
                        </span>
                        <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-100 shadow-2xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500">{step.phase}</span>
                              <span className="font-mono text-xs text-slate-400">Step {index + 1}</span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold ${
                                  step.state === "done"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                    : step.state === "active"
                                      ? "bg-teal-50 text-teal-800 border-teal-300"
                                      : step.state === "blocked"
                                        ? "bg-red-50 text-red-800 border-red-300"
                                        : "bg-slate-50 text-slate-600"
                                }`}
                              >
                                {step.state.toUpperCase()}
                              </Badge>
                            </div>

                            {/* State Modifier Dropdown when in edit mode */}
                            {isEditingFlow && canEditWorkflow && (
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={step.state}
                                  onChange={(e) => handleUpdateStepState(selectedPermit.id, index, e.target.value as StepState)}
                                  className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-800"
                                >
                                  <option value="done">Done</option>
                                  <option value="active">Active</option>
                                  <option value="blocked">Blocked</option>
                                  <option value="hearing">Hearing</option>
                                  <option value="future">Future</option>
                                </select>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteStep(selectedPermit.id, index)}
                                  className="h-7 px-1.5 text-red-600 hover:bg-red-50"
                                  title="Delete step"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-[#00284d]">{step.title}</h3>
                          <p className="text-xs text-slate-600">{step.meta}</p>
                          {step.note && (
                            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-2 mt-1">
                              {step.note}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* 4. Assigned State Owner & Immediate Next Steps */}
                <div className="grid gap-6 sm:grid-cols-2 pt-4 border-t border-slate-200">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <User className="size-3.5" /> Assigned Lead / Owner
                    </h2>
                    <p className="text-sm font-black text-[#00284d]">{selectedPermit.owner.name}</p>
                    <p className="text-xs text-slate-600 font-medium">{selectedPermit.owner.title}</p>
                    <p className="text-xs text-teal-900 font-semibold">{selectedPermit.owner.agency}</p>
                    <div className="pt-2 text-xs font-mono text-slate-600 space-y-0.5">
                      <p className="flex items-center gap-1.5"><Mail className="size-3 text-slate-400" /> {selectedPermit.owner.email}</p>
                      <p className="flex items-center gap-1.5"><Phone className="size-3 text-slate-400" /> {selectedPermit.owner.phone}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Clock3 className="size-3.5" /> Immediate Next Actions
                    </h2>
                    {selectedPermit.nextSteps.map((next) => (
                      <div key={next.title} className="text-xs text-slate-700 space-y-1">
                        <p className="font-bold text-[#00284d]">{next.title}</p>
                        <p className="text-slate-600">{next.body}</p>
                        {next.due && (
                          <p className="text-[11px] font-semibold text-teal-900">Due Date: {next.due} ({next.responsibleParty})</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Statutory Filing Notice Banner */}
                <div className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-xs text-slate-700 space-y-1">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Landmark className="size-4 text-slate-700" /> Statutory System of Record Notice
                  </p>
                  <p>{selectedPermit.officialFilingNotice || "Official records and formal notices remain with the authoritative statutory department."}</p>
                </div>
              </CardContent>
            </Card>

            {/* BLOCKER MODAL DIALOG */}
            {showBlockerModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in-50">
                <Card className="w-full max-w-lg border-2 border-red-500 bg-white shadow-2xl">
                  <CardHeader className="bg-red-50 border-b border-red-100 p-5">
                    <CardTitle className="text-base font-black text-red-950 flex items-center gap-2">
                      <AlertOctagon className="size-5 text-red-600" /> Flag Critical Roadblock on {selectedPermit.id}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div>
                      <Label htmlFor="blocker-title" className="text-xs font-bold text-slate-700">Blocker Summary Title</Label>
                      <Input
                        id="blocker-title"
                        placeholder="e.g. Coastal Drainage Concurrence Required from CPRA"
                        value={blockerTitle}
                        onChange={(e) => setBlockerTitle(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <Label htmlFor="blocker-desc" className="text-xs font-bold text-slate-700">Detailed Description of Blocker</Label>
                      <textarea
                        id="blocker-desc"
                        rows={2}
                        placeholder="Detail why the application cannot proceed..."
                        value={blockerDescription}
                        onChange={(e) => setBlockerDescription(e.target.value)}
                        className="w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900 mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="blocker-action" className="text-xs font-bold text-slate-700">Immediate Unblocking Action</Label>
                      <Input
                        id="blocker-action"
                        placeholder="e.g. Upload updated 100-year storm runoff model"
                        value={blockerUnblockingAction}
                        onChange={(e) => setBlockerUnblockingAction(e.target.value)}
                        className="mt-1 text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowBlockerModal(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleAddBlockerSubmit(selectedPermit.id)}
                        className="bg-red-600 text-white font-bold hover:bg-red-700"
                      >
                        Flag Blocker & Escalate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
