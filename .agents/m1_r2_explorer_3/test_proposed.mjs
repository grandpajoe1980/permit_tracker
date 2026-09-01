import { createServer } from "vite";
import assert from "node:assert/strict";

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

  // Proposed updated registeredOrganizations
  const proposedOrgs = [
    ...fixture.registeredOrganizations,
    {
      id: "org-lsp",
      code: "LSP",
      name: "Louisiana State Police",
      abbreviation: "LSP",
      jurisdictionLevel: "State",
      websiteUrl: "https://lsp.org",
      permitPortalUrl: "https://lsp.org/emergency-services/hazmat",
      generalContactEmail: "hazmat@dps.la.gov",
      projectLiaisonName: "Capt. Robert Landry",
      projectLiaisonEmail: "robert.landry@dps.la.gov",
      projectLiaisonPhone: "(225) 925-6113",
      executiveEscalationName: "Superintendent of State Police",
      executiveEscalationEmail: "superintendent@dps.la.gov",
      workingHours: "24/7 Operations / Mon-Fri 8:00 AM - 4:30 PM CST",
      holidayCalendar: "Louisiana State Legal Holidays",
      defaultSlaDays: 7,
      statutoryAuthority: "La. R.S. 32:1501 et seq. — Hazardous Materials Transportation & Emergency Response",
      geographicCoverage: "Statewide (Troop I — Acadiana / Troop D — Southwest)",
      documentRetentionYears: 15,
      isActive: true,
    },
    {
      id: "org-led",
      code: "LED",
      name: "Louisiana Economic Development",
      abbreviation: "LED",
      jurisdictionLevel: "State",
      websiteUrl: "https://www.opportunitylouisiana.gov",
      permitPortalUrl: "https://www.opportunitylouisiana.gov/faststart",
      generalContactEmail: "faststart@la.gov",
      projectLiaisonName: "Joe Skaggs / Paul Helton",
      projectLiaisonEmail: "joe.skaggs@la.gov",
      projectLiaisonPhone: "(225) 342-3000",
      executiveEscalationName: "Secretary of Economic Development",
      executiveEscalationEmail: "sec.econ@la.gov",
      workingHours: "Mon-Fri 8:00 AM - 5:00 PM CST",
      holidayCalendar: "Louisiana State Legal Holidays",
      defaultSlaDays: 10,
      statutoryAuthority: "La. R.S. 51:921 et seq. — Louisiana Economic Development & FastStart Aerospace Training",
      geographicCoverage: "Statewide & Acadiana Aerospace Corridor",
      documentRetentionYears: 20,
      isActive: true,
    },
  ];

  const orgIds = new Set(proposedOrgs.map((o) => o.id));
  const orgCodes = new Set(proposedOrgs.map((o) => o.code));

  console.log("Proposed orgIds count:", proposedOrgs.length);
  assert.equal(proposedOrgs.length, 10);

  // Check assignment groups
  const groups = fixture.assignmentGroupsData || [];
  for (const g of groups) {
    assert.ok(orgIds.has(g.organizationId), `Group ${g.id} orgId ${g.organizationId} missing`);
    assert.ok(orgCodes.has(g.orgCode), `Group ${g.id} orgCode ${g.orgCode} missing`);
  }
  console.log("✓ All assignment groups resolve 100%!");

  // Check workstreams
  const workstreams = fixture.workstreamsData || [];
  for (const ws of workstreams) {
    if (ws.assignedOrgCode) {
      assert.ok(orgCodes.has(ws.assignedOrgCode), `Workstream ${ws.id} assignedOrgCode ${ws.assignedOrgCode} missing`);
    }
  }
  console.log("✓ All workstream assignedOrgCodes resolve 100%!");

  // Proposed parseITSMState function
  function proposedParseITSMState(value, defaultState = "submitted") {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (models.isITSMState(trimmed)) return trimmed;
      const normalized = trimmed.toLowerCase().replace(/[\s-]+/g, "_");
      if (models.isITSMState(normalized)) return normalized;
      if (normalized === "triage") return "triaged";
      if (normalized === "complete" || normalized === "completed") return "resolved";
    }
    return models.isITSMState(defaultState) ? defaultState : "submitted";
  }

  // Test edge cases
  const testCases = [
    { in: "submitted", expected: "submitted" },
    { in: "  blocked  ", expected: "blocked" },
    { in: "\n triaged \t", expected: "triaged" },
    { in: "in_progress", expected: "in_progress" },
    { in: "in-progress", expected: "in_progress" },
    { in: "In Progress", expected: "in_progress" },
    { in: "  in-progress  ", expected: "in_progress" },
    { in: "pending_customer", expected: "pending_customer" },
    { in: "Pending Customer", expected: "pending_customer" },
    { in: "  Pending - Customer  ", expected: "pending_customer" },
    { in: "pending_agency", expected: "pending_agency" },
    { in: "Pending Agency", expected: "pending_agency" },
    { in: "  pending-agency  ", expected: "pending_agency" },
    { in: "triage", expected: "triaged" },
    { in: "  triage  ", expected: "triaged" },
    { in: "complete", expected: "resolved" },
    { in: "  complete  ", expected: "resolved" },
    { in: "completed", expected: "resolved" },
    { in: "  completed  ", expected: "resolved" },
    { in: "resolved", expected: "resolved" },
    { in: "  resolved  ", expected: "resolved" },
    { in: "closed", expected: "closed" },
    { in: "  closed  ", expected: "closed" },
    { in: "UNKNOWN_VALUE", expected: "submitted" },
    { in: null, expected: "submitted" },
    { in: undefined, expected: "submitted" },
    { in: 123, expected: "submitted" },
    { in: {}, expected: "submitted" },
    { in: "invalid", default: "in_progress", expected: "in_progress" },
  ];

  for (const tc of testCases) {
    const res = proposedParseITSMState(tc.in, tc.default || "submitted");
    assert.equal(res, tc.expected, `Input: ${JSON.stringify(tc.in)} expected ${tc.expected}, got ${res}`);
  }
  console.log("✓ All parseITSMState edge cases passed 100%!");

} finally {
  await vite.close();
}
