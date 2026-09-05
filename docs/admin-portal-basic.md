# Basic administration and customer catalog — September 5, 2026

Budget-limited implementation from fresh GitHub main `f3e33d4`.

## Delivered slice

- Visible customer request hero before project content.
- Dedicated Services & Permits navigation and deep link, with existing permit resources.
- Six clearly labeled demo service suggestions feed the existing persisted government-help request form. These are static request shortcuts, not database-backed catalog entities or official service availability claims.
- Read-only database explorer in both `/admin` and the existing administration workspace. Includes twenty allowlisted operational/configuration record types, 50-row pages, counts, page-local search, full field inspection, refresh, and explicit errors.
- Existing work editor handoff for matching records in the currently hydrated project. Existing directory/workflow controls remain below the explorer.
- API verifies authentication and active administrator membership and uses the caller's RLS client. No new grants, migrations, credentials, or write endpoints.
- Fixed the navigation parser dropping admin/secondary deep links.

## Deliberate limits

This is not the full specification. No arbitrary edit-all-fields interface, global full-text search, new user creation, new workflow editor, bulk operations, or new role grants. Organization admins see only records permitted by current RLS, not an expanded scope. Published workflows and audit history are read only in the explorer. Records outside the currently loaded project can be inspected but do not have an editor handoff in this slice.

## Verification and follow-up

Run TypeScript, focused lint, the basic-admin-portal/admin-catalog/project-navigation Node suites, and production build. No live authenticated browser or database mutation proof is claimed for this slice. Service submissions reuse `createCustomerRequestPersisted`; verify exact request propagation with separate customer/admin sessions before calling the broader persistence specification complete.

Next: database-backed editable service catalog, safe per-record admin mutations with audit history, cross-project editor hydration, and full-dataset search. Preserve the separate in-progress workflow repair work.
