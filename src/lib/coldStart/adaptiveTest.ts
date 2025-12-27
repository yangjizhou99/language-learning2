/**
 * Adaptive Vocabulary Test (Computer Adaptive Testing)
 * 
 * Uses binary search + IRT-like ability estimation to find user's JLPT level
 * with 8-15 questions (dynamically selected from ja-jlpt-combined.json)
 */

import { JLPTLevel, BayesianUserProfile } from '@/lib/recommendation/vocabularyPredictor';

// Load vocabulary dictionary
const jaJlptCombined = require('@/data/vocab/ja-jlpt-combined.json') as Record<string, string>;

// ==================== Types ====================

export interface AdaptiveTestWord {
    word: string;
    level: JLPTLevel;
    difficulty: number;  // 1.0 (N5) - 5.0 (N1)
}

export interface TestResponse {
    word: string;
    level: JLPTLevel;
    isKnown: boolean;
    difficulty: number;
}

export interface AdaptiveTestState {
    currentEstimate: number;      // 1.0-5.0 ability estimate
    confidence: number;           // 0-1 confidence in estimate
    responses: TestResponse[];    // history of responses
    answeredWords: Set<string>;   // words already tested
    isComplete: boolean;          // test finished?
}

export interface AdaptiveTestResult {
    estimatedLevel: number;       // 1.0-5.0
    jlptEquivalent: string;       // "N3" or "N3-N2之间"
    confidence: number;
    jlptMastery: Record<JLPTLevel, number>;
    questionsAnswered: number;
}

// ==================== Constants ====================

const DIFFICULTY_MAP: Record<JLPTLevel, number> = {
    N5: 1.0,
    N4: 2.0,
    N3: 3.0,
    N2: 4.0,
    N1: 5.0,
};

const STOP_CONDITIONS = {
    maxQuestions: 15,
    minQuestions: 8,
    confidenceThreshold: 0.85,
    stabilityWindow: 3,
    stabilityThreshold: 0.15,
};

// ==================== Word Pool ====================

// Build word pool from dictionary, filtered for clean test words
let cachedWordPool: AdaptiveTestWord[] | null = null;

function getWordPool(): AdaptiveTestWord[] {
    if (cachedWordPool) return cachedWordPool;

    const pool: AdaptiveTestWord[] = [];

    for (const [word, levelStr] of Object.entries(jaJlptCombined)) {
        // Skip words with special characters or too short/long
        if (word.includes('～') || word.includes('(') || word.includes(' ')) continue;
        if (word.length < 2 || word.length > 6) continue;

        // Normalize level
        const level = levelStr.toUpperCase() as JLPTLevel;
        if (!['N5', 'N4', 'N3', 'N2', 'N1'].includes(level)) continue;

        pool.push({
            word,
            level,
            difficulty: DIFFICULTY_MAP[level],
        });
    }

    cachedWordPool = pool;
    return pool;
}

// ==================== Adaptive Algorithm ====================

/**
 * Initialize a new adaptive test
 */
export function initAdaptiveTest(): AdaptiveTestState {
    return {
        currentEstimate: 3.0,  // Start at N3 level
        confidence: 0,
        responses: [],
        answeredWords: new Set(),
        isComplete: false,
    };
}

/**
 * Select the next word based on current ability estimate
 * Uses maximum information selection (word closest to ability estimate)
 */
export function selectNextWord(state: AdaptiveTestState): AdaptiveTestWord | null {
    const pool = getWordPool();

    // Filter out already answered words
    const candidates = pool.filter(w => !state.answeredWords.has(w.word));

    if (candidates.length === 0) return null;

    // Sort by information (closest to current estimate = most informative)
    // Add small randomness to avoid always picking the same word
    candidates.sort((a, b) => {
        const infoA = Math.abs(a.difficulty - state.currentEstimate);
        const infoB = Math.abs(b.difficulty - state.currentEstimate);
        // Add randomness (±0.5 range) to make selection varied
        return (infoA + Math.random() * 0.5) - (infoB + Math.random() * 0.5);
    });

    // Pick from top 5 candidates randomly for variety
    const topCandidates = candidates.slice(0, 5);
    return topCandidates[Math.floor(Math.random() * topCandidates.length)];
}

/**
 * Update ability estimate based on response (IRT-like)
 */
export function updateState(
    state: AdaptiveTestState,
    word: AdaptiveTestWord,
    isKnown: boolean
): AdaptiveTestState {
    const newResponses = [...state.responses, {
        word: word.word,
        level: word.level,
        isKnown,
        difficulty: word.difficulty,
    }];

    const newAnsweredWords = new Set(state.answeredWords);
    newAnsweredWords.add(word.word);

    // IRT-like update
    // P(correct) = 1 / (1 + exp(-(ability - difficulty)))
    const expectedP = 1 / (1 + Math.exp(-(state.currentEstimate - word.difficulty)));

    // Learning rate decreases as we get more responses
    const learningRate = 0.4 / Math.sqrt(newResponses.length);

    // Update estimate
    const update = isKnown
        ? learningRate * (1 - expectedP)   // Surprised correct → increase estimate
        : -learningRate * expectedP;        // Surprised incorrect → decrease estimate

    const newEstimate = Math.max(0.5, Math.min(5.5, state.currentEstimate + update));

    // Calculate confidence based on stability of recent estimates
    let confidence = 0;
    if (newResponses.length >= STOP_CONDITIONS.minQuestions) {
        const recentResponses = newResponses.slice(-STOP_CONDITIONS.stabilityWindow);
        const estimates = simulateEstimateHistory(newResponses);
        const recentEstimates = estimates.slice(-STOP_CONDITIONS.stabilityWindow);

        if (recentEstimates.length >= STOP_CONDITIONS.stabilityWindow) {
            const maxDiff = Math.max(...recentEstimates.map((e, i, arr) =>
                i === 0 ? 0 : Math.abs(e - arr[i - 1])
            ));
            confidence = Math.min(1.0, 1.0 - (maxDiff / STOP_CONDITIONS.stabilityThreshold));
        }
    }

    // Check if test should end
    const isComplete =
        (newResponses.length >= STOP_CONDITIONS.maxQuestions) ||
        (newResponses.length >= STOP_CONDITIONS.minQuestions && confidence >= STOP_CONDITIONS.confidenceThreshold);

    return {
        currentEstimate: newEstimate,
        confidence,
        responses: newResponses,
        answeredWords: newAnsweredWords,
        isComplete,
    };
}

/**
 * Simulate estimate history for stability check
 */
function simulateEstimateHistory(responses: TestResponse[]): number[] {
    let estimate = 3.0;
    const history: number[] = [estimate];

    for (let i = 0; i < responses.length; i++) {
        const r = responses[i];
        const expectedP = 1 / (1 + Math.exp(-(estimate - r.difficulty)));
        const learningRate = 0.4 / Math.sqrt(i + 1);
        const update = r.isKnown
            ? learningRate * (1 - expectedP)
            : -learningRate * expectedP;
        estimate = Math.max(0.5, Math.min(5.5, estimate + update));
        history.push(estimate);
    }

    return history;
}

/**
 * Calculate final test result
 */
export function calculateResult(state: AdaptiveTestState): AdaptiveTestResult {
    const estimate = state.currentEstimate;

    // Convert to JLPT equivalent string
    let jlptEquivalent: string;
    if (estimate >= 4.5) jlptEquivalent = 'N1';
    else if (estimate >= 3.8) jlptEquivalent = 'N1-N2之间';
    else if (estimate >= 3.5) jlptEquivalent = 'N2';
    else if (estimate >= 2.8) jlptEquivalent = 'N2-N3之间';
    else if (estimate >= 2.5) jlptEquivalent = 'N3';
    else if (estimate >= 1.8) jlptEquivalent = 'N3-N4之间';
    else if (estimate >= 1.5) jlptEquivalent = 'N4';
    else if (estimate >= 0.8) jlptEquivalent = 'N4-N5之间';
    else jlptEquivalent = 'N5';

    // Calculate mastery by level from responses
    const levelStats: Record<JLPTLevel, { known: number; total: number }> = {
        N5: { known: 0, total: 0 },
        N4: { known: 0, total: 0 },
        N3: { known: 0, total: 0 },
        N2: { known: 0, total: 0 },
        N1: { known: 0, total: 0 },
    };

    for (const r of state.responses) {
        levelStats[r.level].total++;
        if (r.isKnown) levelStats[r.level].known++;
    }

    // Calculate mastery with smoothing (blend with prior based on sample size)
    const priorMastery: Record<JLPTLevel, number> = {
        N5: Math.min(1.0, Math.max(0, (estimate - 0.5) / 0.8)),
        N4: Math.min(1.0, Math.max(0, (estimate - 1.3) / 1.0)),
        N3: Math.min(1.0, Math.max(0, (estimate - 2.0) / 1.2)),
        N2: Math.min(1.0, Math.max(0, (estimate - 3.0) / 1.5)),
        N1: Math.min(1.0, Math.max(0, (estimate - 4.0) / 1.5)),
    };

    const jlptMastery: Record<JLPTLevel, number> = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 };
    const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

    for (const level of levels) {
        const stats = levelStats[level];
        if (stats.total >= 2) {
            // Have data: blend with prior
            const observed = stats.known / stats.total;
            const weight = Math.min(0.8, stats.total / 5);
            jlptMastery[level] = weight * observed + (1 - weight) * priorMastery[level];
        } else {
            // No data: use prior only
            jlptMastery[level] = priorMastery[level];
        }
    }

    return {
        estimatedLevel: Math.round(estimate * 10) / 10,
        jlptEquivalent,
        confidence: state.confidence,
        jlptMastery,
        questionsAnswered: state.responses.length,
    };
}

/**
 * Get reading/meaning for a word (placeholder - would need dictionary)
 */
export function getWordInfo(word: string): { reading?: string; meaning?: string } {
    // In production, this would fetch from a dictionary API or database
    return {};
}

/**
 * Get pool statistics for debugging
 */
export function getPoolStats(): { total: number; byLevel: Record<JLPTLevel, number> } {
    const pool = getWordPool();
    const byLevel: Record<JLPTLevel, number> = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 };

    for (const w of pool) {
        byLevel[w.level]++;
    }

    return { total: pool.length, byLevel };
}
