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

/** Article difficulty calculation result */
export interface ArticleDifficultyResult {
    vocabDifficulty: number;           // 1.0 - 6.0
    grammarDifficulty: number;         // 1.0 - 6.0
    overallDifficulty: number;         // 1.0 - 6.0 (weighted average)
    confidenceScore: number;           // 0.0 - 1.0
    explanation: string;               // Human-readable difficulty description
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

/**
 * Article lex_profile structure (as saved in database)
 */
export interface ArticleLexProfile {
    A1_A2: number;      // Count of N5/N4 level words
    B1_B2: number;      // Count of N3 level words
    C1_plus: number;    // Count of N2/N1 level words
    unknown: number;    // Count of unknown/unclassified words
    contentWordCount?: number;
    totalTokens?: number;
}

/**
 * Calculate precise unknown rate for an article based on its vocabulary distribution
 * and user's mastery profile.
 * 
 * Formula: Unknown Rate = Σ (word_count × (1 - mastery)) / total_words
 * 
 * @param lexProfile - Article's vocabulary distribution from lex_profile field
 * @param userProfile - User's Bayesian profile with JLPT mastery levels
 * @returns Predicted unknown rate (0.0 - 1.0)
 */
export function calculatePreciseUnknownRate(
    lexProfile: ArticleLexProfile,
    userProfile: BayesianUserProfile
): number {
    const { jlptMastery } = userProfile;

    // Calculate unknown rate for each CEFR band based on JLPT mastery
    // A1_A2 maps to average of N5/N4 mastery
    const a1a2UnknownRate = 1 - (jlptMastery.N5 + jlptMastery.N4) / 2;

    // B1_B2 maps to N3 mastery
    const b1b2UnknownRate = 1 - jlptMastery.N3;

    // C1_plus maps to average of N2/N1 mastery
    const c1plusUnknownRate = 1 - (jlptMastery.N2 + jlptMastery.N1) / 2;

    // Unknown words assumed 80% unknown (conservative estimate)
    const unknownWordRate = 0.80;

    // Calculate total words and weighted unknown count
    const total = lexProfile.A1_A2 + lexProfile.B1_B2 + lexProfile.C1_plus + lexProfile.unknown;

    if (total === 0) return 0;

    const weightedUnknown =
        lexProfile.A1_A2 * a1a2UnknownRate +
        lexProfile.B1_B2 * b1b2UnknownRate +
        lexProfile.C1_plus * c1plusUnknownRate +
        lexProfile.unknown * unknownWordRate;

    return Math.max(0, Math.min(1, weightedUnknown / total));
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
/**
 * Calculate likelihood ratio based on user evidence
 * Returns a multiplier for the prior odds
 * 
 * Improved with FSRS-inspired forgetting curve logic
 */
export function calculateLikelihood(
    evidence: UserWordEvidence | null
): number {
    if (!evidence) {
        return 1.0; // No evidence → no change
    }

    const now = Date.now();

    // 1. Strong negative evidence: marked as unknown
    if (evidence.markedUnknown) {
        const daysSinceMarked = evidence.markedAt
            ? (now - evidence.markedAt.getTime()) / (1000 * 60 * 60 * 24)
            : 0;

        // Recent marking → strong evidence of not knowing
        if (daysSinceMarked < 1) {
            return 0.10; // Extremely unlikely to know immediately after marking
        } else if (daysSinceMarked < 7) {
            return 0.15;
        } else if (daysSinceMarked < 30) {
            // Within a month: moderate negative, consider subsequent exposure
            // If seen many times since marking, probability recovers slightly
            const recovery = Math.min(0.5, evidence.notMarkedCount * 0.1);
            return 0.25 + recovery;
        } else {
            // Old marking: weaker evidence, rely more on recent exposure
            const recovery = Math.min(0.6, evidence.notMarkedCount * 0.15);
            return 0.40 + recovery;
        }
    }

    // 2. Positive evidence: exposure without marking
    if (evidence.exposureCount > 0) {
        // Base factor from number of exposures
        // Diminishing returns: 1->1.2, 5->1.8, 10->2.1
        const exposureFactor = 1.0 + Math.log(evidence.exposureCount + 1) * 0.4;

        // Forgetting curve: Retention = exp(-t/S)
        // Stability (S) increases with repetitions
        let stability = FORGETTING.baseStability * Math.pow(1 + FORGETTING.stabilityGrowth, Math.min(10, evidence.exposureCount));

        // Calculate time since last seen
        let daysSinceSeen = 0;
        if (evidence.lastSeenAt) {
            daysSinceSeen = (now - evidence.lastSeenAt.getTime()) / (1000 * 60 * 60 * 24);
        } else if (evidence.firstSeenAt) {
            // Fallback if lastSeenAt missing
            daysSinceSeen = (now - evidence.firstSeenAt.getTime()) / (1000 * 60 * 60 * 24);
        }

        // Apply forgetting
        const retention = Math.exp(-daysSinceSeen / stability);

        // Likelihood is boosted by exposure, but dampened by forgetting
        // We ensure it doesn't drop below 1.0 if there was significant exposure (some residual memory)
        const smoothedRetention = 0.4 + 0.6 * retention; // Never fully forget "that I saw it"

        return 1.0 + (exposureFactor - 1.0) * smoothedRetention;
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

/**
 * Calculate overall article difficulty based on Bayesian predictions
 * Returns a difficulty score from 1.0 (very easy) to 6.0 (very hard)
 */
export function calculateArticleDifficulty(
    articlePrediction: ArticleVocabularyPrediction,
    grammarProfile?: { overallLevel: string }
): ArticleDifficultyResult {
    const unknownRate = articlePrediction.predictedUnknownRate;

    // Map unknown rate to difficulty (1.0-6.0)
    // 0% unknown → 1.0, 5% → 2.0, 15% → 3.5, 30%+ → 6.0
    let vocabDifficulty: number;
    if (unknownRate < 0.02) {
        vocabDifficulty = 1.0;
    } else if (unknownRate < 0.05) {
        vocabDifficulty = 1.0 + (unknownRate - 0.02) / 0.03 * 1.0;
    } else if (unknownRate < 0.15) {
        vocabDifficulty = 2.0 + (unknownRate - 0.05) / 0.10 * 1.5;
    } else if (unknownRate < 0.30) {
        vocabDifficulty = 3.5 + (unknownRate - 0.15) / 0.15 * 1.5;
    } else {
        vocabDifficulty = Math.min(6.0, 5.0 + (unknownRate - 0.30) / 0.20 * 1.0);
    }

    // Grammar difficulty from JLPT level
    const grammarLevelMap: Record<string, number> = {
        N5: 1.5, N4: 2.5, N3: 3.5, N2: 4.5, N1: 5.5, unknown: 3.0
    };
    const grammarDifficulty = grammarLevelMap[grammarProfile?.overallLevel || 'unknown'] || 3.0;

    // Overall: weighted average (60% vocab, 40% grammar)
    const overallDifficulty = 0.6 * vocabDifficulty + 0.4 * grammarDifficulty;

    // Confidence based on evidence quality
    const highConfidence = articlePrediction.predictions.filter(p => p.confidence === 'high').length;
    const totalPredictions = articlePrediction.predictions.length;
    const confidenceScore = totalPredictions > 0 ? highConfidence / totalPredictions : 0;

    // Generate explanation
    let explanation: string;
    if (overallDifficulty < 2.5) {
        explanation = '适合入门学习者';
    } else if (overallDifficulty < 4.0) {
        explanation = '适合中级学习者';
    } else if (overallDifficulty < 5.0) {
        explanation = '适合高级学习者';
    } else {
        explanation = '适合精通者';
    }

    return {
        vocabDifficulty: Math.round(vocabDifficulty * 10) / 10,
        grammarDifficulty,
        overallDifficulty: Math.round(overallDifficulty * 10) / 10,
        confidenceScore: Math.round(confidenceScore * 100) / 100,
        explanation
    };
}
