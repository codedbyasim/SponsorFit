type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const MAX = 100;
const TTL_MS = 10 * 60 * 1000;

export function cacheGet<T>(key: string, now = Date.now()): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expires <= now) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function cacheSet(key: string, value: unknown, now = Date.now()): void {
  if (store.size >= MAX) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { value, expires: now + TTL_MS });
}

export function cacheKey(path: string, params: Record<string, string>): string {
  const usp = new URLSearchParams(params);
  usp.sort();
  return `${path}?${usp.toString()}`;
}
