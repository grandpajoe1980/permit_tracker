export const DEFAULT_PROJECT_NUMBER = "PRJ-PECAN-2026";
export const DEFAULT_PROJECT_LEGACY_ID = "proj-spacex-pecan";

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
