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
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  ExternalLink,
  FilePlus2,
  FileText,
  Filter,
  Flame,
  GraduationCap,
  HardHat,
  HelpCircle,
  Info,
  Landmark,
  Layers,
  Lightbulb,
  LockKeyhole,
  LogOut,
  Mail,
  Phone,
  Printer,
  Radio,
  Route,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  User,
  UserCheck,
  Users,
  Wrench,
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
  pecanIslandRequests,
  requestCategories,
  type DemoAccount,
  type DemoPersona,
  type PermitRecord,
  type PermitStatus,
  type RAGStatus,
  type RequestCategory,
  type ServiceRequest,
  type StepState,
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

type View = "welcome" | "login" | "dashboard" | "detail";

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

function ragBadgeClasses(rag: RAGStatus) {
  if (rag === "red") return "border-red-500 bg-red-50 text-red-900 font-bold";
  if (rag === "yellow") return "border-amber-400 bg-amber-50 text-amber-900 font-bold";
  return "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold";
}

function statusClasses(status: PermitStatus) {
  if (status === "action-needed") return "border-amber-400 bg-amber-50 text-amber-950";
  if (status === "hearing") return "border-violet-400 bg-violet-50 text-violet-950";
  if (status === "approved") return "border-emerald-400 bg-emerald-50 text-emerald-950";
  return "border-sky-400 bg-sky-50 text-sky-950";
}

function statusIcon(status: PermitStatus) {
  if (status === "action-needed") return <AlertTriangle aria-hidden="true" />;
  if (status === "hearing") return <Landmark aria-hidden="true" />;
  if (status === "approved") return <CheckCircle2 aria-hidden="true" />;
  return <Clock3 aria-hidden="true" />;
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
      <Route className="size-6" aria-hidden="true" />
    </span>
  );
}

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const labels = ["Workspace", "Sign in", "Command Center"];
  return (
    <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Sign-in progress">
      {labels.map((label, index) => {
        const step = (index + 1) as 1 | 2 | 3;
        const complete = step < current;
        const active = step === current;
        return (
          <li
            key={label}
            className={`flex min-w-0 items-center gap-2 border-t-4 pt-3 text-xs font-semibold sm:text-sm ${
              complete || active ? "border-teal-700 text-[#00284d]" : "border-slate-200 text-slate-500"
            }`}
            aria-current={active ? "step" : undefined}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                complete
                  ? "bg-teal-700 text-white"
                  : active
                    ? "bg-[#00284d] text-white"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {complete ? <Check className="size-3.5" aria-hidden="true" /> : step}
            </span>
            <span className="truncate">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("welcome");
  const [currentUser, setCurrentUser] = useState<DemoAccount | null>(null);
  const [selectedPermitId, setSelectedPermitId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [userPermits, setUserPermits] = useState<ServiceRequest[]>(pecanIslandRequests);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingData, setLoadingData] = useState(false);

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
      setView("dashboard");
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

  function navigate(nextView: View) {
    if ((nextView === "dashboard" || nextView === "detail") && !currentUser) {
      setView("welcome");
      return;
    }
    setView(nextView);
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
    setLoadingData(false);
    if (loaded.error) {
      setLoginError(`Signed in, but applications could not be loaded: ${loaded.error.message}`);
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
    setView("dashboard");
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
          setView("dashboard");
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
    setView("dashboard");
  }

  function openPermit(permitId: string) {
    if (!userPermits.some((permit) => permit.id === permitId)) return;
    setSelectedPermitId(permitId);
    setView("detail");
  }

  async function signOut() {
    await signOutBrowser();
    setCurrentUser(null);
    setSelectedPermitId(null);
    setUsername("");
    setPassword("");
    setLoginError("");
    setUserPermits(pecanIslandRequests);
    setView("welcome");
  }

  async function handleIntakeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!intakeText.trim()) return;

    const triage = parsePlainEnglishIntake(intakeText);
    setRequestMessage("Routing request to Louisiana Inter-Agency Liaison triage queue…");

    const newReqId = `REQ-PECAN-00${userPermits.length + 1}`;
    const newServiceReq: ServiceRequest = {
      id: newReqId,
      title: triage.extractedTitle,
      type: `${triage.categoryLabel} Service Request`,
      category: triage.detectedCategory,
      categoryLabel: triage.categoryLabel,
      applicant: currentUser?.name || "SpaceX Louisiana Program Lead",
      organization: "Space Exploration Technologies Corp.",
      leadAgency: triage.suggestedLeadAgency,
      leadAgencyCode: triage.suggestedLeadAgencyCode,
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
      steps: [
        { phase: "Phase 1 · Intake & Triage", title: "Plain-English Need Parsed & Routed", meta: `Submitted · ${new Date().toLocaleDateString(undefined, { dateStyle: "long" })}`, state: "done" },
        { phase: "Phase 2 · Lead Agency Assignment", title: `Assigned to ${triage.suggestedLeadAgencyCode}`, meta: "In progress · Liaison reviewing jurisdiction", state: "active" },
        { phase: "Phase 3 · Statutory Application Guidance", title: "Official Filing Guidance Packet", meta: triage.statutoryNotice, state: "future" },
        { phase: "Phase 4 · Inter-Agency Coordination", title: "Joint State Review & Milestones", meta: `Target: Day ${Math.round(triage.estimatedDays * 0.6)}`, state: "future" },
        { phase: "Phase 5 · Execution & Sign-off", title: "Agency Determination & Delivery", meta: `Target: Day ${triage.estimatedDays}`, state: "future" },
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
    setRequestMessage(`✓ Request ${newReqId} submitted and routed to ${triage.suggestedLeadAgencyCode} triage queue.`);
    setTimeout(() => setRequestMessage(""), 7000);
  }

  // Filtered requests
  const filteredPermits = userPermits.filter((permit) => {
    const matchesCategory =
      selectedCategory === "all" || permit.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      permit.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      permit.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      permit.leadAgency.toLowerCase().includes(searchQuery.toLowerCase()) ||
      permit.statusLabel.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const ragSummary = calculateRAGSummary(userPermits);
  const agencyWorkload = getAgencyWorkload(userPermits);
  const upcomingDeadlines = getUpcomingDeadlines(userPermits);
  const criticalPathItems = userPermits.filter((p) => p.isCriticalPath);

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-950">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      {/* Pervasive Official Filing Disclaimer Bar */}
      <div className="demo-banner print-keep" role="note">
        <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
        <p>
          <strong>PATH Command Center Demo:</strong> Do not enter real credentials or sensitive information. Official statutory applications, formal filings, and permits continue through designated agency portals. PATH provides state-level operational coordination, critical path tracking, and escalation.
        </p>
      </div>

      {/* Site Header */}
      <header className="site-header print-hide border-b border-slate-800 bg-[#001f3d] text-white">
        <div className="mx-auto flex min-h-18 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            className="group flex items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
            onClick={() => navigate(currentUser ? "dashboard" : "welcome")}
            aria-label={currentUser ? "PATH Command Center, go to dashboard" : "PATH Command Center Home"}
          >
            <PathLogo />
            <span>
              <span className="block text-lg font-black tracking-wide text-white">
                PATH <span className="text-amber-400 font-semibold text-sm">Command Center</span>
              </span>
              <span className="block text-xs text-slate-300">
                Permit Application Tracker & Government Service Coordination
              </span>
            </span>
          </button>

          {currentUser ? (
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              <div className="hidden text-right sm:block">
                <p className="truncate text-xs font-bold text-amber-400">SpaceX Louisiana</p>
                <p className="truncate text-sm text-slate-200">
                  Signed in as <strong className="text-white">{currentUser.name}</strong>
                </p>
              </div>
              <Button
                id="logout"
                type="button"
                variant="outline"
                size="sm"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                onClick={signOut}
              >
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </Button>
            </div>
          ) : (
            <Badge className="border border-white/20 bg-white/10 text-white">
              State & Local Command Center
            </Badge>
          )}
        </div>
      </header>

      <main id="main-content">
        {/* ========================================================================= */}
        {/* VIEW 1: WELCOME / LANDING                                                 */}
        {/* ========================================================================= */}
        {view === "welcome" && (
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
            <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
              <section className="pt-2">
                <Badge variant="outline" className="mb-5 border-teal-700 bg-teal-50 text-teal-900 font-bold px-3 py-1">
                  <Activity className="mr-1.5 size-4 text-teal-700" aria-hidden="true" />
                  Multi-Agency Operational Command Center
                </Badge>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="max-w-2xl text-4xl font-black tracking-tight text-[#00284d] outline-none sm:text-5xl lg:text-6xl"
                >
                  Accelerate major infrastructure through unified state coordination.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
                  PATH bridges SpaceX Louisiana and state agencies—unifying permits, heavy-haul roads, utility grids, public safety corridors, workforce pipelines, and parish engagement into one transparent command center.
                </p>

                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                  {[
                    [Zap, "Critical Path", "Surface inter-agency blockers and schedule bottlenecks before they slip."],
                    [AlertOctagon, "Liaison Escalation", "Three-tier escalation paths from department lead to Governor's Task Force."],
                    [Layers, "Multi-Discipline", "Track permits, roads, power, public safety, workforce, and community needs."],
                  ].map(([Icon, title, body]) => {
                    const FeatureIcon = Icon as typeof Zap;
                    return (
                      <div key={title as string} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                          <FeatureIcon className="size-5" aria-hidden="true" />
                        </div>
                        <h2 className="font-bold text-[#00284d]">{title as string}</h2>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{body as string}</p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <Card className="overflow-hidden border-0 py-0 shadow-xl shadow-slate-900/10">
                <div className="road-stripe" aria-hidden="true" />
                <CardHeader className="px-6 pt-7 sm:px-8">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-800">
                    SpaceX Louisiana Workspace
                  </p>
                  <CardTitle className="text-2xl text-[#00284d]">
                    Pecan Island Spaceport Command Center
                  </CardTitle>
                  <p className="text-sm leading-6 text-slate-600">
                    Access real-time project request tracking, critical path milestones, agency workload metrics, and direct liaison escalation.
                  </p>
                </CardHeader>
                <CardContent className="px-6 pb-8 sm:px-8 space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-950">
                    <p className="font-semibold flex items-center gap-1.5 mb-1">
                      <Info className="size-4 text-amber-700" /> Operational Tracking Boundary
                    </p>
                    <p>Official statutory filings occur directly with DOTD, LDEQ, CPRA, LPSC, and FAA. PATH tracks execution and cross-agency escalations.</p>
                  </div>

                  <Button
                    id="workspace-next"
                    size="lg"
                    type="button"
                    className="h-12 w-full bg-[#00284d] text-base font-bold hover:bg-[#003c70]"
                    onClick={() => navigate("login")}
                  >
                    Enter Command Center
                    <ArrowRight className="ml-2 size-5" aria-hidden="true" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: LOGIN / PERSONA SELECTION                                         */}
        {/* ========================================================================= */}
        {view === "login" && (
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
            <StepIndicator current={2} />
            <Card className="overflow-hidden border-0 py-0 shadow-xl shadow-slate-900/10">
              <div className="road-stripe" aria-hidden="true" />
              <CardHeader className="border-b bg-slate-50 px-6 py-6 sm:px-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-800">
                      <LockKeyhole aria-hidden="true" />
                    </span>
                    <div>
                      <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className="text-2xl font-black text-[#00284d] outline-none"
                      >
                        Sign in to PATH
                      </h1>
                      <p className="mt-1 text-sm text-slate-600">SpaceX Louisiana · Pecan Island Command Center</p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        id="demo-login-trigger"
                        type="button"
                        variant="outline"
                        className="inline-flex items-center gap-2 border-teal-600/40 bg-teal-50 px-3.5 py-2 text-sm font-bold text-teal-900 shadow-xs hover:bg-teal-100 hover:text-teal-950 focus-visible:ring-2 focus-visible:ring-teal-700"
                        aria-label="Demo login options and personas"
                      >
                        <Sparkles className="size-4 text-teal-700" aria-hidden="true" />
                        <span>Demo Login</span>
                        <ChevronDown className="size-4 text-teal-700/80" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-84 max-h-[85vh] overflow-y-auto rounded-xl border-slate-200 bg-white p-2 shadow-2xl sm:w-96"
                    >
                      <DropdownMenuLabel className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-teal-900">
                        Quick Demo Sign-In · Choose Persona
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        SpaceX Louisiana Program Team
                      </div>
                      {demoPersonas
                        .filter((p) => p.group === "SpaceX Louisiana Program")
                        .map((persona) => (
                          <DropdownMenuItem
                            key={persona.id}
                            id={`demo-persona-${persona.id}`}
                            className="flex cursor-pointer flex-col items-start gap-1 rounded-lg px-3 py-2.5 transition hover:bg-teal-50/60 focus:bg-teal-50 focus:text-teal-950"
                            onClick={() => handleDemoPersonaSelect(persona)}
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="text-sm font-bold text-[#00284d]">{persona.name}</span>
                              <Badge
                                variant="outline"
                                className="border-teal-700/30 bg-teal-50 text-[11px] font-semibold text-teal-800"
                              >
                                {persona.badge}
                              </Badge>
                            </div>
                            <div className="text-xs font-semibold text-slate-700">{persona.role}</div>
                            <p className="line-clamp-2 text-[11px] text-slate-500">{persona.roleDescription}</p>
                          </DropdownMenuItem>
                        ))}

                      <DropdownMenuSeparator />
                      <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Applicant Review Scenarios
                      </div>
                      {demoPersonas
                        .filter((p) => p.group === "Applicant Scenarios")
                        .map((persona) => (
                          <DropdownMenuItem
                            key={persona.id}
                            id={`demo-persona-${persona.id}`}
                            className="flex cursor-pointer flex-col items-start gap-1 rounded-lg px-3 py-2.5 transition hover:bg-slate-100 focus:bg-teal-50 focus:text-teal-950"
                            onClick={() => handleDemoPersonaSelect(persona)}
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="text-sm font-bold text-[#00284d]">{persona.name}</span>
                              <Badge
                                variant="outline"
                                className="border-slate-300 bg-slate-100 text-[11px] font-semibold text-slate-700"
                              >
                                {persona.badge}
                              </Badge>
                            </div>
                            <div className="text-xs font-semibold text-slate-700">{persona.role}</div>
                            <p className="line-clamp-2 text-[11px] text-slate-500">{persona.roleDescription}</p>
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="px-6 py-7 sm:px-8">
                <Alert className="mb-7 border-teal-300 bg-teal-50 text-teal-950">
                  <Info className="size-4" aria-hidden="true" />
                  <AlertTitle>Authenticated Command Center Access</AlertTitle>
                  <AlertDescription className="text-teal-900 text-xs sm:text-sm">
                    {supabaseConfigured()
                      ? "Connected to Supabase. Sign in with authorized account or select a Demo Persona from the top right."
                      : "Demo mode active. Use any demo credentials or select a Persona from the quick dropdown above to explore."}
                  </AlertDescription>
                </Alert>

                <form onSubmit={handleLogin}>
                  <div className="grid gap-5">
                    <div className="grid gap-2">
                      <Label htmlFor="username">Email address</Label>
                      <Input
                        ref={usernameRef}
                        id="username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        value={username}
                        required
                        aria-invalid={Boolean(loginError)}
                        aria-describedby={loginError ? "login-error" : undefined}
                        onChange={(event) => {
                          setUsername(event.target.value);
                          setLoginError("");
                        }}
                        className="h-11"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        required
                        aria-invalid={Boolean(loginError)}
                        aria-describedby={loginError ? "login-error" : undefined}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          setLoginError("");
                        }}
                        className="h-11"
                      />
                    </div>
                    {loginError && (
                      <p id="login-error" role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                        {loginError}
                      </p>
                    )}
                    <Button
                      id="login-submit"
                      type="submit"
                      size="lg"
                      className="h-12 bg-[#00284d] text-base font-bold hover:bg-[#003c70]"
                    >
                      {loadingData ? "Loading Command Center…" : "Sign in to Command Center"}
                      <ArrowRight className="ml-2 size-5" aria-hidden="true" />
                    </Button>
                  </div>
                </form>

                <Button
                  type="button"
                  variant="ghost"
                  className="mt-4 w-full text-slate-600 hover:text-slate-900"
                  onClick={() => navigate("welcome")}
                >
                  <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
                  Return to overview
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: EXECUTIVE COMMAND CENTER DASHBOARD                                 */}
        {/* ========================================================================= */}
        {view === "dashboard" && currentUser && (
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 space-y-8">
            {/* Header / Persona Title */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
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
                  Pecan Island Project Command Center
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Welcome back, <strong className="text-slate-900">{firstName(currentUser.name)}</strong> ({currentUser.scenario}). Real-time government service & permit tracking.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 shadow-xs">
                  {userPermits.length} Active Requests
                </Badge>
              </div>
            </div>

            {/* =================================================================== */}
            {/* 1. EXECUTIVE RAG HEALTH STATUS BAR                                  */}
            {/* =================================================================== */}
            <section aria-label="Executive Health Metrics">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">🟢 On Track / Done</span>
                    <CheckCircle2 className="size-4 text-emerald-700" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-emerald-950 sm:text-3xl">
                    {ragSummary.green}
                  </div>
                  <p className="mt-0.5 text-[11px] text-emerald-700">Moving within statutory SLA</p>
                </div>

                <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800">🟡 Action / Hearings</span>
                    <AlertTriangle className="size-4 text-amber-700" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-amber-950 sm:text-3xl">
                    {ragSummary.yellow}
                  </div>
                  <p className="mt-0.5 text-[11px] text-amber-700">Needs applicant or public step</p>
                </div>

                <div className="rounded-xl border border-red-300 bg-red-50/90 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-red-800">🔴 Blocked / Risk</span>
                    <AlertOctagon className="size-4 text-red-700 animate-pulse" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-red-950 sm:text-3xl">
                    {ragSummary.red}
                  </div>
                  <p className="mt-0.5 text-[11px] text-red-700">Escalated to Inter-Agency Liaison</p>
                </div>

                <div className="rounded-xl border border-indigo-300 bg-indigo-50/80 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">⚡ Critical Path</span>
                    <Zap className="size-4 text-indigo-700" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-indigo-950 sm:text-3xl">
                    {ragSummary.criticalPathCount}
                  </div>
                  <p className="mt-0.5 text-[11px] text-indigo-700">Directly drives launch go-live</p>
                </div>
              </div>
            </section>

            {/* =================================================================== */}
            {/* 2. CRITICAL PATH & ACTIVE BLOCKER SPOTLIGHT                         */}
            {/* =================================================================== */}
            {userPermits.some((p) => p.ragStatus === "red" && p.blocker) && (
              <section aria-label="Critical Path Blocker Alert">
                {userPermits
                  .filter((p) => p.ragStatus === "red" && p.blocker)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border-2 border-red-500 bg-red-50 p-5 shadow-sm space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex size-8 items-center justify-center rounded-lg bg-red-600 text-white font-bold text-xs">
                            <AlertOctagon className="size-4" />
                          </span>
                          <div>
                            <h2 className="font-extrabold text-red-950 text-base">
                              CRITICAL PATH BLOCKER · {item.id}: {item.title}
                            </h2>
                            <p className="text-xs text-red-800">
                              Lead Agency: <strong>{item.leadAgency}</strong> · Blocked Duration: {item.blocker?.blockedSince}
                            </p>
                          </div>
                        </div>

                        <Badge className="border border-red-600 bg-red-600 text-white font-bold">
                          Escalated: Level 2 State Liaison
                        </Badge>
                      </div>

                      <div className="rounded-lg bg-white/90 p-3.5 border border-red-200 text-xs sm:text-sm text-slate-800 space-y-2">
                        <p><strong>Blocker:</strong> {item.blocker?.description}</p>
                        <div className="flex items-center gap-2 text-red-900 font-semibold">
                          <ArrowRight className="size-4 shrink-0 text-red-600" />
                          <span><strong>Immediate Unblocking Action:</strong> {item.blocker?.unblockingAction}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-red-900">
                        <span>Assigned State Owner: <strong>{item.owner.name}</strong> ({item.owner.phone})</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-400 bg-white text-red-950 hover:bg-red-100 font-bold"
                          onClick={() => openPermit(item.id)}
                        >
                          View Blocker & Escalation Path
                          <ChevronRight className="ml-1 size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </section>
            )}

            {/* =================================================================== */}
            {/* 3. SIDE-BY-SIDE COMMAND WIDGETS (Agency Workload & Deadlines)       */}
            {/* =================================================================== */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Agency Workload Breakdown */}
              <Card className="border border-slate-200 bg-white shadow-xs">
                <CardHeader className="border-b border-slate-100 pb-3.5 pt-5 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-extrabold text-[#00284d] flex items-center gap-2">
                      <Building2 className="size-4 text-teal-700" /> Agency Workload Distribution
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] text-slate-600">
                      {agencyWorkload.length} Agencies
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">Cross-agency operational case loads & bottlenecks</p>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                  {agencyWorkload.slice(0, 5).map((agency) => (
                    <div key={agency.agencyCode} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-[#00284d] flex items-center gap-1.5">
                          <strong>{agency.agencyCode}</strong>
                          <span className="text-slate-500 font-normal truncate max-w-[180px] sm:max-w-xs">{agency.agencyName}</span>
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
            {/* 4. SPACEX PLAIN-ENGLISH INTAKE & LIAISON TRIAGE                     */}
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
                        Submit a Plain-English Government Service or Permit Need
                      </CardTitle>
                      <p className="text-xs text-slate-600">
                        State Liaison Triage auto-categorizes your requirement and routes it to the designated agency lead.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-teal-700 bg-teal-50 text-teal-900 font-bold text-xs">
                    Liaison Triage Engine Active
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
                    "Airspace NOTAM safety corridor coordination with FAA and Coast Guard",
                    "Aerospace welding and NDT technician workforce training program with SLCC",
                    "Pecan Island residential drinking water well testing protocol",
                  ].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setIntakeText(example)}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 transition hover:border-teal-400 hover:bg-teal-50 hover:text-teal-900"
                    >
                      {example.slice(0, 38)}…
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
                          <Sparkles className="size-4 text-teal-700" /> Automatic Liaison Triage Analysis
                        </span>
                        <Badge className={categoryBadgeClasses(intakePreview.detectedCategory)}>
                          {intakePreview.categoryLabel}
                        </Badge>
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
            {/* 5. MULTI-CATEGORY FILTERABLE REQUEST MATRIX                         */}
            {/* =================================================================== */}
            <section aria-labelledby="matrix-heading" className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 id="matrix-heading" className="text-xl font-black text-[#00284d]">
                    Service Request & Permit Matrix
                  </h2>
                  <p className="text-xs text-slate-500">
                    Comprehensive cross-agency coordination tracker for Pecan Island
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

              {/* Request Cards Grid */}
              <div className="space-y-3 pt-2">
                {filteredPermits.map((permit) => {
                  const progress = permitProgress(permit);
                  return (
                    <button
                      id={`request-card-${permit.id}`}
                      key={permit.id}
                      type="button"
                      className="group flex w-full flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-teal-600 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                      onClick={() => openPermit(permit.id)}
                    >
                      {/* Left: Metadata & Title */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-black text-[#00284d] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {permit.id}
                          </span>
                          <Badge variant="outline" className={`text-[11px] ${categoryBadgeClasses(permit.category)}`}>
                            {categoryIcon(permit.category)}
                            <span className="ml-1">{permit.categoryLabel}</span>
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

                        <h3 className="text-base font-extrabold text-[#00284d] group-hover:text-teal-800 transition">
                          {permit.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span>Lead Agency: <strong className="text-slate-800">{permit.leadAgency}</strong></span>
                          <span>Owner: <strong className="text-slate-800">{permit.owner.name}</strong></span>
                          <span>Target: <strong className="text-slate-800">{permit.targetDate}</strong></span>
                        </div>
                      </div>

                      {/* Right: Progress & Action */}
                      <div className="flex w-full items-center justify-between sm:w-56 shrink-0 gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        <div className="w-full space-y-1.5">
                          <div className="flex justify-between text-[11px] font-bold text-slate-600">
                            <span>Day {permit.currentDay} of {permit.totalDays}</span>
                            <span>{progress}%</span>
                          </div>
                          <Progress
                            value={progress}
                            aria-label={`${progress}% complete`}
                            className={`h-2 ${
                              permit.ragStatus === "red"
                                ? "[&_[data-slot=progress-indicator]]:bg-red-600"
                                : permit.ragStatus === "yellow"
                                  ? "[&_[data-slot=progress-indicator]]:bg-amber-500"
                                  : "[&_[data-slot=progress-indicator]]:bg-teal-700"
                            }`}
                          />
                        </div>

                        <ChevronRight className="size-5 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-teal-800" />
                      </div>
                    </button>
                  );
                })}

                {filteredPermits.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
                    <Filter className="mx-auto size-8 text-slate-400 mb-2" />
                    <p className="font-bold text-slate-700">No requests found matching your filter</p>
                    <p className="text-xs mt-1">Try selecting a different category or clearing your search term.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 4: DEEP REQUEST & ESCALATION DETAIL VIEW                              */}
        {/* ========================================================================= */}
        {view === "detail" && selectedPermit && (
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
            {/* Top Navigation & Print Trigger */}
            <div className="flex flex-wrap items-center justify-between gap-4 print-hide">
              <Button
                type="button"
                variant="outline"
                onClick={() => setView("dashboard")}
                className="font-bold text-[#00284d]"
              >
                <ArrowLeft className="mr-2 size-4" />
                Back to Command Center
              </Button>

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

                <p className="text-sm text-slate-600">
                  Applicant: <strong>{selectedPermit.applicant}</strong> ({selectedPermit.organization}) · Lead Agency: <strong>{selectedPermit.leadAgency}</strong>
                </p>
              </CardHeader>

              <CardContent className="p-6 sm:p-8 space-y-8">
                {/* 1. Blocker & Escalation Banner (if applicable) */}
                {selectedPermit.blocker && (
                  <div className="rounded-xl border-2 border-red-500 bg-red-50 p-5 space-y-3">
                    <div className="flex items-center gap-2 text-red-950 font-black text-base">
                      <AlertOctagon className="size-5 text-red-600" />
                      <span>{selectedPermit.blocker.title}</span>
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

                {/* 3. 5-Phase Timeline */}
                <div className="space-y-4">
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#00284d] flex items-center gap-2">
                    <Route className="size-4 text-teal-700" /> Review & Execution Milestones
                  </h2>
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
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">{step.phase}</span>
                            <span className="font-mono text-xs text-slate-400">Step {index + 1}</span>
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
                      <User className="size-3.5" /> Assigned State Lead / Owner
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
          </div>
        )}
      </main>
    </div>
  );
}
