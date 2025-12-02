export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
    calculateDifficultyScore,
    pickTargetBand,
    UserAbilityState,
    ShadowingItemMetadata,
} from '@/lib/recommendation/difficulty';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
    try {
        // Auth setup
        const authHeader = req.headers.get('authorization') || '';
        const hasBearer = /^Bearer\s+/.test(authHeader);
        let supabase: SupabaseClient;

        if (hasBearer) {
            supabase = createClient(supabaseUrl, supabaseAnon, {
                auth: { persistSession: false, autoRefreshToken: false },
                global: { headers: { Authorization: authHeader } },
            });
        } else {
            const cookieStore = await cookies();
            supabase = (createServerClient(supabaseUrl, supabaseAnon, {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set() { },
                    remove() { },
                },
            }) as unknown) as SupabaseClient;
        }

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch User Profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('ability_level, vocab_unknown_rate, explore_config')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('Error fetching profile:', profileError);
            return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
        }

        const userState: UserAbilityState = {
            userId: user.id,
            level: profile.ability_level || 1.0,
            vocabUnknownRate: profile.vocab_unknown_rate || {},
            exploreConfig: profile.explore_config || {
                mainRatio: 0.6,
                downRatio: 0.2,
                upRatio: 0.2,
            },
        };

        // 2. Pick Target Band (Explore vs Exploit)
        const band = pickTargetBand(userState);

        // 3. Fetch Candidates (Simplified: fetch unpracticed items)
        // In a real scenario, we might filter by language or other prefs here
        // For now, let's fetch a batch of unpracticed items
        // We can reuse get_shadowing_catalog logic or just query shadowing_items directly
        // Let's query directly for simplicity and performance

        // Filter by rough level range first to avoid fetching everything
        let minLevel = 1, maxLevel = 6;
        if (band === 'down') {
            maxLevel = Math.floor(userState.level);
        } else if (band === 'main') {
            minLevel = Math.floor(userState.level);
            maxLevel = Math.ceil(userState.level) + 1;
        } else {
            minLevel = Math.ceil(userState.level);
        }

        // Ensure bounds
        minLevel = Math.max(1, minLevel);
        maxLevel = Math.max(minLevel, Math.min(6, maxLevel));

        const { data: items, error: itemsError } = await supabase
            .from('shadowing_items')
            .select('id, title, level, base_level, lex_profile, created_at, text, audio_url, duration_ms, tokens, cefr, genre, dialogue_type, translations, theme_id, subtopic_id')
            .gte('level', minLevel)
            .lte('level', maxLevel)
            .limit(50); // Fetch a pool to rank

        if (itemsError) {
            console.error('Error fetching items:', itemsError);
            return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
        }

        // Filter out practiced items (if not done in DB)
        // We need to check shadowing_sessions. 
        // Optimization: fetch practiced IDs first
        const { data: practicedSessions } = await supabase
            .from('shadowing_sessions')
            .select('item_id')
            .eq('user_id', user.id);

        const practicedIds = new Set(practicedSessions?.map(s => s.item_id) || []);

        const candidates = items.filter(item => !practicedIds.has(item.id));

        // 4. Score Candidates
        const scored = candidates.map(item => {
            const metadata: ShadowingItemMetadata = {
                id: item.id,
                level: item.base_level || item.level,
                lexProfile: item.lex_profile || {},
            };

            const score = calculateDifficultyScore(userState, metadata, band);
            return { item, score, reason: `Band: ${band}, Score: ${score.toFixed(2)}` };
        });

        // 5. Sort and Return
        scored.sort((a, b) => b.score - a.score);
        const topRecommendations = scored.slice(0, 5);

        return NextResponse.json({
            success: true,
            band,
            recommendations: topRecommendations,
        });

    } catch (error) {
        console.error('Error in recommendations API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
