"use client";

import type { FormEvent, RefObject } from "react";
import { ArrowRight, ChevronDown, Sparkles, User, Zap } from "lucide-react";

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
              {showDemoPeople && <div className="mt-3 space-y-2" aria-label="Demo personas">
                {demoPersonas.map((persona) => <button key={persona.id} id={`demo-persona-${demoPersonaDomId(persona)}`} type="button" onClick={() => void onDemoPersonaSelect(persona)} className="flex w-full items-start justify-between rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-teal-500 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><span><span className="block text-sm font-black text-[#00284d]">{persona.name}</span><span className="block text-xs font-semibold text-slate-500">{persona.role}</span></span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">{persona.badge}</span></button>)}
              </div>}
            </div>
          </CardContent>
        </Card>
      </main>
      <SystemVersionFooter />
    </div>
  );
}
