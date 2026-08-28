"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  ExternalLink,
  FilePlus2,
  Info,
  Landmark,
  Leaf,
  LockKeyhole,
  LogOut,
  Mail,
  Printer,
  Route,
  ShieldAlert,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  agencies,
  type Agency,
  type DemoAccount,
  type PermitRecord,
  type PermitStatus,
  type StepState,
} from "@/lib/demo-data";
import {
  firstName,
  permitProgress,
} from "@/lib/permit-utils";
import {
  getBrowserUser,
  getSupabaseBrowserClient,
  loadRequestsForUser,
  signInWithPassword,
  signOutBrowser,
  supabaseConfigured,
} from "@/lib/supabase-browser";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

type View = "welcome" | "login" | "dashboard" | "detail";

const ldeqApplicationUrl =
  "https://www.deq.louisiana.gov/about-ldeq/office-of-environmental-services-welcome";

const viewTitles: Record<View, string> = {
  welcome: "Track a permit application",
  login: "Sign in to PATH",
  dashboard: "My applications",
  detail: "Application detail",
};

function statusClasses(status: PermitStatus) {
  if (status === "action-needed") return "border-amber-300 bg-amber-50 text-amber-950";
  if (status === "hearing") return "border-violet-300 bg-violet-50 text-violet-950";
  return "border-sky-300 bg-sky-50 text-sky-950";
}

function statusIcon(status: PermitStatus) {
  if (status === "action-needed") return <AlertTriangle aria-hidden="true" />;
  if (status === "hearing") return <Landmark aria-hidden="true" />;
  return <Clock3 aria-hidden="true" />;
}

function stepIcon(state: StepState) {
  if (state === "done") return <Check aria-hidden="true" />;
  if (state === "blocked") return <AlertTriangle aria-hidden="true" />;
  if (state === "hearing") return <Landmark aria-hidden="true" />;
  if (state === "active") return <Circle className="fill-current" aria-hidden="true" />;
  return <Circle aria-hidden="true" />;
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
  const labels = ["Agency", "Sign in", "Applications"];
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

function StatusBadge({ permit }: { permit: PermitRecord }) {
  return (
    <Badge variant="outline" className={`h-7 px-3 ${statusClasses(permit.status)}`}>
      {statusIcon(permit.status)}
      {permit.statusLabel}
    </Badge>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("welcome");
  const [selectedAgencyId, setSelectedAgencyId] = useState<Agency["id"] | null>(null);
  const [currentUser, setCurrentUser] = useState<DemoAccount | null>(null);
  const [selectedPermitId, setSelectedPermitId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [userPermits, setUserPermits] = useState<PermitRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const hasMountedRef = useRef(false);

  const selectedAgency = agencies.find((agency) => agency.id === selectedAgencyId) ?? null;
  const selectedPermit = selectedPermitId ? userPermits.find((permit) => permit.id === selectedPermitId) ?? null : null;

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    void getBrowserUser().then(async (user) => {
      if (!active || !user) return;
      const { permits } = await loadRequestsForUser();
      if (!active) return;
      setCurrentUser({ username: user.email ?? "", name: String(user.user_metadata?.full_name ?? user.email ?? "User"), agencyId: "ldeq", applicationIds: permits.map((permit) => permit.id), scenario: "Authenticated account" });
      setUserPermits(permits);
      setSelectedAgencyId("ldeq");
      setView("dashboard");
    });
    const { data: listener } = client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        setCurrentUser(null);
        setUserPermits([]);
      }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
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
    if (!selectedAgencyId) { setLoginError("Select an agency before signing in."); return; }
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
    if (loaded.error) { setLoginError(`Signed in, but applications could not be loaded: ${loaded.error.message}`); return; }
    setLoginError("");
    const account: DemoAccount = { username: user.email ?? "", name: String(user.user_metadata?.full_name ?? user.email ?? "User"), agencyId: selectedAgencyId, applicationIds: loaded.permits.map((permit) => permit.id), scenario: "Authenticated account" };
    setCurrentUser(account);
    setUserPermits(loaded.permits);
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
    setSelectedAgencyId(null);
    setUsername("");
    setPassword("");
    setLoginError("");
    setUserPermits([]);
    setView("welcome");
  }

  return (
    <div className="min-h-screen bg-[#f3f6f7] text-slate-950">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <div className="demo-banner print-keep" role="note">
        <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
          <p><strong>PATH secure portal.</strong> Application data is loaded from your authorized Supabase account. Never share your password.</p>
      </div>

      <header className="site-header print-hide">
        <div className="mx-auto flex min-h-18 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            className="group flex items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
            onClick={() => navigate(currentUser ? "dashboard" : "welcome")}
            aria-label={currentUser ? "PATH home, go to my applications" : "PATH home"}
          >
            <PathLogo />
            <span>
              <span className="block text-lg font-extrabold tracking-wide text-white">PATH</span>
              <span className="block text-xs text-slate-300">Permit Application Tracker</span>
            </span>
          </button>

          {currentUser ? (
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              <p className="hidden truncate text-sm text-slate-300 sm:block">
                Signed in as <strong className="text-white">{currentUser.name}</strong>
              </p>
              <Button
                id="logout"
                type="button"
                variant="outline"
                size="sm"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                onClick={signOut}
              >
                <LogOut aria-hidden="true" />
                Sign out
              </Button>
            </div>
          ) : (
            <Badge className="border border-white/20 bg-white/10 text-white">Secure portal</Badge>
          )}
        </div>
      </header>

      <main id="main-content">
        {view === "welcome" && (
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
            <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
              <section className="pt-2">
                <Badge variant="outline" className="mb-5 border-teal-700 bg-teal-50 text-teal-900">
                  <Route aria-hidden="true" />
                  One clear path through the process
                </Badge>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="max-w-2xl text-4xl font-black tracking-tight text-[#00284d] outline-none sm:text-6xl"
                >
                  Track a permit application without the guesswork.
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                  Explore how an applicant could see review milestones, urgent actions, and next steps in one accessible status portal.
                </p>

                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                  {[
                    [Clock3, "Clear status", "See the current phase and target timeline."],
                    [AlertTriangle, "Action alerts", "Bring deadlines and requested information to the front."],
                    [Route, "Visible path", "Understand what is complete and what comes next."],
                  ].map(([Icon, title, body]) => {
                    const FeatureIcon = Icon as typeof Clock3;
                    return (
                      <div key={title as string} className="border-l-4 border-teal-700 pl-4">
                        <FeatureIcon className="mb-2 size-5 text-teal-800" aria-hidden="true" />
                        <h2 className="font-bold text-[#00284d]">{title as string}</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{body as string}</p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <Card className="overflow-hidden border-0 py-0 shadow-xl shadow-slate-900/10">
                <div className="road-stripe" aria-hidden="true" />
                <CardHeader className="px-6 pt-7 sm:px-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-800">Step 1 of 3</p>
                  <CardTitle className="text-2xl text-[#00284d]">Select your agency</CardTitle>
                  <p className="text-sm leading-6 text-slate-600">Choose the agency for your account.</p>
                </CardHeader>
                <CardContent className="space-y-3 px-6 pb-8 sm:px-8">
                  <div className="space-y-3" role="group" aria-label="Available agencies">
                    {agencies.map((agency) => {
                      const selected = agency.id === selectedAgencyId;
                      return (
                        <button
                          key={agency.id}
                          id={`agency-tile-${agency.id}`}
                          type="button"
                          disabled={!agency.enabled}
                          aria-pressed={agency.enabled ? selected : undefined}
                          onClick={() => agency.enabled && setSelectedAgencyId(agency.id)}
                          className={`agency-option ${selected ? "agency-option-selected" : ""}`}
                        >
                          <span className={`agency-icon ${agency.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                            {agency.id === "ldeq" ? <Leaf aria-hidden="true" /> : <Building2 aria-hidden="true" />}
                          </span>
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block font-extrabold text-[#00284d]">{agency.abbreviation}</span>
                            <span className="block text-sm font-semibold text-slate-800">{agency.name}</span>
                            <span className="mt-1 block text-xs leading-5 text-slate-500">{agency.description}</span>
                          </span>
                          {agency.enabled ? (
                            <span className={`selection-mark ${selected ? "selection-mark-selected" : ""}`} aria-hidden="true">
                              {selected && <Check className="size-4" />}
                            </span>
                          ) : (
                            <Badge variant="secondary">Coming later</Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    id="agency-next"
                    size="lg"
                    type="button"
                    disabled={!selectedAgencyId}
                    className="mt-3 h-12 w-full bg-[#00284d] text-base hover:bg-[#003c70]"
                    onClick={() => navigate("login")}
                  >
                    Continue to sign in
                    <ArrowRight aria-hidden="true" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {view === "login" && (
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
            <StepIndicator current={2} />
            <Card className="overflow-hidden border-0 py-0 shadow-xl shadow-slate-900/10">
              <div className="road-stripe" aria-hidden="true" />
              <CardHeader className="border-b bg-slate-50 px-6 py-7 sm:px-8">
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
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedAgency?.abbreviation} · {selectedAgency?.name}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-6 py-7 sm:px-8">
                <Alert className="mb-7 border-teal-300 bg-teal-50 text-teal-950">
                  <Info aria-hidden="true" />
                  <AlertTitle>Sign in with your PATH account</AlertTitle>
                  <AlertDescription className="text-teal-900">
                    {supabaseConfigured() ? "Connected to Supabase. Your access is enforced by Supabase Auth and row-level security; applications are limited to your authorized account." : "Supabase is not configured in this deployment. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the environment settings."}
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
                        type="email"
                        autoComplete="email"
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
                    <Button id="login-submit" type="submit" size="lg" className="h-12 bg-[#00284d] text-base hover:bg-[#003c70]">
                      {loadingData ? "Loading applications…" : "Sign in and view applications"}
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  </div>
                </form>

                <Button type="button" variant="ghost" className="mt-4 w-full" onClick={() => navigate("welcome")}>
                  <ArrowLeft aria-hidden="true" />
                  Change agency
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {view === "dashboard" && currentUser && (
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
            <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-800">LDEQ workspace</p>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-3xl font-black tracking-tight text-[#00284d] outline-none sm:text-4xl"
                >
                  Welcome back, {firstName(currentUser.name)}
                </h1>
                <p className="mt-2 text-slate-600">Showing applications authorized for your account.</p>
              </div>
              <Badge variant="outline" className="border-slate-300 bg-white px-3 py-1 text-slate-700">
                {userPermits.length} application{userPermits.length === 1 ? "" : "s"}
              </Badge>
            </div>

            {userPermits
              .filter((permit) => permit.status === "action-needed" && permit.alert)
              .map((permit) => (
                <Alert key={permit.id} className="mb-6 border-amber-400 bg-amber-50 text-amber-950 shadow-sm">
                  <AlertTriangle aria-hidden="true" />
                  <AlertTitle>Action required · {permit.id}</AlertTitle>
                  <AlertDescription className="text-amber-900">{permit.alert?.body}</AlertDescription>
                </Alert>
              ))}

            <a
              id="new-permit-link"
              href={ldeqApplicationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-6 flex items-center gap-4 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50 p-5 text-left transition hover:border-teal-600 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white text-teal-800 shadow-sm">
                <FilePlus2 aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold text-[#00284d]">Apply for a new permit</span>
                <span className="mt-1 block text-sm text-slate-600">Visit LDEQ&apos;s official Office of Environmental Services page.</span>
              </span>
              <ExternalLink className="size-5 shrink-0 text-teal-800" aria-hidden="true" />
              <span className="sr-only">Opens in a new tab</span>
            </a>

            <section aria-labelledby="application-list-title">
              <h2 id="application-list-title" className="sr-only">My applications</h2>
              <div className="space-y-4">
                {userPermits.map((permit) => {
                  const progress = permitProgress(permit);
                  return (
                    <button
                      id={`application-card-${permit.id}`}
                      key={permit.id}
                      type="button"
                      className="application-card group"
                      onClick={() => openPermit(permit.id)}
                    >
                      <span className={`status-rail ${permit.status}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1 text-left">
                        <span className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-black tracking-wide text-[#00284d]">{permit.id}</span>
                          <StatusBadge permit={permit} />
                        </span>
                        <span className="block text-base font-bold text-slate-900">{permit.type}</span>
                        <span className="mt-1 block text-sm text-slate-500">{permit.applicant} · Submitted {permit.submitted}</span>
                      </span>
                      <span className="w-full sm:w-52">
                        <span className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600">
                          <span>Day {permit.currentDay}</span>
                          <span>{progress}% of target</span>
                        </span>
                        <Progress
                          value={progress}
                          aria-label={`${progress}% of the target timeline elapsed`}
                          className={`h-2 bg-slate-200 ${permit.status === "action-needed" ? "[&_[data-slot=progress-indicator]]:bg-amber-600" : "[&_[data-slot=progress-indicator]]:bg-teal-700"}`}
                        />
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-teal-800" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {view === "detail" && currentUser && selectedPermit && (
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
            <Button type="button" variant="ghost" className="print-hide mb-4 -ml-3" onClick={() => navigate("dashboard")}>
              <ArrowLeft aria-hidden="true" />
              Back to my applications
            </Button>

            <article className="permit-detail overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-900/10">
              <div className="road-stripe print-hide" aria-hidden="true" />
              <div className="border-b px-5 py-6 sm:px-8 sm:py-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-800">Application summary</p>
                    <h1
                      ref={headingRef}
                      tabIndex={-1}
                      className="font-mono text-2xl font-black tracking-tight text-[#00284d] outline-none sm:text-3xl"
                    >
                      {selectedPermit.id}
                    </h1>
                    <p className="mt-2 font-semibold text-slate-800">{selectedPermit.type}</p>
                    <p className="mt-1 text-sm text-slate-500">{selectedPermit.applicant}</p>
                  </div>
                  <StatusBadge permit={selectedPermit} />
                </div>
              </div>

              <div className="grid border-b sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Date submitted", selectedPermit.submitted],
                  ["Illustrative day", `Day ${selectedPermit.currentDay} of ${selectedPermit.totalDays}`],
                  ["Permit type", "Individual permit (IP)"],
                  ["Agency", "LDEQ"],
                ].map(([label, value]) => (
                  <div key={label} className="border-b px-5 py-4 last:border-b-0 sm:border-r sm:px-6 lg:border-b-0 lg:last:border-r-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-10 px-5 py-7 sm:px-8 sm:py-9">
                {selectedPermit.alert && (
                  <Alert
                    className={
                      selectedPermit.alert.tone === "warning"
                        ? "border-amber-400 bg-amber-50 text-amber-950"
                        : "border-violet-300 bg-violet-50 text-violet-950"
                    }
                  >
                    {selectedPermit.alert.tone === "warning" ? <AlertTriangle aria-hidden="true" /> : <Landmark aria-hidden="true" />}
                    <AlertTitle>{selectedPermit.alert.title}</AlertTitle>
                    <AlertDescription className={selectedPermit.alert.tone === "warning" ? "text-amber-900" : "text-violet-900"}>
                      {selectedPermit.alert.body}
                    </AlertDescription>
                  </Alert>
                )}

                <section aria-labelledby="timeline-title">
                  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="section-kicker">Application progress</p>
                      <h2 id="timeline-title" className="text-xl font-black text-[#00284d]">Milestone timeline</h2>
                    </div>
                    <p className="text-sm font-bold text-teal-800">{permitProgress(selectedPermit)}% of target</p>
                  </div>
                  <Progress
                    value={permitProgress(selectedPermit)}
                    aria-label={`${permitProgress(selectedPermit)}% of the target timeline elapsed`}
                    className={`mb-8 h-3 bg-slate-200 ${selectedPermit.status === "action-needed" ? "[&_[data-slot=progress-indicator]]:bg-amber-600" : "[&_[data-slot=progress-indicator]]:bg-teal-700"}`}
                  />

                  <ol className="timeline-list">
                    {selectedPermit.steps.map((step, index) => (
                      <li key={`${step.title}-${index}`} className="timeline-step">
                        <span className={`timeline-dot ${stepClasses(step.state)}`}>{stepIcon(step.state)}</span>
                        <div className="min-w-0 pb-7">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{step.phase}</p>
                          <h3 className={`mt-1 font-extrabold ${step.state === "future" ? "text-slate-500" : "text-slate-900"}`}>{step.title}</h3>
                          <p className={`mt-1 text-sm ${step.state === "blocked" ? "font-semibold text-red-800" : "text-slate-600"}`}>{step.meta}</p>
                          {step.note && (
                            <p className={`mt-3 rounded-lg border-l-4 px-4 py-3 text-sm leading-6 ${step.state === "blocked" ? "border-red-700 bg-red-50 text-red-900" : step.state === "hearing" ? "border-violet-700 bg-violet-50 text-violet-900" : "border-teal-700 bg-teal-50 text-teal-900"}`}>
                              {step.note}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>

                <section aria-labelledby="next-steps-title">
                  <p className="section-kicker">What happens next</p>
                  <h2 id="next-steps-title" className="mb-5 text-xl font-black text-[#00284d]">Scenario next steps</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedPermit.nextSteps.map((nextStep, index) => (
                      <div key={nextStep.title} className="flex gap-3 rounded-xl border bg-slate-50 p-4">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#00284d] text-xs font-bold text-white">{index + 1}</span>
                        <div>
                          <h3 className="font-extrabold text-slate-900">{nextStep.title}</h3>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{nextStep.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="flex flex-col gap-5 rounded-xl bg-[#00284d] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-labelledby="contact-title">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-teal-200">Example agency contact</p>
                    <h2 id="contact-title" className="mt-1 font-extrabold">{selectedPermit.contact.name}</h2>
                    <div className="mt-2 flex flex-col gap-1 text-sm text-slate-200 sm:flex-row sm:flex-wrap sm:gap-x-4">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="size-4" aria-hidden="true" />
                        {selectedPermit.contact.email}
                      </span>
                      <span>{selectedPermit.contact.phone}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-300">Fictional contact details. Verify real contacts on the official agency website.</p>
                  </div>
                  <Button type="button" variant="outline" className="print-hide border-white/30 bg-white text-[#00284d] hover:bg-slate-100" onClick={() => window.print()}>
                    <Printer aria-hidden="true" />
                    Print summary
                  </Button>
                </section>
              </div>
            </article>
          </div>
        )}

        <span className="sr-only" aria-live="polite">
          {viewTitles[view]}
        </span>
      </main>

      <footer className="site-footer print-keep">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs leading-5 sm:px-6">
          <p className="font-bold text-slate-800">PATH is an application tracking portal.</p>
          <p>Application status and records are provided by participating agencies. Verify official notices through your agency contact.</p>
        </div>
      </footer>
    </div>
  );
}
