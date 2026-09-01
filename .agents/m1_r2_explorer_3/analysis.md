# Analysis: Milestone 1 Iteration 2 Fixtures & Edge Cases

**Author**: `m1_r2_explorer_3` (Milestone 1 Iteration 2 Fixtures & Edge Cases Explorer)  
**Date**: 2026-08-31T13:47:00Z  
**Target Files**:
1. `lib/domain-models.ts` (`parseITSMState` whitespace normalization & robust parsing)
2. `lib/spacex-megaproject-fixture.ts` (100% Referential Integrity: Register `LSP` and `LED` in `registeredOrganizations`)
3. Associated test assertions in `tests/command-system.test.mjs` and `tests/m1-adversarial-stress.test.mjs`

---

## 1. Executive Summary

During Milestone 1 adversarial probing:
- **Challenger 1** identified that `parseITSMState` in `lib/domain-models.ts` lacked leading/trailing `.trim()`, causing inputs with surrounding whitespace (e.g., `"  blocked  "`) to become `"__blocked__"` and fall back to the default state (`"submitted"`).
- **Challenger 2** identified that `registeredOrganizations` in `lib/spacex-megaproject-fixture.ts` contained 8 organizations, omitting `LSP` (Louisiana State Police) and `LED` (Louisiana Economic Development), despite `assignmentGroupsData` defining `grp-lsp-hazmat` (`orgCode: "LSP"`, `organizationId: "org-lsp"`), workstream `WS-PUBLIC-SAFETY-AIRSPACE` assigning `assignedOrgCode: "LSP"`, and Supabase migration `20260831140000_itsm_assignment_groups_and_states.sql` seeding both `LSP` and `LED`.

This document specifies the exact code modifications, complete TypeScript type definitions, fixture objects, and test suite updates necessary to resolve both issues cleanly with 100% backward compatibility and zero regressions.

---

## 2. Problem Analysis & Evidence Chain

### 2.1 Problem 1: Whitespace Normalization in `parseITSMState`
- **Location**: `lib/domain-models.ts:855-864`
- **Existing Implementation**:
  ```typescript
  export function parseITSMState(value: unknown, defaultState: ITSMState = "submitted"): ITSMState {
    if (isITSMState(value)) return value;
    if (typeof value === "string") {
      const normalized = value.toLowerCase().replace(/[\s-]/g, "_");
      if (isITSMState(normalized)) return normalized;
      if (normalized === "triage") return "triaged";
      if (normalized === "complete" || normalized === "completed") return "resolved";
    }
    return defaultState;
  }
  ```
- **Observed Behavior**:
  - `parseITSMState("  blocked  ")` executes `value.toLowerCase().replace(/[\s-]/g, "_")`, producing `"__blocked__"`.
  - `"__blocked__"` is not in `VALID_ITSM_STATES` (`["draft", "submitted", "triaged", "in_progress", "pending_customer", "pending_agency", "blocked", "resolved", "closed"]`).
  - Result: It returns `defaultState` (`"submitted"`), incorrectly reclassifying a blocked ticket as submitted.
- **Solution**:
  - Apply `.trim()` before normalization and regex replacement.
  - Collapse one or more whitespace/hyphen characters `replace(/[\s-]+/g, "_")`.
  - Validate fallback `defaultState` against `isITSMState()`.

---

### 2.2 Problem 2: Missing Organizations in `registeredOrganizations` Fixture
- **Location**: `lib/spacex-megaproject-fixture.ts:21-181`
- **Existing Implementation**:
  Contains 8 entries:
  1. `org-spacex` (`SPACEX`)
  2. `org-state-po` (`LA-PROJECTS`)
  3. `org-dotd` (`DOTD`)
  4. `org-ldeq` (`LDEQ`)
  5. `org-cpra` (`CPRA`)
  6. `org-usace` (`USACE`)
  7. `org-osfm` (`OSFM`)
  8. `org-parish` (`VERMILION-PARISH`)
- **Observed Broken References**:
  1. `assignmentGroupsData` line 320: `grp-lsp-hazmat` references `organizationId: "org-lsp"` and `orgCode: "LSP"`. Neither existed in `registeredOrganizations`.
  2. `workstreamsData` line 1824: `WS-PUBLIC-SAFETY-AIRSPACE` defines `assignedOrgCode: "LSP"`.
  3. `customer-portal.ts` line 161 & `demo-data.ts`: Joe Skaggs is assigned to `organizationId: "org-led"` (Louisiana Economic Development).
  4. Supabase migration `20260831140000_itsm_assignment_groups_and_states.sql` lines 30 & 33 seeds `LSP` and `LED` into `public.organizations`.
- **Solution**:
  Add fully compliant `OrganizationRecord` definitions for `LSP` (`org-lsp`) and `LED` (`org-led`) directly into `registeredOrganizations`.

---

## 3. Exact Code Proposals

### 3.1 Proposed Update for `lib/domain-models.ts`

```typescript
// Replace lines 855-864 in lib/domain-models.ts:

export function parseITSMState(value: unknown, defaultState: ITSMState = "submitted"): ITSMState {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (isITSMState(trimmed)) return trimmed;
    const normalized = trimmed.toLowerCase().replace(/[\s-]+/g, "_");
    if (isITSMState(normalized)) return normalized;
    if (normalized === "triage") return "triaged";
    if (normalized === "complete" || normalized === "completed") return "resolved";
  }
  return isITSMState(defaultState) ? defaultState : "submitted";
}
```

---

### 3.2 Proposed Update for `lib/spacex-megaproject-fixture.ts`

Append the following two organization definitions to `registeredOrganizations` array in `lib/spacex-megaproject-fixture.ts` (after `VERMILION-PARISH`):

```typescript
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
```

---

### 3.3 Proposed Updates for Test Assertions

#### 1. `tests/command-system.test.mjs` (Line 176)
```javascript
// Before:
assert.equal(registeredOrganizations.length, 8);

// After:
assert.ok(registeredOrganizations.length >= 8, "Agency registry must contain at least 8 organizations");
assert.equal(registeredOrganizations.length, 10);
```

#### 2. `tests/m1-adversarial-stress.test.mjs` (Lines 79-81)
```javascript
// Before:
// Note on edge case: leading/trailing whitespace in "  blocked  " turns into "__blocked__"
// without trim(), falling back to defaultState.
assert.equal(parseITSMState("  blocked  "), "submitted");

// After:
// Verify whitespace trimming in parseITSMState:
assert.equal(parseITSMState("  blocked  "), "blocked");
assert.equal(parseITSMState("  Pending Customer  "), "pending_customer");
assert.equal(parseITSMState("\n triaged \t"), "triaged");
```

---

## 4. Referential Integrity Audit Verification Matrix

| Fixture Collection | Referenced Field | Target Entity / Key | Status Before | Status After |
| :--- | :--- | :--- | :--- | :--- |
| `assignmentGroupsData` (`grp-lsp-hazmat`) | `organizationId: "org-lsp"` | `registeredOrganizations.id` | ❌ Missing | ✅ Resolved (`org-lsp`) |
| `assignmentGroupsData` (`grp-lsp-hazmat`) | `orgCode: "LSP"` | `registeredOrganizations.code` | ❌ Missing | ✅ Resolved (`LSP`) |
| `workstreamsData` (`WS-PUBLIC-SAFETY-AIRSPACE`) | `assignedOrgCode: "LSP"` | `registeredOrganizations.code` | ❌ Missing | ✅ Resolved (`LSP`) |
| `customer-portal.ts` (`participant-joe`) | `organizationId: "org-led"` | `registeredOrganizations.id` | ❌ Missing | ✅ Resolved (`org-led`) |
| `permitCatalog` (All 3 items) | `responsibleOrgId` | `registeredOrganizations.id` | ✅ Resolved | ✅ Resolved |
| `commitmentsData` (All 6 items) | `committingOrgId` | `registeredOrganizations.id` | ✅ Resolved | ✅ Resolved |
| `coordinationRequestsData` (All 3 items) | `requestingOrgId`, `targetOrgId` | `registeredOrganizations.id` | ✅ Resolved | ✅ Resolved |
| `rfisData` (All items) | `requestingOrgId`, `recipientOrgId` | `registeredOrganizations.id` | ✅ Resolved | ✅ Resolved |

---

## 5. Verification Harness & Results

A test harness was developed and executed (`.agents/m1_r2_explorer_3/test_proposed.mjs`):
- Tested 28 discrete input permutations for `parseITSMState` including leading/trailing spaces, newlines, tabs, hyphenated values, case variations, aliases (`triage`, `complete`, `completed`), null, undefined, numbers, objects, and fallback defaults. **100% passed**.
- Validated referential integrity of all 10 organizations against all assignment groups, memberships, workstreams, permits, commitments, and coordination requests. **100% passed**.
