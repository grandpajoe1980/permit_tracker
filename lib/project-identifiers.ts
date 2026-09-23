export const DEFAULT_PROJECT_NUMBER = "PRJ-PECAN-2026";
export const DEFAULT_PROJECT_LEGACY_ID = "proj-spacex-pecan";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normalizes a project reference supplied by a URL or form. A missing value
 * stays missing; callers must never infer the demo project in production.
 */
export function normalizeProjectReference(projectReference: string | null | undefined): string | null {
  const normalized = projectReference?.trim();
  return normalized ? canonicalProjectReference(normalized) : null;
}

export function isProjectUuid(projectReference: string): boolean {
  return UUID_PATTERN.test(projectReference);
}

export function projectReferenceFromUrl(url: URL): string | null {
  return normalizeProjectReference(url.searchParams.get("projectId"));
}

export function isFixtureProjectReference(projectReference: string): boolean {
  return normalizeProjectReference(projectReference) === DEFAULT_PROJECT_NUMBER;
}

/**
 * Converts the original fixture-only project reference to the canonical
 * database number before a production mutation is sent to Supabase.
 */
export function canonicalProjectReference(projectReference: string): string {
  return projectReference === DEFAULT_PROJECT_LEGACY_ID ? DEFAULT_PROJECT_NUMBER : projectReference;
}

export function legacyProjectReferences(projectNumber: string): string[] {
  return projectNumber === DEFAULT_PROJECT_NUMBER ? [DEFAULT_PROJECT_LEGACY_ID] : [];
}
