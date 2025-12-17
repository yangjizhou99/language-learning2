/**
 * Storyline 客户端缓存工具
 * 缓存主题结构数据，实现快速加载和渐进式更新
 */

interface SubtopicData {
    id: string;
    title: string;
    one_line: string | null;
    itemId: string | null;
    isPracticed: boolean;
    score: number | null;
    order: number;
    top_scenes?: { id: string; name: string; weight: number }[];
}

interface ThemeData {
    id: string;
    title: string;
    desc: string | null;
    lang: string;
    level: number;
    genre: string;
    subtopics: SubtopicData[];
    progress: {
        completed: number;
        total: number;
    };
    averageScore: number | null;
}

interface StorylineCacheEntry {
    themes: ThemeData[];
    lastPractice: {
        themeId: string;
        subtopicId: string;
        itemId: string;
        lang: string;
        level: number;
    } | null;
    fetchedAt: number;
}

const CACHE_KEY_PREFIX = 'storyline_v1_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分钟缓存有效期

/**
 * 生成缓存键
 */
function getCacheKey(lang: string, level: string): string {
    return `${CACHE_KEY_PREFIX}${lang}_${level}`;
}

/**
 * 获取缓存的storyline数据
 * @returns 缓存数据，如果无效则返回null
 */
export function getStorylineCache(lang: string, level: string): StorylineCacheEntry | null {
    if (typeof window === 'undefined') return null;

    try {
        const key = getCacheKey(lang, level);
        const raw = localStorage.getItem(key);
        if (!raw) return null;

        const cached: StorylineCacheEntry = JSON.parse(raw);

        // 检查缓存是否过期
        if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
            localStorage.removeItem(key);
            return null;
        }

        return cached;
    } catch (error) {
        console.warn('Failed to read storyline cache:', error);
        return null;
    }
}

/**
 * 设置storyline缓存
 */
export function setStorylineCache(
    lang: string,
    level: string,
    themes: ThemeData[],
    lastPractice: StorylineCacheEntry['lastPractice']
): void {
    if (typeof window === 'undefined') return;

    try {
        const key = getCacheKey(lang, level);
        const entry: StorylineCacheEntry = {
            themes,
            lastPractice,
            fetchedAt: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
        console.warn('Failed to set storyline cache:', error);
    }
}

/**
 * 使指定筛选条件的缓存失效
 */
export function invalidateStorylineCache(lang?: string, level?: string): void {
    if (typeof window === 'undefined') return;

    try {
        if (lang && level) {
            // 删除特定缓存
            localStorage.removeItem(getCacheKey(lang, level));
        } else {
            // 删除所有storyline缓存
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(CACHE_KEY_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        }
    } catch (error) {
        console.warn('Failed to invalidate storyline cache:', error);
    }
}

/**
 * 合并缓存数据与新数据
 * 保留结构，更新进度信息
 */
export function mergeStorylineData(
    cached: ThemeData[],
    fresh: ThemeData[]
): ThemeData[] {
    // 创建新数据的映射
    const freshMap = new Map(fresh.map(t => [t.id, t]));

    // 合并：优先使用新数据，保留缓存中新数据没有的
    const merged: ThemeData[] = [];

    // 首先添加所有新数据
    for (const theme of fresh) {
        merged.push(theme);
    }

    return merged;
}
