-- Repeatable baseline for the self-contained Louisiana space-development demo.
-- Auth-linked personas and project participants are created by
-- scripts/seed-spacex-demo.mjs because they require auth.users IDs.
insert into public.organizations (code, name, organization_type, jurisdiction_level, active)
values
  ('SPACEPORT', 'Space Exploration Technologies Corp.', 'applicant', 'external_partner', true),
  ('LED', 'Louisiana Economic Development', 'agency', 'state', true),
  ('LDEQ', 'Louisiana Department of Environmental Quality', 'agency', 'state', true),
  ('DOTD', 'Louisiana Department of Transportation and Development', 'agency', 'state', true),
  ('CPRA', 'Coastal Protection and Restoration Authority', 'agency', 'state', true),
  ('OSFM', 'Louisiana Office of State Fire Marshal', 'agency', 'state', true),
  ('LSP', 'Louisiana State Police', 'agency', 'state', true),
  ('USACE', 'U.S. Army Corps of Engineers — New Orleans District', 'agency', 'federal', true),
  ('FAA', 'Federal Aviation Administration Coordination', 'federal_agency', 'federal', true),
  ('EPA', 'U.S. Environmental Protection Agency Coordination', 'federal_agency', 'federal', true),
  ('USFWS', 'U.S. Fish and Wildlife Service Consultation', 'federal_agency', 'federal', true),
  ('NOAA', 'National Oceanic and Atmospheric Administration Consultation', 'federal_agency', 'federal', true),
  ('SHPO', 'Louisiana State Historic Preservation Office Consultation', 'agency', 'state', true),
  ('LDCE', 'Louisiana Department of Conservation and Energy', 'agency', 'state', true),
  ('LDNR', 'LDNR Energy and Pipeline Coordination', 'agency', 'state', true),
  ('LPSC', 'Louisiana Public Service Commission Coordination', 'agency', 'state', true),
  ('SLO', 'Louisiana State Land Office Coordination', 'agency', 'state', true),
  ('LA-PROJECTS', 'Louisiana Economic Development Space Coordination', 'coordination', 'state', true),
  ('VERMILION', 'Vermilion Parish Police Jury & Permitting Office', 'agency', 'local', true),
  ('VERMILION-PARISH', 'Local Parish Coordination', 'agency', 'local', true),
  ('ENVIRONMENT', 'Environmental and Coastal Permitting', 'internal_team', 'state', true),
  ('INFRASTRUCTURE', 'Infrastructure and Civil Works', 'internal_team', 'state', true),
  ('COMMUNITY', 'Community and Facilities', 'internal_team', 'local', true),
  ('SAFETY', 'Safety and Emergency Management', 'internal_team', 'state', true),
  ('COASTAL_ENGINEERING', 'Coastal Engineering Partners', 'external_partner', 'external_partner', true)
on conflict (code) do update set
  name = excluded.name,
  organization_type = excluded.organization_type,
  jurisdiction_level = excluded.jurisdiction_level,
  active = excluded.active,
  updated_at = now();
