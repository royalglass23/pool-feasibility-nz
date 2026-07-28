/** Normalizes common New Zealand address formatting without inferring identity. */
export function normalizeAddressQuery(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-NZ")
    .replace(/\bnew\s+zealand\b/gu, " ")
    .replace(/\b\d{4}\b/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
