export function isSiteIndexingEnabled(
  value = process.env.SITE_INDEXING_ENABLED,
): boolean {
  return value === "true";
}
