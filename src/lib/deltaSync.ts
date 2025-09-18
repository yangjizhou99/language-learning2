export function getLastSync(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setLastSync(key: string, iso: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, iso);
  } catch {}
}

export function mergeById<T extends { id: string; created_at?: string; updated_at?: string }>(
  prev: T[],
  next: T[],
): T[] {
  const byId: Record<string, T> = {} as any;
  for (const it of [...prev, ...next]) byId[it.id] = it;
  return Object.values(byId).sort(
    (a: any, b: any) =>
      new Date(b.updated_at || b.created_at || 0).getTime() -
      new Date(a.updated_at || a.created_at || 0).getTime(),
  );
}

export function maxUpdatedAt<T extends { created_at?: string; updated_at?: string }>(
  items: T[],
  fallback?: string | null,
): string | null {
  let maxIso: string | null = fallback || null;
  for (const d of items) {
    const iso = new Date((d as any).updated_at || (d as any).created_at || 0).toISOString();
    if (!maxIso || iso > maxIso) maxIso = iso;
  }
  return maxIso;
}
