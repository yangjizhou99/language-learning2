/**
 * Vocabulary Predictor - Bayesian Knowledge Estimation
 * 
 * Predicts whether a user knows a given word based on:
 * - Prior probability (word level, frequency, language features)
 * - Likelihood (user's interaction history with the word)
 * 
 * Used to estimate article difficulty and drive personalized recommendations.
 */

import { getFrequencyRank } from '@/lib/nlp/wordFrequency';

// ==================== Types ====================

/** Word feature set for prior calculation */
export interface WordFeatures {
    surface: string;           // Surface form (original text)
    lemma?: string;            // Base form / dictionary form
    level: string;             // JLPT level (N5-N1) or 'unknown'
    frequencyRank: number;     // Frequency rank (1-based), -1 if not found
    isKanji: boolean;          // Contains kanji characters
    isLoanword: boolean;       // Katakana loanword
    length: number;            // Character length
}

/** User's evidence for a specific word */
export interface UserWordEvidence {
    // Strong evidence: explicitly marked as unknown
    markedUnknown: boolean;
    markedAt?: Date;

    // Weak evidence: exposure without marking
    exposureCount: number;      // Times appeared in practiced articles
    notMarkedCount: number;     // Times exposed but NOT marked as unknown

    // Timestamps
    firstSeenAt?: Date;
    lastSeenAt?: Date;
}

/** User profile relevant for prediction */
export interface UserProfileForPrediction {
    nativeLang: string;         // 'zh', 'en', 'ko', etc.
    abilityLevel: number;       // 1.0 - 6.0
    vocabUnknownRate?: {
        A1_A2: number;
        B1_B2: number;
        C1_plus: number;
    };
}

/** Prediction result for a single word */
export interface VocabularyPrediction {
    word: string;
    knownProbability: number;   // 0.0 - 1.0
    confidence: 'high' | 'medium' | 'low';
    contributingFactors: {
        levelFactor: number;
        frequencyFactor: number;
        evidenceFactor: number;
    };
}

/** Article-level prediction summary */
export interface ArticleVocabularyPrediction {
    predictions: VocabularyPrediction[];
    expectedUnknownCount: number;
    predictedUnknownRate: number;
    highConfidenceUnknown: string[];   // Words very likely unknown
    uncertainWords: string[];           // Words needing more data
}

// ==================== New User Profile Types ====================

/** JLPT level keys */
export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

/** New Bayesian-based user profile (replaces old ability_level and vocab_unknown_rate) */
export interface BayesianUserProfile {
    /** Mastery rate for each JLPT level (0.0 - 1.0) */
    jlptMastery: Record<JLPTLevel, number>;

    /** Frequency threshold: median frequency rank of known words */
    frequencyThreshold: number;

    /** Total evidence count (confidence indicator) */
    evidenceCount: number;

    /** Estimated overall ability (1.0-6.0, derived from jlptMastery) */
    estimatedLevel: number;

    /** Last update timestamp */
    lastUpdated: Date;
}

/** Raw vocabulary knowledge data from database */
export interface VocabKnowledgeRow {
    word: string;
    jlpt_level: string | null;
    frequency_rank: number | null;
    marked_unknown: boolean;
    exposure_count: number;
    not_marked_count: number;
}

/**
 * Calculate user profile from vocabulary knowledge evidence
 * This replaces the old ability_level and vocab_unknown_rate calculation
 */
export function calculateUserProfileFromEvidence(
    knowledgeData: VocabKnowledgeRow[]
): BayesianUserProfile {
    // Initialize counters for each level
    const levelStats: Record<JLPTLevel, { exposed: number; notMarked: number }> = {
        N5: { exposed: 0, notMarked: 0 },
        N4: { exposed: 0, notMarked: 0 },
        N3: { exposed: 0, notMarked: 0 },
        N2: { exposed: 0, notMarked: 0 },
        N1: { exposed: 0, notMarked: 0 },
    };

    const knownFrequencies: number[] = [];
    let evidenceCount = 0;

    for (const row of knowledgeData) {
        evidenceCount++;

        // Extract JLPT level
        const levelMatch = row.jlpt_level?.match(/N[1-5]/i);
        const level = levelMatch ? levelMatch[0].toUpperCase() as JLPTLevel : null;

        if (level && levelStats[level]) {
            levelStats[level].exposed += row.exposure_count || 1;
            levelStats[level].notMarked += row.not_marked_count || 0;
        }

        // Track frequency of likely-known words
        if (!row.marked_unknown && row.not_marked_count > 0 && row.frequency_rank && row.frequency_rank > 0) {
            knownFrequencies.push(row.frequency_rank);
        }
    }

    // Calculate mastery rate for each level
    const jlptMastery: Record<JLPTLevel, number> = {
        N5: 0.85, // Default for beginners
        N4: 0.65,
        N3: 0.40,
        N2: 0.20,
        N1: 0.10,
    };

    const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
    for (const level of levels) {
        const stats = levelStats[level];
        if (stats.exposed >= 5) { // Minimum evidence threshold
            // Mastery = (not marked) / (exposed)
            jlptMastery[level] = stats.notMarked / stats.exposed;
        }
    }

    // Calculate frequency threshold (median)
    let frequencyThreshold = 5000; // Default
    if (knownFrequencies.length >= 10) {
        knownFrequencies.sort((a, b) => a - b);
        const mid = Math.floor(knownFrequencies.length / 2);
        frequencyThreshold = knownFrequencies[mid];
    }

    // Calculate estimated level (1.0 - 6.0)
    // Weight: N5=1, N4=2, N3=3, N2=4, N1=5
    const weights = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
    let weightedSum = 0;
    let totalWeight = 0;

    for (const level of levels) {
        const masteryBonus = jlptMastery[level] * weights[level];
        weightedSum += masteryBonus;
        totalWeight += weights[level];
    }

    // Scale to 1.0 - 6.0 range
    const estimatedLevel = 1.0 + (weightedSum / totalWeight) * 5.0;

    return {
        jlptMastery,
        frequencyThreshold,
        evidenceCount,
        estimatedLevel: Math.max(1.0, Math.min(6.0, estimatedLevel)),
        lastUpdated: new Date(),
    };
}

/**
 * Get default profile for new users (cold start)
 */
export function getDefaultUserProfile(): BayesianUserProfile {
    return {
        jlptMastery: {
            N5: 0.70,  // Assume some basic knowledge
            N4: 0.45,
            N3: 0.25,
            N2: 0.10,
            N1: 0.05,
        },
        frequencyThreshold: 5000,
        evidenceCount: 0,
        estimatedLevel: 2.5,  // Roughly N4-N3 level
        lastUpdated: new Date(),
    };
}

// ==================== Constants ====================

/** Base prior probabilities by JLPT level (P(known | level)) */
const LEVEL_PRIORS: Record<string, number> = {
    N5: 0.92,
    N4: 0.82,
    N3: 0.60,
    N2: 0.35,
    N1: 0.18,
    unknown: 0.40,
};

/** Frequency band adjustments */
const FREQUENCY_FACTORS: { maxRank: number; factor: number }[] = [
    { maxRank: 500, factor: 1.3 },      // Very common → boost
    { maxRank: 1000, factor: 1.2 },
    { maxRank: 3000, factor: 1.1 },
    { maxRank: 5000, factor: 1.0 },     // Baseline
    { maxRank: 10000, factor: 0.85 },
    { maxRank: 15000, factor: 0.70 },
    { maxRank: Infinity, factor: 0.55 }, // Rare → reduce
];

/** Forgetting curve parameters */
const FORGETTING = {
    baseStability: 5,          // Days until 50% retention without review
    stabilityGrowth: 0.5,      // Stability increase per exposure
};

// ==================== Core Functions ====================

/**
 * Calculate prior probability P(known | word features)
 * Before any user-specific evidence
 */
export function calculatePrior(
    word: WordFeatures,
    userProfile: UserProfileForPrediction
): number {
    // 1. Base prior from JLPT level
    const levelKey = word.level.toUpperCase();
    let prior = LEVEL_PRIORS[levelKey] ?? LEVEL_PRIORS['unknown'];

    // 2. Frequency adjustment
    const freqFactor = getFrequencyFactor(word.frequencyRank);

    // Apply as multiplicative blend toward the mean
    // High frequency → pull toward 1.0, low frequency → pull toward 0.0
    prior = prior * freqFactor;

    // 3. Native language adjustment
    // Chinese speakers know more kanji words
    if (userProfile.nativeLang === 'zh' && word.isKanji) {
        prior = Math.min(1.0, prior + 0.12);
    }

    // English speakers might recognize loanwords
    if (userProfile.nativeLang === 'en' && word.isLoanword) {
        prior = Math.min(1.0, prior + 0.08);
    }

    // 4. Word length adjustment (very short words = typically common)
    if (word.length === 1) {
        prior = Math.min(1.0, prior + 0.10);
    } else if (word.length >= 5) {
        prior = Math.max(0.0, prior - 0.05);
    }

    // Clamp to valid probability range
    return Math.max(0.01, Math.min(0.99, prior));
}

/**
 * Get frequency factor for a given rank
 */
function getFrequencyFactor(rank: number): number {
    if (rank <= 0) return 0.80; // Not found → assume moderately rare

    for (const band of FREQUENCY_FACTORS) {
        if (rank <= band.maxRank) {
            return band.factor;
        }
    }
    return 0.55;
}

/**
 * Calculate likelihood ratio based on user evidence
 * Returns a multiplier for the prior odds
 */
export function calculateLikelihood(
    evidence: UserWordEvidence | null
): number {
    if (!evidence) {
        return 1.0; // No evidence → no change
    }

    // 1. Strong negative evidence: marked as unknown
    if (evidence.markedUnknown) {
        const daysSinceMarked = evidence.markedAt
            ? (Date.now() - evidence.markedAt.getTime()) / (1000 * 60 * 60 * 24)
            : 0;

        // Recent marking → strong evidence of not knowing
        // But with time + exposure, might have learned
        if (daysSinceMarked < 7) {
            // Very recent: strong negative
            return 0.15;
        } else if (daysSinceMarked < 30) {
            // Within a month: moderate negative, consider subsequent exposure
            const learningProgress = Math.min(1.0, evidence.notMarkedCount * 0.15);
            return 0.25 + learningProgress * 0.50;
        } else {
            // Old marking: weaker evidence, rely more on recent exposure
            const learningProgress = Math.min(1.0, evidence.notMarkedCount * 0.20);
            return 0.40 + learningProgress * 0.50;
        }
    }

    // 2. Weak positive evidence: exposure without marking
    // More exposures without marking → more likely known
    if (evidence.exposureCount > 0 && evidence.notMarkedCount > 0) {
        const exposureFactor = Math.min(2.0, 1.0 + evidence.notMarkedCount * 0.15);

        // Apply forgetting curve if there's a gap
        let retentionFactor = 1.0;
        if (evidence.lastSeenAt) {
            const daysSinceSeen = (Date.now() - evidence.lastSeenAt.getTime()) / (1000 * 60 * 60 * 24);
            const stability = FORGETTING.baseStability * (1 + evidence.exposureCount * FORGETTING.stabilityGrowth);
            retentionFactor = Math.exp(-daysSinceSeen / stability);
        }

        return exposureFactor * retentionFactor;
    }

    // 3. Just exposure without marking data
    if (evidence.exposureCount > 0) {
        return 1.0 + evidence.exposureCount * 0.05; // Slight positive
    }

    return 1.0;
}

/**
 * Calculate posterior P(known | word, user, evidence)
 * Using Bayesian update with log-odds
 */
export function predictKnowledgeProbability(
    word: WordFeatures,
    userProfile: UserProfileForPrediction,
    evidence: UserWordEvidence | null
): VocabularyPrediction {
    // 1. Calculate prior
    const prior = calculatePrior(word, userProfile);

    // 2. Calculate likelihood ratio
    const likelihood = calculateLikelihood(evidence);

    // 3. Bayesian update using log-odds
    const priorOdds = prior / (1 - prior);
    const posteriorOdds = priorOdds * likelihood;
    const posterior = posteriorOdds / (1 + posteriorOdds);

    // 4. Clamp to valid range
    const knownProbability = Math.max(0.01, Math.min(0.99, posterior));

    // 5. Determine confidence based on evidence quality
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (evidence) {
        if (evidence.markedUnknown || evidence.exposureCount >= 3) {
            confidence = 'high';
        } else if (evidence.exposureCount >= 1) {
            confidence = 'medium';
        }
    } else {
        // No evidence: rely on prior quality
        if (word.frequencyRank > 0 && word.frequencyRank <= 3000) {
            confidence = 'medium'; // Common words have reliable priors
        }
    }

    return {
        word: word.surface,
        knownProbability,
        confidence,
        contributingFactors: {
            levelFactor: LEVEL_PRIORS[word.level.toUpperCase()] ?? 0.4,
            frequencyFactor: getFrequencyFactor(word.frequencyRank),
            evidenceFactor: likelihood,
        },
    };
}

/**
 * Extract word features from a token
 */
export function extractWordFeatures(token: {
    token: string;
    lemma?: string;
    originalLevel: string;
    frequencyRank?: number;
}): WordFeatures {
    const surface = token.token;
    const lemma = token.lemma || surface;

    // Extract level from originalLevel (might be "N3" or "grammar (N2)")
    let level = 'unknown';
    const levelMatch = token.originalLevel.match(/N[1-5]/i);
    if (levelMatch) {
        level = levelMatch[0].toUpperCase();
    }

    // Get frequency rank
    const frequencyRank = token.frequencyRank ?? getFrequencyRank(surface, lemma);

    // Check character types
    const isKanji = /[\u4e00-\u9faf]/.test(surface);
    const isLoanword = /^[ァ-ヴー]+$/.test(surface);

    return {
        surface,
        lemma,
        level,
        frequencyRank,
        isKanji,
        isLoanword,
        length: surface.length,
    };
}

/**
 * Predict vocabulary knowledge for an entire article
 */
export function predictArticleVocabulary(
    tokens: Array<{
        token: string;
        lemma?: string;
        originalLevel: string;
        frequencyRank?: number;
        isContentWord: boolean;
    }>,
    userProfile: UserProfileForPrediction,
    evidenceMap: Map<string, UserWordEvidence>
): ArticleVocabularyPrediction {
    // Filter to content words only
    const contentTokens = tokens.filter(t => t.isContentWord);

    // Predict for each unique word
    const seenWords = new Set<string>();
    const predictions: VocabularyPrediction[] = [];

    for (const token of contentTokens) {
        const word = token.token;
        if (seenWords.has(word)) continue;
        seenWords.add(word);

        const features = extractWordFeatures(token);
        const evidence = evidenceMap.get(word) || evidenceMap.get(token.lemma || word) || null;

        const prediction = predictKnowledgeProbability(features, userProfile, evidence);
        predictions.push(prediction);
    }

    // Calculate summary statistics
    const unknownProbs = predictions.map(p => 1 - p.knownProbability);
    const expectedUnknownCount = unknownProbs.reduce((sum, p) => sum + p, 0);
    const predictedUnknownRate = predictions.length > 0
        ? expectedUnknownCount / predictions.length
        : 0;

    // Identify high-confidence unknowns
    const highConfidenceUnknown = predictions
        .filter(p => p.knownProbability < 0.3 && p.confidence === 'high')
        .map(p => p.word);

    // Identify uncertain words
    const uncertainWords = predictions
        .filter(p => p.confidence === 'low' && p.knownProbability > 0.3 && p.knownProbability < 0.7)
        .map(p => p.word);

    return {
        predictions,
        expectedUnknownCount,
        predictedUnknownRate,
        highConfidenceUnknown,
        uncertainWords,
    };
}
