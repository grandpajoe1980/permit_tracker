import fs from "node:fs";

const analysis = JSON.parse(fs.readFileSync("scripts/fk-dependency-analysis.json", "utf8"));
const { foreignKeys, tableColumns } = analysis;

// Find all tables
const allTables = Object.keys(tableColumns);

// Categorize tables:
// 1. Static/Lookup/System Tables (should NOT be cleared during operational data reset):
//    - organizations
//    - customer_organizations
//    - profiles
//    - organization_memberships
//    - assignment_groups
//    - assignment_group_memberships
//    - user_profiles
//    - permit_types
//    - requirement_resources
//    - workflow_definitions
//    - workflow_stages
//    - workflow_versions
//    - workflow_version_stages
//    - workflow_transitions
//    - workflow_checklist_items
//
// 2. Operational/Transactional Tables (should be cleared and reseeded):
//    - audit_events
//    - notifications
//    - rfi_responses
//    - rfis
//    - commitments
//    - coordination_requests
//    - document_agency_reviews
//    - document_versions
//    - documents
//    - task_dependencies
//    - tasks
//    - stage_runs
//    - external_filings
//    - customer_requests
//    - case_workflows
//    - assignments
//    - requests
//    - workstreams
//    - project_participants
//    - decisions
//    - meetings
//    - projects

// Build deletion dependency graph among operational tables:
// If table A has a foreign key to table B, then table A must be deleted BEFORE table B!
const operationalTables = [
  "audit_events",
  "notifications",
  "rfi_responses",
  "rfis",
  "commitments",
  "coordination_requests",
  "document_agency_reviews",
  "document_versions",
  "documents",
  "task_dependencies",
  "tasks",
  "stage_runs",
  "external_filings",
  "customer_requests",
  "case_workflows",
  "assignments",
  "requests",
  "workstreams",
  "project_participants",
  "decisions",
  "meetings",
  "projects",
];

// Let's check all FKs among operational tables
const opFks = foreignKeys.filter(fk => 
  operationalTables.includes(fk.fromTable) && operationalTables.includes(fk.toTable)
);

console.log("=== FKs AMONG OPERATIONAL TABLES ===");
for (const fk of opFks) {
  console.log(`${fk.fromTable}.${fk.fromCol} -> ${fk.toTable}.${fk.toCol}`);
}

// Compute valid deletion order (leaves first, parents last)
// A must be deleted before B if A references B (fromTable references toTable -> fromTable is child, toTable is parent)
// So child must be deleted before parent!
const mustDeleteBefore = {}; // table -> Set of tables that must be deleted after it (i.e. its parents)
const parentsCount = {}; // table -> count of child tables that haven't been deleted yet

for (const t of operationalTables) {
  mustDeleteBefore[t] = new Set();
  parentsCount[t] = 0;
}

for (const fk of opFks) {
  if (fk.fromTable !== fk.toTable) {
    mustDeleteBefore[fk.fromTable].add(fk.toTable);
  }
}

// Compute in-degree (how many children reference this table)
for (const [child, parents] of Object.entries(mustDeleteBefore)) {
  for (const parent of parents) {
    parentsCount[parent] = (parentsCount[parent] || 0) + 1;
  }
}

const queue = operationalTables.filter(t => parentsCount[t] === 0);
const deletionOrder = [];

while (queue.length > 0) {
  const current = queue.shift();
  deletionOrder.push(current);

  for (const parent of mustDeleteBefore[current]) {
    parentsCount[parent]--;
    if (parentsCount[parent] === 0) {
      queue.push(parent);
    }
  }
}

console.log("\n=== COMPUTED SAFE DELETION ORDER (Children first, Parents last) ===");
deletionOrder.forEach((t, i) => console.log(`${i + 1}. ${t}`));

const remaining = operationalTables.filter(t => !deletionOrder.includes(t));
if (remaining.length > 0) {
  console.warn("\nWarning: Cyclic dependency or missed tables:", remaining);
}
