export function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function nullableText(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized : null;
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function includesKeyword(haystack: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundaryPattern = /^[a-z0-9 -]+$/i.test(keyword) ? `(^|[^a-z0-9])${escaped}([^a-z0-9]|$)` : escaped;
  return new RegExp(boundaryPattern, "i").test(haystack);
}
