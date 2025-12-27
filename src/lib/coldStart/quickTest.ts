/**
 * Quick Vocabulary Test for Cold Start
 * 
 * 20 words (4 per JLPT level) for rapid initial assessment
 */

import { JLPTLevel, BayesianUserProfile } from '@/lib/recommendation/vocabularyPredictor';

export interface QuickTestWord {
    word: string;
    reading: string;
    meaning: string;
    level: JLPTLevel;
}

export interface QuickTestResponse {
    word: string;
    level: JLPTLevel;
    isKnown: boolean;
}

/**
 * Test vocabulary: 4 words per level, selected for:
 * - Clear meaning (no ambiguity)
 * - Not obvious from kanji (fair to all learners)
 * - Representative difficulty
 */
export const QUICK_TEST_WORDS: QuickTestWord[] = [
    // N5 - Basic (4 words)
    { word: '食べる', reading: 'たべる', meaning: '吃', level: 'N5' },
    { word: '学校', reading: 'がっこう', meaning: '学校', level: 'N5' },
    { word: '高い', reading: 'たかい', meaning: '高的/贵的', level: 'N5' },
    { word: '電話', reading: 'でんわ', meaning: '电话', level: 'N5' },

    // N4 - Elementary (4 words)
    { word: '届ける', reading: 'とどける', meaning: '送达', level: 'N4' },
    { word: '経験', reading: 'けいけん', meaning: '经验', level: 'N4' },
    { word: '複雑', reading: 'ふくざつ', meaning: '复杂', level: 'N4' },
    { word: '比べる', reading: 'くらべる', meaning: '比较', level: 'N4' },

    // N3 - Intermediate (4 words)
    { word: '普及', reading: 'ふきゅう', meaning: '普及', level: 'N3' },
    { word: '維持', reading: 'いじ', meaning: '维持', level: 'N3' },
    { word: '把握', reading: 'はあく', meaning: '把握/掌握', level: 'N3' },
    { word: '促進', reading: 'そくしん', meaning: '促进', level: 'N3' },

    // N2 - Upper Intermediate (4 words)
    { word: '踏まえる', reading: 'ふまえる', meaning: '基于/考虑', level: 'N2' },
    { word: '抽象的', reading: 'ちゅうしょうてき', meaning: '抽象的', level: 'N2' },
    { word: '浸透', reading: 'しんとう', meaning: '渗透/普及', level: 'N2' },
    { word: '欠如', reading: 'けつじょ', meaning: '缺乏', level: 'N2' },

    // N1 - Advanced (4 words)
    { word: '凌駕', reading: 'りょうが', meaning: '凌驾/超越', level: 'N1' },
    { word: '弁舌', reading: 'べんぜつ', meaning: '口才', level: 'N1' },
    { word: '錯綜', reading: 'さくそう', meaning: '错综复杂', level: 'N1' },
    { word: '瓦解', reading: 'がかい', meaning: '瓦解/崩溃', level: 'N1' },
];

/**
 * Calculate profile from quick test responses
 */
export function calculateFromQuickTest(responses: QuickTestResponse[]): BayesianUserProfile {
    const levelStats: Record<JLPTLevel, { known: number; total: number }> = {
        N5: { known: 0, total: 0 },
        N4: { known: 0, total: 0 },
        N3: { known: 0, total: 0 },
        N2: { known: 0, total: 0 },
        N1: { known: 0, total: 0 },
    };

    for (const r of responses) {
        if (levelStats[r.level]) {
            levelStats[r.level].total++;
            if (r.isKnown) {
                levelStats[r.level].known++;
            }
        }
    }

    const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
    const jlptMastery: Record<JLPTLevel, number> = {
        N5: 0.70,  // Defaults
        N4: 0.45,
        N3: 0.25,
        N2: 0.10,
        N1: 0.05,
    };

    // Calculate mastery from test results
    for (const level of levels) {
        const stats = levelStats[level];
        if (stats.total > 0) {
            jlptMastery[level] = stats.known / stats.total;
        }
    }

    // Calculate estimated level
    const weights = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
    let weightedSum = 0;
    let totalWeight = 0;

    for (const level of levels) {
        weightedSum += jlptMastery[level] * weights[level];
        totalWeight += weights[level];
    }

    const estimatedLevel = 1.0 + (weightedSum / totalWeight) * 5.0;

    // Calculate frequency threshold from highest well-known level
    let frequencyThreshold = 5000;
    if (jlptMastery.N1 >= 0.5) frequencyThreshold = 15000;
    else if (jlptMastery.N2 >= 0.5) frequencyThreshold = 10000;
    else if (jlptMastery.N3 >= 0.5) frequencyThreshold = 7000;

    return {
        jlptMastery,
        frequencyThreshold,
        evidenceCount: responses.length,
        estimatedLevel: Math.max(1.0, Math.min(6.0, estimatedLevel)),
        lastUpdated: new Date(),
    };
}

/**
 * Shuffle array for randomized test order
 */
export function shuffleTestWords(): QuickTestWord[] {
    const words = [...QUICK_TEST_WORDS];
    for (let i = words.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [words[i], words[j]] = [words[j], words[i]];
    }
    return words;
}
