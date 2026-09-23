"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Building2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createProjectForSystemAdmin,
  fetchProjectCreationOptions,
  type CreatedProject,
  type ProjectCreationCustomerOrganization,
  type ProjectCreationOrganization,
} from "@/lib/supabase/queries";

type ProjectAdminPanelProps = {
  onProjectCreated?: (project: CreatedProject) => void | Promise<void>;
  onOpenProject: (projectNumber: string) => void;
};

export function ProjectAdminPanel({ onProjectCreated, onOpenProject }: ProjectAdminPanelProps) {
  const [organizations, setOrganizations] = useState<ProjectCreationOrganization[]>([]);
  const [customerOrganizations, setCustomerOrganizations] = useState<ProjectCreationCustomerOrganization[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customerOrganizationId, setCustomerOrganizationId] = useState("");
  const [newCustomerOrganizationName, setNewCustomerOrganizationName] = useState("");
  const [newCustomerOrganizationLegalName, setNewCustomerOrganizationLegalName] = useState("");
  const [customerUserEmailOrId, setCustomerUserEmailOrId] = useState("");
  const [leadOrganizationId, setLeadOrganizationId] = useState("");
  const [participantOrganizationIds, setParticipantOrganizationIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [receipt, setReceipt] = useState<CreatedProject | null>(null);

  useEffect(() => {
    let active = true;
    void fetchProjectCreationOptions().then((result) => {
      if (!active) return;
      setOrganizations(result.organizations);
      setCustomerOrganizations(result.customerOrganizations);
      setOptionsError(result.error ?? "");
      setOptionsLoading(false);
    });
    return () => { active = false; };
  }, []);

  function toggleParticipant(organizationId: string) {
    setParticipantOrganizationIds((current) => current.includes(organizationId)
      ? current.filter((id) => id !== organizationId)
      : [...current, organizationId]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    setReceipt(null);
    setSubmitting(true);
    const result = await createProjectForSystemAdmin({
      number: projectNumber.trim().toUpperCase(),
      name: projectName.trim(),
      customerOrganizationId: customerMode === "existing" ? customerOrganizationId : null,
      newCustomerOrganizationName: customerMode === "new" ? newCustomerOrganizationName.trim() : "",
      newCustomerOrganizationLegalName: customerMode === "new" ? newCustomerOrganizationLegalName.trim() : "",
      customerUserEmailOrId: customerUserEmailOrId.trim(),
      leadOrganizationId,
      participantOrganizationIds,
    });
    if (result.error || !result.data) {
      setSubmitError(result.error ?? "The project could not be created.");
      setSubmitting(false);
      return;
    }

    setReceipt(result.data);
    setProjectName("");
    setProjectNumber("");
    setParticipantOrganizationIds([]);
    if (customerMode === "new" && result.data.customerOrganizationId) {
      setCustomerOrganizations((current) => [...current, {
        id: result.data!.customerOrganizationId!,
        name: result.data!.customerOrganizationName ?? newCustomerOrganizationName.trim(),
      }].sort((left, right) => left.name.localeCompare(right.name)));
      setCustomerOrganizationId(result.data.customerOrganizationId);
      setCustomerMode("existing");
    }
    setNewCustomerOrganizationName("");
    setNewCustomerOrganizationLegalName("");
    setCustomerUserEmailOrId("");
    try {
      await onProjectCreated?.(result.data);
    } catch {
      // The RPC has already committed. Keep its receipt visible if list refresh fails.
    }
    setSubmitting(false);
  }

  const customerSelectionReady = customerMode === "new"
    ? newCustomerOrganizationName.trim().length >= 2
    : Boolean(customerOrganizationId);
  const canSubmit = !optionsLoading && !optionsError && organizations.length > 0 && customerSelectionReady;

  return (
    <Card id="project-creation" className="border-teal-300 shadow-sm">
      <CardHeader className="border-b border-teal-100 bg-teal-50/60">
        <CardTitle className="flex items-center gap-2 text-lg font-black text-[#00284d]">
          <Building2 className="size-5 text-teal-700" aria-hidden="true" /> Create a project
        </CardTitle>
        <p className="text-sm leading-6 text-slate-600">Set the customer, lead agency, and organizations that need initial project access.</p>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {optionsLoading && <p role="status" className="text-sm text-slate-600">Loading customer and agency choices…</p>}
        {optionsError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">{optionsError}</p>}
        {!optionsLoading && !optionsError && organizations.length === 0 && (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">No active agencies are available. Register a lead agency before creating a project.</p>
        )}

        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-project-name">Project name</Label>
              <Input id="new-project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={160} required className="mt-1" placeholder="Coastal Resilience Program" />
            </div>
            <div>
              <Label htmlFor="new-project-number">Project number</Label>
              <Input id="new-project-number" value={projectNumber} onChange={(event) => setProjectNumber(event.target.value.toUpperCase())} required minLength={3} maxLength={32} pattern="[A-Z0-9][A-Z0-9-]{1,31}" className="mt-1 font-mono uppercase" placeholder="PRJ-2026-002" aria-describedby="new-project-number-help" />
              <p id="new-project-number-help" className="mt-1 text-xs text-slate-500">Use 3–32 letters, numbers, or hyphens.</p>
            </div>
            <div>
              <Label htmlFor="new-project-customer-mode">Customer organization</Label>
              <select id="new-project-customer-mode" value={customerMode} onChange={(event) => setCustomerMode(event.target.value as "existing" | "new")} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
                <option value="existing">Choose an existing customer</option>
                <option value="new">Create a new customer organization</option>
              </select>
              {customerMode === "existing" ? (
                <select id="new-project-customer" aria-label="Existing customer organization" value={customerOrganizationId} onChange={(event) => setCustomerOrganizationId(event.target.value)} required className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
                  <option value="">Choose a customer organization</option>
                  {customerOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                </select>
              ) : (
                <div className="mt-2 space-y-2">
                  <Input aria-label="New customer organization name" value={newCustomerOrganizationName} onChange={(event) => setNewCustomerOrganizationName(event.target.value)} maxLength={160} required placeholder="Bayou Horizon Energy, LLC" />
                  <Input aria-label="Customer legal name (optional)" value={newCustomerOrganizationLegalName} onChange={(event) => setNewCustomerOrganizationLegalName(event.target.value)} maxLength={200} placeholder="Legal name, if different" />
                  <p className="text-xs text-slate-500">The new customer record is created with this project. Customer access is tied to that organization.</p>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="new-project-lead">Lead organization</Label>
              <select id="new-project-lead" value={leadOrganizationId} onChange={(event) => setLeadOrganizationId(event.target.value)} required className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
                <option value="">Choose a lead organization</option>
                {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} ({organization.code})</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="new-project-customer-account">Customer account email or user ID (optional)</Label>
            <Input id="new-project-customer-account" value={customerUserEmailOrId} onChange={(event) => setCustomerUserEmailOrId(event.target.value.trimStart())} type="text" autoComplete="off" className="mt-1" placeholder="bayou.demo@example.com" />
            <p className="mt-1 text-xs text-slate-500">An existing account is linked to this customer organization and this project only. An account already assigned to another customer organization cannot be moved here.</p>
          </div>

          <fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-bold text-[#00284d]">Initial participant organizations</legend>
            <p className="mb-3 text-xs text-slate-500">The lead organization is included automatically. Select any other organizations that need access now.</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {organizations.map((organization) => (
                <label key={organization.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <input type="checkbox" checked={participantOrganizationIds.includes(organization.id)} onChange={() => toggleParticipant(organization.id)} className="size-4 accent-teal-700" aria-label={`Add ${organization.name} as an initial participant`} />
                  <span>{organization.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {submitError && <p role="alert" aria-live="assertive" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">Project creation failed: {submitError}</p>}
          {receipt && (
            <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex min-w-0 items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
                <div>
                  <p className="font-black text-emerald-950">Project created</p>
                  <p className="text-sm text-emerald-900">{receipt.number} · {receipt.name}</p>
                  <p className="mt-1 text-xs text-emerald-800">{receipt.customerOrganizationName ? `${receipt.customerOrganizationName} · ` : ""}Customer, lead agency, and initial participant access were saved.</p>
                </div>
              </div>
              <Button type="button" onClick={() => onOpenProject(receipt.number)} className="bg-[#00284d] font-bold hover:bg-[#003c70]">
                Open project <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          )}

          <Button type="submit" disabled={!canSubmit || submitting} className="h-11 w-full bg-[#00284d] font-black hover:bg-[#003c70]">
            {submitting ? "Creating project…" : "Create project"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
