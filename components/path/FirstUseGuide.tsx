"use client";

import React, { useState } from "react";
import { Check, ArrowRight, ArrowLeft, X, Sparkles, LayoutList, Calendar, Users, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FirstUseGuideProps {
  isOpen?: boolean;
  onDismiss?: () => void;
  onNavigate?: (route: string) => void;
}

export const FIRST_USE_GUIDE_STORAGE_KEY = "path_first_use_guide_dismissed";

interface GuideStep {
  id: string;
  title: string;
  targetControl: string;
  route?: string;
  icon: React.ReactNode;
  description: string;
  details: string;
  actionLabel?: string;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: "my-work",
    title: "My Work & Queues",
    targetControl: "#nav-my-work",
    route: "my-work",
    icon: <LayoutList className="size-5 text-teal-600" aria-hidden="true" />,
    description: "Operational actions needing your attention",
    details: "Your inbox highlights work where you hold the next move. Use Needs my action, Waiting, and Completed tabs to organize your day. Filter by Due soon or Overdue without guessing.",
    actionLabel: "Go to My Work",
  },
  {
    id: "schedule",
    title: "Authoritative Schedule",
    targetControl: "#nav-schedule",
    route: "schedule",
    icon: <Calendar className="size-5 text-teal-600" aria-hidden="true" />,
    description: "Critical path and statutory workflow phases",
    details: "Every bar and phase reflects recorded agency milestones and actual statutory clocks. Click any phase to inspect dependencies and forecast impacts directly on the canonical record.",
    actionLabel: "View Schedule",
  },
  {
    id: "team-inbox",
    title: "Team Inbox & RFIs",
    targetControl: "#nav-team-work",
    route: "team-work",
    icon: <Users className="size-5 text-teal-600" aria-hidden="true" />,
    description: "Unassigned team work and multi-agency requests",
    details: "Coordinate across agencies and groups. Review unassigned submissions, take ownership with atomic conflict prevention, and track information requests (RFIs) until accepted.",
    actionLabel: "Open Team Work",
  },
  {
    id: "persona-selector",
    title: "Identity & Role Switcher",
    targetControl: "#persona-selector",
    route: "profile",
    icon: <UserCheck className="size-5 text-teal-600" aria-hidden="true" />,
    description: "Role context, permissions, and demo personas",
    details: "Select your avatar or role pill in the top-right header to review your assigned agency, group memberships, and active responsibilities. Switch personas to test customer or administrator workflows.",
    actionLabel: "View Profile & Role",
  },
];

export function FirstUseGuide({
  isOpen: controlledIsOpen,
  onDismiss,
  onNavigate,
}: FirstUseGuideProps) {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(FIRST_USE_GUIDE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [prevControlledIsOpen, setPrevControlledIsOpen] = useState(controlledIsOpen);

  if (controlledIsOpen !== prevControlledIsOpen) {
    setPrevControlledIsOpen(controlledIsOpen);
    if (controlledIsOpen) {
      setCurrentStepIndex(0);
    }
  }

  const isVisible = controlledIsOpen !== undefined ? controlledIsOpen : !isDismissed;

  if (!isVisible) return null;

  const currentStep = GUIDE_STEPS[currentStepIndex];

  const handleDismiss = () => {
    try {
      localStorage.setItem(FIRST_USE_GUIDE_STORAGE_KEY, "true");
    } catch {
      // LocalStorage access restricted
    }
    setIsDismissed(true);
    onDismiss?.();
  };

  const handleNext = () => {
    if (currentStepIndex < GUIDE_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleAction = () => {
    if (currentStep.route && onNavigate) {
      onNavigate(currentStep.route);
    }
  };

  return (
    <section
      role="region"
      aria-label="First-use guide to PATH controls"
      data-testid="first-use-guide"
      className="relative mb-6 rounded-2xl border border-teal-200 bg-white p-5 sm:p-6 shadow-sm"
    >
      {/* Header bar */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 border border-teal-200 text-teal-700">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#00284d]">
              Welcome to PATH · Key Controls Guide
            </h2>
            <p className="text-xs text-slate-500">
              A calm overview of where to find and manage regulatory work.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
          aria-label="Dismiss guide"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Step selector pills */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {GUIDE_STEPS.map((step, idx) => {
          const isActive = idx === currentStepIndex;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setCurrentStepIndex(idx)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition min-h-[36px] cursor-pointer ${
                isActive
                  ? "bg-[#00284d] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>{idx + 1}.</span>
              <span>{step.title}</span>
            </button>
          );
        })}
      </div>

      {/* Active step content */}
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-2xs">
              {currentStep.icon}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{currentStep.title}</h3>
              <p className="text-xs font-medium text-teal-800">{currentStep.description}</p>
            </div>
          </div>

          {currentStep.actionLabel && onNavigate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAction}
              className="self-start sm:self-auto border-teal-300 text-teal-900 hover:bg-teal-50"
            >
              {currentStep.actionLabel}
              <ArrowRight className="size-3.5 ml-1" aria-hidden="true" />
            </Button>
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-600 sm:text-sm">
          {currentStep.details}
        </p>
      </div>

      {/* Footer controls */}
      <div className="mt-4 flex items-center justify-between pt-2">
        <p className="text-xs font-medium text-slate-400">
          Step {currentStepIndex + 1} of {GUIDE_STEPS.length}
        </p>

        <div className="flex items-center gap-2">
          {currentStepIndex > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              className="text-xs text-slate-600"
            >
              <ArrowLeft className="size-3.5 mr-1" aria-hidden="true" />
              Previous
            </Button>
          )}

          {currentStepIndex < GUIDE_STEPS.length - 1 ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleNext}
              className="bg-[#00284d] text-white text-xs font-bold hover:bg-[#003c74]"
            >
              Next
              <ArrowRight className="size-3.5 ml-1" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleDismiss}
              className="bg-[#00284d] text-white text-xs font-bold hover:bg-[#003c74]"
            >
              <Check className="size-3.5 mr-1" aria-hidden="true" />
              Got it, close guide
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
