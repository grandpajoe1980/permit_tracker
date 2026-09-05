export type AppRoute =
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
  { id: "catalog", label: "Services & Permits", scope: "support", audiences: ["customer", "staff", "supervisor", "admin"] },
  { id: "admin", label: "Administration", scope: "system", audiences: ["admin"] },
  { id: "secondary", label: "Project resources", scope: "support", audiences: ["staff", "supervisor", "admin"] },
  { id: "my-work", label: "My Work", scope: "queue", audiences: ["staff", "supervisor", "admin"] },
  { id: "agency-queue", label: "My Agency Queue", scope: "queue", audiences: ["staff", "supervisor", "admin"] },
  { id: "rfis", label: "Requests for Information", scope: "queue", audiences: ["staff", "supervisor", "admin"] },
  { id: "coordination", label: "Coordination Requests", scope: "queue", audiences: ["staff", "supervisor", "admin"] },
  { id: "documents", label: "Documents to Review", scope: "documents", audiences: ["staff", "supervisor", "admin"] },
  { id: "project", label: "Project Overview", scope: "project", audiences: ["customer", "staff", "supervisor", "admin"] },
  { id: "schedule", label: "Schedule", scope: "schedule", audiences: ["customer", "staff", "supervisor", "admin"] },
  { id: "notifications", label: "Notifications", scope: "system", audiences: ["customer", "staff", "supervisor", "admin"] },
  { id: "requests", label: "Submit a Request", scope: "record", audiences: ["customer"] },
  { id: "intake", label: "Customer Intake Queue", scope: "queue", audiences: ["staff", "supervisor", "admin"] },
  { id: "contacts", label: "Contacts & Help", scope: "support", audiences: ["customer"] },
  { id: "help", label: "Contacts & Help", scope: "support", audiences: ["customer"] },
];

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

export function buildWorkItemPath(kind: string, id: string) {
  return `/work/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;
}

export function parseWorkItemPath(pathname: string): ParsedWorkItemPath | null {
  const match = pathname.match(/^\/work\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return null;
  const kind = decode(match[1]) as WorkRouteKind;
  const id = decode(match[2]).trim();
  return workKinds.has(kind) && id ? { kind, id } : null;
}

export function buildShellPath(route: AppRoute, workstreamId?: string) {
  const params = new URLSearchParams();
  if (route !== "my-work") params.set("view", route);
  if (workstreamId) params.set("workstream", workstreamId);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function parseShellPath(url: URL): { route: AppRoute; workstreamId?: string } {
  const view = url.searchParams.get("view") as AppRoute | null;
  const knownRoute = view && NAVIGATION_DEFINITIONS.some((entry) => entry.id === view)
    ? view
    : view === "detail" ? "detail" : "my-work";
  return { route: knownRoute, workstreamId: url.searchParams.get("workstream") ?? undefined };
}
