export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
    calculateUserProfileFromEvidence,
    getDefaultUserProfile,
    VocabKnowledgeRow
} from '@/lib/recommendation/vocabularyPredictor';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/vocabulary/profile
 * Returns user's BayesianUserProfile calculated from vocabulary knowledge
 * 
 * If user has no vocabulary data, returns profile based on onboarding self-report
 */
export async function GET(req: NextRequest) {
    try {
        console.log('[VocabProfile] Starting GET request');

        const supabase = await getSupabaseClient(req);
        console.log('[VocabProfile] Got Supabase client');

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            console.log('[VocabProfile] Auth failed:', authError);
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.log('[VocabProfile] User authenticated:', user.id);

        // 1. Try to get cached profile first
        const { data: cachedProfileData, error: profileError } = await supabase
            .from('profiles')
            .select('bayesian_profile, self_reported_jlpt, onboarding_completed')
            .eq('id', user.id)
            .single();

        if (cachedProfileData?.bayesian_profile) {
            console.log('[VocabProfile] Returning cached profile');
            return NextResponse.json({
                success: true,
                profile: cachedProfileData.bayesian_profile,
                source: 'cache',
            });
        }

        // 2. If no cache, calculate from evidence (fallback)
        console.log('[VocabProfile] Cache miss, calculating from evidence');

        // Fetch vocabulary knowledge data - handle missing table gracefully
        let knowledgeData: any[] | null = null;
        try {
            const { data, error: knowledgeError } = await supabase
                .from('user_vocabulary_knowledge')
                .select('word, jlpt_level, frequency_rank, marked_unknown, exposure_count, not_marked_count')
                .eq('user_id', user.id);

            if (knowledgeError) {
                console.log('[VocabProfile] Knowledge query failed (may be missing table):', knowledgeError.message);
                // Continue with null data - proceed to onboarding/default fallback
            } else {
                knowledgeData = data;
            }
        } catch (queryErr) {
            console.log('[VocabProfile] Exception in knowledge query:', queryErr);
            // Continue with null data
        }
        console.log('[VocabProfile] Knowledge data count:', knowledgeData?.length || 0);

        // If user has vocabulary data, calculate profile from evidence
        if (knowledgeData && knowledgeData.length > 0) {
            const vocabRows: VocabKnowledgeRow[] = knowledgeData.map(row => ({
                word: row.word,
                jlpt_level: row.jlpt_level,
                frequency_rank: row.frequency_rank,
                marked_unknown: row.marked_unknown || false,
                exposure_count: row.exposure_count || 0,
                not_marked_count: row.not_marked_count || 0,
            }));

            const profile = calculateUserProfileFromEvidence(vocabRows);

            // Optional: Cache it now? 
            // We can do a fire-and-forget update to populate the cache for next time
            // But let's keep GET idempotent-ish and rely on session save to populate it primarily.
            // Or we can populate it here to fix "cold cache" issues.
            // Let's populate it here to be helpful.
            try {
                await supabase.from('profiles').update({ bayesian_profile: profile }).eq('id', user.id);
            } catch (e) { /* ignore write error on GET */ }

            return NextResponse.json({
                success: true,
                profile,
                source: 'evidence',
                evidenceCount: knowledgeData.length,
            });
        }

        // No vocabulary data - try to get profile from onboarding
        const { data: profileData } = await supabase
            .from('profiles')
            .select('self_reported_jlpt, onboarding_completed')
            .eq('id', user.id)
            .single();

        if (profileData?.self_reported_jlpt) {
            // Create profile based on self-reported level
            const selfLevel = profileData.self_reported_jlpt as string;

            // Mastery lookup table based on self-reported level
            const masteryByLevel: Record<string, Record<'N5' | 'N4' | 'N3' | 'N2' | 'N1', number>> = {
                N5: { N5: 0.95, N4: 0.80, N3: 0.50, N2: 0.20, N1: 0.05 },
                N4: { N5: 0.98, N4: 0.90, N3: 0.60, N2: 0.25, N1: 0.08 },
                N3: { N5: 0.99, N4: 0.95, N3: 0.80, N2: 0.40, N1: 0.15 },
                N2: { N5: 0.99, N4: 0.98, N3: 0.90, N2: 0.70, N1: 0.30 },
                N1: { N5: 0.99, N4: 0.99, N3: 0.95, N2: 0.85, N1: 0.60 },
                unsure: { N5: 0.70, N4: 0.50, N3: 0.30, N2: 0.15, N1: 0.05 },
            };

            const levelMastery = masteryByLevel[selfLevel] || masteryByLevel['unsure'];

            // Calculate estimated level from mastery
            const weights: Record<'N5' | 'N4' | 'N3' | 'N2' | 'N1', number> = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
            let weightedSum = 0;
            let totalWeight = 0;
            const levels: ('N5' | 'N4' | 'N3' | 'N2' | 'N1')[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
            for (const level of levels) {
                const mastery = levelMastery[level];
                const w = weights[level];
                weightedSum += mastery * w;
                totalWeight += w;
            }
            const estimatedLevel = 1.0 + (weightedSum / totalWeight) * 5.0;

            const profile = {
                jlptMastery: levelMastery,
                frequencyThreshold: selfLevel === 'N1' ? 8000 : selfLevel === 'N2' ? 6000 : 4000,
                evidenceCount: 0,
                estimatedLevel: Math.max(1.0, Math.min(6.0, estimatedLevel)),
                lastUpdated: new Date(),
            };

            return NextResponse.json({
                success: true,
                profile,
                source: 'onboarding',
                selfReportedLevel: selfLevel,
            });
        }

        // No data at all - return default profile
        const defaultProfile = getDefaultUserProfile();
        return NextResponse.json({
            success: true,
            profile: defaultProfile,
            source: 'default',
        });

    } catch (error) {
        console.error('Error in GET vocabulary profile:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
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
