export type AppRoute =
  | "customer-home"
  | "my-work"
  | "agency-queue"
  | "rfis"
  | "coordination"
  | "documents"
  | "project"
  | "notifications"
  | "secondary"
  | "catalog"
  | "admin"
  | "intake"
  | "detail"
  | "requests"
  | "schedule"
  | "contacts"
  | "help"
  | "profile";

export type NavigationScope = "queue" | "record" | "project" | "schedule" | "documents" | "support" | "system";

export type NavigationDefinition = {
  id: AppRoute;
  label: string;
  scope: NavigationScope;
  audiences: Array<"customer" | "staff" | "supervisor" | "admin">;
};

export const NAVIGATION_DEFINITIONS: NavigationDefinition[] = [
  { id: "customer-home", label: "Home", scope: "project", audiences: ["customer"] },
  { id: "catalog", label: "Services & Permits", scope: "support", audiences: ["customer", "staff", "supervisor", "admin"] },
  { id: "admin", label: "Administration", scope: "system", audiences: ["admin"] },
  { id: "secondary", label: "Project workspace", scope: "project", audiences: ["staff", "supervisor", "admin"] },
  { id: "my-work", label: "My Work", scope: "queue", audiences: ["staff", "supervisor", "admin"] },
  { id: "agency-queue", label: "My Agency Queue", scope: "queue", audiences: ["staff", "supervisor", "admin"] },
  { id: "rfis", label: "Requests for Information", scope: "queue", audiences: ["staff", "supervisor", "admin"] },
  { id: "coordination", label: "Coordination Requests", scope: "queue", audiences: ["staff", "supervisor", "admin"] },
  { id: "documents", label: "Documents to Review", scope: "documents", audiences: ["staff", "supervisor", "admin"] },
  { id: "project", label: "Project Overview", scope: "project", audiences: ["customer", "staff", "supervisor", "admin"] },
  { id: "schedule", label: "Schedule", scope: "schedule", audiences: ["customer", "staff", "supervisor", "admin"] },
  { id: "notifications", label: "Notifications", scope: "system", audiences: ["customer", "staff", "supervisor", "admin"] },
  { id: "requests", label: "My requests", scope: "record", audiences: ["customer"] },
  { id: "intake", label: "Customer Intake Queue", scope: "queue", audiences: ["staff", "supervisor", "admin"] },
  { id: "contacts", label: "Contact directory", scope: "support", audiences: ["customer"] },
  { id: "help", label: "Help & escalation", scope: "support", audiences: ["customer"] },
  { id: "profile", label: "Profile", scope: "system", audiences: ["customer", "staff", "supervisor", "admin"] },
];

export type EntityKind =
  | "project"
  | "workstream"
  | "task"
  | "customer_request"
  | "rfi"
  | "coordination"
  | "commitment"
  | "determination"
  | "document"
  | "document_version"
  | "person"
  | "organization"
  | "group"
  | "workflow";

export interface EntityRef {
  kind: EntityKind;
  id: string;
  code?: string;
  title?: string;
  secondaryId?: string;
}

export type WorkRouteKind = "workflow" | "task" | "rfi" | "coordination" | "document" | "commitment" | "determination" | "customer_request";

export type ParsedWorkItemPath = { kind: WorkRouteKind; id: string };

const workKinds = new Set<WorkRouteKind>([
  "workflow", "task", "rfi", "coordination", "document", "commitment", "determination", "customer_request",
]);

function decode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function buildCanonicalEntityPath(ref: EntityRef): string {
  switch (ref.kind) {
    case "project":
      return `/projects/${encodeURIComponent(ref.code || ref.id)}`;
    case "workstream":
      return `/workstreams/${encodeURIComponent(ref.code || ref.id)}`;
    case "task":
      return `/work/task/${encodeURIComponent(ref.id)}`;
    case "customer_request":
      return `/requests/${encodeURIComponent(ref.code || ref.id)}`;
    case "rfi":
      return `/work/rfi/${encodeURIComponent(ref.code || ref.id)}`;
    case "coordination":
      return `/work/coordination/${encodeURIComponent(ref.code || ref.id)}`;
    case "commitment":
      return `/work/commitment/${encodeURIComponent(ref.code || ref.id)}`;
    case "determination":
      return `/work/determination/${encodeURIComponent(ref.id)}`;
    case "document":
    case "document_version":
      return `/work/document/${encodeURIComponent(ref.id)}`;
    case "person":
      return `/?view=profile${ref.id && ref.id !== "current" ? `&userId=${encodeURIComponent(ref.id)}` : ""}`;
    case "organization":
      return `/?view=contacts&orgId=${encodeURIComponent(ref.id)}`;
    case "group":
      return `/?view=admin&tab=groups&groupId=${encodeURIComponent(ref.id)}`;
    case "workflow":
      return `/admin/workflows?template=${encodeURIComponent(ref.id)}`;
    default:
      return `/`;
  }
}

export function resolveCanonicalEntityRef(pathOrUrl: string | URL): EntityRef | null {
  const url = typeof pathOrUrl === "string"
    ? new URL(pathOrUrl.startsWith("/") ? `https://path.local${pathOrUrl}` : pathOrUrl)
    : pathOrUrl;
  const pathname = url.pathname;

  const projWsMatch = pathname.match(/^\/projects\/([^/]+)\/workstreams\/([^/]+)\/?$/i);
  if (projWsMatch) {
    return { kind: "workstream", id: decode(projWsMatch[2]), secondaryId: decode(projWsMatch[1]) };
  }

  const projMatch = pathname.match(/^\/projects\/([^/]+)\/?$/i);
  if (projMatch) {
    const projectNumber = decode(projMatch[1]);
    return { kind: "project", id: projectNumber, code: projectNumber };
  }

  const wsMatch = pathname.match(/^\/workstreams\/([^/]+)\/?$/i);
  if (wsMatch) {
    const workstreamId = decode(wsMatch[1]);
    return { kind: "workstream", id: workstreamId, code: workstreamId };
  }

  const reqMatch = pathname.match(/^\/requests\/([^/]+)\/?$/i);
  if (reqMatch) {
    const reqId = decode(reqMatch[1]);
    return { kind: "customer_request", id: reqId, code: reqId };
  }

  const workMatch = pathname.match(/^\/work\/([^/]+)\/([^/]+)\/?$/i);
  if (workMatch) {
    const rawKind = decode(workMatch[1]).toLowerCase();
    const id = decode(workMatch[2]);
    let kind: EntityKind = "task";
    if (rawKind === "workflow") kind = "workstream";
    else if (rawKind === "rfi") kind = "rfi";
    else if (rawKind === "coordination") kind = "coordination";
    else if (rawKind === "document") kind = "document";
    else if (rawKind === "commitment") kind = "commitment";
    else if (rawKind === "determination") kind = "determination";
    else if (rawKind === "customer_request") kind = "customer_request";
    else if (rawKind === "task") kind = "task";
    return { kind, id };
  }

  if (pathname.startsWith("/admin/workflows")) {
    const template = url.searchParams.get("template");
    return { kind: "workflow", id: template || "all" };
  }

  const view = url.searchParams.get("view");
  if (view === "profile") {
    const userId = url.searchParams.get("userId") || url.searchParams.get("user") || "current";
    return { kind: "person", id: userId };
  }
  if (view === "detail") {
    const k = url.searchParams.get("kind");
    const id = url.searchParams.get("id");
    if (k && id) {
      const rawKind = k.toLowerCase();
      let kind: EntityKind = "task";
      if (rawKind === "workflow") kind = "workstream";
      else if (rawKind === "rfi") kind = "rfi";
      else if (rawKind === "coordination") kind = "coordination";
      else if (rawKind === "document") kind = "document";
      else if (rawKind === "commitment") kind = "commitment";
      else if (rawKind === "determination") kind = "determination";
      else if (rawKind === "customer_request") kind = "customer_request";
      return { kind, id };
    }
  }
  if (view === "requests") {
    const req = url.searchParams.get("request");
    if (req) return { kind: "customer_request", id: req, code: req };
  }
  if (view === "project") {
    const ws = url.searchParams.get("workstream");
    if (ws) return { kind: "workstream", id: ws };
    return { kind: "project", id: "current" };
  }
  if (view === "contacts") {
    const org = url.searchParams.get("orgId") || url.searchParams.get("org");
    if (org) return { kind: "organization", id: org };
    const contact = url.searchParams.get("contact") || url.searchParams.get("user");
    if (contact) return { kind: "person", id: contact };
  }
  if (view === "admin") {
    const group = url.searchParams.get("groupId") || url.searchParams.get("group");
    if (group) return { kind: "group", id: group };
  }

  return null;
}

export function buildWorkItemPath(kind: string, id: string) {
  return `/work/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;
}

/** Shell URL used after a direct /work/:kind/:id entry has been authenticated. */
export function buildDetailShellPath(kind: WorkRouteKind | string, id: string) {
  const params = new URLSearchParams({ view: "detail", kind, id });
  return `/?${params.toString()}`;
}

export function parseWorkItemPath(pathname: string): ParsedWorkItemPath | null {
  const match = pathname.match(/^\/work\/([^/]+)\/([^/]+)\/?$/i);
  if (!match) return null;
  const kind = decode(match[1]).toLowerCase() as WorkRouteKind;
  const id = decode(match[2]).trim();
  return workKinds.has(kind) && id ? { kind, id } : null;
}

export function buildShellPath(route: AppRoute, workstreamId?: string, tool?: string, phase?: string) {
  const params = new URLSearchParams();
  if (route !== "my-work") params.set("view", route);
  if (workstreamId) params.set("workstream", workstreamId);
  if ((route === "secondary" || route === "project") && tool) params.set("tool", tool);
  if (phase) params.set("phase", phase);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function parseShellPath(url: URL): { route: AppRoute; workstreamId?: string; tool?: string; phase?: string; workKind?: WorkRouteKind; workItemId?: string; requestId?: string; returnTo?: string; userId?: string; orgId?: string; groupId?: string } {
  const view = url.searchParams.get("view") as AppRoute | null;
  const knownRoute = view && NAVIGATION_DEFINITIONS.some((entry) => entry.id === view)
    ? view
    : view === "detail" ? "detail" : "my-work";
  const workKind = url.searchParams.get("kind") as WorkRouteKind | null;
  const workItemId = url.searchParams.get("id")?.trim() || undefined;
  const res: {
    route: AppRoute;
    workstreamId?: string;
    tool?: string;
    phase?: string;
    workKind?: WorkRouteKind;
    workItemId?: string;
    requestId?: string;
    returnTo?: string;
    userId?: string;
    orgId?: string;
    groupId?: string;
  } = {
    route: knownRoute,
    workstreamId: url.searchParams.get("workstream") ?? undefined,
    tool: url.searchParams.get("tool") ?? undefined,
    workKind: workKind && workKinds.has(workKind) ? workKind : undefined,
    workItemId,
    requestId: url.searchParams.get("request")?.trim() || undefined,
    returnTo: url.searchParams.get("returnTo") ?? undefined,
  };
  const phase = url.searchParams.get("phase")?.trim();
  if (phase) res.phase = phase;
  const u = url.searchParams.get("userId") || url.searchParams.get("user");
  if (u) res.userId = u;
  const o = url.searchParams.get("orgId") || url.searchParams.get("org");
  if (o) res.orgId = o;
  const g = url.searchParams.get("groupId") || url.searchParams.get("group");
  if (g) res.groupId = g;
  return res;
}
