"use client";

import React, { useState, type ReactNode } from "react";
import { Zap, Bell, LogOut, Menu, User, ArrowRight, Settings2, X } from "lucide-react";
import type { OperationalPersona } from "@/lib/operational-ux";
import type { AppRoute } from "@/lib/navigation";
import { Button } from "@/components/ui/button";

export interface NavItem {
  id: AppRoute;
  label: string;
  icon: ReactNode;
  count?: number;
}

export interface AppShellProps {
  activePersona: OperationalPersona;
  currentRoute: AppRoute;
  primaryNav: NavItem[];
  canAdmin: boolean;
  unreadNotifications: number;
  projectName?: string;
  projectSubtitle?: string;
  onNavigate: (route: AppRoute) => void;
  onOpenProject: () => void;
  onSignOut: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function AppShell({
  activePersona,
  currentRoute,
  primaryNav,
  canAdmin,
  unreadNotifications,
  projectName = "Starbase Louisiana Launch Complex",
  projectSubtitle = "Vermilion Parish · Louisiana",
  onNavigate,
  onOpenProject,
  onSignOut,
  children,
  footer,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const hamburgerRef = React.useRef<HTMLButtonElement>(null);
  const mobileNavRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!mobileNavOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileNavOpen(false);
        hamburgerRef.current?.focus();
        return;
      }
      if (e.key === "Tab") {
        const focusable = mobileNavRef.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const firstFocusable = mobileNavRef.current?.querySelector<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
    );
    firstFocusable?.focus();
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileNavOpen]);

  return (
    <div className="h-dvh min-h-0 bg-[#f3f6f7] text-[#172033] flex flex-col overflow-hidden">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="road-stripe" />

      {/* Header */}
      <header className="site-header sticky top-0 z-30 bg-[#00284d] text-white shadow-md">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6">
          {/* Mobile hamburger */}
          <Button
            ref={hamburgerRef}
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            className="text-white hover:bg-white/10 lg:hidden min-h-[44px] min-w-[44px]"
            aria-label="Toggle navigation"
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-navigation"
          >
            {mobileNavOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>

          {/* Logo badge */}
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f4a100] text-[#00284d] sm:size-9">
            <Zap className="size-5 fill-current" aria-hidden="true" />
          </span>

          {/* Brand and current context */}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white sm:text-sm tracking-wide">PATH</p>
            <button
              type="button"
              onClick={onOpenProject}
              className="block max-w-[130px] sm:max-w-xs md:max-w-none truncate text-left text-[11px] font-semibold text-slate-300 hover:text-white hover:underline transition-colors cursor-pointer"
              title="Go to project overview"
            >
              {projectName}
            </button>
          </div>

          {/* User identity button (Clickable per step 7) */}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              id="persona-selector"
              onClick={() => {
                onNavigate("profile");
                setMobileNavOpen(false);
              }}
              className="group flex items-center gap-1.5 sm:gap-2 rounded-full border border-white/20 px-2.5 sm:px-3 py-1.5 text-xs text-slate-200 hover:border-white/40 hover:bg-white/10 transition cursor-pointer min-h-[44px] shrink-0"
              aria-label="Open profile"
              title="View your profile and responsibilities"
            >
              <User className="size-3.5 text-teal-300" aria-hidden="true" />
              <span className="font-bold hidden sm:inline">{activePersona.name}</span>
              <span className="hidden rounded-full border border-teal-300/40 bg-teal-900/40 px-2 py-0.5 text-[10px] font-bold text-teal-100 sm:inline">
                {activePersona.roleLabel}
              </span>
            </button>

            {/* Notifications */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                onNavigate("notifications");
                setMobileNavOpen(false);
              }}
              className="relative shrink-0 text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
              aria-label="Open notifications"
            >
              <Bell className="size-5" />
              {unreadNotifications > 0 && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#f4a100]" />
              )}
            </Button>

            {/* Sign out */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              className="shrink-0 px-2 text-white hover:bg-white/10 sm:px-3 min-h-[44px] flex items-center"
              aria-label="Sign out"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline ml-1 text-xs">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main shell layout: Fixed rail + independently scrolling pane */}
      <div className="mx-auto flex max-w-[1600px] min-h-0 items-stretch flex-1 w-full">
        {/* Mobile drawer backdrop */}
        {mobileNavOpen && (
          <div
            className="fixed inset-0 z-20 bg-slate-900/50 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Navigation rail */}
        <aside
          ref={mobileNavRef}
          id="mobile-navigation"
          role={mobileNavOpen ? "dialog" : undefined}
          aria-modal={mobileNavOpen ? "true" : undefined}
          aria-label="Navigation drawer"
          className={`${
            mobileNavOpen ? "block" : "hidden"
          } fixed inset-x-0 top-[61px] z-20 max-h-[calc(100vh-61px)] overflow-y-auto border-b border-slate-200 bg-white p-4 shadow-xl lg:sticky lg:top-0 lg:block lg:h-full lg:max-h-none lg:overflow-hidden lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:shadow-none`}
        >
          {/* Project card */}
          <button
            type="button"
            onClick={() => {
              onOpenProject();
              setMobileNavOpen(false);
            }}
            className="group mb-4 w-full rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-left transition hover:border-teal-400 hover:bg-teal-50 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 cursor-pointer"
            aria-label="Open project page"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 group-hover:text-teal-800">
                Project Overview
              </p>
              <ArrowRight className="size-3 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-700" aria-hidden="true" />
            </div>
            <p className="mt-1 text-sm font-black text-[#00284d] group-hover:text-teal-950 truncate">
              {projectName}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 group-hover:text-teal-900">
              {projectSubtitle}
            </p>
          </button>

          {/* Nav links */}
          <nav aria-label="Primary navigation" className="space-y-1">
            <p className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Work
            </p>
            {primaryNav.map((item) => (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                data-nav={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  setMobileNavOpen(false);
                }}
                aria-current={currentRoute === item.id ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition min-h-[44px] ${
                  currentRoute === item.id
                    ? "bg-[#00284d] text-white shadow-xs"
                    : "text-slate-700 hover:bg-teal-50 hover:text-teal-950"
                }`}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {typeof item.count === "number" && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                      currentRoute === item.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            ))}

            {canAdmin && (
              <>
                <p className="px-3 pb-1 pt-6 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Administration
                </p>
                <button
                  type="button"
                  id="nav-admin"
                  data-nav="admin"
                  onClick={() => {
                    onNavigate("admin");
                    setMobileNavOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold min-h-[44px] ${
                    currentRoute === "admin" ? "bg-[#00284d] text-white" : "text-slate-700 hover:bg-teal-50"
                  }`}
                >
                  <Settings2 className="size-4" />
                  <span>Administration</span>
                </button>
              </>
            )}

          </nav>
        </aside>

        {/* Main Content Pane */}
        <main id="main-content" className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
          {children}
          {footer}
        </main>
      </div>
    </div>
  );
}
