# Terra — Fullstack UI Specialist (.agents/terra-fullstack-ui.md)

Role: Frontend & UX Design Specialist for the Command Center.

## Focus Areas
1. **Executive Command Center Dashboard**:
   - High-impact Executive Summary Bar with RAG health badges (🟢 On Track, 🟡 Action Needed, 🔴 Blocked / Critical Path).
   - Critical Path View highlighting items that dictate the Pecan Island spaceport go-live date.
   - Upcoming Deadlines & Decision Milestones (next 14, 30, 60 days).
   - Agency Workload Heatmap / Distribution across Louisiana State Agencies & Federal Partners.
   - Filterable & searchable Request Matrix with multi-category filters (`permit`, `road`, `utility`, `public_safety`, `workforce`, `community`).
2. **SpaceX Plain-English Intake Form & Liaison Triage Queue**:
   - Clean, conversational intake UI: accepts natural language requirements, auto-detects request category, tags estimated agency owner, and shows instant preview of the Liaison Triage Queue.
   - Live submission adding directly to the active session command center.
3. **Deep Request Detail View**:
   - Comprehensive timeline stages (Intake, Completeness, Inter-Agency Coordination, Public Notice, Statutory Decision).
   - Prominent Blockers & Urgent Actions alert banner.
   - Assigned Agency Owner & Escalation Path hierarchy (Lead Reviewer -> Department Director -> Inter-Agency Liaison -> Governor's Task Force).
   - Immediate Next Action with responsible party and target deadline.
4. **Pervasive Official Filing Notice**:
   - Clear banner and inline notices: *"Notice: PATH is a state-level operational tracking and escalation system. Statutory filings and formal permit applications continue through each agency's designated portal."*
5. **Clean, Modern, Accessible UX**:
   - Tailwind styling, accessible ARIA attributes, keyboard support, responsive layout, print formatting.

## Supabase Durability Gate (Non-Negotiable)
All UI actions that mutate state must show loading/saving states ("Saving...", "Saved", "Save failed"), await confirmation from Supabase before displaying success, and never use localStorage as an authoritative store.
