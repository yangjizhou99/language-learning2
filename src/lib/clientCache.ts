type CacheEntry<T> = { value: T; expiresAt: number };

const CACHE = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string): T | null {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    CACHE.delete(key);
    return null;
  }
  return hit.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs = 30_000): void {
  CACHE.set(key, { value, expiresAt: Date.now() + ttlMs });
}


