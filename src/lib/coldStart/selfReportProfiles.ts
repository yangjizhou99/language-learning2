/**
 * Self-Report JLPT Profile Mappings
 * 
 * Maps user's self-reported JLPT level to initial profile estimates
 */

import { JLPTLevel, BayesianUserProfile } from '@/lib/recommendation/vocabularyPredictor';

/** Self-reported JLPT level options */
export type SelfReportedLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'unsure';

/** 
 * Mapping from self-reported level to JLPT mastery estimates
 * Represents P(knows word | word is level X, user reports level Y)
 */
const SELF_REPORT_MAPPINGS: Record<SelfReportedLevel, Record<JLPTLevel, number>> = {
    N5: {
        N5: 0.70,
        N4: 0.30,
        N3: 0.10,
        N2: 0.05,
        N1: 0.02,
    },
    N4: {
        N5: 0.90,
        N4: 0.70,
        N3: 0.40,
        N2: 0.15,
        N1: 0.05,
    },
    N3: {
        N5: 0.95,
        N4: 0.90,
        N3: 0.70,
        N2: 0.40,
        N1: 0.15,
    },
    N2: {
        N5: 0.98,
        N4: 0.95,
        N3: 0.90,
        N2: 0.70,
        N1: 0.35,
    },
    N1: {
        N5: 0.99,
        N4: 0.98,
        N3: 0.95,
        N2: 0.90,
        N1: 0.70,
    },
    unsure: {
        // Default to roughly N4 level
        N5: 0.85,
        N4: 0.60,
        N3: 0.35,
        N2: 0.15,
        N1: 0.05,
    },
};

/**
 * Get initial profile from self-reported JLPT level
 */
export function getProfileFromSelfReport(level: SelfReportedLevel): BayesianUserProfile {
    const mastery = SELF_REPORT_MAPPINGS[level] || SELF_REPORT_MAPPINGS.unsure;

    // Calculate estimated level (1.0 - 6.0)
    const weights = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
    const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

    let weightedSum = 0;
    let totalWeight = 0;
    for (const l of levels) {
        weightedSum += mastery[l] * weights[l];
        totalWeight += weights[l];
    }
    const estimatedLevel = 1.0 + (weightedSum / totalWeight) * 5.0;

    return {
        jlptMastery: mastery,
        frequencyThreshold: level === 'N1' ? 10000 : level === 'N2' ? 7000 : 5000,
        evidenceCount: 0,  // No real evidence yet
        estimatedLevel: Math.max(1.0, Math.min(6.0, estimatedLevel)),
        lastUpdated: new Date(),
    };
}

/**
 * Blend self-reported profile with evidence-based profile
 * As evidence accumulates, self-report influence decreases
 */
export function blendWithSelfReport(
    evidenceProfile: BayesianUserProfile,
    selfReportLevel: SelfReportedLevel
): BayesianUserProfile {
    const selfReportProfile = getProfileFromSelfReport(selfReportLevel);

    // Evidence weight increases with data, maxing out at 100 evidence points
    const evidenceWeight = Math.min(1.0, evidenceProfile.evidenceCount / 100);
    const selfReportWeight = 1 - evidenceWeight;

    const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
    const blendedMastery: Record<JLPTLevel, number> = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 };

    for (const level of levels) {
        blendedMastery[level] =
            evidenceWeight * evidenceProfile.jlptMastery[level] +
            selfReportWeight * selfReportProfile.jlptMastery[level];
    }

    return {
        jlptMastery: blendedMastery,
        frequencyThreshold: evidenceWeight > 0.5
            ? evidenceProfile.frequencyThreshold
            : selfReportProfile.frequencyThreshold,
        evidenceCount: evidenceProfile.evidenceCount,
        estimatedLevel: evidenceWeight * evidenceProfile.estimatedLevel +
            selfReportWeight * selfReportProfile.estimatedLevel,
        lastUpdated: new Date(),
    };
}
