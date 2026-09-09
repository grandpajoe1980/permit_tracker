"use client";

import { useState, type FormEvent, type RefObject } from "react";
import { ArrowRight, ChevronDown, Sparkles, User, Zap, Search } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_NAME, PROGRAM_SUBTITLE } from "@/lib/product-copy";
import { demoPersonas, type DemoPersona } from "@/lib/demo-data";
import { SystemVersionFooter } from "@/components/SystemVersionFooter";

type LoginPageProps = {
  hydrated: boolean;
  username: string;
  password: string;
  loginError: string;
  loadingData: boolean;
  showDemoPeople: boolean;
  usernameRef: RefObject<HTMLInputElement | null>;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onDemoPersonaSelect: (persona: DemoPersona) => void | Promise<void>;
  onToggleDemoPeople: () => void;
};

function demoPersonaDomId(persona: DemoPersona) {
  const ids: Record<string, string> = { "alex-martin": "alex", "maya-chen": "maya", "sarah-johnson": "sarah", "jordan-lee": "jordan" };
  return ids[persona.id] ?? persona.id;
}

export function LoginPage({
  hydrated,
  username,
  password,
  loginError,
  loadingData,
  showDemoPeople,
  usernameRef,
  onUsernameChange,
  onPasswordChange,
  onLogin,
  onDemoPersonaSelect,
  onToggleDemoPeople,
}: LoginPageProps) {
  const [personaSearch, setPersonaSearch] = useState("");

  const query = personaSearch.trim().toLowerCase();
  const filteredPersonas = demoPersonas.filter(
    (p) =>
      !query ||
      p.name.toLowerCase().includes(query) ||
      p.role.toLowerCase().includes(query) ||
      (p.organization && p.organization.toLowerCase().includes(query)) ||
      (p.badge && p.badge.toLowerCase().includes(query))
  );

  // Grouped projection from demoPersonas.map
  const featuredIds = ["alex-martin", "jordan-lee", "joe-skaggs"];
  const featured = filteredPersonas.filter((p) => featuredIds.includes(p.id));

  const customerGroup = filteredPersonas.filter(
    (p) => p.id === "alex-martin" || p.id === "maya-chen" || p.badge.toLowerCase().includes("customer")
  );
  const adminGroup = filteredPersonas.filter(
    (p) => p.id === "joe-skaggs" || p.badge.toLowerCase().includes("admin")
  );
  const staffGroup = filteredPersonas.filter(
    (p) => !customerGroup.some((c) => c.id === p.id) && !adminGroup.some((a) => a.id === p.id)
  );

  const renderPersonaButton = (persona: DemoPersona, highlight?: boolean) => (
    <button
      key={persona.id}
      id={`demo-persona-${demoPersonaDomId(persona)}`}
      type="button"
      disabled={loadingData}
      onClick={() => void onDemoPersonaSelect(persona)}
      className={`flex w-full items-start justify-between rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
        highlight
          ? "border-teal-300 bg-teal-50/50 hover:border-teal-500 hover:bg-teal-50 shadow-2xs"
          : "border-slate-200 bg-white hover:border-teal-500 hover:bg-slate-50"
      }`}
    >
      <div className="min-w-0 flex-1 pr-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-[#00284d] truncate">{persona.name}</span>
          {highlight && (
            <span className="rounded bg-teal-100 px-1.5 py-0.2 text-[9px] font-bold uppercase text-teal-900">
              Walkthrough
            </span>
          )}
        </div>
        <span className="block text-xs font-semibold text-slate-600">{persona.role}</span>
        <span className="block text-[11px] text-slate-400 truncate">
          {persona.organization || persona.group}
        </span>
      </div>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600 shrink-0">
        {persona.badge}
      </span>
    </button>
  );

  return (
    <div id="login-shell" data-hydrated={hydrated ? "true" : "false"} className="min-h-screen bg-[#f3f6f7] text-[#172033]">
      <div className="road-stripe" />
      <header className="site-header">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-8">
          <span className="flex size-10 items-center justify-center rounded-lg bg-[#f4a100] text-[#00284d]"><Zap className="size-6 fill-current" aria-hidden="true" /></span>
          <div><p className="text-lg font-black tracking-tight text-white">{PRODUCT_NAME}</p><p className="text-xs font-semibold text-slate-200">{PROGRAM_SUBTITLE}</p></div>
        </div>
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-88px)] max-w-xl items-center justify-center px-4 py-10 sm:px-8">
        <Card className="w-full border-slate-200 bg-white shadow-xl">
          <CardHeader className="border-b border-slate-100 bg-slate-50">
            <CardTitle className="flex items-center gap-2 text-xl font-black text-[#00284d]"><User className="size-5 text-teal-700" /> Sign in to {PRODUCT_NAME}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <form onSubmit={onLogin} className="space-y-4">
              <div><Label htmlFor="username">Email address / username</Label><Input ref={usernameRef} id="username" name="username" type="text" value={username} required onChange={(event) => onUsernameChange(event.target.value)} className="mt-1 h-11" placeholder="jordan.lee@la.gov" /></div>
              <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" value={password} required onChange={(event) => onPasswordChange(event.target.value)} className="mt-1 h-11" placeholder="demo1234" /></div>
              <Button id="login-submit" type="submit" disabled={loadingData} className="h-11 w-full bg-[#00284d] font-bold hover:bg-[#003c70]">{loadingData ? "Signing in…" : "Sign In"}<ArrowRight className="size-4" aria-hidden="true" /></Button>
            </form>
            {loginError && <p id="login-error" role="alert" aria-live="assertive" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">{loginError}</p>}
            <div className="border-t border-slate-100 pt-4">
              <Button id="demo-login-trigger" type="button" variant="outline" aria-expanded={showDemoPeople} className="w-full justify-between border-teal-300 bg-teal-50 font-bold text-teal-950" onClick={onToggleDemoPeople}><span className="flex items-center gap-2"><Sparkles className="size-4 text-teal-700" aria-hidden="true" /> Quick Demo Sign-In</span><ChevronDown className={`size-4 transition-transform ${showDemoPeople ? "rotate-180" : ""}`} aria-hidden="true" /></Button>
              {showDemoPeople && <div className="mt-3 max-h-[52vh] space-y-2 overflow-y-auto pr-1" aria-label="Demo personas">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" aria-hidden="true" />
                  <Input
                    type="search"
                    aria-label="Search demo personas"
                    placeholder="Search personas by name, role, or team..."
                    value={personaSearch}
                    onChange={(e) => setPersonaSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
                  />
                </div>

                {!query && featured.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-teal-800">
                      Featured Walkthrough Personas
                    </p>
                    <div className="space-y-1.5">
                      {featured.map((p) => renderPersonaButton(p, true))}
                    </div>
                  </div>
                )}

                {customerGroup.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Customer (SpaceX)
                    </p>
                    <div className="space-y-1.5">
                      {customerGroup.map((p) => renderPersonaButton(p))}
                    </div>
                  </div>
                )}

                {staffGroup.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Government Staff
                    </p>
                    <div className="space-y-1.5">
                      {staffGroup.map((p) => renderPersonaButton(p))}
                    </div>
                  </div>
                )}

                {adminGroup.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Administration
                    </p>
                    <div className="space-y-1.5">
                      {adminGroup.map((p) => renderPersonaButton(p))}
                    </div>
                  </div>
                )}

                {filteredPersonas.length === 0 && (
                  <p className="py-4 text-center text-xs text-slate-500">
                    No demo personas match “{personaSearch}”.
                  </p>
                )}
              </div>}
            </div>
          </CardContent>
        </Card>
      </main>
      <SystemVersionFooter />
    </div>
  );
}
