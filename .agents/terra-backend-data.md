# Terra — Backend & Data Specialist (.agents/terra-backend-data.md)

Role: Core Data Layer, Types, Fixtures, and State Utilities Specialist.

## Focus Areas
1. `lib/demo-data.ts`:
   - Unified `ServiceRequest` and `PermitRecord` data shapes.
   - Request types: `permit`, `road`, `utility`, `public_safety`, `workforce`, `community`.
   - Rich dataset for the **SpaceX Pecan Island Launch Complex** project:
     - Heavy-Haul Access Road (DOTD) - CRITICAL PATH, Blocked on drainage permit.
     - 230kV Grid Interconnection & Substation (Entergy / LPSC) - In Review.
     - Industrial Wastewater Discharge Permit (LDEQ) - Hearing scheduled.
     - Starship Assembly High-Bay Permit (Vermilion Parish) - Approved.
     - Airspace & Launch Safety Corridor (FAA / USCG / State Police) - Active Coordination.
     - Coastal Dune Restoration & Marsh Mitigation (CPRA / USACE) - Action Needed.
     - Regional Workforce Training Initiative (LED / South Louisiana Community College) - On Track.
     - Emergency Medical & Hazardous Materials Response Plan (OSFM / GOHSEP) - Under Review.
   - Realistic timelines (current day, statutory target, actual elapsed), blockers, assigned agency owners, escalation contact paths, and next immediate actions.
   - Agency workload distributions (DOTD, LDEQ, LDH, CPRA, LED, State Police, OSFM, Parish).
2. `lib/permit-utils.ts`:
   - RAG status calculation (Red = blocked / overdue, Amber = action needed / hearing / warning, Green = on track / complete).
   - Critical path filtering and milestone calculations.
   - Plain-English intake parser & triage router simulating triage routing to agency liaisons.
