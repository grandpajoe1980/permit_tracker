-- Follow-on correction: policies are additive, so remove residual permissive
-- policies that remained from the customer-portal migration even though table
-- DML grants were revoked by the trust-boundary migration.
drop policy if exists notifications_insert on public.notifications;
drop policy if exists customer_requests_insert on public.customer_requests;
drop policy if exists audit_select on public.audit_events;
