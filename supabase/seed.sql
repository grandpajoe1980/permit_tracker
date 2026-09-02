-- Repeatable baseline for the self-contained Louisiana space-development demo.
-- Auth-linked personas and project participants are created by
-- scripts/seed-spacex-demo.mjs because they require auth.users IDs.
insert into public.organizations (code, name, organization_type, jurisdiction_level, active)
values
  ('FAA', 'Federal Aviation Administration Coordination', 'federal_agency', 'federal', true),
  ('EPA', 'U.S. Environmental Protection Agency Coordination', 'federal_agency', 'federal', true),
  ('LDNR', 'LDNR Energy and Pipeline Coordination', 'agency', 'state', true),
  ('LA-PROJECTS', 'Louisiana Economic Development Space Coordination', 'coordination', 'state', true),
  ('VERMILION-PARISH', 'Local Parish Coordination', 'agency', 'local', true)
on conflict (code) do update set
  name = excluded.name,
  organization_type = excluded.organization_type,
  jurisdiction_level = excluded.jurisdiction_level,
  active = excluded.active,
  updated_at = now();
