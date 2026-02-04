import { ThemePreference } from './preferences';

// --- Types ---

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
// Simplified for internal logic if needed, but keeping full CEFR is better for future proofing
// For the "A1_A2" style in the prompt, we can map:
export type BroadCEFR = 'A1_A2' | 'B1_B2' | 'C1_plus';

export interface UserAbilityState {
    userId: string;
    level: number; // 1.0 ~ 6.0
    vocabUnknownRate: Record<BroadCEFR, number>;
    comprehensionRate: number; // 0.0 ~ 1.0, EMA of quiz correct rate
    exploreConfig: {
        mainRatio: number;
        downRatio: number;
        upRatio: number;
    };
    bayesianProfile?: {
        jlptMastery: Record<string, number>;
        estimatedLevel: number;
        evidenceCount: number;
        frequencyThreshold: number;
    } | null;
}

export interface ShadowingItemMetadata {
    id: string;
    level: number; // 1.0 ~ 6.0
    lexProfile: Record<BroadCEFR, number>;
    lang?: string; // 'ja', 'en', 'zh', 'ko' etc.
}

export type SelfDifficulty = 'too_easy' | 'just_right' | 'a_bit_hard' | 'too_hard';

export interface SentencePracticeRecord {
    sentenceId: string;
    firstScore: number;
    bestScore: number;
    attempts: number;
}

export interface UserShadowingSession {
    userId: string;
    itemId: string;
    itemLevel: number;
    sentences: SentencePracticeRecord[];
    totalTimeSec: number;
    selfDifficulty?: SelfDifficulty;
    newWords: {
        word: string;
        cefrLevel?: string; // Raw CEFR from DB/AI
    }[];
    itemLexProfile?: Record<BroadCEFR, number>; // Passed from item metadata for calculation
    quizResult?: {
        correctCount: number;
        total: number;
    };
}

// --- Constants & Helpers ---

function mapToBroadCEFR(level: string | undefined): BroadCEFR {
    if (!level) return 'B1_B2'; // Default fallback
    const l = level.toUpperCase();
    if (l.includes('A1') || l.includes('A2')) return 'A1_A2';
    if (l.includes('B1') || l.includes('B2')) return 'B1_B2';
    if (l.includes('C1') || l.includes('C2')) return 'C1_plus';
    return 'B1_B2';
}

function average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

// --- Core Logic: Session Analysis ---

export function calculateSessionSkill(session: UserShadowingSession, totalTokens: number): number {
    // 1. Pronunciation / Accuracy (First Attempt)
    const avgFirstScore = average(session.sentences.map((s) => s.firstScore / 100)); // Assuming score is 0-100

    // 2. Attempts Penalty
    const avgAttempts = average(session.sentences.map((s) => s.attempts));
    // attempts = 1 -> 1.0, attempts = 3 -> 0.7, attempts >= 5 -> 0.6
    const attemptsFactor = Math.max(0.6, 1 - 0.15 * (avgAttempts - 1));

    // 3. Subjective Difficulty
    let selfFactor = 1.0;
    switch (session.selfDifficulty) {
        case 'too_easy':
            selfFactor = 1.1;
            break;
        case 'just_right':
            selfFactor = 1.0;
            break;
        case 'a_bit_hard':
            selfFactor = 0.95;
            break;
        case 'too_hard':
            selfFactor = 0.8;
            break;
    }

    // 4. New Word Ratio
    // If totalTokens is not provided, we might skip this or estimate
    let newWordFactor = 1.0;
    if (totalTokens > 0) {
        const newWordRatio = session.newWords.length / totalTokens;
        if (newWordRatio < 0.03) {
            newWordFactor = 0.9; // Too easy vocab-wise
        } else if (newWordRatio <= 0.25) {
            newWordFactor = 1.05; // Sweet spot
        } else {
            newWordFactor = 0.8; // Too many new words
        }
    }

    // 5. Quiz Comprehension Factor
    // If quiz result is available, adjust based on correct rate
    let quizFactor = 1.0;
    if (session.quizResult && session.quizResult.total > 0) {
        const correctRate = session.quizResult.correctCount / session.quizResult.total;
        if (correctRate >= 1.0) {
            quizFactor = 1.1; // Perfect comprehension
        } else if (correctRate >= 0.7) {
            quizFactor = 1.0; // Good comprehension
        } else if (correctRate >= 0.5) {
            quizFactor = 0.9; // Moderate comprehension
        } else {
            quizFactor = 0.8; // Poor comprehension, needs easier content
        }
    }

    // Synthesize
    // Base skill is heavily weighted by actual performance (avgFirstScore)
    // But adjusted by how much effort it took (attempts), subjective feeling, and comprehension
    return avgFirstScore * attemptsFactor * selfFactor * newWordFactor * quizFactor;
}

// --- Core Logic: State Update ---

export function updateAbilityLevel(
    currentLevel: number,
    itemLevel: number,
    sessionSkill: number
): number {
    const step = 0.08;
    let newLevel = currentLevel;

    // Only update if the item wasn't ridiculously easy (prevent farming low level items)
    if (itemLevel >= currentLevel - 0.5) {
        if (sessionSkill > 0.9) {
            // Performed well on a relevant item
            newLevel += step;
        } else if (sessionSkill < 0.5) {
            // Performed poorly
            newLevel -= step;
        }
    }

    // Clamp
    return Math.max(1.0, Math.min(6.0, newLevel));
}

export function updateVocabUnknownRate(
    currentRate: Record<BroadCEFR, number>,
    session: UserShadowingSession,
    totalTokens: number
): Record<BroadCEFR, number> {
    if (!session.itemLexProfile || totalTokens === 0) return currentRate;

    const alpha = 0.2; // Learning rate
    const newCounts: Record<BroadCEFR, number> = { A1_A2: 0, B1_B2: 0, C1_plus: 0 };

    session.newWords.forEach((w) => {
        const broad = mapToBroadCEFR(w.cefrLevel);
        newCounts[broad]++;
    });

    const nextRate = { ...currentRate };
    const levels: BroadCEFR[] = ['A1_A2', 'B1_B2', 'C1_plus'];

    levels.forEach((level) => {
        const levelTokenCount = totalTokens * (session.itemLexProfile![level] || 0);
        if (levelTokenCount > 5) { // Only update if there's enough data points in this text
            const observedRate = newCounts[level] / levelTokenCount;
            // Exponential moving average
            nextRate[level] = (1 - alpha) * (currentRate[level] || 0) + alpha * observedRate;
        }
    });

    return nextRate;
}

/**
 * Update user's comprehension rate based on quiz results.
 * Uses Exponential Moving Average (EMA) to smooth out fluctuations.
 * 
 * @param currentRate - Current comprehension rate (0.0 ~ 1.0)
 * @param quizResult - Quiz result with correctCount and total
 * @returns Updated comprehension rate
 */
export function updateComprehensionRate(
    currentRate: number,
    quizResult: { correctCount: number; total: number } | undefined | null
): number {
    // If no quiz result, return current rate unchanged
    if (!quizResult || quizResult.total === 0) return currentRate;

    const alpha = 0.3; // Learning rate - higher = more responsive to recent performance
    const observedRate = quizResult.correctCount / quizResult.total;

    // Exponential moving average
    return (1 - alpha) * currentRate + alpha * observedRate;
}

// --- Core Logic: Recommendation Scoring ---

export function calculateDifficultyScore(
    user: UserAbilityState,
    item: ShadowingItemMetadata,
    targetBand: 'down' | 'main' | 'up'
): number {
    // 1. JLPT-based Bayesian profile scoring is only applicable for Japanese content
    // For other languages (English, Chinese, Korean), use CEFR-based fallback logic
    const isJapanese = item.lang === 'ja';

    if (user.bayesianProfile && isJapanese) {
        // Use JLPT mastery for Japanese content
        const predictedComprehension = calculatePredictedComprehension(user.bayesianProfile, item);
        return computeComprehensionMatch(predictedComprehension, targetBand);
    }

    // 2. CEFR-based scoring for English and other languages (or fallback for Japanese without Bayesian profile)
    const levelScore = computeLevelMatch(user.level, item.level, targetBand);
    const lexScore = computeLexMatch(user.vocabUnknownRate, item.lexProfile);

    // Weighting: Level is primary, Lexical profile is secondary fine-tuning
    return 0.7 * levelScore + 0.3 * lexScore;
}

/**
 * Calculate predicted comprehension rate (0.0 - 1.0) based on JLPT mastery
 */
function calculatePredictedComprehension(
    profile: NonNullable<UserAbilityState['bayesianProfile']>,
    item: ShadowingItemMetadata
): number {
    // 1. Estimate item's JLPT distribution from its CEFR lexProfile
    // This is a heuristic since we don't have direct JLPT stats on items yet
    // Mapping: A1/A2 -> N5/N4, B1 -> N3, B2 -> N2, C1+ -> N1

    // Normalize lexProfile to ensure sum is 1.0 (or close to it)
    const lex = item.lexProfile;
    const totalWeight = (lex.A1_A2 || 0) + (lex.B1_B2 || 0) + (lex.C1_plus || 0);

    if (totalWeight === 0) return 0.5; // Unknown item, assume 50%

    // Distribute CEFR weights to JLPT levels
    // A1_A2 (Beginner) -> Split between N5 and N4
    const wN5 = ((lex.A1_A2 || 0) / totalWeight) * 0.6; // N5 is easiest
    const wN4 = ((lex.A1_A2 || 0) / totalWeight) * 0.4;

    // B1_B2 (Intermediate) -> Split between N3 and N2
    const wN3 = ((lex.B1_B2 || 0) / totalWeight) * 0.6; // B1 ~ N3
    const wN2 = ((lex.B1_B2 || 0) / totalWeight) * 0.4; // B2 ~ N2

    // C1_plus (Advanced) -> N1
    const wN1 = ((lex.C1_plus || 0) / totalWeight);

    // 2. Calculate weighted mastery
    // Comprehension = Sum(Weight_L * Mastery_L)
    const mastery = profile.jlptMastery;

    const score =
        wN5 * (mastery.N5 || 0) +
        wN4 * (mastery.N4 || 0) +
        wN3 * (mastery.N3 || 0) +
        wN2 * (mastery.N2 || 0) +
        wN1 * (mastery.N1 || 0);

    return Math.max(0, Math.min(1, score));
}

function computeComprehensionMatch(
    predictedComprehension: number,
    band: 'down' | 'main' | 'up'
): number {
    let idealComp = 0.85; // Default main
    let tolerance = 0.1;

    switch (band) {
        case 'down':
            // Consolidate: 95% - 100% comprehension
            idealComp = 0.97;
            tolerance = 0.05;
            break;
        case 'main':
            // Learn: 80% - 90% comprehension (i+1)
            idealComp = 0.85;
            tolerance = 0.1;
            break;
        case 'up':
            // Challenge: 60% - 75% comprehension
            idealComp = 0.68;
            tolerance = 0.12;
            break;
    }

    const diff = Math.abs(predictedComprehension - idealComp);

    // Gaussian-like drop-off
    // If within tolerance, score is high. Outside, drops fast.
    if (diff <= tolerance) {
        return 1.0 - (diff / tolerance) * 0.2; // 0.8 - 1.0 inside tolerance
    } else {
        // Outside tolerance
        const extraDiff = diff - tolerance;
        return Math.max(0, 0.8 - extraDiff * 3.0); // Drop off
    }
}

function computeLevelMatch(
    userLevel: number,
    itemLevel: number,
    band: 'down' | 'main' | 'up'
): number {
    const delta = itemLevel - userLevel;
    let idealDelta = 0;

    switch (band) {
        case 'main':
            idealDelta = 0.2; // Slightly challenging
            break;
        case 'down':
            idealDelta = -0.5; // Easy / Review
            break;
        case 'up':
            idealDelta = 0.6; // Hard / Explore
            break;
    }

    const diff = Math.abs(delta - idealDelta);
    // Score drops as we move away from ideal delta
    // 1.0 at ideal, 0.0 at +/- 1.0 distance
    let score = 1 - diff;
    return Math.max(0, Math.min(1, score));
}

function computeLexMatch(
    userUnknownRate: Record<BroadCEFR, number>,
    itemLexProfile: Record<BroadCEFR, number>
): number {
    // Expected unknown ratio = sum(item_level_ratio * user_unknown_prob)
    const expectedUnknownRatio =
        (itemLexProfile.A1_A2 || 0) * (userUnknownRate.A1_A2 || 0) +
        (itemLexProfile.B1_B2 || 0) * (userUnknownRate.B1_B2 || 0) +
        (itemLexProfile.C1_plus || 0) * (userUnknownRate.C1_plus || 0);

    // Sweet spot: 5% ~ 20% unknown words
    if (expectedUnknownRatio < 0.02) return 0.5; // Too easy
    if (expectedUnknownRatio > 0.30) return 0.4; // Too hard
    if (expectedUnknownRatio >= 0.05 && expectedUnknownRatio <= 0.20) return 1.0; // Perfect
    return 0.8; // Okay
}

export function pickTargetBand(user: UserAbilityState): 'down' | 'main' | 'up' {
    const r = Math.random();
    const { downRatio, mainRatio } = user.exploreConfig;

    if (r < downRatio) return 'down';
    if (r < downRatio + mainRatio) return 'main';
    return 'up';
}

export function updateExploreConfig(
    currentConfig: { mainRatio: number; downRatio: number; upRatio: number },
    comprehensionRate: number,
    recentSessionScore: number
): { mainRatio: number; downRatio: number; upRatio: number } {
    // Clone to avoid mutation
    let { mainRatio, downRatio, upRatio } = currentConfig;
    const step = 0.05; // 5% adjustment step

    // Strategy:
    // High performance (comp > 0.8) -> Increase Challenge (up), Decrease Consolidation (down)
    // Low performance (comp < 0.6) -> Increase Consolidation (down), Decrease Challenge (up)
    // Main ratio acts as a buffer or is adjusted to keep sum = 1.0

    if (comprehensionRate > 0.8) {
        // Doing well, push for more challenge
        if (upRatio < 0.4) {
            upRatio += step;
            // Take from downRatio first, then mainRatio
            if (downRatio > 0.1) {
                downRatio -= step;
            } else {
                mainRatio -= step;
            }
        }
    } else if (comprehensionRate < 0.6) {
        // Struggling, need more consolidation
        if (downRatio < 0.4) {
            downRatio += step;
            // Take from upRatio first, then mainRatio
            if (upRatio > 0.1) {
                upRatio -= step;
            } else {
                mainRatio -= step;
            }
        }
    }

    // Normalize to ensure strict 1.0 sum (handling floating point errors)
    const total = mainRatio + downRatio + upRatio;
    return {
        mainRatio: Number((mainRatio / total).toFixed(2)),
        downRatio: Number((downRatio / total).toFixed(2)),
        upRatio: Number((upRatio / total).toFixed(2)),
    };
}
