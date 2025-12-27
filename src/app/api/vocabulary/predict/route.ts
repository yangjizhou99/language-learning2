export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
    predictArticleVocabulary,
    extractWordFeatures,
    UserProfileForPrediction,
    UserWordEvidence,
} from '@/lib/recommendation/vocabularyPredictor';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/vocabulary/predict
 * Predict user's knowledge of words in an article
 * 
 * Body:
 * - tokens: Array of { token, lemma?, originalLevel, frequencyRank?, isContentWord }
 * - userId?: string (optional, uses current user if not provided)
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await getSupabaseClient(req);

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { tokens } = body as {
            tokens: Array<{
                token: string;
                lemma?: string;
                originalLevel: string;
                frequencyRank?: number;
                isContentWord: boolean;
            }>;
        };

        if (!tokens || !Array.isArray(tokens)) {
            return NextResponse.json({ error: 'tokens array is required' }, { status: 400 });
        }

        // 1. Fetch ALL user's vocabulary knowledge (for profile calculation)
        const { data: allKnowledgeData } = await supabase
            .from('user_vocabulary_knowledge')
            .select('word, jlpt_level, frequency_rank, marked_unknown, exposure_count, not_marked_count, marked_at, first_seen_at, last_seen_at')
            .eq('user_id', user.id);

        // 2. Build user profile from evidence
        const {
            calculateUserProfileFromEvidence,
            getDefaultUserProfile
        } = await import('@/lib/recommendation/vocabularyPredictor');
        const { blendWithSelfReport } = await import('@/lib/coldStart/selfReportProfiles');

        let bayesianProfile;
        if (allKnowledgeData && allKnowledgeData.length >= 5) {
            bayesianProfile = calculateUserProfileFromEvidence(allKnowledgeData);
        } else {
            bayesianProfile = getDefaultUserProfile();
        }

        // 3. Fetch native language and self-reported level
        const { data: profile } = await supabase
            .from('profiles')
            .select('native_lang, self_reported_jlpt')
            .eq('id', user.id)
            .single();

        // 4. Blend with self-report if available (for cold start)
        if (profile?.self_reported_jlpt && bayesianProfile.evidenceCount < 100) {
            bayesianProfile = blendWithSelfReport(bayesianProfile, profile.self_reported_jlpt);
        }

        // Create legacy-compatible profile for predictArticleVocabulary
        const userProfile: UserProfileForPrediction = {
            nativeLang: profile?.native_lang || 'en',
            abilityLevel: bayesianProfile.estimatedLevel,
            vocabUnknownRate: undefined, // No longer used
        };

        // 4. Build evidence map for article tokens
        const contentWords = tokens.filter(t => t.isContentWord);
        const wordList = [...new Set(contentWords.map(t => t.token))];

        let evidenceMap = new Map<string, UserWordEvidence>();

        if (allKnowledgeData) {
            for (const row of allKnowledgeData) {
                if (wordList.includes(row.word)) {
                    evidenceMap.set(row.word, {
                        markedUnknown: row.marked_unknown || false,
                        markedAt: row.marked_at ? new Date(row.marked_at) : undefined,
                        exposureCount: row.exposure_count || 0,
                        notMarkedCount: row.not_marked_count || 0,
                        firstSeenAt: row.first_seen_at ? new Date(row.first_seen_at) : undefined,
                        lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : undefined,
                    });
                }
            }
        }

        // 5. Run predictions
        const prediction = predictArticleVocabulary(tokens, userProfile, evidenceMap);

        return NextResponse.json({
            success: true,
            prediction: {
                ...prediction,
                // Convert to serializable format
                predictions: prediction.predictions.map(p => ({
                    ...p,
                    // Round to 3 decimal places
                    knownProbability: Math.round(p.knownProbability * 1000) / 1000,
                })),
            },
            // Include new profile info
            userProfile: {
                jlptMastery: bayesianProfile.jlptMastery,
                frequencyThreshold: bayesianProfile.frequencyThreshold,
                evidenceCount: bayesianProfile.evidenceCount,
                estimatedLevel: Math.round(bayesianProfile.estimatedLevel * 100) / 100,
            },
        });
    } catch (error) {
        console.error('Error in POST vocabulary predict:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

async function getSupabaseClient(req: NextRequest): Promise<SupabaseClient> {
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);

    if (hasBearer) {
        return createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: authHeader } },
        });
    } else {
        const cookieStore = await cookies();
        return createServerClient(supabaseUrl, supabaseAnon, {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set() { },
                remove() { },
            },
        }) as unknown as SupabaseClient;
    }
}
