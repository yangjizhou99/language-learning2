import { ThemePreference } from './preferences';

export interface RecommendationCandidate {
    id: string;
    lang: string;
    level: number;
    theme_id?: string;
    themeTitle?: string;
    isPracticed: boolean;
    status?: string; // 'draft' | 'completed'
    title: string;
    genre?: string;
    lastPracticed?: string | null;
}

export interface RecommendationResult {
    item: RecommendationCandidate;
    reason: string;
    score: number;
}

/**
 * Get the next recommended item from a list of candidates.
 */
export function getNextRecommendedItem(
    currentItemId: string,
    candidates: RecommendationCandidate[],
    themePrefs: Record<string, ThemePreference>, // theme_id -> ThemePreference
    recommendedLevel: number | null,
    currentLang: string
): RecommendationResult | null {
    // 1. Basic Filter
    let pool = candidates.filter(
        (item) => item.id !== currentItemId && item.lang === currentLang
    );

    if (pool.length === 0) return null;

    // 2. Prioritize uncompleted items (draft or unpracticed)
    const uncompleted = pool.filter((item) => !item.isPracticed && item.status !== 'completed');
    if (uncompleted.length > 0) {
        pool = uncompleted;
    }

    // 3. Scoring
    const scored = pool.map((item) => {
        // Practice Weight
        // draft: 0.7 (high priority to finish drafts)
        // unpracticed: 1.0 (normal)
        // practiced: 0.1 (review)
        let practiceWeight = 1.0;
        if (item.isPracticed) practiceWeight = 0.1;
        else if (item.status === 'draft') practiceWeight = 0.7;
        else practiceWeight = 1.0;

        // Difficulty Weight
        let difficultyWeight = 0.5;
        if (recommendedLevel != null) {
            const diff = Math.abs(item.level - recommendedLevel);
            if (diff === 0) difficultyWeight = 1.0;
            else if (diff === 1) difficultyWeight = 0.6;
            else if (diff === 2) difficultyWeight = 0.3;
            else difficultyWeight = 0.0;
        }

        // Theme Weight
        const pref = item.theme_id ? themePrefs[item.theme_id] : undefined;
        const basePref = pref?.weight ?? 0.3;
        const themeWeight = Math.max(0, Math.min(1, basePref));

        // Total Score
        // 0.5 * theme + 0.3 * difficulty + 0.2 * practice
        const score = 0.5 * themeWeight + 0.3 * difficultyWeight + 0.2 * practiceWeight;

        return { item, score, themePref: pref };
    });

    // 4. Sort
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best) return null;

    // 5. Generate Reason
    const reason = getRecommendationReason(best.item, best.themePref, recommendedLevel);

    return {
        item: best.item,
        reason,
        score: best.score,
    };
}

/**
 * Generate a template-based recommendation reason.
 */
export function getRecommendationReason(
    item: RecommendationCandidate,
    themePref: ThemePreference | undefined,
    userLevel: number | null
): string {
    // 1. Check for top scenes
    const topScenes = themePref?.topScenes || [];

    // Filter scenes with meaningful weight (e.g. > 0.1)
    const meaningfulScenes = topScenes.filter(s => s.weight > 0.1);

    if (meaningfulScenes.length > 0) {
        // Take top 1-2
        const scenesToShow = meaningfulScenes.slice(0, 2);
        const sceneNames = scenesToShow.map(s => s.name_cn).join(' + ');

        if (scenesToShow.length === 1) {
            return `因为你想多练【${sceneNames}】场景，这篇【${item.title}】L${item.level} 练习特别适合。`;
        } else {
            return `因为你想多练【${sceneNames}】，这篇【${item.title}】L${item.level} 练习特别适合。`;
        }
    }

    // 2. Fallback to Theme Title if available
    if (item.themeTitle) {
        return `因为你关注【${item.themeTitle}】主题，推荐这篇 L${item.level} 练习。`;
    }

    // 3. Generic Fallback
    return `这篇练习难度为 L${item.level}，适合作为你当前水平的下一步练习。`;
}
