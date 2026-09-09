-- Keep the live demo's State Project Office persona inside the same
-- project-access boundary as the intake queue. This is deliberately scoped
-- to the tagged demo project and does not broaden access to other projects.
INSERT INTO public.project_participants (
  project_id,
  organization_id,
  participation_role,
  access_scope,
  organization_name,
  project_role,
  visibility_scope,
  is_active
)
SELECT
  project.id,
  organization.id,
  'coordinating',
  'project',
  organization.name,
  'State Project Office',
  'project',
  true
FROM public.projects project
JOIN public.organizations organization
  ON organization.code = 'STATEPO'
WHERE project.number = 'PRJ-PECAN-2026'
  AND NOT EXISTS (
    SELECT 1
    FROM public.project_participants participant
    WHERE participant.project_id = project.id
      AND participant.organization_id = organization.id
  );
