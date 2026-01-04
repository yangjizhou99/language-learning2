'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface WordKnowledge {
    word: string;
    markedUnknown: boolean;
    exposureCount: number;
    notMarkedCount: number;
}

export interface PredictedWord {
    word: string;
    confidence: 'high' | 'medium' | 'low';
    reason: 'marked_unknown' | 'never_seen' | 'few_exposures';
}

interface UsePredictedWordsOptions {
    /** List of content words to check */
    contentWords: string[];
    /** Whether to enable fetching */
    enabled?: boolean;
}

interface UsePredictedWordsResult {
    /** Words predicted to be unknown */
    predictedUnknown: Set<string>;
    /** Knowledge data for all queried words */
    wordKnowledge: Map<string, WordKnowledge>;
    loading: boolean;
    error: string | null;
}

/**
 * Hook to fetch user's vocabulary knowledge and predict unknown words
 */
export function usePredictedWords({
    contentWords,
    enabled = true,
}: UsePredictedWordsOptions): UsePredictedWordsResult {
    const [predictedUnknown, setPredictedUnknown] = useState<Set<string>>(new Set());
    const [wordKnowledge, setWordKnowledge] = useState<Map<string, WordKnowledge>>(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastWordsRef = useRef<string>('');

    const fetchKnowledge = useCallback(async () => {
        if (!enabled || contentWords.length === 0) {
            return;
        }

        // Create a stable key for comparison
        const wordsKey = [...new Set(contentWords)].sort().join(',');
        if (lastWordsRef.current === wordsKey) {
            return; // Skip if same words
        }
        lastWordsRef.current = wordsKey;

        setLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setLoading(false);
                return;
            }

            // Deduplicate and limit query size
            const uniqueWords = [...new Set(contentWords)].slice(0, 200);

            // Fetch knowledge from API
            const response = await fetch(`/api/vocabulary/knowledge?words=${encodeURIComponent(uniqueWords.join(','))}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch vocabulary knowledge');
            }

            const data = await response.json();

            if (data.success && data.knowledge) {
                const knowledgeMap = new Map<string, WordKnowledge>();
                const unknownSet = new Set<string>();

                // Process known words
                for (const [word, info] of Object.entries(data.knowledge as Record<string, any>)) {
                    knowledgeMap.set(word, {
                        word,
                        markedUnknown: info.markedUnknown || false,
                        exposureCount: info.exposureCount || 0,
                        notMarkedCount: info.notMarkedCount || 0,
                    });

                    // Predict as unknown if:
                    // 1. Previously marked as unknown
                    // 2. Never seen but not marked yet (high probability unknown for rare words)
                    if (info.markedUnknown) {
                        unknownSet.add(word);
                    }
                }

                // Words not in knowledge are never seen - predict as potentially unknown
                // But only for words that look like real vocabulary (not particles)
                for (const word of uniqueWords) {
                    if (!knowledgeMap.has(word) && word.length > 1) {
                        // Never seen - might be unknown, add with lower priority
                        // unknownSet.add(word); // Commented: too noisy, only show marked unknown
                    }
                }

                setWordKnowledge(knowledgeMap);
                setPredictedUnknown(unknownSet);
            }
        } catch (err) {
            console.error('Error fetching word predictions:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [contentWords, enabled]);

    useEffect(() => {
        fetchKnowledge();
    }, [fetchKnowledge]);

    return { predictedUnknown, wordKnowledge, loading, error };
}

/**
 * Check if a word is predicted unknown
 */
export function isPredictedUnknown(word: string, unknownSet: Set<string>): boolean {
    return unknownSet.has(word);
}
