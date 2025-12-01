export type ClozeShadowingFilterPersist = {
  lang?: 'zh' | 'ja' | 'en';
  level?: number | null;
  practiced?: 'all' | 'practiced' | 'unpracticed';
  theme?: string | null;
  subtopic?: string | null;
  q?: string | null;
  genre?: string | null;
  dialogue_type?: string | null;
  sort?: 'recommended' | 'recent' | 'levelAsc' | 'levelDesc' | 'completion';
};

const STORAGE_KEY = 'cloze-shadowing:filters';
const DEFAULT_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3天

type StoredValue = {
  filters: ClozeShadowingFilterPersist;
  expiresAt: number;
};

export function loadFilters(): ClozeShadowingFilterPersist | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredValue | null;
    if (!data || !data.expiresAt || Date.now() > data.expiresAt) return null;
    return data.filters || null;
  } catch {
    return null;
  }
}

export function saveFilters(filters: ClozeShadowingFilterPersist, ttlMs: number = DEFAULT_TTL_MS): void {
  try {
    if (typeof window === 'undefined') return;
    const toStore: StoredValue = {
      filters,
      expiresAt: Date.now() + ttlMs,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // noop
  }
}


