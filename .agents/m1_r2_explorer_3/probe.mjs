import { createServer } from "vite";
import { resolve } from "node:path";

const root = process.cwd();
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

try {
  const fixture = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");
  const models = await vite.ssrLoadModule("/lib/domain-models.ts");

  const orgs = fixture.registeredOrganizations || [];
  const orgIds = new Set(orgs.map((o) => o.id));
  const orgCodes = new Set(orgs.map((o) => o.code));

  console.log("=== REGISTERED ORGANIZATIONS ===");
  console.log(`Count: ${orgs.length}`);
  console.log("IDs:", Array.from(orgIds));
  console.log("Codes:", Array.from(orgCodes));

  console.log("\n=== ASSIGNMENT GROUPS AUDIT ===");
  const groups = fixture.assignmentGroupsData || [];
  for (const g of groups) {
    const hasOrgId = orgIds.has(g.organizationId);
    const hasOrgCode = orgCodes.has(g.orgCode);
    if (!hasOrgId || !hasOrgCode) {
      console.log(`[ORPHAN in group ${g.id}]: orgCode="${g.orgCode}" (exists: ${hasOrgCode}), organizationId="${g.organizationId}" (exists: ${hasOrgId})`);
    }
  }

  console.log("\n=== ASSIGNMENT GROUP MEMBERSHIPS AUDIT ===");
  const memberships = fixture.assignmentGroupMembershipsData || [];
  const groupIds = new Set(groups.map((g) => g.id));
  for (const m of memberships) {
    if (!groupIds.has(m.assignmentGroupId)) {
      console.log(`[ORPHAN in membership ${m.id}]: assignmentGroupId="${m.assignmentGroupId}" not found in groups`);
    }
  }

  console.log("\n=== PERMIT CATALOG AUDIT ===");
  const permits = fixture.permitCatalog || [];
  for (const p of permits) {
    if (p.responsibleOrgId && !orgIds.has(p.responsibleOrgId)) {
      console.log(`[ORPHAN in permit ${p.id}]: responsibleOrgId="${p.responsibleOrgId}"`);
    }
    if (p.agencyRequirements) {
      for (const req of p.agencyRequirements) {
        if (req.responsibleOrgId && !orgIds.has(req.responsibleOrgId)) {
          console.log(`[ORPHAN in req ${req.id} of permit ${p.id}]: responsibleOrgId="${req.responsibleOrgId}"`);
        }
      }
    }
  }

  console.log("\n=== COMMITMENTS AUDIT ===");
  const commitments = fixture.commitmentsData || [];
  for (const c of commitments) {
    if (c.committingOrgId && !orgIds.has(c.committingOrgId)) {
      console.log(`[ORPHAN in commitment ${c.id}]: committingOrgId="${c.committingOrgId}"`);
    }
  }

  console.log("\n=== COORDINATION REQUESTS AUDIT ===");
  const coordReqs = fixture.coordinationRequestsData || [];
  for (const r of coordReqs) {
    if (r.requestingOrgId && !orgIds.has(r.requestingOrgId)) {
      console.log(`[ORPHAN in coordReq ${r.id}]: requestingOrgId="${r.requestingOrgId}"`);
    }
    if (r.targetOrgId && !orgIds.has(r.targetOrgId)) {
      console.log(`[ORPHAN in coordReq ${r.id}]: targetOrgId="${r.targetOrgId}"`);
    }
  }

  console.log("\n=== RFIS AUDIT ===");
  const rfis = fixture.rfisData || [];
  for (const r of rfis) {
    if (r.requestingOrgId && !orgIds.has(r.requestingOrgId)) {
      console.log(`[ORPHAN in rfi ${r.id}]: requestingOrgId="${r.requestingOrgId}"`);
    }
    if (r.recipientOrgId && !orgIds.has(r.recipientOrgId)) {
      console.log(`[ORPHAN in rfi ${r.id}]: recipientOrgId="${r.recipientOrgId}"`);
    }
  }

  console.log("\n=== WORKSTREAMS AUDIT ===");
  const workstreams = fixture.workstreamsData || [];
  for (const ws of workstreams) {
    if (ws.assignmentGroupId && !groupIds.has(ws.assignmentGroupId)) {
      console.log(`[ORPHAN in workstream ${ws.id}]: assignmentGroupId="${ws.assignmentGroupId}"`);
    }
    if (ws.assignedOrgCode && !orgCodes.has(ws.assignedOrgCode)) {
      console.log(`[ORPHAN in workstream ${ws.id}]: assignedOrgCode="${ws.assignedOrgCode}"`);
    }
    if (ws.tasks) {
      for (const t of ws.tasks) {
        if (t.assignedOrgId && !orgIds.has(t.assignedOrgId)) {
          console.log(`[ORPHAN in task ${t.id} of ${ws.id}]: assignedOrgId="${t.assignedOrgId}"`);
        }
      }
    }
  }

  console.log("\n=== parseITSMState BEHAVIOR TEST ===");
  const testInputs = [
    "submitted",
    "  blocked  ",
    "\n triaged \t",
    "in_progress",
    "in-progress",
    "In Progress",
    "pending_customer",
    "Pending Customer",
    "pending-customer",
    "pending_agency",
    "Pending Agency",
    "pending-agency",
    "triage",
    "complete",
    "completed",
    "resolved",
    "closed",
    "  closed  ",
    "UNKNOWN_VALUE",
    null,
    undefined,
    123,
    {}
  ];

  for (const input of testInputs) {
    console.log(`parseITSMState(${JSON.stringify(input)}) => "${models.parseITSMState(input)}"`);
  }

} finally {
  await vite.close();
}
