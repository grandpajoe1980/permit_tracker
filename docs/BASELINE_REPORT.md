# Checkpoint 0 Baseline Report

Captured at: 2026-09-07T19:56:00-05:00
Environment: Windows / PowerShell / Node.js 22.13.0

## Repository Identity & Traceability
- **Local HEAD SHA:** `dd20ebcacbd7e8f7bb9edc8fc03b8d34a3842a4c`
- **Origin main SHA:** `dd20ebcacbd7e8f7bb9edc8fc03b8d34a3842a4c`
- **Upstream main SHA:** `dd20ebcacbd7e8f7bb9edc8fc03b8d34a3842a4c`
- **Linked Supabase Project Ref:** `fpxghydxawjnduqeyhch`
- **Supabase Project URL:** `https://fpxghydxawjnduqeyhch.supabase.co`

## Seed & Acceptance Record Identifiers
All acceptance records are deterministically isolated using the `PATH-DEMO-*` prefix in `scripts/seed-demo-scenarios.mjs` and `supabase/demo-scenarios.sql`:

1. **Intake Request Journey:**
   - Record ID: `PATH-DEMO-REQ-INTAKE`
   - Confirmation Number: `REQ-SPACEPORT-2026-0001`
   - Route: `/requests/REQ-SPACEPORT-2026-0001`
   - Initial State: `submitted` / `triage`, Unassigned, no related workstream
   - Actor: Alex Martin (submitter), Jordan Lee (coordinator/intake reviewer)

2. **Workstream RFI Journey:**
   - Waiting RFI: `PATH-DEMO-RFI-WAITING` on workstream `WS-AIR-TITLE-V`
   - Review RFI: `PATH-DEMO-RFI-REVIEW` on workstream `WS-AIR-TITLE-V`
   - Accepted RFI: `PATH-DEMO-RFI-ACCEPTED` (terminal, not waiting)
   - Workstream Route: `/projects/PRJ-PECAN-2026/workstreams/WS-AIR-TITLE-V`

3. **Assignment & Team Work:**
   - Unassigned Record: `PATH-DEMO-REQ-INTAKE`
   - Direct Assignment: `WS-AIR-TITLE-V` assigned to Jordan Lee (`user-jordan-lee`), Group `LDEQ Air Review`
   - Team Record: `PATH-DEMO-WS-UTILITY` assigned to group `LDEQ`

4. **Blocker & Escalation:**
   - Workstream: `WS-FAA-COMM-LAUNCH`
   - Blocker: statutory environmental clearance hold

5. **Workflow Version Journey:**
   - Pinned Version ID: `workflow-version-spaceport-request-v1`
   - Workstream: `PATH-DEMO-WS-UTILITY`

6. **Document Version Journey:**
   - Document ID: `doc-ver-seed-drainage-20260907` / `PATH-DEMO-DOC-VERSION-01`
   - Storage Bucket: `documents`

## Applied Migrations (44 migrations confirmed in database ledger)
- `20260828170355_initial_path_mvp.sql`
- `20260828190000_spacex_louisiana_workspace.sql`
- `20260830071223_command_system_relational_schema.sql`
- `20260830120000_customer_portal_delivery.sql`
- `20260830150635_harden_command_system_rls_and_seed_portal_support.sql`
- `20260830152028_consolidate_customer_request_update_policy.sql`
- `20260830152923_tighten_admin_and_request_scope.sql`
- `20260830180000_supabase_authoritative_persistence.sql`
- `20260830180001_harden_document_storage_lifecycle.sql`
- `20260830180521_backfill_document_version_ownership.sql`
- `20260830180623_normalize_document_version_numbers.sql`
- `20260830190000_authoritative_access_boundary.sql`
- `20260830191500_secure_rpc_actor_context.sql`
- `20260830200000_workflow_execution_engine.sql`
- `20260830203000_workflow_designer_transactions.sql`
- `20260830210000_customer_triage_workstream_transactions.sql`
- `20260830213000_workstream_coordination_transactions.sql`
- `20260830214000_workstream_action_transactions.sql`
- `20260830220000_workstream_action_notifications.sql`
- `20260830221000_project_reference_compatibility.sql`
- `20260830222000_scope_workflow_metadata_rls.sql`
- `20260830223000_catalog_admin_transactions.sql`
- `20260830225000_atomic_multi_workstream_triage.sql`
- `20260830231000_pin_legacy_workflows_and_enforce_versioned_completion.sql`
- `20260830232000_secure_customer_request_actor.sql`
- `20260830233000_customer_request_first_attachment.sql`
- `20260830234000_scope_workflow_admin_by_organization.sql`
- `20260830235000_persist_organization_member_roles.sql`
- `20260830240000_enforce_mandatory_task_dependencies.sql`
- `20260831140000_itsm_assignment_groups_and_states.sql`
- `20260831165904_itsm_production_forward.sql`
- `20260902181319_update_commitment_status.sql`
- `20260902211835_reconcile_read_policies.sql`
- `20260902212857_revoke_public_security_definer_execution.sql`
- `20260907120213_repair_customer_triage_columns.sql`
- `20260907120931_sync_customer_triage_state.sql`
- `20260907121335_lock_down_triage_trigger_function.sql`
- `20260907123535_rfi_team_notifications_and_actor.sql`
- `20260907123737_harden_mutation_authorization_nulls.sql`
- `20260907124408_harden_mutation_authorization_nulls.sql`
- `20260907132000_customer_request_filing_recovery.sql`
- `20260907180000_deliberate_intake_routing.sql`
- `20260907200000_coordination_response_transaction.sql`
- `20260907201000_catalog_resource_provenance.sql`
