export function normalizeSlug(input: string): string {
  return input.trim().toLowerCase();
}

export function mergeQueryParams(targetUrl: string, incomingParams: URLSearchParams): string {
  const target = new URL(targetUrl);
  const incomingKeys = new Set<string>();

  for (const key of incomingParams.keys()) {
    incomingKeys.add(key);
  }

  for (const key of incomingKeys) {
    target.searchParams.delete(key);
    const allValues = incomingParams.getAll(key);
    for (const value of allValues) {
      target.searchParams.append(key, value);
    }
  }

  return target.toString();
}
