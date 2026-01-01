import { ThemePreference } from './preferences';
import { BroadCEFR } from './difficulty';
import { BayesianUserProfile, JLPTLevel } from './vocabularyPredictor';

/**
 * Convert BayesianUserProfile to BroadCEFR unknown rates for compatibility
 * Maps JLPT mastery to unknown rates:
 * - N5/N4 → A1_A2
 * - N3 → B1_B2  
 * - N2/N1 → C1_plus
 */
export function bayesianToUnknownRate(profile: BayesianUserProfile): Record<BroadCEFR, number> {
    const mastery = profile.jlptMastery;

    // Average N5/N4 mastery for A1_A2 level
    const n5n4Mastery = (mastery.N5 + mastery.N4) / 2;

    // N3 mastery for B1_B2 level
    const n3Mastery = mastery.N3;

    // Average N2/N1 mastery for C1_plus level
    const n2n1Mastery = (mastery.N2 + mastery.N1) / 2;

    // Unknown rate = 1 - mastery
    return {
        A1_A2: Math.max(0, Math.min(1, 1 - n5n4Mastery)),
        B1_B2: Math.max(0, Math.min(1, 1 - n3Mastery)),
        C1_plus: Math.max(0, Math.min(1, 1 - n2n1Mastery)),
    };
}

/**
 * Get estimated level from BayesianUserProfile (1.0-6.0 scale)
 * This can be used as recommendedLevel parameter
 */
export function bayesianToRecommendedLevel(profile: BayesianUserProfile): number {
    return profile.estimatedLevel;
}

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
 * Estimate the unknown word rate for an item based on its level and the user's profile.
 * This is a simplified approach that doesn't require the item to have a detailed lex_profile.
 */
function estimateUnknownRate(
    itemLevel: number,
    userUnknownRate: Record<BroadCEFR, number>
): number {
    // Map Item Level (1-6) to Broad CEFR
    let band: BroadCEFR = 'A1_A2';
    if (itemLevel >= 5) band = 'C1_plus';
    else if (itemLevel >= 3) band = 'B1_B2';

    // Get the user's unknown rate for this band
    // Default to 0 if missing (optimistic)
    return userUnknownRate[band] || 0;
}

/**
 * Compute a score multiplier based on the estimated unknown rate.
 * Target: 5% - 20% unknown rate is the "sweet spot".
 */
function scoreUnknownRate(rate: number): number {
    if (rate < 0.02) return 0.6; // Too easy (boring)
    if (rate > 0.30) return 0.4; // Too hard (frustrating)
    if (rate >= 0.05 && rate <= 0.20) return 1.0; // Perfect flow
    return 0.8; // Acceptable
}

/**
 * Get the next recommended item from a list of candidates.
 */
export function getNextRecommendedItem(
    currentItemId: string,
    candidates: RecommendationCandidate[],
    themePrefs: Record<string, ThemePreference>, // theme_id -> ThemePreference
    recommendedLevel: number | null,
    currentLang: string,
    vocabUnknownRate: Record<BroadCEFR, number> = { A1_A2: 0, B1_B2: 0, C1_plus: 0 }
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
        let practiceWeight = 1.0;
        if (item.isPracticed) practiceWeight = 0.1;
        else if (item.status === 'draft') practiceWeight = 0.7;
        else practiceWeight = 1.0;

        // Difficulty Weight (Level Match)
        let levelWeight = 0.5;
        if (recommendedLevel != null) {
            const diff = Math.abs(item.level - recommendedLevel);
            if (diff === 0) levelWeight = 1.0;
            else if (diff === 1) levelWeight = 0.6;
            else if (diff === 2) levelWeight = 0.3;
            else levelWeight = 0.0;
        }

        // Vocab Weight (Estimated Unknown Rate)
        const estimatedRate = estimateUnknownRate(item.level, vocabUnknownRate);
        const vocabWeight = scoreUnknownRate(estimatedRate);

        // Combined Difficulty Score (60% Level, 40% Vocab)
        // We give vocab a significant weight to avoid "too hard" items even if level matches
        const difficultyScore = 0.6 * levelWeight + 0.4 * vocabWeight;

        // Theme Weight
        const pref = item.theme_id ? themePrefs[item.theme_id] : undefined;
        const basePref = pref?.weight ?? 0.3;
        const themeWeight = Math.max(0, Math.min(1, basePref));

        // Total Score
        // 0.4 * theme + 0.4 * difficulty + 0.2 * practice
        const score = 0.4 * themeWeight + 0.4 * difficultyScore + 0.2 * practiceWeight;

        return { item, score, themePref: pref, estimatedRate };
    });

    // 4. Sort
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best) return null;

    // 5. Generate Reason
    const reason = getRecommendationReason(best.item, best.themePref, recommendedLevel, best.estimatedRate);

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
    userLevel: number | null,
    estimatedRate?: number
): string {
    // 1. Check for top scenes
    const topScenes = themePref?.topScenes || [];
    const meaningfulScenes = topScenes.filter(s => s.weight > 0.1);

    if (meaningfulScenes.length > 0) {
        const scenesToShow = meaningfulScenes.slice(0, 2);
        const sceneNames = scenesToShow.map(s => s.name_cn).join(' + ');
        return `因为你想多练【${sceneNames}】，这篇【${item.title}】L${item.level} 练习特别适合。`;
    }

    // 2. Vocab Reason (if perfect match)
    if (estimatedRate !== undefined && estimatedRate >= 0.05 && estimatedRate <= 0.20) {
        return `这篇 L${item.level} 文章的生词率适中（约 ${(estimatedRate * 100).toFixed(0)}%），非常适合你当前的词汇水平。`;
    }

    // 3. Fallback to Theme Title
    if (item.themeTitle) {
        return `因为你关注【${item.themeTitle}】主题，推荐这篇 L${item.level} 练习。`;
    }

    // 4. Generic Fallback
    return `这篇练习难度为 L${item.level}，适合作为你当前水平的下一步练习。`;
}
